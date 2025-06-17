import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface MapEntry {
  name: string;
  url: string;
  timestamp: number;
}

// === Environment ===
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  throw new Error('Environment variable BOT_TOKEN is required');
}

// Debug log token first few characters
console.log('Token starts with:', TOKEN.substring(0, 10) + '...');

// === Bot Init ===
const bot = new Telegraf(TOKEN);

// === Simple JSON storage for uploaded links (per-user) ===
const STORAGE_FILE = path.resolve(__dirname, '../maps.json');

function readStorage(): Record<string, MapEntry[]> {
  try {
    return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, MapEntry[]>) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

function saveLink(userId: number, entry: MapEntry) {
  const store = readStorage();
  const key = userId.toString();
  if (!store[key]) store[key] = [];
  store[key].unshift(entry);
  writeStorage(store);
}

function getLinks(userId: number): MapEntry[] {
  const store = readStorage();
  return store[userId.toString()] ?? [];
}

// === Commands ===
bot.start((ctx: Context) => ctx.reply('👋 Send me your Rust .map file and I will upload it to Facepunch for you.'));

bot.command('list', (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.reply('Cannot determine your Telegram ID.');
    return;
  }

  const links = getLinks(userId);
  if (!links.length) {
    ctx.reply('You have no uploaded maps yet.');
    return;
  }

  const msg = links
    .map((l) => `${new Date(l.timestamp).toLocaleString()} — ${l.name}\n${l.url}`)
    .join('\n\n');

  ctx.reply(`Your uploaded maps:\n\n${msg}`);
});

// === File handler ===
bot.on('document', async (ctx: Context) => {
  if (!('document' in (ctx.message as any))) {
    await ctx.reply('Unsupported message type. Please send the .map file directly.');
    return;
  }

  const doc = (ctx.message as any).document as { file_id: string; file_name?: string };

  if (!doc.file_name?.toLowerCase().endsWith('.map')) {
    await ctx.reply('Please send a .map file.');
    return;
  }

  try {
    await ctx.reply('📥 Downloading your file…');

    // 1. Download the file from Telegram servers
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const fileBuffer = await axios
      .get<ArrayBuffer>(fileLink.href, { responseType: 'arraybuffer' })
      .then((res) => Buffer.from(res.data));

    await ctx.reply('⏫ Uploading to Facepunch…');

    // 2. Upload to Facepunch
    const uploadedUrl = await uploadMapImplAsync(fileBuffer, doc.file_name);

    if (!uploadedUrl) {
      await ctx.reply('⚠️ Failed to upload the map. Please try again later.');
      return;
    }

    // 3. Persist and respond
    const userId = ctx.from?.id;
    if (userId) {
      saveLink(userId, {
        name: doc.file_name ?? 'unknown.map',
        url: uploadedUrl,
        timestamp: Date.now(),
      });
    }

    await ctx.reply(`✅ Map successfully uploaded:\n${uploadedUrl}`);

    // 4. Send Oxide plugin
    const plugin = generatePlugin(doc.file_name, uploadedUrl);

    await ctx.replyWithDocument({
      source: Buffer.from(plugin.content, 'utf8'),
      filename: plugin.filename,
    });
  } catch (error) {
    console.error('Handler error', error);
    ctx.reply('❌ An unexpected error occurred.');
  }
});

// === Helpers ===
async function uploadMapImplAsync(buffer: Buffer, mapFileName: string): Promise<string | null> {
  const requestUri = `https://api.facepunch.com/api/public/rust-map-upload/${encodeURIComponent(mapFileName)}`;
  let retries = 0;

  while (retries < 10) {
    try {
      const response = await axios.put(requestUri, buffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (response.status >= 200 && response.status < 300) {
        const body = response.data;
        if (typeof body === 'string' && body.startsWith('http')) {
          return body;
        }
        throw new Error('Invalid success response from backend.');
      }

      if (response.status >= 400 && response.status < 500) {
        return null; // client error — no point retrying
      }
    } catch (err) {
      console.error(`Attempt ${retries + 1} failed`, err);
      await new Promise((r) => setTimeout(r, 1000 + retries * 5000));
      retries += 1;
    }
  }

  return null;
}

function generatePlugin(mapName: string, mapUrl: string): { filename: string; content: string } {
  const formattedName = mapName
    .replace(/\.[^/.]+$/, '') // remove extension
    .split(/[^a-zA-Z0-9]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');

  const className = `${formattedName}MapUrlSetter`;

  const content = `using System;
using Oxide.Core;

namespace Oxide.Plugins
{
    [Info("${className}", "RustGPT", "1.0.0")]
    public class ${className} : RustPlugin
    {
        public static string MapUrl { get; set; } = "${mapUrl}";

        #region Oxide Hooks

        private void Loaded()
        {
            SetMapUrl(MapUrl);
        }

        #endregion Oxide Hooks

        #region Core Methods

        private static void SetMapUrl(string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                Interface.Oxide.LogError("Map download URL cannot be empty!");
                return;
            }

            try
            {
                ConVar.Server.levelurl = url;
                World.Url = url;
                Interface.Oxide.LogInfo($"Map download URL set: {url}");
            }
            catch (Exception ex)
            {
                Interface.Oxide.LogError($"Error setting map URL: {ex.Message}");
            }
        }

        #endregion Core Methods
    }
}`;

  return { filename: `${className}.cs`, content };
}

// === Launch ===
bot.launch()
  .then(() => console.log('🤖 Bot started'))
  .catch((e: unknown) => console.error('Bot launch failed', e));

// graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 