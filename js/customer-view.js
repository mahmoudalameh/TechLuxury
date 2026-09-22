import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    base64UrlToBytes,
    deriveFinalKey,
    decryptText,
    decryptFile
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
const db = getFirestore(app);

// ===== أنواع الكروت =====
const CARD_TYPES = {
    gift: { label: "كرت هدية", icon: "fa-gift", color: "#ec4899", effect: "hearts" },
    memory_book: { label: "كتاب ذكريات", icon: "fa-book-open", color: "#e2b714", effect: null },
    business_card: { label: "بطاقة عمل", icon: "fa-id-card", color: "#3b82f6", effect: null },
    pet_card: { label: "بطاقة حيوانات", icon: "fa-paw", color: "#22c55e", effect: null }
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
let currentEncryptionKey = null;
let currentCard = null;

// ===== الحصول على معرف الكرت =====
function getCardIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("card") || params.get("c");
}

// ============================================================
// 🚀 بدء التشغيل
// ============================================================
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
        currentCard = card;

        if (!card.ownerId) {
            showError("الكرت غير مُفعّل", "هذا الكرت لم يُربط بحساب بعد.");
            return;
        }

        // 🔐 إذا الكرت محمي → اطلب الإجابة السرية
        if (card.salt && card.protected) {
            showPasswordPrompt(card);
            return;
        }

        // كرت عام (بطاقة عمل / حيوانات) → اعرض مباشرة
        displayCard(card);
    } catch (error) {
        console.error(error);
        showError("خطأ", "حدث خطأ أثناء تحميل الكرت.");
    }
}

