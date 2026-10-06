// Turns one Discord message into a code entry, using the settings from data/games.json.
// Returns null when the message does not contain a code.
//
// Two ways to describe a source:
//  - Plain text posts: codeRegex, expiresRegex, requirementsRegex.
//  - Bot posts with an embed: fields { code, expires, starts } = the field titles to read.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

export function messageText(msg) {
  const parts = [msg.content || ''];
  for (const e of msg.embeds || []) {
    parts.push(e.title || '', e.description || '');
    for (const f of e.fields || []) parts.push(`${f.name}\n${f.value}`);
  }
  return parts.join('\n');
}

function embedField(msg, title) {
  if (!title) return null;
  for (const e of msg.embeds || []) {
    for (const f of e.fields || []) {
      if (f.name.toLowerCase().includes(title.toLowerCase())) return f.value;
    }
  }
  return null;
}

// Discord timestamps look like <t:1791000000:F>; fall back to a normal date string.
function parseDate(value) {
  if (!value) return null;
  const unix = value.match(/<t:(\d+)/);
  const d = unix ? new Date(+unix[1] * 1000) : new Date(value.replace(/[`*]/g, '').trim());
  return isNaN(d) ? null : d.toISOString();
}

function parseFields(msg, source, postedAt) {
  const raw = embedField(msg, source.fields.code);
  const code = raw ? raw.replace(/[^A-Za-z0-9_-]/g, '') : '';
  if (!code) return null;
  return {
    code,
    reward: null,
    requirements: null,
    startsAt: parseDate(embedField(msg, source.fields.starts)) || postedAt.toISOString(),
    expiresAt: parseDate(embedField(msg, source.fields.expires)),
    source: source.label
  };
}

export function parseMessage(msg, source) {
  const postedAt = new Date(msg.timestamp);
  if (source.fields) return parseFields(msg, source, postedAt);

  const text = messageText(msg);
  const codeMatch = text.match(new RegExp(source.codeRegex));
  if (!codeMatch) return null;

  let expiresAt = null;
  if (source.expiresRegex) {
    const m = text.match(new RegExp(source.expiresRegex, 'i'));
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (month >= 0) {
      // Posts give no year: use the year of the post, or the next one if that would be in the past.
      let d = new Date(Date.UTC(postedAt.getUTCFullYear(), month, +m[2], +m[3], +m[4]));
      if (d < postedAt) d = new Date(Date.UTC(postedAt.getUTCFullYear() + 1, month, +m[2], +m[3], +m[4]));
      expiresAt = d.toISOString();
    }
  }

  let requirements = null;
  if (source.requirementsRegex) {
    const m = text.match(new RegExp(source.requirementsRegex, 'i'));
    if (m) requirements = m[1].trim();
  }

  return {
    code: codeMatch[1],
    reward: null,
    requirements,
    startsAt: postedAt.toISOString(),
    expiresAt,
    source: source.label
  };
}
