import hanoiQuest from './quests/hanoi.js?v=7';
import snakeQuest from './quests/snake.js?v=7';
import quizQuest from './quests/quiz.js?v=7';
import mathQuest from './quests/math.js?v=7';
import wordleQuest from './quests/wordle.js?v=7';
import lockQuest from './quests/lock.js?v=7';

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const ALL_QUESTS = {
    hanoi: hanoiQuest, snake: snakeQuest, quiz: quizQuest,
    math: mathQuest, wordle: wordleQuest, lock: lockQuest
};
let activeQuest = null;
let currentRoom = null;

function init() {
    const user = tg.initDataUnsafe?.user;
    if (user && user.id === window.ADMIN_ID) {
        document.getElementById('admin-btn').classList.remove('hidden');
        document.getElementById('user-greeting').innerText = `Привет, Админ ${user.first_name}!`;
    } else if (user) {
        document.getElementById('user-greeting').innerText = `Привет, ${user.first_name}!`;
    }
    renderRoomList();
}

// Рендер списка комнат в главном меню
function renderRoomList() {
    const list = document.getElementById('quest-list');
    list.innerHTML = '';

    let rooms = JSON.parse(localStorage.getItem('tg_rooms_v7')) || [];
    const user = tg.initDataUnsafe?.user;
    const isAdmin = user && user.id === window.ADMIN_ID;

    if (rooms.length === 0) {
        list.innerHTML = '<div style="color:gray; text-align:center; margin-top:20px;">Нет активных квестов. Введите код комнаты.</div>';
        return;
    }

    rooms.forEach((room, index) => {
        const card = document.createElement('div');
        card.className = 'quest-card';
        card.style.position = 'relative';

        // Если пользователь уже в комнате, показываем это
        const isJoined = user && room.participants[user.id];

        card.innerHTML = `
            <div class="quest-title">🏆 ${room.name}</div>
            <div class="quest-desc">${isJoined ? 'Вы в комнате' : 'Нажмите, чтобы войти'}</div>
        `;

        // Кнопка удаления для админа
        if (isAdmin) {
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.style.cssText = 'position:absolute; right:10px; top:10px; background:red; color:white; border:none; border-radius:5px; padding:2px 8px; z-index:10;';
            delBtn.onclick = (e) => {
                e.stopPropagation(); // Чтобы не открылась комната при удалении
                if(confirm('Удалить этот квест для всех?')) {
                    rooms.splice(index, 1);
                    localStorage.setItem('tg_rooms_v7', JSON.stringify(rooms));
                    renderRoomList();
                }
            };
            card.appendChild(delBtn);
        }

        // Логика клика по карточке
        card.onclick = () => {
            if (isJoined) {
                // Если уже зашли, сразу открываем комнату
                currentRoom = room;
                renderRoomUI();
            } else {
                // Если нет, подставляем пароль в инпут для удобства
                document.getElementById('join-room-code').value = room.password;
                tg.showAlert("Нажмите кнопку 'Войти' чтобы присоединиться!");
            }
        };
        list.appendChild(card);
    });
}

// --- ЛОГИКА КОМНАТ ---
function joinRoom() {
    const code = document.getElementById('join-room-code').value.toUpperCase().trim();
    if (!code) return tg.showAlert("Введите код!");

    let rooms = JSON.parse(localStorage.getItem('tg_rooms_v7')) || [];
    const room = rooms.find(r => r.password === code);

    if (!room) return tg.showAlert("Комната не найдена!");

    const now = new Date().getTime();
    const start = new Date(room.startDate).getTime();
    const end = new Date(room.endDate).getTime();

    if (now < start) return tg.showAlert("Квест еще не начался!");
    if (now > end) return tg.showAlert("Время квеста истекло!");

    currentRoom = room;
    const user = tg.initDataUnsafe?.user;

    if (!currentRoom.participants) currentRoom.participants = {};
    if (user && !currentRoom.participants[user.id]) {
        currentRoom.participants[user.id] = {
            name: `${user.first_name} ${user.last_name || ''}`.trim(),
            scores: {}
        };
        rooms = rooms.map(r => r.id === room.id ? currentRoom : r);
        localStorage.setItem('tg_rooms_v7', JSON.stringify(rooms));
    }

    document.getElementById('join-room-code').value = ''; // Очистить поле
    renderRoomUI();
}

