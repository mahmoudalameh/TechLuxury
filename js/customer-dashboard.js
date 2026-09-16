// بيانات Cloudinary الخاصة بك
const CLOUDINARY_CLOUD_NAME = "ضع_اسم_السحابة_هنا"; // Cloud Name من Dashboard
const CLOUDINARY_UPLOAD_PRESET = "ضع_اسم_الـpreset_هنا"; // Upload Preset من إعدادات Upload

// دالة مساعدة لرفع أي ملف إلى Cloudinary
async function uploadToCloudinary(file, resourceType = "auto") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    // الرابط المباشر للرفع في Cloudinary
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    const response = await fetch(url, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error("فشل رفع الملف إلى Cloudinary");
    }

    const data = await response.json();
    return data.secure_url; // يرجع رابط الملف المشفر الآمن (HTTPS) السريع
}

// دالة حفظ البيانات والوسائط
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
    btnSave.innerText = "جاري رفع الملفات السريعة...";
    btnSave.disabled = true;

    try {
        const updatePayload = {
            title: title,
            message: message,
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
            updatedAt: serverTimestamp()
        };

        // 1. رفع الصور إلى Cloudinary
        if (imageFiles.length > 0) {
            const imageUrls = [];
            for (let i = 0; i < imageFiles.length; i++) {
                const url = await uploadToCloudinary(imageFiles[i], "image");
                imageUrls.push(url);
            }
            updatePayload.images = imageUrls;
        }

        // 2. رفع الفيديو إلى Cloudinary
        if (videoFile) {
            const videoUrl = await uploadToCloudinary(videoFile, "video");
            updatePayload.videoUrl = videoUrl;
        }

        // 3. رفع ملف الصوت / الموسيقى إلى Cloudinary
        if (audioFile) {
            const audioUrl = await uploadToCloudinary(audioFile, "video"); // الصوت يرفع في قسم video في cloudinary
            updatePayload.bgMusicUrl = audioUrl;
        }

        // 4. حفظ الروابط في Firestore (كما هو بدون تغيير)
        const cardRef = doc(db, "cards", cardId);
        await updateDoc(cardRef, updatePayload);

        alert("تم حفظ الذكرى والوسائط بنجاح وسرعة فائقة!");
        editModal.classList.remove("active");

    } catch (error) {
        console.error("خطأ أثناء الرفع:", error);
        alert("حدث خطأ أثناء رفع الوسائط. تأكد من إعدادات Cloudinary.");
    } finally {
        btnSave.innerText = "حفظ التغييرات ورفع الوسائط";
        btnSave.disabled = false;
    }
});
