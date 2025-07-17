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

// Admin configuration
const ADMIN_IDS = ['5499168023'];

// Debug log token first few characters
console.log('Token starts with:', TOKEN.substring(0, 10) + '...');

// === Bot Init ===
const bot = new Telegraf(TOKEN);

// === User tracking storage ===
const USERS_FILE = path.resolve(__dirname, '../users.json');
const MAPS_FILE = path.resolve(__dirname, '../maps.json');

// Track users who interact with the bot
function readUsers(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return new Set(data.users || []);
  } catch {
    return new Set();
  }
}

function writeUsers(users: Set<string>) {
  const data = { users: Array.from(users) };
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function addUser(userId: string) {
  const users = readUsers();
  users.add(userId);
  writeUsers(users);
}

// Admin functions
function isAdmin(userId: string): boolean {
  return ADMIN_IDS.includes(userId);
}

async function broadcastMessage(message: string, ctx: Context) {
  const users = readUsers();
  const userIds = Array.from(users);
  
  if (userIds.length === 0) {
    await ctx.reply('❌ No users found to send message to.');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  await ctx.reply(`📤 Starting broadcast to ${userIds.length} users...`);
  
  // Send messages with rate limiting to avoid hitting Telegram limits
  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    
    try {
      await bot.telegram.sendMessage(userId, message);
      successCount++;
      
      // Rate limiting: wait 50ms between messages to avoid hitting limits
      if (i < userIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Progress update every 10 messages
      if ((i + 1) % 10 === 0) {
        await ctx.reply(`📤 Progress: ${i + 1}/${userIds.length} messages sent`);
      }
      
    } catch (error) {
      console.error(`Failed to send message to user ${userId}:`, error);
      errorCount++;
      
      // If user blocked bot or other permanent error, remove from users list
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as any).code;
        if (errorCode === 403 || errorCode === 400) {
          const users = readUsers();
          users.delete(userId);
          writeUsers(users);
          console.log(`Removed user ${userId} from tracking due to error ${errorCode}`);
        }
      }
    }
  }
  
  await ctx.reply(`✅ Broadcast completed!\n📊 Success: ${successCount}\n❌ Failed: ${errorCount}`);
}

// Initialize users.json from maps.json on startup
function initializeUsersFromMaps() {
  try {
    const existingUsers = readUsers();
    const mapsData = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
    const mapsUsers = new Set(Object.keys(mapsData));
    
    // Merge existing users with users from maps.json
    const allUsers = new Set([...existingUsers, ...mapsUsers]);
    
    if (mapsUsers.size > 0) {
      writeUsers(allUsers);
      console.log(`🔄 Initialized users.json with ${mapsUsers.size} users from maps.json`);
      console.log(`📊 Total users tracked: ${allUsers.size}`);
    }
  } catch (error) {
    // maps.json doesn't exist or is invalid, that's okay
    console.log('ℹ️  No existing maps.json found or invalid format');
  }
}

