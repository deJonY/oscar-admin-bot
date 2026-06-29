// command.js
const { bot, db, ADMIN_IDS } = require('../config/adminBot');
const { mainKeyboard, backKeyboard } = require('../keyboards');

// ==================== HOLATLAR ====================
const userState = {};

function resetUserState(chatId) {
    delete userState[chatId];
}

function isAdmin(chatId) {
    return ADMIN_IDS.includes(chatId);
}

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
        bot.sendMessage(chatId, "👤 VIP qo'shish\n\nTelegram ID yoki @username kiriting:", backKeyboard);
        return;
    }

    // ─── VIP O'CHIRISH ─────────────────────────────────────────────
    if (text === "🗑 VIP o'chirish") {
        userState[chatId] = { step: "vip_remove_id", data: {} };
        bot.sendMessage(chatId, "🗑 VIP o'chirish\n\nTelegram ID kiriting:", backKeyboard);
        return;
    }

    // ... qolgan buyruqlar (Mahsulot, Kategoriya, Mijoz, va h.k.) o'zgarmaydi ...
    // (Sizda bor, qisqartirish uchun yozmadim)

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

    // ─── VIP QO'SHISH (STEP 1: ID yoki @username) ─────────────────────
    if (state && state.step === "vip_add_id") {
        const input = text.trim();

        // 1-usul: To'g'ridan-to'g'ri Telegram ID (raqam)
        if (/^\d+$/.test(input)) {
            state.data.telegramId = input;
            state.step = "vip_add_login";
            bot.sendMessage(chatId, "Login kiriting (mas: Vip_1):", backKeyboard);
            return;
        }

        // 2-usul: @username orqali qidirish
        const username = input.replace("@", "").trim();
        if (username) {
            try {
                // Firestore dan qidirish
                const usersSnap = await db.collection("telegram_users")
                    .where("username", "==", username)
                    .get();

                if (!usersSnap.empty) {
                    const userData = usersSnap.docs[0].data();
                    const telegramId = String(userData.chatId || userData.telegram_id);
                    if (telegramId) {
                        state.data.telegramId = telegramId;
                        state.data.username = userData.username || username;
                        state.step = "vip_add_login";
                        bot.sendMessage(
                            chatId,
                            `✅ Foydalanuvchi topildi: @${username} (ID: ${telegramId})\n\nLogin kiriting:`,
                            backKeyboard
                        );
                        return;
                    }
                }

                // Telegram API orqali qidirish
                try {
                    const member = await bot.getChat(username);
                    if (member && member.id) {
                        state.data.telegramId = String(member.id);
                        state.data.username = member.username || username;
                        state.step = "vip_add_login";
                        bot.sendMessage(
                            chatId,
                            `✅ Foydalanuvchi topildi: @${username} (ID: ${member.id})\n\nLogin kiriting:`,
                            backKeyboard
                        );
                        return;
                    }
                } catch (_) { }

                bot.sendMessage(chatId, `❌ @${username} topilmadi. To'g'ri Telegram ID yoki @username kiriting.`);
                return;
            } catch (error) {
                console.error("Username qidirishda xato:", error);
                bot.sendMessage(chatId, "❌ Xatolik yuz berdi.");
                return;
            }
        }

        bot.sendMessage(chatId, "❌ Noto'g'ri format! Telegram ID (raqam) yoki @username kiriting.");
        return;
    }

    // ─── VIP QO'SHISH (STEP 2: Login) ──────────────────────────────────
    if (state && state.step === "vip_add_login") {
        const login = text.trim();
        if (login.length < 2) {
            bot.sendMessage(chatId, "❌ Login kamida 2 belgi bo'lsin!");
            return;
        }
        state.data.login = login;

        try {
            const telegramId = state.data.telegramId;

            let username = state.data.username || "VIP User";
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

    // ─── VIP O'CHIRISH ────────────────────────────────────────────────
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
                bot.sendMessage(chatId, `❌ ID: ${telegramId} - VIP ro'yxatida topilmadi.`, mainKeyboard);
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

    // ─── BOSHQA BUYRUKLAR ─────────────────────────────────────────────
    await handleCommand(chatId, text);
});

console.log("✅ Admin Bot ishga tushdi!");
console.log(`👑 Adminlar: ${ADMIN_IDS.join(", ")}`);