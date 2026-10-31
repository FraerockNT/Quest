const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

export default {
    title: '🧩 Пятнашки',
    description: 'Расставь плитки по порядку',
    maxScore: 40,
    defaultHint: 'Сначала собери верхний ряд, потом второй. Последние два ряда удобнее собирать по столбцам.',
    adminFields: [{ key: 'slideSize', label: 'Размер поля (3 или 4)', type: 'number', def: 3, min: 3, max: 4 }],

    init(container, tg, onComplete, cfg = {}) {
        const n = clamp(cfg.slideSize, 3, 4, 3);
        const total = n * n;
        const solved = Array.from({ length: total }, (_, i) => (i + 1) % total);   // 1,2,…,0 (0 — пустая клетка)
        const isSolved = (t) => t.every((v, i) => v === solved[i]);

        // Перемешиваем случайными ходами: так головоломка всегда решаема
        let tiles = solved.slice(), empty = total - 1, prev = -1;
        for (let k = 0; k < 220 || isSolved(tiles); k++) {
            const r = Math.floor(empty / n), c = empty % n, opts = [];
            if (r > 0) opts.push(empty - n); if (r < n - 1) opts.push(empty + n);
            if (c > 0) opts.push(empty - 1); if (c < n - 1) opts.push(empty + 1);
            const pool = opts.filter((o) => o !== prev);
            const pick = pool[Math.floor(Math.random() * pool.length)];
            [tiles[empty], tiles[pick]] = [tiles[pick], tiles[empty]];
            prev = empty; empty = pick;
        }

        const timerEl = document.getElementById('quest-timer');
        let moves = 0, done = false;
        container.innerHTML = `<p class="note">Нажимай на плитки рядом с пустым местом (можно сдвигать сразу несколько в ряду).</p>
            <div class="slide-grid" id="slide-grid" style="grid-template-columns: repeat(${n}, 1fr)"></div>`;
        const grid = container.querySelector('#slide-grid');
        timerEl.innerText = 'Ходов: 0';

        const render = () => {
            grid.innerHTML = '';
            tiles.forEach((v, i) => {
                const el = document.createElement('div');
                el.className = 'tile' + (v === 0 ? ' empty' : '') + (v && (Math.floor((v - 1) / n) + (v - 1)) % 2 ? ' alt' : '');
                el.innerText = v || '';
                if (v) el.onclick = () => move(i);
                grid.appendChild(el);
            });
        };

        const move = (i) => {
            if (done) return;
            const e = tiles.indexOf(0);
            const sameRow = Math.floor(i / n) === Math.floor(e / n), sameCol = i % n === e % n;
            if (!sameRow && !sameCol) return;
            const step = sameRow ? (i < e ? 1 : -1) : (i < e ? n : -n);
            // сдвигаем цепочку плиток от пустой клетки к нажатой
            for (let p = e; p !== i; p -= step) tiles[p] = tiles[p - step];
            tiles[i] = 0;
            moves++; timerEl.innerText = `Ходов: ${moves}`;
            tg.HapticFeedback.impactOccurred('light');
            render();
            if (isSolved(tiles)) { done = true; tg.HapticFeedback.notificationOccurred('success'); setTimeout(() => onComplete(40), 500); }
        };
        render();
    },
    destroy() {},
};
