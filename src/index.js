import "dotenv/config";
import { Bot } from "grammy";
import { uploadByUrl } from "./lulustream.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not configured");

const allowed = new Set(
  (process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "LuluStream Bot is online. Send me a direct video URL and I will submit it to LuluStream."
  );
});

bot.command("upload", async (ctx) => {
  const url = ctx.match?.trim();

  if (!url) {
    await ctx.reply("Usage: /upload <direct-video-url>");
    return;
  }

  if (allowed.size && !allowed.has(String(ctx.from.id))) {
    await ctx.reply("You are not authorized to use this bot.");
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
    await ctx.api.editMessageText(
      ctx.chat.id,
      msg.message_id,
      `✅ LuluStream accepted the remote upload request.\\n\\n${JSON.stringify(result, null, 2)}`
    );
  } catch (error) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      msg.message_id,
      `❌ Upload request failed: ${error.message}`
    );
  }
});

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

bot.start();
console.log("LuluStream bot started");
