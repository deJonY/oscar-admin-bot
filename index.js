require('dotenv').config();
require('./config/firebase');
require('./config/adminBot');

const { registerOrderListener } = require('./listeners/orders');
const { registerMessageHandler } = require('./handlers/message');
const { registerPhotoHandler } = require('./handlers/photo');
const { registerCallbackHandler } = require('./handlers/callback');
const { registerVipCommands } = require('./handlers/vip');
const { startUserBot } = require('./bots/userBot');
const { startServer } = require('./server');

// Kutilmagan xatolar butun botni o'chirib qo'ymasligi uchun himoya.
// Bular yo'q bo'lganda, masalan bitta sendMessage'dagi noto'g'ri parametr
// yoki tarmoq xatosi butun process'ni yiqitib, bot "jim qolib" qolishi mumkin edi.
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

registerOrderListener();
registerMessageHandler();
registerPhotoHandler();
registerCallbackHandler();
registerVipCommands();
startUserBot();
startServer();

console.log("Bot ishga tushdi va polling boshlandi...");
