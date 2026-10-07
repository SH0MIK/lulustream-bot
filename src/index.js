import "dotenv/config";
import { Bot } from "grammy";
import { getFileInfo, uploadByUrl } from "./lulustream.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not configured");

const allowed = new Set(
  (process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

const bot = new Bot(token);

function authorized(ctx) {
  return !allowed.size || allowed.has(String(ctx.from?.id));
}

function telegramFileUrl(filePath) {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

function extractFile(message) {
  if (message.video) {
    return { fileId: message.video.file_id, name: message.video.file_name || "video" };
  }

  if (message.document) {
    return {
      fileId: message.document.file_id,
      name: message.document.file_name || "document"
    };
  }

  return null;
}

async function submitTelegramFile(ctx) {
  if (!authorized(ctx)) {
    await ctx.reply("You are not authorized to use this bot.");
    return;
  }

  const file = extractFile(ctx.message);
  if (!file) return;

  const status = await ctx.reply("⏳ Preparing the Telegram file...");

  try {
    const telegramFile = await ctx.api.getFile(file.fileId);

    if (!telegramFile.file_path) {
      throw new Error("Telegram did not return a file path.");
    }

    if (telegramFile.file_size > 20 * 1024 * 1024) {
      throw new Error(
        "This file is over Telegram's standard Bot API download limit of 20 MB."
      );
    }

    const sourceUrl = telegramFileUrl(telegramFile.file_path);
    const result = await uploadByUrl(sourceUrl);
    const fileCode = result?.result?.filecode;

    if (!fileCode) {
      throw new Error("LuluStream did not return a file code.");
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `📤 Submitted: ${file.name}\n\nFile code: ${fileCode}\nChecking processing status...`
    );

    let info = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await getFileInfo(fileCode);
      info = response?.result?.[0];

      if (info?.canplay === 1) break;
    }

    const playerUrl = `https://lulustream.com/${fileCode}.html`;

    if (info?.canplay === 1) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Upload complete!\n\n📄 ${file.name}\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}`
      );
    } else {
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `⏳ LuluStream accepted the upload, but encoding is still in progress.\n\n📄 ${file.name}\n🔑 File code: ${fileCode}\n▶️ Player: ${playerUrl}`
      );
    }
  } catch (error) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `❌ Upload failed: ${error.message}`
    );
  }
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "LuluStream Bot is online. Send a direct video URL, or send me a Telegram video/document."
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
