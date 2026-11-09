// 100+ разных картинок: сначала новогодние, потом всё остальное
const EMOJI = ['🎄', '🎅', '🤶', '⛄', '❄️', '🎁', '🔔', '⭐', '🌟', '🦌', '🍪', '🧦', '🕯️', '🍊', '🥂', '🍾', '🎆', '🎇', '🧣', '🧤',
    '🎿', '🏂', '🛷', '🍫', '☕', '🍰', '🥛', '🍬', '🍭', '🎶', '🧁', '🍩', '🍎', '🍐', '🍇', '🍓', '🍒', '🍋', '🍉', '🥕',
    '🌽', '🍄', '🥨', '🥐', '🍞', '🧀', '🍕', '🍔', '🌮', '🍿', '🐻', '🐧', '🦊', '🐰', '🐼', '🐨', '🦉', '🐺', '🦁', '🐯',
    '🐸', '🐙', '🦋', '🐢', '🐬', '🦄', '🐝', '🌲', '🌳', '🌸', '🌻', '🌈', '☀️', '🌙', '⚡', '🔥', '💎', '👑', '🎈', '🎀',
    '🎨', '🎭', '🎸', '🎺', '🥁', '🎲', '🧩', '🚀', '🚂', '⛵', '🚁', '🏰', '🗝️', '📚', '💡', '🔮', '🧸', '🪁', '🐘', '🦒', '🐳'];
const SHOW = { easy: 1300, medium: 800, hard: 380 };   // сколько мс видна неверная пара
let timers = [], alive = false, saveNow = () => {};

const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default {
    title: '🃏 Новогодние пары',
    description: 'Найди все пары одинаковых карточек',
    defaultPoints: 30,
    defaultHint: 'Запоминай, где какая картинка. Открывай карточки по порядку, ряд за рядом, чтобы не забыть уже виденные.',
    EMOJI_COUNT: new Set(EMOJI).size,   // для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность (как долго видна неверная пара)', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — 1,3 секунды'], ['medium', 'Средняя — 0,8 секунды'], ['hard', 'Сложная — 0,4 секунды']] },
        { key: 'memoryPairs', label: 'Количество пар (от 2 до 100)', type: 'number', def: 6, min: 2, max: 100 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); alive = true;
        const pairs = Math.min(100, Math.max(2, Math.round(Number(cfg.memoryPairs) || 6)));
        const showMs = SHOW[cfg.difficulty] || SHOW.medium;
        const prog = cfg.progress || {};
        // Колода создаётся один раз и сохраняется
        const deck = prog.deck || shuffle(shuffle(EMOJI).slice(0, pairs).flatMap((e) => [e, e]));
        const done = new Set(prog.done || []);
        let moves = prog.moves || 0, opened = [], lock = false;
        saveNow = () => alive && cfg.saveProgress?.({ deck, done: [...done], moves });
        if (!prog.deck) saveNow();
        const timerEl = document.getElementById('quest-timer');
        const status = () => { timerEl.innerText = `Пар: ${done.size / 2}/${pairs} · ходов: ${moves}`; };

        // Чем больше карточек, тем больше колонок и меньше сами карточки
        const cards = deck.length;
        const cols = cards <= 12 ? 4 : cards <= 30 ? 6 : cards <= 60 ? 8 : cards <= 120 ? 10 : 12;
        const W = Math.min(480, container.clientWidth || 340);
        const fs = Math.max(11, Math.floor((W / cols) * 0.58));

        container.innerHTML = `<p class="note">Открывай по две карточки. Чем меньше лишних ходов, тем больше баллов.${pairs >= 30 ? ' Поле большое — листай вниз.' : ''}</p>
            <div class="mem-grid ${cards > 30 ? 'big' : ''}" id="mem-grid" style="grid-template-columns:repeat(${cols}, 1fr); --fs:${fs}px"></div>`;
        const grid = container.querySelector('#mem-grid');
        status();

        deck.forEach((emoji, i) => {
            const c = document.createElement('div');
            c.className = 'mem-card' + (done.has(i) ? ' done' : ''); c.dataset.v = emoji; c.innerText = emoji;
            c.onclick = () => {
                if (lock || c.classList.contains('open') || c.classList.contains('done')) return;
                c.classList.add('open'); opened.push({ c, i });
                tg.HapticFeedback.impactOccurred('light');
                if (opened.length < 2) return;
                moves++;
                const [a, b] = opened; opened = [];
                if (a.c.dataset.v === b.c.dataset.v) {
                    a.c.classList.replace('open', 'done'); b.c.classList.replace('open', 'done');
                    done.add(a.i); done.add(b.i); saveNow(); status();
                    tg.HapticFeedback.notificationOccurred('success');
                    if (done.size === deck.length) {
                        const extra = moves - pairs;
                        timers.push(setTimeout(() => alive && onComplete(Math.max(0.35, 1 - extra / (3 * pairs))), 600));
                    }
                } else {
                    lock = true; saveNow(); status();
                    timers.push(setTimeout(() => { a.c.classList.remove('open'); b.c.classList.remove('open'); lock = false; }, showMs));
                }
            };
            grid.appendChild(c);
        });
    },

    destroy() { alive = false; timers.forEach(clearTimeout); timers = []; },
};
