const { bot, admins } = require('../config/adminBot');
const { db, admin } = require('../config/firebase');
const { mainKeyboard, backKeyboard, mainBackKeyboard, commandButtons } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { parseNumberInput, parseDateDDMMYYYY, getNextId, getStr } = require('../utils/helpers');
const { handleBack } = require('./back');
const { handleCommand } = require('./command');
const { handleVipStep } = require('./vip');
const { showProductView } = require('../views/product');
const { showCategoryView } = require('../views/category');

function registerMessageHandler() {
    bot.on('message', async (msg) => {
        try {
            await handleIncomingMessage(msg);
        } catch (error) {
            console.error("❌ message handlerida kutilmagan xato:", error);
            try {
                await bot.sendMessage(msg.chat.id, "❌ Kutilmagan xato yuz berdi. Iltimos, qaytadan urinib ko'ring yoki /start bosing.", mainKeyboard);
            } catch (_) { }
        }
    });
}

async function handleIncomingMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;

    if (!admins.includes(chatId)) {
        bot.sendMessage(chatId, `Bu bot faqat administratorlar uchun.\nSizning ID: ${chatId}`);
        return;
    }
    if (!db) { bot.sendMessage(chatId, "❌ Database ulanmagan."); return; }
    if (text && text.startsWith('/')) {
        if (text === '/start') {
            resetUserState(chatId);
            bot.sendMessage(chatId, "Xush kelibsiz! Shop-bot admin paneli.", mainKeyboard);
        } else if (text === '/addvip' || text === '/removevip') {
            return;
        } else bot.sendMessage(chatId, "Noma'lum buyruq. /start ni bosing.", mainKeyboard);
        return;
    }
    if (text === "Orqaga") { await handleBack(chatId); return; }
    if (text && commandButtons.includes(text)) { await handleCommand(chatId, text); return; }
    if (photo && !text) { bot.emit('photo', msg); return; }
    if (!userState[chatId] || userState[chatId].step === 'none') {
        bot.sendMessage(chatId, "Tugmalardan tanlang:", mainKeyboard);
        return;
    }

    const state = userState[chatId];
    const step = state.step;
    let data = state.data;

    // ─── USD KURS O'RNATISH ──────────────────────────────────────────
    if (step === 'set_usd_rate') {
        const rate = parseNumberInput(text);
        if (!rate || rate <= 0 || rate > 99999999) {
            bot.sendMessage(chatId, "❌ Noto'g'ri qiymat! Musbat son kiriting (mas: 12600):");
            return;
        }
        try {
            await db.collection('settings').doc('usd_rate').set({ rate: Math.round(rate), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            resetUserState(chatId);
            bot.sendMessage(chatId, `✅ USD kurs yangilandi!\n\n💱 1 USD = ${Math.round(rate).toLocaleString('uz-UZ')} so'm`, mainKeyboard);
        } catch (error) {
            console.error("USD kurs saqlashda xato:", error);
            bot.sendMessage(chatId, "❌ Saqlashda xato!", mainKeyboard);
            resetUserState(chatId);
        }
        return;
    }

    // ─── MAHSULOT QO'SHISH (3 tilda) ────────────────────────────────
    if (step.startsWith('product_')) {
        const oldStep = step;
        switch (step) {

            // 1. Nom UZ
            case 'product_name_uz':
                if (!text || text.trim().length < 2) { bot.sendMessage(chatId, "Kamida 2 belgi kiriting!"); return; }
                data.name_uz = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_name_ru';
                bot.sendMessage(chatId, "1b. Mahsulot nomini RU tilida kiriting:", backKeyboard);
                break;

            // 1b. Nom RU
            case 'product_name_ru':
                if (!text || text.trim().length < 2) { bot.sendMessage(chatId, "Kamida 2 belgi kiriting!"); return; }
                data.name_ru = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_name_en';
                bot.sendMessage(chatId, "1c. Mahsulot nomini EN tilida kiriting:", backKeyboard);
                break;

            // 1c. Nom EN
            case 'product_name_en':
                if (!text || text.trim().length < 2) { bot.sendMessage(chatId, "Kamida 2 belgi kiriting!"); return; }
                data.name_en = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_price_piece';
                bot.sendMessage(chatId, "2. Dona narxini USD da kiriting (mas: 6.53):", backKeyboard);
                break;

            // 2. Narx (pricePiece, USD)
            case 'product_price_piece': {
                const price = parseNumberInput(text, true);
                if (price === null || price <= 0) { bot.sendMessage(chatId, "Musbat son kiriting! (mas: 6.53)"); return; }
                data.pricePiece = price;
                state.steps.push(oldStep);
                state.step = 'product_price_box';
                bot.sendMessage(chatId, "2b. Karobka narxini USD da kiriting, agar yo'q bo'lsa 0 (mas: 24.99):", backKeyboard);
                break;
            }

            // 2b. Narx (priceBox, USD)
            case 'product_price_box': {
                const price = parseNumberInput(text, true);
                if (price === null || price < 0) { bot.sendMessage(chatId, "0 yoki musbat son kiriting!"); return; }
                data.priceBox = price;
                state.steps.push(oldStep);
                state.step = 'product_items_per_box';
                bot.sendMessage(chatId, "2c. Bir karobkada nechta dona bor? (yo'q bo'lsa 0):", backKeyboard);
                break;
            }

            // 2c. itemsPerBox
            case 'product_items_per_box': {
                if (!/^\d+$/.test(text) || parseInt(text) < 0) { bot.sendMessage(chatId, "0 yoki musbat butun son!"); return; }
                data.itemsPerBox = parseInt(text);
                state.steps.push(oldStep);
                state.step = 'product_discount';
                bot.sendMessage(chatId, "3. Chegirma foizi (0-100, chegirma yo'q bo'lsa 0):", backKeyboard);
                break;
            }

            // 3. Chegirma
            case 'product_discount': {
                if (!/^\d+$/.test(text) || parseInt(text) < 0 || parseInt(text) > 100) {
                    bot.sendMessage(chatId, "0 dan 100 gacha son kiriting!");
                    return;
                }
                data.discount = parseInt(text);
                state.steps.push(oldStep);
                state.step = 'product_category';
                const ckb = {
                    reply_markup: {
                        keyboard: data.categoryNames.map(c => [{ text: c.label }]).concat([["Orqaga"]]),
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                };
                bot.sendMessage(chatId, "4. Kategoriyani tanlang:", ckb);
                break;
            }

            // 4. Kategoriya
            case 'product_category': {
                const matched = data.categoryNames.find(c => c.label === text);
                if (!matched) { bot.sendMessage(chatId, "Tugmalardan tanlang!"); return; }
                data.category = matched.full;
                state.steps.push(oldStep);
                state.step = 'product_image';
                bot.sendMessage(chatId, "5. Rasm yuboring (photo formatida):", mainBackKeyboard);
                break;
            }

            case 'product_image':
                return;

            // 6. Tavsif UZ
            case 'product_description_uz':
                data.desc_uz = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_description_ru';
                bot.sendMessage(chatId, "6b. Tavsifni RU tilida kiriting:", backKeyboard);
                break;

            // 6b. Tavsif RU
            case 'product_description_ru':
                data.desc_ru = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_description_en';
                bot.sendMessage(chatId, "6c. Tavsifni EN tilida kiriting:", backKeyboard);
                break;

            // 6c. Tavsif EN → so'ng stock
            case 'product_description_en':
                data.desc_en = text.trim();
                state.steps.push(oldStep);
                state.step = 'product_stock';
                bot.sendMessage(chatId, "7. Ombordagi miqdor (mas: 50):", backKeyboard);
                break;

            // 7. Stock → saqlash
            case 'product_stock': {
                if (!/^\d+$/.test(text) || parseInt(text) < 0) { bot.sendMessage(chatId, "0 yoki musbat son!"); return; }
                data.stock = parseInt(text);
                const newId = await getNextId('products');
                if (newId === -1) { bot.sendMessage(chatId, "❌ ID xato!", mainKeyboard); resetUserState(chatId); return; }
                const newProduct = {
                    id: newId,
                    name: { uz: data.name_uz || '', ru: data.name_ru || '', en: data.name_en || '' },
                    pricePiece: data.pricePiece || 0,
                    priceBox: data.priceBox || 0,
                    itemsPerBox: data.itemsPerBox || 0,
                    discount: data.discount || 0,
                    category: data.category || '',
                    image: data.image || '',
                    description: { uz: data.desc_uz || '', ru: data.desc_ru || '', en: data.desc_en || '' },
                    stock: data.stock,
                };
                try {
                    await db.collection('products').doc(String(newId)).set(newProduct);
                    bot.sendMessage(chatId,
                        `✅ Mahsulot qo'shildi!\n\n` +
                        `📦 UZ: ${newProduct.name.uz}\n` +
                        `📦 RU: ${newProduct.name.ru}\n` +
                        `📦 EN: ${newProduct.name.en}\n` +
                        `💰 Dona: $${newProduct.pricePiece} | Karobka: $${newProduct.priceBox}\n` +
                        `🏷 Chegirma: ${newProduct.discount}%\n` +
                        `📂 Kategoriya: ${getStr(newProduct.category)}\n` +
                        `📊 Stock: ${newProduct.stock} ta`,
                        mainKeyboard
                    );
                } catch (error) {
                    console.error("Mahsulot saqlashda xato:", error);
                    bot.sendMessage(chatId, `❌ Mahsulot qo'shilmadi!\nSabab: ${error.message || 'noma\'lum xato'}`, mainKeyboard);
                }
                resetUserState(chatId);
                break;
            }
        }
        state.data = data;
        return;
    }

    // ─── KATEGORIYA QO'SHISH ─────────────────────────────────────────
    if (step.startsWith('category_')) {
        const oldStep = step;
        if (step === 'category_name') {
            data.name = text;
            state.steps.push(oldStep);
            state.step = 'category_icon';
            bot.sendMessage(chatId, "2/2. Ikonka (emoji, mas: 🔧):", backKeyboard);
        } else if (step === 'category_icon') {
            data.icon = text;
            const newId = await getNextId('categories');
            if (newId === -1) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); return; }
            try {
                await db.collection('categories').doc(String(newId)).set({ id: newId, name: data.name, icon: data.icon });
                bot.sendMessage(chatId, `✅ Kategoriya qo'shildi!\n${data.icon} ${data.name}`, mainKeyboard);
            } catch (error) {
                bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
            }
            resetUserState(chatId);
        }
        state.data = data;
        return;
    }

    // ─── KATEGORIYA YANGILASH ────────────────────────────────────────
    if (state.step === 'update_category_name') {
        try {
            const catDoc = await db.collection('categories').doc(String(state.data.categoryId)).get();
            const oldName = catDoc.exists ? catDoc.data().name : null;
            await db.collection('categories').doc(String(state.data.categoryId)).update({ name: text });
            if (oldName && oldName !== text) {
                const productsSnap = await db.collection('products').where('category', '==', oldName).get();
                if (!productsSnap.empty) {
                    const batch = db.batch();
                    productsSnap.docs.forEach(doc => batch.update(doc.ref, { category: text }));
                    await batch.commit();
                }
            }
            state.step = 'category_update_view';
            await showCategoryView(chatId, state.data.categoryId, state.data.messageId);
            bot.sendMessage(chatId, `✅ Nom yangilandi: ${text}`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }
    if (state.step === 'update_category_icon') {
        try {
            await db.collection('categories').doc(String(state.data.categoryId)).update({ icon: text });
            state.step = 'category_update_view';
            await showCategoryView(chatId, state.data.categoryId, state.data.messageId);
            bot.sendMessage(chatId, `✅ Ikonka yangilandi: ${text}`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }

    // ─── CHEGIRMA SANASI ─────────────────────────────────────────────
    if (state.step === 'update_discount_date') {
        const stateData = state.data;
        if (text === "0") {
            try {
                await db.collection('products').doc(String(stateData.productId)).update({ [stateData.dateField]: admin.firestore.FieldValue.delete() });
                state.step = 'product_update_view';
                await showProductView(chatId, stateData.productId, stateData.messageId);
                bot.sendMessage(chatId, `✅ ${stateData.dateLabel} o'chirildi.`, backKeyboard);
            } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
            return;
        }
        const dateObj = parseDateDDMMYYYY(text);
        if (!dateObj) { bot.sendMessage(chatId, "❌ Format: DD.MM.YYYY (mas: 13.05.2026)\nO'chirish uchun: 0"); return; }
        try {
            const timestamp = admin.firestore.Timestamp.fromDate(dateObj);
            await db.collection('products').doc(String(stateData.productId)).update({ [stateData.dateField]: timestamp });
            state.step = 'product_update_view';
            await showProductView(chatId, stateData.productId, stateData.messageId);
            bot.sendMessage(chatId, `✅ ${stateData.dateLabel} yangilandi: ${text}`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }

    // ─── MAHSULOT YANGILASH ──────────────────────────────────────────
    if (state.step === 'update_value') {
        const stateData = state.data;
        const fieldType = stateData.field;
        let value;
        if (fieldType === 'pricePiece' || fieldType === 'priceBox' || fieldType === 'price') {
            const parsed = parseNumberInput(text, true);
            if (parsed === null || parsed < 0) { bot.sendMessage(chatId, "0 yoki musbat son kiriting! (mas: 6.53)"); return; }
            value = parsed;
        } else if (fieldType === 'discount') {
            if (!/^\d+$/.test(text) || parseInt(text) < 0 || parseInt(text) > 100) { bot.sendMessage(chatId, "0-100 oralig'ida!"); return; }
            value = parseInt(text);
        } else if (fieldType === 'stock' || fieldType === 'itemsPerBox') {
            if (!/^\d+$/.test(text) || parseInt(text) < 0) { bot.sendMessage(chatId, "0 yoki musbat son!"); return; }
            value = parseInt(text);
        } else { bot.sendMessage(chatId, "Xato!"); resetUserState(chatId); return; }
        try {
            const actualField = fieldType === 'price' ? 'pricePiece' : fieldType;
            await db.collection('products').doc(String(stateData.productId)).update({ [actualField]: value });
            state.step = 'product_update_view';
            await showProductView(chatId, stateData.productId, stateData.messageId);
            bot.sendMessage(chatId, `✅ Yangilandi: ${value}`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }
    if (state.step === 'update_product_description_uz') {
        state.data.desc_uz = text;
        state.step = 'update_product_description_ru';
        bot.sendMessage(chatId, "2/3. Yangi tavsifni RUSCHA kiriting:", backKeyboard);
        return;
    }
    if (state.step === 'update_product_description_ru') {
        state.data.desc_ru = text;
        state.step = 'update_product_description_en';
        bot.sendMessage(chatId, "3/3. Yangi tavsifni INGLIZCHA kiriting:", backKeyboard);
        return;
    }
    if (state.step === 'update_product_description_en') {
        try {
            const newDescription = { uz: state.data.desc_uz, ru: state.data.desc_ru, en: text };
            await db.collection('products').doc(String(state.data.productId)).update({ description: newDescription });
            state.step = 'product_update_view';
            await showProductView(chatId, state.data.productId, state.data.messageId);
            bot.sendMessage(chatId, `✅ Tavsif (uz/ru/en) yangilandi`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }
    if (state.step === 'update_product_name_uz') {
        state.data.name_uz = text;
        state.step = 'update_product_name_ru';
        bot.sendMessage(chatId, "2/3. Yangi nomni RUSCHA kiriting:", backKeyboard);
        return;
    }
    if (state.step === 'update_product_name_ru') {
        state.data.name_ru = text;
        state.step = 'update_product_name_en';
        bot.sendMessage(chatId, "3/3. Yangi nomni INGLIZCHA kiriting:", backKeyboard);
        return;
    }
    if (state.step === 'update_product_name_en') {
        try {
            const newName = { uz: state.data.name_uz, ru: state.data.name_ru, en: text };
            await db.collection('products').doc(String(state.data.productId)).update({ name: newName });
            state.step = 'product_update_view';
            await showProductView(chatId, state.data.productId, state.data.messageId);
            bot.sendMessage(chatId, `✅ Nom (uz/ru/en) yangilandi`, backKeyboard);
        } catch (error) { bot.sendMessage(chatId, "❌ Xato!", mainKeyboard); resetUserState(chatId); }
        return;
    }

    // ─── MIJOZ QO'SHISH ──────────────────────────────────────────────
    if (step.startsWith('customer_')) {
        const oldStep = step;
        switch (step) {
            case 'customer_firstName':
                if (!text || text.length < 2) { bot.sendMessage(chatId, "Ism kamida 2 belgi bo'lsin!"); return; }
                data.firstName = text.trim();
                state.steps.push(oldStep);
                state.step = 'customer_lastName';
                bot.sendMessage(chatId, "2/5. Familiyasini kiriting:", backKeyboard);
                break;
            case 'customer_lastName':
                if (!text || text.length < 2) { bot.sendMessage(chatId, "Familiya kamida 2 belgi bo'lsin!"); return; }
                data.lastName = text.trim();
                state.steps.push(oldStep);
                state.step = 'customer_phone';
                bot.sendMessage(chatId, "3/5. Telefon raqamini kiriting (mas: +998901234567):", backKeyboard);
                break;
            case 'customer_phone': {
                const phoneRegex = /^\+?\d{9,15}$/;
                if (!phoneRegex.test(text.replace(/\s/g, ''))) { bot.sendMessage(chatId, "❌ Telefon noto'g'ri! Format: +998901234567"); return; }
                data.phone = text.replace(/\s/g, '');
                state.steps.push(oldStep);
                state.step = 'customer_login';
                bot.sendMessage(chatId, "4/5. Login yarating (mas: jonibek_123):", backKeyboard);
                break;
            }
            case 'customer_login': {
                const loginRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!loginRegex.test(text)) { bot.sendMessage(chatId, "❌ Login noto'g'ri! Faqat lotin harflar, raqamlar, _."); return; }
                const login = text.toLowerCase().trim();
                const existing = await db.collection('customers').doc(login).get();
                if (existing.exists) { bot.sendMessage(chatId, "❌ Bunday login allaqachon mavjud!"); return; }
                data.login = login;
                state.steps.push(oldStep);
                state.step = 'customer_password';
                bot.sendMessage(chatId, "5/5. Parol yarating (kamida 4 belgi):", backKeyboard);
                break;
            }
            case 'customer_password': {
                if (!text || text.length < 4) { bot.sendMessage(chatId, "❌ Parol kamida 4 belgi bo'lsin!"); return; }
                data.password = text;
                const newCustomer = {
                    login: data.login, password: data.password,
                    firstName: data.firstName, lastName: data.lastName,
                    phone: data.phone, telegramId: null,
                    ordersCount: 0, totalOrders: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                try {
                    await db.collection('customers').doc(data.login).set(newCustomer);
                    bot.sendMessage(chatId,
                        `✅ Mijoz qo'shildi!\n\n👤 ${data.firstName} ${data.lastName}\n📞 ${data.phone}\n\n` +
                        `🔑 LOGIN MA'LUMOTLARI:\nLogin: ${data.login}\nParol: ${data.password}`,
                        mainKeyboard
                    );
                } catch (error) {
                    bot.sendMessage(chatId, "❌ Mijozni saqlashda xato!", mainKeyboard);
                }
                resetUserState(chatId);
                break;
            }
        }
        state.data = data;
        return;
    }

    // ─── VIP ─────────────────────────────────────────────────────────
    if (step && step.startsWith('vip_')) {
        await handleVipStep(chatId, text);
        return;
    }

    bot.sendMessage(chatId, "Tushunmadim. Tugmalardan tanlang:", mainKeyboard);
}

module.exports = { registerMessageHandler };
