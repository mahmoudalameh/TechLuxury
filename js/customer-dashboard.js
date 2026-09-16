// ====== 1. استيراد Firebase ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ====== 2. إعدادات Firebase (استبدلها ببياناتك) ======
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

// ====== 3. بيانات Cloudinary ======
const CLOUDINARY_CLOUD_NAME = "ypwbnpyd";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

async function uploadToCloudinary(file, resourceType = "auto") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "فشل رفع الملف");
    }
    const data = await response.json();
    return data.secure_url;
}

// ====== 4. عناصر الصفحة ======
const userEmailEl = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");
const btnClaimCard = document.getElementById("btnClaimCard");
const cardIdInput = document.getElementById("cardIdInput");
const myCardsList = document.getElementById("myCardsList");
const editModal = document.getElementById("editModal");
const editCardForm = document.getElementById("editCardForm");
const btnCloseModal = document.getElementById("btnCloseModal");

let currentUser = null;

// ====== 5. مراقبة حالة تسجيل الدخول ======
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    if (userEmailEl) userEmailEl.textContent = user.email;
    await loadUserCards(user.uid);
});

// ====== 6. تسجيل الخروج ======
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });
}

// ====== 7. ⭐ زر ربط الكرت (المشكلة الأساسية) ======
if (btnClaimCard) {
    btnClaimCard.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("تم الضغط على زر ربط الكرت"); // للتشخيص

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

            // تحقق إذا الكرت مربوط بمستخدم آخر
            if (cardData.ownerId && cardData.ownerId !== currentUser.uid) {
                alert("❌ هذا الكرت مربوط بحساب آخر");
                return;
            }

            if (cardData.ownerId === currentUser.uid) {
                alert("⚠️ هذا الكرت مربوط بحسابك بالفعل");
                return;
            }

            // ربط الكرت بالمستخدم الحالي
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

// ====== 8. تحميل كروت المستخدم ======
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

// ====== 9. فتح نافذة التعديل ======
function openEditModal(cardId, card) {
    document.getElementById("editCardId").value = cardId;
    document.getElementById("editTitle").value = card.title || "";
    document.getElementById("editMessage").value = card.message || "";
    document.getElementById("editSecurityQuestion").value = card.securityQuestion || "";
    document.getElementById("editSecurityAnswer").value = card.securityAnswer || "";
    editModal.classList.add("active");
}

// ====== 10. إغلاق النافذة ======
if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
        editModal.classList.remove("active");
    });
}

// ====== 11. حفظ بيانات التعديل + الوسائط ======
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
        btnSave.innerText = "جاري رفع الملفات...";
        btnSave.disabled = true;

        try {
            const updatePayload = {
                title, message, securityQuestion, securityAnswer,
                updatedAt: serverTimestamp()
            };

            if (imageFiles && imageFiles.length > 0) {
                const imageUrls = [];
                for (let i = 0; i < imageFiles.length; i++) {
                    const url = await uploadToCloudinary(imageFiles[i], "image");
                    imageUrls.push(url);
                }
                updatePayload.images = imageUrls;
            }

            if (videoFile) {
                updatePayload.videoUrl = await uploadToCloudinary(videoFile, "video");
            }

            if (audioFile) {
                updatePayload.bgMusicUrl = await uploadToCloudinary(audioFile, "auto");
            }

            await updateDoc(doc(db, "cards", cardId), updatePayload);
            alert("✅ تم حفظ التغييرات بنجاح!");
            editModal.classList.remove("active");

        } catch (error) {
            console.error("خطأ:", error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btnSave.innerText = "حفظ التغييرات ورفع الوسائط";
            btnSave.disabled = false;
        }
    });
}
