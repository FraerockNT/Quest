import json
import logging
import asyncio
import os
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

BOT_TOKEN = "9270736079:AAGEkAgT06gRHnP4AEXgbexHxW8nJ4e9ySw"
WEBAPP_URL = "https://quest123.bothost.tech"
ADMIN_ID = 5237959867

logging.basicConfig(level=logging.INFO)
HTML_PAGE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Квесты</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link rel="stylesheet" href="/style.css?v=7">
</head>
<body>
    <!-- Главное меню -->
    <div id="main-menu" class="screen">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="menu-title">Квесты</div>
            <div id="admin-btn" class="hidden" onclick="window.app.openAdmin()" style="cursor:pointer; font-size:24px;">⚙️</div>
        </div>
        <div class="menu-subtitle" id="user-greeting">Привет!</div>

        <div style="display:flex; gap:10px; margin-bottom:20px;">
            <input type="text" id="join-room-code" placeholder="Код комнаты" style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc; text-transform:uppercase;">
            <button class="btn" style="width:auto; margin:0; padding:10px 20px;" onclick="window.app.joinRoom()">Войти</button>
        </div>

        <div id="quest-list"></div>
    </div>

    <!-- Экран прохождения -->
    <div id="quest-container" class="screen hidden">
        <div class="screen-header">
            <button class="back-btn" onclick="window.app.goMenu()">← Назад</button>
            <div class="timer" id="quest-timer"></div>
            <div class="score-display" id="current-score-display" style="font-weight:bold; color:var(--button-color);">0</div>
        </div>
        <div id="quest-content" style="flex: 1; display: flex; flex-direction: column;"></div>
    </div>

    <!-- Экран Комнаты -->
    <div id="room-screen" class="screen hidden">
        <div class="screen-header">
            <button class="back-btn" onclick="window.app.goMenu()">← Выйти</button>
            <h2>Комната</h2>
        </div>
        <h3 id="room-title">Название</h3>
        <p id="room-status" style="margin-bottom:20px; font-weight:bold;"></p>

        <div id="room-tasks" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;"></div>

        <div style="background:var(--secondary-bg); padding:15px; border-radius:10px;">
            <h4 style="margin-bottom:10px;">Участники:</h4>
            <div id="room-participants" style="font-size:14px;"></div>
        </div>
    </div>

    <!-- Админ панель -->
    <div id="admin-panel" class="screen hidden">
        <div class="screen-header">
            <button class="back-btn" onclick="window.app.goMenu()">← Назад</button>
            <h2>Админка</h2>
        </div>

        <div style="margin-bottom:15px;">
            <label>Название комнаты/квеста:</label>
            <input type="text" id="admin-quest-name" placeholder="Новогодний квест" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc;">
        </div>

        <div id="admin-quest-list" style="margin-bottom: 15px;"></div>

        <div style="margin-bottom:15px;">
            <label>Пароль для входа:</label>
            <input type="text" id="admin-room-password" placeholder="Например: 1Q67P7" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc;">
        </div>

        <div style="margin-bottom:15px; display:flex; gap:10px;">
            <div style="flex:1;">
                <label>Начало:</label>
                <input type="datetime-local" id="admin-date-start" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc;">
            </div>
            <div style="flex:1;">
                <label>Конец:</label>
                <input type="datetime-local" id="admin-date-end" style="width:100%; padding:8px; border-radius:8px; border:1px solid #ccc;">
            </div>
        </div>

        <button class="btn" onclick="window.app.saveAdminQuest()">Создать комнату</button>
        <div id="admin-message" style="color: green; margin-top: 10px; text-align: center;"></div>
    </div>

    <script>window.ADMIN_ID = 5237959867;</script>
    <script type="module" src="/app.js?v=7"></script>
</body>
</html>
"""


async def handle_index(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')


async def serve_static(request):
    filename = request.match_info['filename']
    if os.path.exists(filename): return web.FileResponse(filename)
    return web.Response(status=404, text="Not found")


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton("🚀 Открыть Квесты", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text("Нажми кнопку ниже:", reply_markup=InlineKeyboardMarkup(kb))


async def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))

    web_app = web.Application()
    web_app.router.add_get('/', handle_index)
    web_app.router.add_get('/{filename:.*}', serve_static)

    runner = web.AppRunner(web_app)
    await runner.setup()
    port = int(os.environ.get("PORT", 8000))
    site = web.TCPSite(runner, '0.0.0.0', port)

    await site.start()
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    await asyncio.Event().wait()


if __name__ == '__main__':
    asyncio.run(main())