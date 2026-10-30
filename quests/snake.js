let interval;
let canvas, ctx;
let snake, food, score;
let dx, dy;
const gridSize = 15;

export default {
    title: "🐍 Диагональная змейка",
    description: "Собери 5 яблок",

    init(container, tg, onComplete) {
        container.innerHTML = `
            <canvas id="snakeCanvas" width="300" height="300" class="game-canvas"></canvas>
            <p style="text-align:center; font-size:12px; color:gray">Свайпай, чтобы менять направление</p>
        `;
        canvas = document.getElementById('snakeCanvas');
        ctx = canvas.getContext('2d');
        document.getElementById('quest-timer').innerText = `Яблок: 0/5`;

        snake = [{x: 150, y: 150}];
        score = 0;
        dx = 1; dy = 1; // Диагональный старт
        generateFood();

        clearInterval(interval);
        interval = setInterval(update, 150);

        // Свайпы
        let startX, startY;
        canvas.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; });
        canvas.addEventListener('touchend', e => {
            let diffX = e.changedTouches[0].clientX - startX;
            let diffY = e.changedTouches[0].clientY - startY;
            if (Math.abs(diffX) > Math.abs(diffY)) { dx = diffX > 0 ? 1 : -1; dy = 0; }
            else { dy = diffY > 0 ? 1 : -1; dx = 0; }
        });

        this.onComplete = onComplete;
        this.tg = tg;
    },

    destroy() {
        clearInterval(interval);
    }
};

function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
        y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
    };
}

function update() {
    const gameModule = this; // Сохраняем контекст
    const head = {x: snake[0].x + dx * gridSize, y: snake[0].y + dy * gridSize};

    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height || snake.some(s => s.x === head.x && s.y === head.y)) {
        clearInterval(interval);
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        window.Telegram.WebApp.showAlert("Ты проиграл!");
        window.app.goMenu();
        return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        document.getElementById('quest-timer').innerText = `Яблок: ${score}/5`;
        generateFood();
        if (score >= 5) {
            clearInterval(interval);
            // Вызов функции завершения из app.js
            if (window.app.activeQuest) {
               // В реальном проекте лучше передавать callback
               window.Telegram.WebApp.showAlert("Квест пройден!");
               window.app.goMenu();
            }
            return;
        }
    } else {
        snake.pop();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4757';
    ctx.beginPath(); ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2 - 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e90ff';
    snake.forEach(s => ctx.fillRect(s.x, s.y, gridSize - 2, gridSize - 2));
}