/**
 * EduBridge Landing Page Intelligence
 * High-performance frame animation and scroll orchestration.
 */

(function() {
    // ─── Configuration ───────────────────────────────────────────────────────────
    const frameCount = 240;
    const framesBaseUrl = '/newframe/frame_'; // Updated to new frame assets
    const frameExt = '.jpg';
    
    // ─── DOM References ─────────────────────────────────────────────────────────
    const canvas = document.getElementById('animation-canvas');
    const ctx = canvas.getContext('2d');
    const preloader = document.getElementById('preloader');
    const loaderProgress = document.getElementById('loader-progress');
    const loaderText = document.getElementById('loader-text');
    const heroTitle = document.getElementById('hero-title');
    const heroCta = document.getElementById('hero-cta');

    // ─── State ──────────────────────────────────────────────────────────────────
    const images = [];
    let loadedImagesCount = 0;
    const airCondition = { frame: 0 }; // For smooth interpolation
    
    // ─── Frame Preloading ───────────────────────────────────────────────────────
    function preloadFrames() {
        return new Promise((resolve) => {
            for (let i = 1; i <= frameCount; i++) {
                const img = new Image();
                img.src = `${framesBaseUrl}${i}${frameExt}`;
                img.onload = () => {
                    loadedImagesCount++;
                    const progress = Math.floor((loadedImagesCount / frameCount) * 100);
                    loaderProgress.style.width = `${progress}%`;
                    loaderText.textContent = `${progress}%`;
                    
                    if (loadedImagesCount === frameCount) {
                        finishPreloading();
                        resolve();
                    }
                };
                img.onerror = (e) => {
                    console.error(`Failed to load frame ${i}`, e);
                    loadedImagesCount++; // Skip to prevent hang
                    if (loadedImagesCount === frameCount) resolve();
                };
                images.push(img);
            }
        });
    }

    function finishPreloading() {
        setTimeout(() => {
            preloader.style.opacity = '0';
            preloader.style.visibility = 'hidden';
            animateHeroEntrance();
        }, 800);
    }

    function animateHeroEntrance() {
        const items = [heroTitle, heroCta];
        items.forEach((item, index) => {
            setTimeout(() => {
                item.style.transition = 'all 1.2s cubic-bezier(0.23, 1, 0.32, 1)';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 300 + (index * 200));
        });
    }

    // ─── Canvas Animation Logic ─────────────────────────────────────────────────
    function initCanvas() {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        renderFrame(0);
    }

    function renderFrame(index) {
        if (!images[index]) return;
        
        const img = images[index];
        const canvasWidth = canvas.width / window.devicePixelRatio;
        const canvasHeight = canvas.height / window.devicePixelRatio;
        
        // Cover logic (Center crop)
        const imgRatio = img.width / img.height;
        const canvasRatio = canvasWidth / canvasHeight;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgRatio > canvasRatio) {
            drawHeight = canvasHeight;
            drawWidth = canvasHeight * imgRatio;
            offsetX = -(drawWidth - canvasWidth) / 2;
            offsetY = 0;
        } else {
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgRatio;
            offsetX = 0;
            offsetY = -(drawHeight - canvasHeight) / 2;
        }
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    // ─── Scroll Orchestration ──────────────────────────────────────────────────
    function onScroll() {
        const scrollTop = window.scrollY;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        // Map scroll percentage to frames specifically for the hero section height (300vh)
        // We only want the animation to play over the first 200vh
        const scrollFraction = Math.min(scrollTop / (window.innerHeight * 2), 1);
        const frameIndex = Math.min(
            frameCount - 1,
            Math.floor(scrollFraction * frameCount)
        );
        
        requestAnimationFrame(() => renderFrame(frameIndex));
        
        // Text fade out on scroll
        const opacity = 1 - (scrollTop / 500);
        heroTitle.style.opacity = Math.max(0, opacity);
        heroCta.style.opacity = Math.max(0, opacity);
    }

    // ─── Reveal Animations (Intersection Observer) ──────────────────────────────
    function initReveals() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    // ─── Interaction Handlers ──────────────────────────────────────────────────
    function initInteractions() {

        window.addEventListener('resize', initCanvas);
        window.addEventListener('scroll', onScroll);
        
        // CTA button tracking logic (if analytics is available)
        const exploreBtn = document.getElementById('hero-explore');
        if (window.trackInteraction && exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                window.trackInteraction('portalOpened', 'Landing Page Hero');
            });
        }
    }

    // ─── Start ───────────────────────────────────────────────────────────────────
    initCanvas();
    initInteractions();
    initReveals();
    preloadFrames();
})();
