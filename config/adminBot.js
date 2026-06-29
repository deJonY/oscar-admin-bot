const TelegramBot = require('7586941333:AAE_7_NWr1BIDHS89MNso0rKNiB2lUL9TIM');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const admins = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
const bot = new TelegramBot(TOKEN, { polling: true });

module.exports = { bot, admins, TOKEN };
