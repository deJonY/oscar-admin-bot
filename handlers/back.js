const { bot } = require('../config/adminBot');
const { mainKeyboard } = require('../keyboards');
const { userState, resetUserState } = require('../state/userState');
const { showProductView, showProductsInCategory, showProductUpdateCategorySelect } = require('../views/product');
const { showCategoryView, showCategoryUpdateSelect } = require('../views/category');

async function handleBack(chatId) {
    try {
        resetUserState(chatId);
        bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
    } catch (error) {
        console.error('handleBack xato:', error);
        try { bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard); } catch (_) {}
    }
}

async function handleInlineBack(chatId, messageId) {
    try {
        const state = userState[chatId];
        if (!state || state.steps.length === 0) {
            resetUserState(chatId);
            bot.editMessageText("Bekor qilindi.", { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
            return;
        }
        const prevStep = state.steps.pop();
        state.step = prevStep;
        if (prevStep === 'category_update_select') await showCategoryUpdateSelect(chatId, messageId);
        else if (prevStep === 'product_update_category_select') await showProductUpdateCategorySelect(chatId, messageId);
        else if (prevStep === 'product_update_product_select') {
            if (state.data.selectedCategory) await showProductsInCategory(chatId, state.data.selectedCategory, messageId);
            else await showProductUpdateCategorySelect(chatId, messageId);
        } else if (prevStep === 'category_update_view') await showCategoryView(chatId, state.data.categoryId, messageId);
        else if (prevStep === 'product_update_view') await showProductView(chatId, state.data.productId, messageId);
        else {
            resetUserState(chatId);
            bot.editMessageText("Bekor qilindi.", { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
        }
    } catch (error) {
        console.error('handleInlineBack xato:', error);
        try {
            bot.editMessageText("❌ Xato.", { chat_id: chatId, message_id: messageId });
            bot.sendMessage(chatId, "Bosh menyu.", mainKeyboard);
        } catch (_) {}
    }
}

module.exports = { handleBack, handleInlineBack };
