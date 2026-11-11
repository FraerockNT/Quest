const COLORS = ['#ff4257', '#3ddc84', '#4aa3ff', '#ffd23f', '#b48cff', '#ff8fd8', '#ff9a3c', '#35e0d0', '#c6ff4a', '#ffffff'];
// скорость: сколько миллисекунд между огоньками и сколько огонёк горит
const SPEEDS = { medium: { step: 750, lit: 480 }, fast: { step: 470, lit: 290 }, ultra: { step: 290, lit: 170 } };
let timers = [], dead = true, saveNow = () => {};

const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

export default {
    title: '💡 Огни гирлянды',
    description: 'Запомни и повтори порядок, в котором мигают лампочки',
    defaultPoints: 30,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Не пытайся запомнить цвета — запоминай «рисунок»: например, «слева, потом через одну, потом в конец». Или придумай мелодию.',
    adminFields: [
        { key: 'simonBulbs', label: 'Сколько лампочек в гирлянде (3–10)', type: 'number', def: 6, min: 3, max: 10 },
        { key: 'simonSpeed', label: 'Скорость мигания', type: 'select', def: 'medium',
          options: [['medium', 'Средняя'], ['fast', 'Быстрая'], ['ultra', 'Ультрабыстрая']] },
        { key: 'simonRounds', label: 'Длина последовательности (3–14)', type: 'number', def: 6, min: 3, max: 14 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); dead = false;
        const bulbs = Math.min(10, Math.max(3, num(cfg.simonBulbs, 6)));
        const rounds = Math.min(14, Math.max(3, num(cfg.simonRounds, 6)));
        const sp = SPEEDS[cfg.simonSpeed] || SPEEDS.medium;
        const prog = cfg.progress || {};
        // Последовательность создаётся один раз и сохраняется
        const seq = prog.seq || Array.from({ length: rounds }, () => Math.floor(Math.random() * bulbs));
        let round = prog.round || 0, mistakes = prog.mistakes || 0, pos = 0, accepting = false;
        saveNow = () => cfg.saveProgress?.({ seq, round, mistakes });
        if (!prog.seq) saveNow();

        // Лампочки висят на проводах: не больше 5 в ряду, провод провисает дугой
        const perRow = bulbs <= 5 ? bulbs : Math.ceil(bulbs / 2);
        const rows = [];
        for (let i = 0; i < bulbs; i += perRow) rows.push(Array.from({ length: Math.min(perRow, bulbs - i) }, (_, k) => i + k));
        container.innerHTML = `
            <p class="note" id="simon-note">Нажми «Начать» и следи за лампочками.</p>
            <div class="garland-box">${rows.map((row) => `<div class="g-row"><div class="g-wire"></div>
                ${row.map((i, k) => `<button class="g-bulb" data-i="${i}" aria-label="лампочка ${i + 1}" style="--c:${COLORS[i % COLORS.length]}; margin-top:${Math.round(Math.sin(Math.PI * (k + 0.5) / row.length) * 20)}px"></button>`).join('')}
            </div>`).join('')}</div>
            <button class="btn" id="simon-start">${round ? 'Продолжить' : 'Начать'}</button>`;
        const timerEl = document.getElementById('quest-timer');
        const note = container.querySelector('#simon-note');
        const pads = [...container.querySelectorAll('.g-bulb')];
        const later = (fn, ms) => timers.push(setTimeout(() => { if (!dead) fn(); }, ms));
        const flash = (i, ms = sp.lit) => { pads[i].classList.add('lit'); later(() => pads[i].classList.remove('lit'), ms); };
        const ratio = () => Math.max(0.3, 1 - 0.1 * mistakes);

        const startRound = () => {
            pos = 0; accepting = false;
            timerEl.innerText = `Раунд ${round}/${rounds}`;
            note.innerText = 'Смотри внимательно…';
            seq.slice(0, round).forEach((v, k) => later(() => { flash(v); tg.HapticFeedback.impactOccurred('light'); }, 700 + k * sp.step));
            later(() => { accepting = true; note.innerText = 'Теперь повтори!'; }, 700 + round * sp.step);
        };
        const next = () => { round++; saveNow(); startRound(); };

        pads.forEach((p) => p.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (!accepting) return;
            const i = Number(p.dataset.i);
            flash(i, 220);
            if (i === seq[pos]) {
                pos++;
                if (pos === round) {
                    accepting = false;
                    if (round === rounds) {
                        tg.HapticFeedback.notificationOccurred('success');
                        later(() => onComplete(ratio()), 500);
                    } else { note.innerText = 'Верно! Дальше длиннее…'; later(next, 900); }
                }
            } else {
                mistakes++; accepting = false; saveNow();
                tg.HapticFeedback.notificationOccurred('error');
                note.innerText = `Ошибка (${mistakes}). Смотри ещё раз.`;
                later(startRound, 1300);
            }
        }));

        container.querySelector('#simon-start').onclick = (e) => {
            e.target.classList.add('hidden');
            if (!round) round = 1;
            saveNow(); startRound();
        };
    },

    destroy() { dead = true; timers.forEach(clearTimeout); timers = []; },
};
