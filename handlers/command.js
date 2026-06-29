require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { db } = require('../config/firebase');
// const admin = require("firebase-admin");
// ==================== SOZLAMALAR ====================
const TOKEN = process.env.ADMIN_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS

// Firebase sozlash
// let db;
// try {
//     const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
//     if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON topilmadi.");
//     const serviceAccount = JSON.parse(serviceAccountJson);
//     admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
//     db = admin.firestore();
//     console.log("✅ Firebase ulandi.");
// } catch (error) {
//     console.error("❌ Firebase xato:", error.message);
//     process.exit(1);
// }

const bot = new TelegramBot(TOKEN, { polling: true });

// ==================== HOLATLAR ====================
const userState = {};

function resetUserState(chatId) {
    delete userState[chatId];
}

function isAdmin(chatId) {
    return ADMIN_IDS.includes(chatId);
}

// ==================== KEYBOARDS ====================
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ["🛍 Mahsulot qo'shish", "📂 Kategoriya qo'shish"],
            ["📂 Kategoriya yangilash", "🔄 Mahsulotni yangilash"],
            ["⭐ VIP qo'shish", "🗑 VIP o'chirish"],
            ["👥 Mijoz qo'shish", "👥 Mijozlar ro'yxati"],
            ["📋 Barcha mahsulotlar", "📦 Buyurtmalar"],
            ["📊 Statistika", "❌ Bekor qilish"]
        ],
        resize_keyboard: true,
    },
};

const backKeyboard = {
    reply_markup: {
        keyboard: [["❌ Bekor qilish"]],
        resize_keyboard: true,
    },
};

// ==================== /START ====================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, "❌ Siz admin emassiz!");
    }
    resetUserState(chatId);
    bot.sendMessage(chatId, "👋 Xush kelibsiz, Admin!\n\n📋 Boshqaruv paneli:", mainKeyboard);
});

// ==================== YORDAMCHI FUNKSIYALAR ====================
function getStr(obj, fallback = "") {
    if (!obj) return fallback;
    if (typeof obj === "string") return obj;
    if (typeof obj === "object") {
        const langs = ["uz", "ru", "en"];
        for (const lang of langs) {
            if (obj[lang]) return obj[lang];
        }
    }
    return fallback;
}

