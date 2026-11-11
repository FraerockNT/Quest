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
const FIXED = [
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
const symOf = (i) => (i < 7 ? 0 : i === 7 ? 1 : i < 15 ? 2 : 3);

function moves(s) {
    const out = [];
    s.forEach((on, i) => { if (!on) return;
        s.forEach((on2, j) => { if (on2 || i === j) return;
            const n = s.slice(); n[i] = false; n[j] = true; out.push({ n, i, j });
        });
    });
    return out;
}
const toStr = (s) => s.map((v) => (v ? 1 : 0)).join('');
const fromStr = (t) => [...t].map((ch) => ch === '1');

// Три «склада» головоломок:
//  лёгкие  — палочка перекладывается внутри одного символа (6→9, 3→5…)
//  средние — палочку надо перенести в другой символ, решений несколько
//  сложные — перенос между символами и решение ровно одно
let POOLS = null;
function pools() {
    if (POOLS) return POOLS;
    POOLS = { easy: [], medium: [], hard: [] };
    const trues = [];
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
        if (a + b <= 9) trues.push([a, '+', b, a + b]);
        if (a - b >= 0) trues.push([a, '-', b, a - b]);
    }
    const seen = new Set();
    for (const eq of trues) for (const m of moves(build(...eq))) {
        const d = decode(m.n);
        if (!d || isTrue(d)) continue;
        const key = toStr(m.n);
        if (seen.has(key)) continue;
        seen.add(key);
        const sols = moves(m.n).filter((x) => { const y = decode(x.n); return y && isTrue(y); });
        const cross = sols.some((x) => symOf(x.i) !== symOf(x.j));
        if (!cross) POOLS.easy.push(m.n);
        else if (sols.length >= 2) POOLS.medium.push(m.n);
        else POOLS.hard.push(m.n);
    }
    return POOLS;
}

function makePuzzles(count, diff) {
    const pool = pools()[diff] || pools().medium;
    const chosen = new Set();
    while (chosen.size < Math.min(count, pool.length)) chosen.add(Math.floor(Math.random() * pool.length));
    return [...chosen].map((i) => toStr(pool[i]));
}

let saveNow = () => {}, alive = false;

export default {
    title: '🔥 Спички',
    description: 'Переложи одну палочку, чтобы равенство стало верным',
    defaultPoints: 20,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Палочку можно взять из любой цифры и даже из знака «+» (он станет «−»). Часто цифры превращаются так: 6↔9, 3↔2↔5, 0↔6↔9, 8→0/6/9.',
    makePuzzles, decode, isTrue, moves, pools,   // экспорт для проверки
    adminFields: [
        { key: 'difficulty', label: 'Сложность', type: 'select', def: 'medium',
          options: [['easy', 'Лёгкая — палочка двигается внутри цифры'], ['medium', 'Средняя — переносим в другой символ'], ['hard', 'Сложная — единственное решение']] },
        { key: 'matchCount', label: 'Сколько выражений нужно решить (1–10)', type: 'number', def: 3, min: 1, max: 10 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        const count = Math.min(10, Math.max(1, Math.round(Number(cfg.matchCount) || 3)));
        const total = cfg.points || 20;
        const prog = cfg.progress || {};
        // Выражения создаются ОДИН раз и сохраняются: при возвращении они те же самые
        let puzzles = prog.puzzles;
        if (!puzzles || !puzzles.length) puzzles = makePuzzles(count, cfg.difficulty || 'medium');
        const wrongs = prog.wrongs || puzzles.map(() => 0);
        let idx = prog.idx || 0, busy = false;
        alive = true;
        saveNow = () => cfg.saveProgress?.({ puzzles, idx, wrongs });
        if (!prog.puzzles) saveNow();

        container.innerHTML = `
            <p class="note" id="match-top"></p>
            <p class="note" id="match-note"></p>
            <svg class="match-svg" id="match-svg" viewBox="0 0 345 122"></svg>
            <p class="note" id="match-wrong"></p>
            <button class="btn btn-ghost" id="match-reset">Вернуть палочки на место</button>`;
        const svg = container.querySelector('#match-svg');
        const note = container.querySelector('#match-note');
        const top = container.querySelector('#match-top');
        const wrongEl = container.querySelector('#match-wrong');

        let start, state, hand;
        const ratioOf = (w) => Math.max(0.4, 1 - 0.2 * w);
        const earned = () => Math.round((total / puzzles.length) * wrongs.slice(0, idx).reduce((s, w) => s + ratioOf(w), 0));

        const load = () => { start = fromStr(puzzles[idx]); state = start.slice(); hand = null; };

        const draw = () => {
            let h = FIXED.map((r) => `<rect class="stick stick-fixed" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4"/>`).join('');
            h += SLOTS.map((r, i) => {
                const cls = i === hand ? 'stick-hand' : state[i] ? 'stick-on' : 'stick-off';
                return `<rect class="stick ${cls}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4"/>`;
            }).join('');
            h += SLOTS.map((r, i) => `<rect data-s="${i}" x="${r.x - 5}" y="${r.y - 5}" width="${r.w + 10}" height="${r.h + 10}" fill="transparent"/>`).join('');
            svg.innerHTML = h;
            top.innerHTML = `Выражение <b>${idx + 1}</b> из ${puzzles.length} · заработано <b>${earned()}</b> из ${total} баллов`;
            note.innerText = hand === null
                ? 'Нажми на палочку, которую хочешь взять. Переложить нужно ровно одну.'
                : 'Палочка в руке. Нажми на пустое место, куда её положить (красный пунктир — вернуть назад).';
            wrongEl.innerText = wrongs[idx] ? `Неудачных попыток здесь: ${wrongs[idx]}` : '';
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
                state[i] = true; hand = null;
            } else if (!state[i]) {
                state[i] = true; hand = null;
                tg.HapticFeedback.impactOccurred('medium');
                const d = decode(state);
                busy = true;
                if (d && isTrue(d)) {
                    draw();
                    tg.HapticFeedback.notificationOccurred('success');
                    idx++; saveNow();
                    setTimeout(() => {
                        if (!alive) return;
                        if (idx >= puzzles.length) {
                            const ratio = wrongs.reduce((s, w) => s + ratioOf(w), 0) / puzzles.length;
                            alive = false; onComplete(ratio);
                        } else { load(); busy = false; draw(); }
                    }, 800);
                    return;
                }
                wrongs[idx]++; saveNow();
                tg.HapticFeedback.notificationOccurred('error');
                svg.classList.add('shake'); draw();
                setTimeout(() => { svg.classList.remove('shake'); state = start.slice(); busy = false; draw(); }, 650);
                return;
            } else return;
            draw();
        });
        container.querySelector('#match-reset').onclick = () => { if (busy) return; state = start.slice(); hand = null; draw(); };
        load(); draw();
    },
    destroy() { alive = false; },
};