// Legacy maps.json compatibility functions
function readStorage(): Record<string, MapEntry[]> {
  try {
    return JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, MapEntry[]>) {
  fs.writeFileSync(MAPS_FILE, JSON.stringify(data, null, 2));
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

const SUPPORT_TEXT = `Powered by <a href="https://shadowhosting.ru/">shadowhosting.ru</a> and RustSchool 123 (<a href="https://discord.gg/VgNHPpNrz6">Discord</a>)

Send me your Rust .map file and I will upload it to Facepunch for you.`;

// === Commands ===
bot.start((ctx: Context) => {
  const userId = ctx.from?.id;
  if (userId) {
    addUser(userId.toString());
  }
  ctx.reply(SUPPORT_TEXT, { parse_mode: 'HTML' });
});

bot.command('list', (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.reply('Cannot determine your Telegram ID.');
    return;
  }

  // Track user interaction
  addUser(userId.toString());

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

// Store pending confirmations
const pendingConfirmations = new Map<string, { message: string; timestamp: number }>();

// Admin command for broadcasting messages
bot.command('message', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.reply('Cannot determine your Telegram ID.');
    return;
  }

  // Track user interaction
  addUser(userId.toString());

  // Check if user is admin
  if (!isAdmin(userId.toString())) {
    ctx.reply('❌ You do not have permission to use this command.');
    return;
  }

  const messageText = (ctx.message as any)?.text?.replace(/^\/message\s*/, '').trim();
  
  if (!messageText) {
    ctx.reply('📝 Usage: /message <your message text>\n\nExample: /message Hello everyone! Check out our new features.');
    return;
  }

  // Confirm before sending
  const confirmMessage = `📤 Are you sure you want to send this message to all users?\n\n"${messageText}"\n\nReply with "yes" to confirm or "no" to cancel.`;
  await ctx.reply(confirmMessage);
  
  // Store pending confirmation
  const confirmationKey = `${userId}_${Date.now()}`;
  pendingConfirmations.set(confirmationKey, { message: messageText, timestamp: Date.now() });
  
  // Clean up old confirmations (older than 5 minutes)
  const now = Date.now();
  for (const [key, data] of pendingConfirmations.entries()) {
    if (now - data.timestamp > 300000) { // 5 minutes
      pendingConfirmations.delete(key);
    }
  }
});

// Admin command for viewing statistics
bot.command('stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    ctx.reply('Cannot determine your Telegram ID.');
    return;
  }

  // Track user interaction
  addUser(userId.toString());

  // Check if user is admin
  if (!isAdmin(userId.toString())) {
    ctx.reply('❌ You do not have permission to use this command.');
    return;
  }

  const users = readUsers();
  const mapsData = readStorage();
  
  const totalUsers = users.size;
  const usersWithMaps = Object.keys(mapsData).length;
  const totalMaps = Object.values(mapsData).reduce((sum, maps) => sum + maps.length, 0);
  
  const statsMessage = `📊 Bot Statistics

👥 Total users: ${totalUsers}
🗺️ Users with maps: ${usersWithMaps}
📁 Total maps uploaded: ${totalMaps}

💾 Files:
• users.json: ${fs.existsSync(USERS_FILE) ? '✅' : '❌'}
• maps.json: ${fs.existsSync(MAPS_FILE) ? '✅' : '❌'}`;

  await ctx.reply(statsMessage);
});

// === File handler ===
bot.on('document', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (userId) {
    addUser(userId.toString());
  }

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

// === Unknown command & fallback handler ===
bot.on('text', async (ctx: Context) => {
  const text = (ctx.message as any)?.text?.trim();
  if (!text) return;

  const userId = ctx.from?.id;
  if (!userId) return;

  // Check for pending confirmations first
  const userConfirmations = Array.from(pendingConfirmations.entries())
    .filter(([key, data]) => key.startsWith(userId.toString()) && Date.now() - data.timestamp < 300000);
  
  if (userConfirmations.length > 0 && (text.toLowerCase() === 'yes' || text.toLowerCase() === 'no')) {
    const [confirmationKey, confirmationData] = userConfirmations[0];
    
    if (text.toLowerCase() === 'yes') {
      await broadcastMessage(confirmationData.message, ctx);
    } else {
      await ctx.reply('❌ Broadcast cancelled.');
    }
    
    // Remove the confirmation
    pendingConfirmations.delete(confirmationKey);
    return;
  }

  // If not a known command
  if (!text.startsWith('/') ||
      (!text.startsWith('/list') && !text.startsWith('/message') && !text.startsWith('/stats') && !text.startsWith('/start'))
  ) {
    await ctx.reply(SUPPORT_TEXT, { parse_mode: 'HTML' });
  }
});

// === Launch ===
// Initialize users from maps.json on startup
initializeUsersFromMaps();

bot.launch()
  .then(() => console.log('🤖 Bot started'))
  .catch((e: unknown) => console.error('Bot launch failed', e));

// graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 