// ==================== ASOSIY BUYRUKLAR ====================
async function handleCommand(chatId, text) {
    resetUserState(chatId);
    if (!db) {
        bot.sendMessage(chatId, "❌ Database ulanmagan.", mainKeyboard);
        return;
    }

    // ─── VIP QO'SHISH ─────────────────────────────────────────────
    if (text === "⭐ VIP qo'shish") {
        userState[chatId] = { step: "vip_add_id", data: {} };
        bot.sendMessage(chatId, "👤 VIP qo'shish\n\nTelegram ID kiriting:", backKeyboard);
        return;
    }

    // ─── VIP O'CHIRISH ─────────────────────────────────────────────
    if (text === "🗑 VIP o'chirish") {
        userState[chatId] = { step: "vip_remove_id", data: {} };
        bot.sendMessage(chatId, "🗑 VIP o'chirish\n\nTelegram ID kiriting:", backKeyboard);
        return;
    }

    // ─── MAHSULOT QO'SHISH ─────────────────────────────────────────
    if (text === "🛍 Mahsulot qo'shish") {
        const snapshot = await db.collection("categories").get();
        const categoryNames = snapshot.docs.map((d) => d.data().name);
        if (categoryNames.length === 0) {
            bot.sendMessage(chatId, "Avval kategoriya qo'shing.", mainKeyboard);
            return;
        }
        userState[chatId] = { step: "product_name", data: { categoryNames } };
        bot.sendMessage(chatId, "1/8. Mahsulot nomini kiriting:", backKeyboard);
        return;
    }

    // ─── KATEGORIYA QO'SHISH ──────────────────────────────────────
    if (text === "📂 Kategoriya qo'shish") {
        userState[chatId] = { step: "category_name", data: {} };
        bot.sendMessage(chatId, "1/2. Kategoriya nomini kiriting:", backKeyboard);
        return;
    }

    // ─── KATEGORIYA YANGILASH ─────────────────────────────────────
    if (text === "📂 Kategoriya yangilash") {
        try {
            const snapshot = await db.collection("categories").get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "Hali kategoriyalar yo'q.", mainKeyboard);
                return;
            }
            const kb = { inline_keyboard: [] };
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                kb.inline_keyboard.push([
                    { text: getStr(data.name, "Kategoriya"), callback_data: `cat_update_${doc.id}` },
                ]);
            });
            bot.sendMessage(chatId, "Yangilamoqchi bo'lgan kategoriyani tanlang:", { reply_markup: kb });
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }

    // ─── MAHSULOTNI YANGILASH ─────────────────────────────────────
    if (text === "🔄 Mahsulotni yangilash") {
        try {
            const snapshot = await db.collection("products").get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "Hali mahsulotlar yo'q.", mainKeyboard);
                return;
            }
            const kb = { inline_keyboard: [] };
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                kb.inline_keyboard.push([
                    { text: `${getStr(data.name, "Mahsulot")} [${getStr(data.category, "?")}]`, callback_data: `prod_update_${doc.id}` },
                ]);
            });
            bot.sendMessage(chatId, "Yangilamoqchi bo'lgan mahsulotni tanlang:", { reply_markup: kb });
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }

    // ─── MIJOZ QO'SHISH ──────────────────────────────────────────
    if (text === "👥 Mijoz qo'shish") {
        userState[chatId] = { step: "customer_firstName", data: {} };
        bot.sendMessage(chatId, "1/5. Mijozning ismini kiriting:", backKeyboard);
        return;
    }

    // ─── MIJOZLAR RO'YXATI ──────────────────────────────────────
    if (text === "👥 Mijozlar ro'yxati") {
        try {
            const snapshot = await db.collection("customers").orderBy("createdAt", "desc").limit(20).get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "Hali mijozlar yo'q.", mainKeyboard);
                return;
            }
            let msg = "👥 Mijozlar ro'yxati (oxirgi 20):\n\n";
            snapshot.docs.forEach((doc, idx) => {
                const c = doc.data();
                const tgStatus = c.telegramId ? `✅ TG: ${c.telegramId}` : "⏳ Hali kirmagan";
                msg += `${idx + 1}. ${c.firstName} ${c.lastName || ""}\n`;
                msg += `   📞 ${c.phone || "Noma'lum"}\n`;
                msg += `   🔑 Login: ${c.login || "Yo'q"} | Parol: ${c.password || "Yo'q"}\n`;
                msg += `   ${tgStatus}\n\n`;
            });
            bot.sendMessage(chatId, msg, mainKeyboard);
        } catch (error) {
            console.error("Mijozlarni olishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }

    // ─── BARCHA MAHSULOTLAR ──────────────────────────────────────
    if (text === "📋 Barcha mahsulotlar") {
        try {
            const snapshot = await db.collection("products").orderBy("id", "asc").get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "Hali mahsulotlar yo'q.", mainKeyboard);
                return;
            }
            let msg = "📋 Barcha mahsulotlar:\n\n";
            snapshot.docs.forEach((doc, idx) => {
                const p = doc.data();
                msg += `${idx + 1}. ${getStr(p.name, "Noma'lum")} (${getStr(p.category, "?")})\n`;
                msg += `   Narx: ${p.price || "?"} so'm\n`;
                msg += `   ID: ${p.id || "?"}\n\n`;
            });
            bot.sendMessage(chatId, msg, mainKeyboard);
        } catch (error) {
            console.error("Mahsulotlarni olishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }

    // ─── BUYURTMALAR ─────────────────────────────────────────────
    if (text === "📦 Buyurtmalar") {
        try {
            const snapshot = await db.collection("orders").orderBy("createdAt", "desc").limit(10).get();
            if (snapshot.empty) {
                bot.sendMessage(chatId, "Buyurtmalar yo'q.", mainKeyboard);
                return;
            }
            let msg = "📦 So'nggi 10 ta buyurtma:\n\n";
            snapshot.docs.forEach((doc, idx) => {
                const o = doc.data();
                const emoji = o.status === "confirmed" ? "✅" : o.status === "cancelled" ? "❌" : "🆕";
                msg += `${idx + 1}. ${emoji} ${o.customerName || "Noma'lum"} — `;
                msg += `${(o.totalUZS || 0).toLocaleString("uz-UZ")} so'm\n`;
                msg += `   Holat: ${o.status || "yangi"}\n\n`;
            });
            bot.sendMessage(chatId, msg, mainKeyboard);
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        return;
    }

    // ─── STATISTIKA ──────────────────────────────────────────────
    if (text === "📊 Statistika") {
        try {
            const p = await db.collection("products").get();
            const c = await db.collection("categories").get();
            const o = await db.collection("orders").get();
            const cust = await db.collection("customers").get();
            const vip = await db.collection("VIP_Clients").get();
            bot.sendMessage(
                chatId,
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

    // ─── BEKOR QILISH ─────────────────────────────────────────────
    if (text === "❌ Bekor qilish") {
        resetUserState(chatId);
        bot.sendMessage(chatId, "Bekor qilindi.", mainKeyboard);
        return;
    }

    bot.sendMessage(chatId, "Tugmalardan tanlang:", mainKeyboard);
}

// ==================== MATNLI XABARLARNI QAYTA ISHLASH ====================
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;
    if (text.startsWith("/")) return;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, "❌ Siz admin emassiz!");
        return;
    }

    const state = userState[chatId];

    // ─── VIP QO'SHISH (STEP-BY-STEP) ─────────────────────────────
    if (state && state.step === "vip_add_id") {
        const telegramId = text.trim();
        if (!/^\d+$/.test(telegramId)) {
            bot.sendMessage(chatId, "❌ Telegram ID faqat raqamlardan iborat bo'lishi kerak!");
            return;
        }
        state.data.telegramId = telegramId;
        state.step = "vip_add_login";
        bot.sendMessage(chatId, "Login kiriting (mas: Vip_1):", backKeyboard);
        return;
    }

    if (state && state.step === "vip_add_login") {
        const login = text.trim();
        if (login.length < 2) {
            bot.sendMessage(chatId, "❌ Login kamida 2 belgi bo'lsin!");
            return;
        }
        state.data.login = login;

        try {
            const telegramId = state.data.telegramId;

            // Foydalanuvchi nomini olish
            let username = "VIP User";
            try {
                const member = await bot.getChat(Number(telegramId));
                if (member && (member.first_name || member.username)) {
                    username = member.first_name || member.username;
                }
            } catch (_) { }

            await db.collection("VIP_Clients").doc(telegramId).set({
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

            // VIP ga xabar yuborish
            try {
                await bot.sendMessage(
                    Number(telegramId),
                    `🎉 Tabriklaymiz! Sizga VIP status berildi!\n\n` +
                    `🔑 Sizning loginingiz: ${login}\n\n` +
                    `VIP imtiyozlaridan foydalanishingiz mumkin.`
                );
            } catch (err) {
                bot.sendMessage(
                    chatId,
                    `⚠️ VIP qo'shildi, lekin foydalanuvchi bot bilan suhbatni boshlamagan.\n` +
                    `Uni botga yuboring: @oscar_shop_bot`
                );
            }
        } catch (error) {
            console.error("VIP qo'shishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato yuz berdi!", mainKeyboard);
        }

        resetUserState(chatId);
        return;
    }

    // ─── VIP O'CHIRISH (STEP-BY-STEP) ────────────────────────────
    if (state && state.step === "vip_remove_id") {
        const telegramId = text.trim();
        if (!/^\d+$/.test(telegramId)) {
            bot.sendMessage(chatId, "❌ Telegram ID faqat raqamlardan iborat bo'lishi kerak!");
            return;
        }

        try {
            const docRef = db.collection("VIP_Clients").doc(telegramId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                bot.sendMessage(chatId, `❌ ID: ${telegramId} - bu foydalanuvchi VIP ro'yxatida topilmadi.`, mainKeyboard);
                resetUserState(chatId);
                return;
            }

            await docRef.delete();
            bot.sendMessage(chatId, `✅ VIP o'chirildi!\n\n🆔 Telegram ID: ${telegramId}`, mainKeyboard);
        } catch (error) {
            console.error("VIP o'chirishda xato:", error);
            bot.sendMessage(chatId, "❌ Xato yuz berdi!", mainKeyboard);
        }

        resetUserState(chatId);
        return;
    }

    // ─── ASOSIY BUYRUKLAR ─────────────────────────────────────────
    await handleCommand(chatId, text);
});

// ==================== INLINE CALLBACK ====================
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!isAdmin(chatId)) {
        bot.answerCallbackQuery(query.id, { text: "❌ Siz admin emassiz!" });
        return;
    }

    // Kategoriya yangilash
    if (data.startsWith("cat_update_")) {
        const docId = data.replace("cat_update_", "");
        userState[chatId] = { step: "category_update_name", data: { docId } };
        bot.sendMessage(chatId, "Yangi kategoriya nomini kiriting:", backKeyboard);
        bot.answerCallbackQuery(query.id);
        return;
    }

    // Mahsulot yangilash
    if (data.startsWith("prod_update_")) {
        const docId = data.replace("prod_update_", "");
        userState[chatId] = { step: "product_update_name", data: { docId } };
        bot.sendMessage(chatId, "Yangi mahsulot nomini kiriting:", backKeyboard);
        bot.answerCallbackQuery(query.id);
        return;
    }

    bot.answerCallbackQuery(query.id);
});

// ==================== KATEGORIYA YANGILASH (STEP) ====================
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;
    if (!isAdmin(chatId)) return;

    const state = userState[chatId];
    if (!state) return;

    // Kategoriya yangilash
    if (state.step === "category_update_name") {
        const newName = text.trim();
        if (newName.length < 2) {
            bot.sendMessage(chatId, "❌ Kategoriya nomi kamida 2 belgi bo'lsin!");
            return;
        }
        try {
            await db.collection("categories").doc(state.data.docId).update({
                name: newName,
                updatedAt: new Date().toISOString(),
            });
            bot.sendMessage(chatId, `✅ Kategoriya yangilandi: ${newName}`, mainKeyboard);
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        resetUserState(chatId);
        return;
    }

    // Mahsulot yangilash (nomi)
    if (state.step === "product_update_name") {
        const newName = text.trim();
        if (newName.length < 2) {
            bot.sendMessage(chatId, "❌ Mahsulot nomi kamida 2 belgi bo'lsin!");
            return;
        }
        state.data.name = newName;
        state.step = "product_update_price";
        bot.sendMessage(chatId, "Yangi narxni kiriting (so'mda):", backKeyboard);
        return;
    }

    if (state.step === "product_update_price") {
        const price = Number(text.trim());
        if (isNaN(price) || price < 0) {
            bot.sendMessage(chatId, "❌ To'g'ri narx kiriting!");
            return;
        }
        try {
            await db.collection("products").doc(state.data.docId).update({
                name: state.data.name,
                price: price,
                updatedAt: new Date().toISOString(),
            });
            bot.sendMessage(chatId, `✅ Mahsulot yangilandi!\n\nNomi: ${state.data.name}\nNarx: ${price} so'm`, mainKeyboard);
        } catch (error) {
            bot.sendMessage(chatId, "❌ Xato!", mainKeyboard);
        }
        resetUserState(chatId);
        return;
    }
});

console.log("✅ Admin Bot ishga tushdi!");
console.log(`👑 Adminlar: ${ADMIN_IDS.join(", ")}`);