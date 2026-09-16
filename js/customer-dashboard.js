import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp 
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

// ===== Cloudinary =====
const CLOUDINARY_CLOUD_NAME = "ypwbnpyd";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

function uploadToCloudinary(file, resourceType = "auto", onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText).secure_url); }
                catch { reject(new Error("فشل تحليل الاستجابة")); }
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.error?.message || "فشل الرفع"));
                } catch { reject(new Error("فشل الرفع (كود " + xhr.status + ")")); }
            }
        };
        xhr.onerror = () => reject(new Error("خطأ في الاتصال بـ Cloudinary"));
        xhr.send(formData);
    });
}

async function compressImage(file, maxWidth = 1920, quality = 0.85) {
    if (!file.type.startsWith("image/")) return file;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                            type: "image/jpeg", lastModified: Date.now()
                        }));
                    } else resolve(file);
                }, "image/jpeg", quality);
            };
            img.onerror = () => resolve(file);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

// ===== أنواع الكروت =====
const CARD_TYPES = [
    {
        id: "birthday",
        label: "عيد ميلاد",
        icon: "fa-birthday-cake",
        features: { date: true, message: true, images: true, video: true, music: true, security: true }
    },
    {
        id: "anniversary",
        label: "ذكرى زواج",
        icon: "fa-ring",
        features: { date: true, message: true, images: true, video: true, music: true, security: true }
    },
    {
        id: "graduation",
        label: "تخرج",
        icon: "fa-graduation-cap",
        features: { date: true, message: true, images: true, video: true, music: true, security: true }
    },
    {
        id: "mothers_day",
        label: "عيد الأم",
        icon: "fa-heart",
        features: { date: false, message: true, images: true, video: true, music: true, security: true }
    },
    {
        id: "ramadan",
        label: "رمضان / عيد",
        icon: "fa-moon",
        features: { date: true, message: true, images: true, video: true, music: true, security: true }
    },
    {
        id: "photo_album",
        label: "ألبوم صور",
        icon: "fa-images",
        features: { date: false, message: false, images: true, video: false, music: true, security: false }
    },
    {
        id: "video_card",
        label: "كرت فيديو",
        icon: "fa-video",
        features: { date: false, message: true, images: false, video: true, music: true, security: false }
    },
    {
        id: "free",
        label: "مناسبة حرة",
        icon: "fa-gift",
        features: { date: true, message: true, images: true, video: true, music: true, security: true }
    }
];

// ===== الحالة العامة =====
let currentUser = null;
let currentCard = null;
let selectedType = null;      // نوع الكرت المختار
let pendingCardId = null;     // معرف الكرت المراد تعديله

// حالة الملفات
let newImages = [];
let currentImages = [];
let imagesToDelete = [];
let newVideo = null;
let newBgMusicFile = null;

// ===== عناصر الصفحة =====
const userEmailEl = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");
const btnClaimCard = document.getElementById("btnClaimCard");
const cardIdInput = document.getElementById("cardIdInput");
const myCardsList = document.getElementById("myCardsList");
const editModal = document.getElementById("editModal");
const editCardForm = document.getElementById("editCardForm");
const btnCloseModal = document.getElementById("btnCloseModal");
const modalTitle = document.getElementById("modalTitle");
const stepTypeSelect = document.getElementById("stepTypeSelect");
const stepCardFields = document.getElementById("stepCardFields");
const typeSelector = document.getElementById("typeSelector");
const btnConfirmType = document.getElementById("btnConfirmType");
const btnChangeType = document.getElementById("btnChangeType");

// ===== التحقق من تسجيل الدخول =====
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }
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

