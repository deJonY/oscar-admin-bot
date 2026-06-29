// config/adminBot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { db } = require('./firebase');

const TOKEN = process.env.ADMIN_BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(Number) : [];

const bot = new TelegramBot(TOKEN, { polling: true });

module.exports = { bot, db, ADMIN_IDS };