const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard, backKeyboard } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { getStr } = require('../utils/helpers');
const { showCategoryUpdateSelect } = require('../views/category');
const { showProductUpdateCategorySelect } = require('../views/product');

async function handleCommand(chatId, text) {
    resetUserState(chatId);
    if (!db) { bot.sendMessage(chatId, "❌ Database ulanmagan.", mainKeyboard); return; }

    // ─── VIP QO'SHISH ─────────────────────────────────────────────
    if (text === "⭐ VIP qo'shish") {
        userState[chatId] = { step: 'vip_add_id', data: {}, steps: [] };
        bot.sendMessage(chatId, "👤 VIP qo'shish\n\nTelegram ID yoki @username kiriting:", backKeyboard);
        return;
    }

    // ─── VIP O'CHIRISH ─────────────────────────────────────────────
    if (text === "🗑 VIP o'chirish") {
        userState[chatId] = { step: 'vip_remove_id', data: {}, steps: [] };
        bot.sendMessage(chatId, "🗑 VIP o'chirish\n\nTelegram ID yoki @username kiriting:", backKeyboard);
        return;
    }

    if (text === "🛍 Mahsulot qo'shish") {
        const snapshot = await db.collection('categories').get();
        const categoryNames = snapshot.docs.map(d => d.data().name);
        if (categoryNames.length === 0) { bot.sendMessage(chatId, "Avval kategoriya qo'shing.", mainKeyboard); return; }
        userState[chatId] = { step: 'product_name', data: { categoryNames }, steps: [] };
        bot.sendMessage(chatId, "1/8. Mahsulot nomini kiriting:", backKeyboard);
        return;
    }
    if (text === "📂 Kategoriya qo'shish") {
        userState[chatId] = { step: 'category_name', data: {}, steps: [] };
        bot.sendMessage(chatId, "1/2. Kategoriya nomini kiriting:", backKeyboard);
        return;
    }
    if (text === "📂 Kategoriya yangilash") {
        userState[chatId] = { step: 'category_update_select', data: {}, steps: [] };
        await showCategoryUpdateSelect(chatId);
        return;
    }
    if (text === "🔄 Mahsulotni yangilash") {
        userState[chatId] = { step: 'product_update_category_select', data: {}, steps: [] };
        await showProductUpdateCategorySelect(chatId);
        return;
    }
    if (text === "👥 Mijoz qo'shish") {
        userState[chatId] = { step: 'customer_firstName', data: {}, steps: [] };
        bot.sendMessage(chatId, "1/5. Mijozning ismini kiriting:", backKeyboard);
        return;
    }
    if (text === "👥 Mijozlar ro'yxati") {
        try {
            const snapshot = await db.collection('customers').orderBy('createdAt', 'desc').limit(20).get();
            if (snapshot.empty) { bot.sendMessage(chatId, "Hali mijozlar yo'q.", mainKeyboard); return; }
            let msg = `👥 Mijozlar ro'yxati (oxirgi 20):\n\n`;
            snapshot.docs.forEach((doc, idx) => {
                const c = doc.data();
                const tgStatus = c.telegramId ? `✅ TG: ${c.telegramId}` : `⏳ Hali kirmagan`;
                msg += `${idx + 1}. ${c.firstName} ${c.lastName}\n`;
                msg += `   📞 ${c.phone}\n`;
                msg += `   🔑 Login: ${c.login} | Parol: ${c.password}\n`;
                msg += `   ${tgStatus}\n`;
                msg += `   📦 Buyurtmalar: ${c.totalOrders || 0} ta (bonus: ${c.ordersCount || 0}/3)\n\n`;
            });
            bot.sendMessage(chatId, msg, mainKeyboard);
        } catch (error) {
            console.error("Mijozlarni olishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    if (text === "📋 Barcha mahsulotlar") {
        try {
            const snapshot = await db.collection('products').orderBy('id', 'asc').get();
            if (snapshot.empty) { bot.sendMessage(chatId, "Hali mahsulotlar yo'q.", mainKeyboard); return; }
            const products = snapshot.docs.map(d => d.data());
            const kb = { reply_markup: { inline_keyboard: [] } };
            for (let i = 0; i < products.length; i += 2) {
                const p = products[i];
                const label = `${getStr(p.name, '?')} [${getStr(p.category, '?')}]`;
                const row = [{ text: label, callback_data: `update_product_${p.id}` }];
                if (i + 1 < products.length) {
                    const p2 = products[i + 1];
                    row.push({ text: `${getStr(p2.name, '?')} [${getStr(p2.category, '?')}]`, callback_data: `update_product_${p2.id}` });
                }
                kb.reply_markup.inline_keyboard.push(row);
            }
            bot.sendMessage(chatId, `📋 Barcha mahsulotlar (${products.length} ta):`, kb);
        } catch (error) {
            console.error("Mahsulotlarni olishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    if (text === "❌ Bekor qilish") {
        resetUserState(chatId);
        bot.sendMessage(chatId, "Bekor qilindi.", mainKeyboard);
        return;
    }
    if (text === "📊 Statistika") {
        try {
            const p = await db.collection('products').get();
            const c = await db.collection('categories').get();
            const o = await db.collection('orders').get();
            const cust = await db.collection('customers').get();
            const vip = await db.collection('VIP_Clients').get();
            bot.sendMessage(chatId,
                `📊 Statistika:\n` +
                `🔹 Mahsulotlar: ${p.size}\n` +
                `🔹 Kategoriyalar: ${c.size}\n` +
                `🔹 Buyurtmalar: ${o.size}\n` +
                `🔹 Mijozlar: ${cust.size}\n` +
                `🔹 VIP: ${vip.size}`,
                mainKeyboard
            );
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    if (text === "📦 Buyurtmalar") {
        try {
            const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').limit(10).get();
            if (snapshot.empty) { bot.sendMessage(chatId, "Buyurtmalar yo'q.", mainKeyboard); return; }
            const kb = { inline_keyboard: [] };
            snapshot.docs.forEach(doc => {
                const o = doc.data();
                let emoji = o.status === 'confirmed' ? "✅" : o.status === 'cancelled' ? "❌" : "🆕";
                const btn = `${emoji} ${o.customerName || 'Noma\'lum'} — ${(o.totalUZS || 0).toLocaleString("uz-UZ")} so'm`;
                kb.inline_keyboard.push([{ text: btn, callback_data: `order_detail_${doc.id}` }]);
            });
            bot.sendMessage(chatId, "So'nggi 10 ta buyurtma:", { reply_markup: kb });
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }
    bot.sendMessage(chatId, "Tugmalardan tanlang:", mainKeyboard);
}

// ─── VIP STEPLARNI QAYTA ISHLASH ──────────────────────────────────
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

module.exports = { handleCommand, handleVipStep };