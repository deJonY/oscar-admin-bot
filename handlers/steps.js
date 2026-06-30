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
            bot.sendMessage(chatId, "1. Mahsulot nomini kiriting:", backKeyboard);
            break;
        case 'product_price':
            bot.sendMessage(chatId, "2. Narxni so'mda kiriting (mas: 250000):", backKeyboard);
            break;
        case 'product_discount':
            bot.sendMessage(chatId, "3. Chegirma (0-100, mas: 10 yoki 0):", backKeyboard);
            break;
        case 'product_category': {
            const kb = {
                reply_markup: {
                    keyboard: [...data.categoryNames.map(c => [{ text: c.label }]), ["Orqaga"]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            };
            bot.sendMessage(chatId, "4. Kategoriyani tanlang:", kb);
            break;
        }
        case 'product_image':
            bot.sendMessage(chatId, "5. Rasm yuboring (photo formatida):", mainBackKeyboard);
            break;
        case 'product_description':
            bot.sendMessage(chatId, "6. Tavsifni kiriting:", backKeyboard);
            break;
        case 'product_stock':
            bot.sendMessage(chatId, "7. Ombordagi miqdor (mas: 50):", backKeyboard);
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
