import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, limit, deleteField 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    generateSalt,
    bytesToBase64Url,
    base64UrlToBytes,
    deriveFinalKey,
    encryptText,
    decryptText,
    encryptFile
} from "./encryption.js";

// ===== Firebase =====
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

function uploadEncryptedToCloudinary(encryptedBlob, onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        
        // ✅ اسم فريد لكل ملف (يمنع الاستبدال في Cloudinary)
        const uniqueFilename = `enc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.enc`;
        formData.append("file", encryptedBlob, uniqueFilename);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", "techluxury/encrypted");
        
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { 
                    const response = JSON.parse(xhr.responseText);
                    console.log("✅ تم رفع الملف:", response.secure_url);
                    console.log("📦 الحجم المرفوع:", response.bytes, "بايت =", (response.bytes / 1024).toFixed(2), "KB");
                    resolve(response.secure_url);
                }
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

function uploadToCloudinary(file, resourceType = "auto", onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        
        // ✅ اسم فريد
        const ext = file.name.split(".").pop() || "bin";
        const uniqueFilename = `${resourceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        formData.append("file", file, uniqueFilename);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", "techluxury/public");
        
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        if (onProgress) {
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
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

// ============================================================
// 🎴 أنواع الكروت (مع خاصية protected)
// ============================================================
const CARD_TYPES = [
    { 
        id: "gift", 
        label: "كرت هدية", 
        icon: "fa-gift", 
        desc: "صور + فيديو + موسيقى + رسالة",
        protected: true 
    },
    { 
        id: "memory_book", 
        label: "كتاب ذكريات", 
        icon: "fa-book-open", 
        desc: "صفحات متعددة لكل مناسبة",
        protected: true 
    },
    { 
        id: "business_card", 
        label: "بطاقة عمل", 
        icon: "fa-id-card", 
        desc: "بياناتك المهنية ووسائل التواصل",
        protected: false 
    },
    { 
        id: "pet_card", 
        label: "بطاقة حيوانات", 
        icon: "fa-paw", 
        desc: "بطاقة لحيوانك الأليف — عامة",
        protected: false 
    }
];

// ===== الحالة العامة =====
let currentUser = null;
let currentCard = null;
let selectedType = null;
let eventsState = [];
let giftNewImages = [];
let giftCurrentImages = [];
let giftImagesToDelete = [];
let giftNewVideo = null;
let bizNewLogo = null;
let bizCurrentLogo = "";
let bizInstagramList = [];
let bizPhoneList = [];
let bizWebsiteList = [];
let newBgMusicFile = null;

// 🐾 بطاقة الحيوانات
let petNewPhoto = null;
let petCurrentPhoto = "";

// 🔐 المفتاح الحالي
let currentEncryptionKey = null;

// ===== دوال مساعدة =====
function show(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = "";
}

function hide(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.style.display = "";
}

function generateId() {
    return "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function toArray(value) {
    if (Array.isArray(value)) return value.filter(v => v && String(v).trim() !== "");
    if (value && typeof value === "string" && value.trim() !== "") return [value];
    return [];
}

// ============================================================
// 🔐 شاشة كلمة المرور
// ============================================================
function showPasswordScreen(cardId, salt, isNewPassword, onSuccess) {
    const modal = document.getElementById("passwordModal");
    const title = document.getElementById("passwordModalTitle");
    const desc = document.getElementById("passwordModalDesc");
    const input = document.getElementById("passwordInput");
    const confirmGroup = document.getElementById("confirmPasswordGroup");
    const confirmInput = document.getElementById("confirmPasswordInput");
    const errorMsg = document.getElementById("passwordError");
    const btn = document.getElementById("btnPasswordConfirm");
    const btnClose = document.getElementById("btnClosePasswordModal");

    input.value = "";
    confirmInput.value = "";
    errorMsg.style.display = "none";
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> تأكيد';

    if (isNewPassword) {
        title.innerHTML = `<i class="fa-solid fa-lock"></i> إنشاء كلمة مرور`;
        desc.textContent = "لحماية رسائل وصور وفيديو كرتك، اختر كلمة مرور قوية. احفظها جيداً.";
        confirmGroup.style.display = "block";
    } else {
        title.innerHTML = `<i class="fa-solid fa-lock"></i> أدخل كلمة المرور`;
        desc.textContent = "أدخل كلمة المرور لفك تشفير محتوى الكرت.";
        confirmGroup.style.display = "none";
    }

    modal.classList.add("active");

    const handleConfirm = async () => {
        const pwd = input.value;
        if (!pwd) {
            errorMsg.textContent = "الرجاء إدخال كلمة المرور";
            errorMsg.style.display = "block";
            return;
        }
        if (pwd.length < 6) {
            errorMsg.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
            errorMsg.style.display = "block";
            return;
        }
        if (isNewPassword && pwd !== confirmInput.value) {
            errorMsg.textContent = "كلمتا المرور غير متطابقتين";
            errorMsg.style.display = "block";
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';

        try {
            const key = await deriveFinalKey(pwd, null, salt);
            currentEncryptionKey = key;
            sessionStorage.setItem(`enc_key_${cardId}`, "cached");

            modal.classList.remove("active");
            onSuccess(key);
        } catch (err) {
            console.error(err);
            errorMsg.textContent = "حدث خطأ، حاول مرة أخرى";
            errorMsg.style.display = "block";
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> تأكيد';
        }
    };

    btn.onclick = handleConfirm;
    btnClose.onclick = () => modal.classList.remove("active");
    input.onkeypress = (e) => { if (e.key === "Enter") handleConfirm(); };
    confirmInput.onkeypress = (e) => { if (e.key === "Enter") handleConfirm(); };
    setTimeout(() => input.focus(), 100);
}

// ============================================================
// 🔐 التحقق من تسجيل الدخول
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user;

    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userNameEl = document.getElementById("userName");
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const displayName = userData.name || user.email.split("@")[0];
            if (userNameEl) userNameEl.textContent = displayName;
        } else {
            if (userNameEl) userNameEl.textContent = user.email.split("@")[0];
        }
    } catch (error) {
        console.error("خطأ:", error);
        const userNameEl = document.getElementById("userName");
        if (userNameEl) userNameEl.textContent = user.email.split("@")[0];
    }

    await loadUserCards(user.uid);
});

// ===== تسجيل الخروج =====
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    sessionStorage.clear();
    await signOut(auth);
    window.location.href = "login.html";
});

// ============================================================
// 🔗 ربط الكرت (بدون طلب كلمة مرور — ستُطلب عند اختيار نوع محمي)
// ============================================================
document.getElementById("btnClaimCard")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    const cardIdInput = document.getElementById("cardIdInput");
    const cardId = cardIdInput.value.trim().toUpperCase();

    if (!cardId) { alert("الرجاء إدخال رمز الكرت"); return; }
    if (!currentUser) { alert("يجب تسجيل الدخول أولاً"); return; }

    btn.disabled = true;
    btn.innerText = "جاري الربط...";

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

        // اربط الكرت
        await updateDoc(cardRef, {
            ownerId: currentUser.uid,
            ownerEmail: currentUser.email,
            claimedAt: serverTimestamp(),
            type: data.type || null,
            updatedAt: serverTimestamp()
        });

        alert("✅ تم ربط الكرت بنجاح!");
        cardIdInput.value = "";
        await loadUserCards(currentUser.uid);
        openEditModal(cardId, { ...data, ownerId: currentUser.uid });
    } catch (error) {
        console.error(error);
        alert("حدث خطأ: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "ربط الكرت";
    }
});

// ============================================================
// 📋 تحميل الكروت
// ============================================================
async function loadUserCards(uid) {
    const myCardsList = document.getElementById("myCardsList");
    if (!myCardsList) return;
    myCardsList.innerHTML = "<p style='color:#94a3b8;'>جاري التحميل...</p>";

    try {
        const q = query(
            collection(db, "cards"), 
            where("ownerId", "==", uid),
            limit(50)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            myCardsList.innerHTML = "<p style='color:#94a3b8;'>لا توجد منتجات مربوطة بحسابك بعد.</p>";
            return;
        }

        myCardsList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const card = docSnap.data();
            const cardId = docSnap.id;
            const type = CARD_TYPES.find(t => t.id === card.type);

            const badge = type
                ? `<div class="card-type-badge"><i class="fa-solid ${type.icon}"></i> ${type.label}</div>`
                : `<div class="card-type-badge" style="color:#f87171;border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);">
                    <i class="fa-solid fa-exclamation-triangle"></i> لم يتم تحديد النوع
                   </div>`;

            const lockIcon = card.salt 
                ? `<i class="fa-solid fa-lock" style="color:#22c55e;font-size:0.85rem;" title="محمي"></i>` 
                : `<i class="fa-solid fa-lock-open" style="color:#f59e0b;font-size:0.85rem;" title="عام"></i>`;

            const cardEl = document.createElement("div");
            cardEl.className = "my-card";
            cardEl.innerHTML = `
                ${badge}
                <div>
                    <h3>${card.title || "بدون عنوان"}</h3>
                    <p>رمز الكرت: <strong>${cardId}</strong> ${lockIcon}</p>
                </div>
                <button class="btn-edit-memory" data-id="${cardId}">
                    <i class="fa-solid fa-pen"></i> ${type ? "تعديل الكرت" : "اختر النوع الآن"}
                </button>
            `;

            cardEl.querySelector(".btn-edit-memory").addEventListener("click", () => {
                requestEditWithPassword(cardId, card);
            });
            myCardsList.appendChild(cardEl);
        });
    } catch (error) {
        console.error(error);
        myCardsList.innerHTML = "<p style='color:#f87171;'>فشل تحميل المنتجات</p>";
    }
}

// ============================================================
// 🔐 طلب كلمة المرور قبل التعديل (فقط إذا الكرت محمي)
// ============================================================
async function requestEditWithPassword(cardId, card) {
    if (!card.salt) {
        // كرت غير مشفر (عام)
        currentEncryptionKey = null;
        openEditModal(cardId, card);
        return;
    }

    if (currentEncryptionKey && sessionStorage.getItem(`enc_key_${cardId}`)) {
        openEditModal(cardId, card);
        return;
    }

    const salt = base64UrlToBytes(card.salt);
    showPasswordScreen(cardId, salt, false, async (key) => {
        openEditModal(cardId, card);
    });
}

// ============================================================
// 🖼️ عرض أنواع الكروت (مع شارات "محمي"/"عام")
// ============================================================
function renderTypeSelector() {
    const typeSelector = document.getElementById("typeSelector");
    if (!typeSelector) return;

    typeSelector.innerHTML = "";

    CARD_TYPES.forEach(t => {
        const option = document.createElement("div");
        option.className = "type-option";
        option.dataset.typeId = t.id;

        const badgeHtml = t.protected
            ? `<div class="type-badge protected">🔒 محمي</div>`
            : `<div class="type-badge public">🌐 عام</div>`;

        option.innerHTML = `
            ${badgeHtml}
            <i class="fa-solid ${t.icon}"></i>
            <span>${t.label}</span>
            <small>${t.desc}</small>
        `;

        option.addEventListener("click", () => {
            document.querySelectorAll(".type-option").forEach(el => el.classList.remove("selected"));
            option.classList.add("selected");
            selectedType = t;
            const btnConfirmType = document.getElementById("btnConfirmType");
            if (btnConfirmType) btnConfirmType.disabled = false;
        });

        typeSelector.appendChild(option);
    });
}

// ============================================================
// 📝 فتح نافذة التعديل
// ============================================================
async function openEditModal(cardId, card) {
    currentCard = { ...card, id: cardId };

    const editCardIdEl = document.getElementById("editCardId");
    const stepTypeSelect = document.getElementById("stepTypeSelect");
    const stepCardFields = document.getElementById("stepCardFields");
    const modalTitle = document.getElementById("modalTitle");
    const editModal = document.getElementById("editModal");

    if (editCardIdEl) editCardIdEl.value = cardId;

    resetFormState();

    const existingType = card.type ? CARD_TYPES.find(t => t.id === card.type) : null;

    if (existingType) {
        selectedType = existingType;
        hide(stepTypeSelect);
        show(stepCardFields);
        await showCardFields(card);
    } else {
        selectedType = null;
        renderTypeSelector();
        const btnConfirmType = document.getElementById("btnConfirmType");
        if (btnConfirmType) btnConfirmType.disabled = true;
        show(stepTypeSelect);
        hide(stepCardFields);
        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fa-solid fa-list"></i> اختر نوع الكرت`;
        }
    }

    editModal.classList.add("active");
}

