// vip.js
const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { userState, resetUserState } = require('../state/userState');
const { mainKeyboard, backKeyboard } = require('../keyboards');
const { getUserBot } = require('../bots/userBot');

function registerVipCommands() {
    // /addvip command
    bot.onText(/\/addvip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_add_id', data: {}, steps: [] };
        bot.sendMessage(chatId, '👤 VIP qo\'shish\n\nTelegram ID yoki @username kiriting:', backKeyboard);
    });

    // /removevip command
    bot.onText(/\/removevip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_remove_id', data: {}, steps: [] };
        bot.sendMessage(chatId, '🗑 VIP o\'chirish\n\nTelegram ID kiriting:', backKeyboard);
    });
}

// Telegram ID/username bo'yicha foydalanuvchi ma'lumotini telegram_users
// collection'idan (user bot orqali to'ldiriladigan) topishga harakat qiladi.
async function findTelegramUser({ telegramId, username }) {
    if (telegramId) {
        const doc = await db.collection('telegram_users').doc(String(telegramId)).get();
        if (doc.exists) return doc.data();
    }
    if (username) {
        const snap = await db.collection('telegram_users').where('username', '==', username).limit(1).get();
        if (!snap.empty) return snap.docs[0].data();
    }
    return null;
}

// To'liq ismni (username field uchun) tuzadi: "Ism Familiya" yoki @username, aks holda fallback.
function buildDisplayName(userData, fallback) {
    if (!userData) return fallback;
    if (userData.firstName) {
        return userData.lastName ? `${userData.firstName} ${userData.lastName}` : userData.firstName;
    }
    if (userData.username) return `@${userData.username}`;
    return fallback;
}

