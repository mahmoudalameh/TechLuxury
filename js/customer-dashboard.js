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
                try {
                    resolve(JSON.parse(xhr.responseText).secure_url);
                } catch { reject(new Error("فشل تحليل الاستجابة")); }
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

// ===== الحالة العامة =====
let currentUser = null;
let currentCard = null;
let eventsState = [];
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
const eventsListEl = document.getElementById("eventsList");
const btnAddEvent = document.getElementById("btnAddEvent");
const editBgMusic = document.getElementById("editBgMusic");
const bgMusicStatus = document.getElementById("bgMusicStatus");

// ===== توليد معرف فريد =====
function generateId() {
    return "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// ===== قائمة أنواع المناسبات =====
const OCCASIONS = [
    "عيد ميلاد", "ذكرى زواج", "تخرج", "خطوبة", "زواج",
    "عيد الأم", "عيد الأب", "رمضان", "عيد الفطر", "عيد الأضحى",
    "السنة الجديدة", "نجاح", "مولود جديد", "أخرى"
];

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

            if (!cardSnap.exists()) {
                alert("❌ هذا الكرت غير موجود، تأكد من الرمز");
                return;
            }

            const data = cardSnap.data();

            if (data.ownerId && data.ownerId !== currentUser.uid) {
                alert("❌ هذا الكرت مربوط بحساب آخر");
                return;
            }

            if (data.ownerId === currentUser.uid) {
                alert("⚠️ هذا الكرت مربوط بحسابك بالفعل");
                return;
            }

            await updateDoc(cardRef, {
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                claimedAt: serverTimestamp(),
                events: data.events || []
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
            const eventsCount = (card.events || []).length;

            const cardEl = document.createElement("div");
            cardEl.className = "my-card";
            cardEl.innerHTML = `
                <div>
                    <h3>${card.title || "قلادة بدون عنوان"}</h3>
                    <p>رمز الكرت: <strong>${cardId}</strong></p>
                    <p><i class="fa-solid fa-calendar-star"></i> عدد المناسبات: ${eventsCount}</p>
                </div>
                <button class="btn-edit-memory" data-id="${cardId}">
                    <i class="fa-solid fa-pen"></i> إدارة المناسبات
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
    currentCard = { ...card, id: cardId };
    newBgMusicFile = null;

    document.getElementById("editCardId").value = cardId;
    document.getElementById("editCardTitle").value = card.title || "";

    // إعادة تعيين حقل الموسيقى
    if (editBgMusic) editBgMusic.value = "";
    if (bgMusicStatus) bgMusicStatus.textContent = "";

    if (card.bgMusicUrl && bgMusicStatus) {
        bgMusicStatus.textContent = "✅ توجد موسيقى محفوظة (سيتم استبدالها إذا رفعت ملفاً جديداً)";
    }

    // نسخة عميقة من المناسبات
    eventsState = JSON.parse(JSON.stringify(card.events || []));

    if (eventsState.length === 0) {
        eventsState.push(createEmptyEvent());
    }

    renderEvents();
    editModal.classList.add("active");
}

// ===== إنشاء مناسبة فارغة =====
function createEmptyEvent() {
    return {
        id: generateId(),
        occasion: "عيد ميلاد",
        title: "",
        date: "",
        message: "",
        images: [],
        videoUrl: "",
        securityQuestion: "",
        securityAnswer: "",
        _newImages: [],
        _newVideo: null,
        _imagesToDelete: []
    };
}

// ===== عرض المناسبات =====
function renderEvents() {
    if (!eventsListEl) return;
    eventsListEl.innerHTML = "";

    eventsState.forEach((evt, index) => {
        const el = document.createElement("div");
        el.className = "event-card";
        el.dataset.index = index;

        el.innerHTML = `
            <div class="event-card-header">
                <h4>
                    <span class="event-number">${index + 1}</span>
                    ${evt.occasion || "مناسبة"}
                </h4>
                <button type="button" class="btn-remove-event" data-index="${index}">
                    <i class="fa-solid fa-trash"></i> حذف
                </button>
            </div>

            <div class="form-group">
                <label>نوع المناسبة</label>
                <select class="evt-occasion" data-field="occasion">
                    ${OCCASIONS.map(o =>
                        `<option value="${o}" ${o === evt.occasion ? "selected" : ""}>${o}</option>`
                    ).join("")}
                </select>
            </div>

            <div class="form-group">
                <label>عنوان المناسبة</label>
                <input type="text" class="evt-title" data-field="title" value="${evt.title || ""}" placeholder="مثال: عيد ميلادي 2024">
            </div>

            <div class="form-group">
                <label>تاريخ المناسبة</label>
                <input type="date" class="evt-date" data-field="date" value="${evt.date || ""}">
            </div>

            <div class="form-group">
                <label>الرسالة / الذكرى</label>
                <textarea class="evt-message" data-field="message" rows="3" placeholder="اكتب رسالتك هنا...">${evt.message || ""}</textarea>
            </div>

            <div class="form-group">
                <label>📸 الصور المحفوظة (${(evt.images || []).length})</label>
                <div class="current-images-container" data-index="${index}"></div>
            </div>

            <div class="form-group">
                <label>📤 إضافة صور جديدة</label>
                <input type="file" class="evt-images" accept="image/*" multiple data-index="${index}">
                <span class="file-status evt-images-status" data-index="${index}"></span>
            </div>

            <div class="form-group">
                <label>🎬 ${evt.videoUrl ? "استبدال الفيديو الحالي" : "فيديو المناسبة (اختياري)"}</label>
                <input type="file" class="evt-video" accept="video/*" data-index="${index}">
                <span class="file-status evt-video-status" data-index="${index}">
                    ${evt.videoUrl ? "✅ يوجد فيديو محفوظ" : ""}
                </span>
            </div>

            <div class="form-group">
                <label>🔒 سؤال الأمان (اختياري)</label>
                <input type="text" class="evt-sec-question" data-field="securityQuestion" value="${evt.securityQuestion || ""}" placeholder="مثال: ما هو تاريخ زواجنا؟">
            </div>

            <div class="form-group">
                <label>🔑 إجابة سؤال الأمان</label>
                <input type="text" class="evt-sec-answer" data-field="securityAnswer" value="${evt.securityAnswer || ""}" placeholder="الإجابة الصحيحة">
            </div>
        `;

        eventsListEl.appendChild(el);

        // ربط الحقول النصية
        el.querySelectorAll("[data-field]").forEach(input => {
            input.addEventListener("input", (e) => {
                const field = e.target.dataset.field;
                eventsState[index][field] = e.target.value;

                if (field === "occasion") {
                    const h4 = el.querySelector("h4");
                    h4.innerHTML = `<span class="event-number">${index + 1}</span> ${e.target.value}`;
                }
            });
        });

        // زر حذف المناسبة
        el.querySelector(".btn-remove-event").addEventListener("click", () => {
            if (eventsState.length === 1) {
                alert("يجب أن يحتوي الكرت على مناسبة واحدة على الأقل");
                return;
            }
            if (confirm("هل تريد حذف هذه المناسبة؟")) {
                eventsState.splice(index, 1);
                renderEvents();
            }
        });

        // عرض الصور الحالية
        renderCurrentImagesForEvent(index);

        // رفع الصور
        el.querySelector(".evt-images").addEventListener("change", (e) => {
            eventsState[index]._newImages = Array.from(e.target.files);
            const statusEl = document.querySelector(`.evt-images-status[data-index="${index}"]`);
            if (statusEl) {
                statusEl.textContent = `📎 ${e.target.files.length} صورة جديدة جاهزة للرفع`;
            }
        });

        // رفع الفيديو
        el.querySelector(".evt-video").addEventListener("change", (e) => {
            eventsState[index]._newVideo = e.target.files[0] || null;
            const statusEl = document.querySelector(`.evt-video-status[data-index="${index}"]`);
            if (statusEl) {
                statusEl.textContent = e.target.files[0]
                    ? "📎 فيديو جديد جاهز للرفع"
                    : (eventsState[index].videoUrl ? "✅ يوجد فيديو محفوظ" : "");
            }
        });
    });
}

// ===== عرض الصور الحالية لمناسبة =====
function renderCurrentImagesForEvent(index) {
    const container = document.querySelector(`.current-images-container[data-index="${index}"]`);
    if (!container) return;

    const evt = eventsState[index];
    const images = evt.images || [];

    if (images.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8; font-size:0.8rem;'>لا توجد صور محفوظة.</p>";
        return;
    }

    container.innerHTML = "";
    images.forEach((url) => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:relative; display:inline-block; margin:5px;";
        wrapper.innerHTML = `
            <img src="${url}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; border:1px solid #2e374a;">
            <button type="button" style="
                position:absolute; top:-6px; right:-6px;
                background:#ef4444; color:#fff; border:none;
                width:20px; height:20px; border-radius:50%;
                cursor:pointer; font-size:11px; line-height:1;
            ">×</button>
        `;
        wrapper.querySelector("button").addEventListener("click", () => {
            if (confirm("حذف هذه الصورة؟")) {
                evt.images = evt.images.filter(u => u !== url);
                if (!evt._imagesToDelete) evt._imagesToDelete = [];
                evt._imagesToDelete.push(url);
                renderCurrentImagesForEvent(index);
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

// ===== إضافة مناسبة جديدة =====
if (btnAddEvent) {
    btnAddEvent.addEventListener("click", () => {
        eventsState.push(createEmptyEvent());
        renderEvents();
        const modalCard = editModal.querySelector(".modal-card");
        setTimeout(() => {
            modalCard.scrollTop = modalCard.scrollHeight;
        }, 100);
    });
}

// ===== رفع الموسيقى العامة =====
if (editBgMusic) {
    editBgMusic.addEventListener("change", (e) => {
        newBgMusicFile = e.target.files[0] || null;
        if (bgMusicStatus) {
            bgMusicStatus.textContent = newBgMusicFile
                ? "📎 موسيقى جديدة جاهزة للرفع (ستستبدل الحالية)"
                : (currentCard?.bgMusicUrl ? "✅ توجد موسيقى محفوظة" : "");
        }
    });
}

// ===== حفظ كل التغييرات =====
if (editCardForm) {
    editCardForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const cardId = document.getElementById("editCardId").value;
        const cardTitle = document.getElementById("editCardTitle").value.trim();

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

            // 🎵 1. معالجة الموسيقى العامة
            let newBgMusicUrl = cardSnap.data().bgMusicUrl || "";
            if (newBgMusicFile) {
                btnSave.innerHTML = "🎵 جاري رفع موسيقى الخلفية...";
                newBgMusicUrl = await uploadToCloudinary(
                    newBgMusicFile,
                    "auto",
                    (percent) => {
                        btnSave.innerHTML = `🎵 رفع موسيقى الخلفية — ${percent}%`;
                    }
                );
            }

            // ===== 2. معالجة كل مناسبة =====
            const finalEvents = [];

            for (let i = 0; i < eventsState.length; i++) {
                const evt = eventsState[i];
                btnSave.innerHTML = `⏳ معالجة المناسبة ${i + 1}/${eventsState.length}...`;

                const processedEvent = {
                    id: evt.id,
                    occasion: evt.occasion || "مناسبة",
                    title: evt.title || "",
                    date: evt.date || "",
                    message: evt.message || "",
                    securityQuestion: evt.securityQuestion || "",
                    securityAnswer: (evt.securityAnswer || "").toLowerCase(),
                    images: [...(evt.images || [])],
                    videoUrl: evt.videoUrl || ""
                };

                // رفع الصور الجديدة
                if (evt._newImages && evt._newImages.length > 0) {
                    const total = evt._newImages.length;
                    for (let j = 0; j < total; j++) {
                        btnSave.innerHTML = `📸 مناسبة ${i + 1}: ضغط الصورة ${j + 1}/${total}...`;
                        const compressed = await compressImage(evt._newImages[j]);

                        btnSave.innerHTML = `📤 مناسبة ${i + 1}: رفع الصورة ${j + 1}/${total}...`;
                        const url = await uploadToCloudinary(
                            compressed,
                            "image",
                            (percent) => {
                                btnSave.innerHTML = `📤 مناسبة ${i + 1} - صورة ${j + 1}/${total} — ${percent}%`;
                            }
                        );
                        processedEvent.images.push(url);
                    }
                }

                // رفع الفيديو الجديد
                if (evt._newVideo) {
                    btnSave.innerHTML = `🎬 مناسبة ${i + 1}: رفع الفيديو...`;
                    processedEvent.videoUrl = await uploadToCloudinary(
                        evt._newVideo,
                        "video",
                        (percent) => {
                            btnSave.innerHTML = `🎬 مناسبة ${i + 1} - فيديو — ${percent}%`;
                        }
                    );
                }

                finalEvents.push(processedEvent);
            }

            // ===== 3. الحفظ النهائي في Firestore =====
            btnSave.innerHTML = "💾 جاري الحفظ النهائي...";

            const updatePayload = {
                title: cardTitle,
                bgMusicUrl: newBgMusicUrl,
                events: finalEvents,
                updatedAt: serverTimestamp()
            };

            await updateDoc(cardRef, updatePayload);

            alert("✅ تم حفظ جميع التغييرات بنجاح!");
            editModal.classList.remove("active");
            newBgMusicFile = null;
            await loadUserCards(currentUser.uid);

        } catch (error) {
            console.error("خطأ:", error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }
    });
}
