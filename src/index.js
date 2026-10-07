import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { Bot } from "grammy";
import { getFileInfo, uploadByUrl } from "./lulustream.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not configured");

const telegramApiRoot =
  process.env.TELEGRAM_API_ROOT || "https://api.telegram.org";

const publicFileBaseUrl = process.env.PUBLIC_FILE_BASE_URL?.replace(/\/$/, "");
const filePort = Number(process.env.PORT || process.env.FILE_PORT || 3000);
const fileTtlMs = Number(process.env.FILE_TTL_HOURS || 6) * 60 * 60 * 1000;

const allowed = new Set(
  (process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

const bot = new Bot(token, {
  client: {
    apiRoot: telegramApiRoot
  }
});

const files = new Map();
const app = express();

function authorized(ctx) {
  return !allowed.size || allowed.has(String(ctx.from?.id));
}

function extractFile(message) {
  if (message.video) {
    return {
      fileId: message.video.file_id,
      name: message.video.file_name || "video.mp4",
      mime: message.video.mime_type || "video/mp4",
      size: message.video.file_size
    };
  }

  if (message.document) {
    return {
      fileId: message.document.file_id,
      name: message.document.file_name || "video",
      mime: message.document.mime_type || "application/octet-stream",
      size: message.document.file_size
    };
  }

  return null;
}

function cleanup(id) {
  const entry = files.get(id);
  if (!entry) return;

  files.delete(id);
  clearTimeout(entry.timer);

  try {
    fs.rmSync(entry.filePath, { force: true });
  } catch (error) {
    console.error("Cleanup failed:", error.message);
  }
}

function scheduleCleanup(id, delay = fileTtlMs) {
  const entry = files.get(id);
  if (!entry) return;

  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => cleanup(id), delay);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/stream/:id", (req, res) => {
  const entry = files.get(req.params.id);

  if (!entry) {
    res.status(404).send("File unavailable");
    return;
  }

  fs.stat(entry.filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.status(404).send("File unavailable");
      return;
    }

    res.setHeader("Content-Type", entry.mime);
    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(entry.name)}"`
    );
    res.setHeader("Cache-Control", "no-store");

    const stream = fs.createReadStream(entry.filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
  });
});

app.listen(filePort, () => {
  console.log(`File streaming server listening on :${filePort}`);
});

async function submitTelegramFile(ctx) {
  if (!authorized(ctx)) {
    await ctx.reply("You are not authorized to use this bot.");
    return;
  }

  if (!publicFileBaseUrl) {
    await ctx.reply(
      "Large Telegram uploads are not configured yet. Set PUBLIC_FILE_BASE_URL first."
    );
    return;
  }

  const file = extractFile(ctx.message);
  if (!file) return;

  if (file.size && file.size > 2_000 * 1024 * 1024) {
    await ctx.reply("❌ This file is over Telegram local Bot API's 2 GB limit.");
    return;
  }

  const status = await ctx.reply(
    "⏳ Getting the Telegram file ready for LuluStream..."
  );

  let jobId;

  try {
    const telegramFile = await ctx.api.getFile(file.fileId);

    if (!telegramFile.file_path) {
      throw new Error("Telegram did not return a file path.");
    }

    if (!path.isAbsolute(telegramFile.file_path)) {
      throw new Error(
        "This bot is not connected to a local Telegram Bot API server."
      );
    }

    jobId = crypto.randomUUID();

    files.set(jobId, {
      filePath: telegramFile.file_path,
      name: file.name,
      mime: file.mime,
      timer: null
    });

    scheduleCleanup(jobId);

    const sourceUrl = `${publicFileBaseUrl}/stream/${jobId}`;
    const result = await uploadByUrl(sourceUrl);
    const fileCode = result?.result?.filecode;

    if (!fileCode) {
      throw new Error("LuluStream did not return a file code.");
    }

    const playerUrl = `https://lulustream.com/${fileCode}.html`;

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `📤 LuluStream is processing:\n${file.name}\n\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}\n\n⏳ Waiting for processing...`
    );

    let ready = false;

    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const response = await getFileInfo(fileCode);
      const info = response?.result?.[0];

      if (info?.canplay === 1) {
        ready = true;
        break;
      }
    }

    if (ready) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Done!\n\n📄 ${file.name}\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}`
      );
      cleanup(jobId);
    } else {
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `⏳ Upload accepted; LuluStream is still processing it.\n\n📄 ${file.name}\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}\n\nThe temporary Telegram file will be cleaned up automatically.`
      );
    }
  } catch (error) {
    if (jobId) cleanup(jobId);

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `❌ Upload failed: ${error.message}`
    );
  }
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "LuluStream Bot is online. Send a direct video URL, or forward/send a Telegram video or document."
  );
});

bot.command("upload", async (ctx) => {
  if (!authorized(ctx)) {
    await ctx.reply("You are not authorized to use this bot.");
    return;
  }

  const url = ctx.match?.trim();

  if (!url) {
    await ctx.reply("Usage: /upload <direct-video-url>");
    return;
  }

  try {
    new URL(url);
  } catch {
    await ctx.reply("That does not look like a valid URL.");
    return;
  }

  const msg = await ctx.reply("⏳ Submitting URL to LuluStream...");

  try {
    const result = await uploadByUrl(url);
    const fileCode = result?.result?.filecode;

    if (!fileCode) {
      throw new Error("LuluStream did not return a file code.");
    }

    const playerUrl = `https://lulustream.com/${fileCode}.html`;

    await ctx.api.editMessageText(
      ctx.chat.id,
      msg.message_id,
      `✅ LuluStream accepted the remote upload.\n\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}`
    );
  } catch (error) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      msg.message_id,
      `❌ Upload request failed: ${error.message}`
    );
  }
});

bot.on(["message:video", "message:document"], submitTelegramFile);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

bot.start();
console.log("LuluStream bot started");
