'use strict';

module.exports = {

  // ── WhatsApp ──────────────────────────────────────────────
  whatsapp: {
    // Folder where whatsapp-web.js stores auth session
    sessionDir: './sessions',
  },

  // ── OpenAI ────────────────────────────────────────────────
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 500,
  },

  // ── Booking engine ────────────────────────────────────────
  booking: {
    url: 'https://booking.hotelgest.com/v4/?pcode=1742',
    // Run browser headlessly (true = no visible window, for servers)
    headless: true,
    // Milliseconds to wait for page elements
    elementTimeout: 30_000,
    // Milliseconds to wait for payment URL response
    paymentTimeout: 30_000,
  },

  // ── Session limits (anti-abuse) ───────────────────────────
  session: {
    // Max messages per conversation before forcing human contact
    maxMessages: 20,
    // Minutes of inactivity before session expires and resets
    timeoutMinutes: 30,
  },

  // ── Bot behaviour ─────────────────────────────────────────
  bot: {
    // 'es' = Spanish, 'en' = English (primary language for the bot)
    language: 'es',
    hotelName: 'Hostel Dos Estaciones',
    // Sent when a new conversation starts
    welcomeMessage:
      '¡Hola! Soy el asistente de reservas de Hostel Dos Estaciones (Alicante). ' +
      '¿Para qué fechas te gustaría alojarte?',
    // Sent when session limit is hit
    limitMessage:
      'Hemos alcanzado el límite de mensajes. Para finalizar tu reserva, ' +
      'contáctanos directamente: hosteldosestaciones@gmail.com',
  },
};
