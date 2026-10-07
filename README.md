# LuluStream Bot

A Telegram bot for sending video sources to LuluStream without manually downloading and re-uploading files.

## Architecture

Telegram → Bot → LuluStream remote upload API

The bot is designed to keep video bytes off the bot server whenever LuluStream can fetch the source directly.

## Current status

- [x] Node.js + grammY bot scaffold
- [x] Environment variable configuration
- [x] Optional Telegram user allowlist
- [x] LuluStream remote URL upload client
- [x] `/upload <direct-url>`
- [ ] Telegram video/document → fetchable URL → LuluStream
- [ ] Upload status polling
- [ ] Friendly file-code/player-link response
- [ ] Torrent/magnet workflow, if supported by an appropriate source endpoint
- [ ] Production deployment configuration

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set `BOT_TOKEN`.
4. Set `LULUSTREAM_API_KEY`.
5. Optionally set `ALLOWED_USER_IDS` to comma-separated Telegram user IDs.
6. Run `npm install`.
7. Run `npm start`.

Never commit `.env` or API keys.

## Commands

```
/start
/upload <direct-video-url>
```

## Important

The bot does not currently download Telegram files itself. The next implementation step is to determine the most reliable way to turn a Telegram-uploaded file into a URL LuluStream can fetch, then add status polling and result parsing.
