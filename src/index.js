import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import FormData from "form-data";
import { Bot, InlineKeyboard } from "grammy";
import WebTorrent from "webtorrent";
import { listFolders, uploadByUrl, getUploadServer } from "./lulustream.js";

const token=process.env.BOT_TOKEN;
if(!token) throw new Error("BOT_TOKEN is not configured");
const allowed=new Set((process.env.ALLOWED_USER_IDS||"").split(",").map(x=>x.trim()).filter(Boolean));
const bot=new Bot(token);
const selected=new Map();
const active=new Set();
const VIDEO=new Set([".mp4",".mkv",".webm",".mov",".avi",".m4v",".ts",".m2ts",".mpeg",".mpg",".wmv",".flv",".3gp"]);

function ok(ctx){return !allowed.size||allowed.has(String(ctx.from?.id));}
function isVideo(n){return VIDEO.has(path.extname(n).toLowerCase());}
function bytes(n){if(!Number.isFinite(n))return"0 B";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<3){n/=1024;i++;}return n.toFixed(i?1:0)+" "+u[i];}

async function getTorrent(ctx,id){
  const f=await ctx.api.getFile(id);
  if(!f.file_path)throw new Error("Telegram did not return the torrent path.");
  const r=await fetch("https://api.telegram.org/file/bot"+token+"/"+f.file_path);
  if(!r.ok)throw new Error("Telegram download failed: HTTP "+r.status);
  const p=path.join(os.tmpdir(),"torrent-"+Date.now()+".torrent");
  await pipeline(r.body,fs.createWriteStream(p)); return p;
}

async function folders(ctx){
  const list=await listFolders(0);
  if(!list.length)return ctx.reply("📁 No LuluStream folders found.");
  const kb=new InlineKeyboard();
  for(const f of list.slice(0,50))kb.text("📁 "+f.name,"folder:"+f.fld_id).row();
  return ctx.reply("📂 Choose the LuluStream destination folder:",{reply_markup:kb});
}

async function uploadStream(file,fldId,name){
  const server=await getUploadServer();
  const form=new FormData();
  form.append("key",process.env.LULUSTREAM_API_KEY);
  form.append("fld_id",String(fldId));
  form.append("file",file.createReadStream(),{filename:name});
  const r=await fetch(server,{method:"POST",headers:form.getHeaders(),body:form});
  if(!r.ok)throw new Error("LuluStream upload failed: HTTP "+r.status);
  const d=await r.json();
  if(d.status&&Number(d.status)!==200)throw new Error(d.msg||"LuluStream upload failed");
  const item=d.files?.find(x=>x.status==="OK")||d.files?.[0];
  if(!item?.filecode)throw new Error("No file code returned for "+name);
  return item.filecode;
}

async function processTorrent(ctx,p,folder){
  const client=new WebTorrent();
  let torrent;
  try{
    const msg=await ctx.reply("📂 "+folder.name+"\n\n⏳ Reading torrent...");
    torrent=await new Promise((resolve,reject)=>{
      let done=false;
      const t=client.add(p,{strategy:"sequential"},x=>{if(!done){done=true;resolve(x);}});
      t.on("error",reject);client.on("error",reject);
    });
    const videos=torrent.files.filter(x=>isVideo(x.name));
    if(!videos.length)throw new Error("No supported video files found.");
    await ctx.api.editMessageText(ctx.chat.id,msg.message_id,"📂 "+folder.name+"\n🎬 "+videos.length+" videos found\n\nStarting queue...");
    const links=[];
    for(let i=0;i<videos.length;i++){
      const file=videos[i],name=path.basename(file.name);
      await ctx.api.editMessageText(ctx.chat.id,msg.message_id,"📂 "+folder.name+"\n\n⬇️/⬆️ "+(i+1)+"/"+videos.length+"\n"+name+"\n"+bytes(file.length)+"\n\nStreaming torrent data directly to LuluStream...");
      file.select();
      const code=await uploadStream(file,folder.fld_id,name);
      links.push("▶️ https://lulustream.com/"+code+".html");
      try{file.deselect();}catch{}
      await ctx.api.editMessageText(ctx.chat.id,msg.message_id,"✅ "+(i+1)+"/"+videos.length+" uploaded\n📄 "+name+"\n\n"+links.join("\n"));
    }
    await ctx.api.editMessageText(ctx.chat.id,msg.message_id,"🎉 Torrent finished!\n\n📂 "+folder.name+"\n🎬 Uploaded: "+links.length+"\n\n"+links.join("\n"));
  }finally{
    try{if(torrent)await torrent.destroy();}catch{}
    try{await client.destroy();}catch{}
    try{fs.rmSync(p,{force:true});}catch{}
  }
}

