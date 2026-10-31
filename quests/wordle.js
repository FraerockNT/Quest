let secretWord, maxAttempts, currentAttempt, wordLength;

export default {
    title: "📝 Слово дня",
    description: "Угадай слово",
    init(container, tg, onComplete, questConfig) {
        secretWord = (questConfig.wordleWord || "КВЕСТ").toUpperCase();
        wordLength = secretWord.length;

        // Логика попыток
        if (wordLength <= 6) maxAttempts = 5;
        else if (wordLength <= 9) maxAttempts = 7;
        else if (wordLength <= 12) maxAttempts = 9;
        else maxAttempts = 10;

        currentAttempt = 0;
        let guesses = [];

        document.getElementById('quest-timer').innerText = `0/${maxAttempts}`;

        const renderBoard = () => {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:20px;" id="wordle-board"></div>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="wordle-input" maxlength="${wordLength}" placeholder="Слово" style="flex:1; padding:10px; font-size:18px; text-transform:uppercase; border-radius:8px; border:1px solid #ccc;">
                    <button class="btn" id="wordle-submit" style="width: auto; margin:0;">Ввод</button>
                </div>
            `;

            const board = document.getElementById('wordle-board');

            // Рисуем предыдущие попытки
            guesses.forEach(guess => {
                let rowHtml = `<div style="display:flex; gap:5px; justify-content:center;">`;
                for (let i = 0; i < wordLength; i++) {
                    let color = "#ccc"; // Серый по умолчанию
                    if (guess.word[i] === secretWord[i]) color = "#2ed573"; // Зеленый (на своем месте)
                    else if (secretWord.includes(guess.word[i])) color = "#eccc68"; // Желтый (есть в слове)

                    rowHtml += `<div style="width:40px; height:40px; background:${color}; border-radius:5px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white;">${guess.word[i]}</div>`;
                }
                rowHtml += `</div>`;
                board.innerHTML += rowHtml;
            });

            // Рисуем пустые строки
            for (let i = guesses.length; i < maxAttempts; i++) {
                let rowHtml = `<div style="display:flex; gap:5px; justify-content:center; opacity:0.3;">`;
                for (let j = 0; j < wordLength; j++) {
                    rowHtml += `<div style="width:40px; height:40px; border:1px solid #999; border-radius:5px; display:flex; align-items:center; justify-content:center; font-weight:bold;"></div>`;
                }
                rowHtml += `</div>`;
                board.innerHTML += rowHtml;
            }

            const input = document.getElementById('wordle-input');
            const submit = document.getElementById('wordle-submit');

            const checkWord = () => {
                const word = input.value.toUpperCase();
                if (word.length !== wordLength) return tg.showAlert(`Слово должно быть из ${wordLength} букв`);

                guesses.push({ word });
                currentAttempt++;
                document.getElementById('quest-timer').innerText = `${currentAttempt}/${maxAttempts}`;
                tg.HapticFeedback.impactOccurred('light');

                if (word === secretWord) {
                    tg.HapticFeedback.notificationOccurred('success');
                    onComplete(50); // 50 баллов за победу
                    return;
                }

                if (currentAttempt >= maxAttempts) {
                    tg.HapticFeedback.notificationOccurred('error');
                    tg.showAlert(`Не угадал! Было слово: ${secretWord}`);
                    onComplete(0); // 0 баллов
                    return;
                }

                input.value = '';
                renderBoard();
            };
            submit.onclick = checkWord;
            input.onkeydown = (e) => { if (e.key === 'Enter') checkWord(); };
        };

        renderBoard();
        this.destroy = () => {};
    }
};