// ============================================================
// 🔄 إعادة تعيين الحالة
// ============================================================
function resetFormState() {
    giftNewImages = [];
    giftCurrentImages = [];
    giftImagesToDelete = [];
    giftNewVideo = null;
    bizNewLogo = null;
    bizCurrentLogo = "";
    bizInstagramList = [];
    bizPhoneList = [];
    bizWebsiteList = [];
    newBgMusicFile = null;
    petNewPhoto = null;
    petCurrentPhoto = "";
    eventsState = [];

    const ids = [
        "giftTitle", "giftMessage", "bookTitle", "bizName", "bizJobTitle",
        "bizCompany", "bizBio", "bizServices", "bizEmail",
        "bizAddress", "bizFacebook", "bizLinkedin",
        "petName", "petType", "petBreed", "petAge", "petWeight",
        "petColor", "petNotes", "petVaccinations",
        "petOwnerName", "petOwnerPhone", "petAddress"
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const fileIds = ["giftImages", "giftVideo", "bizLogo", "editBgMusic", "petPhoto"];
    fileIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const statusIds = ["giftImagesStatus", "giftVideoStatus", "bizLogoStatus", "bgMusicStatus", "petPhotoStatus"];
    statusIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    });

    const giftCurrentImagesEl = document.getElementById("giftCurrentImages");
    if (giftCurrentImagesEl) giftCurrentImagesEl.innerHTML = "";

    const giftImagesCountEl = document.getElementById("giftImagesCount");
    if (giftImagesCountEl) giftImagesCountEl.textContent = "0";

    const bizLogoContainerEl = document.getElementById("bizLogoContainer");
    if (bizLogoContainerEl) bizLogoContainerEl.innerHTML = "";

    const petPhotoContainerEl = document.getElementById("petPhotoContainer");
    if (petPhotoContainerEl) petPhotoContainerEl.innerHTML = "";

    const eventsListEl = document.getElementById("eventsList");
    if (eventsListEl) eventsListEl.innerHTML = "";

    const instagramListEl = document.getElementById("instagramList");
    if (instagramListEl) instagramListEl.innerHTML = "";

    const phoneListEl = document.getElementById("phoneList");
    if (phoneListEl) phoneListEl.innerHTML = "";

    const websiteListEl = document.getElementById("websiteList");
    if (websiteListEl) websiteListEl.innerHTML = "";
}

