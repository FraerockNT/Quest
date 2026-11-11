import { startSnow } from './snow.js?v=14';
// Задания подключаются по одному: если какого-то файла нет, остальное приложение всё равно работает
const FILES = { hanoi: 'hanoi', snake: 'snake', quiz: 'quiz', math: 'math', wordle: 'wordle', lock: 'lock', match: 'match',
    simon: 'simon', memory: 'memory', slide: 'slide', riddle: 'riddle', lights: 'lights', balls: 'balls' };
const QUESTS = {};
const missing = [];
await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    try { QUESTS[key] = (await import(`./quests/${file}.js?v=14`)).default; }
    catch (e) { missing.push(`${file}.js (${e.message})`); }
}));

// Любая ошибка выводится на экран, а не пропадает молча
function bootError(text) {
    const box = document.getElementById('boot-error');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerText += (box.innerText ? '\n' : '') + text;
}
window.addEventListener('error', (e) => bootError('Ошибка: ' + e.message));
window.addEventListener('unhandledrejection', (e) => bootError('Ошибка: ' + (e.reason?.message || e.reason)));
if (missing.length) bootError('Не загрузились файлы заданий: ' + missing.join('; ') + '. Загрузите их в папку quests/ на сервер.');

// В обычном браузере (для проверки) подставляем «заглушку» Telegram. ?as=123 — зайти как игрок 123.
const tg = window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : {
    initData: 'dev:' + (new URLSearchParams(location.search).get('as') || '1'),
    initDataUnsafe: { user: { id: 1, first_name: 'Тест' } },
    ready() {}, expand() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
    showAlert(m, cb) { alert(m); cb && cb(); }, showConfirm(m, cb) { cb(confirm(m)); },
};
tg.ready(); tg.expand();
try { tg.disableVerticalSwipes?.(); } catch (e) {}   // чтобы перетаскивание не сворачивало приложение

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SCREENS = ['main-menu', 'room-screen', 'quest-container', 'admin-room', 'admin-edit'];

let me = { admin: false, rooms: [] };
let room = null;          // комната глазами игрока
let adminRoom = null;     // комната глазами админа
let edit = null;          // редактируемая комната
let screen = 'main-menu';
let refreshTimer = null;
let timeShift = 0;        // разница между часами сервера и телефона
let active = null;        // текущее задание {quest, taskId, hintUsed, penalty, finished}

// ───────────── Связь с сервером ─────────────
async function api(action, body = {}) {
    let res, data;
    try {
        res = await fetch('/api/' + action, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, initData: tg.initData }),
        });
        data = await res.json();
    } catch (e) { throw new Error('Нет связи с сервером. Проверьте интернет.'); }
    if (!res.ok || data.error) throw new Error(data.error || 'Ошибка сервера');
    return data;
}
const safe = async (fn) => { try { return await fn(); } catch (e) { tg.showAlert(e.message); } };
const confirmP = (msg) => new Promise((r) => tg.showConfirm(msg, r));

// ───────────── Экраны и окна ─────────────
function show(name) {
    screen = name;
    SCREENS.forEach((s) => $(s).classList.toggle('hidden', s !== name));
    clearInterval(refreshTimer);
    window.scrollTo(0, 0);
}
function modal(html, onClose) {
    $('modal-body').innerHTML = html;
    $('modal').classList.remove('hidden');
    $('modal').onClose = onClose;
}
function closeModal() {
    $('modal').classList.add('hidden');
    const cb = $('modal').onClose; $('modal').onClose = null;
    if (cb) cb();
}
function fmtLeft(ms) {
    if (ms <= 0) return 'время вышло';
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d > 0 ? `${d} д ${h} ч` : h > 0 ? `${h} ч ${m % 60} мин` : `${m} мин`;
}
const serverNow = () => Date.now() + timeShift;
const toLocalInput = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const taskTitle = (t) => t.title || QUESTS[t.type]?.title || 'Задание';

// ───────────── Меню ─────────────
async function init() {
    startSnow();
    const g = $('garland');
    ['#ff4257', '#ffd23f', '#3ddc84', '#4aa3ff'].forEach((c, i, a) => {
        for (let k = 0; k < 4; k++) {
            const b = document.createElement('span');
            b.className = 'bulb'; b.style.background = c; b.style.boxShadow = `0 0 10px 2px ${c}`;
            b.style.animationDelay = `${(i * 4 + k) * 0.17}s`;
            g.appendChild(b);
        }
    });
    if (tg.showScanQrPopup) $('scan-btn').classList.remove('hidden');
    await renderMenu();
}

