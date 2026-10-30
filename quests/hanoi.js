let interval;
let towers = [[3,2,1], [], []];
let selected = null;

export default {
    title: "🏛 Ханойская башня",
    description: "Собери все кольца на третьем стержне",

    init(container, tg, onComplete) {
        container.innerHTML = `
            <p style="text-align:center; margin-bottom: 10px; font-size:14px; color:gray">Нажми на стержень, чтобы взять/положить диск</p>
            <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 200px; margin: 20px 0;">
                <div class="tower" onclick="hanoiClick(0)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
                <div class="tower" onclick="hanoiClick(1)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
                <div class="tower" onclick="hanoiClick(2)" style="width: 30%; height: 100%; border-bottom: 4px solid; position: relative; display: flex; flex-direction: column-reverse; align-items: center;"></div>
            </div>
        `;

        towers = [[3,2,1], [], []];
        selected = null;
        render();

        // Таймер (30 секунд)
        let time = 30;
        const timerEl = document.getElementById('quest-timer');
        timerEl.classList.remove('danger');
        timerEl.innerText = `Время: ${time}с`;

        interval = setInterval(() => {
            time--;
            timerEl.innerText = `Время: ${time}с`;
            if (time <= 10) timerEl.classList.add('danger');
            if (time <= 0) {
                clearInterval(interval);
                tg.showAlert("Время вышло!");
                window.app.goMenu();
            }
        }, 1000);

        // Привязка функций
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
            render();

            if (towers[2].length === 3) {
                clearInterval(interval);
                onComplete(this.title);
            }
        };
    },

    destroy() {
        clearInterval(interval);
        delete window.hanoiClick;
    }
};

function render() {
    const towerEls = document.querySelectorAll('.tower');
    towerEls.forEach((el, index) => {
        el.innerHTML = '';
        towers[index].forEach(diskSize => {
            const disk = document.createElement('div');
            disk.style.width = `${diskSize * 30 + 20}%`;
            disk.style.height = '20px';
            disk.style.borderRadius = '4px';
            disk.style.marginBottom = '2px';
            disk.style.background = { 1: '#ff4757', 2: '#2ed573', 3: '#1e90ff' }[diskSize];
            el.appendChild(disk);
        });
    });
}