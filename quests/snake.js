const GRID = 15, SIZE = 300, CELLS = SIZE / GRID;
let interval, keyHandler;

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

export default {
    title: '🐍 Змейка',
    description: 'Собери яблоки',
    maxScore: 20,
    defaultHint: 'Стены можно проходить насквозь — выйдешь с другой стороны. Не заворачивай змейку в кольцо.',
    adminFields: [{ key: 'snakeApples', label: 'Сколько яблок собрать (1–20)', type: 'number', def: 5, min: 1, max: 20 }],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy();
        const target = clamp(cfg.snakeApples, 1, 20, 5);
        const timerEl = document.getElementById('quest-timer');

        container.innerHTML = `
            <canvas id="snakeCanvas" width="${SIZE}" height="${SIZE}" class="game-canvas"></canvas>
            <p class="note">Управляй свайпом по полю или кнопками</p>
            <div class="dpad">
                <div></div><button class="btn btn-ghost" data-d="up">↑</button><div></div>
                <button class="btn btn-ghost" data-d="left">←</button><button class="btn btn-ghost" data-d="down">↓</button><button class="btn btn-ghost" data-d="right">→</button>
            </div>
            <button class="btn btn-ghost" id="snake-restart">Начать заново</button>`;
        const canvas = container.querySelector('#snakeCanvas');
        const ctx = canvas.getContext('2d');

        let snake, food, score, dir, queue, over;
        const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

        const placeFood = () => {   // яблоко не появляется на змейке
            const free = [];
            for (let x = 0; x < CELLS; x++) for (let y = 0; y < CELLS; y++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
            food = free[Math.floor(Math.random() * free.length)];
        };

        const draw = () => {
            ctx.clearRect(0, 0, SIZE, SIZE);
            ctx.font = `${GRID}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🍎', food.x * GRID + GRID / 2, food.y * GRID + GRID / 2 + 1);
            snake.forEach((s, i) => {
                ctx.fillStyle = i === 0 ? '#7dffb0' : '#3ddc84';
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2, 4);
                    ctx.fill();
                } else ctx.fillRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2);
            });
        };

        const turn = (name) => {
            const d = DIRS[name];
            const last = queue.length ? queue[queue.length - 1] : dir;   // сравниваем с последним поворотом, а не с текущим
            if (d[0] === -last[0] && d[1] === -last[1]) return;          // разворот на 180° запрещён
            if (d[0] === last[0] && d[1] === last[1]) return;
            if (queue.length < 2) queue.push(d);
            tg.HapticFeedback.impactOccurred('light');
        };

        const tick = () => {
            if (queue.length) dir = queue.shift();
            const head = { x: (snake[0].x + dir[0] + CELLS) % CELLS, y: (snake[0].y + dir[1] + CELLS) % CELLS };
            const ate = head.x === food.x && head.y === food.y;
            const body = ate ? snake : snake.slice(0, -1);   // хвост в этот ход освобождается
            if (body.some((s) => s.x === head.x && s.y === head.y)) {
                clearInterval(interval); over = true;
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert('Змейка укусила себя! Пробуем ещё раз.', () => { if (!over) return; start(); });
                return;
            }
            snake.unshift(head);
            if (ate) {
                score++;
                tg.HapticFeedback.notificationOccurred('success');
                timerEl.innerText = `🍎 ${score}/${target}`;
                if (score >= target) { clearInterval(interval); over = false; draw(); onComplete(20); return; }
                placeFood();
            } else snake.pop();
            draw();
        };

        const start = () => {
            snake = [{ x: 10, y: 10 }]; score = 0; dir = [1, 0]; queue = []; over = false;
            timerEl.innerText = `🍎 0/${target}`;
            placeFood(); draw();
            clearInterval(interval);
            interval = setInterval(tick, 150);
        };

        container.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => turn(b.dataset.d); });
        container.querySelector('#snake-restart').onclick = () => { over = false; start(); };

        keyHandler = (e) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
            if (map[e.key]) { e.preventDefault(); turn(map[e.key]); }
        };
        document.addEventListener('keydown', keyHandler);

        // Свайпы по полю
        let sx = 0, sy = 0;
        canvas.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
            turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
            sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });

        start();
    },

    destroy() {
        clearInterval(interval);
        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    },
};
