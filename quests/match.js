// Цифры из палочек (как на электронных часах): сегменты a b c d e f g
const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const mask = (d) => 'abcdefg'.split('').map((ch) => DIG[d].includes(ch));
const KEY2DIGIT = Object.fromEntries(DIG.map((_, d) => [mask(d).map(Number).join(''), d]));

// Места палочек: A (0–6), знак + (7), B (8–14), C (15–21)
const SEG = [
    { x: 8, y: 0, w: 44, h: 9 }, { x: 51, y: 8, w: 9, h: 44 }, { x: 51, y: 58, w: 9, h: 44 },
    { x: 8, y: 101, w: 44, h: 9 }, { x: 0, y: 58, w: 9, h: 44 }, { x: 0, y: 8, w: 9, h: 44 }, { x: 8, y: 50.5, w: 44, h: 9 },
];
const OX = { A: 4, op: 74, B: 144, eq: 214, C: 284 }, OY = 5;
const SLOTS = [
    ...SEG.map((s) => ({ ...s, x: s.x + OX.A, y: s.y + OY })),
    { x: OX.op + 25.5, y: OY + 28, w: 9, h: 44 },
    ...SEG.map((s) => ({ ...s, x: s.x + OX.B, y: s.y + OY })),
    ...SEG.map((s) => ({ ...s, x: s.x + OX.C, y: s.y + OY })),
];
const FIXED = [   // неподвижные палочки: горизонталь знака и «=»
    { x: OX.op + 8, y: OY + 50.5, w: 44, h: 9 },
    { x: OX.eq + 8, y: OY + 36, w: 44, h: 9 }, { x: OX.eq + 8, y: OY + 64, w: 44, h: 9 },
];

const build = (a, op, b, c) => [...mask(a), op === '+', ...mask(b), ...mask(c)];
function decode(s) {
    const a = KEY2DIGIT[s.slice(0, 7).map(Number).join('')];
    const b = KEY2DIGIT[s.slice(8, 15).map(Number).join('')];
    const c = KEY2DIGIT[s.slice(15, 22).map(Number).join('')];
    if (a === undefined || b === undefined || c === undefined) return null;
    return { a, b, c, op: s[7] ? '+' : '-' };
}
const isTrue = (d) => (d.op === '+' ? d.a + d.b : d.a - d.b) === d.c;

function neighbors(s) {
    const out = [];
    s.forEach((on, i) => { if (!on) return;
        s.forEach((on2, j) => { if (on2 || i === j) return;
            const n = s.slice(); n[i] = false; n[j] = true; out.push(n);
        });
    });
    return out;
}

// Берём верное равенство и ломаем его ровно одним перекладыванием — значит, решение точно есть
function makePuzzle() {
    const trues = [];
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
        if (a + b <= 9) trues.push([a, '+', b, a + b]);
        if (a - b >= 0) trues.push([a, '-', b, a - b]);
    }
    for (let t = 0; t < 300; t++) {
        const eq = trues[Math.floor(Math.random() * trues.length)];
        const bad = neighbors(build(...eq)).filter((n) => { const d = decode(n); return d && !isTrue(d); });
        if (bad.length) return bad[Math.floor(Math.random() * bad.length)];
    }
    return build(9, '-', 3, 6).map((v, i) => (i === 2 ? !v : v));
}

export default {
    title: '🔥 Спички',
    description: 'Переложи одну палочку, чтобы равенство стало верным',
    maxScore: 30,
    defaultHint: 'Палочку можно взять из любой цифры и даже из знака «+» (он превратится в «−»). Часто цифры меняются так: 6↔9, 3↔2↔5, 0↔6↔9.',
    makePuzzle, decode, isTrue, neighbors,   // экспорт для проверки

    init(container, tg, onComplete) {
        const start = makePuzzle();
        let state = start.slice(), hand = null, wrong = 0, busy = false;

        container.innerHTML = `
            <p class="note" id="match-note"></p>
            <svg class="match-svg" id="match-svg" viewBox="0 0 345 122"></svg>
            <p class="note" id="match-wrong"></p>
            <button class="btn btn-ghost" id="match-reset">Начать заново</button>`;
        const svg = container.querySelector('#match-svg');
        const note = container.querySelector('#match-note');
        const wrongEl = container.querySelector('#match-wrong');

        const draw = () => {
            let h = FIXED.map((r) => `<rect class="stick stick-fixed" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4"/>`).join('');
            h += SLOTS.map((r, i) => {
                const cls = i === hand ? 'stick-hand' : state[i] ? 'stick-on' : 'stick-off';
                return `<rect class="stick ${cls}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4"/>`;
            }).join('');
            h += SLOTS.map((r, i) => `<rect data-s="${i}" x="${r.x - 5}" y="${r.y - 5}" width="${r.w + 10}" height="${r.h + 10}" fill="transparent"/>`).join('');
            svg.innerHTML = h;
            note.innerText = hand === null
                ? 'Нажми на палочку, которую хочешь взять. Переложить нужно ровно одну.'
                : 'Палочка в руке. Нажми на пустое место, куда её положить (красный пунктир — вернуть назад).';
            wrongEl.innerText = wrong ? `Неудачных попыток: ${wrong}` : '';
        };

        svg.addEventListener('click', (e) => {
            const el = e.target.closest('[data-s]');
            if (!el || busy) return;
            const i = Number(el.dataset.s);
            if (hand === null) {
                if (!state[i]) return;
                state[i] = false; hand = i;
                tg.HapticFeedback.impactOccurred('light');
            } else if (i === hand) {
                state[i] = true; hand = null;        // положил обратно
            } else if (!state[i]) {
                state[i] = true; hand = null;
                tg.HapticFeedback.impactOccurred('medium');
                const d = decode(state);
                if (d && isTrue(d)) {
                    draw(); busy = true;
                    tg.HapticFeedback.notificationOccurred('success');
                    setTimeout(() => onComplete(Math.max(10, 30 - 5 * wrong)), 700);
                    return;
                }
                wrong++; busy = true;
                tg.HapticFeedback.notificationOccurred('error');
                svg.classList.add('shake');
                draw();
                setTimeout(() => { svg.classList.remove('shake'); state = start.slice(); busy = false; draw(); }, 650);
                return;
            } else return;
            draw();
        });
        container.querySelector('#match-reset').onclick = () => { if (busy) return; state = start.slice(); hand = null; draw(); };
        draw();
    },
    destroy() {},
};
