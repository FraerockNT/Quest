let interval, alive = false, saveNow = () => {};

const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

// Рисуем новогоднюю картинку: из неё будут собираться плитки
function drawPicture(size = 360) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const s = size / 360;
    x.scale(s, s);
    const sky = x.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, '#0b1d3f'); sky.addColorStop(1, '#2b6aa8');
    x.fillStyle = sky; x.fillRect(0, 0, 360, 360);
    // звёзды (фиксированные места, чтобы картинка была одинаковой)
    for (let i = 0; i < 36; i++) {
        const px = (i * 97 + 23) % 360, py = (i * 53 + 11) % 190;
        x.fillStyle = `rgba(255,255,255,${0.35 + (i % 4) * 0.15})`;
        x.beginPath(); x.arc(px, py, 0.8 + (i % 3) * 0.6, 0, 7); x.fill();
    }
    // луна
    x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(300, 55, 26, 0, 7); x.fill();
    x.fillStyle = '#0f2c58'; x.beginPath(); x.arc(310, 48, 22, 0, 7); x.fill();
    // сугроб
    x.fillStyle = '#eef6ff';
    x.beginPath(); x.ellipse(180, 372, 260, 70, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(40, 340, 90, 34, 0, 0, 7); x.fill();
    // ёлка
    x.fillStyle = '#5a3a1a'; x.fillRect(166, 290, 28, 36);
    [[255, 240, 120], [215, 215, 95], [170, 185, 70]].forEach(([y, w, h], i) => {
        x.fillStyle = ['#1f7a4a', '#25905a', '#2caa68'][i];
        x.beginPath(); x.moveTo(180, y - h); x.lineTo(180 + w / 2, y); x.lineTo(180 - w / 2, y); x.closePath(); x.fill();
    });
    // гирлянда и шары
    x.strokeStyle = '#ffd23f'; x.lineWidth = 3;
    [[150, 28], [195, 45], [240, 60]].forEach(([y, w]) => { x.beginPath(); x.arc(180, y - 10, w, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); });
    const balls = [[150, 180, '#ff4257'], [208, 160, '#4aa3ff'], [160, 210, '#ffd23f'], [200, 220, '#ff4257'], [130, 250, '#b48cff'],
        [232, 252, '#ffd23f'], [180, 250, '#4aa3ff'], [170, 140, '#ffd23f'], [190, 125, '#ff4257'], [112, 262, '#ff8fd8'], [250, 268, '#3ddc84']];
    balls.forEach(([bx, by, col]) => { x.fillStyle = col; x.beginPath(); x.arc(bx, by - 24, 7, 0, 7); x.fill(); });
    // звезда
    x.fillStyle = '#ffe066'; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 17, a = -Math.PI / 2 + (i * Math.PI) / 5; x.lineTo(180 + r * Math.cos(a), 78 + r * Math.sin(a)); }
    x.closePath(); x.fill();
    // подарки
    [[70, 305, 46, '#e83a4c', '#ffd23f'], [262, 312, 40, '#3b82f6', '#fff'], [305, 322, 30, '#2a9460', '#ffd23f']].forEach(([gx, gy, w, col, rib]) => {
        x.fillStyle = col; x.fillRect(gx, gy, w, w * 0.8);
        x.fillStyle = rib; x.fillRect(gx + w / 2 - 4, gy, 8, w * 0.8); x.fillRect(gx, gy + w * 0.4 - 4, w, 8);
    });
    // надпись
    x.fillStyle = '#fff'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center';
    x.fillText('С Новым годом!', 180, 345);
    return c.toDataURL('image/jpeg', 0.85);
}