// ===== ربط الكرت =====
if (btnClaimCard) {
    btnClaimCard.addEventListener("click", async (e) => {
        e.preventDefault();
        const cardId = cardIdInput.value.trim().toUpperCase();
        if (!cardId) { alert("الرجاء إدخال رمز الكرت"); return; }
        if (!currentUser) { alert("يجب تسجيل الدخول أولاً"); return; }

        btnClaimCard.disabled = true;
        btnClaimCard.innerText = "جاري الربط...";

        try {
            const cardRef = doc(db, "cards", cardId);
            const cardSnap = await getDoc(cardRef);

            if (!cardSnap.exists()) { alert("❌ هذا الكرت غير موجود"); return; }
            const data = cardSnap.data();

            if (data.ownerId && data.ownerId !== currentUser.uid) {
                alert("❌ هذا الكرت مربوط بحساب آخر"); return;
            }
            if (data.ownerId === currentUser.uid) {
                alert("⚠️ هذا الكرت مربوط بحسابك بالفعل"); return;
            }

            await updateDoc(cardRef, {
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                claimedAt: serverTimestamp(),
                type: data.type || null
            });

            alert("✅ تم ربط الكرت بنجاح!");
            cardIdInput.value = "";
            await loadUserCards(currentUser.uid);

            // فتح نافذة التعديل مباشرة لاختيار النوع
            openEditModal(cardId, { ...data, ownerId: currentUser.uid, type: null });

        } catch (error) {
            console.error(error);
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
            const type = CARD_TYPES.find(t => t.id === card.type);

            const cardEl = document.createElement("div");
            cardEl.className = "my-card";

            const badge = type
                ? `<div class="card-type-badge"><i class="fa-solid ${type.icon}"></i> ${type.label}</div>`
                : `<div class="card-type-badge" style="color:#f87171;border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);">
                    <i class="fa-solid fa-exclamation-triangle"></i> لم يتم تحديد النوع
                   </div>`;

            cardEl.innerHTML = `
                ${badge}
                <div>
                    <h3>${card.title || "بدون عنوان"}</h3>
                    <p>رمز الكرت: <strong>${cardId}</strong></p>
                </div>
                <button class="btn-edit-memory" data-id="${cardId}">
                    <i class="fa-solid fa-pen"></i> ${type ? "تعديل الكرت" : "اختر النوع الآن"}
                </button>
            `;

            cardEl.querySelector(".btn-edit-memory").addEventListener("click", () => {
                openEditModal(cardId, card);
            });

            myCardsList.appendChild(cardEl);
        });
    } catch (error) {
        console.error(error);
        myCardsList.innerHTML = "<p style='color:#f87171;'>فشل تحميل الكروت</p>";
    }
}

// ===== عرض أنواع الكروت =====
function renderTypeSelector() {
    typeSelector.innerHTML = "";
    CARD_TYPES.forEach(t => {
        const option = document.createElement("div");
        option.className = "type-option";
        option.dataset.typeId = t.id;
        option.innerHTML = `
            <i class="fa-solid ${t.icon}"></i>
            <span>${t.label}</span>
        `;
        option.addEventListener("click", () => {
            typeSelector.querySelectorAll(".type-option").forEach(el => el.classList.remove("selected"));
            option.classList.add("selected");
            selectedType = t;
            btnConfirmType.disabled = false;
        });
        typeSelector.appendChild(option);
    });
}

// ===== فتح نافذة التعديل =====
function openEditModal(cardId, card) {
    currentCard = { ...card, id: cardId };
    pendingCardId = cardId;

    document.getElementById("editCardId").value = cardId;

    // إعادة تعيين كل شيء
    resetFormState();

    // إذا الكرت له نوع محدد مسبقاً → تخطى خطوة الاختيار
    if (card.type) {
        selectedType = CARD_TYPES.find(t => t.id === card.type);
        showCardFields(card);
    } else {
        // عرض شاشة اختيار النوع
        selectedType = null;
        renderTypeSelector();
        btnConfirmType.disabled = true;
        stepTypeSelect.classList.remove("hidden");
        stepCardFields.classList.add("hidden");
        modalTitle.innerHTML = `<i class="fa-solid fa-list"></i> اختر نوع الكرت`;
    }

    editModal.classList.add("active");
}