async function renderMenu() {
    show('main-menu');
    const list = $('quest-list');
    list.innerHTML = '<p class="muted center">Загружаю…</p>';
    try {
        me = await api('me');
        timeShift = me.now - Date.now();
    } catch (e) { list.innerHTML = `<p class="muted center">${esc(e.message)}</p>`; return; }

    const user = tg.initDataUnsafe?.user;
    $('user-greeting').innerText = `${me.admin ? 'Привет, админ' : 'Привет'}, ${user?.first_name || 'друг'}! ❄️`;
    $('admin-new').classList.toggle('hidden', !me.admin);
    $('my-id').innerText = `Ваш Telegram ID: ${me.id}${me.admin ? ' · админ' : ''}`;
    list.innerHTML = '';
    if (!me.rooms.length) {
        list.innerHTML = '<p class="muted center">Пока нет комнат. Введи пароль выше — и в путь!</p>';
        return;
    }
    me.rooms.forEach((r) => {
        const card = document.createElement('div');
        card.className = 'card room-card';
        const status = serverNow() < r.start ? 'ещё не начался' : serverNow() > r.end ? 'завершён' : 'идёт';
        card.innerHTML = `<div><div class="name">🎄 ${esc(r.name)}</div>
            <div class="muted">${me.admin ? 'Управление' : 'Команда: ' + esc(r.team)} · ${status}</div></div><div>›</div>`;
        card.onclick = () => (me.admin ? openAdminRoom(r.id) : openRoom(r.id));
        list.appendChild(card);
    });
}

async function joinRoom() {
    const password = $('join-room-code').value.trim();
    const team = $('join-team-name').value.trim();
    if (!password) return tg.showAlert('Введите пароль комнаты');
    await safe(async () => {
        const r = await api('join', { password, team });
        $('join-room-code').value = '';
        await openRoom(r.roomId);
    });
}

// ───────────── Комната игрока ─────────────
async function openRoom(id) {
    await safe(async () => {
        room = await api('room', { roomId: id });
        timeShift = room.now - Date.now();
        show('room-screen');
        renderRoom();
        refreshTimer = setInterval(refreshRoom, 12000);   // подтягиваем успехи команды
    });
}
async function refreshRoom() {
    if (screen !== 'room-screen') return;
    try { room = await api('room', { roomId: room.id }); renderRoom(); } catch (e) {}
}

function mapHtml(tasks, mapSrc, colorOf, withLegend) {
    if (!mapSrc) return '';
    const pins = tasks.filter((t) => t.x != null && t.y != null)
        .map((t) => `<div class="pin ${colorOf(t)}" style="left:${t.x * 100}%;top:${t.y * 100}%">${t.n}</div>`).join('');
    return `<div class="card"><div class="card-title">🗺 Карта</div>
        <div class="map-wrap"><img src="${mapSrc}" alt="Карта">${pins}</div>
        ${withLegend ? `<div class="legend"><span><i style="background:var(--c-red)"></i>не найдено</span>
        <span><i style="background:var(--c-yellow)"></i>найдено</span><span><i style="background:var(--c-green)"></i>решено</span></div>` : ''}</div>`;
}

