const questions = [
    { q: "Столица Австралии?", options: ["Сидней", "Мельбурн", "Канберра", "Перт"], answer: 2 },
    { q: "Сколько планет в Солнечной системе?", options: ["8", "9", "7", "10"], answer: 0 },
    { q: "Кто написал 'Войну и мир'?", options: ["Достоевский", "Толстой", "Пушкин", "Чехов"], answer: 1 }
];

let currentQ = 0;

export default {
    title: "🧠 Эрудиция",
    description: "Ответь на вопросы викторины",

    init(container, tg, onComplete) {
        document.getElementById('quest-timer').innerText = 'Вопрос 1/3';
        this.onComplete = onComplete;
        this.tg = tg;
        currentQ = 0;
        showQuestion(container, tg, onComplete);
    },

    destroy() {}
};

function showQuestion(container, tg, onComplete) {
    const qData = questions[currentQ];
    container.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px; text-align: center;">${qData.q}</div>
        <div id="quiz-opts" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    const optsContainer = document.getElementById('quiz-opts');

    qData.options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = 'quiz-option';
        btn.innerText = opt;
        btn.onclick = () => {
            // Блокируем кнопки после ответа
            optsContainer.querySelectorAll('.quiz-option').forEach(b => b.style.pointerEvents = 'none');

            if (index === qData.answer) {
                btn.classList.add('correct');
                tg.HapticFeedback.notificationOccurred('success');

                setTimeout(() => {
                    currentQ++;
                    if (currentQ < questions.length) {
                        document.getElementById('quest-timer').innerText = `Вопрос ${currentQ + 1}/3`;
                        showQuestion(container, tg, onComplete);
                    } else {
                        onComplete("Эрудиция");
                    }
                }, 1000);
            } else {
                btn.classList.add('wrong');
                tg.HapticFeedback.notificationOccurred('error');
                setTimeout(() => btn.classList.remove('wrong'), 1000);
                setTimeout(() => optsContainer.querySelectorAll('.quiz-option').forEach(b => b.style.pointerEvents = 'auto'), 1000);
            }
        };
        optsContainer.appendChild(btn);
    });
}