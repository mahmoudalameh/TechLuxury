import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js".replace("firestore", "app");
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

// ===== أنواع الكروت =====
const CARD_TYPES = {
    gift: {
        label: "كرت هدية",
        icon: "fa-gift",
        color: "#ec4899",
        effect: "hearts"
    },
    memory_book: {
        label: "كتاب ذكريات",
        icon: "fa-book-open",
        color: "#e2b714",
        effect: null
    },
    business_card: {
        label: "بطاقة عمل",
        icon: "fa-id-card",
        color: "#3b82f6",
        effect: null
    }
};

// ===== العناصر =====
const loadingScreen = document.getElementById("loadingScreen");
const viewContainer = document.getElementById("viewContainer");
const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCounter = document.getElementById("lightboxCounter");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");

let currentImages = [];
let currentImageIndex = 0;
let musicStarted = false;
let currentBookPage = 0;
let bookPages = [];

// ===== الحصول على معرف الكرت =====
function getCardIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("card") || params.get("c");
}

// ===== بدء التشغيل =====
async function init() {
    const cardId = getCardIdFromURL();
    if (!cardId) {
        showError("لم يتم تحديد الكرت", "الرجاء مسح رمز QR للوصول إلى الذكرى.");
        return;
    }

    try {
        const cardSnap = await getDoc(doc(db, "cards", cardId));
        if (!cardSnap.exists()) {
            showError("الكرت غير موجود", "تأكد من صحة الرابط أو تواصل مع الدعم.");
            return;
        }

        const card = cardSnap.data();
        if (!card.ownerId) {
            showError("الكرت غير مُفعّل", "هذا الكرت لم يُربط بحساب بعد.");
            return;
        }

        // 🔒 سؤال الأمان
        if (card.securityQuestion && card.securityAnswer) {
            showSecurityScreen(card);
        } else {
            displayCard(card);
        }
    } catch (error) {
        console.error(error);
        showError("خطأ", "حدث خطأ أثناء تحميل الكرت.");
    }
}

// ===== شاشة الخطأ =====
function showError(title, message) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";
    viewContainer.innerHTML = `
        <div class="error-screen">
            <i class="fa-solid fa-circle-exclamation"></i>
            <h2>${title}</h2>
            <p style="color: var(--text-muted); max-width: 400px;">${message}</p>
        </div>
    `;
}

// ===== شاشة سؤال الأمان =====
function showSecurityScreen(card) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";

    viewContainer.innerHTML = `
        <div class="security-screen">
            <div class="security-box">
                <div class="lock-icon"><i class="fa-solid fa-lock"></i></div>
                <h3>🔐 هذه الذكرى محمية</h3>
                <p style="color: var(--text-muted); margin-bottom: 15px; font-size: 0.9rem;">
                    أجب على السؤال لفتح الذكرى
                </p>
                <div class="question">${card.securityQuestion}</div>
                <input type="text" id="securityAnswerInput" placeholder="اكتب إجابتك هنا..." autocomplete="off">
                <button class="btn-unlock" id="btnUnlock">
                    <i class="fa-solid fa-unlock"></i> فتح الذكرى
                </button>
                <p class="error-msg" id="securityError">❌ الإجابة غير صحيحة</p>
            </div>
        </div>
    `;

    const input = document.getElementById("securityAnswerInput");
    const btn = document.getElementById("btnUnlock");
    const errorMsg = document.getElementById("securityError");

    const tryUnlock = () => {
        const answer = input.value.trim().toLowerCase();
        const correct = (card.securityAnswer || "").toLowerCase();
        if (answer === correct) {
            displayCard(card);
        } else {
            errorMsg.style.display = "block";
            input.value = "";
            input.focus();
        }
    };

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") tryUnlock(); });
    input.focus();
}

// ===== عرض الكرت حسب النوع =====
function displayCard(card) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";

    const typeInfo = CARD_TYPES[card.type] || CARD_TYPES.gift;
    document.documentElement.style.setProperty("--accent", typeInfo.color);

    // 🎵 تشغيل الموسيقى أولاً
    if (card.bgMusicUrl) {
        startMusic(card.bgMusicUrl);
    }

    // 🎨 تأثيرات بصرية حسب النوع
    if (typeInfo.effect) {
        startEffect(typeInfo.effect, typeInfo.color);
    }

    // 🎯 عرض حسب النوع
    if (card.type === "memory_book") {
        renderMemoryBook(card, typeInfo);
    } else if (card.type === "business_card") {
        renderBusinessCard(card, typeInfo);
    } else {
        renderGiftCard(card, typeInfo);
    }

    document.title = card.title || "ذِكـرى";
}

