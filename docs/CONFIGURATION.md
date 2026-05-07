# Configuration

Все настройки бота — в одном файле `config.js`. Не нужно лезть в логику кода.

---

## Структура config.js

```javascript
module.exports = {
  whatsapp: { sessionDir: './sessions' },
  openai:   { apiKey, model, maxTokens },
  booking:  { url, headless, elementTimeout, paymentTimeout },
  session:  { maxMessages, timeoutMinutes },
  bot:      { language, hotelName, welcomeMessage, limitMessage },
};
```

---

## whatsapp

### `sessionDir` (string, default `'./sessions'`)
Папка где whatsapp-web.js хранит данные авторизации (QR-сессия). 

**Когда менять:** если хочешь хранить сессии в другом месте (например на отдельном диске). После изменения — нужно заново сканировать QR.

---

## openai

### `apiKey` (string, из `process.env.OPENAI_API_KEY`)
Не указывай в config.js напрямую! Только через переменную окружения в `.env`.

### `model` (string, default `'gpt-4o-mini'`)
Модель OpenAI. Варианты:
- `'gpt-4o-mini'` — рекомендуется. Быстрая, дешёвая (~$0.15 / 1M токенов), достаточно для извлечения данных.
- `'gpt-4o'` — мощнее, но в 30 раз дороже. Для этой задачи оверкилл.
- `'gpt-4-turbo'` — старая, не рекомендуется.

### `maxTokens` (number, default `500`)
Максимум токенов в одном ответе бота. 500 — нормально для коротких диалоговых реплик. Если бот режет ответы посередине — увеличь до 800.

---

## booking

### `url` (string, default hotelgest URL)
URL бронировочной формы. Не меняй если только хостел не сменил движок.

### `headless` (boolean, default `true`)
- `true` — браузер без GUI. Используй на сервере.
- `false` — открывает реальное окно браузера. Удобно для **локальной отладки**, чтобы видеть что происходит. На сервере без X11 не сработает.

### `elementTimeout` (number, default `30000`)
Таймаут (мс) на ожидание появления элементов формы (поля, кнопки). Если hotelgest.com тормозит — увеличь до 60000.

### `paymentTimeout` (number, default `30000`)
Таймаут (мс) на получение Monei payment URL после клика "Submit". Если hotelgest или Monei тормозят — увеличь до 60000.

---

## session

### `maxMessages` (number, default `20`)
Максимум сообщений на один диалог с гостем. Защита от:
- Гостей которые "болтают" но не бронируют
- Жалоб на расходы по OpenAI
- Lock-in для гостей (заставляет завершить или связаться напрямую)

После лимита бот пишет `bot.limitMessage` и игнорирует дальнейшие сообщения этой сессии до таймаута.

**Когда увеличивать:** если гости часто упираются в лимит (смотри логи).
**Когда уменьшать:** если бот зацикливается / гости спамят.

### `timeoutMinutes` (number, default `30`)
Если гость не пишет N минут — сессия сбрасывается. На следующее сообщение бот заново здоровается.

**Когда увеличивать:** если гости пропадают надолго но возвращаются продолжить.
**Когда уменьшать:** для агрессивной чистки памяти / коротких диалогов.

---

## bot

### `language` (`'es'` | `'en'`, default `'es'`)
Основной язык бота. Влияет на:
- Системный промпт (язык инструкций для LLM)
- `welcomeMessage` (используется при таймауте сессии)

LLM всё равно отвечает на языке гостя — этот параметр определяет «дефолтный» язык если гость пишет что-то неоднозначное.

### `hotelName` (string)
Название отеля. Используется в промптах и сообщениях.

### `welcomeMessage` (string)
Что бот пишет при первом контакте после таймаута. (При самом первом сообщении гостя бот не приветствует автоматически — LLM формирует приветствие сам в ответ.)

### `limitMessage` (string)
Что бот пишет когда сессия достигла `maxMessages`. Должно содержать контакт хостела для прямой связи.

---

## Переменные окружения (`.env`)

```bash
OPENAI_API_KEY=sk-proj-...
```

Опционально:

```bash
DEBUG=1     # включает debug-логи + сохраняет скриншоты в ./debug-screenshots/ при booking
NODE_ENV=production   # стандартный флаг для Node.js
```

---

## Что НЕЛЬЗЯ менять в config.js без правки кода

- Структура объекта (нельзя добавить новые секции — нужно править `bot.js`/`booking.js`)
- Имена ключей (тоже захардкожены)

---

## Примеры типичных изменений

### Сменить модель на более мощную
```javascript
openai: { model: 'gpt-4o', maxTokens: 800 }
```

### Дать гостям больше времени и сообщений
```javascript
session: { maxMessages: 50, timeoutMinutes: 60 }
```

### Перевести бот на английский по умолчанию
```javascript
bot: {
  language: 'en',
  welcomeMessage: 'Hi! I am the booking assistant for Hostel Dos Estaciones (Alicante). What dates would you like to stay?',
  limitMessage: 'We have reached the message limit. Please contact us directly: hosteldosestaciones@gmail.com',
}
```

### Запустить локально с видимым браузером для отладки
```javascript
booking: { headless: false }
```
