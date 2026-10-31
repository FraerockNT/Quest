const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
    title: '🧩 Загадка',
    description: 'Отгадай загадку или ребус',
    maxScore: 40,
    defaultHint: 'Прочитай вопрос ещё раз, внимательно: ответ часто спрятан в самой формулировке.',
    adminFields: [
        { key: 'question', label: 'Текст загадки или вопроса', type: 'textarea', def: '' },
        { key: 'answer', label: 'Правильный ответ (несколько вариантов — через знак |)', type: 'text', def: '' },
    ],

    init(container, tg, onComplete, cfg = {}) {
        let wrong = cfg.progress?.wrong || 0;
        let busy = false;
        container.innerHTML = `
            <div class="card"><div style="font-size:18px; line-height:1.5; white-space:pre-wrap">${esc(cfg.question || 'Загадка ещё не заполнена администратором.')}</div></div>
            <input type="text" id="riddle-input" placeholder="Твой ответ" autocomplete="off" style="font-size:20px; text-align:center;">
            <p class="note" id="riddle-info"></p>
            <button class="btn" id="riddle-submit">Проверить</button>`;
        const input = container.querySelector('#riddle-input');
        const info = container.querySelector('#riddle-info');
        const showInfo = () => { info.innerText = wrong ? `Ошибок: ${wrong} (каждая снимает 5 баллов, минимум остаётся 10)` : ''; };
        showInfo();

        const submit = async () => {
            const value = input.value.trim();
            if (!value || busy) return;
            busy = true;
            try {
                const r = await cfg.check(value);      // ответ проверяет сервер
                if (r.ok) { tg.HapticFeedback.notificationOccurred('success'); onComplete(40); }
                else {
                    wrong = r.wrong; showInfo();
                    tg.HapticFeedback.notificationOccurred('error');
                    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
                    input.value = '';
                }
            } catch (e) { tg.showAlert(e.message); }
            busy = false;
        };
        container.querySelector('#riddle-submit').onclick = submit;
        input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    },
    destroy() {},
};