async function handleVipStep(chatId, text) {
    const state = userState[chatId];
    if (!state) return false;

    const step = state.step;
    const data = state.data;

    // ─── ADD VIP (STEP 1: ID yoki @username) ──────────────────────────
    if (step === 'vip_add_id') {
        const input = text.trim();

        // 1-usul: To'g'ridan-to'g'ri Telegram ID (raqam)
        if (/^\d+$/.test(input)) {
            const telegramId = input;
            const userData = await findTelegramUser({ telegramId });
            if (!userData) {
                bot.sendMessage(
                    chatId,
                    `⚠️ Bu foydalanuvchi hali botimiz (Mini App) bilan suhbat boshlamagan, shuning uchun ismini avtomatik topa olmayman.\n\nBaribir davom etish uchun login kiriting, yoki foydalanuvchi botda /start bossin va qaytadan urinib ko'ring.`,
                    backKeyboard
                );
            }
            data.telegramId = telegramId;
            data.username = userData?.username || null;
            data.displayName = buildDisplayName(userData, 'VIP foydalanuvchi');
            state.step = 'vip_add_login';
            bot.sendMessage(chatId, 'Login kiriting (mas: Vip_1):', backKeyboard);
            return true;
        }

        // 2-usul: @username orqali qidirish
        const username = input.replace('@', '').trim();
        if (username) {
            try {
                const userData = await findTelegramUser({ username });

                if (userData) {
                    const telegramId = String(userData.chatId || userData.telegram_id);
                    data.telegramId = telegramId;
                    data.username = userData.username || username;
                    data.displayName = buildDisplayName(userData, `@${username}`);
                    state.step = 'vip_add_login';
                    bot.sendMessage(
                        chatId,
                        `✅ Foydalanuvchi topildi: @${username} (ID: ${telegramId})\n\nLogin kiriting:`,
                        backKeyboard
                    );
                    return true;
                }

                bot.sendMessage(chatId, `❌ @${username} topilmadi. Foydalanuvchi botda (Mini App) /start bosishi kerak, shundan keyin qaytadan urinib ko'ring. Yoki to'g'ridan-to'g'ri Telegram ID kiriting.`);
                return true;
            } catch (error) {
                console.error('Username qidirishda xato:', error);
                bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
                return true;
            }
        }

        bot.sendMessage(chatId, '❌ Noto\'g\'ri format! Telegram ID (raqam) yoki @username kiriting.');
        return true;
    }

    // ─── ADD VIP (STEP 2: Login) ──────────────────────────────────────
    if (step === 'vip_add_login') {
        const login = text.trim();
        if (login.length < 2) {
            bot.sendMessage(chatId, '❌ Login kamida 2 belgi bo\'lsin!');
            return true;
        }
        data.login = login;

        try {
            const telegramId = data.telegramId;
            const username = data.displayName || data.username || 'VIP foydalanuvchi';

            await db.collection('VIP_users').doc(telegramId).set({
                login: login,
                username: username,
                telegram_id: telegramId,
                isVip: true,
                addedAt: new Date().toISOString(),
                addedBy: chatId,
            });

            bot.sendMessage(
                chatId,
                `✅ VIP qo'shildi!\n\n` +
                `👤 Ism: ${username}\n` +
                `🔑 Login: ${login}\n` +
                `🆔 Telegram ID: ${telegramId}`,
                mainKeyboard
            );

            // VIP foydalanuvchiga user bot orqali xabar yuborish
            // (admin bot orqali yuborilmaydi, chunki foydalanuvchi u bilan suhbat boshlamagan).
            try {
                const userBot = getUserBot();
                if (userBot) {
                    await userBot.sendMessage(
                        Number(telegramId),
                        `🎉 Tabriklaymiz! Sizga VIP status berildi!\n\n` +
                        `🔑 Sizning loginingiz: ${login}\n\n` +
                        `VIP imtiyozlaridan foydalanishingiz mumkin.`
                    );
                } else {
                    console.log('User bot ishga tushmagan, VIP xabari yuborilmadi.');
                }
            } catch (err) {
                console.log(`VIP (${telegramId}) ga xabar yuborib bo'lmadi:`, err.message);
                bot.sendMessage(chatId, `⚠️ Eslatma: VIP foydalanuvchiga xabar yuborib bo'lmadi (bot bilan suhbat boshlamagan bo'lishi mumkin).`);
            }
        } catch (error) {
            console.error('VIP qo\'shishda xato:', error);
            bot.sendMessage(chatId, '❌ Xato yuz berdi! Qayta urinib ko\'ring.', mainKeyboard);
        }

        resetUserState(chatId);
        return true;
    }

    // ─── REMOVE VIP ────────────────────────────────────────────────────
    if (step === 'vip_remove_id') {
        const input = text.trim();

        // 1-usul: To'g'ridan-to'g'ri Telegram ID (raqam)
        if (/^\d+$/.test(input)) {
            const telegramId = input;
            try {
                const docRef = db.collection('VIP_users').doc(telegramId);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    bot.sendMessage(chatId, `❌ ID: ${telegramId} - bu foydalanuvchi VIP ro'yxatida topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const docData = docSnap.data();
                await docRef.delete();

                bot.sendMessage(
                    chatId,
                    `✅ VIP o'chirildi!\n\n` +
                    `👤 Ism: ${docData.username || 'Noma\'lum'}\n` +
                    `🆔 Telegram ID: ${telegramId}`,
                    mainKeyboard
                );
                resetUserState(chatId);
                return true;
            } catch (error) {
                console.error('VIP o\'chirishda xato:', error);
                bot.sendMessage(chatId, '❌ Xato yuz berdi! Qayta urinib ko\'ring.', mainKeyboard);
                resetUserState(chatId);
                return true;
            }
        }

        // 2-usul: @username orqali qidirish
        const username = input.replace('@', '').trim();
        if (username) {
            try {
                const userData = await findTelegramUser({ username });

                if (!userData) {
                    bot.sendMessage(chatId, `❌ @${username} topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const telegramId = String(userData.chatId || userData.telegram_id);

                if (!telegramId) {
                    bot.sendMessage(chatId, `❌ @${username} uchun Telegram ID topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const docRef = db.collection('VIP_users').doc(telegramId);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    bot.sendMessage(chatId, `❌ @${username} VIP ro'yxatida topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const docData = docSnap.data();
                await docRef.delete();

                bot.sendMessage(
                    chatId,
                    `✅ VIP o'chirildi!\n\n` +
                    `👤 Ism: ${docData.username || username}\n` +
                    `🆔 Telegram ID: ${telegramId}`,
                    mainKeyboard
                );
                resetUserState(chatId);
                return true;
            } catch (error) {
                console.error('VIP o\'chirishda xato:', error);
                bot.sendMessage(chatId, '❌ Xato yuz berdi! Qayta urinib ko\'ring.', mainKeyboard);
                resetUserState(chatId);
                return true;
            }
        }

        bot.sendMessage(chatId, '❌ Noto\'g\'ri format! Telegram ID (raqam) yoki @username kiriting.');
        return true;
    }

    return false;
}

module.exports = { registerVipCommands, handleVipStep };