function renderRoom() {
    $('room-title').innerText = room.name;
    $('room-team').innerText = `Команда «${room.team}»: ${room.members.join(', ')} · ${room.total} б.`;
    $('room-status').innerText = `⏳ ${fmtLeft(room.end - serverNow())}`;

    const color = { new: 'red', found: 'yellow', solved: 'green', failed: 'gray' };
    $('room-map-box').innerHTML = mapHtml(room.tasks, room.map, (t) => color[t.state], true);

    const box = $('room-tasks'); box.innerHTML = '';
    room.tasks.forEach((t) => {
        const el = document.createElement('div');
        el.className = `task-card ${t.state}`;
        let name, sub = '', right = '';
        if (t.state === 'new') { name = 'Задание ещё не найдено'; sub = 'Найди код на локации'; right = '🔒'; }
        else {
            name = taskTitle(t);
            if (t.state === 'found') { sub = `Код введён · до ${t.points} б.`; right = '▶ Играть'; }
            else {
                right = `${t.score} б.`;
                sub = t.state === 'failed' ? 'Не получилось' : t.penalty ? `💡 подсказка: −${t.penalty}` : 'Выполнено';
            }
            if (t.hint && t.state === 'found') sub += ' · 💡 подсказка взята';
        }
        el.innerHTML = `<div class="left"><span class="num">${t.n}</span><div><div class="tname">${esc(name)}</div>
            <div class="tsub">${esc(sub)}</div></div></div><div class="right">${right}</div>`;
        if (t.state === 'found') el.onclick = () => startTask(t.id);
        box.appendChild(el);
    });

    $('room-board').innerHTML = room.board.map((b, i) =>
        `<div class="board-row ${b.you ? 'you' : ''}"><span>${i + 1}. ${esc(b.name)}</span><span>${b.score} б. · ${b.solved}/${room.tasks.length}</span></div>`).join('');
}

async function unlock(codeArg) {
    const code = (codeArg ?? $('unlock-code').value).replace(/\D/g, '');
    if (code.length !== 6) return tg.showAlert('Код состоит из 6 цифр');
    await safe(async () => {
        const r = await api('unlock', { roomId: room.id, code });
        $('unlock-code').value = '';
        room = await api('room', { roomId: room.id });
        renderRoom();
        if (r.state === 'solved') return tg.showAlert('Это задание вы уже выполнили!');
        tg.HapticFeedback.notificationOccurred('success');
        await startTask(r.taskId);
    });
}
function scanQr() {
    tg.showScanQrPopup({ text: 'Наведи камеру на QR-код задания' }, (text) => {
        const digits = String(text).replace(/\D/g, '');
        if (digits.length === 6) { tg.closeScanQrPopup(); unlock(digits); return true; }
        return false;
    });
}

// ───────────── Прохождение задания ─────────────
async function startTask(taskId) {
    await safe(async () => {
        const info = await api('task_open', { roomId: room.id, taskId });
        const quest = QUESTS[info.type];
        if (!quest) return tg.showAlert('Этот тип задания не загружен или удалён. Сообщите админу.');
        active = { quest, taskId, hintUsed: info.hintUsed, penalty: info.penalty, max: info.max, finished: false, adminHint: null };

        show('quest-container');
        $('quest-title').innerText = info.title || quest.title;
        $('quest-timer').innerText = '';
        $('quest-content').innerHTML = '';
        $('quest-sub').innerText = `Баллов за задание: до ${info.max} · подсказка −${info.penalty}`;
        updateHintBtn();

        const cfg = {
            ...info.cfg,
            progress: info.progress,
            points: info.max,
            image: info.image,
            saveProgress: (p) => api('progress', { roomId: room.id, taskId, progress: p }).catch(() => {}),
            check: (answer) => api('check', { roomId: room.id, taskId, answer }),
            useHint: () => takeHint(false),
        };
        quest.init($('quest-content'), tg, (score) => finishTask(score), cfg);
    });
}

function updateHintBtn() {
    const b = $('hint-btn');
    b.classList.toggle('used', !!active?.hintUsed);
    b.innerText = active?.hintUsed ? '💡 Подсказка ✓' : '💡 Подсказка';
}

// Подсказка: первый раз стоит баллов (спрашиваем), потом запоминается и смотреть можно бесплатно
async function takeHint(showIt = true) {
    if (!active || active.finished) return false;
    if (!active.hintUsed) {
        const ok = await confirmP(`Подсказка снимет ${active.penalty} баллов за это задание. Взять?`);
        if (!ok) return false;
    }
    try {
        const r = await api('hint', { roomId: room.id, taskId: active.taskId });
        active.hintUsed = true; active.adminHint = r.hint;
        updateHintBtn();
        if (showIt) {
            const text = r.hint || (active.quest.getHint ? active.quest.getHint() : active.quest.defaultHint) || 'Подсказки нет.';
            modal(`<h3>💡 Подсказка</h3><p>${esc(text)}</p><p class="muted">Штраф ${active.penalty} баллов уже учтён. Эту подсказку можно открывать снова бесплатно.</p>`);
        }
        return true;
    } catch (e) { tg.showAlert(e.message); return false; }
}

