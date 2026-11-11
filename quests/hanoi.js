// Башня из подарков: диски — коробки с лентой. Админ задаёт диапазон ходов «от и до».
const COLORS = ['#e83a4c', '#2a9460', '#3b82f6', '#f2b632', '#9b6bff', '#ff7ab8'];
let interval, over = true, saveNow = () => {};

const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(v) : d; };

// Единые правила для админки и игры: ходов не меньше 2^n − 1
function normalizeCfg(cfg) {
    const disks = Math.min(6, Math.max(3, num(cfg.hanoiDisks, 3)));
    const low = 2 ** disks - 1;
    const min = Math.max(low, num(cfg.hanoiMin, low));
    const max = Math.max(min, num(cfg.hanoiMax, min + 5));
    cfg.hanoiDisks = disks; cfg.hanoiMin = min; cfg.hanoiMax = max;
    cfg.hanoiTime = Math.min(900, Math.max(15, num(cfg.hanoiTime, 90)));
    return cfg;
}

export default {
    title: '🎁 Башня из подарков',
    description: 'Перенеси стопку подарков на третью ёлку',
    defaultPoints: 30,
    rev: 15,   // номер версии файла: по нему приложение находит устаревшие
    defaultHint: 'Чтобы перенести N коробок, сначала перенеси N−1 верхних на запасную ёлку, потом самую большую на цель, потом снова N−1 сверху. Если нужно больше ходов, чем минимум, можно делать лишние переносы.',
    normalizeCfg,
    adminFields: [
        { key: 'hanoiDisks', label: 'Количество подарков в башне (3–6)', type: 'number', def: 3, min: 3, max: 6 },
        { key: 'hanoiMin', label: 'Ходов не меньше', type: 'number', def: 7, min: 7, max: 200,
          note: (c) => `Меньше ${2 ** (c.hanoiDisks || 3) - 1} поставить нельзя: это минимум 2ⁿ − 1 для ${c.hanoiDisks || 3} дисков` },
        { key: 'hanoiMax', label: 'Ходов не больше', type: 'number', def: 12, min: 7, max: 300 },
        { key: 'hanoiTime', label: 'Время на задание, секунд', type: 'number', def: 90, min: 15, max: 900 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(interval);
        const c = normalizeCfg({ ...cfg });
        const count = c.hanoiDisks, minMoves = c.hanoiMin, maxMoves = c.hanoiMax;
        const saved = cfg.progress?.towers ? cfg.progress : null;

        // Позиция, ходы и время сохраняются: при возвращении башня стоит так же
        let towers = saved ? saved.towers : [Array.from({ length: count }, (_, i) => count - i), [], []];
        let moves = saved?.moves || 0, resets = saved?.resets || 0;
        let timeLeft = saved?.timeLeft ?? c.hanoiTime;
        over = false;

        container.innerHTML = `
            <div class="card"><div class="center">Нужно уложиться в <b>от ${minMoves} до ${maxMoves}</b> ходов.<br>
                <span class="muted">Быстрее всего башню можно собрать за ${2 ** count - 1}</span></div></div>
            <div class="hanoi-board" id="hanoi-board">
                ${[0, 1, 2].map((i) => `<div class="tower" data-i="${i}"><div class="pole"></div><div class="stack-box"></div><div class="tower-name">${['🎄 1', '🎄 2', '🎄 3 (цель)'][i]}</div></div>`).join('')}
            </div>
            <p class="note" id="hanoi-moves"></p>`;
        const board = container.querySelector('#hanoi-board');
        const movesEl = container.querySelector('#hanoi-moves');
        const towerEls = [...board.querySelectorAll('.tower')];
        const timerEl = document.getElementById('quest-timer');

        const persist = () => cfg.saveProgress?.({ towers, moves, resets, timeLeft });
        saveNow = persist;

        const render = () => {
            towerEls.forEach((tw, i) => {
                const box = tw.querySelector('.stack-box');
                box.innerHTML = '';
                towers[i].forEach((size, idx) => {
                    const d = document.createElement('div');
                    d.className = 'disk gift' + (idx === towers[i].length - 1 ? ' top' : '');
                    d.dataset.tower = i;
                    d.style.width = `${38 + (size / count) * 58}%`;
                    d.style.background = COLORS[(size - 1) % COLORS.length];
                    box.appendChild(d);
                });
            });
            movesEl.innerHTML = `Ходов: <b>${moves}</b> из ${maxMoves}${resets ? ` · башня рассыпалась раз: ${resets}` : ''}`;
        };

        const restart = (why) => {
            resets++; moves = 0;
            towers = [Array.from({ length: count }, (_, i) => count - i), [], []];
            tg.HapticFeedback.notificationOccurred('error');
            tg.showAlert(why);
            persist(); render();
        };

        const pick = (x, y) => {
            const br = board.getBoundingClientRect();
            if (y < br.top - 80 || y > br.bottom + 80) return -1;
            let best = -1, bd = Infinity;
            towerEls.forEach((t, i) => {
                const r = t.getBoundingClientRect();
                const d = Math.abs(x - (r.left + r.width / 2));
                if (d < bd) { bd = d; best = i; }
            });
            return best;
        };

        board.addEventListener('pointerdown', (e) => {
            const disk = e.target.closest('.disk.top');
            if (!disk || over) return;
            e.preventDefault();
            const from = Number(disk.dataset.tower);
            const size = towers[from][towers[from].length - 1];
            const rect = disk.getBoundingClientRect();
            const offX = e.clientX - rect.left, offY = e.clientY - rect.top;

            disk.classList.add('dragging');
            disk.style.width = rect.width + 'px';
            disk.style.left = rect.left + 'px';
            disk.style.top = rect.top + 'px';
            disk.setPointerCapture(e.pointerId);
            tg.HapticFeedback.impactOccurred('light');

            const legal = (to) => to >= 0 && to !== from && (towers[to].length === 0 || towers[to][towers[to].length - 1] > size);
            const mark = (to) => towerEls.forEach((t, i) => {
                t.classList.toggle('drop-ok', i === to && legal(to));
                t.classList.toggle('drop-bad', i === to && to !== from && !legal(to));
            });
            const onMove = (ev) => {
                disk.style.left = (ev.clientX - offX) + 'px';
                disk.style.top = (ev.clientY - offY) + 'px';
                mark(pick(ev.clientX, ev.clientY));
            };
            const onEnd = (ev) => {
                disk.removeEventListener('pointermove', onMove);
                disk.removeEventListener('pointerup', onEnd);
                disk.removeEventListener('pointercancel', onEnd);
                mark(-2);
                if (over) return;
                const to = ev.type === 'pointercancel' ? -1 : pick(ev.clientX, ev.clientY);
                if (!legal(to)) {
                    if (to >= 0 && to !== from) tg.HapticFeedback.notificationOccurred('error');
                    render(); return;
                }
                towers[to].push(towers[from].pop());
                moves++;
                tg.HapticFeedback.impactOccurred('medium');
                render();
                if (towers[2].length === count) {
                    if (moves < minMoves) return restart(`Слишком быстро! В этом задании нужно сделать от ${minMoves} до ${maxMoves} ходов. Попробуй ещё раз.`);
                    over = true; clearInterval(interval);
                    tg.HapticFeedback.notificationOccurred('success');
                    onComplete(Math.max(0.4, 1 - 0.1 * resets));
                } else if (moves >= maxMoves) {
                    restart(`Ходы закончились (лимит ${maxMoves})! Башня собрана заново, время продолжает идти.`);
                } else persist();
            };
            disk.addEventListener('pointermove', onMove);
            disk.addEventListener('pointerup', onEnd);
            disk.addEventListener('pointercancel', onEnd);
        });

        render();
        timerEl.innerText = `⏱ ${timeLeft}с`;
        interval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
            if (timeLeft <= 0) {
                clearInterval(interval); over = true;
                tg.HapticFeedback.notificationOccurred('error');
                onComplete(0);
            }
        }, 1000);
    },

    destroy() {
        clearInterval(interval);
        if (!over) saveNow();   // сохраняем остаток времени и позицию
        over = true;
    },
};
