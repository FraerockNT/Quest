import json
import logging
import asyncio
import os
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# --- НАСТРОЙКИ ---
BOT_TOKEN = "9270736079:AAGEkAgT06gRHnP4AEXgbexHxW8nJ4e9ySw"
# ВАЖНО: ваш домен Bothost (без лишних .bothost.tech)
WEBAPP_URL = "https://quest123.bothost.tech/"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# --- ВСТРОЕННЫЙ HTML КАРКАС ---
HTML_PAGE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Квесты</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div id="main-menu" class="screen">
        <div class="menu-title">Выбери квест</div>
        <div class="menu-subtitle" id="user-greeting">Привет!</div>
        <div id="quest-list"></div>
    </div>

    <div id="quest-container" class="screen hidden">
        <div class="screen-header">
            <button class="back-btn" onclick="window.app.goMenu()">← Назад</button>
            <div class="timer" id="quest-timer"></div>
        </div>
        <div id="quest-content" style="flex: 1; display: flex; flex-direction: column;"></div>
    </div>

    <script type="module" src="/app.js"></script>
</body>
</html>
"""


# --- ВЕБ-СЕРВЕР (ОТДАЕТ HTML) ---
async def handle_index(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')


# --- ВЕБ-СЕРВЕР (ОТДАЕТ JS И CSS) ---
async def serve_static(request):
    # Безопасно отдает файлы из корня и папки quests
    filename = request.match_info['filename']
    if os.path.exists(filename):
        return web.FileResponse(filename)
    return web.Response(status=404, text="File not found")


# --- ЛОГИКА БОТА ---
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton("🚀 Открыть Квесты", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text("Нажми кнопку ниже:", reply_markup=InlineKeyboardMarkup(kb))


async def webapp_data(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = json.loads(update.effective_message.web_app_data.data)
    await update.message.reply_text(f"📥 Получено: {data}")


# --- ЗАПУСК ВСЕГО ВМЕСТЕ ---
async def main():
    # 1. Настраиваем бота
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_data))

    # 2. Настраиваем веб-сервер
    web_app = web.Application()

    # Главная страница (генерируется Python)
    web_app.router.add_get('/', handle_index)

    # Отдача статики (js, css, файлы из папки quests)
    web_app.router.add_get('/{filename:.*}', serve_static)

    runner = web.AppRunner(web_app)
    await runner.setup()

    # Bothost обычно передает порт через переменную окружения
    port = int(os.environ.get("PORT", 8000))
    site = web.TCPSite(runner, '0.0.0.0', port)

    # 3. Запускаем веб-сервер и бота одновременно
    logging.info(f"Запуск веб-сервера на порту {port}...")
    await site.start()

    logging.info("Запуск бота...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    # Держим процесс запущенным
    await asyncio.Event().wait()


if __name__ == '__main__':
    asyncio.run(main())