let interval, alive = false, saveNow = () => {};

const r = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

// Новогодние задачи: числа каждый раз случайные, поэтому готового ответа в интернете нет
const MAKERS = {
    easy: [
        () => { const a = r(5, 20), b = r(5, 20), c = r(3, 10); return { text: `На ёлке ${a} красных и ${b} синих шаров. ${c} шаров разбилось. Сколько шаров осталось?`, answer: a + b - c }; },
        () => { const a = r(3, 9), b = r(4, 12); return { text: `Дед Мороз принёс ${a} мешков, в каждом по ${b} подарков. Сколько всего подарков?`, answer: a * b }; },
        () => { const a = r(20, 40), b = r(5, 15); return { text: `В гирлянде ${a} лампочек, ${b} из них перегорели. Сколько лампочек горит?`, answer: a - b }; },
    ],
    medium: [
        () => { const a = r(3, 8), b = r(6, 12), c = r(5, a * b - 5); return { text: `Снегурочка испекла ${a} противней по ${b} печений. Гости съели ${c}. Сколько печений осталось?`, answer: a * b - c }; },
        () => { const a = r(4, 9), b = r(2, 4), c = r(2, 5); return { text: `В гирлянде ${a} красных лампочек, жёлтых в ${b} раза больше, а синих на ${c} меньше, чем жёлтых. Сколько лампочек всего?`, answer: a + a * b + (a * b - c) }; },
        () => { const b = r(2, 5), k = r(20, 60); return { text: `Ёлка высотой ${b * k} см, а снеговик в ${b} раза ниже. На сколько сантиметров ёлка выше снеговика?`, answer: b * k - k }; },
    ],
    hard: [
        () => {
            const n = r(12, 30), p = r(3, 9), k = r(3, 7), total = n * p;
            let q = total % k; if (q === 0) q = k;
            return { text: `В зале ${n} детей, каждому Дед Мороз дал по ${p} конфет. ${q} конфет он съел сам, а остальные разделили поровну между ${k} командами. Сколько конфет у каждой команды?`, answer: (total - q) / k };
        },
        () => {
            const price = 100 * r(6, 30), d = [10, 20, 25, 30, 40, 50][r(0, 5)];
            return { text: `Ёлка стоила ${price} ₽. В новогоднюю распродажу скидка ${d}%. Сколько рублей стоит ёлка со скидкой?`, answer: price - (price * d) / 100 };
        },
        () => {
            const a = r(3, 9), b = r(3, 9), c = r(3, 8), d = r(2, 6), e = r(2, 6);
            return { text: `(${a} + ${b}) × ${c} − ${d} × ${e} = ?`, answer: (a + b) * c - d * e };
        },
        () => {
            const a = r(2, 6), b = r(5, 9), c = r(10, 30);
            return { text: `Санта и Дед Мороз развозят подарки. Санта сделал ${a} рейсов по ${b * 10} подарков, а Дед Мороз ${c} рейсов по ${b} подарков. Кто привёз больше и на сколько? Введи разницу (число).`, answer: Math.abs(a * b * 10 - c * b) };
        },
    ],
};

function generate(count, diff) {
    const makers = MAKERS[diff] || MAKERS.medium;
    const used = new Set(), out = [];
    while (out.length < count) {
        const q = makers[r(0, makers.length - 1)]();
        if (q.answer < 0 || used.has(q.text)) continue;
        used.add(q.text); out.push(q);
    }
    return out;
}

export default {
    title: '🧮 Новогодняя математика',
    description: 'Реши задачи Деда Мороза',
    defaultPoints: 50,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Выпиши числа из условия и реши по шагам: сначала то, что в скобках или «в несколько раз», потом сложение и вычитание.',
    generate,   // экспорт для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — одна-две операции'], ['medium', 'Средняя — несколько действий'], ['hard', 'Сложная — деление, проценты, длинные условия']] },
        { key: 'mathCount', label: 'Количество задач (1–15)', type: 'number', def: 5, min: 1, max: 15 },
        { key: 'mathTime', label: 'Секунд на одну задачу', type: 'number', def: 60, min: 10, max: 300 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(interval); alive = true;
        const count = Math.min(15, Math.max(1, num(cfg.mathCount, 5)));
        const limit = Math.min(300, Math.max(10, num(cfg.mathTime, 60)));
        const prog = cfg.progress || {};
        // Задачи создаются один раз и сохраняются, чтобы при возвращении были те же
        const questions = prog.questions || generate(count, cfg.difficulty || 'medium');
        let idx = prog.idx || 0, correct = prog.correct || 0, wrongs = prog.wrongs || 0;
        let timeLeft = prog.timeLeft ?? limit;
        saveNow = () => alive && cfg.saveProgress?.({ questions, idx, correct, wrongs, timeLeft });
        if (!prog.questions) saveNow();
        const timerEl = document.getElementById('quest-timer');

        const finish = () => {
            alive = false; clearInterval(interval);
            const ratio = correct === 0 ? 0 : Math.max(0.1, correct / questions.length - 0.04 * wrongs);
            tg.HapticFeedback.notificationOccurred(ratio > 0 ? 'success' : 'error');
            onComplete(Math.min(1, ratio));
        };

        const render = () => {
            if (!alive) return;
            if (idx >= questions.length) return finish();
            const q = questions[idx];
            container.innerHTML = `
                <p class="note">Задача ${idx + 1} из ${questions.length} · решено верно: ${correct}</p>
                <div class="card"><div style="font-size:19px; line-height:1.45">${q.text}</div></div>
                <input type="number" inputmode="numeric" id="math-input" placeholder="Ответ" style="font-size:26px; text-align:center;">
                <button class="btn" id="math-submit">Ответить</button>`;
            const input = container.querySelector('#math-input');
            timerEl.innerText = `⏱ ${timeLeft}с`;
            clearInterval(interval);
            interval = setInterval(() => {
                timeLeft--;
                timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
                if (timeLeft <= 0) {          // время вышло: задача не засчитана, идём дальше
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('error');
                    idx++; timeLeft = limit; saveNow();
                    tg.showAlert('Время вышло! Эта задача не засчитана.', render);
                }
            }, 1000);

            const check = () => {
                if (input.value === '') return;
                if (parseInt(input.value, 10) === q.answer) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('success');
                    correct++; idx++; timeLeft = limit; saveNow(); render();
                } else {
                    wrongs++; saveNow();
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

    destroy() { if (alive) saveNow(); alive = false; clearInterval(interval); },
};
