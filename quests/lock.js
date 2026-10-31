export default {
    title: "🔐 Кодовый замок",
    description: "Угадай код по подсказкам",
    init(container, tg, onComplete) {
        container.innerHTML = `
            <div style="font-size:14px; line-height:1.5; margin-bottom:20px;">
                <p>🔸 <b>682</b> — Одна цифра верна и стоит на своем месте</p>
                <p>🔸 <b>614</b> — Одна цифра верна, но стоит не на своем месте</p>
                <p>🔸 <b>206</b> — Две цифры верны, но стоят не на своих местах</p>
                <p>🔸 <b>738</b> — Ни одна цифра не верна</p>
                <p>🔸 <b>780</b> — Одна цифра верна, но стоит не на своем месте</p>
            </div>
            <input type="text" id="lock-input" maxlength="3" placeholder="XXX" style="font-size:24px; width:50%; margin:0 auto; padding:10px; border-radius:10px; border:1px solid #ccc; text-align:center; letter-spacing: 10px;">
            <button class="btn" id="lock-submit" style="margin-top:20px;">Открыть замок</button>
        `;

        document.getElementById('lock-submit').onclick = () => {
            const val = document.getElementById('lock-input').value;
            if (val === "042") {
                tg.HapticFeedback.notificationOccurred('success');
                onComplete(40);
            } else {
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert("Неверный код!");
            }
        };
    },
    destroy() {}
};