// ============================================================
// ✅ تأكيد النوع (مع طلب كلمة مرور إذا محمي)
// ============================================================
document.getElementById("btnConfirmType")?.addEventListener("click", async () => {
    if (!selectedType) {
        alert("يرجى اختيار نوع الكرت أولاً");
        return;
    }

    // إذا النوع محمي → اطلب كلمة مرور جديدة
    if (selectedType.protected && !currentEncryptionKey) {
        const cardId = document.getElementById("editCardId").value;
        const cardRef = doc(db, "cards", cardId);
        const cardSnap = await getDoc(cardRef);
        const cardData = cardSnap.data();

        // إذا لم يوجد salt بعد → ولّد واحداً
        if (!cardData.salt) {
            const newSalt = generateSalt();
            const saltB64 = bytesToBase64Url(newSalt);

            showPasswordScreen(cardId, newSalt, true, async (key) => {
                // خزّن salt في Firestore
                await updateDoc(cardRef, {
                    salt: saltB64,
                    encryptionVersion: 1,
                    updatedAt: serverTimestamp()
                });
                currentCard.salt = saltB64;
                await showCardFields(currentCard);
            });
            return;
        } else {
            // الكرت له salt بالفعل → اطلب كلمة المرور
            const salt = base64UrlToBytes(cardData.salt);
            showPasswordScreen(cardId, salt, false, async (key) => {
                await showCardFields(currentCard);
            });
            return;
        }
    }

    // نوع عام → تابع مباشرة
    await showCardFields(currentCard || {});
});

