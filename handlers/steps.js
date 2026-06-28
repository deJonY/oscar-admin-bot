const { bot } = require('../config/adminBot');
const { backKeyboard, mainBackKeyboard } = require('../keyboards');
const { userState } = require('../state/userState');

async function handleProductStep(chatId, currentStep, isBack = false) {
    const state = userState[chatId];
    const data = state.data;
    const oldStep = state.step;
    if (!isBack) state.steps.push(oldStep);
    state.step = currentStep;
    switch (currentStep) {
        case 'product_name':
            bot.sendMessage(chatId, "1/9. Mahsulot nomini kiriting:", backKeyboard);
            break;
        case 'product_price':
            bot.sendMessage(chatId, "2/9. Narxni so'mda kiriting (mas: 250000):", backKeyboard);
            break;
        case 'product_price_usd':
            bot.sendMessage(chatId, "3/9. Narxni USDda kiriting (mas: 25.50):", backKeyboard);
            break;
        case 'product_discount':
            bot.sendMessage(chatId, "4/9. Chegirma (0-100, mas: 10 yoki 0):", backKeyboard);
            break;
        case 'product_category': {
            const kb = {
                reply_markup: {
                    keyboard: [...data.categoryNames.map(n => [{ text: n }]), ["Orqaga"]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            };
            bot.sendMessage(chatId, "5/9. Kategoriyani tanlang:", kb);
            break;
        }
        case 'product_image':
            bot.sendMessage(chatId, "6/9. Rasm yuboring (photo formatida):", mainBackKeyboard);
            break;
        case 'product_description':
            bot.sendMessage(chatId, "7/9. Tavsifni kiriting:", backKeyboard);
            break;
        case 'product_stock':
            bot.sendMessage(chatId, "8/9. Korxobada nechta borligi (mas: 50):", backKeyboard);
            break;
        case 'product_warehouse':
            bot.sendMessage(chatId, "9/9. Ombordagi jami soni (mas: 200):", backKeyboard);
            break;
    }
}

async function handleCategoryStep(chatId, currentStep, isBack = false) {
    const state = userState[chatId];
    const oldStep = state.step;
    if (!isBack) state.steps.push(oldStep);
    state.step = currentStep;
    if (currentStep === 'category_name') bot.sendMessage(chatId, "1/2. Kategoriya nomini kiriting:", backKeyboard);
    else if (currentStep === 'category_icon') bot.sendMessage(chatId, "2/2. Ikonka (emoji, mas: 🔧):", backKeyboard);
}

module.exports = { handleProductStep, handleCategoryStep };
