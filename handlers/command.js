const { bot } = require('../config/adminBot');
const { db } = require('../config/firebase');
const { mainKeyboard, backKeyboard } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { getStr } = require('../utils/helpers');
const { showCategoryUpdateSelect } = require('../views/category');
const { showProductUpdateCategorySelect } = require('../views/product');
const { handleVipStep } = require('./vip');

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
        const categoryNames = snapshot.docs
            .map(d => getStr(d.data().name))
            .filter(n => n && n.trim().length > 0);
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
            const vip = await db.collection('VIP_users').get();
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
module.exports = { handleCommand, handleVipStep };
