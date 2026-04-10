// ============================================================
//  js/particles.js  —  animated cyan particle background
//  Works on both login.php and dashboard.php
// ============================================================

(function () {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H, particles;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function makeParticle() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.2 + 0.2,
            speedY: -(Math.random() * 0.25 + 0.04),
            driftX: (Math.random() - 0.5) * 0.12,
            alpha: Math.random() * 0.45 + 0.05,
            phase: Math.random() * Math.PI * 2,
        };
    }

    function init() {
        resize();
        const count = Math.floor((W * H) / 8500);
        particles = Array.from({ length: count }, makeParticle);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        for (const p of particles) {
            p.phase += 0.008;
            p.y += p.speedY;
            p.x += p.driftX;

            const a = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 220, 255, ${a})`;
            ctx.shadowColor = '#00c8ff';
            ctx.shadowBlur = 5;
            ctx.fill();

            // Wrap
            if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
            if (p.x < -4) p.x = W + 4;
            if (p.x > W + 4) p.x = -4;
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', init);
    init();
    requestAnimationFrame(draw);
})();