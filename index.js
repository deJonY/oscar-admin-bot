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

registerOrderListener();
registerMessageHandler();
registerPhotoHandler();
registerCallbackHandler();
registerVipCommands();
startUserBot();
startServer();

console.log("Bot ishga tushdi va polling boshlandi...");
