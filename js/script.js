document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. تأثير شريط الملاحة (Navbar Scroll)
    // ==========================================
    const navbar = document.querySelector(".navbar");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.style.background = "rgba(9, 13, 22, 0.95)";
            navbar.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
        } else {
            navbar.style.background = "rgba(9, 13, 22, 0.85)";
            navbar.style.boxShadow = "none";
        }
    });

    // ==========================================
    // 2. الاستجابة للمس (Haptic Feedback) للهواتف
    // ==========================================
    const primaryButtons = document.querySelectorAll(".btn-primary, .btn-secondary");

    primaryButtons.forEach(button => {
        button.addEventListener("click", () => {
            // اهتزاز خفيف جداً على هواتف أندرويد لتأكيد الضغطة
            if ("vibrate" in navigator) {
                navigator.vibrate(25);
            }
        });
    });

    // ==========================================
    // 3. تأثير الظهور التدريجي لعناصر الصفحة (Scroll Reveal)
    // ==========================================
    const observerOptions = {
        threshold: 0.15 // يظهر العنصر عند ظهور 15% منه في الشاشة
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
                observer.unobserve(entry.target); // تشغيل الحركة مرة واحدة فقط
            }
        });
    }, observerOptions);

    // تحديد العناصر المراد إضافات التأثير لها
    const animateElements = document.querySelectorAll(".step-card, .product-container, .hero-content");

    animateElements.forEach(el => {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
        el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
        revealObserver.observe(el);
    });

    // ==========================================
    // 4. معالجة زر "شراء الآن"
    // ==========================================
    const buyButton = document.querySelector(".product-section .btn-primary");

    if (buyButton) {
        buyButton.addEventListener("click", () => {
            // هنا يمكنك ربط الزر بصفحة الدفع (Checkout) أو فتح نافذة الدفع
            alert("سيتم توجيهك الآن لصفحة إتمام الطلب والشحن.");
            // مثال للتوجيه الفعلي:
            // window.location.href = "/checkout.html";
        });
    }

});