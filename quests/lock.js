// Все коды из d разных цифр (в том числе начинающиеся с нуля)
const cache = {};
function allCodes(d) {
    if (cache[d]) return cache[d];
    const out = [];
    const rec = (cur) => {
        if (cur.length === d) return out.push(cur);
        for (let k = 0; k < 10; k++) if (!cur.includes(String(k))) rec(cur + k);
    };
    rec('');
    return (cache[d] = out);
}

// Сколько цифр угадано на месте / верных, но не на месте
function feedback(guess, secret) {
    let right = 0, common = 0;
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === secret[i]) right++;
        if (secret.includes(guess[i])) common++;
    }
    return [right, common - right];
}

// Подсказки подбираются так, чтобы подходил ровно один код
function makePuzzle(d) {
    const ALL = allCodes(d);
    const secret = ALL[Math.floor(Math.random() * ALL.length)];
    let candidates = ALL;
    const clues = [];
    let guard = 0;
    while (candidates.length > 1 && guard++ < 800) {
        const guess = ALL[Math.floor(Math.random() * ALL.length)];
        if (guess === secret || clues.some((c) => c.guess === guess)) continue;
        const [r, w] = feedback(guess, secret);
        const next = candidates.filter((c) => { const f = feedback(guess, c); return f[0] === r && f[1] === w; });
        if (next.length < candidates.length) { clues.push({ guess, r, w }); candidates = next; }
    }
    return { secret, clues };
}

const DIGITS = { easy: 3, medium: 4, hard: 5 };
let timer, alive = false;

export default {
    title: '🔐 Сейф Деда Мороза',
    description: 'Взломай код по записке',
    defaultPoints: 40,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Начни со строки «✕ ни одной»: все её цифры можно сразу вычеркнуть. Потом ищи, какие цифры повторяются в нескольких строках.',
    makePuzzle, feedback, allCodes,   // экспорт для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — код из 3 цифр'], ['medium', 'Средняя — код из 4 цифр'], ['hard', 'Сложная — код из 5 цифр']] },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(timer); alive = true;
        const d = DIGITS[cfg.difficulty] || 4;
        const prog = cfg.progress || {};
        // Загадка создаётся один раз для команды и сохраняется
        let puzzle = prog.puzzle && prog.puzzle.secret.length === d ? prog.puzzle : null;
        let wrong = prog.lockWrong || 0, until = prog.lockUntil || 0;
        if (!puzzle) { puzzle = makePuzzle(d); cfg.saveProgress?.({ puzzle, lockWrong: 0, lockUntil: 0 }); }
        const save = () => cfg.saveProgress?.({ puzzle, lockWrong: wrong, lockUntil: until });

        container.innerHTML = `
            <p class="note">В сейфе спрятан код из ${d} разных цифр. Записка поможет его вычислить.</p>
            <canvas id="lock-note" class="note-canvas"></canvas>
            <input type="text" id="lock-input" inputmode="numeric" maxlength="${d}" placeholder="${'X'.repeat(d)}" style="font-size:28px; text-align:center; letter-spacing:10px;">
            <p class="note" id="lock-info"></p>
            <button class="btn" id="lock-submit">Открыть сейф</button>`;

        // Записка нарисована картинкой: её нельзя выделить и скопировать как текст
        const cv = container.querySelector('#lock-note');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = 340, rowH = 38, H = 78 + puzzle.clues.length * rowH;
        cv.width = W * dpr; cv.height = H * dpr; cv.style.aspectRatio = `${W} / ${H}`;
        const g = cv.getContext('2d'); g.scale(dpr, dpr);
        g.fillStyle = '#f4e6c0'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 12) : g.rect(0, 0, W, H); g.fill();
        g.fillStyle = '#7a4a1a'; g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center';
        g.fillText('Записка из мешка Деда Мороза', W / 2, 24);
        g.font = '12px Georgia, serif'; g.fillStyle = '#5b4630';
        g.fillText('●  верная цифра на своём месте      ◐  верная, но не на месте', W / 2, 46);
        puzzle.clues.forEach((c, i) => {
            const y = 78 + i * rowH;
            g.textAlign = 'left'; g.fillStyle = '#b3122a'; g.font = 'bold 24px ui-monospace, Menlo, monospace';
            g.fillText([...c.guess].join(' '), 22, y);
            g.fillStyle = '#1f5a3a'; g.font = '22px Georgia, serif';
            const marks = (c.r || c.w) ? '●'.repeat(c.r) + '◐'.repeat(c.w) : '✕  ни одной';
            g.fillText(marks, 22 + d * 28 + 24, y);
        });

        const input = container.querySelector('#lock-input');
        const info = container.querySelector('#lock-info');
        const btn = container.querySelector('#lock-submit');
        const ratio = () => Math.max(0.25, 1 - 0.12 * wrong);

        const refresh = () => {
            const left = Math.ceil((until - Date.now()) / 1000);
            if (left > 0) { btn.disabled = true; info.innerText = `Сейф заблокирован ещё на ${left} с. Подумай!`; }
            else { btn.disabled = false; info.innerText = wrong ? `Ошибок: ${wrong} (каждая снимает 12% баллов; после трёх подряд сейф блокируется)` : ''; }
        };
        timer = setInterval(refresh, 500); refresh();

        const submit = () => {
            if (Date.now() < until) return;
            if (input.value === puzzle.secret) {
                tg.HapticFeedback.notificationOccurred('success');
                alive = false; clearInterval(timer); onComplete(ratio());
            } else {
                wrong++;
                if (wrong % 3 === 0) until = Date.now() + 30000;    // пауза после каждых трёх ошибок
                save();
                tg.HapticFeedback.notificationOccurred('error');
                input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
                input.value = ''; refresh();
            }
        };
        btn.onclick = submit;
        input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    },
    destroy() { clearInterval(timer); alive = false; },
};
