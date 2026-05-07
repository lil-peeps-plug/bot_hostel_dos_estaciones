# Deployment

Чтобы бот работал постоянно (а не только пока ты держишь терминал открытым), нужен **process manager**. Рекомендуем **PM2** — самый простой вариант для Node.js.

---

## Требования к серверу

- **Linux** (Ubuntu 22.04+ / Debian 12 / Alpine)
- **1 ГБ RAM** минимум (Chromium ~300-500 МБ + Node ~100 МБ + WhatsApp client)
- **2 ГБ диск** (Node modules + Chromium + sessions + логи)
- **Постоянный интернет** (бот должен быть всегда онлайн для WhatsApp)
- **Node.js 18+**, **npm**

VPS вариантов: Hetzner CX11 (€5/мес), DigitalOcean Basic ($6), Contabo (€4).

---

## Пошаговый деплой через PM2

### 1. На сервере

```bash
# Установить Node.js 22 (если ещё нет)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Установить PM2 глобально
sudo npm install -g pm2

# Установить зависимости для Chromium (Puppeteer)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2

# Клонировать репо
git clone https://github.com/<your-user>/hostel-bot.git
cd hostel-bot

# Установить зависимости (puppeteer скачает Chromium автоматически)
npm install

# Создать .env
cp .env.example .env
nano .env  # вставить OPENAI_API_KEY
```

### 2. Запустить через PM2

```bash
pm2 start ecosystem.config.js
```

При первом запуске бот покажет QR-код. Чтобы его увидеть:

```bash
pm2 logs hostel-bot
```

Отсканируй QR на телефоне/эмуляторе с WhatsApp-аккаунтом бота. После этого WhatsApp-сессия сохранится в `./sessions/` и при перезапусках бота QR не нужен.

### 3. Сохранить состояние и автозапуск

```bash
# Сохранить список запущенных процессов
pm2 save

# Сгенерировать systemd unit для автозапуска
pm2 startup
# Скопируй и выполни команду которую выведет PM2

# Проверить статус
pm2 status
```

Теперь после перезагрузки сервера бот стартует автоматически.

---

## Полезные команды PM2

```bash
pm2 status                  # статус всех процессов
pm2 logs hostel-bot         # логи в реальном времени
pm2 logs hostel-bot --lines 200  # последние 200 строк
pm2 restart hostel-bot      # перезапустить
pm2 reload hostel-bot       # zero-downtime reload
pm2 stop hostel-bot         # остановить
pm2 delete hostel-bot       # удалить из PM2
pm2 monit                   # интерактивный монитор
```

---

## Обновление бота

```bash
cd hostel-bot
git pull
npm install   # если изменились зависимости
pm2 restart hostel-bot
```

---

## Логи

PM2 пишет логи в `./logs/`:
- `out.log` — stdout (info-сообщения)
- `err.log` — stderr (ошибки)

Для ротации (чтобы логи не росли бесконечно):

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

Будет хранить последние 7 файлов по 10 МБ.

---

## Мониторинг

### Базовый — через PM2

`pm2 monit` показывает CPU/RAM/логи в реальном времени.

### Алерты

PM2 Plus (платный, $0/мес стартовый план) — алерты в Slack/email при креше.

Альтернатива: cron + heartbeat:

```bash
# crontab -e
*/5 * * * * curl -fsS https://your-server/health || echo "Bot down" | mail -s "Alert" you@email.com
```

(нужно добавить health endpoint в бота — см. TODO в [docs/AGENT_GUIDE.md](AGENT_GUIDE.md))

---

## Альтернативы PM2

### systemd (более «правильно» для Linux)

`/etc/systemd/system/hostel-bot.service`:

```ini
[Unit]
Description=Hostel Bot WhatsApp
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/hostel-bot
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/hostel-bot/out.log
StandardError=append:/var/log/hostel-bot/err.log
EnvironmentFile=/home/botuser/hostel-bot/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now hostel-bot
sudo systemctl status hostel-bot
sudo journalctl -u hostel-bot -f
```

### Docker

Docker не рекомендуется для этого бота — Chromium внутри контейнера требует extra настройки (--no-sandbox + capabilities). PM2 проще.

---

## Бэкапы

Что бэкапить:
- `./sessions/` — WhatsApp авторизация (если потеряешь — нужно заново сканировать QR)
- `.env` — API ключ
- `package-lock.json` — точные версии зависимостей

Что НЕ бэкапить (gitignored / временное):
- `node_modules/`
- `logs/`
- `debug-screenshots/`

Простой бэкап:

```bash
tar czf hostel-bot-backup-$(date +%F).tar.gz sessions .env package-lock.json
# Скопировать в безопасное место (S3, другой сервер)
```