// ===== إعادة تعيين الحالة =====
function resetFormState() {
    newImages = [];
    currentImages = [];
    imagesToDelete = [];
    newVideo = null;
    newBgMusicFile = null;

    document.getElementById("editCardTitle").value = "";
    document.getElementById("editCardDate").value = "";
    document.getElementById("editCardMessage").value = "";
    document.getElementById("editImages").value = "";
    document.getElementById("editVideo").value = "";
    document.getElementById("editBgMusic").value = "";
    document.getElementById("editSecurityQuestion").value = "";
    document.getElementById("editSecurityAnswer").value = "";
    document.getElementById("imagesStatus").textContent = "";
    document.getElementById("videoStatus").textContent = "";
    document.getElementById("bgMusicStatus").textContent = "";
    document.getElementById("currentImagesContainer").innerHTML = "";
    document.getElementById("imagesCount").textContent = "0";
}

// ===== تأكيد النوع =====
if (btnConfirmType) {
    btnConfirmType.addEventListener("click", () => {
        if (!selectedType) return;
        showCardFields(currentCard);
    });
}

// ===== تغيير النوع =====
if (btnChangeType) {
    btnChangeType.addEventListener("click", () => {
        if (!confirm("سيتم فقدان التغييرات غير المحفوظة. متابعة؟")) return;
        selectedType = null;
        renderTypeSelector();
        btnConfirmType.disabled = true;
        stepTypeSelect.classList.remove("hidden");
        stepCardFields.classList.add("hidden");
        modalTitle.innerHTML = `<i class="fa-solid fa-list"></i> اختر نوع الكرت`;
    });
}

// ===== عرض الحقول حسب النوع =====
function showCardFields(card) {
    if (!selectedType) return;

    stepTypeSelect.classList.add("hidden");
    stepCardFields.classList.remove("hidden");
    modalTitle.innerHTML = `<i class="fa-solid ${selectedType.icon}"></i> ${selectedType.label}`;

    const f = selectedType.features;

    // إظهار/إخفاء الحقول
    document.getElementById("dateGroup").classList.toggle("hidden", !f.date);
    document.getElementById("messageGroup").classList.toggle("hidden", !f.message);
    document.getElementById("imagesSection").classList.toggle("hidden", !f.images);
    document.getElementById("videoSection").classList.toggle("hidden", !f.video);
    document.getElementById("securitySection").classList.toggle("hidden", !f.security);

    // تعبئة البيانات الموجودة (إن وُجدت)
    document.getElementById("editCardTitle").value = card.title || "";
    document.getElementById("editCardDate").value = card.date || "";
    document.getElementById("editCardMessage").value = card.message || "";
    document.getElementById("editSecurityQuestion").value = card.securityQuestion || "";
    document.getElementById("editSecurityAnswer").value = card.securityAnswer || "";

    // تحميل الصور الحالية
    currentImages = card.images || [];
    imagesToDelete = [];
    renderCurrentImages();

    // حالة الفيديو
    if (card.videoUrl) {
        document.getElementById("videoStatus").textContent = "✅ يوجد فيديو محفوظ (سيتم استبداله إذا رفعت جديداً)";
    }

    // حالة الموسيقى
    if (card.bgMusicUrl) {
        document.getElementById("bgMusicStatus").textContent = "✅ توجد موسيقى محفوظة";
    }
}

// ===== عرض الصور الحالية =====
function renderCurrentImages() {
    const container = document.getElementById("currentImagesContainer");
    document.getElementById("imagesCount").textContent = currentImages.length;

    if (currentImages.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8;font-size:0.85rem;'>لا توجد صور محفوظة.</p>";
        return;
    }

    container.innerHTML = "";
    currentImages.forEach(url => {
        const wrapper = document.createElement("div");
        wrapper.className = "image-thumb";
        wrapper.innerHTML = `
            <img src="${url}">
            <button type="button">×</button>
        `;
        wrapper.querySelector("button").addEventListener("click", () => {
            if (confirm("حذف هذه الصورة؟")) {
                currentImages = currentImages.filter(u => u !== url);
                imagesToDelete.push(url);
                renderCurrentImages();
            }
        });
        container.appendChild(wrapper);
    });
}

// ===== رفع صور جديدة =====
document.getElementById("editImages")?.addEventListener("change", (e) => {
    newImages = Array.from(e.target.files);
    document.getElementById("imagesStatus").textContent =
        newImages.length ? `📎 ${newImages.length} صورة جديدة جاهزة للرفع` : "";
});

