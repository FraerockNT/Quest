import hanoiQuest from './quests/hanoi.js';
import snakeQuest from './quests/snake.js';
import quizQuest from './quests/quiz.js';

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Список всех доступных заданий (Можно переставлять, удалять или добавлять новые)
const QUESTS = [hanoiQuest, snakeQuest, quizQuest];

let activeQuest = null;

// Инициализация приложения
function init() {
    // Приветствие пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('user-greeting').innerText = `Привет, ${user.first_name}! Выбирай испытание.`;
    }

    // Рендер карточек заданий
    const list = document.getElementById('quest-list');
    QUESTS.forEach((quest, index) => {
        const card = document.createElement('div');
        card.className = 'quest-card';
        card.innerHTML = `
            <div class="quest-title">${quest.title}</div>
            <div class="quest-desc">${quest.description}</div>
        `;
        card.onclick = () => startQuest(quest);
        list.appendChild(card);
    });
}

// Запуск задания
function startQuest(quest) {
    activeQuest = quest;
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('quest-container').classList.remove('hidden');
    document.getElementById('quest-timer').innerText = '';

    const container = document.getElementById('quest-content');
    container.innerHTML = ''; // Очищаем предыдущее

    // Передаем управление в модуль задания
    quest.init(container, tg, onQuestComplete);
}

// Функция, которая вызывается, когда игрок прошел квест
function onQuestComplete(questTitle) {
    tg.HapticFeedback.notificationOccurred('success');
    tg.showAlert(`Квест "${questTitle}" пройден!`);

    // Можно отправить данные в бота:
    // tg.sendData(JSON.stringify({ quest: questTitle, status: "win" }));
}

// Возврат в меню
function goMenu() {
    if (activeQuest && activeQuest.destroy) {
        activeQuest.destroy(); // Останавливаем таймеры/циклы игры
    }
    activeQuest = null;
    document.getElementById('quest-content').innerHTML = '';
    document.getElementById('quest-container').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

// Глобальный экспорт для HTML (кнопка Назад)
window.app = { goMenu, startQuest };
window.onload = init;