// ============================================================
// 🎁 نوع 1: كرت الهدية
// ============================================================
function renderGiftCard(card, typeInfo) {
    const images = card.images || [];

    viewContainer.innerHTML = `
        <header class="gift-header">
            <div class="gift-icon" style="color: ${typeInfo.color};">
                <i class="fa-solid ${typeInfo.icon}"></i>
            </div>
            <h1>${escapeHtml(card.title) || "🎁 هدية خاصة 🎁"}</h1>
            <div class="gift-label">
                <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.label}
            </div>
        </header>

        ${card.message ? `
            <div class="message-box">
                <p>${escapeHtml(card.message)}</p>
            </div>
        ` : ""}

        ${images.length > 0 ? `
            <h3 class="section-title">
                <i class="fa-solid fa-images"></i> معرض الصور (${images.length})
            </h3>
            <div class="gallery" id="gallery">
                ${images.map((url, i) => `
                    <img src="${url}" data-index="${i}" alt="صورة ${i + 1}" loading="lazy">
                `).join("")}
            </div>
        ` : ""}

        ${card.videoUrl ? `
            <h3 class="section-title">
                <i class="fa-solid fa-video"></i> الفيديو
            </h3>
            <div class="video-wrapper">
                <video controls playsinline preload="metadata">
                    <source src="${card.videoUrl}" type="video/mp4">
                </video>
            </div>
        ` : ""}
    `;

    currentImages = images;
    setupGallery();
}

// ============================================================
// 📖 نوع 2: كتاب الذكريات (قلب صفحات)
// ============================================================
function renderMemoryBook(card, typeInfo) {
    bookPages = card.events || [];
    currentBookPage = 0;

    if (bookPages.length === 0) {
        viewContainer.innerHTML = `
            <div class="error-screen">
                <i class="fa-solid fa-book" style="color: var(--accent);"></i>
                <h2>الكتاب فارغ</h2>
                <p style="color: var(--text-muted);">لم يتم إضافة أي صفحات بعد.</p>
            </div>
        `;
        return;
    }

    viewContainer.innerHTML = `
        <div class="book-container">
            <div class="book-cover">
                <h1>📖 ${escapeHtml(card.title) || "كتاب الذكريات"}</h1>
                <p class="book-subtitle">${bookPages.length} صفحة من ذكرياتنا</p>
            </div>

            <div class="book-pages" id="bookPages">
                ${bookPages.map((evt, i) => renderBookPage(evt, i)).join("")}
            </div>

            <div class="book-controls">
                <button class="book-nav-btn" id="bookPrev" disabled>
                    <i class="fa-solid fa-chevron-right"></i> السابق
                </button>
                <div class="book-page-indicator">
                    صفحة <strong id="currentPageNum">1</strong> من ${bookPages.length}
                </div>
                <button class="book-nav-btn" id="bookNext" ${bookPages.length <= 1 ? "disabled" : ""}>
                    التالي <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>

            <div class="book-dots" id="bookDots">
                ${bookPages.map((_, i) =>
                    `<button class="book-dot ${i === 0 ? "active" : ""}" data-page="${i}"></button>`
                ).join("")}
            </div>
        </div>
    `;

    // تفعيل التنقل
    setupBookNavigation();

    // عرض الصفحة الأولى
    showBookPage(0);
}

function renderBookPage(evt, index) {
    const images = evt.images || [];
    return `
        <div class="book-page ${index === 0 ? "active" : ""}" data-page="${index}">
            <div class="page-header">
                <div class="page-emoji">${evt.emoji || "📌"}</div>
                <h2 class="page-title">${escapeHtml(evt.title) || "ذكرى"}</h2>
                ${evt.date ? `<p class="page-date"><i class="fa-solid fa-calendar"></i> ${formatDate(evt.date)}</p>` : ""}
            </div>

            ${evt.message ? `<p class="page-message">${escapeHtml(evt.message)}</p>` : ""}

            ${images.length > 0 ? `
                <div class="page-gallery">
                    ${images.map(url => `<img src="${url}" loading="lazy">`).join("")}
                </div>
            ` : ""}

            ${evt.videoUrl ? `
                <div class="page-video">
                    <video controls playsinline preload="metadata">
                        <source src="${evt.videoUrl}" type="video/mp4">
                    </video>
                </div>
            ` : ""}
        </div>
    `;
}

