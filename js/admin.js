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

// ✅ مخزّن مؤقت لأسماء العملاء (cache)
const customersCache = new Map();

// ============================================================
// 🔐 التحقق من صلاحيات الأدمن
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log("⚠️ لا يوجد مستخدم مسجّل دخول");
        window.location.href = "login.html";
        return;
    }

    console.log("✅ المستخدم الحالي:", user.email, "UID:", user.uid);

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
        initializeAdminPanel();

    } catch (error) {
        console.error("خطأ في التحقق من الصلاحيات:", error);
        alert("حدث خطأ أثناء التحقق من الصلاحيات");
        window.location.href = "login.html";
    }
});

// ============================================================
// 🎯 تشغيل لوحة الإدارة
// ============================================================
function initializeAdminPanel() {

    // ===== متغيرات البحث =====
    let allCards = [];
    let currentSearchTerm = "";
    let currentFilter = "all";

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
    // ✅ دالة جلب اسم العميل من Firestore
    // ============================================================
    async function getCustomerName(uid) {
        if (!uid) return null;
        
        // ✅ إذا كان محفوظاً في الـ cache → رجعه فوراً
        if (customersCache.has(uid)) {
            return customersCache.get(uid);
        }

        try {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const customerInfo = {
                    name: userData.name || null,
                    email: userData.email || null
                };
                customersCache.set(uid, customerInfo);
                return customerInfo;
            }

            // لم يوجد المستخدم
            customersCache.set(uid, null);
            return null;
        } catch (error) {
            console.error("خطأ في جلب بيانات العميل:", error);
            return null;
        }
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
                    protected: false,
                    salt: null,
                    encryptionVersion: null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                alert(`✅ تم إنشاء الكرت بنجاح!\n\nرمز الكرت: ${cardId}`);
            } catch (error) {
                console.error("خطأ أثناء إنشاء الكرت:", error);
                if (error.code === "permission-denied") {
                    alert("❌ ليس لديك صلاحية إنشاء الكروت.");
                } else {
                    alert("حدث خطأ: " + error.message);
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

    onSnapshot(cardsCollection, async (snapshot) => {
        allCards = [];

        snapshot.forEach((docSnap) => {
            const card = docSnap.data();
            allCards.push({
                id: docSnap.id,
                ...card
            });
        });

        // ✅ رتّب الكروت (الأحدث أولاً)
        allCards.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        // ✅ املأ الـ cache بأسماء العملاء
        const uniqueOwnerIds = [...new Set(allCards.map(c => c.ownerId).filter(Boolean))];
        await Promise.all(uniqueOwnerIds.map(uid => getCustomerName(uid)));

        // ✅ اعرض الكروت
        await renderCardsTable();
        updateStats();
    });

    // ============================================================
    // 3️⃣ عرض جدول الكروت (مع البحث)
    // ============================================================
    async function renderCardsTable() {
        const tableBody = document.getElementById("cardsTableBody");
        if (!tableBody) return;

        // ✅ طبّق البحث والفلترة
        let filteredCards = allCards.filter(card => {
            // فلتر الحالة
            if (currentFilter === "available" && card.status !== "available") return false;
            if (currentFilter === "active" && card.status !== "active") return false;
            if (currentFilter === "disabled" && card.status !== "disabled") return false;
            if (currentFilter === "protected" && !(card.salt && card.protected)) return false;
            if (currentFilter === "public" && (card.salt && card.protected)) return false;

            // فلتر البحث
            if (currentSearchTerm) {
                const term = currentSearchTerm.toLowerCase();
                const customerInfo = card.ownerId ? customersCache.get(card.ownerId) : null;
                const customerName = (customerInfo?.name || "").toLowerCase();
                const customerEmail = (customerInfo?.email || card.ownerEmail || "").toLowerCase();

                const matches =
                    card.id.toLowerCase().includes(term) ||
                    customerName.includes(term) ||
                    customerEmail.includes(term);

                if (!matches) return false;
            }

            return true;
        });

        // ✅ عرض عدد النتائج
        const searchInfo = document.getElementById("searchInfo");
        if (searchInfo) {
            if (currentSearchTerm || currentFilter !== "all") {
                searchInfo.textContent = `📊 ${filteredCards.length} نتيجة من ${allCards.length} كرت`;
            } else {
                searchInfo.textContent = `📊 إجمالي ${allCards.length} كرت`;
            }
        }

        // ✅ إذا لا توجد نتائج
        if (filteredCards.length === 0) {
            if (allCards.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <i class="fa-solid fa-inbox"></i>
                            لا يوجد كروت حتى الآن. اضغط زر الإنشاء أعلاه.
                        </td>
                    </tr>
                `;
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            لا توجد نتائج مطابقة للبحث.
                        </td>
                    </tr>
                `;
            }
            return;
        }

        // ✅ ابنِ الجدول
        tableBody.innerHTML = "";

        for (const card of filteredCards) {
            // ✅ جلب اسم العميل
            let customerDisplay = `<span class="no-name">— غير مربوط —</span>`;
            
            if (card.ownerId) {
                const customerInfo = await getCustomerName(card.ownerId);
                const customerName = customerInfo?.name || "بدون اسم";
                const customerEmail = customerInfo?.email || card.ownerEmail || "";

                customerDisplay = `
                    <div class="customer-name">${escapeHtml(customerName)}</div>
                    ${customerEmail ? `<div class="customer-email">${escapeHtml(customerEmail)}</div>` : ""}
                `;
            }

            // ✅ رابط NFC
            const nfcUrl = `${window.location.origin}${window.location.pathname.replace(/\/html\/.*$/, "")}/html/customer-view.html?id=${card.cardId || card.id}`;

            // ✅ نوع الكرت
            const typeLabels = {
                "gift": "🎁 هدية",
                "memory_book": "📖 كتاب ذكريات",
                "business_card": "💼 بطاقة عمل",
                "pet_card": "🐾 بطاقة حيوانات"
            };
            const typeLabel = card.type ? (typeLabels[card.type] || card.type) : "— غير محدد —";

            // ✅ حالة القفل
            const lockStatus = (card.salt && card.protected)
                ? `<span style="color:#22c55e; font-size:0.8rem;">🔒 محمي</span>`
                : `<span style="color:#f59e0b; font-size:0.8rem;">🌐 عام</span>`;

            // ✅ تمييز النتائج
            const isHighlighted = currentSearchTerm &&
                (card.id.toLowerCase().includes(currentSearchTerm.toLowerCase()));
            const rowClass = isHighlighted ? "highlighted" : "";

            const row = document.createElement("tr");
            row.className = rowClass;
            row.innerHTML = `
                <td><strong>${escapeHtml(card.id)}</strong></td>
                <td>${customerDisplay}</td>
                <td>
                    <div style="font-size:0.85rem; margin-bottom:5px;">${typeLabel}</div>
                    ${lockStatus}
                </td>
                <td>
                    <select class="status-select" data-id="${card.id}">
                        <option value="available" ${card.status === 'available' ? 'selected' : ''}>متاح</option>
                        <option value="active" ${card.status === 'active' ? 'selected' : ''}>مفعل</option>
                        <option value="disabled" ${card.status === 'disabled' ? 'selected' : ''}>معطل</option>
                    </select>
                </td>
                <td style="font-size:0.8rem;">${card.createdAt ? new Date(card.createdAt.toDate()).toLocaleDateString('ar-EG') : 'الآن'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-sm btn-copy" data-url="${nfcUrl}">
                            <i class="fa-regular fa-copy"></i> نسخ الرابط
                        </button>
                        <button class="btn-sm btn-reset-type" data-id="${card.id}">
                            <i class="fa-solid fa-eraser"></i> تصفير الكرت
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        }

        // ✅ ربط أحداث الأزرار
        bindTableEvents();
    }

    // ============================================================
    // 4️⃣ ربط أحداث الأزرار في الجدول
    // ============================================================
    function bindTableEvents() {
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

        // ربط أزرار التصفير
        document.querySelectorAll(".btn-reset-type").forEach(btn => {
            btn.addEventListener("click", async () => {
                const cardId = btn.dataset.id;
                await resetCardType(cardId);
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
    }

    // ============================================================
    // 5️⃣ أحداث البحث والفلترة
    // ============================================================
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearchTerm = e.target.value.trim();
                renderCardsTable();
            }, 250);
        });
    }

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            renderCardsTable();
        });
    });

    // ============================================================
    // 6️⃣ تحديث حالة الكرت
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
    // 7️⃣ تصفير نوع الكرت
    // ============================================================
    async function resetCardType(cardId) {
        if (!confirm(`⚠️ تحذير!\n\nسيتم حذف كل بيانات الكرت "${cardId}":\n\n• النوع المختار\n• العنوان والرسائل\n• الصور والفيديوهات\n• معلومات البطاقة\n• كلمة المرور\n\nهل أنت متأكد؟`)) return;
        if (!confirm("⚠️ تأكيد نهائي!\n\nهذا الإجراء لا يمكن التراجع عنه.\n\nهل أنت متأكد 100%؟")) return;

        try {
            const cardRef = doc(db, "cards", cardId);
            await updateDoc(cardRef, {
                type: null,
                protected: false,
                title: "",
                message: "",
                images: [],
                video: "",
                events: [],
                name: "",
                jobTitle: "",
                company: "",
                bio: "",
                services: "",
                email: "",
                address: "",
                phone: [],
                website: [],
                instagram: [],
                facebook: "",
                linkedin: "",
                logoUrl: "",
                logo: "",
                petName: "",
                petType: "",
                petBreed: "",
                petAge: "",
                petWeight: "",
                petColor: "",
                petNotes: "",
                petVaccinations: "",
                petOwnerName: "",
                petOwnerPhone: "",
                petAddress: "",
                petPhoto: "",
                bgMusicUrl: "",
                salt: null,
                encryptionVersion: null,
                updatedAt: serverTimestamp()
            });

            alert(`✅ تم تصفير الكرت "${cardId}" بنجاح!`);
        } catch (error) {
            console.error("خطأ في تصفير الكرت:", error);
            if (error.code === "permission-denied") {
                alert("❌ ليس لديك صلاحية تعديل هذا الكرت.");
            } else {
                alert("فشل تصفير الكرت: " + error.message);
            }
        }
    }

    // ============================================================
    // 8️⃣ تحديث الإحصائيات
    // ============================================================
    function updateStats() {
        let total = allCards.length;
        let available = 0, active = 0, disabled = 0;

        allCards.forEach(card => {
            if (card.status === "available") available++;
            else if (card.status === "active") active++;
            else if (card.status === "disabled") disabled++;
        });

        const totalEl = document.getElementById("totalCards");
        const availableEl = document.getElementById("availableCards");
        const activeEl = document.getElementById("activeCards");
        const disabledEl = document.getElementById("disabledCards");

        if (totalEl) totalEl.innerText = total;
        if (availableEl) availableEl.innerText = available;
        if (activeEl) activeEl.innerText = active;
        if (disabledEl) disabledEl.innerText = disabled;
    }

    // ===== دالة escapeHtml =====
    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        const div = document.createElement("div");
        div.textContent = String(text);
        return div.innerHTML;
    }
}

// ============================================================
// 🚪 زر تسجيل الخروج (إن وُجد)
// ============================================================
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
});