// ============================================================
// 🔐 شاشة السؤال السري
// ============================================================
function showPasswordPrompt(card) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";

    const securityQuestion = card.securityQuestion || "أدخل الإجابة السرية";

    viewContainer.innerHTML = `
        <div class="security-screen">
            <div class="security-box">
                <div class="lock-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <h3>🔐 الكرت محمي</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem;">
                    أجب على السؤال التالي لفتح الكرت
                </p>

                <div style="background:#0f172a;border:1px solid #2e374a;border-radius:10px;padding:18px;margin-bottom:20px;text-align:right;">
                    <div style="color:#94a3b8;font-size:0.75rem;margin-bottom:8px;">
                        <i class="fa-solid fa-question-circle"></i> السؤال:
                    </div>
                    <div style="color:#e2b714;font-weight:600;font-size:1.05rem;line-height:1.5;">
                        ${escapeHtml(securityQuestion)}
                    </div>
                </div>

                <input type="text" id="cardAnswerInput" placeholder="اكتب إجابتك هنا..." autocomplete="off">
                <button class="btn-unlock" id="btnUnlockCard">
                    <i class="fa-solid fa-unlock"></i> فتح الكرت
                </button>
                <p class="error-msg" id="cardAnswerError">❌ الإجابة غير صحيحة</p>
            </div>
        </div>
    `;

    const input = document.getElementById("cardAnswerInput");
    const btn = document.getElementById("btnUnlockCard");
    const errorMsg = document.getElementById("cardAnswerError");

    const tryUnlock = async () => {
        const answer = input.value.trim();
        if (!answer) {
            errorMsg.textContent = "الرجاء إدخال الإجابة";
            errorMsg.style.display = "block";
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';

        try {
            const salt = base64UrlToBytes(card.salt);
            const key = await deriveFinalKey(answer, null, salt);
            currentEncryptionKey = key;

            let testPassed = false;

            if (card.message && typeof card.message === "object" && card.message.ciphertext) {
                try {
                    await decryptText(card.message.ciphertext, card.message.iv, key);
                    testPassed = true;
                } catch (e) {}
            }

            if (!testPassed && card.images && card.images.length > 0 && typeof card.images[0] === "object") {
                try {
                    const imgData = card.images[0];
                    const res = await fetch(imgData.url);
                    const blob = await res.blob();
                    await decryptFile(blob, base64UrlToBytes(imgData.iv), key);
                    testPassed = true;
                } catch (e) {}
            }

            if (!testPassed && card.events && card.events.length > 0 && card.events[0].message && typeof card.events[0].message === "object") {
                try {
                    await decryptText(card.events[0].message.ciphertext, card.events[0].message.iv, key);
                    testPassed = true;
                } catch (e) {}
            }

            if (!testPassed && (!card.message || typeof card.message === "string")) {
                testPassed = true;
            }

            if (testPassed) {
                await displayCard(card, key);
            } else {
                errorMsg.textContent = "❌ الإجابة غير صحيحة";
                errorMsg.style.display = "block";
                input.value = "";
                input.focus();
            }
        } catch (err) {
            console.error(err);
            errorMsg.textContent = "❌ الإجابة غير صحيحة";
            errorMsg.style.display = "block";
            input.value = "";
            input.focus();
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-unlock"></i> فتح الكرت';
        }
    };

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keypress", (e) => { if (e.key === "Enter") tryUnlock(); });
    input.focus();
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

// ============================================================
// 🎨 عرض الكرت
// ============================================================
async function displayCard(card, key = null) {
    loadingScreen.classList.add("hidden");
    viewContainer.style.display = "block";

    if (key) currentEncryptionKey = key;

    const typeInfo = CARD_TYPES[card.type] || CARD_TYPES.gift;
    document.documentElement.style.setProperty("--accent", typeInfo.color);

    if (card.bgMusicUrl) startMusic(card.bgMusicUrl);
    if (typeInfo.effect) startEffect(typeInfo.effect, typeInfo.color);

    if (card.type === "memory_book") {
        await renderMemoryBook(card, typeInfo);
    } else if (card.type === "business_card") {
        await renderBusinessCard(card, typeInfo);
    } else if (card.type === "pet_card") {
        await renderPetCard(card, typeInfo);
    } else {
        await renderGiftCard(card, typeInfo);
    }

    document.title = card.title || "ذِكـرى";
}

// ===== تحميل صورة مشفرة =====
async function loadEncryptedImage(imageData) {
    if (typeof imageData === "string") return imageData;

    if (imageData && imageData.encrypted && imageData.url) {
        if (!currentEncryptionKey) return null;
        try {
            const res = await fetch(imageData.url);
            const encryptedBlob = await res.blob();
            const iv = base64UrlToBytes(imageData.iv);
            const decryptedBlob = await decryptFile(encryptedBlob, iv, currentEncryptionKey);
            return URL.createObjectURL(decryptedBlob);
        } catch (e) {
            console.error("فشل فك تشفير صورة:", e);
            return null;
        }
    }
    return null;
}

// ============================================================
// 🎁 كرت الهدية
// ============================================================
async function renderGiftCard(card, typeInfo) {
    const imagesData = card.images || [];
    const decryptedImages = [];
    for (const img of imagesData) {
        const url = await loadEncryptedImage(img);
        if (url) decryptedImages.push(url);
    }

    let messageText = "";
    if (card.message) {
        if (typeof card.message === "string") {
            messageText = card.message;
        } else if (card.message.ciphertext && currentEncryptionKey) {
            try {
                messageText = await decryptText(card.message.ciphertext, card.message.iv, currentEncryptionKey);
            } catch (e) {
                messageText = "⚠️ تعذّر فك التشفير";
            }
        }
    }

    // 🎬 فك تشفير الفيديو
    let videoUrl = null;

    if (card.videoUrl && typeof card.videoUrl === "string") {
        videoUrl = card.videoUrl;
    }
    else if (card.video && typeof card.video === "object" && card.video.encrypted && card.video.url) {
        if (currentEncryptionKey) {
            try {
                console.log("🎬 تحميل فيديو مشفر...");
                const res = await fetch(card.video.url);
                if (!res.ok) throw new Error("فشل تحميل الفيديو: " + res.status);

                const encryptedBlob = await res.blob();
                console.log("📦 حجم الملف المشفر:", encryptedBlob.size, "بايت");

                const iv = base64UrlToBytes(card.video.iv);
                const decryptedBlob = await decryptFile(encryptedBlob, iv, currentEncryptionKey);
                videoUrl = URL.createObjectURL(decryptedBlob);
                console.log("✅ تم فك تشفير الفيديو:", decryptedBlob.size, "بايت");
            } catch (e) {
                console.error("❌ فشل فك تشفير الفيديو:", e);
            }
        }
    }
    else if (card.video && typeof card.video === "string") {
        videoUrl = card.video;
    }

    // ✨ بناء واجهة الألبوم (يدعم المصغرات عند الصور الكثيرة)
    const totalImages = decryptedImages.length;
    const useThumbnails = totalImages > 4;

    const albumHtml = totalImages > 0 ? `
        <h3 class="section-title"><i class="fa-solid fa-images"></i> ألبوم الصور (${totalImages})</h3>
        <div class="album-container" id="albumContainer">
            <div class="album-viewport" id="albumViewport">
                <div class="album-top-bar">
                    <div class="album-counter" id="albumCounter">
                        <i class="fa-solid fa-image"></i>
                        <span>1 / ${totalImages}</span>
                    </div>
                    ${totalImages > 1 ? `
                        <button type="button" class="album-expand-btn" id="albumExpandBtn" aria-label="عرض كامل">
                            <i class="fa-solid fa-expand"></i>
                        </button>
                    ` : ""}
                </div>
                ${decryptedImages.map((url, i) => `
                    <div class="album-slide ${i === 0 ? "active" : ""}" data-slide="${i}">
                        <img src="${url}" alt="صورة ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" draggable="false">
                    </div>
                `).join("")}
                ${totalImages > 1 ? `
                    <button class="album-nav-btn prev" id="albumPrev" aria-label="السابق"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="album-nav-btn next" id="albumNext" aria-label="التالي"><i class="fa-solid fa-chevron-left"></i></button>
                ` : ""}
            </div>
            ${totalImages > 1 ? (
                useThumbnails ? `
                    <div class="album-thumbs" id="albumThumbs">
                        ${decryptedImages.map((url, i) => `
                            <button type="button" class="album-thumb ${i === 0 ? "active" : ""}" data-thumb="${i}" aria-label="صورة ${i + 1}">
                                <img src="${url}" alt="" loading="lazy">
                            </button>
                        `).join("")}
                    </div>
                    <div class="album-progress">
                        <div class="album-progress-track">
                            <div class="album-progress-fill" id="albumProgressFill" style="width: ${100 / totalImages}%"></div>
                        </div>
                        <div class="album-progress-label" id="albumProgressLabel">1 / ${totalImages}</div>
                    </div>
                ` : `
                    <div class="album-dots" id="albumDots">
                        ${decryptedImages.map((_, i) => `<button class="album-dot ${i === 0 ? "active" : ""}" data-dot="${i}"></button>`).join("")}
                    </div>
                `
            ) : ""}
        </div>
    ` : "";

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

        ${messageText ? `<div class="message-box"><p>${escapeHtml(messageText)}</p></div>` : ""}

        ${albumHtml}

        ${videoUrl ? `
            <h3 class="section-title"><i class="fa-solid fa-video"></i> الفيديو</h3>
            <div class="video-wrapper">
                <video controls playsinline preload="metadata"><source src="${videoUrl}" type="video/mp4"></video>
            </div>
        ` : ""}
    `;

    currentImages = decryptedImages;
    setupAlbum();
}

// ============================================================
// 📖 كتاب الذكريات
// ============================================================
async function renderMemoryBook(card, typeInfo) {
    bookPages = [];
    const rawEvents = card.events || [];

    for (const evt of rawEvents) {
        let message = "";
        if (evt.message) {
            if (typeof evt.message === "string") {
                message = evt.message;
            } else if (evt.message.ciphertext && currentEncryptionKey) {
                try {
                    message = await decryptText(evt.message.ciphertext, evt.message.iv, currentEncryptionKey);
                } catch (e) {
                    message = "⚠️ تعذّر فك التشفير";
                }
            }
        }

        const decryptedImages = [];
        for (const img of (evt.images || [])) {
            const url = await loadEncryptedImage(img);
            if (url) decryptedImages.push(url);
        }

        let videoUrl = null;
        if (evt.video) {
            if (typeof evt.video === "string") {
                videoUrl = evt.video;
            } else if (evt.video.encrypted && currentEncryptionKey) {
                try {
                    const res = await fetch(evt.video.url);
                    const encryptedBlob = await res.blob();
                    const iv = base64UrlToBytes(evt.video.iv);
                    const decryptedBlob = await decryptFile(encryptedBlob, iv, currentEncryptionKey);
                    videoUrl = URL.createObjectURL(decryptedBlob);
                } catch (e) {}
            }
        }

        bookPages.push({
            id: evt.id, emoji: evt.emoji, title: evt.title, date: evt.date,
            message: message, images: decryptedImages, videoUrl: videoUrl
        });
    }

    currentBookPage = 0;

    if (bookPages.length === 0) {
        viewContainer.innerHTML = `
            <div class="error-screen">
                <i class="fa-solid fa-book" style="color: var(--accent);"></i>
                <h2>الكتاب فارغ</h2>
            </div>
        `;
        return;
    }

    viewContainer.innerHTML = `
        <div class="book-container">
            <div class="book-cover">
                <h1>📖 ${escapeHtml(card.title) || "كتاب الذكريات"}</h1>
                <p class="book-subtitle">${bookPages.length} صفحة</p>
            </div>
            <div class="book-pages" id="bookPages">
                ${bookPages.map((evt, i) => renderBookPage(evt, i)).join("")}
            </div>
            <div class="book-controls">
                <button class="book-nav-btn" id="bookPrev" disabled><i class="fa-solid fa-chevron-right"></i> السابق</button>
                <div class="book-page-indicator">صفحة <strong id="currentPageNum">1</strong> من ${bookPages.length}</div>
                <button class="book-nav-btn" id="bookNext" ${bookPages.length <= 1 ? "disabled" : ""}>التالي <i class="fa-solid fa-chevron-left"></i></button>
            </div>
            <div class="book-dots" id="bookDots">
                ${bookPages.map((_, i) => `<button class="book-dot ${i === 0 ? "active" : ""}" data-page="${i}"></button>`).join("")}
            </div>
        </div>
    `;

    setupBookNavigation();
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
            ${images.length > 0 ? `<div class="page-gallery">${images.map(url => `<img src="${url}" loading="lazy">`).join("")}</div>` : ""}
            ${evt.videoUrl ? `<div class="page-video"><video controls playsinline preload="metadata"><source src="${evt.videoUrl}" type="video/mp4"></video></div>` : ""}
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

    document.querySelectorAll(".book-page").forEach(p => p.classList.remove("active"));
    const activePage = document.querySelector(`.book-page[data-page="${pageNum}"]`);
    if (activePage) activePage.classList.add("active");

    const pageNumEl = document.getElementById("currentPageNum");
    if (pageNumEl) pageNumEl.textContent = pageNum + 1;

    document.querySelectorAll(".book-dot").forEach((d, i) => {
        d.classList.toggle("active", i === pageNum);
    });

    const prevBtn = document.getElementById("bookPrev");
    const nextBtn = document.getElementById("bookNext");
    if (prevBtn) prevBtn.disabled = pageNum === 0;
    if (nextBtn) nextBtn.disabled = pageNum === bookPages.length - 1;

    const pageImages = bookPages[pageNum].images || [];
    currentImages = pageImages;
    setupGallery();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 💼 بطاقة العمل
// ============================================================
function toArray(value) {
    if (Array.isArray(value)) return value.filter(v => v && String(v).trim() !== "");
    if (value && typeof value === "string" && value.trim() !== "") return [value];
    return [];
}

function cleanInstagram(u) {
    return String(u).replace(/^@/, "").replace(/^.*instagram\.com\//, "").replace(/\/$/, "").trim();
}
function cleanPhone(p) { return String(p).replace(/[^\d+]/g, ""); }
function cleanWebsite(u) {
    let s = String(u).trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return s;
}
function displayWebsite(u) { return String(u).replace(/^https?:\/\//i, "").replace(/\/$/, ""); }

async function renderBusinessCard(card, typeInfo) {
    const phones = toArray(card.phone);
    const websites = toArray(card.website);
    const instagrams = toArray(card.instagram);
    const facebook = toArray(card.facebook);
    const linkedin = toArray(card.linkedin);
    const emails = toArray(card.email);

    const logoUrl = card.logoUrl || "";

    const contacts = [];
    phones.forEach(num => {
        contacts.push(`<a href="tel:${cleanPhone(num)}" class="biz-contact-btn"><i class="fa-solid fa-phone"></i> ${escapeHtml(num)}</a>`);
    });
    emails.forEach(mail => {
        contacts.push(`<a href="mailto:${mail}" class="biz-contact-btn"><i class="fa-solid fa-envelope"></i> راسلني</a>`);
    });
    phones.forEach(num => {
        const waNum = cleanPhone(num).replace(/^\+/, "");
        contacts.push(`<a href="https://wa.me/${waNum}" target="_blank" class="biz-contact-btn full-width"><i class="fa-brands fa-whatsapp"></i> واتساب: ${escapeHtml(num)}</a>`);
    });
    websites.forEach(site => {
        contacts.push(`<a href="${cleanWebsite(site)}" target="_blank" class="biz-contact-btn full-width"><i class="fa-solid fa-globe"></i> ${escapeHtml(displayWebsite(site))}</a>`);
    });
    if (card.address) {
        contacts.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(card.address)}" target="_blank" class="biz-contact-btn full-width"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(card.address)}</a>`);
    }

    const socials = [];
    instagrams.forEach(acc => {
        socials.push(`<a href="https://instagram.com/${cleanInstagram(acc)}" target="_blank" class="biz-social-btn instagram"><i class="fa-brands fa-instagram"></i></a>`);
    });
    facebook.forEach(fb => {
        socials.push(`<a href="https://${String(fb).replace(/^https?:\/\//i, "")}" target="_blank" class="biz-social-btn facebook"><i class="fa-brands fa-facebook-f"></i></a>`);
    });
    linkedin.forEach(li => {
        socials.push(`<a href="https://${String(li).replace(/^https?:\/\//i, "")}" target="_blank" class="biz-social-btn linkedin"><i class="fa-brands fa-linkedin-in"></i></a>`);
    });
    websites.forEach(site => {
        socials.push(`<a href="${cleanWebsite(site)}" target="_blank" class="biz-social-btn website"><i class="fa-solid fa-globe"></i></a>`);
    });

    viewContainer.innerHTML = `
        <div class="biz-card">
            <div class="biz-logo-wrapper">
                ${logoUrl
                    ? `<img src="${logoUrl}" class="biz-logo" alt="${escapeHtml(card.name) || "Logo"}">`
                    : `<div class="biz-logo-placeholder"><i class="fa-solid fa-user"></i></div>`
                }
            </div>
            <h1 class="biz-name">${escapeHtml(card.name) || "بطاقة عمل"}</h1>
            ${card.jobTitle ? `<p class="biz-job">${escapeHtml(card.jobTitle)}</p>` : ""}
            ${card.company ? `<p class="biz-company">${escapeHtml(card.company)}</p>` : ""}
            ${card.bio ? `<div class="biz-section"><div class="biz-section-title"><i class="fa-solid fa-user"></i> نبذة</div><div class="biz-section-content">${escapeHtml(card.bio)}</div></div>` : ""}
            ${card.services ? `<div class="biz-section"><div class="biz-section-title"><i class="fa-solid fa-briefcase"></i> الخدمات</div><div class="biz-section-content">${escapeHtml(card.services)}</div></div>` : ""}
            ${contacts.length > 0 ? `<div class="biz-contacts">${contacts.join("")}</div>` : ""}
            ${socials.length > 0 ? `<div class="biz-socials">${socials.join("")}</div>` : ""}
        </div>
    `;
}

