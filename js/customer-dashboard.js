import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ===== إعدادات Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  storageBucket: "techluxury-4b854.firebasestorage.app",
  messagingSenderId: "1043863547919",
  appId: "1:1043863547919:web:46bd7c74f0fbeb2702b37a",
  measurementId: "G-EZJWPY4Q2Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== إعدادات Cloudinary =====
const CLOUDINARY_CLOUD_NAME = "ypwbnpyd";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

/**
 * رفع ملف إلى Cloudinary
 * @param {File} file - الملف المطلوب رفعه
 * @param {string} resourceType - نوع المورد (image/video/auto)
 * @param {function} onProgress - دالة تستقبل نسبة التقدم (0-100)
 */
function uploadToCloudinary(file, resourceType = "auto", onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        // تتبع تقدم الرفع
        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.secure_url);
                } catch (err) {
                    reject(new Error("فشل تحليل استجابة Cloudinary"));
                }
            } else {
                try {
                    const errData = JSON.parse(xhr.responseText);
                    reject(new Error(errData.error?.message || "فشل رفع الملف"));
                } catch {
                    reject(new Error("فشل رفع الملف (كود: " + xhr.status + ")"));
                }
            }
        };

        xhr.onerror = () => reject(new Error("خطأ في الاتصال بـ Cloudinary"));
        xhr.send(formData);
    });
}

/**
 * ضغط صورة قبل الرفع (لتقليل الحجم)
 */
async function compressImage(file, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve) => {
        // إذا كان الملف ليس صورة، أرجعه كما هو
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // تصغير الأبعاد إذا كانت أكبر من الحد الأقصى
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File(
                                [blob],
                                file.name.replace(/\.[^.]+$/, ".jpg"),
                                { type: "image/jpeg", lastModified: Date.now() }
                            );
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// ===== عناصر الصفحة =====
const userEmailEl = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");
const btnClaimCard = document.getElementById("btnClaimCard");
const cardIdInput = document.getElementById("cardIdInput");
const myCardsList = document.getElementById("myCardsList");
const editModal = document.getElementById("editModal");
const editCardForm = document.getElementById("editCardForm");
const btnCloseModal = document.getElementById("btnCloseModal");

let currentUser = null;
let currentCardData = null; // لتخزين بيانات الكرت الحالي أثناء التعديل
let imagesToDelete = [];    // لتخزين روابط الصور المطلوب حذفها

// ===== التحقق من تسجيل الدخول =====
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    if (userEmailEl) userEmailEl.textContent = user.email;
    await loadUserCards(user.uid);
});

// ===== تسجيل الخروج =====
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });
}

