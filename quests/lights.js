// Нажатие на лампочку переключает её и четырёх соседей. Нужно погасить все.
// Поле создаётся из погашенного случайными нажатиями, поэтому решение есть всегда.
const SIZES = { easy: 3, medium: 4, hard: 5 };
let alive = false, saveNow = () => {}, timerId;

function neighbors(i, n) {
    const r = Math.floor(i / n), c = i % n, out = [i];
    if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
    return out;
}
function press(state, i, n) { neighbors(i, n).forEach((k) => { state[k] = !state[k]; }); }

function makePuzzle(n) {
    for (;;) {
        const s = new Array(n * n).fill(false);
        const k = 4 + Math.floor(Math.random() * n * 2);
        const used = new Set();
        while (used.size < k) used.add(Math.floor(Math.random() * n * n));   // каждое нажатие — разное, значит, решается за ≤ k ходов
        used.forEach((i) => press(s, i, n));
        if (s.some(Boolean) && s.filter(Boolean).length >= 3) return { state: s, best: used.size };
    }
}

export default {
    title: '💡 Огни ёлки',
    description: 'Погаси все лампочки на ёлке',
    defaultPoints: 40,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Каждое нажатие меняет лампочку и соседей по сторонам. Начни с верхнего ряда и гаси лампочки сверху вниз, нажимая на лампочку под горящей. Нажатие дважды на одну лампочку ничего не меняет.',
    makePuzzle, press, neighbors,   // для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность (размер ёлки)', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — поле 3×3'], ['medium', 'Средняя — поле 4×4'], ['hard', 'Сложная — поле 5×5']] },
        { key: 'lightsTime', label: 'Время, секунд (0 — без ограничения)', type: 'number', def: 0, min: 0, max: 1800 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(timerId); alive = true;
        const n = SIZES[cfg.difficulty] || SIZES.medium;
        const limit = Math.max(0, Math.round(Number(cfg.lightsTime) || 0));
        const prog = cfg.progress || {};
        let puzzle = prog.state && prog.state.length === n * n ? prog : null;
        const fresh = puzzle ? null : makePuzzle(n);
        const state = puzzle ? prog.state.slice() : fresh.state;
        const best = puzzle ? prog.best : fresh.best;
        let moves = prog.moves || 0, timeLeft = prog.timeLeft ?? limit, done = false;
        saveNow = () => alive && cfg.saveProgress?.({ state, best, moves, timeLeft });
        if (!puzzle) saveNow();
        const timerEl = document.getElementById('quest-timer');

        container.innerHTML = `
            <p class="note">Нажатие на лампочку переключает её и соседей сверху, снизу, слева и справа. Нужно, чтобы погасли все.</p>
            <div class="lights-grid" id="lights-grid" style="grid-template-columns:repeat(${n}, 1fr)"></div>
            <p class="note" id="lights-moves"></p>`;
        const grid = container.querySelector('#lights-grid');
        const info = container.querySelector('#lights-moves');

        const render = () => {
            grid.innerHTML = '';
            state.forEach((on, i) => {
                const b = document.createElement('button');
                b.className = 'lamp' + (on ? ' on' : '');
                b.onclick = () => {
                    if (done) return;
                    press(state, i, n); moves++;
                    tg.HapticFeedback.impactOccurred('light');
                    saveNow(); render();
                    if (!state.some(Boolean)) {
                        done = true; clearInterval(timerId); alive = false;
                        tg.HapticFeedback.notificationOccurred('success');
                        // чем больше лишних нажатий, тем меньше баллов, но не меньше 50%
                        setTimeout(() => onComplete(Math.max(0.5, 1 - Math.max(0, moves - best * 3) * 0.02)), 500);
                    }
                };
                grid.appendChild(b);
            });
            info.innerText = `Ходов: ${moves} · горит лампочек: ${state.filter(Boolean).length}`;
        };
        render();

        if (limit > 0) {
            timerEl.innerText = `⏱ ${timeLeft}с`;
            timerId = setInterval(() => {
                timeLeft--;
                timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
                if (timeLeft <= 0) { clearInterval(timerId); done = true; alive = false; tg.HapticFeedback.notificationOccurred('error'); onComplete(0); }
            }, 1000);
        } else timerEl.innerText = '';
    },

    destroy() { if (alive) saveNow(); alive = false; clearInterval(timerId); },
};
