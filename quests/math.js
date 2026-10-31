let interval, currentQ, score, questions, timeLeft, config;

export default {
    title: "🧮 Математика",
    description: "Реши примеры",
    init(container, tg, onComplete, questConfig) {
        config = questConfig || { mathCount: 5, mathTime: 15 };
        currentQ = 0; score = 0;
        questions = generateQuestions(config.mathCount);

        const renderQuestion = () => {
            if (currentQ >= config.mathCount) {
                clearInterval(interval);
                tg.HapticFeedback.notificationOccurred('success');
                onComplete(50);
                return;
            }

            const q = questions[currentQ];
            container.innerHTML = `
                <div style="font-size:32px; font-weight:bold; text-align:center; margin: 30px 0;">${q.text}</div>
                <input type="number" id="math-input" placeholder="Ответ" style="font-size:24px; width:80%; margin:0 auto; padding:10px; border-radius:10px; border:1px solid #ccc; text-align:center;">
                <button class="btn" id="math-submit" style="margin-top:20px;">Ответить</button>
            `;

            timeLeft = config.mathTime;
            document.getElementById('quest-timer').innerText = `⏱ ${timeLeft}с`;
            clearInterval(interval);

            interval = setInterval(() => {
                timeLeft--;
                document.getElementById('quest-timer').innerText = `⏱ ${timeLeft}с`;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('error');
                    // Исправленный перезапуск
                    tg.showAlert("Время вышло! Попробуй снова.", () => {
                        currentQ = 0;
                        renderQuestion();
                    });
                }
            }, 1000);

            const submitBtn = document.getElementById('math-submit');
            const inputField = document.getElementById('math-input');

            const checkAnswer = () => {
                if (parseInt(inputField.value) === q.answer) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('success');
                    currentQ++;
                    renderQuestion();
                } else {
                    tg.HapticFeedback.notificationOccurred('error');
                    inputField.style.border = "2px solid red";
                }
            };
            submitBtn.onclick = checkAnswer;
            inputField.onkeydown = (e) => { if (e.key === 'Enter') checkAnswer(); };
        };

        renderQuestion();
        this.destroy = () => { clearInterval(interval); };
    }
};

function generateQuestions(count) {
    const qs = [];
    for (let i = 0; i < count; i++) {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const c = Math.floor(Math.random() * 5) + 1;
        let text, answer;
        if (Math.random() > 0.5) {
            text = `${a} * ${b} + ${c}`;
            answer = (a * b) + c;
        } else {
            text = `(${a} + ${b}) * ${c}`;
            answer = (a + b) * c;
        }
        qs.push({ text: text + " = ?", answer: answer });
    }
    return qs;
}