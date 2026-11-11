// Лёгкий снегопад на canvas. Останавливается, когда приложение свёрнуто,
// и не включается, если в системе выключены анимации.
export function startSnow() {
    const canvas = document.getElementById('snow');
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, flakes = [], raf = 0;

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth; h = window.innerHeight;
        canvas.width = w * dpr; canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.round(Math.min(90, (w * h) / 9000));
        flakes = Array.from({ length: count }, () => makeFlake(true));
    };

    const makeFlake = (anywhere) => ({
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -10,
        r: 0.8 + Math.random() * 2.6,
        speed: 0.35 + Math.random() * 1.1,
        drift: Math.random() * Math.PI * 2,
        sway: 0.2 + Math.random() * 0.6,
    });

    const tick = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const f of flakes) {
            f.y += f.speed * (0.6 + f.r / 3);
            f.drift += 0.01;
            f.x += Math.sin(f.drift) * f.sway;
            if (f.y > h + 5) Object.assign(f, makeFlake(false), { x: Math.random() * w });
            ctx.globalAlpha = 0.35 + f.r / 5;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
        raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(tick);
    });
    raf = requestAnimationFrame(tick);
}
