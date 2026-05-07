# Troubleshooting

Известные проблемы, симптомы и решения.

---

## WhatsApp

### QR код не появляется в логах

**Причина:** PM2 буферизует stdout, QR не выводится сразу.

**Решение:**
```bash
pm2 logs hostel-bot --raw  # без буферизации
```

Или сначала запусти `node index.js` напрямую (без PM2), отсканируй QR один раз — сессия сохранится в `./sessions/`. Потом запускай через PM2 — QR больше не нужен.

### QR постоянно меняется / истекает

**Причина:** ты слишком долго не сканируешь.

**Решение:** перезапусти бот — будет новый QR. У тебя ~20 секунд на скан.

### Бот авторизован, но ничего не отвечает

Возможные причины:
1. **WhatsApp заблокировал номер** — слишком много сообщений за короткое время → используй другой номер или включи лимиты в `config.js`.
2. **Сообщения приходят в группу** — бот их игнорирует (`if (msg.isGroupMsg) return;`).
3. **Сессия залипла** — `pm2 restart hostel-bot`.

### `Authentication failed: Method not implemented`

**Причина:** WhatsApp обновился, текущая версия `whatsapp-web.js` не совместима.

**Решение:**
```bash
npm install whatsapp-web.js@latest
pm2 restart hostel-bot
```

Если не помогло — смотри issues на https://github.com/pedroslopez/whatsapp-web.js/issues

---

## OpenAI

### `RateLimitError: 429`

**Причина:** превышен лимит запросов.

**Решение:**
- Если на free tier — апгрейдни OpenAI план.
- Если на paid — слишком много активных гостей одновременно. Уменьши `session.maxMessages` или закэшируй частые ответы.

### `Invalid API key`

**Причина:** в `.env` неверный или истёкший ключ.

**Решение:** перегенерируй ключ на platform.openai.com → API keys, обнови `.env`, `pm2 restart hostel-bot`.

### Бот зависает на 30+ секунд при первом сообщении

**Причина:** OpenAI медленно отвечает (бывает в часы пиковой нагрузки).

**Решение:** нормально, подожди. Если регулярно — попробуй `gpt-4o-mini` (если ещё не он).

---

## Booking автоматизация

### `Waiting for selector .modalRate failed: Waiting failed: 30000ms exceeded`

**Причина:** hotelgest.com изменил структуру страницы или сильно тормозит.

**Решение:**
1. Запусти локально с `booking: { headless: false }` — посмотри глазами что происходит.
2. Если селектор изменился — обнови в `booking.js`. Список селекторов — в начале файла в JSDoc.
3. Если просто тормозит — увеличь `booking.elementTimeout` до 60000.

### `Payment URL not received within 30s`

**Причина:** форма submit'нулась, но Monei не инициализировался / возник ошибка валидации.

**Решение:**
1. Включи `DEBUG=1` в .env, перезапусти. В `./debug-screenshots/` будут скриншоты каждого шага.
2. Открой `failure-*.png` — посмотри что показывает страница в момент сбоя.
3. Часто причина: некорректный телефон/email прошёл нашу логику.

### Бот говорит "Lo siento, hubo un problema" каждый раз

Значит каждое бронирование падает. Проверь:
1. Логи (`pm2 logs hostel-bot`) — там будет конкретная ошибка из `bookRoom failed: ...`.
2. Если ошибка касается селекторов — hotelgest обновили сайт, нужно перепройти visual debug (см. [docs/AGENT_GUIDE.md](AGENT_GUIDE.md)).

### `bookRoom failed: Timeout: payment URL not received within 30s` — стабильно

**Симптом:** форма заполняется, submit нажимается, но Monei URL не приходит.

**Возможные причины:**
- Hotelgest изменил endpoint (`api.monei.com/v1/payment-methods`) → проверь network в `headless: false`
- Форма отвергается без visible error (например phone format) → проверь debug-скриншот после submit

---

## Память и производительность

### Чрезмерное использование памяти / Chromium-зомби

**Симптомы:** `pm2 status` показывает 1+ ГБ, после многих бронирований растёт.

**Причина:** Puppeteer-инстансы не закрываются при ошибках.

**Решение:**
1. Проверь что `await browser.close()` стоит в `finally` блоке `bookRoom` (по умолчанию там).
2. Включи в PM2 авто-перезапуск по памяти:
```javascript
// ecosystem.config.js
max_memory_restart: '1G'
```
3. Прибей зомби-Chromium:
```bash
pkill -f chromium
```

### CPU 100% постоянно

**Возможная причина:** infinite loop в логах (бот пытается отвечать сам себе).

Не должно случиться (мы фильтруем `msg.from === 'status@broadcast'`), но если бот связан со своим же номером — возможно. Проверь не сканировал ли ты QR с **бот-телефона** (надо со стороннего).

---

## Сессии и данные

### Бот забыл диалог посередине

**Причина:** `session.timeoutMinutes` истёк, или процесс перезапустился.

**Решение:**
- Увеличь `timeoutMinutes`.
- Для сохранения сессий между рестартами — нужен Redis/файловое хранилище (см. ARCHITECTURE.md → Будущие улучшения).

### После рестарта PM2 — бот просит QR заново

**Причина:** папка `./sessions/` либо удалилась, либо PM2 запускается из другой директории.

**Решение:**
```bash
pm2 start ecosystem.config.js  # правильный cwd
# или
cd /home/botuser/hostel-bot && pm2 restart hostel-bot
```

---

## Деплой / систему

### `Failed to launch the browser process`

**Причина:** на Linux-сервере не хватает зависимостей для Chromium.

**Решение:**
```bash
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2
```

Полный список — в [DEPLOYMENT.md](DEPLOYMENT.md).

### Puppeteer ошибка `No usable sandbox!`

**Причина:** Chromium не может создать sandbox (часто в Docker / unprivileged юзер).

**Решение:** в нашем коде уже есть `--no-sandbox` в `args` — должно работать. Если всё равно падает — попробуй `--disable-dev-shm-usage` (тоже включён).

---

## Когда не знаешь что делать

1. Включи DEBUG: `DEBUG=1 node index.js`
2. Смотри `./debug-screenshots/` (если в режиме DEBUG)
3. Запусти локально с `booking: { headless: false }` чтобы видеть глазами
4. Покажи логи + скриншоты AI-агенту с [AGENT_GUIDE.md](AGENT_GUIDE.md) в контексте