function setupBookNavigation() {
    const prevBtn = document.getElementById("bookPrev");
    const nextBtn = document.getElementById("bookNext");

    prevBtn?.addEventListener("click", () => showBookPage(currentBookPage - 1));
    nextBtn?.addEventListener("click", () => showBookPage(currentBookPage + 1));

    document.querySelectorAll(".book-dot").forEach(dot => {
        dot.addEventListener("click", () => showBookPage(parseInt(dot.dataset.page)));
    });
}

function showBookPage(pageNum) {
    if (pageNum < 0 || pageNum >= bookPages.length) return;
    currentBookPage = pageNum;

    // إخفاء كل الصفحات
    document.querySelectorAll(".book-page").forEach(p => p.classList.remove("active"));
    // إظهار الصفحة المطلوبة
    const activePage = document.querySelector(`.book-page[data-page="${pageNum}"]`);
    if (activePage) activePage.classList.add("active");

    // تحديث المؤشر
    const pageNumEl = document.getElementById("currentPageNum");
    if (pageNumEl) pageNumEl.textContent = pageNum + 1;

    // تحديث النقاط
    document.querySelectorAll(".book-dot").forEach((d, i) => {
        d.classList.toggle("active", i === pageNum);
    });

    // تحديث الأزرار
    const prevBtn = document.getElementById("bookPrev");
    const nextBtn = document.getElementById("bookNext");
    if (prevBtn) prevBtn.disabled = pageNum === 0;
    if (nextBtn) nextBtn.disabled = pageNum === bookPages.length - 1;

    // فتح معرض الصور لهذه الصفحة
    const pageImages = bookPages[pageNum].images || [];
    currentImages = pageImages;
    setupGallery();

    // تمرير لأعلى
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 💼 نوع 3: بطاقة العمل
// ============================================================
function renderBusinessCard(card, typeInfo) {
    const contacts = [];

    if (card.phone) {
        contacts.push(`<a href="tel:${card.phone}" class="biz-contact-btn">
            <i class="fa-solid fa-phone"></i> اتصل
        </a>`);
    }
    if (card.email) {
        contacts.push(`<a href="mailto:${card.email}" class="biz-contact-btn">
            <i class="fa-solid fa-envelope"></i> راسلني
        </a>`);
    }
    if (card.phone) {
        const whatsappNum = card.phone.replace(/[^0-9]/g, "");
        contacts.push(`<a href="https://wa.me/${whatsappNum}" target="_blank" class="biz-contact-btn full-width">
            <i class="fa-brands fa-whatsapp"></i> واتساب
        </a>`);
    }
    if (card.website) {
        contacts.push(`<a href="${card.website}" target="_blank" class="biz-contact-btn full-width">
            <i class="fa-solid fa-globe"></i> زيارة الموقع
        </a>`);
    }
    if (card.address) {
        contacts.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(card.address)}" target="_blank" class="biz-contact-btn full-width">
            <i class="fa-solid fa-location-dot"></i> ${escapeHtml(card.address)}
        </a>`);
    }

    const socials = [];
    if (card.instagram) socials.push(`<a href="https://instagram.com/${card.instagram.replace("@", "")}" target="_blank" class="biz-social-btn instagram"><i class="fa-brands fa-instagram"></i></a>`);
    if (card.facebook) socials.push(`<a href="https://${card.facebook.replace(/^https?:\/\//, "")}" target="_blank" class="biz-social-btn facebook"><i class="fa-brands fa-facebook-f"></i></a>`);
    if (card.linkedin) socials.push(`<a href="https://${card.linkedin.replace(/^https?:\/\//, "")}" target="_blank" class="biz-social-btn linkedin"><i class="fa-brands fa-linkedin-in"></i></a>`);
    if (card.website) socials.push(`<a href="${card.website}" target="_blank" class="biz-social-btn website"><i class="fa-solid fa-globe"></i></a>`);

    viewContainer.innerHTML = `
        <div class="biz-card">
            ${card.logoUrl
                ? `<img src="${card.logoUrl}" class="biz-logo" alt="Logo">`
                : `<div class="biz-logo-placeholder"><i class="fa-solid fa-user"></i></div>`
            }

            <h1 class="biz-name">${escapeHtml(card.name) || "بطاقة عمل"}</h1>
            ${card.jobTitle ? `<p class="biz-job">${escapeHtml(card.jobTitle)}</p>` : ""}
            ${card.company ? `<p class="biz-company">${escapeHtml(card.company)}</p>` : ""}

            ${card.bio ? `
                <div class="biz-section">
                    <div class="biz-section-title"><i class="fa-solid fa-user"></i> نبذة</div>
                    <div class="biz-section-content">${escapeHtml(card.bio)}</div>
                </div>
            ` : ""}

            ${card.services ? `
                <div class="biz-section">
                    <div class="biz-section-title"><i class="fa-solid fa-briefcase"></i> الخدمات</div>
                    <div class="biz-section-content">${escapeHtml(card.services)}</div>
                </div>
            ` : ""}

            ${contacts.length > 0 ? `
                <div class="biz-contacts">${contacts.join("")}</div>
            ` : ""}

            ${socials.length > 0 ? `
                <div class="biz-socials">${socials.join("")}</div>
            ` : ""}
        </div>
    `;
}

// ============================================================
// معالجة الصور (Lightbox)
// ============================================================
function setupGallery() {
    document.querySelectorAll(".gallery img, .page-gallery img").forEach(img => {
        img.addEventListener("click", () => {
            const src = img.src;
            currentImageIndex = currentImages.indexOf(src);
            if (currentImageIndex === -1) currentImageIndex = 0;
            openLightbox();
        });
    });
}

function openLightbox() {
    lightboxImg.src = currentImages[currentImageIndex];
    lightboxCounter.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
}

function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    lightboxImg.src = currentImages[currentImageIndex];
    lightboxCounter.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
}

function prevImage() {
    currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    lightboxImg.src = currentImages[currentImageIndex];
    lightboxCounter.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
}

lightboxClose?.addEventListener("click", closeLightbox);
lightboxNext?.addEventListener("click", nextImage);
lightboxPrev?.addEventListener("click", prevImage);
lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") nextImage();
    if (e.key === "ArrowRight") prevImage();
});

// ============================================================
// الموسيقى
// ============================================================
function startMusic(url) {
    bgMusic.src = url;
    bgMusic.volume = 0.5;

    const tryPlay = () => {
        bgMusic.play()
            .then(() => {
                musicStarted = true;
                musicToggle.classList.remove("visible");
                musicToggle.classList.add("playing");
            })
            .catch(() => {
                musicToggle.classList.add("visible");
            });
    };

    tryPlay();

    document.body.addEventListener("click", () => {
        if (!musicStarted) {
            bgMusic.play()
                .then(() => {
                    musicStarted = true;
                    musicToggle.classList.remove("visible");
                })
                .catch(() => {});
        }
    }, { once: true });
}

musicToggle?.addEventListener("click", () => {
    if (bgMusic.paused) {
        bgMusic.play();
        musicStarted = true;
        musicToggle.classList.remove("visible");
        musicToggle.classList.add("playing");
    } else {
        bgMusic.pause();
        musicToggle.classList.add("visible");
        musicToggle.classList.remove("playing");
    }
});

// ============================================================
// تأثيرات بصرية
// ============================================================
function startEffect(type, color) {
    const count = type === "hearts" ? 12 : 20;
    for (let i = 0; i < count; i++) {
        setTimeout(() => createParticle(type, color), i * 400);
    }
    setInterval(() => createParticle(type, color), 1500);
}

function createParticle(type, color) {
    const el = document.createElement("div");

    if (type === "hearts") {
        el.className = "heart";
        el.innerHTML = "❤";
        el.style.left = Math.random() * 100 + "%";
        el.style.color = Math.random() > 0.5 ? "#ec4899" : "#f43f5e";
        el.style.animationDuration = (6 + Math.random() * 4) + "s";
        el.style.fontSize = (14 + Math.random() * 14) + "px";
    } else if (type === "confetti") {
        el.className = "confetti";
        el.style.left = Math.random() * 100 + "%";
        el.style.background = pickColor(color);
        el.style.animationDuration = (3 + Math.random() * 3) + "s";
        el.style.width = (6 + Math.random() * 8) + "px";
        el.style.height = (6 + Math.random() * 8) + "px";
        el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
}

function pickColor(base) {
    const colors = [base, "#e2b714", "#f43f5e", "#3b82f6", "#10b981", "#a855f7"];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================================
// دوال مساعدة
// ============================================================
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    } catch { return dateStr; }
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ===== بدء التشغيل =====
init();
