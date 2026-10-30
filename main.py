import json
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

BOT_TOKEN = "9270736079:AAGEkAgT06gRHnP4AEXgbexHxW8nJ4e9ySw"
WEBAPP_URL = "https:// mybot.bothost.tech/"  # ваш URL с bothost

logging.basicConfig(level=logging.INFO)

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton("🚀 Открыть Web App", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text(
        "Привет! Нажми кнопку ниже:",
        reply_markup=InlineKeyboardMarkup(kb)
    )

async def webapp_data(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    data = json.loads(update.effective_message.web_app_data.data)
    await update.message.reply_text(f"📥 Получено: {data}")

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_data))
    app.run_polling()

if __name__ == "__main__":
    main()