// ===== 🎯 زر ربط الكرت =====
if (btnClaimCard) {
    btnClaimCard.addEventListener("click", async (e) => {
        e.preventDefault();

        const cardId = cardIdInput.value.trim().toUpperCase();

        if (!cardId) {
            alert("الرجاء إدخال رمز الكرت");
            return;
        }

        if (!currentUser) {
            alert("يجب تسجيل الدخول أولاً");
            return;
        }

        btnClaimCard.disabled = true;
        btnClaimCard.innerText = "جاري الربط...";

        try {
            const cardRef = doc(db, "cards", cardId);
            const cardSnap = await getDoc(cardRef);

            if (!cardSnap.exists()) {
                alert("❌ هذا الكرت غير موجود، تأكد من الرمز");
                return;
            }

            const cardData = cardSnap.data();

            if (cardData.ownerId && cardData.ownerId !== currentUser.uid) {
                alert("❌ هذا الكرت مربوط بحساب آخر");
                return;
            }

            if (cardData.ownerId === currentUser.uid) {
                alert("⚠️ هذا الكرت مربوط بحسابك بالفعل");
                return;
            }

            await updateDoc(cardRef, {
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                claimedAt: serverTimestamp()
            });

            alert("✅ تم ربط الكرت بنجاح!");
            cardIdInput.value = "";
            await loadUserCards(currentUser.uid);

        } catch (error) {
            console.error("خطأ أثناء الربط:", error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btnClaimCard.disabled = false;
            btnClaimCard.innerText = "ربط الكرت";
        }
    });
}

// ===== تحميل كروت المستخدم =====
async function loadUserCards(uid) {
    if (!myCardsList) return;
    myCardsList.innerHTML = "<p style='color:#94a3b8;'>جاري التحميل...</p>";

    try {
        const q = query(collection(db, "cards"), where("ownerId", "==", uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            myCardsList.innerHTML = "<p style='color:#94a3b8;'>لا توجد كروت مربوطة بحسابك بعد.</p>";
            return;
        }

        myCardsList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const card = docSnap.data();
            const cardId = docSnap.id;

            const cardEl = document.createElement("div");
            cardEl.className = "my-card";
            cardEl.innerHTML = `
                <div>
                    <h3>${card.title || "قلادة بدون عنوان"}</h3>
                    <p>رمز الكرت: ${cardId}</p>
                    <p>${card.message ? card.message.substring(0, 80) + "..." : "لا توجد رسالة"}</p>
                </div>
                <button class="btn-edit-memory" data-id="${cardId}">
                    <i class="fa-solid fa-pen"></i> تعديل الذكريات
                </button>
            `;

            cardEl.querySelector(".btn-edit-memory").addEventListener("click", () => {
                openEditModal(cardId, card);
            });

            myCardsList.appendChild(cardEl);
        });

    } catch (error) {
        console.error("خطأ في تحميل الكروت:", error);
        myCardsList.innerHTML = "<p style='color:#f87171;'>فشل تحميل الكروت</p>";
    }
}

// ===== فتح نافذة التعديل =====
function openEditModal(cardId, card) {
    currentCardData = { ...card, id: cardId };
    imagesToDelete = [];

    document.getElementById("editCardId").value = cardId;
    document.getElementById("editTitle").value = card.title || "";
    document.getElementById("editMessage").value = card.message || "";
    document.getElementById("editSecurityQuestion").value = card.securityQuestion || "";
    document.getElementById("editSecurityAnswer").value = card.securityAnswer || "";

    // إعادة تعيين حقول الملفات
    document.getElementById("editImages").value = "";
    document.getElementById("editVideo").value = "";
    document.getElementById("editAudio").value = "";
    document.getElementById("imagesStatus").textContent = "";
    document.getElementById("videoStatus").textContent = "";
    document.getElementById("audioStatus").textContent = "";

    // عرض الملفات الحالية
    renderCurrentImages(card.images || []);

    if (card.videoUrl) {
        document.getElementById("videoStatus").textContent = "✅ يوجد فيديو محفوظ مسبقاً (سيتم استبداله إذا رفعت فيديو جديد)";
    }
    if (card.bgMusicUrl) {
        document.getElementById("audioStatus").textContent = "✅ توجد موسيقى محفوظة مسبقاً (سيتم استبدالها إذا رفعت ملفاً جديداً)";
    }

    editModal.classList.add("active");
}

// ===== عرض الصور الحالية مع زر حذف =====
function renderCurrentImages(images) {
    const container = document.getElementById("currentImagesContainer");
    if (!container) return;

    if (!images || images.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8; font-size:0.85rem;'>لا توجد صور محفوظة بعد.</p>";
        return;
    }

    container.innerHTML = "";
    images.forEach((url, index) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative; display:inline-block; margin:5px;";
        wrapper.innerHTML = `
            <img src="${url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #2e374a;">
            <button type="button" data-url="${url}" style="
                position:absolute; top:-6px; right:-6px;
                background:#ef4444; color:#fff; border:none;
                width:22px; height:22px; border-radius:50%;
                cursor:pointer; font-size:12px; line-height:1;
            ">×</button>
        `;
        wrapper.querySelector("button").addEventListener("click", (e) => {
            const urlToDelete = e.target.dataset.url;
            imagesToDelete.push(urlToDelete);
            wrapper.remove();

            if (imagesToDelete.length > 0) {
                document.getElementById("imagesStatus").textContent =
                    `⚠️ سيتم حذف ${imagesToDelete.length} صورة عند الحفظ`;
            }
        });
        container.appendChild(wrapper);
    });
}

