/* ============================================================
   Tech Luxury - Main Script
   UI/UX Interactions Only — No Backend Logic
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    /* ==========================================
       0. Helpers
    ========================================== */
    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

    /* ==========================================
       1. Navbar Scroll Effect
    ========================================== */
    const navbar = $(".navbar");

    if (navbar) {
        let ticking = false;

        const updateNavbar = () => {
            if (window.scrollY > 40) {
                navbar.classList.add("scrolled");
            } else {
                navbar.classList.remove("scrolled");
            }
            ticking = false;
        };

        window.addEventListener("scroll", () => {
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        }, { passive: true });

        // Initial state
        updateNavbar();
    }

    /* ==========================================
       2. Mobile Menu Toggle
    ========================================== */
    const mobileToggle = $("#mobileMenuToggle");
    const navLinks = $("#navLinks");

    if (mobileToggle && navLinks) {

        // Create overlay dynamically
        const overlay = document.createElement("div");
        overlay.className = "nav-overlay";
        document.body.appendChild(overlay);

        const openMenu = () => {
            navLinks.classList.add("active");
            overlay.classList.add("active");
            mobileToggle.setAttribute("aria-expanded", "true");
            mobileToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            document.body.style.overflow = "hidden";
        };

        const closeMenu = () => {
            navLinks.classList.remove("active");
            overlay.classList.remove("active");
            mobileToggle.setAttribute("aria-expanded", "false");
            mobileToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            document.body.style.overflow = "";
        };

        mobileToggle.addEventListener("click", () => {
            const isOpen = navLinks.classList.contains("active");
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        overlay.addEventListener("click", closeMenu);

        // Close on link click
        $$("a", navLinks).forEach(link => {
            link.addEventListener("click", closeMenu);
        });

        // Close on Escape
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && navLinks.classList.contains("active")) {
                closeMenu();
            }
        });

        // Close on resize to desktop
        let resizeTimer;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth > 900 && navLinks.classList.contains("active")) {
                    closeMenu();
                }
            }, 150);
        }, { passive: true });
    }

    /* ==========================================
       3. Haptic Feedback (Safe)
    ========================================== */
    const hapticButtons = $$(".btn-primary, .btn-secondary, .btn-outline");

    if (hapticButtons.length && "vibrate" in navigator && typeof navigator.vibrate === "function") {
        hapticButtons.forEach(button => {
            button.addEventListener("click", () => {
                try {
                    navigator.vibrate(15);
                } catch (e) {
                    /* Silent fail — vibration not critical */
                }
            }, { passive: true });
        });
    }

    /* ==========================================
       4. Scroll Reveal (Safe + Fallback)
    ========================================== */
    const revealElements = $$(".reveal");

    const showElement = (el) => {
        el.classList.add("revealed");
    };

    if (revealElements.length) {

        // Check for IntersectionObserver support
        if ("IntersectionObserver" in window) {

            const observerOptions = {
                threshold: 0.12,
                rootMargin: "0px 0px -50px 0px"
            };

            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        showElement(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            revealElements.forEach(el => revealObserver.observe(el));

            // Safety fallback: reveal all after 3s in case observer fails
            setTimeout(() => {
                revealElements.forEach(el => {
                    if (!el.classList.contains("revealed")) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top < window.innerHeight) {
                            showElement(el);
                        }
                    }
                });
            }, 3000);

        } else {
            // No IntersectionObserver — show everything immediately
            revealElements.forEach(showElement);
        }
    }

    /* ==========================================
       5. Buy Button (Safe — preserves original logic)
    ========================================== */
    const buyButton = $(".product-section .btn-primary");

    if (buyButton) {
        buyButton.addEventListener("click", () => {
            alert("سيتم توجيهك الآن لصفحة إتمام الطلب والشحن.");
            // window.location.href = "/checkout.html";
        });
    }

    /* ==========================================
       6. Smooth Anchor Scroll (with offset for fixed navbar)
    ========================================== */
    $$('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href");
            if (targetId === "#" || targetId === "") return;

            const targetEl = document.querySelector(targetId);
            if (!targetEl) return;

            e.preventDefault();

            const navbarHeight = navbar ? navbar.offsetHeight : 0;
            const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 10;

            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });
        });
    });

    /* ==========================================
       7. No-JS Class Removal (progressive enhancement)
    ========================================== */
    document.documentElement.classList.remove("no-js");

});
