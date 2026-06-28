const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { userState, resetUserState } = require('../state/userState');
const { mainKeyboard, backKeyboard } = require('../keyboards');

function registerVipCommands() {
    // /addvip command
    bot.onText(/\/addvip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_add_id', data: {}, steps: [] };
        bot.sendMessage(chatId, '👤 VIP qo\'shish\n\nTelegram ID kiriting:', backKeyboard);
    });

    // /removevip command
    bot.onText(/\/removevip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_remove_id', data: {}, steps: [] };
        bot.sendMessage(chatId, '🗑 VIP o\'chirish\n\nTelegram ID kiriting:', backKeyboard);
    });
}

async function handleVipStep(chatId, text) {
    const state = userState[chatId];
    if (!state) return false;

    const step = state.step;
    const data = state.data;

    // ─── ADD VIP ───────────────────────────────────────────────
    if (step === 'vip_add_id') {
        const telegramId = text.trim();
        if (!/^\d+$/.test(telegramId)) {
            bot.sendMessage(chatId, '❌ Telegram ID faqat raqamlardan iborat bo\'lishi kerak!');
            return true;
        }
        data.telegramId = telegramId;
        state.step = 'vip_add_login';
        bot.sendMessage(chatId, 'Login kiriting (mas: Vip_1):', backKeyboard);
        return true;
    }

    if (step === 'vip_add_login') {
        const login = text.trim();
        if (login.length < 2) {
            bot.sendMessage(chatId, '❌ Login kamida 2 belgi bo\'lsin!');
            return true;
        }
        data.login = login;

        try {
            // Foydalanuvchi username ni Telegram API orqali olish
            let username = 'VIP User';
            try {
                const member = await bot.getChat(data.telegramId);
                if (member && (member.first_name || member.username)) {
                    username = member.first_name
                        ? (member.first_name + (member.last_name ? ' ' + member.last_name : ''))
                        : member.username;
                }
            } catch (_) {
                // Foydalanuvchi topilmasa default ishlatar
            }

            const vipDoc = {
                login: data.login,
                username: username,
                telegram_id: data.telegramId,
                isVip: true,
                addedAt: new Date().toISOString(),
                addedBy: chatId,
            };

            await db.collection('VIP_Clients').doc(data.telegramId).set(vipDoc);

            // Adminga xabar
            bot.sendMessage(
                chatId,
                `✅ VIP qo'shildi!\n\n` +
                `👤 Ism: ${username}\n` +
                `🔑 Login: ${data.login}\n` +
                `🆔 Telegram ID: ${data.telegramId}`,
                mainKeyboard
            );

            // VIP foydalanuvchiga xabar yuborish
            try {
                await bot.sendMessage(
                    data.telegramId,
                    `🎉 Tabriklaymiz! Sizga VIP status berildi!\n\n` +
                    `🔑 Sizning loginingiz: ${data.login}\n\n` +
                    `VIP imtiyozlaridan foydalanishingiz mumkin.`
                );
            } catch (err) {
                console.log(`VIP (${data.telegramId}) ga xabar yuborib bo'lmadi:`, err.message);
                bot.sendMessage(chatId, `⚠️ Eslatma: VIP foydalanuvchiga xabar yuborib bo'lmadi (bot bilan suhbat boshlamagan bo'lishi mumkin).`);
            }
        } catch (error) {
            console.error('VIP qo\'shishda xato:', error);
            bot.sendMessage(chatId, '❌ Xato yuz berdi! Qayta urinib ko\'ring.', mainKeyboard);
        }

        resetUserState(chatId);
        return true;
    }

    // ─── REMOVE VIP ────────────────────────────────────────────
    if (step === 'vip_remove_id') {
        const telegramId = text.trim();
        if (!/^\d+$/.test(telegramId)) {
            bot.sendMessage(chatId, '❌ Telegram ID faqat raqamlardan iborat bo\'lishi kerak!');
            return true;
        }

        try {
            const docRef = db.collection('VIP_Clients').doc(telegramId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                bot.sendMessage(chatId, `❌ ID: ${telegramId} - bu foydalanuvchi VIP ro'yxatida topilmadi.`, mainKeyboard);
                resetUserState(chatId);
                return true;
            }

            await docRef.delete();

            bot.sendMessage(
                chatId,
                `✅ VIP o'chirildi!\n\n🆔 Telegram ID: ${telegramId}`,
                mainKeyboard
            );
        } catch (error) {
            console.error('VIP o\'chirishda xato:', error);
            bot.sendMessage(chatId, '❌ Xato yuz berdi! Qayta urinib ko\'ring.', mainKeyboard);
        }

        resetUserState(chatId);
        return true;
    }

    return false;
}

module.exports = { registerVipCommands, handleVipStep };
