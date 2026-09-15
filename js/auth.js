import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ استبدل هذه الإعدادات ببيانات مشروعك الخاصة من Firebase
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

let isSignUp = false;

// التبديل بين وضع تسجيل الدخول وتوفير حساب جديد
const btnToggle = document.getElementById("btnToggle");
const nameGroup = document.getElementById("nameGroup");
const formTitle = document.getElementById("formTitle");
const btnSubmit = document.getElementById("btnSubmit");
const toggleText = document.getElementById("toggleText");

btnToggle.addEventListener("click", () => {
    isSignUp = !isSignUp;
    if (isSignUp) {
        formTitle.innerText = "إنشاء حساب جديد";
        btnSubmit.innerText = "إنشاء حساب";
        toggleText.innerText = "لديك حساب بالفعل؟";
        btnToggle.innerText = "تسجيل الدخول";
        nameGroup.style.display = "block";
    } else {
        formTitle.innerText = "تسجيل الدخول إلى حسابك";
        btnSubmit.innerText = "دخول";
        toggleText.innerText = "ليس لديك حساب؟";
        btnToggle.innerText = "إنشاء حساب جديد";
        nameGroup.style.display = "none";
    }
});

// معالجة نموذج التسجيل / الدخول
document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const fullName = document.getElementById("fullName").value;

    try {
        if (isSignUp) {
            // 1. إنشاء حساب جديد
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // حفظ بيانات المستخدم في Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: fullName,
                email: email,
                role: "customer",
                createdAt: serverTimestamp()
            });

            alert("تم إنشاء الحساب بنجاح!");
            window.location.href = "customer-dashboard.html";
        } else {
            // 2. تسجيل الدخول
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "customer-dashboard.html";
        }
    } catch (error) {
        console.error("خطأ في المصادقة:", error);
        alert("فشلت العملية: " + error.message);
    }
});

// التحقق مما إذا كان المستخدم مسجلاً بالفعل
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "customer-dashboard.html";
    }
});
