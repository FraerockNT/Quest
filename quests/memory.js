const EMOJI = ['🎄', '🎅', '⛄', '🎁', '🔔', '⭐', '🦌', '🍪', '🧦', '🕯️', '❄️', '🍊'];
let timers = [], dead = false;

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default {
    title: '🃏 Новогодние пары',
    description: 'Найди все пары одинаковых карточек',
    maxScore: 30,
    defaultHint: 'Запоминай, где какая картинка. Начни с углов и двигайся по порядку, чтобы не забыть уже открытые.',
    adminFields: [{ key: 'memoryPairs', label: 'Количество пар (4–10)', type: 'number', def: 6, min: 4, max: 10 }],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); dead = false;
        const pairs = clamp(cfg.memoryPairs, 4, 10, 6);
        const items = shuffle(EMOJI).slice(0, pairs);
        const deck = shuffle([...items, ...items]);
        const timerEl = document.getElementById('quest-timer');
        let opened = [], moves = 0, found = 0, lock = false;

        container.innerHTML = `<p class="note">Открывай по две карточки. Чем меньше ходов, тем больше баллов.</p>
            <div class="mem-grid" id="mem-grid"></div>`;
        const grid = container.querySelector('#mem-grid');
        timerEl.innerText = 'Ходов: 0';

        deck.forEach((emoji, i) => {
            const c = document.createElement('div');
            c.className = 'mem-card'; c.dataset.v = emoji; c.innerText = emoji;
            c.onclick = () => {
                if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
                c.classList.add('open'); opened.push(c);
                tg.HapticFeedback.impactOccurred('light');
                if (opened.length < 2) return;
                moves++; timerEl.innerText = `Ходов: ${moves}`;
                const [a, b] = opened; opened = [];
                if (a.dataset.v === b.dataset.v) {
                    a.classList.replace('open', 'done'); b.classList.replace('open', 'done');
                    tg.HapticFeedback.notificationOccurred('success');
                    if (++found === pairs) timers.push(setTimeout(() => !dead && onComplete(Math.max(10, 30 - (moves - pairs))), 600));
                } else {
                    lock = true;
                    timers.push(setTimeout(() => { a.classList.remove('open'); b.classList.remove('open'); lock = false; }, 800));
                }
            };
            grid.appendChild(c);
        });
    },

    destroy() { dead = true; timers.forEach(clearTimeout); timers = []; },
};
