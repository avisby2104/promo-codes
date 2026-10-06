// Turns one Discord message into a code entry, using the regexes from data/games.json.
// Returns null when the message does not contain a code.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

export function messageText(msg) {
  const parts = [msg.content || ''];
  for (const e of msg.embeds || []) {
    parts.push(e.title || '', e.description || '');
  }
  return parts.join('\n');
}

export function parseMessage(msg, source) {
  const text = messageText(msg);
  const codeMatch = text.match(new RegExp(source.codeRegex));
  if (!codeMatch) return null;

  const postedAt = new Date(msg.timestamp);
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
    code: codeMatch[1].toUpperCase(),
    reward: null,
    requirements,
    startsAt: postedAt.toISOString(),
    expiresAt,
    source: source.label
  };
}
