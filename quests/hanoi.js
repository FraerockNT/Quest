const COLORS = ['#ff4257', '#3ddc84', '#4aa3ff', '#ffd23f', '#b48cff', '#ff8fd8'];
let interval, over = false;

const clamp = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

export default {
    title: '🏛 Ханойская башня',
    description: 'Перетащи все диски на третий стержень',
    maxScore: 30,
    defaultHint: 'Сначала перенеси все диски кроме нижнего на запасной стержень, потом нижний — на цель, потом снова всю стопку сверху. Для 3 дисков хватит 7 ходов.',
    adminFields: [
        { key: 'hanoiDisks', label: 'Количество дисков (3–6)', type: 'number', def: 3, min: 3, max: 6 },
        { key: 'hanoiTime', label: 'Время на задание, секунд', type: 'number', def: 60, min: 15, max: 900 },
    ],

    init(container, tg, onComplete, cfg = {}) {
        clearInterval(interval);
        over = false;
        const count = clamp(cfg.hanoiDisks, 3, 6, 3);
        let timeLeft = clamp(cfg.hanoiTime, 15, 900, 60);
        const towers = [Array.from({ length: count }, (_, i) => count - i), [], []];
        let moves = 0;

        container.innerHTML = `
            <p class="note">Тяни верхний диск пальцем на другой стержень. Большой диск нельзя класть на маленький.</p>
            <div class="hanoi-board" id="hanoi-board">
                ${[0, 1, 2].map((i) => `<div class="tower" data-i="${i}"><div class="pole"></div><div class="stack-box"></div></div>`).join('')}
            </div>
            <p class="note" id="hanoi-moves"></p>`;
        const board = container.querySelector('#hanoi-board');
        const movesEl = container.querySelector('#hanoi-moves');
        const towerEls = [...board.querySelectorAll('.tower')];

        const render = () => {
            towerEls.forEach((tw, i) => {
                const box = tw.querySelector('.stack-box');
                box.innerHTML = '';
                towers[i].forEach((size, idx) => {
                    const d = document.createElement('div');
                    d.className = 'disk' + (idx === towers[i].length - 1 ? ' top' : '');
                    d.dataset.tower = i;
                    d.style.width = `${34 + (size / count) * 62}%`;
                    d.style.background = COLORS[(size - 1) % COLORS.length];
                    box.appendChild(d);
                });
            });
            movesEl.innerText = `Ходов: ${moves}`;
        };

        // Какой стержень ближе всего к пальцу (если палец слишком далеко от доски — никакой)
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
                if (legal(to)) {
                    towers[to].push(towers[from].pop());
                    moves++;
                    tg.HapticFeedback.impactOccurred('medium');
                    render();
                    if (towers[2].length === count) {
                        over = true;
                        clearInterval(interval);
                        tg.HapticFeedback.notificationOccurred('success');
                        onComplete(30);
                    }
                } else {
                    if (to >= 0 && to !== from) tg.HapticFeedback.notificationOccurred('error');  // нельзя: большой на маленький
                    render();   // диск возвращается на место
                }
            };
            disk.addEventListener('pointermove', onMove);
            disk.addEventListener('pointerup', onEnd);
            disk.addEventListener('pointercancel', onEnd);
        });

        render();

        const timerEl = document.getElementById('quest-timer');
        timerEl.innerText = `⏱ ${timeLeft}с`;
        interval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = `⏱ ${Math.max(0, timeLeft)}с`;
            if (timeLeft <= 0) {
                clearInterval(interval);
                over = true;
                tg.HapticFeedback.notificationOccurred('error');
                onComplete(0);
            }
        }, 1000);
    },

    destroy() {
        clearInterval(interval);
        over = true;
    },
};
