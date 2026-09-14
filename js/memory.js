// ==========================================
// 1. استيراد حزم Firebase (v10+ Modular SDK)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getFirestore, collection, addDoc, doc, getDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// ==========================================
// 2. إعدادات مشروع Firebase (TechLuxury)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBZcGZQpBZi6RwMeBnL4UcdrBQyZHXsLWY",
  authDomain: "techluxury-4b854.firebaseapp.com",
  projectId: "techluxury-4b854",
  storageBucket: "techluxury-4b854.firebasestorage.app",
  messagingSenderId: "1043863547919",
  appId: "1:1043863547919:web:46bd7c74f0fbeb2702b37a",
  measurementId: "G-EZJWPY4Q2Z"
};

// تهيئة خدمات Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 3. تحديد عناصر DOM
// ==========================================
const setupSection = document.getElementById('setupSection');
const successSection = document.getElementById('successSection');
const lockSection = document.getElementById('lockSection');
const displaySection = document.getElementById('displaySection');

const memoryForm = document.getElementById('memoryForm');
const submitBtn = document.getElementById('submitBtn');
const addOccasionBtn = document.getElementById('addOccasionBtn');
const occasionsContainer = document.getElementById('occasionsContainer');

const questionTypeSelect = document.getElementById('questionTypeSelect');
const securityQuestionInput = document.getElementById('securityQuestionInput');

// عناصر القفل
const lockCardTitle = document.getElementById('lockCardTitle');
const displaySecurityQuestion = document.getElementById('displaySecurityQuestion');
const userAnswerInput = document.getElementById('userAnswerInput');
const unlockBtn = document.getElementById('unlockBtn');
const lockErrorMsg = document.getElementById('lockErrorMsg');

// عناصر العرض
const viewMainTitle = document.getElementById('viewMainTitle');
const bgAudio = document.getElementById('bgAudio');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const audioText = document.getElementById('audioText');
const occasionsTabs = document.getElementById('occasionsTabs');

const occTitleDisplay = document.getElementById('occTitleDisplay');
const occMessageDisplay = document.getElementById('occMessageDisplay');
const galleryWrapper = document.getElementById('galleryWrapper');
const sliderTrack = document.getElementById('sliderTrack');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const videosContainerDisplay = document.getElementById('videosContainerDisplay');

const generatedCardUrl = document.getElementById('generatedCardUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const goToCardBtn = document.getElementById('goToCardBtn');

let currentSlideIndex = 0;
let totalSlides = 0;
let cardData = null;
let occasionCounter = 1;

// ==========================================
// 4. التغيير التلقائي لنص السؤال بحسب الاختيار
// ==========================================
questionTypeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === "تاريخ زواج") {
        securityQuestionInput.value = "ما هو تاريخ زواجنا؟";
    } else if (val === "تاريخ ميلاد") {
        securityQuestionInput.value = "ما هو تاريخ ميلادي؟";
    } else if (val === "أكلة مفضلة") {
        securityQuestionInput.value = "ما هي أكلتي المفضلة؟";
    } else if (val === "مكان التقينا فيه") {
        securityQuestionInput.value = "أين كان أول لقاء بيننا؟";
    } else {
        securityQuestionInput.value = "";
        securityQuestionInput.focus();
    }
});

// ==========================================
// 5. الفحص الرئيسي عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');

    if (cardId) {
        await loadLockedMemoryCard(cardId);
    } else {
        setupSection.style.display = 'block';
        displaySection.style.display = 'none';
        successSection.style.display = 'none';
        lockSection.style.display = 'none';
    }
});

// ==========================================
// 6. إضافة مناسبة جديدة للنموذج dynamic
// ==========================================
addOccasionBtn.addEventListener('click', () => {
    occasionCounter++;
    const occDiv = document.createElement('div');
    occDiv.className = 'occasion-item-box';
    occDiv.dataset.index = occasionCounter - 1;

    occDiv.innerHTML = `
        <div class="occasion-header">
            <span><i class="fa-solid fa-heart"></i> المناسبة #${occasionCounter}</span>
            <button type="button" class="btn-remove-occ" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="form-group">
            <label><i class="fa-solid fa-tag"></i> عنوان المناسبة</label>
            <input type="text" class="occ-title" placeholder="عنوان المناسبة..." required>
        </div>
        <div class="form-group">
            <label><i class="fa-solid fa-align-right"></i> رسالة / نص الذكرى لهذا الحدث</label>
            <textarea class="occ-message" rows="3" placeholder="اكتب مشاعرك وذكرياتك..." required></textarea>
        </div>
        <div class="form-group">
            <label><i class="fa-solid fa-images"></i> صور المناسبة</label>
            <div class="file-dropzone">
                <input type="file" class="occ-photos" multiple accept="image/*" required>
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>اضغط هنا لرفع صور هذه المناسبة</span>
            </div>
        </div>
        <div class="form-group">
            <label><i class="fa-solid fa-video"></i> رفع فيديوهات المناسبة (من جهازك/هاتفك)</label>
            <div class="file-dropzone">
                <input type="file" class="occ-videos" multiple accept="video/*">
                <i class="fa-solid fa-file-video"></i>
                <span>اضغط لرفع فيديو أو أكثر (MP4 / MOV)</span>
            </div>
        </div>
    `;

    occasionsContainer.appendChild(occDiv);

    occDiv.querySelector('.btn-remove-occ').addEventListener('click', () => {
        occDiv.remove();
    });
});

