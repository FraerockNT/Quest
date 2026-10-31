let interval, canvas, ctx, snake, food, score, dx, dy;
const gridSize = 15;
const speed = 15; // Скорость

export default {
    title: "🐍 Змейка",
    description: "Собери 5 яблок (по диагонали)",
    init(container, tg, onComplete) {
        container.innerHTML = `
            <canvas id="snakeCanvas" width="300" height="300" class="game-canvas" style="margin:0 auto;"></canvas>
            <div style="display:grid; grid-template-columns: repeat(3, 60px); gap:10px; justify-content:center; margin-top:20px;">
                <div></div>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove(135)">↖</button>
                <div></div>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove(225)">↙</button>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove(315)">↘</button>
                <button class="btn" style="padding:15px; margin:0;" onclick="window.snakeMove(45)">↗</button>
            </div>
        `;
        canvas = document.getElementById('snakeCanvas');
        ctx = canvas.getContext('2d');

        snake = [{x: 150, y: 150}];
        score = 0;

        // Стартовое направление: 45 градусов (вправо-вверх)
        dx = 1; dy = -1;
        generateFood();

        clearInterval(interval);
        interval = setInterval(() => update(tg, onComplete), 150);

        // Кнопки управления
        window.snakeMove = (angle) => {
            // 45 = вправо-вверх (1, -1)
            // 135 = влево-вверх (-1, -1)
            // 225 = влево-вниз (-1, 1)
            // 315 = вправо-вниз (1, 1)
            if (angle === 45) { dx = 1; dy = -1; }
            if (angle === 135) { dx = -1; dy = -1; }
            if (angle === 225) { dx = -1; dy = 1; }
            if (angle === 315) { dx = 1; dy = 1; }
            tg.HapticFeedback.impactOccurred('light');
        };

        // Управление с клавиатуры
        window.snakeKeydown = (e) => {
            if (e.key === 'ArrowUp') window.snakeMove(135);
            if (e.key === 'ArrowDown') window.snakeMove(315);
            if (e.key === 'ArrowLeft') window.snakeMove(225);
            if (e.key === 'ArrowRight') window.snakeMove(45);
        };
        document.addEventListener('keydown', window.snakeKeydown);
    },
    destroy() {
        clearInterval(interval);
        document.removeEventListener('keydown', window.snakeKeydown);
        delete window.snakeMove;
    }
};

function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
        y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
    };
}

function update(tg, onComplete) {
    const head = {x: snake[0].x + dx * gridSize, y: snake[0].y + dy * gridSize};

    // Телепорт через границы (змейка не умирает об стены)
    if (head.x < 0) head.x = canvas.width - gridSize;
    if (head.x >= canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height - gridSize;
    if (head.y >= canvas.height) head.y = 0;

    // Проверка на укус себя
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
        clearInterval(interval);
        tg.showAlert("Ты укусил себя!");
        onComplete(0);
        return;
    }

    snake.unshift(head);

    // Проверка на поедание яблока
    if (head.x === food.x && head.y === food.y) {
        score++;
        tg.HapticFeedback.impactOccurred('light');
        generateFood();
        if (score >= 5) {
            clearInterval(interval);
            onComplete(20);
            return;
        }
    } else {
        snake.pop();
    }

    // Отрисовка
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4757';
    ctx.beginPath(); ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2 - 1, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1e90ff';
    snake.forEach(s => ctx.fillRect(s.x, s.y, gridSize - 2, gridSize - 2));
}