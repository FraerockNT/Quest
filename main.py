import json
import logging
import asyncio
import os
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# --- НАСТРОЙКИ ---
# Вставьте ваш токен от BotFather
BOT_TOKEN = "9270736079:AAGEkAgT06gRHnP4AEXgbexHxW8nJ4e9ySw"

# ВАЖНО: Вставьте сюда ссылку, которую выдал Bothost (она должна быть с https://)
# Например: "https://my-bot.bothost.ru"
WEBAPP_URL = "https://quest123.bothost.tech.bothost.tech/" 

# --- HTML СТРАНИЦА (встроена прямо в код) ---
HTML_PAGE = """
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>My TG Web App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: var(--tg-theme-bg-color, #fff);
      color: var(--tg-theme-text-color, #000);
      padding: 20px;
      min-height: 100vh;
    }
    .card {
      background: var(--tg-theme-secondary-bg-color, #f1f1f1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    h1 { font-size: 20px; margin-bottom: 12px; }
    .user { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .user img { width: 48px; height: 48px; border-radius: 50%; }
    button {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      background: var(--tg-theme-button-color, #2481cc);
      color: var(--tg-theme-button-text-color, #fff);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    #counter { font-size: 32px; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>👋 Привет!</h1>
    <div class="user" id="userInfo"><span>Загрузка...</span></div>
  </div>
  <div class="card">
    <div id="counter">0</div>
    <button onclick="increment()">+1</button>
    <button onclick="sendData()">Отправить данные в бот</button>
  </div>
  <script>
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user) {
      document.getElementById('userInfo').innerHTML = `
        ${user.photo_url ? `<img src="${user.photo_url}">` : ''}
        <div>
          <div style="font-weight:600">${user.first_name} ${user.last_name || ''}</div>
          <div style="font-size:13px;opacity:0.7">@${user.username || ''}</div>
        </div>`;
    } else {
      document.getElementById('userInfo').innerHTML = '<span>Откройте через Telegram</span>';
    }
    let count = 0;
    function increment() {
      count++;
      document.getElementById('counter').textContent = count;
      tg.HapticFeedback.impactOccurred('light');
    }
    function sendData() {
      tg.sendData(JSON.stringify({ count, action: 'test' }));
    }
  </script>
</body>
</html>
"""

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# --- ВЕБ-СЕРВЕР (ОТДАЕТ HTML) ---
async def handle_index(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')

# --- ЛОГИКА БОТА ---
async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton("🚀 Открыть Web App", web_app=WebAppInfo(url=WEBAPP_URL))]]
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
    
    # 2. Настраиваем веб-сервер (aiohttp)
    web_app = web.Application()
    web_app.router.add_get('/', handle_index)
    
    runner = web.AppRunner(web_app)
    await runner.setup()
    
    # Получаем порт из переменных окружения (Bothost обычно передает его сюда)
    port = int(os.environ.get("PORT", 8000))
    site = web.TCPSite(runner, '0.0.0.0', port)
    
    # 3. Запускаем веб-сервер и бота одновременно
    logging.info(f"Запуск веб-сервера на порту {port}...")
    await site.start()
    
    logging.info("Запуск бота...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    
    # Держим процесс запущенным бесконечно
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