async function finishTask(raw) {
    if (!active || active.finished) return;
    active.finished = true;
    let r;
    try { r = await api('complete', { roomId: room.id, taskId: active.taskId, score: raw }); }
    catch (e) { active.finished = false; return tg.showAlert(e.message); }
    tg.HapticFeedback.notificationOccurred(r.score > 0 ? 'success' : 'error');
    const penaltyLine = r.penalty ? `<p class="muted center">Подсказка: −${r.penalty}</p>` : '';
    modal(r.raw > 0
        ? `<h3 class="center">🎉 Задание выполнено!</h3><div class="big-score">+${r.score}</div>${penaltyLine}`
        : `<h3 class="center">😔 Не получилось</h3><p class="center">Это задание закрыто, но у вас ещё есть другие.</p>`,
        () => leaveQuest());
}

let leaving = false;
async function leaveQuest() {
    if (leaving) return;
    leaving = true;
    try { active?.quest.destroy?.(); } catch (e) {}     // ошибка в задании не должна мешать выйти
    active = null;
    show('room-screen'); renderRoom();                    // комната появляется сразу, данные обновятся следом
    refreshTimer = setInterval(refreshRoom, 12000);
    leaving = false;
    try { room = await api('room', { roomId: room.id }); renderRoom(); } catch (e) {}
}

// ───────────── Админ: просмотр комнаты ─────────────
async function openAdminRoom(id) {
    await safe(async () => {
        adminRoom = await api('admin_room', { roomId: id });
        let qrSvg = null;
        try { ({ qrSvg } = await import('./qr.js?v=14')); } catch (e) {}   // без qr.js просто не будет предпросмотра
        const r = adminRoom;
        const tasks = r.tasks.map((t, i) => ({ ...t, n: i + 1 }));
        const solvedBy = (t) => r.teams.filter((tm) => tm.tasks[t.id]?.solved).length;
        const foundBy = (t) => r.teams.filter((tm) => tm.tasks[t.id]?.found).length;
        const html = `
            <h2 class="title">${esc(r.name)}</h2>
            <p class="subtitle">Пароль: <b>${esc(r.password)}</b> · ${new Date(r.start).toLocaleString('ru')} — ${new Date(r.end).toLocaleString('ru')}</p>
            <div class="card"><div class="card-title">🔑 Коды заданий (спрячь их на локации)</div>
                ${tasks.map((t) => `<div class="board-row"><span>${t.n}. ${esc(taskTitle(t))} <span class="muted">(${t.points || QUESTS[t.type]?.defaultPoints || '?'} б.)</span></span><span class="code-pill">${t.code}</span></div>`).join('')}
            </div>
            <div class="card"><div class="card-title">🖨 QR-коды заданий</div>
                <p class="muted">Распечатай и спрячь на локации. Игрок наводит камеру в приложении на код или вводит 6 цифр.</p>
                <div class="qr-grid">${tasks.map((t) => `<div class="qr-item">${qrSvg ? qrSvg(t.code, { border: 2 }) : ''}<div class="code-pill" style="font-size:14px;letter-spacing:2px">${t.code}</div><div class="muted">№${t.n}</div></div>`).join('')}</div>
                <button class="btn" onclick="window.app.printQr()">🖨 Открыть для печати и скачивания</button>
            </div>
            ${mapHtml(tasks, r.map, () => 'blue', false)}
            <div class="card"><div class="card-title">🏆 Команды (${r.teams.length})</div>
                ${r.teams.length ? r.teams.map((tm) => `<div style="margin-bottom:10px"><div class="board-row"><b>${esc(tm.name)}</b><b>${tm.score} б.</b></div>
                    <div class="muted">${esc(tm.members.join(', '))}</div>
                    <div>${tasks.map((t) => { const x = tm.tasks[t.id] || {};
                        return `<span class="chip ${x.solved ? 'g' : x.found ? 'y' : 'r'}">${t.n}${x.solved ? ': ' + x.score + (x.hint ? '💡' : '') : x.found ? ': …' : ''}</span>`; }).join('')}</div></div>`).join('')
                    : '<p class="muted">Пока никто не вошёл.</p>'}
            </div>
            <div class="card"><div class="card-title">📊 По заданиям</div>
                ${tasks.map((t) => `<div class="board-row"><span>${t.n}. ${esc(taskTitle(t))}</span><span>нашли ${foundBy(t)} · решили ${solvedBy(t)}</span></div>`).join('')}
            </div>`;
        $('admin-room-body').innerHTML = html;
        show('admin-room');
    });
}
// Страница печати открывается в обычном браузере: там работают печать, PDF и скачивание картинок
async function printQr() {
    await safe(async () => {
        const r = await api('admin_print_link', { roomId: adminRoom.id });
        const url = location.origin + r.path;
        if (tg.openLink) tg.openLink(url); else window.open(url, '_blank');
        modal(`<h3>Страница для печати</h3><p>Открываю в браузере. Если не открылась, скопируй ссылку (действует 2 часа, никому её не отправляй):</p><p style="word-break:break-all;user-select:text;font-size:12px">${esc(url)}</p>`);
    });
}
async function deleteRoom() {
    if (!(await confirmP('Удалить комнату вместе с результатами команд?'))) return;
    await safe(async () => { await api('admin_delete', { roomId: adminRoom.id }); await renderMenu(); });
}

