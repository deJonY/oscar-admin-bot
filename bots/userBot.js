const TelegramBot = require('7586941333:AAE_7_NWr1BIDHS89MNso0rKNiB2lUL9TIM');
const { db } = require('../config/firebase');
const TelegramBot = require('node-telegram-bot-api');

const USER_BOT_TOKEN = process.env.USER_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://oscar1-wheat.vercel.app/';

let userBotInstance = null;

function getUserBot() {
    return userBotInstance;
}

// Foydalanuvchi user bot bilan suhbat boshlaganda Firestore'ga yozib qo'yamiz,
// shu orqali admin bot keyinchalik Telegram ID/username bo'yicha topa oladi.
async function saveTelegramUser(from) {
    if (!db || !from) return;
    try {
        const chatId = String(from.id);
        await db.collection('telegram_users').doc(chatId).set({
            chatId,
            telegram_id: chatId,
            username: from.username || null,
            firstName: from.first_name || null,
            lastName: from.last_name || null,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (error) {
        console.error("telegram_users ga yozishda xato:", error.message);
    }
}

function startUserBot() {
    if (!USER_BOT_TOKEN) {
        console.warn("⚠️ USER_BOT_TOKEN topilmadi — user bot ishlamaydi.");
        return;
    }

    const userBot = new TelegramBot(USER_BOT_TOKEN, { polling: true });
    userBotInstance = userBot;
    console.log("✅ User bot ishga tushdi...");

    userBot.on('polling_error', (error) => {
        console.error("User bot polling xatosi:", error.message);
    });

    userBot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name || 'mijoz';

        await saveTelegramUser(msg.from);

        const welcomeMessage =
            `Salom, ${firstName}! 👋\n\n` +
            `🚗 *Nanokill* botiga xush kelibsiz!\n\n` +
            `Sifatli avtomobil ehtiyot qismlari va tezkor yetkazib berish.\n\n` +
            `Do'kondan foydalanish uchun pastdagi tugmani bosing 👇`;
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🛍 Ilovani ochish", web_app: { url: MINI_APP_URL } }]],
        };
        userBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown', reply_markup: inlineKeyboard })
            .catch(err => console.error("User botga xabar yuborishda xato:", err.message));
    });

    // Foydalanuvchi har qanday xabar yuborganda ham ma'lumotlarini yangilab boramiz
    // (username keyinroq qo'yilgan/o'zgargan bo'lishi mumkin).
    userBot.on('message', async (msg) => {
        if (msg.text && msg.text.startsWith('/start')) return; // yuqorida allaqachon saqlandi
        await saveTelegramUser(msg.from);
    });
}

module.exports = { startUserBot, getUserBot };
