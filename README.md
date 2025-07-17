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
- **User tracking**: Automatically tracks all users who interact with the bot
- **Admin commands**: /message for broadcasting and /stats for statistics

## User Tracking

The bot automatically tracks all users who interact with it (send messages, upload files, use commands) and stores their Telegram user IDs in `users.json`. This is separate from the map upload history stored in `maps.json`.

**Automatic Initialization**: On startup, the bot automatically reads `maps.json` and initializes `users.json` with existing user IDs, ensuring no users are lost during migration.

## Admin Commands

The bot includes admin functionality for user management and broadcasting:

### `/message <text>`
Broadcasts a message to all users who have interacted with the bot. Includes confirmation dialog and rate limiting to respect Telegram API limits.

**Usage:**
```
/message Hello everyone! Check out our new features.
```

### `/stats`
Shows bot statistics including total users, maps uploaded, and file status.

**Features:**
- Rate limiting (50ms between messages)
- Automatic user cleanup (removes blocked users)
- Progress updates during broadcast
- Confirmation dialog before sending

### Available Scripts

```bash
# Extract user IDs from existing maps.json
npm run extract-users

# View user statistics and bot usage
npm run stats

# Development mode
npm run dev

# Build for production
npm run build
```

### Data Files

- `users.json` - Contains array of user IDs who have interacted with the bot
- `maps.json` - Legacy format containing user upload history (maintained for compatibility)

## GitHub Actions
Bot runs automatically every 4 hours via GitHub Actions workflow. 