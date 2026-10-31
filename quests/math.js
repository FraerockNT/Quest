let interval, dead = false;

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

function generateQuestions(count) {
    const qs = [];
    for (let i = 0; i < count; i++) {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const c = Math.floor(Math.random() * 5) + 1;
        if (Math.random() > 0.5) qs.push({ text: `${a} × ${b} + ${c}`, answer: a * b + c });
        else qs.push({ text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c });
    }
    return qs;
}

export default {
    title: '🧮 Математика',
    description: 'Реши примеры на скорость',
    maxScore: 50,
    defaultHint: 'Сначала выполни действие в скобках, потом умножение, потом сложение.',
    adminFields: [
        { key: 'mathCount', label: 'Количество примеров (1–20)', type: 'number', def: 5, min: 1, max: 20 },
        { key: 'mathTime', label: 'Секунд на один пример', type: 'number', def: 15, min: 5, max: 120 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(interval);
        dead = false;
        const count = clamp(cfg.mathCount, 1, 20, 5);
        const limit = clamp(cfg.mathTime, 5, 120, 15);
        const timerEl = document.getElementById('quest-timer');
        let questions = generateQuestions(count);
        let current = 0, mistakes = 0;

        const render = () => {
            if (dead) return;
            if (current >= count) {
                clearInterval(interval);
                tg.HapticFeedback.notificationOccurred('success');
                onComplete(Math.max(20, 50 - 5 * mistakes));
                return;
            }
            const q = questions[current];
            container.innerHTML = `
                <p class="note">Пример ${current + 1} из ${count}${mistakes ? ` · ошибок: ${mistakes}` : ''}</p>
                <div class="big-score" style="color:var(--snow)">${q.text} = ?</div>
                <input type="number" inputmode="numeric" id="math-input" placeholder="Ответ" style="font-size:26px; text-align:center;">
                <button class="btn" id="math-submit">Ответить</button>`;
            const input = container.querySelector('#math-input');
            let timeLeft = limit;
            timerEl.innerText = `⏱ ${timeLeft}с`;
            clearInterval(interval);
            interval = setInterval(() => {
                timeLeft--;
                timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('error');
                    tg.showAlert('Время вышло! Начинаем сначала.', () => {
                        if (dead) return;
                        questions = generateQuestions(count); current = 0; render();
                    });
                }
            }, 1000);

            const check = () => {
                if (parseInt(input.value, 10) === q.answer) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('success');
                    current++; render();
                } else {
                    mistakes++;
                    tg.HapticFeedback.notificationOccurred('error');
                    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
                    input.value = '';
                }
            };
            container.querySelector('#math-submit').onclick = check;
            input.onkeydown = (e) => { if (e.key === 'Enter') check(); };
        };
        render();
    },

    destroy() { dead = true; clearInterval(interval); },
};