// ===== رفع فيديو =====
document.getElementById("editVideo")?.addEventListener("change", (e) => {
    newVideo = e.target.files[0] || null;
    document.getElementById("videoStatus").textContent =
        newVideo ? "📎 فيديو جديد جاهز للرفع" : (currentCard?.videoUrl ? "✅ يوجد فيديو محفوظ" : "");
});

// ===== رفع موسيقى =====
document.getElementById("editBgMusic")?.addEventListener("change", (e) => {
    newBgMusicFile = e.target.files[0] || null;
    document.getElementById("bgMusicStatus").textContent =
        newBgMusicFile ? "📎 موسيقى جديدة جاهزة للرفع" : (currentCard?.bgMusicUrl ? "✅ توجد موسيقى محفوظة" : "");
});

// ===== إغلاق النافذة =====
if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
        editModal.classList.remove("active");
    });
}

// ===== حفظ الكرت =====
if (editCardForm) {
    editCardForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!selectedType) { alert("الرجاء اختيار نوع الكرت أولاً"); return; }

        const cardId = document.getElementById("editCardId").value;
        const btnSave = document.getElementById("btnSaveData");
        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;

        try {
            // 🔒 تحقق أمني
            const cardRef = doc(db, "cards", cardId);
            const cardSnap = await getDoc(cardRef);
            if (!cardSnap.exists() || cardSnap.data().ownerId !== currentUser.uid) {
                throw new Error("غير مصرح لك بتعديل هذا الكرت");
            }

            const f = selectedType.features;
            const updatePayload = {
                type: selectedType.id,
                updatedAt: serverTimestamp()
            };

            // النصوص
            updatePayload.title = document.getElementById("editCardTitle").value.trim();
            if (f.date) updatePayload.date = document.getElementById("editCardDate").value;
            if (f.message) updatePayload.message = document.getElementById("editCardMessage").value.trim();
            if (f.security) {
                updatePayload.securityQuestion = document.getElementById("editSecurityQuestion").value.trim();
                updatePayload.securityAnswer = document.getElementById("editSecurityAnswer").value.trim().toLowerCase();
            }

            // 🎵 الموسيقى
            let bgMusicUrl = cardSnap.data().bgMusicUrl || "";
            if (newBgMusicFile) {
                btnSave.innerHTML = "🎵 جاري رفع الموسيقى...";
                bgMusicUrl = await uploadToCloudinary(newBgMusicFile, "auto", (p) => {
                    btnSave.innerHTML = `🎵 رفع الموسيقى — ${p}%`;
                });
            }
            updatePayload.bgMusicUrl = bgMusicUrl;

            // 📸 الصور
            if (f.images) {
                let finalImages = currentImages.filter(url => !imagesToDelete.includes(url));
                if (newImages.length > 0) {
                    for (let i = 0; i < newImages.length; i++) {
                        btnSave.innerHTML = `📸 ضغط الصورة ${i + 1}/${newImages.length}...`;
                        const compressed = await compressImage(newImages[i]);
                        btnSave.innerHTML = `📤 رفع الصورة ${i + 1}/${newImages.length}...`;
                        const url = await uploadToCloudinary(compressed, "image", (p) => {
                            btnSave.innerHTML = `📤 صورة ${i + 1}/${newImages.length} — ${p}%`;
                        });
                        finalImages.push(url);
                    }
                }
                updatePayload.images = finalImages;
            }

            // 🎬 الفيديو
            if (f.video) {
                let videoUrl = cardSnap.data().videoUrl || "";
                if (newVideo) {
                    btnSave.innerHTML = "🎬 جاري رفع الفيديو...";
                    videoUrl = await uploadToCloudinary(newVideo, "video", (p) => {
                        btnSave.innerHTML = `🎬 رفع الفيديو — ${p}%`;
                    });
                }
                updatePayload.videoUrl = videoUrl;
            }

            // 💾 الحفظ
            btnSave.innerHTML = "💾 جاري الحفظ...";
            await updateDoc(cardRef, updatePayload);

            alert("✅ تم حفظ الكرت بنجاح!");
            editModal.classList.remove("active");
            await loadUserCards(currentUser.uid);

        } catch (error) {
            console.error(error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    });
}
