# LuluStream Bot

A personal Telegram bot that accepts a `.torrent`, downloads the torrent's video files with WebTorrent, uploads them to LuluStream, and returns the resulting player links.

## Railway architecture

The recommended deployment is **one Railway service**:

```
Telegram
   ↓
Telegram Bot API (torrent metadata only)
   ↓
Railway LuluStream Bot
   ↓
WebTorrent
   ↓
Railway Volume (/data/torrents)
   ↓
LuluStream
   ↓
Links returned in Telegram
```

The bot does **not** need Telegram's Local Bot API. The only Telegram file it downloads is the `.torrent` metadata file; the actual video data comes from the torrent peers. This keeps the Railway setup to one service.

> Telegram's public Bot API currently limits bot file downloads to 20 MB. Torrent metadata files are normally far smaller. The bot rejects a `.torrent` over 20 MB with a clear error.

## Features

- Select a LuluStream destination folder with inline buttons.
- Send a `.torrent` and automatically process its video files.
- Supports MP4, MKV, WebM, MOV, AVI, M4V, TS, M2TS, MPEG, MPG, WMV, FLV and 3GP.
- Processes video files sequentially to keep disk usage predictable.
- Uploads each completed video to LuluStream.
- Returns LuluStream player links.
- `/cancel` stops the current torrent job.
- `/status` shows whether a job is running.
- `/upload <direct-video-url>` submits a direct URL to LuluStream.
- Optional Telegram-user allowlist for a private bot.
- Temporary torrent/video data is removed when a job finishes or fails.

## Commands

- `/start` — show help
- `/id` — show your Telegram numeric user ID
- `/folders` — choose the LuluStream destination folder
- `/status` — show current job status
- `/cancel` — cancel the current torrent job
- `/upload <direct-video-url>` — submit a direct video URL to LuluStream

## Railway setup — beginner guide

### 1. Create the Telegram bot

Open Telegram and talk to **@BotFather**.

Use:

```
/newbot
```

Follow the prompts and copy the bot token.

Keep the token private.

### 2. Get your LuluStream API key

Use the LuluStream API key you already use for your AniVault/LuluStream integration.

Keep it private.

### 3. Create a Railway project

In Railway:

1. Create a new project.
2. Choose **Deploy from GitHub repo**.
3. Select `SH0MIK/lulustream-bot`.
4. Railway should detect the included Dockerfile.
5. Let the first deployment build.

The bot is a worker and does not need a public HTTP domain.

### 4. Add environment variables

In the Railway service, open **Variables** and add:

```
BOT_TOKEN=your_telegram_bot_token
LULUSTREAM_API_KEY=your_lulustream_api_key
ALLOWED_USER_IDS=
TORRENT_DATA_DIR=/data/torrents
```

You can leave `ALLOWED_USER_IDS` empty during the first test.

After you know your Telegram ID, put it there, for example:

```
ALLOWED_USER_IDS=123456789
```

Multiple users can be separated with commas.

### 5. Add a Railway Volume

This is strongly recommended because torrent/video data can be large.

In the bot service:

1. Add a **Volume**.
2. Mount it at:

```
/data
```

The bot automatically uses:

```
/data/torrents
```

for temporary torrent/video data.

The volume is temporary working storage for active jobs; completed files are uploaded to LuluStream and then removed.

**Important:** choose enough storage for the largest torrent you expect to process. A torrent containing a 10 GB video can temporarily require roughly 10 GB of local working space.

### 6. Deploy

After adding the variables and volume, trigger a deployment.

Check **Deployments** and then **Logs**.

A healthy bot should show:

```
LuluStream bot started
```

### 7. Lock the bot to yourself

Open the bot in Telegram and send:

```
/id
```

It will return your numeric Telegram ID.

Put that ID into Railway:

```
ALLOWED_USER_IDS=YOUR_ID
```

Redeploy.

Now other Telegram users cannot use the bot.

### 8. First test

In Telegram:

1. Send `/start`.
2. Send `/folders`.
3. Select a LuluStream folder.
4. Send a small legal/test `.torrent`.
5. The bot finds video files.
6. WebTorrent downloads them to the Railway volume.
7. Each video is uploaded to LuluStream.
8. The bot sends the resulting links.
9. The temporary torrent/video data is cleaned up.

Use `/status` while it runs and `/cancel` if you need to stop it.

## Railway environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `LULUSTREAM_API_KEY` | Yes | LuluStream API authentication |
| `ALLOWED_USER_IDS` | Recommended | Restrict the bot to specific Telegram users |
| `TORRENT_DATA_DIR` | Recommended | Working directory for torrent/video data |

## Local Docker

Docker Compose is also included for testing without Railway:

```bash
copy .env.example .env
docker compose up -d --build
docker compose logs -f bot
```

No Local Telegram Bot API service is required.

## Important limitations

### Torrent metadata size

The public Telegram Bot API currently allows bots to download files up to 20 MB through `getFile`. The bot therefore rejects `.torrent` files larger than 20 MB.

This is normally not an issue because a torrent file is metadata, not the video itself.

### Railway storage

The torrent's actual video data is downloaded to the Railway volume before LuluStream upload. Storage requirements therefore depend on the size of the video currently being processed.

### Restarting a job

Jobs are held in memory. If the Railway service restarts while a torrent is running, that job will stop and its temporary files will be cleaned up on the next normal process cleanup/startup cycle. There is no persistent job queue yet.

### Upload retries

A failed LuluStream upload currently fails that torrent job rather than retrying indefinitely.

## Security

Never commit `.env` or expose:

- Telegram bot token
- LuluStream API key

For a personal bot, always set `ALLOWED_USER_IDS`.

## Copyright

Only upload videos that you have the legal right or permission to store and distribute through your hosting account.

## Development

Install dependencies:

```bash
npm install
```

Run:

```npm
npm start
```
