const equations = [
    { text: "6 + 4 = 4", target: "0 + 4 = 4", options: ["0", "5", "8", "9"] },
    { text: "9 - 2 = 6", target: "9 - 3 = 6", options: ["3", "1", "4", "0"] },
    { text: "8 + 1 = 6", target: "0 + 6 = 6", options: ["0", "9", "2", "5"] },
    { text: "5 + 4 = 8", target: "5 + 3 = 8", options: ["3", "2", "6", "9"] }
];

export default {
    title: "🔥 Спички",
    description: "Исправь выражение",
    init(container, tg, onComplete) {
        const eq = equations[Math.floor(Math.random() * equations.length)];

        container.innerHTML = `
            <p style="text-align:center; margin-bottom:20px; color:gray; font-size:14px;">Выбери правильную цифру, чтобы выражение стало верным (переставь палочку):</p>
            <div style="font-size:40px; font-weight:bold; text-align:center; margin: 30px 0; letter-spacing: 5px;">
                ${eq.text}
            </div>
            <div id="match-options" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;"></div>
        `;

        const optsContainer = document.getElementById('match-options');
        eq.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.width = '60px';
            btn.style.height = '60px';
            btn.style.fontSize = '24px';
            btn.style.margin = '0';
            btn.innerText = opt;

            btn.onclick = () => {
                // Проверяем, совпадает ли выбранная цифра с нужной
                // (упрощенная логика: если цифра есть в правильном ответе)
                if (eq.target.includes(opt) && eq.text !== eq.target) {
                    tg.HapticFeedback.notificationOccurred('success');
                    onComplete(30); // 30 баллов за решение
                } else {
                    tg.HapticFeedback.notificationOccurred('error');
                    tg.showAlert("Неверно! Попробуй другую цифру.");
                }
            };
            optsContainer.appendChild(btn);
        });
    },
    destroy() {}
};