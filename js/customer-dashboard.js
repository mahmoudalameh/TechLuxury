import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ استبدل هذه الإعدادات ببيانات مشروعك الخاصة من Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// التحقق من حالة تسجيل الدخول
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        currentUser = user;
        document.getElementById("userEmail").innerText = user.email;
        loadUserCards(user.uid);
    }
});

// تسجيل الخروج
document.getElementById("btnLogout").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "login.html";
    });
});

// ربط كرت جديد بالحساب (Claim Card)
document.getElementById("btnClaimCard").addEventListener("click", async () => {
    const cardId = document.getElementById("cardIdInput").value.trim().toUpperCase();
    if (!cardId) {
        alert("يرجى إدخال رمز الكرت.");
        return;
    }

    try {
        const cardRef = doc(db, "cards", cardId);
        const cardSnap = await getDoc(cardRef);

        if (!cardSnap.exists()) {
            alert("رمز الكرت غير صحيح، يرجى التثبت من الرمز.");
            return;
        }

        const cardData = cardSnap.data();

        if (cardData.ownerId && cardData.ownerId !== currentUser.uid) {
            alert("هذا الكرت مربوط بحساب آخر بالفعل!");
            return;
        }

        // ربط الكرت بحساب العميل وتحديث حالته لـ active
        await updateDoc(cardRef, {
            ownerId: currentUser.uid,
            status: "active",
            updatedAt: serverTimestamp()
        });

        alert("تم ربط الكرت بحسابك بنجاح! يمكنك الآن تعديل بياناته.");
        document.getElementById("cardIdInput").value = "";

    } catch (error) {
        console.error("خطأ في ربط الكرت:", error);
        alert("حدث خطأ أثناء تفعيل الكرت.");
    }
});

// استعلام وتحميل الكروت المملوكة للعميل الحالي فقط
function loadUserCards(uid) {
    const cardsQuery = query(collection(db, "cards"), where("ownerId", "==", uid));

    onSnapshot(cardsQuery, (snapshot) => {
        const cardsList = document.getElementById("myCardsList");
        cardsList.innerHTML = "";

        if (snapshot.empty) {
            cardsList.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">لا توجد كروت مفعلة بحسابك حالياً. استخدم النموذج أعلاه لربط كرتك.</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const card = docSnap.data();
            const cardElement = document.createElement("div");
            cardElement.className = "my-card";

            cardElement.innerHTML = `
                <div>
                    <h3><i class="fa-solid fa-gem"></i> ${card.title || 'قلادة بدون عنوان'}</h3>
                    <p>رمز الكرت: <strong>${card.cardId}</strong></p>
                    <p>الحالة: <span style="color: #34d399;">مفعل ومربوط بحسابك</span></p>
                </div>
                <a href="memory.html?id=${card.cardId}" class="btn-edit-memory">
                    <i class="fa-solid fa-pen-to-square"></i> تعديل الذكريات والبيانات
                </a>
            `;

            cardsList.appendChild(cardElement);
        });
    });
}
