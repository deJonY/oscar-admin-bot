// vip.js
const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { userState, resetUserState } = require('../state/userState');
const { mainKeyboard, backKeyboard } = require('../keyboards');

function registerVipCommands() {
    // /addvip command
    bot.onText(/\/addvip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_add_id', data: {} };
        bot.sendMessage(chatId, '👤 VIP qo\'shish\n\nTelegram ID yoki @username kiriting:', backKeyboard);
    });

    // /removevip command
    bot.onText(/\/removevip/, async (msg) => {
        const chatId = msg.chat.id;
        resetUserState(chatId);
        userState[chatId] = { step: 'vip_remove_id', data: {} };
        bot.sendMessage(chatId, '🗑 VIP o\'chirish\n\nTelegram ID kiriting:', backKeyboard);
    });
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
            data.telegramId = input;
            state.step = 'vip_add_login';
            bot.sendMessage(chatId, 'Login kiriting (mas: Vip_1):', backKeyboard);
            return true;
        }

        // 2-usul: @username orqali qidirish
        const username = input.replace('@', '').trim();
        if (username) {
            try {
                // Firestore dan username bo'yicha qidirish
                const usersSnap = await db.collection('telegram_users')
                    .where('username', '==', username)
                    .get();

                if (!usersSnap.empty) {
                    const userData = usersSnap.docs[0].data();
                    const telegramId = String(userData.chatId || userData.telegram_id);
                    if (telegramId) {
                        data.telegramId = telegramId;
                        data.username = userData.username || username;
                        state.step = 'vip_add_login';
                        bot.sendMessage(
                            chatId,
                            `✅ Foydalanuvchi topildi: @${username} (ID: ${telegramId})\n\nLogin kiriting:`,
                            backKeyboard
                        );
                        return true;
                    }
                }

                // Telegram API orqali qidirish
                try {
                    const member = await bot.getChat(username);
                    if (member && member.id) {
                        data.telegramId = String(member.id);
                        data.username = member.username || username;
                        state.step = 'vip_add_login';
                        bot.sendMessage(
                            chatId,
                            `✅ Foydalanuvchi topildi: @${username} (ID: ${member.id})\n\nLogin kiriting:`,
                            backKeyboard
                        );
                        return true;
                    }
                } catch (_) { }

                bot.sendMessage(chatId, `❌ @${username} topilmadi. To'g'ri Telegram ID yoki @username kiriting.`);
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

            // Foydalanuvchi nomini olish
            let username = data.username || 'VIP User';
            try {
                const member = await bot.getChat(Number(telegramId));
                if (member && (member.first_name || member.username)) {
                    username = member.first_name
                        ? (member.first_name + (member.last_name ? ' ' + member.last_name : ''))
                        : member.username;
                }
            } catch (_) { }

            await db.collection('VIP_Clients').doc(telegramId).set({
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

            // VIP foydalanuvchiga xabar yuborish
            try {
                await bot.sendMessage(
                    Number(telegramId),
                    `🎉 Tabriklaymiz! Sizga VIP status berildi!\n\n` +
                    `🔑 Sizning loginingiz: ${login}\n\n` +
                    `VIP imtiyozlaridan foydalanishingiz mumkin.`
                );
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
                const docRef = db.collection('VIP_Clients').doc(telegramId);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    bot.sendMessage(chatId, `❌ ID: ${telegramId} - bu foydalanuvchi VIP ro'yxatida topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const data = docSnap.data();
                await docRef.delete();

                bot.sendMessage(
                    chatId,
                    `✅ VIP o'chirildi!\n\n` +
                    `👤 Ism: ${data.username || 'Noma\'lum'}\n` +
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
                // Firestore dan username bo'yicha qidirish
                const usersSnap = await db.collection('telegram_users')
                    .where('username', '==', username)
                    .get();

                if (usersSnap.empty) {
                    bot.sendMessage(chatId, `❌ @${username} topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const userData = usersSnap.docs[0].data();
                const telegramId = String(userData.chatId || userData.telegram_id);

                if (!telegramId) {
                    bot.sendMessage(chatId, `❌ @${username} uchun Telegram ID topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const docRef = db.collection('VIP_Clients').doc(telegramId);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    bot.sendMessage(chatId, `❌ @${username} VIP ro'yxatida topilmadi.`, mainKeyboard);
                    resetUserState(chatId);
                    return true;
                }

                const data = docSnap.data();
                await docRef.delete();

                bot.sendMessage(
                    chatId,
                    `✅ VIP o'chirildi!\n\n` +
                    `👤 Ism: ${data.username || username}\n` +
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