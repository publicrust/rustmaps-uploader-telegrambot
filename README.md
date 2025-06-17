# Rust Maps Uploader Telegram Bot

A Telegram bot written in TypeScript that accepts `.map` files for the game **Rust**, uploads them to Facepunch's public map-upload API, and returns a download link together with an automatically generated Oxide plugin that sets the map URL on the server.

## Features

* `/start` — welcome message.
* `/list` — shows all maps you have uploaded so far.
* Send any `.map` document to trigger the upload workflow.
* Automatic retry logic (up to 10 attempts) when talking to the Facepunch API.
* Persists links per-user in a simple JSON file (`maps.json`).
* Generates and sends back a ready-to-use C# plugin with the uploaded map URL hard-wired.

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure the bot token**
   Create an `.env` file next to `package.json` with the following content:
   ```bash
   BOT_TOKEN=<your_telegram_bot_token>
   ```
3. **Run in development mode** (requires `ts-node` which is installed automatically):
   ```bash
   npm run dev
   ```
4. **Build & run**
   ```bash
   npm run build
   npm start
   ```

## Docker

You can also build and run the bot inside Docker:

```bash
docker build -t rustmaps-uploader-telegrambot .
docker run -e BOT_TOKEN=<your_telegram_bot_token> rustmaps-uploader-telegrambot
```

## GitHub Workflow

Бот настроен на автоматический запуск через GitHub Actions:

- **bot-runner.yml** - основной workflow, запускающий бота каждые 4 часа
  - Использует concurrency для предотвращения одновременного запуска нескольких экземпляров
  - Автоматически останавливается через 3 часа 50 минут для экономии ресурсов
  - Может быть запущен вручную через вкладку Actions

Для настройки GitHub Actions:

1. Добавьте BOT_TOKEN в секреты репозитория (Settings → Secrets → Actions → New repository secret)
2. Убедитесь, что GitHub Actions включены для репозитория
3. Первый запуск можно выполнить вручную через вкладку Actions

Workflow автоматически запустит бота и будет поддерживать его работу.

---

Inspired by the original Next.js web uploader converted to a Telegram experience. 