function renderRoomUI() {
    hideAllScreens();
    document.getElementById('room-screen').classList.remove('hidden');
    document.getElementById('room-title').innerText = currentRoom.name;

    const now = new Date().getTime();
    const end = new Date(currentRoom.endDate).getTime();
    const timeLeft = Math.max(0, Math.floor((end - now) / 1000));
    document.getElementById('room-status').innerText = `До конца: ${Math.floor(timeLeft/60)} мин.`;

    const tasksDiv = document.getElementById('room-tasks');
    tasksDiv.innerHTML = '';
    const user = tg.initDataUnsafe?.user;
    const userScores = user ? (currentRoom.participants[user.id]?.scores || {}) : {};

    currentRoom.quests.forEach((qId) => {
        const quest = ALL_QUESTS[qId];
        const score = userScores[qId] !== undefined ? userScores[qId] : null;

        const btn = document.createElement('div');
        btn.className = 'quest-card';
        btn.style.display = 'flex';
        btn.style.justifyContent = 'space-between';
        btn.innerHTML = `
            <span>${quest.title}</span>
            <span style="font-weight:bold; color:var(--button-color)">${score === null ? "▶ Играть" : score + " баллов"}</span>
        `;
        if (score === null) {
            btn.onclick = () => startRoomQuest(currentRoom, qId);
        }
        tasksDiv.appendChild(btn);
    });

    const partDiv = document.getElementById('room-participants');
    partDiv.innerHTML = '';
    Object.values(currentRoom.participants).forEach(p => {
        const total = Object.values(p.scores).reduce((a, b) => a + b, 0);
        partDiv.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${p.name}</span> <b>${total} б.</b>
        </div>`;
    });
}

function startRoomQuest(room, qId) {
    const quest = ALL_QUESTS[qId];
    activeQuest = quest;

    hideAllScreens();
    document.getElementById('quest-container').classList.remove('hidden');
    document.getElementById('quest-content').innerHTML = '';
    document.getElementById('quest-timer').innerText = '';

    quest.init(document.getElementById('quest-content'), tg, (score) => {
        const user = tg.initDataUnsafe?.user;
        if (user && room.participants[user.id]) {
            room.participants[user.id].scores[qId] = score;
            let rooms = JSON.parse(localStorage.getItem('tg_rooms_v7'));
            rooms = rooms.map(r => r.id === room.id ? room : r);
            localStorage.setItem('tg_rooms_v7', JSON.stringify(rooms));
        }
        tg.showAlert(`Вы набрали ${score} баллов!`, () => {
            // ВАЖНО: Убираем старый контейнер и возвращаемся в комнату
            if (activeQuest && activeQuest.destroy) activeQuest.destroy();
            activeQuest = null;
            renderRoomUI();
        });
    }, room.config);
}

// --- АДМИНКА ---
function openAdmin() {
    hideAllScreens();
    document.getElementById('admin-panel').classList.remove('hidden');

    const list = document.getElementById('admin-quest-list');
    list.innerHTML = '<b>Выберите задания для комнаты:</b><br>';

    for (const [key, quest] of Object.entries(ALL_QUESTS)) {
        list.innerHTML += `
            <div style="margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
                <label><input type="checkbox" value="${key}" onchange="window.app.toggleSettings('${key}', this.checked)"> ${quest.title}</label>
                <div id="settings-${key}" class="hidden" style="margin-top: 10px; font-size: 14px;"></div>
            </div>
        `;
    }
}

function toggleSettings(questKey, isChecked) {
    const container = document.getElementById(`settings-${questKey}`);
    if (!isChecked) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    if (questKey === 'hanoi') {
        container.innerHTML = `
            <label>Диски (3-6): <input type="number" id="set-hanoi-disks" value="3" min="3" max="6" style="width:50px;"></label><br>
            <label>Время (сек): <input type="number" id="set-hanoi-time" value="60" style="width:50px;"></label>
        `;
    } else if (questKey === 'math') {
        container.innerHTML = `
            <label>Кол-во примеров: <input type="number" id="set-math-count" value="5" min="1" max="20" style="width:50px;"></label><br>
            <label>Время на 1 пример (сек): <input type="number" id="set-math-time" value="15" style="width:50px;"></label>
        `;
    } else if (questKey === 'wordle') {
        container.innerHTML = `<label>Слово (до 13 букв): <input type="text" id="set-wordle-word" placeholder="КВЕСТ" style="width:100%;"></label>`;
    }
}

function saveAdminQuest() {
    const name = document.getElementById('admin-quest-name').value || "Комната";
    const password = document.getElementById('admin-room-password').value.toUpperCase();
    const startDate = document.getElementById('admin-date-start').value;
    const endDate = document.getElementById('admin-date-end').value;

    if (!password || !startDate || !endDate) return tg.showAlert("Заполните пароль и даты!");

    const selectedQuests = [];
    document.querySelectorAll('#admin-quest-list input[type="checkbox"]').forEach(cb => {
        if (cb.checked) selectedQuests.push(cb.value);
    });
    if (selectedQuests.length === 0) return tg.showAlert("Выберите задания!");

    const config = {};
    if (selectedQuests.includes('hanoi')) {
        config.hanoiDisks = parseInt(document.getElementById('set-hanoi-disks').value) || 3;
        config.hanoiTime = parseInt(document.getElementById('set-hanoi-time').value) || 60;
    }
    if (selectedQuests.includes('math')) {
        config.mathCount = parseInt(document.getElementById('set-math-count').value) || 5;
        config.mathTime = parseInt(document.getElementById('set-math-time').value) || 15;
    }
    if (selectedQuests.includes('wordle')) {
        config.wordleWord = document.getElementById('set-wordle-word').value || "КВЕСТ";
    }

    let rooms = JSON.parse(localStorage.getItem('tg_rooms_v7')) || [];
    rooms.push({
        id: Date.now(),
        name: name,
        password: password,
        startDate: startDate,
        endDate: endDate,
        quests: selectedQuests,
        config: config,
        participants: {}
    });

    localStorage.setItem('tg_rooms_v7', JSON.stringify(rooms));
    tg.showAlert("Комната создана!");
    goMenu();
}

function hideAllScreens() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('quest-container').classList.add('hidden');
    document.getElementById('room-screen').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
}

function goMenu() {
    if (activeQuest && activeQuest.destroy) activeQuest.destroy();
    activeQuest = null; currentRoom = null;
    hideAllScreens();
    document.getElementById('main-menu').classList.remove('hidden');
    renderRoomList();
}

window.app = { goMenu, openAdmin, saveAdminQuest, joinRoom, toggleSettings };
window.onload = init;