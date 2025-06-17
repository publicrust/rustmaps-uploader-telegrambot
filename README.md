# Rust Maps Uploader Bot (@rustmapsbot)

Telegram bot that uploads Rust map files to Facepunch API and returns download URL with Oxide plugin.

## Quick Start

```bash
# Install
npm install

# Configure
echo "BOT_TOKEN=your_token" > .env

# Run
npm start
```

## Features
- Upload .map files to Facepunch
- Get download links
- Receive ready-to-use Oxide plugins
- Command: /list to see upload history

## GitHub Actions
Bot runs automatically every 4 hours via GitHub Actions workflow. 