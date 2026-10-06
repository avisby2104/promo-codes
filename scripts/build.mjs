// Builds the static site into dist/ from site.json, data/games.json and data/codes/*.json.
// Run with: node scripts/build.mjs

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';

const site = JSON.parse(await readFile('site.json', 'utf8'));
const games = JSON.parse(await readFile('data/games.json', 'utf8'));
const now = new Date();

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = iso => new Date(iso).toLocaleString('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
}) + ' UTC';
const time = iso => `<time datetime="${iso}">${fmt(iso)}</time>`;
const isExpired = c => c.expiresAt && new Date(c.expiresAt) <= now;

async function loadCodes(slug) {
  try {
    return JSON.parse(await readFile(`data/codes/${slug}.json`, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function page({ title, description, path, root, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(site.url + path)}">
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body>
<header class="top"><a href="${root || './'}">${esc(site.name)}</a></header>
<main>
${body}
</main>
<footer>Codes are collected from the games' official channels. Not affiliated with any game developer.</footer>
<script src="${root}assets/app.js" defer></script>
</body>
</html>
`;
}

function codeCard(game, c) {
  const rows = [];
  if (c.reward) rows.push(`<div><dt>Reward</dt><dd>${esc(c.reward)}</dd></div>`);
  rows.push(`<div><dt>Expires</dt><dd>${c.expiresAt ? time(c.expiresAt) : 'Unknown'}</dd></div>`);
  rows.push(`<div><dt>Added</dt><dd>${time(c.startsAt)}</dd></div>`);
  if (c.requirements) rows.push(`<div><dt>Requires</dt><dd>${esc(c.requirements)}</dd></div>`);
  rows.push(`<div><dt>Source</dt><dd>${esc(c.source)}</dd></div>`);
  return `<li class="code" data-key="${esc(game.slug)}:${esc(c.code)}"${c.expiresAt ? ` data-expires="${c.expiresAt}"` : ''}>
<div class="code-head">
<code>${esc(c.code)}</code>
<button type="button" class="copy" data-code="${esc(c.code)}">Copy</button>
</div>
<dl>${rows.join('')}</dl>
<div class="marks">
<button type="button" data-mark="used">Used</button>
<button type="button" data-mark="failed">Did not work</button>
</div>
</li>`;
}

function redeemSection(game) {
  const r = game.redeem || {};
  const items = [];
  if (r.android) items.push(`<li><strong>Android:</strong> ${esc(r.android)}</li>`);
  if (r.ios) items.push(`<li><strong>iOS:</strong> ${esc(r.ios)}</li>`);
  if (r.url) items.push(`<li><a href="${esc(r.url)}" rel="nofollow noopener">Official redemption page</a></li>`);
  return items.length ? `<section><h2>How to redeem</h2><ul class="plain">${items.join('')}</ul></section>` : '';
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await copyFile('src/style.css', 'dist/assets/style.css');
await copyFile('src/app.js', 'dist/assets/app.js');

const latest = [];
const gameRows = [];

for (const game of games) {
  const codes = (await loadCodes(game.slug)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const active = codes.filter(c => !isExpired(c));
  const expired = codes.filter(isExpired);
  for (const c of codes) latest.push({ game, c });

  const body = `<h1>${esc(game.name)} promo codes</h1>
<p class="lead">All known promo codes for ${esc(game.name)}, collected from the official channels. Last checked ${time(now.toISOString())}.</p>
<section>
<h2>Active codes</h2>
<ul class="codes" id="active">${active.map(c => codeCard(game, c)).join('\n')}</ul>
<p class="empty" id="no-active"${active.length ? ' hidden' : ''}>No active codes right now. New codes show up here automatically when the developer posts them.</p>
</section>
${redeemSection(game)}
<section>
<h2>Expired codes</h2>
<ul class="codes" id="expired">${expired.map(c => codeCard(game, c)).join('\n')}</ul>
</section>`;

  await mkdir(`dist/${game.slug}`, { recursive: true });
  await writeFile(`dist/${game.slug}/index.html`, page({
    title: `${game.name} promo codes (${now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })})`,
    description: `Active and expired promo codes for ${game.name}, with expiry dates and how to redeem them.`,
    path: `${game.slug}/`,
    root: '../',
    body
  }));

  gameRows.push(`<li><a href="${esc(game.slug)}/"><span>${esc(game.name)}</span><span class="count">${active.length} active</span></a></li>`);
}

latest.sort((a, b) => b.c.startsAt.localeCompare(a.c.startsAt));
const latestRows = latest.slice(0, 10).map(({ game, c }) =>
  `<li${c.expiresAt ? ` data-expires="${c.expiresAt}"` : ''}><a href="${esc(game.slug)}/"><span><code>${esc(c.code)}</code> ${esc(game.name)}</span><span class="count">${isExpired(c) ? 'expired' : 'active'}</span></a></li>`);

await writeFile('dist/index.html', page({
  title: site.name,
  description: site.tagline,
  path: '',
  root: '',
  body: `<h1>${esc(site.name)}</h1>
<p class="lead">${esc(site.tagline)}</p>
<section><h2>Games</h2><ul class="list">${gameRows.join('\n')}</ul></section>
<section><h2>Latest codes</h2><ul class="list" id="latest">${latestRows.join('\n')}</ul></section>`
}));

const urls = ['', ...games.map(g => `${g.slug}/`)];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${esc(site.url + u)}</loc></url>`).join('\n')}
</urlset>
`);

console.log(`Built ${games.length} game page(s) into dist/`);
