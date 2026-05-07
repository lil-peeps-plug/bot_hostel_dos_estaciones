'use strict';

require('dotenv').config();

const config = require('./config');
const logger = require('./utils/logger');
const { startBot } = require('./bot');

if (!config.openai.apiKey) {
  console.error('ERROR: OPENAI_API_KEY is not set. Copy .env.example → .env and fill in your key.');
  process.exit(1);
}

logger.info(`Starting ${config.bot.hotelName} WhatsApp Bot...`);
startBot();
