# LuluStream Bot

A personal Telegram bot that accepts a `.torrent`, downloads the torrent's video files, uploads them to LuluStream, and returns the resulting player links.

## What it does

```
Telegram .torrent
      ↓
Local Telegram Bot API
      ↓
WebTorrent
      ↓
Download video files to temporary disk
      ↓
LuluStream
      ↓
Player links returned in Telegram
```

The bot processes one torrent at a time per Telegram user. Multiple users can have independent jobs.

## Commands

- `/start` — show help
- `/folders` — choose the LuluStream destination folder
- `/status` — show whether your torrent job is running
- `/cancel` — request cancellation of your current torrent job
- `/upload <direct-video-url>` — send a directly reachable video URL to LuluStream

For torrent uploads, choose a folder with `/folders`, then send a `.torrent` document.

## Requirements

The included Docker Compose setup is the recommended beginner setup.

You need:

- Docker Desktop or Docker Engine + Compose
- A Telegram bot token from BotFather
- Telegram API ID and API hash
- A LuluStream API key
- Enough free disk space for the torrent currently being downloaded
- Your Telegram user ID if you want to lock the bot to yourself

The local Telegram Bot API server is included so the bot is not limited by the normal public Bot API file-download restriction. It requires the Telegram API ID/hash.

## Setup

1. Clone this repository.
2. Copy `.env.example` to `.env`.
3. Fill in the values:
   - `BOT_TOKEN`
   - `LULUSTREAM_API_KEY`
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `ALLOWED_USER_IDS`
4. Stop any existing instance of the bot.
5. Before using the local Bot API for the first time, deregister the bot from Telegram's public Bot API with the `logOut` method. This is required when switching a bot to a local Bot API server.
6. Run:

```bash
docker compose up -d --build
```

7. Watch the logs:

```bash
docker compose logs -f bot
```

You should see:

```
LuluStream bot started
```

## First use

Open your bot in Telegram:

1. Send `/start`.
2. Send `/folders`.
3. Pick the LuluStream folder.
4. Send a small legal/test `.torrent`.
5. Wait for the bot to download and upload each video.
6. The bot will return the LuluStream player links.

Use `/status` while a job is running. Use `/cancel` if you need to stop it.

## Environment

`ALLOWED_USER_IDS` is strongly recommended for a personal bot. Put your Telegram numeric user ID there. Multiple IDs can be separated with commas.

Never commit `.env` or expose your Telegram/LuluStream keys.

## Storage

Torrent data is temporary and is deleted after the job finishes or fails. Keep enough free disk space for the largest torrent/video being processed.

## Copyright

Only upload videos that you have the legal right or permission to store and distribute through your hosting account.