// ===== إغلاق النافذة =====
if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
        editModal.classList.remove("active");
    });
}

// ===== حفظ التعديلات + رفع الوسائط =====
if (editCardForm) {
    editCardForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const cardId = document.getElementById("editCardId").value;
        const title = document.getElementById("editTitle").value.trim();
        const message = document.getElementById("editMessage").value.trim();
        const securityQuestion = document.getElementById("editSecurityQuestion").value.trim();
        const securityAnswer = document.getElementById("editSecurityAnswer").value.trim().toLowerCase();

        const imageFiles = document.getElementById("editImages").files;
        const videoFile = document.getElementById("editVideo").files[0];
        const audioFile = document.getElementById("editAudio").files[0];

        const btnSave = document.getElementById("btnSaveData");
        const originalText = btnSave.innerText;
        btnSave.innerText = "جاري رفع الملفات...";
        btnSave.disabled = true;

        try {
            // 🔒 تحقق أمني: التأكد أن الكرت يخص المستخدم الحالي
            const cardRef = doc(db, "cards", cardId);
            const cardSnap = await getDoc(cardRef);
            if (!cardSnap.exists() || cardSnap.data().ownerId !== currentUser.uid) {
                throw new Error("غير مصرح لك بتعديل هذا الكرت");
            }

            const updatePayload = {
                title,
                message,
                securityQuestion,
                securityAnswer,
                updatedAt: serverTimestamp()
            };

            // ===== 1. معالجة الصور =====
            let finalImages = (cardSnap.data().images || []).filter(
                (url) => !imagesToDelete.includes(url)
            );

            if (imageFiles && imageFiles.length > 0) {
                const total = imageFiles.length;
                for (let i = 0; i < total; i++) {
                    const originalFile = imageFiles[i];
                    btnSave.innerText = `جاري ضغط الصورة ${i + 1}/${total}...`;

                    const compressedFile = await compressImage(originalFile);

                    btnSave.innerText = `جاري رفع الصورة ${i + 1}/${total}...`;
                    const url = await uploadToCloudinary(
                        compressedFile,
                        "image",
                        (percent) => {
                            btnSave.innerText = `رفع الصورة ${i + 1}/${total} — ${percent}%`;
                        }
                    );
                    finalImages.push(url);
                }
            }
            updatePayload.images = finalImages;

            // ===== 2. معالجة الفيديو =====
            if (videoFile) {
                btnSave.innerText = "جاري رفع الفيديو...";
                updatePayload.videoUrl = await uploadToCloudinary(
                    videoFile,
                    "video",
                    (percent) => {
                        btnSave.innerText = `رفع الفيديو — ${percent}%`;
                    }
                );
            }

            // ===== 3. معالجة الصوت =====
            if (audioFile) {
                btnSave.innerText = "جاري رفع الموسيقى...";
                updatePayload.bgMusicUrl = await uploadToCloudinary(
                    audioFile,
                    "auto",
                    (percent) => {
                        btnSave.innerText = `رفع الموسيقى — ${percent}%`;
                    }
                );
            }

            // ===== 4. الحفظ النهائي في Firestore =====
            btnSave.innerText = "جاري الحفظ النهائي...";
            await updateDoc(cardRef, updatePayload);

            alert("✅ تم حفظ التغييرات بنجاح!");
            editModal.classList.remove("active");
            imagesToDelete = [];
            await loadUserCards(currentUser.uid);

        } catch (error) {
            console.error("خطأ:", error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btnSave.innerText = originalText;
            btnSave.disabled = false;
        }
    });
}
