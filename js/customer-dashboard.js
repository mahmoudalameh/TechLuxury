import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const CLOUDINARY_UPLOAD_PRESET = "memories_secure"; // ← الـ preset الجديد الآمن (أو "ml_default" إن لم تنشئ واحداً بعد)

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

// ===== أنواع الكروت =====
const CARD_TYPES = [
    { id: "gift", label: "كرت هدية", icon: "fa-gift", desc: "صور + فيديو + موسيقى + رسالة" },
    { id: "memory_book", label: "كتاب ذكريات", icon: "fa-book-open", desc: "صفحات متعددة لكل مناسبة" },
    { id: "business_card", label: "بطاقة عمل", icon: "fa-id-card", desc: "بياناتك المهنية ووسائل التواصل" }
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
let newBgMusicFile = null;

// ===== دوال الإظهار والإخفاء =====
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

// ===== توليد معرف =====
function generateId() {
    return "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// ===== التحقق من تسجيل الدخول =====
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user;

    // 📥 جلب اسم المستخدم من Firestore
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
        console.error("خطأ في جلب بيانات المستخدم:", error);
        const userNameEl = document.getElementById("userName");
        if (userNameEl) userNameEl.textContent = user.email.split("@")[0];
    }

    await loadUserCards(user.uid);
});

// ===== تسجيل الخروج =====
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
});

// ===== ربط الكرت =====
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

        await updateDoc(cardRef, {
            ownerId: currentUser.uid,
            ownerEmail: currentUser.email,
            claimedAt: serverTimestamp(),
            type: data.type || null
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

// ===== تحميل الكروت =====
async function loadUserCards(uid) {
    const myCardsList = document.getElementById("myCardsList");
    if (!myCardsList) return;
    myCardsList.innerHTML = "<p style='color:#94a3b8;'>جاري التحميل...</p>";

    try {
        const q = query(collection(db, "cards"), where("ownerId", "==", uid));
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

            const cardEl = document.createElement("div");
            cardEl.className = "my-card";
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
        myCardsList.innerHTML = "<p style='color:#f87171;'>فشل تحميل المنتجات</p>";
    }
}

// ===== عرض أنواع الكروت =====
function renderTypeSelector() {
    const typeSelector = document.getElementById("typeSelector");
    if (!typeSelector) { console.error("❌ typeSelector غير موجود"); return; }

    typeSelector.innerHTML = "";

    CARD_TYPES.forEach(t => {
        const option = document.createElement("div");
        option.className = "type-option";
        option.dataset.typeId = t.id;
        option.innerHTML = `
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
            console.log("✅ تم اختيار النوع:", t.label);
        });

        typeSelector.appendChild(option);
    });

    console.log("✅ تم عرض",