// ============================================================
// 📋 عرض الحقول حسب النوع (مع فك التشفير عند اللزوم)
// ============================================================
async function showCardFields(card) {
    if (!selectedType) return;

    hide(document.getElementById("stepTypeSelect"));
    show(document.getElementById("stepCardFields"));

    const modalTitle = document.getElementById("modalTitle");
    if (modalTitle) modalTitle.innerHTML = `<i class="fa-solid ${selectedType.icon}"></i> ${selectedType.label}`;

    hide(document.getElementById("giftFields"));
    hide(document.getElementById("bookFields"));
    hide(document.getElementById("businessFields"));
    hide(document.getElementById("petFields"));

    // ========== كرت هدية ==========
    if (selectedType.id === "gift") {
        show(document.getElementById("giftFields"));
        document.getElementById("giftTitle").value = card.title || "";

        if (card.message && typeof card.message === "object" && card.message.ciphertext) {
            try {
                if (currentEncryptionKey) {
                    const decrypted = await decryptText(card.message.ciphertext, card.message.iv, currentEncryptionKey);
                    document.getElementById("giftMessage").value = decrypted;
                } else {
                    document.getElementById("giftMessage").value = "";
                    document.getElementById("giftMessage").placeholder = "🔒 الرسالة مشفرة";
                }
            } catch (e) {
                document.getElementById("giftMessage").value = "";
                document.getElementById("giftMessage").placeholder = "⚠️ كلمة المرور خاطئة";
            }
        } else {
            document.getElementById("giftMessage").value = card.message || "";
        }

        giftCurrentImages = card.images || [];
        giftImagesToDelete = [];
        renderGiftImages();

        if (card.video) {
            document.getElementById("giftVideoStatus").textContent = "✅ يوجد فيديو محفوظ";
        }
    }

    // ========== كتاب ذكريات ==========
    if (selectedType.id === "memory_book") {
        show(document.getElementById("bookFields"));
        document.getElementById("bookTitle").value = card.title || "";

        eventsState = JSON.parse(JSON.stringify(card.events || []));

        if (currentEncryptionKey) {
            for (let i = 0; i < eventsState.length; i++) {
                const evt = eventsState[i];
                if (evt.message && typeof evt.message === "object" && evt.message.ciphertext) {
                    try {
                        const decrypted = await decryptText(evt.message.ciphertext, evt.message.iv, currentEncryptionKey);
                        eventsState[i].message = decrypted;
                    } catch (e) {
                        eventsState[i].message = "";
                    }
                }
            }
        } else {
            for (let i = 0; i < eventsState.length; i++) {
                if (eventsState[i].message && typeof eventsState[i].message === "object") {
                    eventsState[i].message = "";
                }
            }
        }

        if (eventsState.length === 0) eventsState.push(createEmptyEvent());
        renderEvents();
    }

    // ========== بطاقة عمل ==========
    if (selectedType.id === "business_card") {
        show(document.getElementById("businessFields"));
        document.getElementById("bizName").value = card.name || "";
        document.getElementById("bizJobTitle").value = card.jobTitle || "";
        document.getElementById("bizCompany").value = card.company || "";
        document.getElementById("bizBio").value = card.bio || "";
        document.getElementById("bizServices").value = card.services || "";
        document.getElementById("bizEmail").value = card.email || "";
        document.getElementById("bizAddress").value = card.address || "";
        document.getElementById("bizFacebook").value = card.facebook || "";
        document.getElementById("bizLinkedin").value = card.linkedin || "";

        bizInstagramList = toArray(card.instagram);
        renderInstagramList();
        bizPhoneList = toArray(card.phone);
        renderPhoneList();
        bizWebsiteList = toArray(card.website);
        renderWebsiteList();

        bizCurrentLogo = card.logoUrl || "";
        renderBizLogo();
    }

    // ========== بطاقة حيوانات 🐾 ==========
    if (selectedType.id === "pet_card") {
        show(document.getElementById("petFields"));
        document.getElementById("petName").value = card.petName || "";
        document.getElementById("petType").value = card.petType || "";
        document.getElementById("petBreed").value = card.petBreed || "";
        document.getElementById("petAge").value = card.petAge || "";
        document.getElementById("petWeight").value = card.petWeight || "";
        document.getElementById("petColor").value = card.petColor || "";
        document.getElementById("petNotes").value = card.petNotes || "";
        document.getElementById("petVaccinations").value = card.petVaccinations || "";
        document.getElementById("petOwnerName").value = card.petOwnerName || "";
        document.getElementById("petOwnerPhone").value = card.petOwnerPhone || "";
        document.getElementById("petAddress").value = card.petAddress || "";

        petCurrentPhoto = card.petPhoto || "";
        renderPetPhoto();
    }

    if (card.bgMusicUrl) {
        document.getElementById("bgMusicStatus").textContent = "✅ توجد موسيقى محفوظة";
    }
}

// ===== قوائم ديناميكية =====
function renderInstagramList() {
    renderSocialList("instagramList", bizInstagramList, "@username", "fa-brands fa-instagram", "#e1306c");
}

function renderPhoneList() {
    renderSocialList("phoneList", bizPhoneList, "+962 7XXXXXXXX", "fa-solid fa-phone", "#22c55e");
}

function renderWebsiteList() {
    renderSocialList("websiteList", bizWebsiteList, "https://example.com", "fa-solid fa-globe", "#3b82f6");
}

