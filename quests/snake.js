let interval, canvas, ctx, snake, food, score, dx, dy;
const gridSize = 15;

export default {
    title: "🐍 Змейка",
    description: "Собери 5 яблок",
    init(container, tg, onComplete) {
        container.innerHTML = `
            <canvas id="snakeCanvas" width="300" height="300" class="game-canvas" style="margin:0 auto;"></canvas>
            <div style="display:grid; grid-template-columns: repeat(3, 60px); gap:10px; justify-content:center; margin-top:20px;">
                <div></div>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove('up')">↑</button>
                <div></div>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove('left')">←</button>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove('down')">↓</button>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove('right')">→</button>
            </div>
        `;
        canvas = document.getElementById('snakeCanvas');
        ctx = canvas.getContext('2d');

        snake = [{x: 150, y: 150}];
        score = 0;
        dx = 1; dy = 1; // Диагональ
        generateFood();

        clearInterval(interval);
        interval = setInterval(() => update(tg, onComplete), 150);

        // Свайпы
        let startX, startY;
        canvas.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; });
        canvas.addEventListener('touchend', e => {
            let diffX = e.changedTouches[0].clientX - startX;
            let diffY = e.changedTouches[0].clientY - startY;
            if (Math.abs(diffX) > Math.abs(diffY)) { dx = diffX > 0 ? 1 : -1; dy = 0; }
            else { dy = diffY > 0 ? 1 : -1; dx = 0; }
        });

        // Стрелки клавиатуры
        window.snakeKeydown = (e) => {
            if (e.key === 'ArrowUp') window.snakeMove('up');
            if (e.key === 'ArrowDown') window.snakeMove('down');
            if (e.key === 'ArrowLeft') window.snakeMove('left');
            if (e.key === 'ArrowRight') window.snakeMove('right');
        };
        document.addEventListener('keydown', window.snakeKeydown);

        // Экранные кнопки
        window.snakeMove = (dir) => {
            if (dir === 'up' && dy !== 1) { dx = 0; dy = -1; }
            if (dir === 'down' && dy !== -1) { dx = 0; dy = 1; }
            if (dir === 'left' && dx !== 1) { dx = -1; dy = 0; }
            if (dir === 'right' && dx !== -1) { dx = 1; dy = 0; }
            tg.HapticFeedback.impactOccurred('light');
        };
    },
    destroy() {
        clearInterval(interval);
        document.removeEventListener('keydown', window.snakeKeydown);
        delete window.snakeMove;
    }
};

function generateFood() {
    food = { x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize, y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize };
}

function update(tg, onComplete) {
    const head = {x: snake[0].x + dx * gridSize, y: snake[0].y + dy * gridSize};

    // Телепорт
    if (head.x < 0) head.x = canvas.width - gridSize;
    if (head.x >= canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height - gridSize;
    if (head.y >= canvas.height) head.y = 0;

    if (snake.some(s => s.x === head.x && s.y === head.y)) {
        clearInterval(interval);
        tg.showAlert("Ты укусил себя!");
        onComplete(0); // 0 баллов
        return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        tg.HapticFeedback.impactOccurred('light');
        generateFood();
        if (score >= 5) {
            clearInterval(interval);
            onComplete(20); // 20 баллов
            return;
        }
    } else { snake.pop(); }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4757';
    ctx.beginPath(); ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2 - 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e90ff';
    snake.forEach(s => ctx.fillRect(s.x, s.y, gridSize - 2, gridSize - 2));
}