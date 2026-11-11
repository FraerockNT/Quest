const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let timer;

export default {
    title: '🧩 Загадка',
    description: 'Отгадай загадку или найди ответ на локации',
    defaultPoints: 40,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Перечитай условие медленно. Если есть фото — рассмотри детали. Ответ может быть спрятан прямо на локации.',
    adminFields: [
        { key: 'difficulty', label: 'Сложность (штраф за ошибки и паузы между попытками)', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — ошибка −10%, пауза 20 с'], ['medium', 'Средняя — ошибка −18%, пауза 45 с'], ['hard', 'Сложная — ошибка −25%, пауза 90 с']] },
        { key: 'question', label: 'Текст загадки или вопроса', type: 'textarea', def: '' },
        { key: 'answer', label: 'Правильный ответ (несколько вариантов — через знак |)', type: 'text', def: '' },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(timer);
        let wrong = cfg.progress?.wrong || 0;
        let waitUntil = Date.now() + (cfg.progress?.wait || 0) * 1000;
        let busy = false;
        container.innerHTML = `
            <div class="card">
                <div style="font-size:18px; line-height:1.5; white-space:pre-wrap">${esc(cfg.question || 'Загадка ещё не заполнена администратором.')}</div>
                ${cfg.image ? `<img src="${cfg.image}" alt="" style="width:100%;border-radius:12px;margin-top:6px">` : ''}
            </div>
            <input type="text" id="riddle-input" placeholder="Твой ответ" autocomplete="off" style="font-size:20px; text-align:center;">
            <p class="note" id="riddle-info"></p>
            <button class="btn" id="riddle-submit">Проверить</button>`;
        const input = container.querySelector('#riddle-input');
        const info = container.querySelector('#riddle-info');
        const btn = container.querySelector('#riddle-submit');

        const refresh = () => {
            const left = Math.ceil((waitUntil - Date.now()) / 1000);
            if (left > 0) { btn.disabled = true; info.innerText = `Слишком много ошибок. Подожди ${left} с и подумай ещё.`; }
            else { btn.disabled = false; info.innerText = wrong ? `Ошибок: ${wrong} (каждая снимает часть баллов)` : ''; }
        };
        timer = setInterval(refresh, 500); refresh();

        const submit = async () => {
            const value = input.value.trim();
            if (!value || busy || btn.disabled) return;
            busy = true;
            try {
                const r = await cfg.check(value);      // ответ проверяет сервер, на телефоне его нет
                if (r.ok) { tg.HapticFeedback.notificationOccurred('success'); clearInterval(timer); onComplete(1); }
                else {
                    wrong = r.wrong; waitUntil = Date.now() + (r.wait || 0) * 1000; refresh();
                    tg.HapticFeedback.notificationOccurred('error');
                    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
                    input.value = '';
                }
            } catch (e) { tg.showAlert(e.message); }
            busy = false;
        };
        btn.onclick = submit;
        input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    },
    destroy() { clearInterval(timer); },
};
