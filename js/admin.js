// ===== استيراد Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc,
    setDoc, 
    onSnapshot, 
    updateDoc, 
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

// ============================================================
// 🔐 التحقق من صلاحيات الأدمن
// ============================================================
onAuthStateChanged(auth, async (user) => {
    // 1. لا يوجد تسجيل دخول → اذهب لصفحة تسجيل الدخول
    if (!user) {
        console.log("⚠️ لا يوجد مستخدم مسجّل دخول");
        window.location.href = "login.html";
        return;
    }

    console.log("✅ المستخدم الحالي:", user.email, "UID:", user.uid);

    // 2. التحقق من أن المستخدم موجود في collection "admins"
    try {
        const adminDocRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminDocRef);

        if (!adminSnap.exists()) {
            console.error("❌ هذا المستخدم ليس أدمن");
            alert("❌ غير مصرح لك بالدخول إلى لوحة الإدارة");
            await signOut(auth);
            window.location.href = "login.html";
            return;
        }

        console.log("✅ تم التحقق من صلاحيات الأدمن");
        
        // 3. ✅ المستخدم أدمن → شغّل اللوحة
        initializeAdminPanel();

    } catch (error) {
        console.error("خطأ في التحقق من الصلاحيات:", error);
        alert("حدث خطأ أثناء التحقق من الصلاحيات");
        window.location.href = "login.html";
    }
});

// ============================================================
// 🎯 تشغيل لوحة الإدارة (بعد التحقق من الصلاحيات)
// ============================================================
function initializeAdminPanel() {

    // ===== دالة توليد رمز كرت عشوائي =====
    function generateCardId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // ============================================================
    // 1️⃣ إنشاء كرت جديد
    // ============================================================
    const btnCreateCard = document.getElementById("btnCreateCard");
    if (btnCreateCard) {
        btnCreateCard.addEventListener("click", async () => {
            const cardId = generateCardId(8);
            const cardRef = doc(db, "cards", cardId);

            btnCreateCard.disabled = true;
            btnCreateCard.innerText = "جاري الإنشاء...";

            try {
                await setDoc(cardRef, {
                    cardId: cardId,
                    ownerId: null,
                    status: "available",
                    theme: "classic",
                    title: "",
                    message: "",
                    publicEnabled: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                alert(`✅ تم إنشاء الكرت بنجاح!\n\nرمز الكرت: ${cardId}`);
            } catch (error) {
                console.error("خطأ أثناء إنشاء الكرت:", error);
                
                if (error.code === "permission-denied") {
                    alert("❌ ليس لديك صلاحية إنشاء الكروت.\nتأكد من أنك مسجّل دخول كأدمن.");
                } else {
                    alert("حدث خطأ أثناء إنشاء الكرت: " + error.message);
                }
            } finally {
                btnCreateCard.disabled = false;
                btnCreateCard.innerHTML = '<i class="fa-solid fa-plus"></i> إنشاء كرت NFC جديد';
            }
        });
    }

    // ============================================================
    // 2️⃣ الاستماع للكروت وعرضها
    // ============================================================
    const cardsCollection = collection(db, "cards");

    onSnapshot(cardsCollection, (snapshot) => {
        const tableBody = document.getElementById("cardsTableBody");
        if (!tableBody) return;
        
        tableBody.innerHTML = "";

        let total = 0, available = 0, active = 0, disabled = 0;

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">لا يوجد كروت حتى الآن. اضغط زر الإنشاء أعلاه.</td></tr>`;
            updateStats(0, 0, 0, 0);
            return;
        }

        snapshot.forEach((docSnap) => {
            const card = docSnap.data();
            total++;

            if (card.status === "available") available++;
            else if (card.status === "active") active++;
            else if (card.status === "disabled") disabled++;

            // ✅ رابط NFC الصحيح
            const nfcUrl = `${window.location.origin}${window.location.pathname.replace(/\/html\/.*$/, "")}/html/customer-view.html?id=${card.cardId}`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${card.cardId}</strong></td>
                <td>
                    <select class="status-select" data-id="${card.cardId}">
                        <option value="available" ${card.status === 'available' ? 'selected' : ''}>متاح (Available)</option>
                        <option value="active" ${card.status === 'active' ? 'selected' : ''}>مفعل (Active)</option>
                        <option value="disabled" ${card.status === 'disabled' ? 'selected' : ''}>معطل (Disabled)</option>
                    </select>
                </td>
                <td>${card.createdAt ? new Date(card.createdAt.toDate()).toLocaleDateString('ar-EG') : 'الآن'}</td>
                <td style="font-size: 0.85rem; color: #94a3b8;">${nfcUrl}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-sm btn-copy" data-url="${nfcUrl}">
                            <i class="fa-regular fa-copy"></i> نسخ الرابط
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

        updateStats(total, available, active, disabled);

        // ربط أزرار النسخ
        document.querySelectorAll(".btn-copy").forEach(btn => {
            btn.addEventListener("click", () => {
                const url = btn.dataset.url;
                navigator.clipboard.writeText(url).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ!';
                    setTimeout(() => btn.innerHTML = originalHTML, 1500);
                });
            });
        });

        // ربط تغيير الحالة
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", async (e) => {
                const cardId = e.target.getAttribute("data-id");
                const newStatus = e.target.value;
                await updateCardStatus(cardId, newStatus);
            });
        });
    });

    // ============================================================
    // 3️⃣ تحديث حالة الكرت
    // ============================================================
    async function updateCardStatus(cardId, status) {
        try {
            const cardRef = doc(db, "cards", cardId);
            await updateDoc(cardRef, {
                status: status,
                updatedAt: serverTimestamp()
            });
            console.log(`✅ تم تغيير حالة الكرت ${cardId} إلى ${status}`);
        } catch (error) {
            console.error("خطأ في تحديث الحالة:", error);
            
            if (error.code === "permission-denied") {
                alert("❌ ليس لديك صلاحية تعديل حالة الكرت.");
            } else {
                alert("فشل تحديث حالة الكرت: " + error.message);
            }
        }
    }

    // ============================================================
    // 4️⃣ تحديث الإحصائيات
    // ============================================================
    function updateStats(total, available, active, disabled) {
        const totalEl = document.getElementById("totalCards");
        const availableEl = document.getElementById("availableCards");
        const activeEl = document.getElementById("activeCards");
        const disabledEl = document.getElementById("disabledCards");

        if (totalEl) totalEl.innerText = total;
        if (availableEl) availableEl.innerText = available;
        if (activeEl) activeEl.innerText = active;
        if (disabledEl) disabledEl.innerText = disabled;
    }
}

// ============================================================
// 🚪 زر تسجيل الخروج (إن وُجد)
// ============================================================
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
});