// ============================================================
// 🐾 بطاقة الحيوانات
// ============================================================
async function renderPetCard(card, typeInfo) {
    const petPhoto = card.petPhoto || "";

    const typeEmoji = {
        "قط": "🐱", "كلب": "🐶", "طير": "🐦", "أرنب": "🐰",
        "سمكة": "🐠", "سلحفاة": "🐢", "هامستر": "🐹", "آخر": "🐾"
    };

    const petEmoji = typeEmoji[card.petType] || "🐾";

    const infoItems = [];
    if (card.petBreed) infoItems.push({ label: "🧬 السلالة", value: card.petBreed });
    if (card.petAge) infoItems.push({ label: "🎂 العمر", value: card.petAge });
    if (card.petWeight) infoItems.push({ label: "⚖️ الوزن", value: card.petWeight });
    if (card.petColor) infoItems.push({ label: "🎨 اللون", value: card.petColor });

    const infoGridHtml = infoItems.length > 0 ? `
        <div class="pet-info-grid">
            ${infoItems.map(item => `
                <div class="pet-info-item">
                    <div class="pet-info-label">${item.label}</div>
                    <div class="pet-info-value">${escapeHtml(item.value)}</div>
                </div>
            `).join("")}
        </div>
    ` : "";

    const notesHtml = card.petNotes ? `
        <div class="pet-notes-box">
            <div class="title"><i class="fa-solid fa-triangle-exclamation"></i> ملاحظات مهمة</div>
            <div class="content">${escapeHtml(card.petNotes)}</div>
        </div>
    ` : "";

    const vaccinationHtml = card.petVaccinations ? `
        <div class="pet-info-item" style="margin-top: 15px; text-align: right;">
            <div class="pet-info-label">💉 آخر تطعيم</div>
            <div class="pet-info-value">${formatDate(card.petVaccinations)}</div>
        </div>
    ` : "";

    const phoneClean = cleanPhone(card.petOwnerPhone || "");
    const contactHtml = card.petOwnerPhone ? `
        <div class="pet-contact-box">
            <div class="title"><i class="fa-solid fa-phone"></i> إذا وجدت هذا الحيوان، اتصل بمالكه</div>
            ${card.petOwnerName ? `<div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 10px;">${escapeHtml(card.petOwnerName)}</div>` : ""}
            <a href="tel:${phoneClean}" class="pet-contact-btn">
                <i class="fa-solid fa-phone"></i> ${escapeHtml(card.petOwnerPhone)}
            </a>
            ${card.petAddress ? `
                <a href="https://maps.google.com/?q=${encodeURIComponent(card.petAddress)}" target="_blank" class="pet-contact-btn" style="background: #0f172a; color: #fff; border: 1px solid var(--border-color);">
                    <i class="fa-solid fa-location-dot"></i> ${escapeHtml(card.petAddress)}
                </a>
            ` : ""}
        </div>
    ` : "";

    viewContainer.innerHTML = `
        <div class="pet-card">
            <div class="pet-photo-wrapper">
                ${petPhoto
                    ? `<img src="${petPhoto}" class="pet-photo" alt="${escapeHtml(card.petName) || "Pet"}">`
                    : `<div class="pet-photo-placeholder">${petEmoji}</div>`
                }
            </div>
            <h1 class="pet-name">${escapeHtml(card.petName) || "حيوان أليف"}</h1>
            <p class="pet-type">${petEmoji} ${escapeHtml(card.petType) || "حيوان"}</p>

            ${infoGridHtml}
            ${vaccinationHtml}
            ${notesHtml}
            ${contactHtml}
        </div>
    `;
}

// ============================================================
// 🖼️ الألبوم — مع دعم المصغرات وشريط التقدم
// ============================================================
function setupAlbum() {
    const viewport = document.getElementById("albumViewport");
    if (!viewport) return;

    const slides = viewport.querySelectorAll(".album-slide");
    const dots = document.querySelectorAll(".album-dot");
    const thumbs = document.querySelectorAll(".album-thumb");
    const progressFill = document.getElementById("albumProgressFill");
    const progressLabel = document.getElementById("albumProgressLabel");
    const counter = document.getElementById("albumCounter");
    const prevBtn = document.getElementById("albumPrev");
    const nextBtn = document.getElementById("albumNext");
    const expandBtn = document.getElementById("albumExpandBtn");

    let currentSlide = 0;
    let touchStartX = 0, touchEndX = 0, isDragging = false;
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    function updateCounter(index) {
        if (!counter) return;
        const span = counter.querySelector("span");
        if (span) span.textContent = `${index + 1} / ${totalSlides}`;
    }

    function goToSlide(index) {
        if (index < 0) index = 0;
        if (index >= totalSlides) index = totalSlides - 1;

        slides.forEach((s, i) => s.classList.toggle("active", i === index));
        dots.forEach((d, i) => d.classList.toggle("active", i === index));
        thumbs.forEach((t, i) => t.classList.toggle("active", i === index));

        updateCounter(index);
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === totalSlides - 1;

        // ✨ شريط التقدم
        if (progressFill) progressFill.style.width = ((index + 1) / totalSlides * 100) + "%";
        if (progressLabel) progressLabel.textContent = `${index + 1} / ${totalSlides}`;

        // ✨ Auto-scroll المصغرة النشطة إلى المنتصف
        const activeThumb = document.querySelector(`.album-thumb[data-thumb="${index}"]`);
        if (activeThumb && activeThumb.scrollIntoView) {
            activeThumb.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        }

        currentSlide = index;
    }

    prevBtn?.addEventListener("click", () => goToSlide(currentSlide - 1));
    nextBtn?.addEventListener("click", () => goToSlide(currentSlide + 1));

    dots.forEach(dot => dot.addEventListener("click", () => goToSlide(parseInt(dot.dataset.dot))));
    thumbs.forEach(thumb => thumb.addEventListener("click", () => goToSlide(parseInt(thumb.dataset.thumb))));

    // ✨ زر التوسيع (يفتح Lightbox للصورة الحالية)
    expandBtn?.addEventListener("click", () => {
        openLightboxFromAlbum(currentSlide);
    });

    // ✨ دعم لوحة المفاتيح
    document.addEventListener("keydown", (e) => {
        if (lightbox?.classList.contains("active")) return;
        if (!document.getElementById("albumViewport")) return;
        if (e.key === "ArrowRight") goToSlide(currentSlide - 1);
        if (e.key === "ArrowLeft") goToSlide(currentSlide + 1);
    });

    // ✨ دعم اللمس
    viewport.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        isDragging = true;
    }, { passive: true });

    viewport.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        touchEndX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener("touchend", () => {
        if (!isDragging) return;
        const d = touchStartX - touchEndX;
        if (Math.abs(d) >= 50) {
            if (d > 50) goToSlide(currentSlide + 1);
            else goToSlide(currentSlide - 1);
        }
        isDragging = false;
    });

    // ✨ دعم الماوس
    let mouseStartX = 0, isMouseDown = false;
    viewport.addEventListener("mousedown", (e) => { mouseStartX = e.screenX; isMouseDown = true; });
    viewport.addEventListener("mouseup", (e) => {
        if (!isMouseDown) return;
        const d = mouseStartX - e.screenX;
        if (Math.abs(d) >= 50) {
            if (d > 0) goToSlide(currentSlide + 1);
            else goToSlide(currentSlide - 1);
        }
        isMouseDown = false;
    });
    viewport.addEventListener("mouseleave", () => { isMouseDown = false; });

    // ✨ فتح Lightbox عند النقر على الصورة
    slides.forEach((slide, idx) => {
        const img = slide.querySelector("img");
        img?.addEventListener("click", () => {
            if (isDragging) return;
            openLightboxFromAlbum(idx);
        });
    });

    goToSlide(0);
}

function openLightboxFromAlbum(index) {
    const imgs = document.querySelectorAll(".album-slide img");
    currentImages = Array.from(imgs).map(img => img.src);
    currentImageIndex = index;
    openLightbox();
}

// ============================================================
// Lightbox
// ============================================================
function setupGallery() {
    document.querySelectorAll(".page-gallery img").forEach(img => {
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
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    lightbox.classList.remove("active");
    lightbox.setAttribute("aria-hidden", "true");
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
lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") nextImage();
    if (e.key === "ArrowRight") prevImage();
});

// ============================================================
// 🎵 الموسيقى
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
// 🎨 تأثيرات
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
