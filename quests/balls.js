// Ёлочные шары по коробкам: разложи шары так, чтобы в каждой коробке лежал один цвет.
// Шар можно положить в пустую коробку или на шар такого же цвета. В коробке помещается 4 шара.
const COLORS = ['#ff4257', '#3ddc84', '#4aa3ff', '#ffd23f', '#b48cff', '#ff8fd8', '#ff9a3c', '#35e0d0'];
const CAP = 4;
const LEVEL = { easy: 4, medium: 6, hard: 8 };   // сколько цветов (коробок будет на 2 больше)
let alive = false, saveNow = () => {};

const rand = (n) => Math.floor(Math.random() * n);
const isSolved = (tubes) => tubes.every((t) => t.length === 0 || (t.length === CAP && t.every((v) => v === t[0])));

// Расставляем «наоборот»: от собранного состояния делаем обратные ходы. Поэтому решение есть всегда.
function makePuzzle(colors) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const tubes = Array.from({ length: colors + 2 }, (_, i) => (i < colors ? Array(CAP).fill(i) : []));
        for (let k = 0; k < colors * CAP * 8; k++) {
            const from = [];
            tubes.forEach((t, i) => { if (t.length && (t.length === 1 || t[t.length - 2] === t[t.length - 1])) from.push(i); });
            if (!from.length) break;                     // больше нечего перемешивать
            const b = from[rand(from.length)];
            const to = tubes.map((_, i) => i).filter((i) => i !== b && tubes[i].length < CAP);
            if (!to.length) break;
            const a = to[rand(to.length)];
            tubes[a].push(tubes[b].pop());
        }
        const mixed = tubes.filter((t) => new Set(t).size > 1).length;
        if (!isSolved(tubes) && mixed >= Math.max(2, colors - 2)) return tubes;
    }
    return Array.from({ length: colors + 2 }, (_, i) => (i < colors ? Array(CAP).fill(i) : [])).map((t, i, all) => (i === 0 ? [0, 0, 0, 1] : i === 1 ? [1, 1, 1, 0] : t));
}

export default {
    title: '🎊 Шары по коробкам',
    description: 'Разложи ёлочные шары по цветам',
    defaultPoints: 40,
    defaultHint: 'Сначала освободи пустую коробку: переложи верхние шары так, чтобы одна коробка опустела. Не бойся кнопки «Отменить ход». Шары одного цвета лучше собирать в той коробке, где их уже больше.',
    makePuzzle, isSolved,   // экспорт для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность (количество цветов)', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — 4 цвета'], ['medium', 'Средняя — 6 цветов'], ['hard', 'Сложная — 8 цветов']] },
    ],

    init(container, tg, onComplete, cfg = {}) {
        alive = true;
        const colors = LEVEL[cfg.difficulty] || LEVEL.medium;
        const prog = cfg.progress || {};
        const ok = prog.tubes && prog.tubes.length === colors + 2;
        const start = ok ? prog.start : makePuzzle(colors);
        let tubes = ok ? prog.tubes : start.map((t) => t.slice());
        let history = ok ? prog.history || [] : [];
        let moves = ok ? prog.moves || 0 : 0, sel = null, done = false;
        saveNow = () => alive && cfg.saveProgress?.({ tubes, start, history: history.slice(-80), moves });
        if (!ok) saveNow();
        const timerEl = document.getElementById('quest-timer');

        container.innerHTML = `
            <p class="note">Нажми на коробку, чтобы взять верхний шар, потом на коробку, куда его положить. Класть можно в пустую коробку или на такой же цвет.</p>
            <div class="balls-grid" id="balls-grid" style="grid-template-columns:repeat(${Math.ceil((colors + 2) / 2)}, 1fr)"></div>
            <div class="row gap8">
                <button class="btn btn-ghost" id="balls-undo">↩ Отменить ход</button>
                <button class="btn btn-ghost" id="balls-reset">🔄 С начала</button>
            </div>`;
        const grid = container.querySelector('#balls-grid');

        const render = () => {
            grid.innerHTML = '';
            tubes.forEach((t, i) => {
                const box = document.createElement('div');
                box.className = 'bbox' + (sel === i ? ' sel' : '');
                t.forEach((c, k) => {
                    const ball = document.createElement('div');
                    ball.className = 'ball' + (sel === i && k === t.length - 1 ? ' up' : '');
                    ball.style.setProperty('--c', COLORS[c % COLORS.length]);
                    box.appendChild(ball);
                });
                box.onclick = () => tap(i, box);
                grid.appendChild(box);
            });
            timerEl.innerText = `Ходов: ${moves}`;
        };

        const tap = (i, box) => {
            if (done) return;
            if (sel === null) { if (tubes[i].length) { sel = i; tg.HapticFeedback.impactOccurred('light'); render(); } return; }
            if (sel === i) { sel = null; render(); return; }
            const x = tubes[sel][tubes[sel].length - 1], dst = tubes[i];
            if (dst.length < CAP && (dst.length === 0 || dst[dst.length - 1] === x)) {
                tubes[sel].pop(); dst.push(x);
                history.push([sel, i]); moves++; sel = null;
                tg.HapticFeedback.impactOccurred('medium');
                saveNow(); render();
                if (isSolved(tubes)) {
                    done = true; alive = false;
                    tg.HapticFeedback.notificationOccurred('success');
                    setTimeout(() => onComplete(1), 600);
                }
            } else {
                tg.HapticFeedback.notificationOccurred('error');
                box.classList.add('shake');
                sel = tubes[i].length ? i : null;     // нельзя сюда: выбираем другую коробку
                setTimeout(render, 280);
            }
        };

        container.querySelector('#balls-undo').onclick = () => {
            if (done || !history.length) return;
            const [from, to] = history.pop();
            tubes[from].push(tubes[to].pop()); moves = Math.max(0, moves - 1); sel = null;
            saveNow(); render();
        };
        container.querySelector('#balls-reset').onclick = () => {
            if (done) return;
            tubes = start.map((t) => t.slice()); history = []; moves = 0; sel = null;
            saveNow(); render();
        };
        render();
    },

    destroy() { if (alive) saveNow(); alive = false; },
};
