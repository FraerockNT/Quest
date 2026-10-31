// Все 3-значные коды с разными цифрами (в том числе с нуля, например 042)
const ALL = [];
for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) {
    if (a !== b && b !== c && a !== c) ALL.push(`${a}${b}${c}`);
}

// Сколько цифр угадано на месте / угадано, но не на месте
function feedback(guess, secret) {
    let right = 0, common = 0;
    for (let i = 0; i < 3; i++) {
        if (guess[i] === secret[i]) right++;
        if (secret.includes(guess[i])) common++;
    }
    return [right, common - right];
}

// Подбираем подсказки так, чтобы подходил ровно один код
function makePuzzle() {
    const secret = ALL[Math.floor(Math.random() * ALL.length)];
    let candidates = ALL.slice();
    const clues = [];
    let guard = 0;
    while (candidates.length > 1 && guard++ < 500) {
        const guess = ALL[Math.floor(Math.random() * ALL.length)];
        if (guess === secret || clues.some((c) => c.guess === guess)) continue;
        const [r, w] = feedback(guess, secret);
        const next = candidates.filter((c) => { const f = feedback(guess, c); return f[0] === r && f[1] === w; });
        if (next.length < candidates.length) { clues.push({ guess, r, w }); candidates = next; }
    }
    return { secret, clues };
}

const WORDS = { 1: ['Одна цифра верна', 'и стоит на своём месте', 'но стоит не на своём месте'],
                2: ['Две цифры верны', 'и стоят на своих местах', 'но стоят не на своих местах'],
                3: ['Три цифры верны', 'и стоят на своих местах', 'но стоят не на своих местах'] };
function clueText(c) {
    if (c.r === 0 && c.w === 0) return 'Ни одна цифра не верна';
    const parts = [];
    if (c.r) parts.push(`${WORDS[c.r][0]} ${WORDS[c.r][1]}`);
    if (c.w) {
        const head = WORDS[c.w][0];
        parts.push(`${c.r ? 'ещё ' + head[0].toLowerCase() + head.slice(1) : head}, ${WORDS[c.w][2]}`);
    }
    return parts.join('; ');
}

export default {
    title: '🔐 Кодовый замок',
    description: 'Угадай код по подсказкам',
    maxScore: 40,
    defaultHint: 'Начни с подсказки «Ни одна цифра не верна»: все её цифры можно сразу вычеркнуть.',

    init(container, tg, onComplete, cfg = {}) {
        let puzzle = cfg.progress?.puzzle;
        let wrong = cfg.progress?.lockWrong || 0;
        if (!puzzle) { puzzle = makePuzzle(); cfg.saveProgress?.({ puzzle, lockWrong: 0 }); }

        container.innerHTML = `
            <p class="note">Каждая строка — попытка с подсказкой. Найди секретный код из 3 разных цифр.</p>
            <div class="card">${puzzle.clues.map((c) => `<div>🔸 <b style="letter-spacing:3px">${c.guess}</b> — ${clueText(c)}</div>`).join('')}</div>
            <input type="text" id="lock-input" inputmode="numeric" maxlength="3" placeholder="XXX" style="font-size:28px; text-align:center; letter-spacing:12px;">
            <p class="note" id="lock-info"></p>
            <button class="btn" id="lock-submit">Открыть замок</button>`;

        const input = container.querySelector('#lock-input');
        const info = container.querySelector('#lock-info');
        const showInfo = () => { info.innerText = wrong ? `Ошибок: ${wrong} (каждая снимает 5 баллов)` : ''; };
        showInfo();

        const submit = () => {
            if (input.value === puzzle.secret) {
                tg.HapticFeedback.notificationOccurred('success');
                onComplete(Math.max(10, 40 - 5 * wrong));
            } else {
                wrong++;
                cfg.saveProgress?.({ puzzle, lockWrong: wrong });   // ошибки запоминаются, подбором не обойти
                tg.HapticFeedback.notificationOccurred('error');
                input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
                input.value = '';
                showInfo();
            }
        };
        container.querySelector('#lock-submit').onclick = submit;
        input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    },
    destroy() {},
};
