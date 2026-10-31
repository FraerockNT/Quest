let timers = [], dead = false;

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

export default {
    title: '💡 Огни гирлянды',
    description: 'Запомни и повтори последовательность огней',
    maxScore: 30,
    defaultHint: 'Придумай мелодию или проговаривай цвета вслух: «красный, синий, синий…». Так запоминать проще.',
    adminFields: [{ key: 'simonRounds', label: 'Длина последовательности (3–10)', type: 'number', def: 6, min: 3, max: 10 }],

    init(container, tg, onComplete, cfg = {}) {
        this.destroy(); dead = false;
        const rounds = clamp(cfg.simonRounds, 3, 10, 6);
        const seq = Array.from({ length: rounds }, () => Math.floor(Math.random() * 4));
        const timerEl = document.getElementById('quest-timer');
        let round = 0, pos = 0, mistakes = 0, accepting = false;

        container.innerHTML = `
            <p class="note" id="simon-note">Нажми «Начать» и смотри на огни.</p>
            <div class="simon-grid">${[0, 1, 2, 3].map((i) => `<button class="pad p${i}" data-i="${i}" aria-label="огонь ${i + 1}"></button>`).join('')}</div>
            <button class="btn" id="simon-start">Начать</button>`;
        const note = container.querySelector('#simon-note');
        const pads = [...container.querySelectorAll('.pad')];
        const later = (fn, ms) => timers.push(setTimeout(() => { if (!dead) fn(); }, ms));
        const flash = (i, ms = 380) => { pads[i].classList.add('lit'); later(() => pads[i].classList.remove('lit'), ms); };

        const startRound = () => {
            round++; pos = 0; accepting = false;
            timerEl.innerText = `Раунд ${round}/${rounds}`;
            note.innerText = 'Смотри внимательно…';
            seq.slice(0, round).forEach((v, k) => later(() => { flash(v); tg.HapticFeedback.impactOccurred('light'); }, 700 + k * 650));
            later(() => { accepting = true; note.innerText = 'Теперь повтори!'; }, 700 + round * 650);
        };

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
                        later(() => onComplete(Math.max(10, 30 - 5 * mistakes)), 500);
                    } else { note.innerText = 'Верно! Дальше длиннее…'; later(startRound, 900); }
                }
            } else {
                mistakes++; accepting = false;
                tg.HapticFeedback.notificationOccurred('error');
                note.innerText = `Ошибка (${mistakes}). Смотри ещё раз.`;
                round--;
                later(startRound, 1300);
            }
        }));

        container.querySelector('#simon-start').onclick = (e) => { e.target.classList.add('hidden'); startRound(); };
    },

    destroy() { dead = true; timers.forEach(clearTimeout); timers = []; },
};