// ==========================================
// 7. حفظ البيانات لسؤال الأمان والمناسبات
// ==========================================
memoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري حفظ البيانات ورفع الملفات...`;

    try {
        const formData = new FormData(memoryForm);
        const cardTitle = formData.get('card_title');
        const securityQuestion = formData.get('security_question');
        // تحويل الإجابة للأحرف الصغيرة وإزالة المسافات الزائدة لسهولة المطابقة
        const securityAnswer = formData.get('security_answer').trim().toLowerCase();

        const audioInput = memoryForm.querySelector('input[name="bg_audio"]');
        const audioFile = audioInput.files[0];

        // 1. رفع الصوت
        let audioUrl = "";
        if (audioFile) {
            const audioRef = ref(storage, `memories/audio/${Date.now()}_${audioFile.name}`);
            const audioSnapshot = await uploadBytes(audioRef, audioFile);
            audioUrl = await getDownloadURL(audioSnapshot.ref);
        }

        // 2. معالجة المناسبات ورفع الصور والفيديوهات
        const occasionBoxes = document.querySelectorAll('.occasion-item-box');
        const occasionsData = [];

        for (let box of occasionBoxes) {
            const title = box.querySelector('.occ-title').value;
            const message = box.querySelector('.occ-message').value;
            const photoFiles = Array.from(box.querySelector('.occ-photos').files);
            const videoFiles = Array.from(box.querySelector('.occ-videos').files);

            const photoUrls = [];
            for (let file of photoFiles) {
                const photoRef = ref(storage, `memories/photos/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(photoRef, file);
                const url = await getDownloadURL(snapshot.ref);
                photoUrls.push(url);
            }

            const videoUrls = [];
            for (let file of videoFiles) {
                const videoRef = ref(storage, `memories/videos/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(videoRef, file);
                const url = await getDownloadURL(snapshot.ref);
                videoUrls.push(url);
            }

            occasionsData.push({
                title: title,
                message: message,
                photos: photoUrls,
                videos: videoUrls
            });
        }

        // 3. الحفظ في Firestore
        const docRef = await addDoc(collection(db, "cards"), {
            title: cardTitle,
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
            audioUrl: audioUrl,
            occasions: occasionsData,
            createdAt: serverTimestamp()
        });

        // 4. عرض رابط الـ NFC
        const cardUrl = `${window.location.origin}${window.location.pathname}?id=${docRef.id}`;
        setupSection.style.display = 'none';
        successSection.style.display = 'block';
        generatedCardUrl.value = cardUrl;

        copyUrlBtn.onclick = () => {
            navigator.clipboard.writeText(cardUrl);
            copyUrlBtn.innerHTML = `<i class="fa-solid fa-check"></i> تم النسخ بنجاح!`;
            setTimeout(() => {
                copyUrlBtn.innerHTML = `<i class="fa-solid fa-copy"></i> نسخ رابط القلادة`;
            }, 2000);
        };

        goToCardBtn.onclick = () => {
            window.location.href = cardUrl;
        };

    } catch (error) {
        console.error("خطأ أثناء الحفظ: ", error);
        alert("حدث خطأ أثناء رفع الملفات وحفظ الذكرى.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
});

// ==========================================
// 8. جلب بيانات الكرت وإظهار شاشة القفل أولاً
// ==========================================
async function loadLockedMemoryCard(cardId) {
    try {
        const docRef = doc(db, "cards", cardId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            cardData = docSnap.data();

            setupSection.style.display = 'none';
            successSection.style.display = 'none';
            displaySection.style.display = 'none';
            lockSection.style.display = 'block'; // إظهار شاشة القفل

            lockCardTitle.textContent = cardData.title || "ذكريات خاصة";
            displaySecurityQuestion.textContent = cardData.securityQuestion || "ما هي إجابة سؤال الأمان؟";

            // إضافة مستمع لضغط زر الفتح
            unlockBtn.onclick = () => verifyAnswer();
            userAnswerInput.onkeyup = (e) => {
                if (e.key === 'Enter') verifyAnswer();
            };

        } else {
            alert("لم يتم العثور على هذا الكرت!");
            window.location.href = window.location.pathname;
        }
    } catch (error) {
        console.error("خطأ في التحميل: ", error);
        alert("حدث خطأ أثناء تحميل الكرت.");
    }
}

// ==========================================
// 9. التحقق من صحة إجابة سؤال الأمان
// ==========================================
function verifyAnswer() {
    const inputVal = userAnswerInput.value.trim().toLowerCase();
    const correctVal = cardData.securityAnswer;

    if (inputVal === correctVal) {
        lockErrorMsg.style.display = 'none';
        lockSection.style.display = 'none';
        displaySection.style.display = 'block';

        // بدء عرض الكرت والتشغيل الصوتي
        initCardDisplay();
    } else {
        lockErrorMsg.style.display = 'block';
        userAnswerInput.style.borderColor = '#ef4444';
    }
}

// ==========================================
// 10. تشغيل وعرض الذكريات بعد فتح القفل
// ==========================================
function initCardDisplay() {
    viewMainTitle.textContent = cardData.title || "ذكريات خاصة";

    // تشغيل الأغنية
    if (cardData.audioUrl) {
        bgAudio.src = cardData.audioUrl;
        audioPlayerContainer.style.display = 'block';
        bgAudio.play().then(() => {
            audioText.textContent = "إيقاف الموسيقى المرافقة";
        }).catch(() => { });
    } else {
        audioPlayerContainer.style.display = 'none';
    }

    // عرض التبويبات والمناسبات
    if (cardData.occasions && cardData.occasions.length > 0) {
        renderTabs(cardData.occasions);
        showOccasionDetails(0);
    }
}

// ==========================================
// 11. بناء التبويبات وتفاصيل المناسبة والسلايدر
// ==========================================
function renderTabs(occasions) {
    occasionsTabs.innerHTML = '';
    occasions.forEach((occ, index) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
        btn.textContent = occ.title;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showOccasionDetails(index);
        });
        occasionsTabs.appendChild(btn);
    });
}

function showOccasionDetails(index) {
    const occ = cardData.occasions[index];
    occTitleDisplay.textContent = occ.title;
    occMessageDisplay.textContent = occ.message;

    // السلايدر
    if (occ.photos && occ.photos.length > 0) {
        galleryWrapper.style.display = 'block';
        renderSlider(occ.photos);
    } else {
        galleryWrapper.style.display = 'none';
    }

    // الفيديوهات المرفوعة
    videosContainerDisplay.innerHTML = '';
    if (occ.videos && occ.videos.length > 0) {
        occ.videos.forEach(videoUrl => {
            const videoWrap = document.createElement('div');
            videoWrap.className = 'video-wrapper';
            videoWrap.innerHTML = `
                <video src="${videoUrl}" controls playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover;"></video>
            `;
            videosContainerDisplay.appendChild(videoWrap);
        });
    }
}

toggleAudioBtn.addEventListener('click', () => {
    if (bgAudio.paused) {
        bgAudio.play();
        audioText.textContent = "إيقاف الموسيقى المرافقة";
    } else {
        bgAudio.pause();
        audioText.textContent = "تشغيل الموسيقى المرافقة";
    }
});

function renderSlider(photos) {
    sliderTrack.innerHTML = '';
    totalSlides = photos.length;
    currentSlideIndex = 0;

    photos.forEach((url, i) => {
        const slide = document.createElement('div');
        slide.className = `slide ${i === 0 ? 'active' : ''}`;
        slide.innerHTML = `<img src="${url}" alt="صورة ${i + 1}">`;
        sliderTrack.appendChild(slide);
    });

    prevBtn.style.display = totalSlides <= 1 ? 'none' : 'flex';
    nextBtn.style.display = totalSlides <= 1 ? 'none' : 'flex';
}

function showSlide(index) {
    const slides = document.querySelectorAll('.slide');
    slides.forEach(slide => slide.classList.remove('active'));
    if (slides[index]) slides[index].classList.add('active');
}

prevBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex - 1 + totalSlides) % totalSlides;
    showSlide(currentSlideIndex);
});

nextBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex + 1) % totalSlides;
    showSlide(currentSlideIndex);
});
