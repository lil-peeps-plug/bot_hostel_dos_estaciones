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
    // Public admin / front-desk phone. Given to guests for anything outside
    // the FAQ scope. Display-only — formatting with spaces is fine.
    adminPhone: '+34 634 019 118',
    // Prepended to the bot's first reply in a new conversation.
    // Bilingual + formal: tells guest we can assist in any language.
    welcomeMessage:
      '🇪🇸 Estimado/a huésped,\n\n' +
      'Bienvenido/a a Hostel Dos Estaciones (Alicante). Soy su asistente ' +
      'de reservas. Tengo el gusto de informarle que puedo atenderle en ' +
      'cualquier idioma — siéntase libre de escribirme en español, inglés, ' +
      'francés, alemán, italiano, portugués o el idioma que prefiera.\n\n' +
      '🇬🇧 Dear guest,\n\n' +
      "Welcome to Hostel Dos Estaciones (Alicante). I'm your booking " +
      "assistant. I'm pleased to let you know that I can assist you in any " +
      'language — feel free to write to me in English, Spanish, French, ' +
      'German, Italian, Portuguese, or any language of your preference.',
    // Sent when session limit is hit
    limitMessage:
      'Hemos alcanzado el límite de mensajes. Para finalizar tu reserva, ' +
      'contáctanos directamente: hosteldosestaciones@gmail.com',
  },
};