export default {
    title: '🧩 Пятнашки-картинка',
    description: 'Собери новогоднюю картинку, перетаскивая плитки',
    defaultPoints: 40,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Сначала собери верхний ряд, потом второй. Последние два ряда удобнее доделывать по столбцам. Ориентируйся по образцу сверху.',
    adminFields: [
        { key: 'slideSize', label: 'Размер поля (3 или 4)', type: 'number', def: 3, min: 3, max: 4 },
        { key: 'slideTime', label: 'Время на сборку, секунд (0 — без ограничения)', type: 'number', def: 180, min: 0, max: 1800 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(interval);
        const n = Math.min(4, Math.max(3, num(cfg.slideSize, 3)));
        const limit = Math.max(0, num(cfg.slideTime, 180));
        const total = n * n;
        const solved = Array.from({ length: total }, (_, i) => (i + 1) % total);   // 1,2,…,0 (0 — пустая клетка)
        const isSolved = (t) => t.every((v, i) => v === solved[i]);
        const prog = cfg.progress || {};

        // Случайные ходы от собранной картинки: головоломка всегда решаема
        const makeTiles = () => {
            const t = solved.slice();
            let empty = total - 1, prev = -1;
            for (let k = 0; k < 260 || isSolved(t); k++) {
                const r = Math.floor(empty / n), c = empty % n, opts = [];
                if (r > 0) opts.push(empty - n); if (r < n - 1) opts.push(empty + n);
                if (c > 0) opts.push(empty - 1); if (c < n - 1) opts.push(empty + 1);
                const pool = opts.filter((o) => o !== prev);
                const pick = pool[Math.floor(Math.random() * pool.length)];
                [t[empty], t[pick]] = [t[pick], t[empty]];
                prev = empty; empty = pick;
            }
            return t;
        };
        // Расстановка сохраняется, пока игрок не нажмёт «Начать заново»
        let tiles = prog.tiles || makeTiles();
        let moves = prog.moves || 0;
        let timeLeft = prog.timeLeft ?? limit;
        let done = false; alive = true;
        saveNow = () => { if (!done) cfg.saveProgress?.({ tiles, moves, timeLeft }); };
        if (!prog.tiles) saveNow();

        const pic = drawPicture();
        const W = Math.min(330, container.clientWidth || 330);
        const cell = Math.floor(W / n), B = cell * n;
        const timerEl = document.getElementById('quest-timer');

        container.innerHTML = `
            <div class="row gap8" style="align-items:flex-start">
                <div style="text-align:center"><img src="${pic}" style="width:92px;border-radius:10px;border:1px solid var(--glass-line)" alt=""><div class="muted">Образец</div></div>
                <p class="note" style="text-align:left">Тяни плитку пальцем в пустое место. Можно сдвигать сразу несколько в ряду. Номера — маленькие подсказки.</p>
            </div>
            <div class="slide-board" id="slide-board" style="width:${B}px;height:${B}px"></div>
            <p class="note" id="slide-moves"></p>
            <button class="btn btn-ghost" id="slide-restart">🔄 Начать заново (новая расстановка)</button>`;
        const board = container.querySelector('#slide-board');
        const els = {};

        const pos = (idx) => ({ x: (idx % n) * cell, y: Math.floor(idx / n) * cell });
        const place = (v, idx, animate) => {
            const el = els[v], p = pos(idx);
            el.style.transition = animate ? 'transform .16s ease-out' : 'none';
            el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        };

        for (let v = 1; v < total; v++) {
            const el = document.createElement('div');
            const sr = Math.floor((v - 1) / n), sc = (v - 1) % n;
            el.className = 'ptile';
            el.style.width = el.style.height = `${cell - 3}px`;
            el.style.margin = '1.5px';
            el.style.backgroundImage = `url(${pic})`;
            el.style.backgroundSize = `${B}px ${B}px`;
            el.style.backgroundPosition = `-${sc * cell}px -${sr * cell}px`;
            el.innerHTML = `<span>${v}</span>`;
            els[v] = el; board.appendChild(el);

            el.addEventListener('pointerdown', (e) => {
                if (done) return;
                e.preventDefault();
                const i = tiles.indexOf(v), e0 = tiles.indexOf(0);
                const r = Math.floor(i / n), c = i % n, er = Math.floor(e0 / n), ec = e0 % n;
                if (r !== er && c !== ec) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
                const dr = r === er ? 0 : Math.sign(er - r), dc = c === ec ? 0 : Math.sign(ec - c);
                const chain = [];
                for (let rr = r, cc = c; rr !== er || cc !== ec; rr += dr, cc += dc) chain.push(tiles[rr * n + cc]);
                el.setPointerCapture(e.pointerId);
                el.style.zIndex = 5;
                const sx = e.clientX, sy = e.clientY;
                let shift = 0, travelled = 0;

                const onMove = (ev) => {
                    travelled = Math.hypot(ev.clientX - sx, ev.clientY - sy);
                    shift = Math.min(cell, Math.max(0, (ev.clientX - sx) * dc + (ev.clientY - sy) * dr));
                    chain.forEach((val) => {
                        const p = pos(tiles.indexOf(val));
                        els[val].style.transition = 'none';
                        els[val].style.transform = `translate(${p.x + dc * shift}px, ${p.y + dr * shift}px)`;
                    });
                };
                const onEnd = () => {
                    el.removeEventListener('pointermove', onMove);
                    el.removeEventListener('pointerup', onEnd);
                    el.removeEventListener('pointercancel', onEnd);
                    el.style.zIndex = '';
                    if (shift > cell * 0.35 || travelled < 8) {     // дотащил до середины или просто нажал
                        const step = dr * n + dc;
                        for (let p = e0; p !== i; p -= step) tiles[p] = tiles[p - step];
                        tiles[i] = 0;
                        moves++; status();
                        tg.HapticFeedback.impactOccurred('light');
                        tiles.forEach((val, idx) => { if (val) place(val, idx, true); });
                        saveNow();
                        if (isSolved(tiles)) {
                            done = true; clearInterval(interval);
                            tg.HapticFeedback.notificationOccurred('success');
                            setTimeout(() => alive && onComplete(1), 600);
                        }
                    } else chain.forEach((val) => place(val, tiles.indexOf(val), true));   // отпустил рано — плитки возвращаются
                };
                el.addEventListener('pointermove', onMove);
                el.addEventListener('pointerup', onEnd);
                el.addEventListener('pointercancel', onEnd);
            });
        }
        tiles.forEach((val, idx) => { if (val) place(val, idx, false); });

        const movesEl = container.querySelector('#slide-moves');
        const status = () => { movesEl.innerText = `Ходов: ${moves}`; };
        status();

        const startTimer = () => {
            clearInterval(interval);
            if (limit <= 0) { timerEl.innerText = ''; return; }
            timerEl.innerText = `⏱ ${timeLeft}с`;
            interval = setInterval(() => {
                timeLeft--;
                timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('error');
                    tg.showAlert('Время вышло! Попробуй ещё раз: попыток сколько угодно.', () => alive && restart());
                }
            }, 1000);
        };

        // Новая попытка: свежая расстановка, ходы и время с нуля. Попыток может быть сколько угодно.
        const restart = () => {
            if (done) return;
            tiles = makeTiles(); moves = 0; timeLeft = limit;
            tiles.forEach((val, idx) => { if (val) place(val, idx, true); });
            saveNow(); status(); startTimer();
        };
        container.querySelector('#slide-restart').onclick = restart;
        startTimer();
    },

    destroy() { clearInterval(interval); if (alive) saveNow(); alive = false; },
};
