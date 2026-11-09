const W = 300, H = 400;
const LEVEL = {   // скорость падения, пауза между предметами (мс), доля «угольков»
    easy: { vy: 2.2, every: 900, bad: 0.25 },
    medium: { vy: 3.0, every: 700, bad: 0.33 },
    hard: { vy: 4.0, every: 520, bad: 0.42 },
};
let loop, spawner, keyHandler, alive = false;

export default {
    title: '🛷 Лови подарки',
    description: 'Двигай сани и лови подарки, а уголь обходи',
    defaultPoints: 30,
    defaultHint: 'Не гонись за каждым подарком: лучше стой там, где безопасно, и подставляй сани только под подарки. Уголь (чёрные шарики) отнимает сердце.',
    adminFields: [
        { key: 'difficulty', label: 'Сложность (скорость и количество угольков)', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая'], ['medium', 'Средняя'], ['hard', 'Сложная']] },
        { key: 'catchGoal', label: 'Сколько подарков поймать (5–40)', type: 'number', def: 12, min: 5, max: 40 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); alive = true;
        const goal = Math.min(40, Math.max(5, Math.round(Number(cfg.catchGoal) || 12)));
        const lv = LEVEL[cfg.difficulty] || LEVEL.medium;
        const timerEl = document.getElementById('quest-timer');
        let deaths = cfg.progress?.deaths || 0;

        container.innerHTML = `
            <canvas id="catchCanvas" width="${W}" height="${H}" class="game-canvas" style="max-width:300px"></canvas>
            <p class="note">Води пальцем по полю, чтобы двигать сани. Проигрышей: <b id="catch-deaths">${deaths}</b></p>`;
        const canvas = container.querySelector('#catchCanvas');
        const ctx = canvas.getContext('2d');
        let px, items, score, lives;

        const hud = () => { timerEl.innerText = `🎁 ${score}/${goal}  ${'❤️'.repeat(lives)}`; };
        const start = () => {
            px = W / 2; items = []; score = 0; lives = 3; hud();
            clearInterval(loop); clearInterval(spawner);
            spawner = setInterval(() => items.push({ x: 20 + Math.random() * (W - 40), y: -16, bad: Math.random() < lv.bad, sway: Math.random() * 6 }), lv.every);
            loop = setInterval(step, 16);
        };

        const lose = () => {
            clearInterval(loop); clearInterval(spawner);
            deaths++; cfg.saveProgress?.({ deaths });
            container.querySelector('#catch-deaths').innerText = deaths;
            tg.HapticFeedback.notificationOccurred('error');
            tg.showAlert('Сердца закончились! Попробуем ещё раз.', () => alive && start());
        };

        const step = () => {
            ctx.clearRect(0, 0, W, H);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                it.y += lv.vy; it.x += Math.sin(it.y / 30 + it.sway) * 0.6;
                if (it.bad) { ctx.fillStyle = '#1b1b22'; ctx.beginPath(); ctx.arc(it.x, it.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(it.x - 3, it.y - 3, 3, 0, 7); ctx.fill(); }
                else { ctx.font = '24px serif'; ctx.fillText('🎁', it.x, it.y); }
                if (it.y > H - 46 && it.y < H - 14 && Math.abs(it.x - px) < 32) {
                    items.splice(i, 1);
                    if (it.bad) {
                        lives--; tg.HapticFeedback.notificationOccurred('error'); hud();
                        if (lives <= 0) return lose();
                    } else {
                        score++; tg.HapticFeedback.impactOccurred('light'); hud();
                        if (score >= goal) {
                            clearInterval(loop); clearInterval(spawner); alive = false;
                            tg.HapticFeedback.notificationOccurred('success');
                            return onComplete(Math.max(0.4, 1 - 0.15 * deaths));
                        }
                    }
                } else if (it.y > H + 20) items.splice(i, 1);
            }
            ctx.font = '40px serif'; ctx.fillText('🛷', px, H - 26);
        };

        const move = (clientX) => { const r = canvas.getBoundingClientRect(); px = Math.min(W - 22, Math.max(22, ((clientX - r.left) / r.width) * W)); };
        canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); move(e.clientX); });
        canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') move(e.clientX); });
        keyHandler = (e) => { if (e.key === 'ArrowLeft') px = Math.max(22, px - 24); if (e.key === 'ArrowRight') px = Math.min(W - 22, px + 24); };
        document.addEventListener('keydown', keyHandler);
        start();
    },

    destroy() {
        alive = false; clearInterval(loop); clearInterval(spawner);
        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    },
};
