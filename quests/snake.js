const GRID = 15, SIZE = 300, CELLS = SIZE / GRID;
const BULBS = ['#ff4257', '#ffd23f', '#3ddc84', '#4aa3ff', '#b48cff'];
// Сложность задаёт и скорость, и способ ходить:
//  лёгкая — как обычно (вверх/вниз/влево/вправо), средняя — и так, и по диагонали, сложная — ТОЛЬКО по диагонали
const LEVEL = { easy: { ms: 190, mode: 'orth' }, medium: { ms: 140, mode: 'both' }, hard: { ms: 125, mode: 'diag' } };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], ul: [-1, -1], ur: [1, -1], dl: [-1, 1], dr: [1, 1] };
const ORTH = ['up', 'down', 'left', 'right'], DIAG = ['ul', 'ur', 'dl', 'dr'];
let interval, keyHandler, alive = false;

const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

export default {
    title: '🎅 Змейка-гирлянда',
    description: 'Гирлянда собирает подарки для Деда Мороза',
    defaultPoints: 20,
    defaultHint: 'Стены проходимы насквозь: выйдешь с другой стороны. Не заворачивай гирлянду в кольцо. В сложном режиме змейка ходит только по диагонали, подарки лежат на её «клетках».',
    adminFields: [
        { key: 'difficulty', label: 'Сложность', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — обычные повороты, медленно'], ['medium', 'Средняя — и прямо, и по диагонали'], ['hard', 'Сложная — ТОЛЬКО по диагонали']] },
        { key: 'snakeApples', label: 'Сколько подарков собрать (1–25)', type: 'number', def: 8, min: 1, max: 25 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); alive = true;
        const target = Math.min(25, Math.max(1, num(cfg.snakeApples, 8)));
        const lv = LEVEL[cfg.difficulty] || LEVEL.medium;
        const allowed = lv.mode === 'orth' ? ORTH : lv.mode === 'diag' ? DIAG : [...ORTH, ...DIAG];
        const timerEl = document.getElementById('quest-timer');
        let deaths = cfg.progress?.deaths || 0;     // проигрыши запоминаются и немного снижают баллы

        const btn = (d, label) => (allowed.includes(d) ? `<button class="btn btn-ghost" data-d="${d}">${label}</button>` : '<div></div>');
        container.innerHTML = `
            <canvas id="snakeCanvas" width="${SIZE}" height="${SIZE}" class="game-canvas"></canvas>
            <p class="note">${lv.mode === 'diag' ? 'Змейка ходит только по диагонали! ' : ''}Свайпай по полю или жми кнопки. Проигрышей: <b id="snake-deaths">${deaths}</b></p>
            <div class="dpad">
                ${btn('ul', '↖')}${btn('up', '↑')}${btn('ur', '↗')}
                ${btn('left', '←')}<div></div>${btn('right', '→')}
                ${btn('dl', '↙')}${btn('down', '↓')}${btn('dr', '↘')}
            </div>`;
        const canvas = container.querySelector('#snakeCanvas');
        const ctx = canvas.getContext('2d');

        let snake, food, score, dir, queue;

        const placeFood = () => {
            const free = [];
            for (let x = 0; x < CELLS; x++) for (let y = 0; y < CELLS; y++) {
                if (lv.mode === 'diag' && (x + y) % 2 !== 0) continue;   // по диагонали змейка попадает только на «свои» клетки
                if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
            }
            food = free[Math.floor(Math.random() * free.length)];
        };

        const draw = () => {
            ctx.clearRect(0, 0, SIZE, SIZE);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = `${GRID}px serif`;
            ctx.fillText('🎁', food.x * GRID + GRID / 2, food.y * GRID + GRID / 2 + 1);
            for (let i = snake.length - 1; i >= 0; i--) {
                const s = snake[i], cx = s.x * GRID + GRID / 2, cy = s.y * GRID + GRID / 2;
                if (i === 0) { ctx.font = `${GRID + 2}px serif`; ctx.fillText('🎅', cx, cy + 1); continue; }
                ctx.fillStyle = BULBS[i % BULBS.length];
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(cx, cy, GRID / 2 - 2, 0, 7); ctx.fill();
                ctx.shadowBlur = 0;
            }
        };

        const turn = (name) => {
            if (!allowed.includes(name)) return;
            const d = DIRS[name];
            const last = queue.length ? queue[queue.length - 1] : dir;
            if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
            if (queue.length < 2) queue.push(d);
            tg.HapticFeedback.impactOccurred('light');
        };

        const tick = () => {
            if (queue.length) dir = queue.shift();
            const head = { x: (snake[0].x + dir[0] + CELLS) % CELLS, y: (snake[0].y + dir[1] + CELLS) % CELLS };
            const ate = head.x === food.x && head.y === food.y;
            const body = ate ? snake : snake.slice(0, -1);
            if (body.some((s) => s.x === head.x && s.y === head.y)) {
                clearInterval(interval); deaths++;
                cfg.saveProgress?.({ deaths });
                container.querySelector('#snake-deaths').innerText = deaths;
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert('Гирлянда запуталась! Начинаем сначала.', () => { if (alive) start(); });
                return;
            }
            snake.unshift(head);
            if (ate) {
                score++;
                tg.HapticFeedback.notificationOccurred('success');
                timerEl.innerText = `🎁 ${score}/${target}`;
                if (score >= target) { clearInterval(interval); alive = false; draw(); onComplete(Math.max(0.5, 1 - 0.1 * deaths)); return; }
                placeFood();
            } else snake.pop();
            draw();
        };

        const start = () => {
            snake = [{ x: 10, y: 10 }]; score = 0; queue = [];
            dir = lv.mode === 'diag' ? [1, 1] : [1, 0];
            timerEl.innerText = `🎁 0/${target}`;
            placeFood(); draw();
            clearInterval(interval);
            interval = setInterval(tick, lv.ms);
        };

        container.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => turn(b.dataset.d); });
        keyHandler = (e) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', q: 'ul', e: 'ur', z: 'dl', c: 'dr' };
            if (map[e.key]) { e.preventDefault(); turn(map[e.key]); }
        };
        document.addEventListener('keydown', keyHandler);

        // Свайп: в зависимости от режима превращаем угол в 4 или 8 направлений
        let sx = 0, sy = 0;
        canvas.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
            const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            let name;
            if (lv.mode === 'diag') name = ['dr', 'dl', 'ul', 'ur'][Math.floor(a / 90) % 4];
            else if (lv.mode === 'orth') name = ['right', 'down', 'left', 'up'][Math.round(a / 90) % 4];
            else name = ['right', 'dr', 'down', 'dl', 'left', 'ul', 'up', 'ur'][Math.round(a / 45) % 8];
            turn(name);
            sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });

        start();
    },

    destroy() {
        alive = false;
        clearInterval(interval);
        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    },
};
