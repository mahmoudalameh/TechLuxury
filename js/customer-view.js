import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

// ===== أنواع الكروت =====
const CARD_TYPES = {
    birthday: {
        label: "عيد ميلاد",
        icon: "fa-birthday-cake",
        color: "#ec4899",
        effect: "confetti",
        greeting: "🎂 كل عام وأنت بخير 🎂"
    },
    anniversary: {
        label: "ذكرى زواج",
        icon: "fa-ring",
        color: "#e2b714",
        effect: "hearts",
        greeting: "💍 ذكرى سعيدة 💍"
    },
    graduation: {
        label: "تخرج",
        icon: "fa-graduation-cap",
        color: "#3b82f6",
        effect: "confetti",
        greeting: "🎓 مبروك التخرج 🎓"
    },
    mothers_day: {
        label: "عيد الأم",
        icon: "fa-heart",
        color: "#f43f5e",
        effect: "hearts",
        greeting: "💐 إلى أغلى إنسانة 💐"
    },
    ramadan: {
        label: "رمضان / عيد",
        icon: "fa-moon",
        color: "#a855f7",
        effect: "stars",
        greeting: "🌙 كل عام وأنتم بخير 🌙"
    },
    photo_album: {
        label: "ألبوم صور",
        icon: "fa-images",
        color: "#10b981",
        effect: null,
        greeting: "📸 ذكريات لا تُنسى 📸"
    },
    video_card: {
        label: "كرت فيديو",
        icon: "fa-video",
        color: "#f97316",
        effect: null,
        greeting: "🎬 شاهد الذكرى 🎬"
    },
    free: {
        label: "مناسبة حرة",
        icon: "fa-gift",
        color: "#8b5cf6",
        effect: "confetti",
        greeting: "🎁 ذكرى خاصة 🎁"
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

// ===== الحصول على معرف الكرت من الرابط =====
function getCardIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("card") || params.get("c");
}

// ===== بدء التشغيل =====
async function init() {
    const cardId = getCardIdFromURL();

    if (!cardId) {
        showError("لم يتم تحديد الكرت", "الرجاء مسح رمز QR الموجود على القلادة للوصول إلى الذكرى.");
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

        // 🔒 التحقق من سؤال الأمان
        if (card.securityQuestion && card.securityAnswer) {
            showSecurityScreen(card);
        } else {
            displayCard(card);
        }

    } catch (error) {
        console.error(error);
        showError("خطأ", "حدث خطأ أثناء تحميل الكرت. يرجى المحاولة لاحقاً.");
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
                    للإجابة على السؤال وفتح الذكرى
                </p>
                <div class="question">${card.securityQuestion}</div>
                <input type="text" id="securityAnswerInput" placeholder="اكتب إجابتك هنا..." autocomplete="off">
                <button class="btn-unlock" id="btnUnlock">
                    <i class="fa-solid fa-unlock"></i> فتح الذكرى
                </button>
                <p class="error-msg" id="securityError">❌ الإجابة غير صحيحة، حاول مرة أخرى</p>
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
            // اهتزاز
            input.style.animation = "shake 0.3s";
            setTimeout(() => input.style.animation = "", 300);
        }
    };

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") tryUnlock();
    });

    input.focus();
}

// ===== عرض الكرت =====
function displayCard(card) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";

    const typeInfo = CARD_TYPES[card.type] || CARD_TYPES.free;
    const accentColor = typeInfo.color;

    // تحديث لون النظام حسب النوع
    document.documentElement.style.setProperty("--accent-gold", accentColor);

    // بناء الصفحة
    viewContainer.innerHTML = `
        <header class="card-header">
            <div class="card-icon-main" style="color: ${accentColor};">
                <i class="fa-solid ${typeInfo.icon}"></i>
            </div>
            <h1>${card.title || typeInfo.greeting}</h1>
            <div class="occasion-label">
                <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.label}
            </div>
            ${card.date ? `<p class="card-date"><i class="fa-solid fa-calendar"></i> ${formatDate(card.date)}</p>` : ""}
        </header>

        ${card.message ? `
            <div class="message-box">
                <p>${escapeHtml(card.message)}</p>
            </div>
        ` : ""}

        ${card.images && card.images.length > 0 ? `
            <h3 class="section-title">
                <i class="fa-solid fa-images"></i> معرض الصور (${card.images.length})
            </h3>
            <div class="gallery ${card.type === "photo_album" ? "single-column" : ""}" id="gallery">
                ${card.images.map((url, i) => `
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
                    متصفحك لا يدعم تشغيل الفيديو.
                </video>
            </div>
        ` : ""}
    `;

    // تفعيل الصور
    currentImages = card.images || [];
    setupGallery();

    // 🎵 تشغيل الموسيقى
    if (card.bgMusicUrl) {
        startMusic(card.bgMusicUrl);
    }

    // ✨ تأثيرات بصرية حسب النوع
    if (typeInfo.effect) {
        startEffect(typeInfo.effect, accentColor);
    }

    // تحديث عنوان الصفحة
    document.title = card.title || "ذِكـرى";
}

// ===== معالجة الصور =====
function setupGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    gallery.querySelectorAll("img").forEach(img => {
        img.addEventListener("click", () => {
            currentImageIndex = parseInt(img.dataset.index);
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

// ===== تشغيل الموسيقى =====
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
                // المتصفح منع التشغيل التلقائي → أظهر الزر
                musicToggle.classList.add("visible");
            });
    };

    // حاول فوراً
    tryPlay();

    // إذا فشل، ابدأ عند أول نقرة على الصفحة
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

// زر تشغيل الموسيقى
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

// ===== تأثيرات بصرية =====
function startEffect(type, color) {
    const count = type === "hearts" ? 12 : 20;

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            createParticle(type, color);
        }, i * 400);
    }

    // استمرار التأثير
    setInterval(() => {
        createParticle(type, color);
    }, 1500);
}

function createParticle(type, color) {
    const el = document.createElement("div");

    if (type === "confetti") {
        el.className = "confetti";
        el.style.left = Math.random() * 100 + "%";
        el.style.background = pickColor(color);
        el.style.animationDuration = (3 + Math.random() * 3) + "s";
        el.style.width = (6 + Math.random() * 8) + "px";
        el.style.height = (6 + Math.random() * 8) + "px";
        el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    } else if (type === "hearts") {
        el.className = "heart";
        el.innerHTML = "❤";
        el.style.left = Math.random() * 100 + "%";
        el.style.color = Math.random() > 0.5 ? "#ec4899" : "#f43f5e";
        el.style.animationDuration = (6 + Math.random() * 4) + "s";
        el.style.fontSize = (14 + Math.random() * 14) + "px";
    } else if (type === "stars") {
        el.className = "star";
        el.innerHTML = "★";
        el.style.left = Math.random() * 100 + "%";
        el.style.color = Math.random() > 0.5 ? "#a855f7" : "#e2b714";
        el.style.animationDuration = (4 + Math.random() * 3) + "s";
        el.style.fontSize = (12 + Math.random() * 10) + "px";
    }

    document.body.appendChild(el);

    // حذف بعد انتهاء الحركة
    setTimeout(() => el.remove(), 8000);
}

function pickColor(base) {
    const colors = [base, "#e2b714", "#f43f5e", "#3b82f6", "#10b981", "#a855f7"];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ===== دوال مساعدة =====
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const options = { year: "numeric", month: "long", day: "numeric" };
        return date.toLocaleDateString("ar-EG", options);
    } catch {
        return dateStr;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ===== بدء التشغيل =====
init();
