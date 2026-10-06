// Reads the Discord channels listed in data/games.json and adds new codes to data/codes/<slug>.json.
// Needs the environment variable DISCORD_BOT_TOKEN. Run with: node scripts/collect.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseMessage } from './parse.mjs';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

async function fetchMessages(channelId) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
    headers: { Authorization: `Bot ${token}` }
  });
  if (!res.ok) throw new Error(`Discord ${res.status} for channel ${channelId}: ${await res.text()}`);
  return res.json();
}

const games = await readJson('data/games.json');
await mkdir('data/codes', { recursive: true });
let failed = false;

for (const game of games) {
  const file = `data/codes/${game.slug}.json`;
  const codes = await readJson(file, []);
  const known = new Set(codes.map(c => c.code));
  let added = 0;

  for (const source of game.sources) {
    if (source.type !== 'discord') continue;
    if (!source.channelId) {
      console.log(`${game.slug}: no channelId yet, skipped`);
      continue;
    }
    try {
      const messages = await fetchMessages(source.channelId);
      for (const msg of messages.reverse()) {
        const entry = parseMessage(msg, source);
        if (!entry || known.has(entry.code)) continue;
        codes.push(entry);
        known.add(entry.code);
        added++;
      }
    } catch (err) {
      failed = true;
      console.error(`${game.slug}: ${err.message}`);
    }
  }

  if (added > 0) {
    codes.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    await writeFile(file, JSON.stringify(codes, null, 2) + '\n');
  }
  console.log(`${game.slug}: ${added} new code(s), ${codes.length} total`);
}

if (failed) process.exit(1);