bot.command("start",async ctx=>{
  if(!ok(ctx))return ctx.reply("You are not authorized to use this bot.");
  return ctx.reply("👋 LuluStream Bot is ready.\n\nUse /folders, select a folder, then send a .torrent file.");
});
bot.command("folders",async ctx=>{
  if(!ok(ctx))return ctx.reply("You are not authorized to use this bot.");
  try{await folders(ctx);}catch(e){await ctx.reply("❌ Folder lookup failed: "+e.message);}
});
bot.callbackQuery(/^folder:(.+)$/,async ctx=>{
  if(!ok(ctx)){await ctx.answerCallbackQuery({text:"Not authorized",show_alert:true});return;}
  try{
    const list=await listFolders(0),f=list.find(x=>String(x.fld_id)===String(ctx.match[1]));
    if(!f){await ctx.answerCallbackQuery({text:"Folder not found",show_alert:true});return;}
    selected.set(String(ctx.from.id),{fld_id:f.fld_id,name:f.name});
    await ctx.answerCallbackQuery({text:"Selected "+f.name});
    await ctx.editMessageText("✅ Destination selected\n\n📂 "+f.name+"\n\nNow send the .torrent file.");
  }catch(e){await ctx.answerCallbackQuery({text:"Folder selection failed",show_alert:true});}
});
bot.command("upload",async ctx=>{
  if(!ok(ctx))return ctx.reply("You are not authorized to use this bot.");
  const url=ctx.match?.trim(),folder=selected.get(String(ctx.from.id));
  if(!url)return ctx.reply("Usage: /upload <direct-video-url>");
  if(!folder)return ctx.reply("📂 Choose a destination with /folders first.");
  try{new URL(url);}catch{return ctx.reply("❌ Invalid URL.");}
  const m=await ctx.reply("⏳ Submitting URL...");
  try{
    const d=await uploadByUrl(url,folder.fld_id),code=d?.result?.filecode;
    if(!code)throw new Error("No file code returned.");
    await ctx.api.editMessageText(ctx.chat.id,m.message_id,"✅ Accepted\n\n📂 "+folder.name+"\n▶️ https://lulustream.com/"+code+".html");
  }catch(e){await ctx.api.editMessageText(ctx.chat.id,m.message_id,"❌ Upload failed: "+e.message);}
});
bot.on("message:document",async ctx=>{
  if(!ok(ctx))return ctx.reply("You are not authorized to use this bot.");
  const doc=ctx.message.document,name=(doc.file_name||"").toLowerCase();
  if(!name.endsWith(".torrent"))return;
  const folder=selected.get(String(ctx.from.id));
  if(!folder)return ctx.reply("📂 Choose a destination with /folders first.");
  const uid=String(ctx.from.id);
  if(active.has(uid))return ctx.reply("⏳ You already have a torrent running.");
  active.add(uid);let p;
  try{await ctx.reply("📦 Torrent received. Preparing it...");p=await getTorrent(ctx,doc.file_id);await processTorrent(ctx,p,folder);}
  catch(e){await ctx.reply("❌ Torrent job failed: "+e.message);if(p)try{fs.rmSync(p,{force:true});}catch{}}
  finally{active.delete(uid);}
});
bot.catch(e=>console.error("Bot error:",e.error));
bot.start();
console.log("LuluStream bot started");
