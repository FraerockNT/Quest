const questions = [
    { q: "В каком году в России впервые официально отметили Новый год 1 января?", options: ["1700", "1810", "1900", "1999"], answer: 0, hint: "Это сделал Петр I" },
    { q: "Кто является официальным Дедом Морозом в США?", options: ["Санта-Клаус", "Йоулупукки", "Пэр Ноэль", "Бабай"], answer: 0, hint: "Приезжает на оленях" },
    { q: "Как называется новогодний бал в Вене?", options: ["Опера", "Фестиваль", "Маскарад", "Карнавал"], answer: 0, hint: "Проходит в здании Оперы" }
];

let currentQ = 0;

export default {
    title: "🧠 Новогодняя эрудиция",
    description: "Ответь на вопросы",
    init(container, tg, onComplete) {
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
        <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button id="btn-5050" style="flex:1; padding:10px; border-radius:8px; border:none; background:#f39c12; color:white;">50/50</button>
            <button id="btn-hint" style="flex:1; padding:10px; border-radius:8px; border:none; background:#3498db; color:white;">Подсказка</button>
        </div>
    `;

    const optsContainer = document.getElementById('quiz-opts');

    qData.options.forEach((opt, index) => {
        const btn = document.createElement('div');
        btn.className = 'quiz-option';
        btn.dataset.index = index;
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(btn, index, qData, tg, container, onComplete);
        optsContainer.appendChild(btn);
    });

    document.getElementById('btn-5050').onclick = () => {
        // Убираем 2 неправильных
        let removed = 0;
        optsContainer.querySelectorAll('.quiz-option').forEach(btn => {
            if (parseInt(btn.dataset.index) !== qData.answer && removed < 2) {
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
                removed++;
            }
        });
        document.getElementById('btn-5050').disabled = true;
    };

    document.getElementById('btn-hint').onclick = () => {
        tg.showAlert(`Подсказка: ${qData.hint}`);
        document.getElementById('btn-hint').disabled = true;
    };
}

function checkAnswer(btn, index, qData, tg, container, onComplete) {
    if (index === qData.answer) {
        btn.classList.add('correct');
        tg.HapticFeedback.notificationOccurred('success');
        setTimeout(() => {
            currentQ++;
            if (currentQ < questions.length) showQuestion(container, tg, onComplete);
            else onComplete(15); // 15 баллов за квиз
        }, 1000);
    } else {
        btn.classList.add('wrong');
        tg.HapticFeedback.notificationOccurred('error');
        setTimeout(() => btn.classList.remove('wrong'), 1000);
    }
}