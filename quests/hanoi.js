let interval, towers, selected;
let disksCount, timeLimit;

export default {
    title: "🏛 Ханойская башня",
    description: "Собери кольца на 3-м стержне",
    init(container, tg, onComplete, questConfig) {
        disksCount = questConfig?.hanoiDisks || 3;
        timeLimit = questConfig?.hanoiTime || 60; // Время из настроек

        towers = [Array.from({length: disksCount}, (_, i) => disksCount - i), [], []];
        selected = null;

        container.innerHTML = `
            <p style="text-align:center; margin-bottom: 10px; font-size:14px; color:var(--hint-color)">Нажми на стержень, чтобы снять/положить диск</p>
            <div id="hanoi-board" style="display: flex; justify-content: space-around; align-items: flex-end; height: 200px; margin: 20px 0;">
                <div class="tower" onclick="window.hanoiClick(0)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
                <div class="tower" onclick="window.hanoiClick(1)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
                <div class="tower" onclick="window.hanoiClick(2)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
            </div>
        `;

        renderHanoi();

        // Таймер
        let timeLeft = timeLimit;
        const timerEl = document.getElementById('quest-timer');
        timerEl.innerText = `⏱ ${timeLeft}с`;

        clearInterval(interval);
        interval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = `⏱ ${timeLeft}с`;
            if (timeLeft <= 0) {
                clearInterval(interval);
                tg.HapticFeedback.notificationOccurred('error');
                tg.showAlert("Время вышло!");
                onComplete(0);
            }
        }, 1000);

        window.hanoiClick = (towerIndex) => {
            const currentTower = towers[towerIndex];
            if (selected === null) {
                if (currentTower.length > 0) {
                    selected = currentTower.pop();
                    tg.HapticFeedback.impactOccurred('light');
                }
            } else {
                const topDisk = currentTower[currentTower.length - 1];
                if (topDisk && topDisk < selected) {
                    tg.showAlert("Нельзя класть большой диск на маленький!");
                    return;
                }
                currentTower.push(selected);
                selected = null;
                tg.HapticFeedback.impactOccurred('medium');
            }
            renderHanoi();

            if (towers[2].length === disksCount) {
                clearInterval(interval);
                window.hanoiClick = null;
                tg.HapticFeedback.notificationOccurred('success');
                onComplete(30);
            }
        };
    },
    destroy() {
        clearInterval(interval);
        window.hanoiClick = null;
    }
};

function renderHanoi() {
    const towerEls = document.querySelectorAll('.tower');
    towerEls.forEach((el, index) => {
        el.innerHTML = '';
        towers[index].forEach(diskSize => {
            const disk = document.createElement('div');
            disk.style.width = `${(diskSize / disksCount) * 80 + 20}%`;
            disk.style.height = '20px';
            disk.style.borderRadius = '4px';
            disk.style.marginBottom = '2px';
            const colors = { 1: '#ff4757', 2: '#2ed573', 3: '#1e90ff', 4: '#eccc68', 5: '#9c88ff', 6: '#ff9ff3' };
            disk.style.background = colors[diskSize] || '#888';
            el.appendChild(disk);
        });
    });
}