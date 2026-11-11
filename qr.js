// Маленький генератор QR-кода без внешних библиотек.
// Умеет только цифры (до 34 штук): версия 1 (21×21), уровень коррекции ошибок M. Для кодов заданий этого хватает.
const SIZE = 21, DATA_CW = 16, EC_CW = 10;

// ───── Арифметика Рида—Соломона (поле из 256 элементов) ─────
function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
}
function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) { result[j] = gfMul(result[j], root); if (j + 1 < degree) result[j] ^= result[j + 1]; }
        root = gfMul(root, 0x02);
    }
    return result;
}
function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
    }
    return result;
}

// ───── Данные: режим «цифры» ─────
function dataCodewords(digits) {
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(1, 4);                       // режим: цифры
    push(digits.length, 10);          // сколько цифр
    for (let i = 0; i < digits.length; i += 3) {
        const chunk = digits.substr(i, 3);
        push(parseInt(chunk, 10), chunk.length * 3 + 1);   // 3 цифры → 10 бит, 2 → 7, 1 → 4
    }
    push(0, Math.min(4, DATA_CW * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k]; bytes.push(v); }
    for (let pad = 0xEC; bytes.length < DATA_CW; pad ^= 0xEC ^ 0x11) bytes.push(pad);
    return bytes;
}

// ───── Рисование матрицы ─────
function build(digits) {
    const data = dataCodewords(digits);
    const all = data.concat(rsRemainder(data, rsDivisor(EC_CW)));
    const m = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    const fn = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
    const setF = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < SIZE; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }   // полосы синхронизации
    const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
            if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) setF(x, y, d !== 2 && d !== 4);
        }
    };
    finder(3, 3); finder(SIZE - 4, 3); finder(3, SIZE - 4);

    const formatBits = (mask) => {
        const d = (0 << 3) | mask;                       // уровень M = 0
        let rem = d;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((d << 10) | rem) ^ 0x5412;
        const bit = (i) => ((bits >>> i) & 1) !== 0;
        for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
        setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) setF(SIZE - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) setF(8, SIZE - 15 + i, bit(i));
        setF(8, SIZE - 8, true);                         // всегда тёмный модуль
    };
    formatBits(0);

    // Данные укладываются «змейкой» справа налево парами столбцов
    let bitIdx = 0;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < SIZE; vert++) for (let j = 0; j < 2; j++) {
            const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? SIZE - 1 - vert : vert;
            if (!fn[y][x] && bitIdx < all.length * 8) { m[y][x] = ((all[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0; bitIdx++; }
        }
    }

    const maskFn = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
        (x, y) => ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
    ];
    const applyMask = (mask) => { for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!fn[y][x] && maskFn[mask](x, y)) m[y][x] = !m[y][x]; };

    // Выбираем маску с наименьшим штрафом (так код лучше читается)
    let best = 0, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask); formatBits(mask);
        const s = penalty(m);
        if (s < bestScore) { bestScore = s; best = mask; }
        applyMask(mask);
    }
    applyMask(best); formatBits(best);
    return m;
}

function penalty(m) {
    let p = 0;
    for (let dir = 0; dir < 2; dir++) for (let a = 0; a < SIZE; a++) {      // длинные ряды одного цвета
        let run = 1;
        for (let b = 1; b < SIZE; b++) {
            const cur = dir ? m[b][a] : m[a][b], prev = dir ? m[b - 1][a] : m[a][b - 1];
            if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
    }
    for (let y = 0; y < SIZE - 1; y++) for (let x = 0; x < SIZE - 1; x++) {   // квадраты 2×2
        if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    const pats = [[1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]];   // похоже на угловой знак
    for (let dir = 0; dir < 2; dir++) for (let a = 0; a < SIZE; a++) for (let b = 0; b <= SIZE - 11; b++) {
        for (const pat of pats) {
            let ok = true;
            for (let k = 0; k < 11 && ok; k++) { const v = dir ? m[b + k][a] : m[a][b + k]; if ((v ? 1 : 0) !== pat[k]) ok = false; }
            if (ok) p += 40;
        }
    }
    let dark = 0;
    for (const row of m) for (const v of row) if (v) dark++;
    const total = SIZE * SIZE;
    p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
}

// ───── Публичные функции ─────
export function makeQr(digits) {
    const text = String(digits);
    if (!/^\d{1,34}$/.test(text)) throw new Error('QR: нужны только цифры, не больше 34');
    return build(text);
}

// SVG-картинка (для предпросмотра в приложении)
export function qrSvg(digits, { border = 4, dark = '#000', light = '#fff' } = {}) {
    const m = makeQr(digits), n = m.length + border * 2;
    let d = '';
    m.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + border},${y + border}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

// Холст с кодом (для печати и скачивания PNG)
export function qrCanvas(digits, scale = 12, border = 4) {
    const m = makeQr(digits), n = (m.length + border * 2) * scale;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#000';
    m.forEach((row, y) => row.forEach((v, x) => { if (v) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale); }));
    return c;
}
