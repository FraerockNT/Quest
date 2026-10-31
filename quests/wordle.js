let dead = false;

export default {
    title: '📝 Слово дня',
    description: 'Угадай загаданное слово',
    maxScore: 50,
    defaultHint: 'Зелёная буква стоит на своём месте, жёлтая есть в слове, но в другом месте, серой в слове нет. Слово связано с Новым годом.',
    adminFields: [
        { key: 'answer', label: 'Загаданное слово (русские буквы, до 13 букв)', type: 'text', def: 'ЁЛОЧКА' },
    ],

    init(container, tg, onComplete, cfg = {}) {
        dead = false;
        const length = cfg.progress?.length || 5;
        const max = cfg.progress?.max || 5;
        const guesses = (cfg.progress?.guesses || []).map((g) => ({ word: g.w, marks: g.m }));
        const timerEl = document.getElementById('quest-timer');
        let busy = false;

        container.innerHTML = `
            <p class="note">Слово из ${length} букв. Попыток: ${max}. Они сохраняются, даже если выйти из задания.</p>
            <div id="wordle-board" class="stack" style="gap:5px"></div>
            <div class="row gap8">
                <input type="text" id="wordle-input" maxlength="${length}" placeholder="Слово" autocomplete="off" style="text-transform:uppercase;">
                <button class="btn btn-auto" id="wordle-submit">Ввод</button>
            </div>`;
        const board = container.querySelector('#wordle-board');
        const input = container.querySelector('#wordle-input');

        const render = () => {
            timerEl.innerText = `${guesses.length}/${max}`;
            let html = '';
            guesses.forEach((g) => {
                html += `<div class="wordle-row">${[...g.word].map((ch, i) => `<div class="wcell m${g.marks[i]}">${ch}</div>`).join('')}</div>`;
            });
            for (let i = guesses.length; i < max; i++) {
                html += `<div class="wordle-row">${'<div class="wcell empty"></div>'.repeat(length)}</div>`;
            }
            board.innerHTML = html;
        };

        const submit = async () => {
            if (busy || dead) return;
            const word = input.value.trim();
            if (word.length !== length) return tg.showAlert(`Нужно слово из ${length} букв`);
            busy = true;
            try {
                const r = await cfg.check(word);       // сервер сам сравнивает со словом, на телефон оно не попадает
                guesses.push({ word: r.word, marks: r.marks });
                input.value = '';
                tg.HapticFeedback.impactOccurred('light');
                render();
                if (r.ok) { tg.HapticFeedback.notificationOccurred('success'); onComplete(50); }
                else if (r.over) { tg.HapticFeedback.notificationOccurred('error'); onComplete(0); }
            } catch (e) { tg.showAlert(e.message); }
            busy = false;
        };

        render();
        // Если игрок вышел в самый последний момент — доводим задание до конца
        const last = guesses[guesses.length - 1];
        if (last && last.marks.every((m) => m === 2)) return onComplete(50);
        if (guesses.length >= max) return onComplete(0);

        container.querySelector('#wordle-submit').onclick = submit;
        input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    },

    destroy() { dead = true; },
};
