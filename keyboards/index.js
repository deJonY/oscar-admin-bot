const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: "🛍 Mahsulot qo'shish" }, { text: "📂 Kategoriya qo'shish" }],
            [{ text: "📂 Kategoriya yangilash" }, { text: "🔄 Mahsulotni yangilash" }],
            [{ text: "📊 Statistika" }, { text: "💱 USD kurs" }],
            [{ text: "📦 Buyurtmalar" }],
            [{ text: "⭐ VIP qo'shish" }, { text: "🗑 VIP o'chirish" }],
        ],
        resize_keyboard: true,
    },
};

const backKeyboard = {
    reply_markup: { keyboard: [["Orqaga"]], resize_keyboard: true },
};

const mainBackKeyboard = {
    reply_markup: {
        keyboard: [
            ...mainKeyboard.reply_markup.keyboard.slice(0, -1),
            [{ text: "❌ Bekor qilish" }, { text: "Orqaga" }],
        ],
        resize_keyboard: true,
    },
};

const commandButtons = [
    "🛍 Mahsulot qo'shish", "📂 Kategoriya qo'shish", "📂 Kategoriya yangilash",
    "🔄 Mahsulotni yangilash",
    "📊 Statistika", "💱 USD kurs",
    "📦 Buyurtmalar", "❌ Bekor qilish",
    "⭐ VIP qo'shish", "🗑 VIP o'chirish",
];

module.exports = { mainKeyboard, backKeyboard, mainBackKeyboard, commandButtons };
