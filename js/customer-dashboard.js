// بيانات Cloudinary الخاصة بك (تأكد من استبدالها ببياناتك الحقيقية)
const CLOUDINARY_CLOUD_NAME = "ypwbnpyd"; 
const CLOUDINARY_UPLOAD_PRESET = "ml_default"; 

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
        const errorData = await response.json().catch(() => ({}));
        console.error("تفاصيل خطأ Cloudinary:", errorData);
        throw new Error(errorData.error?.message || "فشل رفع الملف إلى Cloudinary");
    }

    const data = await response.json();
    return data.secure_url; // يرجع رابط الملف المشفر الآمن (HTTPS)
}

// عناصر النموذج والنافذة
const editCardForm = document.getElementById("editCardForm");
const editModal = document.getElementById("editModal");

// دالة حفظ البيانات والوسائط
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
        btnSave.innerText = "جاري رفع الملفات والذكريات...";
        btnSave.disabled = true;

        try {
            const updatePayload = {
                title: title,
                message: message,
                securityQuestion: securityQuestion,
                securityAnswer: securityAnswer,
                updatedAt: serverTimestamp()
            };

            // 1. رفع الصور إلى Cloudinary (في حال تم اختيار صور جديدة)
            if (imageFiles && imageFiles.length > 0) {
                const imageUrls = [];
                for (let i = 0; i < imageFiles.length; i++) {
                    const url = await uploadToCloudinary(imageFiles[i], "image");
                    imageUrls.push(url);
                }
                updatePayload.images = imageUrls;
            }

            // 2. رفع الفيديو إلى Cloudinary (في حال تم اختيار فيديو جديد)
            if (videoFile) {
                const videoUrl = await uploadToCloudinary(videoFile, "video");
                updatePayload.videoUrl = videoUrl;
            }

            // 3. رفع ملف الصوت / الموسيقى إلى Cloudinary (باستخدام auto)
            if (audioFile) {
                const audioUrl = await uploadToCloudinary(audioFile, "auto");
                updatePayload.bgMusicUrl = audioUrl;
            }

            // 4. حفظ الروابط في Firestore
            const cardRef = doc(db, "cards", cardId);
            await updateDoc(cardRef, updatePayload);

            alert("تم حفظ الذكرى والوسائط بنجاح وسرعة فائقة!");
            if (editModal) editModal.classList.remove("active");

        } catch (error) {
            console.error("خطأ أثناء الرفع:", error);
            alert("حدث خطأ أثناء رفع الوسائط: " + error.message);
        } finally {
            btnSave.innerText = "حفظ التغييرات ورفع الوسائط";
            btnSave.disabled = false;
        }
    });
}