// ───────────── Админ: создание и редактирование ─────────────
const randCode = () => String(Math.floor(100000 + Math.random() * 900000));

function newRoom() {
    const start = Math.ceil(Date.now() / 3600000) * 3600000;
    edit = { id: '', name: '', password: '', start, end: start + 3 * 3600000, map: '', tasks: [], placing: null };
    renderEdit(); show('admin-edit');
}
function editRoom() {
    edit = JSON.parse(JSON.stringify(adminRoom)); edit.placing = null;
    edit.tasks.forEach((t) => { if (!t.points && QUESTS[t.type]) t.points = QUESTS[t.type].defaultPoints; });
    edit.tasks.forEach((t) => { if (!t.hint && QUESTS[t.type]) t.hint = QUESTS[t.type].adminHint ?? QUESTS[t.type].defaultHint ?? ''; });
    renderEdit(); show('admin-edit');
}

function fieldHtml(f, value, ti, cfg = {}) {
    const attr = `data-ti="${ti}" data-cfg="${f.key}"`;
    const v = value ?? f.def ?? '';
    const note = f.note ? `<span class="muted">${esc(f.note(cfg))}</span>` : '';
    if (f.type === 'select') {
        const opts = f.options.map(([k, l]) => `<option value="${k}" ${String(v) === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
        return `<label class="field">${esc(f.label)}<select ${attr}>${opts}</select>${note}</label>`;
    }
    if (f.type === 'textarea') return `<label class="field">${esc(f.label)}<textarea ${attr}>${esc(v)}</textarea>${note}</label>`;
    if (f.type === 'number') return `<label class="field">${esc(f.label)}<input type="number" ${attr} value="${esc(v)}" min="${f.min ?? ''}" max="${f.max ?? ''}">${note}</label>`;
    return `<label class="field">${esc(f.label)}<input type="text" ${attr} value="${esc(v)}">${note}</label>`;
}

function renderEdit() {
    const e = edit;
    const typeOptions = Object.entries(QUESTS).map(([k, q]) => `<option value="${k}">${esc(q.title)}</option>`).join('');
    const taskHtml = e.tasks.map((t, i) => {
        const q = QUESTS[t.type];
        return `<div class="task-edit">
            <div class="row between"><b>${i + 1}. ${esc(q.title)}</b><button class="icon-btn" data-act="del" data-ti="${i}">✕</button></div>
            <label class="field">Название (необязательно)<input type="text" data-ti="${i}" data-f="title" value="${esc(t.title || '')}" maxlength="40" placeholder="${esc(q.title)}"></label>
            <label class="field">6-значный код (его прячешь на локации)
                <div class="row gap8"><input type="text" inputmode="numeric" maxlength="6" data-ti="${i}" data-f="code" value="${esc(t.code)}">
                <button class="icon-btn" data-act="dice" data-ti="${i}">🎲</button></div></label>
            <label class="field">Баллов за задание (стандартно ${q.defaultPoints})<input type="number" inputmode="numeric" data-ti="${i}" data-f="points" value="${t.points || q.defaultPoints}" min="1" max="500"></label>
            ${(q.adminFields || []).map((f) => fieldHtml(f, t.cfg?.[f.key], i, t.cfg || {})).join('')}
            ${t.type === 'riddle' ? `<div class="field">Фото к загадке (необязательно)
                <input type="file" accept="image/*" data-img="${i}">
                ${t.image ? `<img src="${t.image}" style="max-width:100%;border-radius:10px"><button class="btn btn-ghost btn-small" data-act="delimg" data-ti="${i}">Убрать фото</button>` : ''}</div>` : ''}
            <label class="field">Подсказка для игроков (стандартная уже вписана, можно изменить)<textarea data-ti="${i}" data-f="hint" maxlength="600">${esc(t.hint || '')}</textarea></label>
            ${e.map ? `<button class="btn btn-ghost btn-small" data-act="place" data-ti="${i}">${t.x != null ? '📍 Передвинуть точку на карте' : '📍 Поставить точку на карте'}</button>` : ''}
        </div>`;
    }).join('');

    const pins = e.tasks.map((t, i) => (t.x != null && t.y != null)
        ? `<div class="pin ${e.placing === i ? 'yellow' : 'red'}" style="left:${t.x * 100}%;top:${t.y * 100}%">${i + 1}</div>` : '').join('');

    $('admin-form').innerHTML = `<div class="stack" id="edit-root">
        <label class="field">Название квеста<input type="text" data-k="name" value="${esc(e.name)}" placeholder="Новогодний квест"></label>
        <label class="field">Пароль для входа участников<input type="text" data-k="password" value="${esc(e.password)}" placeholder="Например: SNOW2027"></label>
        <div class="row gap8">
            <label class="field" style="flex:1">Начало<input type="datetime-local" data-k="start" value="${toLocalInput(e.start)}"></label>
            <label class="field" style="flex:1">Конец<input type="datetime-local" data-k="end" value="${toLocalInput(e.end)}"></label>
        </div>
        <div class="card"><div class="card-title">🗺 Карта локации</div>
            <p class="muted">Загрузи фото или схему места. Потом отметь на ней, где спрятано каждое задание.</p>
            <input type="file" accept="image/*" id="map-file">
            ${e.map ? `<div class="map-wrap ${e.placing != null ? 'placing' : ''}" id="edit-map"><img src="${e.map}" alt="">${pins}</div>
                ${e.placing != null ? `<p class="note">Нажми на карту — там появится точка задания №${e.placing + 1}</p>` : ''}
                <button class="btn btn-ghost btn-small" data-act="delmap">Убрать карту</button>` : ''}
        </div>
        <div class="card-title">Задания</div>
        ${taskHtml || '<p class="muted">Заданий пока нет. Добавь первое ниже.</p>'}
        <div class="row gap8"><select id="new-type">${typeOptions}</select><button class="btn btn-green btn-auto" data-act="add">Добавить</button></div>
        <button class="btn" data-act="save">${e.id ? 'Сохранить изменения' : 'Создать комнату'}</button>
    </div>`;
}

function collectCfg(t, q) {
    t.cfg = t.cfg || {};
    (q.adminFields || []).forEach((f) => { if (t.cfg[f.key] === undefined && f.def !== undefined) t.cfg[f.key] = f.def; });
}

function onEditInput(ev) {
    const el = ev.target, d = el.dataset;
    if (d.k) {
        edit[d.k] = (d.k === 'start' || d.k === 'end') ? new Date(el.value).getTime() : el.value;
    } else if (d.ti !== undefined && d.f) {
        edit.tasks[+d.ti][d.f] = el.value;
    } else if (d.ti !== undefined && d.cfg) {
        const t = edit.tasks[+d.ti]; t.cfg = t.cfg || {};
        t.cfg[d.cfg] = el.type === 'number' ? Number(el.value) : el.value;
    }
}

async function onEditClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (btn) {
        const act = btn.dataset.act, i = +btn.dataset.ti;
        if (act === 'add') {
            const type = $('new-type').value;
            const t = { id: '', type, code: randCode(), title: '', hint: '', x: null, y: null, points: QUESTS[type].defaultPoints, image: '', cfg: {} };
            collectCfg(t, QUESTS[type]); QUESTS[type].normalizeCfg?.(t.cfg); t.hint = QUESTS[type].adminHint ?? QUESTS[type].defaultHint ?? ''; edit.tasks.push(t); renderEdit();
        } else if (act === 'del') { edit.tasks.splice(i, 1); edit.placing = null; renderEdit(); }
        else if (act === 'delimg') { edit.tasks[i].image = ''; renderEdit(); }
        else if (act === 'dice') { edit.tasks[i].code = randCode(); renderEdit(); }
        else if (act === 'place') { edit.placing = i; renderEdit(); $('edit-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else if (act === 'delmap') { edit.map = ''; edit.tasks.forEach((t) => { t.x = t.y = null; }); edit.placing = null; renderEdit(); }
        else if (act === 'save') await saveRoom();
        return;
    }
    const mapEl = ev.target.closest('#edit-map');
    if (mapEl && edit.placing != null) {
        const r = mapEl.getBoundingClientRect();
        const t = edit.tasks[edit.placing];
        t.x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
        t.y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
        edit.placing = null; renderEdit();
    }
}

// Уменьшаем фото, чтобы оно было лёгким
function loadImage(file, done, maxSide = 1000, quality = 0.72) {
    const img = new Image();
    img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        done(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => tg.showAlert('Не удалось открыть картинку');
    img.src = URL.createObjectURL(file);
}
function loadMap(file) { loadImage(file, (url) => { edit.map = url; renderEdit(); }); }

async function saveRoom() {
    const e = edit;
    if (!e.password.trim()) return tg.showAlert('Придумай пароль для входа');
    if (!e.tasks.length) return tg.showAlert('Добавь хотя бы одно задание');
    if (!(e.start > 0 && e.end > e.start)) return tg.showAlert('Проверь даты: конец должен быть позже начала');
    for (let i = 0; i < e.tasks.length; i++) {
        const t = e.tasks[i], q = QUESTS[t.type];
        if (!q) return tg.showAlert(`Задание №${i + 1}: этот тип больше не существует, удалите его`);
        const p = Number(t.points === undefined || t.points === '' ? q.defaultPoints : t.points);
        if (!Number.isInteger(p) || p < 1 || p > 500) return tg.showAlert(`Задание №${i + 1} (${q.title}): укажите баллы целым числом от 1 до 500`);
        t.points = p;      // баллы всегда записываются явно
    }
    e.tasks.forEach((t) => QUESTS[t.type].normalizeCfg?.(t.cfg));
    const codes = e.tasks.map((t) => t.code);
    if (codes.some((c) => !/^\d{6}$/.test(c))) return tg.showAlert('Каждый код должен состоять из 6 цифр');
    if (new Set(codes).size !== codes.length) return tg.showAlert('Коды заданий не должны повторяться');
    await safe(async () => {
        const r = await api('admin_save', { room: { ...e, placing: undefined } });
        tg.HapticFeedback.notificationOccurred('success');
        await renderMenu();
        await openAdminRoom(r.roomId);
    });
}

// ───────────── Кнопка «Назад» ─────────────
async function back() {
    if (screen === 'quest-container') {
        // Спрашиваем только там, где выход что-то стоит (например, открытый вопрос викторины)
        const warn = active && !active.finished ? active.quest.leaveWarning?.() : '';
        if (warn && !(await confirmP(warn))) return;
        return leaveQuest();
    }
    if (screen === 'admin-edit') return edit.id ? show('admin-room') : renderMenu();
    return renderMenu();
}

document.addEventListener('input', (ev) => { if (screen === 'admin-edit') onEditInput(ev); });
document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'map-file' && el.files[0]) return loadMap(el.files[0]);
    if (el.dataset?.img !== undefined && el.files[0]) return loadImage(el.files[0], (url) => { edit.tasks[+el.dataset.img].image = url; renderEdit(); });
    if (screen === 'admin-edit' && el.dataset?.cfg !== undefined) {
        const t = edit.tasks[+el.dataset.ti];
        if (QUESTS[t.type].normalizeCfg) { QUESTS[t.type].normalizeCfg(t.cfg); renderEdit(); }
    }
});
document.addEventListener('click', (ev) => { if (screen === 'admin-edit') onEditClick(ev); });

window.app = { printQr, back, joinRoom, unlock: () => unlock(), scanQr, hint: () => takeHint(true), newRoom, editRoom, deleteRoom, closeModal };
// Запускаем сразу: раньше запуск ждал события загрузки страницы, а оно могло случиться раньше,
// чем подгрузятся файлы заданий, и тогда приложение просто не стартовало.
init().catch((e) => bootError('Ошибка запуска: ' + (e?.message || e)));
