# Hostel Dos Estaciones — WhatsApp Booking Bot

WhatsApp-бот для отеля **Hostel Dos Estaciones** (Аликанте, Испания). Гость пишет в WhatsApp на любом языке, бот собирает данные через диалог, автоматически бронирует номер на hotelgest.com и присылает ссылку на оплату Monei.

---

## Стек

- **Node.js 18+**
- **whatsapp-web.js** — неофициальный WhatsApp-клиент (QR-скан как WhatsApp Web, без верификации Meta)
- **OpenAI GPT-4o-mini** — собирает данные через tool-calling (не свободный чатбот)
- **Puppeteer** — автоматизация формы бронирования на hotelgest.com
- **Monei** — платёжный шлюз (используется hotelgest)

📚 **Подробнее о выборе стека → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

---

## Быстрый старт (5 минут)

### Требования
- Node.js 18+, npm
- Сервер с интернетом и ~1 ГБ RAM (для headless Chromium)
- WhatsApp-аккаунт на отдельном номере (физический телефон или Android-эмулятор)
- OpenAI API ключ

### Установка

```bash
git clone https://github.com/<your-user>/hostel-bot.git
cd hostel-bot
npm install
cp .env.example .env
# Открой .env и вставь OPENAI_API_KEY
```

### Запуск

```bash
npm start
```

В терминале появится QR-код. Открой WhatsApp на телефоне/эмуляторе с **рабочим** номером бота → **⋮ → Связанные устройства → Привязать устройство** → отсканируй QR.

После сканирования увидишь:
```
✅ Bot online y listo para recibir reservas.
```

Бот готов принимать сообщения.

📚 **Деплой как сервис (PM2/systemd) → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## Структура проекта

```
hostel-bot/
├── index.js              ← точка входа
├── bot.js                ← WhatsApp клиент + OpenAI tool-calling
├── booking.js            ← Puppeteer автоматизация hotelgest.com
├── config.js             ← ВСЕ параметры (модель, таймауты, лимиты, язык)
├── utils/logger.js
├── ecosystem.config.js   ← PM2 конфиг
├── sessions/             ← данные WhatsApp-сессии (gitignored)
├── logs/                 ← логи бота (gitignored)
├── docs/
│   ├── ARCHITECTURE.md   ← почему выбраны такие технологии
│   ├── DEPLOYMENT.md     ← деплой на сервер
│   ├── CONFIGURATION.md  ← все опции config.js
│   ├── TROUBLESHOOTING.md ← известные проблемы и решения
│   └── AGENT_GUIDE.md    ← гид для AI-агента, помогающего поддерживать проект
└── PLAN.md               ← журнал разработки
```

---

## Конфигурация

Всё настраивается в **`config.js`**. Не нужно лезть в логику — поменяй один параметр и всё.

Ключевые параметры:
- `openai.model` — модель OpenAI (default `gpt-4o-mini`)
- `session.maxMessages` — лимит сообщений на сессию (default 20, защита от абуза)
- `session.timeoutMinutes` — таймаут неактивной сессии (default 30)
- `bot.language` — основной язык бота (`es` / `en`)
- `bot.welcomeMessage` — приветствие новой сессии
- `booking.headless` — браузер без GUI (для сервера всегда `true`)

📚 **Полный список → [docs/CONFIGURATION.md](docs/CONFIGURATION.md)**

---

## Безопасность и защита от злоупотреблений

- **LLM работает в режиме tool-calling** — у него ОДИН инструмент `submit_booking`. Он не может говорить о чём-то кроме бронирования.
- **Строгий system prompt** — отказывает на любые off-topic вопросы.
- **Лимиты на сессию** — `maxMessages` и `timeoutMinutes` в config.js.
- **Изоляция гостей** — каждое бронирование запускает отдельный экземпляр Puppeteer; история диалогов изолирована по номеру телефона.

---

## Что-то сломалось?

Смотри **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — там собраны частые проблемы и их решения, включая:
- WhatsApp не подключается / QR постоянно меняется
- Booking timeouts (когда hotelgest.com изменил селекторы)
- Утечки памяти (Chromium-зомби)

---

## Используешь AI-агент для поддержки?

Если ты или твой Claude/ChatGPT/Cursor работает с этим репо — **обязательно дай ему [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md)** в контекст. Там вся история проекта, технические гочи и набитые шишки. Сэкономит часы времени на повторные ошибки.

---

## Лицензия

Private. Для использования владельцем Hostel Dos Estaciones.
