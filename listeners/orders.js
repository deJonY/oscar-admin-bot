const { bot, admins } = require('../config/orderBot');
const { db, admin } = require('../config/firebase');
const { getPaymentMethodText } = require('../paymentMethods');
const { BONUS_DISCOUNT_PERCENT } = require('../config/constants');

function registerOrderListener() {
    if (!db || !bot) return;
    const botStartTime = admin.firestore.Timestamp.now();
    console.log("🔔 Order listener faol...");

    db.collection('orders')
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const orderData = change.doc.data();
                    const orderId = change.doc.id;
                    let isNew = false;
                    if (orderData.createdAt) {
                        const orderTime = orderData.createdAt.toMillis ? orderData.createdAt.toMillis() : new Date(orderData.createdAt).getTime();
                        if (orderTime > botStartTime.toMillis()) isNew = true;
                    } else {
                        isNew = true;
                    }
                    if (isNew) notifyAdminsNewOrder(orderId, orderData);
                }
            });
        }, error => console.error("❌ Order listener xatosi:", error));
}

function nameToStr(name) {
    if (typeof name === 'string') return name;
    if (name && typeof name === 'object') return name.uz || name.ru || name.en || Object.values(name)[0] || "Noma'lum mahsulot";
    return "Noma'lum mahsulot";
}

// Telefonni topish: 1) orderdagi customerPhone 2) telegram_users fallback
async function resolveCustomerPhone(orderData) {
    if (orderData.customerPhone) return orderData.customerPhone;
    if (!orderData.telegramChatId || !db) return null;
    try {
        const userDoc = await db.collection('telegram_users').doc(String(orderData.telegramChatId)).get();
        if (userDoc.exists && userDoc.data().phone) return userDoc.data().phone;
    } catch (e) { console.error('Telefon fallback xato:', e.message); }
    return null;
}

// Mijoz bloki: VIP -> faqat login + telefon; oddiy -> kiritgan ismi + telefon
async function buildCustomerBlock(orderData) {
    const phone = await resolveCustomerPhone(orderData);
    if (orderData.isVip) {
        let vipLogin = orderData.username || '';
        if (orderData.telegramChatId && db) {
            try {
                const vipDoc = await db.collection('VIP_Clients').doc(String(orderData.telegramChatId)).get();
                if (vipDoc.exists && vipDoc.data().login) vipLogin = vipDoc.data().login;
            } catch (e) { console.error('VIP lookup xato:', e.message); }
        }
        return `⭐ VIP: ${vipLogin || "Noma'lum"}\n📞 Telefon: ${phone || "Noma'lum"}\n\n`;
    }
    return `👤 Mijoz: ${orderData.customerName || orderData.username || "Noma'lum"}\n📞 Telefon: ${phone || "Noma'lum"}\n\n`;
}

async function notifyAdminsNewOrder(orderId, orderData) {
    let itemsText = '';
    if (orderData.items && orderData.items.length > 0) {
        itemsText = orderData.items.map(item => {
            const totalPrice = (item.price * item.quantity).toLocaleString("uz-UZ");
            const isBox = item.unit === 'box';
            const unitLabel = isBox ? 'karobka' : 'dona';
            const boxDetail = isBox && item.itemsPerBox
                ? ` (har birida ${item.itemsPerBox} dona, jami ${item.quantity * item.itemsPerBox} dona)`
                : '';
            return `- ${item.quantity} ${unitLabel} x ${nameToStr(item.name)}${boxDetail} — ${totalPrice} UZS`;
        }).join('\n');
    } else {
        itemsText = "Mahsulotlar yo'q";
    }

    const paymentMethodText = getPaymentMethodText(orderData.paymentMethod);

    let bonusBlock = '';
    if (orderData.orderType === 'discount') {
        bonusBlock = `🎁 Buyurtma turi: 2-buyurtma — ${BONUS_DISCOUNT_PERCENT}% chegirma\n\n`;
    } else if (orderData.orderType === 'bonus') {
        const bonusName = orderData.bonusItem?.name || "Bonus mahsulot";
        bonusBlock = `🎁 Buyurtma turi: 3-buyurtma — 1+1 BONUS\n🎁 Bonus mahsulot: ${bonusName}\n\n`;
    } else {
        bonusBlock = `🎁 Buyurtma turi: 1-buyurtma — to'liq narx\n\n`;
    }

    let deliveryBlock = '';
    if (orderData.deliveryMethod === 'pickup') {
        const address = orderData.pickupAddress || orderData.deliveryAddress || 'Belgilanmagan';
        deliveryBlock = `📦 Yetkazib berish: O'zim olib ketaman\n🏪 Manzil: ${address}\n\n`;
    } else if (orderData.deliveryMethod === 'delivery') {
        const distance = orderData.distanceKm ? `${orderData.distanceKm.toFixed(1)} km` : "Noma'lum";
        const deliveryFeeUZS = orderData.deliveryFee || 0;
        const deliveryFeeText = deliveryFeeUZS === 0 ? "Bepul" : `${deliveryFeeUZS.toLocaleString("uz-UZ")} UZS`;
        const address = orderData.deliveryAddress || orderData.pickupAddress || 'Kiritilmagan';
        deliveryBlock = `📦 Yetkazib berish: Yetkazib berish\n📏 Masofa: ~${distance}\n🚚 Narx: ${deliveryFeeText}\n📍 Manzil: ${address}\n\n`;
    } else {
        const address = orderData.deliveryAddress || orderData.pickupAddress || 'Kiritilmagan';
        deliveryBlock = `📍 Manzil: ${address}\n\n`;
    }

    const customerBlock = await buildCustomerBlock(orderData);

    const message =
        `🛒 YANGI BUYURTMA!\n\n` +
        customerBlock +
        bonusBlock + deliveryBlock +
        `🛍 Mahsulotlar:\n${itemsText}\n\n` +
        `💰 Jami: ${(orderData.totalUZS || 0).toLocaleString("uz-UZ")} UZS\n` +
        `💳 To'lov: ${paymentMethodText}`;

    const inlineKeyboard = {
        inline_keyboard: [[
            { text: "✅ Tasdiqlash", callback_data: `confirm_order_${orderId}` },
            { text: "❌ Bekor qilish", callback_data: `cancel_order_${orderId}` },
        ]],
    };

    admins.forEach(adminId => {
        bot.sendMessage(adminId, message, { reply_markup: inlineKeyboard }).catch(err => {
            console.error(`Admin ${adminId} ga xabar yuborishda xato:`, err.message);
        });
    });
}

module.exports = { registerOrderListener };