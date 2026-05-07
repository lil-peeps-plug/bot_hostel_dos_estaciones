# Architecture

## Что бот делает

1. Гость пишет в WhatsApp на номер бота
2. GPT-4o-mini ведёт диалог, собирает: даты, имя, фамилию, email, телефон
3. Когда все данные собраны → LLM вызывает функцию `submit_booking`
4. Puppeteer открывает hotelgest.com, проходит весь booking flow программно
5. Перехватывает Monei `paymentId` из сетевых запросов
6. Строит URL `https://secure.monei.com/payments/{id}` и отправляет гостю в WhatsApp
7. Гость переходит по ссылке и оплачивает

```
WhatsApp guest message
       ↓
   bot.js (whatsapp-web.js)
       ↓
   processMessage(phone, text)
       ↓
   OpenAI Chat Completions (gpt-4o-mini, with submit_booking tool)
       ↓
   ┌── text response ──→ reply via WhatsApp
   │
   └── tool_call: submit_booking(check_in, check_out, name, ..., phone)
              ↓
          booking.js bookRoom()
              ↓
          Puppeteer (chromium):
            - open hotelgest.com
            - pick dates on calendar
            - click Search → Room → Add → fill form → Submit
              ↓
          Intercept api.monei.com/v1/payment-methods?paymentId=XXX
              ↓
          Build https://secure.monei.com/payments/XXX
              ↓
          Reply to WhatsApp with payment URL
```

---

## Решения и их обоснование

### Почему whatsapp-web.js, а не Meta Cloud API?

| Параметр | whatsapp-web.js | Meta Cloud API |
|---|---|---|
| Верификация бизнеса | Не нужна | Обязательна (BSP, Facebook Business Manager, документы юр. лица) |
| Стоимость | Бесплатно | Платно (за каждое сообщение через 24h окно) |
| Установка | npm install | Регистрация в Meta, токены, шаблоны |
| Стабильность | Может отвалиться (неофициальный) | Официальная, более стабильная |
| Скорость старта | Часы | Недели |

**Вывод:** для MVP друга-владельца хостела — whatsapp-web.js идеален. Когда бизнес масштабируется и нужна 100% надёжность — переезд на Meta Cloud API.

### Почему GPT-4o-mini, а не Claude / GPT-4?

- **GPT-4o-mini** — у пользователя есть кредиты OpenAI, дёшево (~$0.15 за 1M input токенов), быстро.
- **Claude 4.x** — лучше для сложных задач, но здесь задача простая (извлечь 6 полей через диалог).
- **GPT-4** — ~30x дороже, оверкилл для извлечения структурированных данных.

Tool-calling работает примерно одинаково в OpenAI/Claude — выбор по цене и доступности.

### Почему Puppeteer, а не Playwright / Selenium?

- **Puppeteer** уже идёт как зависимость `whatsapp-web.js` → `npm install` ставит один Chromium для всего.
- **Playwright** — тоже хорош, но требует отдельной установки браузера (`npx playwright install`).
- **Selenium** — overhead Java, медленнее.

Технически Playwright чуть мощнее (multi-browser, лучше API), но для одной задачи Puppeteer проще.

### Почему tool-calling, а не свободный диалог?

LLM в свободном режиме можно "сломать" prompt-injection, jailbreak, сделать его говорить что угодно за хостел. Tool-calling запирает LLM в роль **извлекателя данных**:

- LLM ДОЛЖЕН в итоге вызвать `submit_booking(...)` с обязательными полями.
- Не вызовет — диалог не завершён, ничего не происходит.
- Вызовет с мусорными данными — booking упадёт на validation hotelgest.

Плюс жёсткий system prompt: "Refuse anything not booking-related".

Это **не панацея** — продвинутый jailbreaker может попробовать обойти. Но для типичного абуза + случайных пользователей — достаточно.

### Почему свой Map для сессий, а не Redis / DB?

MVP. Один процесс на одного владельца хостела, ~100-1000 бронирований/месяц. Map в памяти работает.

**Когда переходить на Redis/DB:**
- Нужно несколько инстансов бота (горизонтальный scale)
- Нужно сохранять историю сессий между рестартами
- Multi-tenant (несколько отелей на одном боте)

### Почему перехватываем Monei через Network Request?

`hotelgest.com/v3/ajaxbooking.php` возвращает payment ID, но в **нестандартном** месте JSON-структуры (зависит от типа платежа). Самый надёжный способ:

1. Пустить весь booking-flow до конца
2. Подождать пока Monei JS SDK инициализируется на странице
3. Он дёргает `https://api.monei.com/v1/payment-methods?paymentId=XXX` — там paymentId в URL
4. Перехватить этот URL, извлечь ID
5. Построить hosted-страницу `https://secure.monei.com/payments/XXX`

URL `secure.monei.com/payments/{id}` — это standalone-страница оплаты, ей не нужна сессия hotelgest.com. Гость может оплатить с любого устройства.

---

## Изоляция пользователей

### Что изолировано
- **Сессии диалогов** — `Map<phoneNumber, Session>`, ключ — номер WhatsApp. Кросс-доступ невозможен.
- **Браузеры** — каждое `bookRoom()` запускает **новый** экземпляр Puppeteer. Ноль cross-contamination между гостями.
- **Сбои** — если у одного гостя падает booking, try-catch ловит, остальные сессии не страдают.

### Что НЕ изолировано (потенциальные проблемы)
- Один Node.js процесс на всех. Если процесс падает (OOM, баг) — все теряют контекст диалога. Решение: PM2 auto-restart + восстановление сессий из persistent storage (Redis/файл).
- OpenAI rate limits — общие на API key. Если один гость генерирует много сообщений → влияет на других.
- WhatsApp одна сессия на бот. Если WhatsApp дисконнектит — все теряют контакт.

Для MVP (десятки бронирований/день) — приемлемо. Для большего масштаба — см. секцию "Будущие улучшения".

---

## Структура кода

### `index.js`
Точка входа. Грузит .env, проверяет наличие `OPENAI_API_KEY`, запускает `startBot()`.

### `bot.js`
- WhatsApp клиент (whatsapp-web.js)
- OpenAI клиент
- Sessions Map
- `processMessage(phone, text)` — главный обработчик
- `BOOKING_TOOL` — определение OpenAI tool с обязательными полями
- `SYSTEM_PROMPT` — инструкция для LLM (роль, ограничения)

### `booking.js`
- `bookRoom({ checkIn, checkOut, guest })` — полный booking flow
- Перехват Monei payment URL через `page.on('request')`
- Хелперы: `formatDateAriaLabel`, `typeField`, `setPhoneFields`, `debugShot`

### `config.js`
Все настройки в одном месте. Не нужно лезть в логику.

### `utils/logger.js`
Простой логгер с timestamp.

---

## Будущие улучшения

| Что | Зачем | Сложность |
|---|---|---|
| Redis для сессий | Restart без потери диалогов, multi-instance | Средняя |
| PostgreSQL для логов | История бронирований, аналитика | Средняя |
| Multi-language UX | Авто-детект языка гостя (ar, en, fr, ...) | Малая (промпт) |
| Показ свободных номеров с ценами | Гость видит выбор перед бронированием | Средняя |
| Воркеры (worker_threads) для Puppeteer | True process isolation | Большая |
| Meta Cloud API | Стабильность, верификация для бизнеса | Большая |
| Мониторинг (Sentry, Grafana) | Алерты при ошибках | Средняя |
