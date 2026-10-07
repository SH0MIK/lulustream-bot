# LuluStream Bot

A Telegram bot for sending video sources to LuluStream.

## Large Telegram file architecture

For files larger than the public Telegram Bot API download limit, the bot uses Telegram's self-hosted Local Bot API Server:

Telegram file
→ Local Bot API Server
→ temporary file on shared storage
→ bot HTTPS streaming endpoint
→ LuluStream remote URL upload
→ LuluStream file code/player

The bot does not read the entire video into Node memory. The temporary file is streamed to LuluStream and automatically removed after processing or after the configured TTL.

Telegram's Local Bot API Server supports unlimited file downloads and uploads up to 2000 MB in local mode.

## Workflow

1. Forward/send a Telegram video or document to the bot.
2. The bot gets the Telegram file.
3. LuluStream is given a temporary HTTPS URL served by the bot.
4. LuluStream fetches the file directly from that URL.
5. The bot polls LuluStream until the file is playable.
6. The bot returns the file code and player URL.
7. Temporary storage is cleaned up automatically.

You can also use:

`/upload <direct-video-url>`

for sources that already have a direct, publicly reachable URL.

## Requirements

- Node.js 20+ for a non-Docker setup.
- Docker + Docker Compose for the included deployment.
- Telegram API ID and API hash from Telegram's API development tools.
- A public HTTPS URL for the bot service so LuluStream can reach the temporary stream.
- Enough temporary disk space for the largest file being processed. A 1.5 GB file needs at least that much free space while it is staged.

## Setup

1. Create `.env` from `.env.example`.
2. Set:
   - `BOT_TOKEN`
   - `LULUSTREAM_API_KEY`
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `PUBLIC_FILE_BASE_URL`
   - optionally `ALLOWED_USER_IDS`
3. Before switching a bot to the Local Bot API Server, call Telegram's `logOut` method on the public Bot API so the bot is deregistered there.
4. Start the stack:

```
docker compose up -d --build
```

5. Put the bot service behind HTTPS and set `PUBLIC_FILE_BASE_URL` to that HTTPS origin.

The included Telegram Bot API image is a community Docker image packaging Telegram's official `tdlib/telegram-bot-api` server.

## Security

- Never commit `.env`.
- Keep the Telegram Bot API server private; only the bot service needs to reach it.
- The temporary stream endpoint uses random job IDs and is not listed publicly.
- Do not log Telegram bot tokens or temporary file URLs.
- Restrict the bot with `ALLOWED_USER_IDS` when it is intended for personal use.

## Copyright

Only upload videos you have the right or permission to store and distribute through your hosting account.
