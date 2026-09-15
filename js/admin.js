// استيراد أدوات Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    onSnapshot, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ استبدل هذه الإعدادات ببيانات مشروعك الخاصة من Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// دالة لتوليد رمز كرت عشوائي فريد (مثل: X7K29P4M)
function generateCardId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 1. دالة إنشاء كرت جديد
document.getElementById("btnCreateCard").addEventListener("click", async () => {
    const cardId = generateCardId(8);
    const cardRef = doc(db, "cards", cardId);

    try {
        await setDoc(cardRef, {
            cardId: cardId,
            ownerId: null,             // لم يتم ربطه بزبون بعد
            status: "available",       // حالة الكرت أول ما ينشأ: متاحة للبيع/التفعيل
            theme: "classic",
            title: "",
            message: "",
            publicEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        alert(`تم إنشاء الكرت بنجاح!\nرمز الكرت: ${cardId}`);
    } catch (error) {
        console.error("خطأ أثناء إنشاء الكرت:", error);
        alert("حدث خطأ أثناء إنشاء الكرت، تفقد الكنسول.");
    }
});

// 2. الاستماع لقاعدة البيانات وعرض الكروت مباشرة (Real-time Listener)
const cardsCollection = collection(db, "cards");

onSnapshot(cardsCollection, (snapshot) => {
    const tableBody = document.getElementById("cardsTableBody");
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

        // إحصائيات الحالات
        if (card.status === "available") available++;
        else if (card.status === "active") active++;
        else if (card.status === "disabled") disabled++;

        // رابط الكرت الخاص بالـ NFC
        const nfcUrl = `${window.location.origin}/memory.html?id=${card.cardId}`;

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
                    <button class="btn-sm btn-copy" onclick="navigator.clipboard.writeText('${nfcUrl}'); alert('تم نسخ رابط الـ NFC!');">
                        <i class="fa-regular fa-copy"></i> نسخ الرابط
                    </button>
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });

    updateStats(total, available, active, disabled);

    // إضافة أحداث التغيير للحالة (Status Change)
    document.querySelectorAll(".status-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const cardId = e.target.getAttribute("data-id");
            const newStatus = e.target.value;
            await updateCardStatus(cardId, newStatus);
        });
    });
});

// دالة تحديث حالة الكرت في Firestore
async function updateCardStatus(cardId, status) {
    try {
        const cardRef = doc(db, "cards", cardId);
        await updateDoc(cardRef, {
            status: status,
            updatedAt: serverTimestamp()
        });
        console.log(`تم تغيير حالة الكرت ${cardId} إلى ${status}`);
    } catch (error) {
        console.error("خطأ في تحديث الحالة:", error);
        alert("فشل تحديث حالة الكرت.");
    }
}

// تحديث لوحة الإحصائيات
function updateStats(total, available, active, disabled) {
    document.getElementById("totalCards").innerText = total;
    document.getElementById("availableCards").innerText = available;
    document.getElementById("activeCards").innerText = active;
    document.getElementById("disabledCards").innerText = disabled;
}