function renderSocialList(containerId, list, placeholder, iconClass, iconColor) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) list.push("");

    container.innerHTML = "";
    list.forEach((value, index) => {
        const item = document.createElement("div");
        item.className = "social-item";
        item.innerHTML = `
            <i class="${iconClass}" style="color:${iconColor};font-size:1.2rem;"></i>
            <input type="text" placeholder="${placeholder}" value="${value || ""}" data-index="${index}">
            <button type="button" class="btn-remove-social" data-index="${index}">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        item.querySelector("input").addEventListener("input", (e) => {
            list[index] = e.target.value;
        });

        item.querySelector(".btn-remove-social").addEventListener("click", () => {
            if (list.length === 1) {
                list[0] = "";
                renderSocialList(containerId, list, placeholder, iconClass, iconColor);
                return;
            }
            list.splice(index, 1);
            renderSocialList(containerId, list, placeholder, iconClass, iconColor);
        });

        container.appendChild(item);
    });
}

// ===== أحداث الإضافة =====
document.getElementById("btnAddInstagram")?.addEventListener("click", () => {
    bizInstagramList.push("");
    renderInstagramList();
    focusLastInput("instagramList");
});

document.getElementById("btnAddPhone")?.addEventListener("click", () => {
    bizPhoneList.push("");
    renderPhoneList();
    focusLastInput("phoneList");
});

document.getElementById("btnAddWebsite")?.addEventListener("click", () => {
    bizWebsiteList.push("");
    renderWebsiteList();
    focusLastInput("websiteList");
});

function focusLastInput(containerId) {
    const inputs = document.querySelectorAll(`#${containerId} input`);
    if (inputs.length) inputs[inputs.length - 1].focus();
}

// ===== عرض صور كرت الهدية (كأيقونة قفل) =====
function renderGiftImages() {
    const container = document.getElementById("giftCurrentImages");
    const countEl = document.getElementById("giftImagesCount");
    if (countEl) countEl.textContent = giftCurrentImages.length;
    if (!container) return;

    if (giftCurrentImages.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8;font-size:0.85rem;'>لا توجد صور محفوظة.</p>";
        return;
    }

    container.innerHTML = "";
    giftCurrentImages.forEach((url, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "image-locked";
        wrapper.innerHTML = `<i class="fa-solid fa-image"></i>`;
        wrapper.title = `صورة ${index + 1} (مشفرة) — اضغط لحذفها`;
        wrapper.style.cursor = "pointer";
        wrapper.addEventListener("click", () => {
            if (confirm(`حذف الصورة ${index + 1}؟`)) {
                giftCurrentImages = giftCurrentImages.filter(u => u !== url);
                giftImagesToDelete.push(url);
                renderGiftImages();
            }
        });
        container.appendChild(wrapper);
    });
}

// ===== عرض شعار بطاقة العمل =====
function renderBizLogo() {
    const container = document.getElementById("bizLogoContainer");
    if (!container) return;

    if (!bizCurrentLogo) {
        container.innerHTML = "<p style='color:#94a3b8;font-size:0.85rem;'>لا يوجد شعار محفوظ.</p>";
        return;
    }
    container.innerHTML = `
        <div class="image-thumb">
            <img src="${bizCurrentLogo}" style="width:100px;height:100px;">
            <button type="button" id="removeBizLogo">×</button>
        </div>
    `;
    document.getElementById("removeBizLogo").addEventListener("click", () => {
        if (confirm("حذف الشعار الحالي؟")) {
            bizCurrentLogo = "";
            renderBizLogo();
        }
    });
}

// ===== 🐾 عرض صورة الحيوان =====
function renderPetPhoto() {
    const container = document.getElementById("petPhotoContainer");
    if (!container) return;

    if (!petCurrentPhoto) {
        container.innerHTML = "<p style='color:#94a3b8;font-size:0.85rem;'>لا توجد صورة محفوظة.</p>";
        return;
    }
    container.innerHTML = `
        <div class="image-thumb">
            <img src="${petCurrentPhoto}" style="width:100px;height:100px;">
            <button type="button" id="removePetPhoto">×</button>
        </div>
    `;
    document.getElementById("removePetPhoto").addEventListener("click", () => {
        if (confirm("حذف صورة الحيوان؟")) {
            petCurrentPhoto = "";
            renderPetPhoto();
        }
    });
}

// ===== إنشاء صفحة فارغة =====
function createEmptyEvent() {
    return {
        id: generateId(),
        emoji: "📌",
        title: "",
        date: "",
        message: "",
        images: [],
        video: "",
        _newImages: [],
        _newVideo: null
    };
}

// ===== خيارات الإيموجي =====
const EMOJI_OPTIONS = ["❤️", "🎂", "✈️", "🎓", "💍", "🌟", "🎉", "📸", "🎁", "🏖️", "🎊", "🌸", "👶", "🏆", "☕", "🎵"];

// ===== عرض صفحات كتاب الذكريات =====
function renderEvents() {
    const eventsListEl = document.getElementById("eventsList");
    if (!eventsListEl) return;
    eventsListEl.innerHTML = "";

    eventsState.forEach((evt, index) => {
        const el = document.createElement("div");
        el.className = "event-card";

        el.innerHTML = `
            <div class="event-card-header">
                <h4>
                    <span class="event-number">صفحة ${index + 1}</span>
                    ${evt.emoji || "📌"} ${evt.title || "بدون عنوان"}
                </h4>
                <button type="button" class="btn-remove-event" data-index="${index}">
                    <i class="fa-solid fa-trash"></i> حذف
                </button>
            </div>

            <div class="form-group">
                <label>اختر إيموجي للصفحة</label>
                <div class="emoji-picker" data-index="${index}">
                    ${EMOJI_OPTIONS.map(e =>
                        `<button type="button" data-emoji="${e}" class="${e === evt.emoji ? "selected" : ""}">${e}</button>`
                    ).join("")}
                </div>
            </div>

            <div class="form-group">
                <label>عنوان الصفحة</label>
                <input type="text" class="evt-title" data-field="title" value="${evt.title || ""}" placeholder="مثال: أول لقاء">
            </div>

            <div class="form-group">
                <label>التاريخ (اختياري)</label>
                <input type="date" class="evt-date" data-field="date" value="${evt.date || ""}">
            </div>

            <div class="form-group">
                <label>الرسالة / الذكرى 🔐</label>
                <textarea class="evt-message" data-field="message" rows="3" placeholder="اكتب ما حدث...">${evt.message || ""}</textarea>
            </div>

            <div class="form-group">
                <label>📸 الصور المحفوظة (${(evt.images || []).length})</label>
                <div class="current-images-container" data-ev-images="${index}"></div>
            </div>

            <div class="form-group">
                <label>📤 إضافة صور جديدة</label>
                <input type="file" class="evt-images" accept="image/*" multiple data-index="${index}">
                <span class="file-status evt-images-status" data-index="${index}"></span>
            </div>

            <div class="form-group">
                <label>🎬 ${evt.video ? "استبدال الفيديو الحالي" : "فيديو الصفحة (اختياري)"}</label>
                <input type="file" class="evt-video" accept="video/*" data-index="${index}">
                <span class="file-status evt-video-status" data-index="${index}">
                    ${evt.video ? "✅ يوجد فيديو محفوظ" : ""}
                </span>
            </div>
        `;

        eventsListEl.appendChild(el);

        el.querySelectorAll(".emoji-picker button").forEach(btn => {
            btn.addEventListener("click", () => {
                eventsState[index].emoji = btn.dataset.emoji;
                el.querySelectorAll(".emoji-picker button").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                updateEventHeader(el, index);
            });
        });

        el.querySelectorAll("[data-field]").forEach(input => {
            input.addEventListener("input", (e) => {
                eventsState[index][e.target.dataset.field] = e.target.value;
                if (e.target.dataset.field === "title") updateEventHeader(el, index);
            });
        });

        el.querySelector(".btn-remove-event").addEventListener("click", () => {
            if (eventsState.length === 1) {
                alert("يجب أن يحتوي الكتاب على صفحة واحدة على الأقل");
                return;
            }
            if (confirm("حذف هذه الصفحة؟")) {
                eventsState.splice(index, 1);
                renderEvents();
            }
        });

        renderEventImages(index);

        el.querySelector(".evt-images").addEventListener("change", (e) => {
            eventsState[index]._newImages = Array.from(e.target.files);
            const status = el.querySelector(`.evt-images-status[data-index="${index}"]`);
            if (status) status.textContent = `📎 ${e.target.files.length} صورة جديدة جاهزة`;
        });

        el.querySelector(".evt-video").addEventListener("change", (e) => {
            eventsState[index]._newVideo = e.target.files[0] || null;
            const status = el.querySelector(`.evt-video-status[data-index="${index}"]`);
            if (status) status.textContent = e.target.files[0]
                ? "📎 فيديو جديد جاهز"
                : (eventsState[index].video ? "✅ يوجد فيديو محفوظ" : "");
        });
    });
}

function updateEventHeader(el, index) {
    const evt = eventsState[index];
    el.querySelector("h4").innerHTML = `
        <span class="event-number">صفحة ${index + 1}</span>
        ${evt.emoji || "📌"} ${evt.title || "بدون عنوان"}
    `;
}

function renderEventImages(index) {
    const container = document.querySelector(`[data-ev-images="${index}"]`);
    if (!container) return;
    const evt = eventsState[index];
    const images = evt.images || [];

    if (images.length === 0) {
        container.innerHTML = "<p style='color:#94a3b8;font-size:0.8rem;'>لا توجد صور محفوظة.</p>";
        return;
    }

    container.innerHTML = "";
    images.forEach((url, idx) => {
        const wrapper = document.createElement("div");
        wrapper.className = "image-locked";
        wrapper.innerHTML = `<i class="fa-solid fa-image"></i>`;
        wrapper.title = `صورة ${idx + 1} (مشفرة) — اضغط لحذفها`;
        wrapper.style.cursor = "pointer";
        wrapper.addEventListener("click", () => {
            if (confirm(`حذف الصورة ${idx + 1}؟`)) {
                evt.images = evt.images.filter(u => u !== url);
                renderEventImages(index);
            }
        });
        container.appendChild(wrapper);
    });
}

// ===== إضافة صفحة =====
document.getElementById("btnAddEvent")?.addEventListener("click", () => {
    eventsState.push(createEmptyEvent());
    renderEvents();
    const modalCard = document.querySelector(".modal-card");
    if (modalCard) setTimeout(() => modalCard.scrollTop = modalCard.scrollHeight, 100);
});

// ===== رفع الملفات =====
document.getElementById("giftImages")?.addEventListener("change", (e) => {
    giftNewImages = Array.from(e.target.files);
    document.getElementById("giftImagesStatus").textContent =
        giftNewImages.length ? `📎 ${giftNewImages.length} صورة جاهزة` : "";
});

document.getElementById("giftVideo")?.addEventListener("change", (e) => {
    giftNewVideo = e.target.files[0] || null;
    document.getElementById("giftVideoStatus").textContent =
        giftNewVideo ? "📎 فيديو جديد جاهز" : "";
});

document.getElementById("bizLogo")?.addEventListener("change", (e) => {
    bizNewLogo = e.target.files[0] || null;
    document.getElementById("bizLogoStatus").textContent =
        bizNewLogo ? "📎 شعار جديد جاهز" : "";
});

document.getElementById("petPhoto")?.addEventListener("change", (e) => {
    petNewPhoto = e.target.files[0] || null;
    document.getElementById("petPhotoStatus").textContent =
        petNewPhoto ? "📎 صورة جديدة جاهزة" : "";
});

document.getElementById("editBgMusic")?.addEventListener("change", (e) => {
    newBgMusicFile = e.target.files[0] || null;
    document.getElementById("bgMusicStatus").textContent =
        newBgMusicFile ? "📎 موسيقى جديدة جاهزة" : "";
});

// ===== إغلاق النافذة =====
document.getElementById("btnCloseModal")?.addEventListener("click", () => {
    document.getElementById("editModal").classList.remove("active");
});

// ============================================================
// 💾 حفظ الكرت
// ============================================================
document.getElementById("editCardForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedType) { alert("الرجاء اختيار نوع الكرت أولاً"); return; }

    const cardId = document.getElementById("editCardId").value;
    const btnSave = document.getElementById("btnSaveData");
    const originalText = btnSave.innerHTML;
    btnSave.disabled = true;

    try {
        const cardRef = doc(db, "cards", cardId);
        const cardSnap = await getDoc(cardRef);
        if (!cardSnap.exists() || cardSnap.data().ownerId !== currentUser.uid) {
            throw new Error("غير مصرح لك بتعديل هذا الكرت");
        }

        const oldData = cardSnap.data();

        // ⚠️ إذا الكرت محمي → تأكد من وجود المفتاح
        if (oldData.salt && !currentEncryptionKey) {
            throw new Error("يجب إدخال كلمة المرور أولاً");
        }

        const updatePayload = {
            type: selectedType.id,
            protected: selectedType.protected === true,
            updatedAt: serverTimestamp()
        };

        // ===== الموسيقى (غير مشفرة) =====
        let bgMusicUrl = oldData.bgMusicUrl || "";
        if (newBgMusicFile) {
            btnSave.innerHTML = "🎵 جاري رفع الموسيقى...";
            bgMusicUrl = await uploadToCloudinary(newBgMusicFile, "auto", (p) => {
                btnSave.innerHTML = `🎵 رفع الموسيقى — ${p}%`;
            });
        }
        updatePayload.bgMusicUrl = bgMusicUrl;

        // ============================================================
        // 🎁 كرت هدية (محمي)
        // ==========================================
        if (selectedType.id === "gift") {
            updatePayload.title = document.getElementById("giftTitle").value.trim();

            const messageText = document.getElementById("giftMessage").value.trim();
            if (messageText) {
                btnSave.innerHTML = "🔐 جاري تشفير الرسالة...";
                updatePayload.message = await encryptText(messageText, currentEncryptionKey);
            } else {
                updatePayload.message = "";
            }

            let finalImages = giftCurrentImages.filter(url => !giftImagesToDelete.includes(url));
            if (giftNewImages.length > 0) {
                for (let i = 0; i < giftNewImages.length; i++) {
                    btnSave.innerHTML = `📸 ضغط الصورة ${i + 1}/${giftNewImages.length}...`;
                    const compressed = await compressImage(giftNewImages[i]);

                    btnSave.innerHTML = `🔐 تشفير الصورة ${i + 1}/${giftNewImages.length}...`;
                    const { encryptedBlob, iv } = await encryptFile(compressed, currentEncryptionKey);

                    btnSave.innerHTML = `📤 رفع الصورة ${i + 1}/${giftNewImages.length}...`;
                    const url = await uploadEncryptedToCloudinary(encryptedBlob, (p) => {
                        btnSave.innerHTML = `📤 صورة ${i + 1}/${giftNewImages.length} — ${p}%`;
                    });

                    finalImages.push({
                        url: url,
                        iv: bytesToBase64Url(iv),
                        encrypted: true,
                        mimeType: "image/jpeg"
                    });
                }
            }
            updatePayload.images = finalImages;

                    // 🔐 تشفير الفيديو
            // ملاحظة: نُخزّن دائماً في حقل "video" (وليس videoUrl)
            // ونحذف videoUrl القديم لتفادي الالتباس
            let videoData = oldData.video || "";
            if (giftNewVideo) {
                btnSave.innerHTML = "🔐 جاري تشفير الفيديو...";
                const { encryptedBlob, iv } = await encryptFile(giftNewVideo, currentEncryptionKey);

                btnSave.innerHTML = "📤 جاري رفع الفيديو...";
                const url = await uploadEncryptedToCloudinary(encryptedBlob, (p) => {
                    btnSave.innerHTML = `🎬 رفع الفيديو — ${p}%`;
                });

                videoData = {
                    url: url,
                    iv: bytesToBase64Url(iv),
                    encrypted: true,
                    mimeType: "video/mp4"
                };
            }
            updatePayload.video = videoData;
            updatePayload.videoUrl = "";  // ✅ نحذف الحقل القديم

        // ============================================================
        // 📖 كتاب ذكريات (محمي)
        // ============================================================
        if (selectedType.id === "memory_book") {
            updatePayload.title = document.getElementById("bookTitle").value.trim();

            const finalEvents = [];
            for (let i = 0; i < eventsState.length; i++) {
                const evt = eventsState[i];
                btnSave.innerHTML = `⏳ معالجة الصفحة ${i + 1}/${eventsState.length}...`;

                const processedEvent = {
                    id: evt.id,
                    emoji: evt.emoji || "📌",
                    title: evt.title || "",
                    date: evt.date || "",
                    images: [...(evt.images || [])],
                    video: evt.video || ""
                };

                if (evt.message && typeof evt.message === "string" && evt.message.trim()) {
                    btnSave.innerHTML = `🔐 صفحة ${i + 1}: تشفير الرسالة...`;
                    processedEvent.message = await encryptText(evt.message.trim(), currentEncryptionKey);
                } else if (evt.message && typeof evt.message === "object") {
                    processedEvent.message = evt.message;
                } else {
                    processedEvent.message = "";
                }

                if (evt._newImages && evt._newImages.length > 0) {
                    for (let j = 0; j < evt._newImages.length; j++) {
                        btnSave.innerHTML = `📸 صفحة ${i + 1}: ضغط الصورة ${j + 1}...`;
                        const compressed = await compressImage(evt._newImages[j]);

                        btnSave.innerHTML = `🔐 صفحة ${i + 1}: تشفير الصورة ${j + 1}...`;
                        const { encryptedBlob, iv } = await encryptFile(compressed, currentEncryptionKey);

                        btnSave.innerHTML = `📤 صفحة ${i + 1}: رفع الصورة ${j + 1}...`;
                        const url = await uploadEncryptedToCloudinary(encryptedBlob, (p) => {
                            btnSave.innerHTML = `📤 صفحة ${i + 1} - صورة ${j + 1} — ${p}%`;
                        });

                        processedEvent.images.push({
                            url: url,
                            iv: bytesToBase64Url(iv),
                            encrypted: true,
                            mimeType: "image/jpeg"
                        });
                    }
                }

                if (evt._newVideo) {
                    btnSave.innerHTML = `🔐 صفحة ${i + 1}: تشفير الفيديو...`;
                    const { encryptedBlob, iv } = await encryptFile(evt._newVideo, currentEncryptionKey);

                    btnSave.innerHTML = `📤 صفحة ${i + 1}: رفع الفيديو...`;
                    const url = await uploadEncryptedToCloudinary(encryptedBlob, (p) => {
                        btnSave.innerHTML = `📤 صفحة ${i + 1} - فيديو — ${p}%`;
                    });

                    processedEvent.video = {
                        url: url,
                        iv: bytesToBase64Url(iv),
                        encrypted: true,
                        mimeType: "video/mp4"
                    };
                }

                finalEvents.push(processedEvent);
            }
            updatePayload.events = finalEvents;
        }

        // ============================================================
        // 💼 بطاقة عمل (عامة — بدون تشفير)
        // ============================================================
        if (selectedType.id === "business_card") {
            updatePayload.name = document.getElementById("bizName").value.trim();
            updatePayload.jobTitle = document.getElementById("bizJobTitle").value.trim();
            updatePayload.company = document.getElementById("bizCompany").value.trim();
            updatePayload.bio = document.getElementById("bizBio").value.trim();
            updatePayload.services = document.getElementById("bizServices").value.trim();
            updatePayload.email = document.getElementById("bizEmail").value.trim();
            updatePayload.address = document.getElementById("bizAddress").value.trim();
            updatePayload.facebook = document.getElementById("bizFacebook").value.trim();
            updatePayload.linkedin = document.getElementById("bizLinkedin").value.trim();

            updatePayload.instagram = bizInstagramList.map(v => v.trim()).filter(v => v !== "");
            updatePayload.phone = bizPhoneList.map(v => v.trim()).filter(v => v !== "");
            updatePayload.website = bizWebsiteList.map(v => v.trim()).filter(v => v !== "");

            updatePayload.title = updatePayload.name || updatePayload.company || "بطاقة عمل";

            // ✅ الشعار غير مشفر (بطاقة عمل عامة)
            let logoUrl = oldData.logoUrl || "";
            if (bizNewLogo) {
                btnSave.innerHTML = "📤 رفع الشعار...";
                const compressed = await compressImage(bizNewLogo);
                logoUrl = await uploadToCloudinary(compressed, "image", (p) => {
                    btnSave.innerHTML = `🖼️ رفع الشعار — ${p}%`;
                });
            }
            updatePayload.logoUrl = logoUrl;
            updatePayload.logo = "";
        }

        // ============================================================
        // 🐾 بطاقة حيوانات (عامة — بدون تشفير)
        // ============================================================
        if (selectedType.id === "pet_card") {
            updatePayload.petName = document.getElementById("petName").value.trim();
            updatePayload.petType = document.getElementById("petType").value;
            updatePayload.petBreed = document.getElementById("petBreed").value.trim();
            updatePayload.petAge = document.getElementById("petAge").value.trim();
            updatePayload.petWeight = document.getElementById("petWeight").value.trim();
            updatePayload.petColor = document.getElementById("petColor").value.trim();
            updatePayload.petNotes = document.getElementById("petNotes").value.trim();
            updatePayload.petVaccinations = document.getElementById("petVaccinations").value;
            updatePayload.petOwnerName = document.getElementById("petOwnerName").value.trim();
            updatePayload.petOwnerPhone = document.getElementById("petOwnerPhone").value.trim();
            updatePayload.petAddress = document.getElementById("petAddress").value.trim();

            updatePayload.title = updatePayload.petName || "بطاقة حيوان";

            // ✅ صورة الحيوان غير مشفرة
            let petPhotoUrl = petCurrentPhoto;
            if (petNewPhoto) {
                btnSave.innerHTML = "📤 رفع صورة الحيوان...";
                const compressed = await compressImage(petNewPhoto);
                petPhotoUrl = await uploadToCloudinary(compressed, "image", (p) => {
                    btnSave.innerHTML = `🐾 رفع الصورة — ${p}%`;
                });
            }
            updatePayload.petPhoto = petPhotoUrl;
        }

        btnSave.innerHTML = "💾 جاري الحفظ...";
        await updateDoc(cardRef, updatePayload);

        alert("✅ تم حفظ الكرت بنجاح!");
        document.getElementById("editModal").classList.remove("active");
        await loadUserCards(currentUser.uid);

    } catch (error) {
        console.error(error);
        alert("حدث خطأ: " + error.message);
    } finally {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
});

console.log("✅ customer-dashboard.js جاهز (4 أنواع كروت)");
