/**
 * AI-powered content moderation using OpenAI.
 * Used to screen usernames, display names, and website links on profile changes.
 */

const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY as string | undefined;
const OPENAI_MODEL = 'gpt-5-nano-2025-08-07';

async function callOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('Moderation service is temporarily unavailable.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_completion_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function parseBool(raw: string): boolean | null {
  const cleaned = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  return null;
}

// ---------------------------------------------------------------------------
// Username moderation
// ---------------------------------------------------------------------------
export async function moderateUsername(
  username: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!username || username.length < 3) {
    return { ok: false, reason: 'Username must be at least 3 characters.' };
  }
  if (username.length > 30) {
    return { ok: false, reason: 'Username must be 30 characters or fewer.' };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return {
      ok: false,
      reason: 'Username may only contain lowercase letters, numbers, and underscores.',
    };
  }

  const prompt = `You are a content safety classifier for covers.cafe, a music and album-cover community. Evaluate whether the username below is acceptable.

Username: "${username}"

REJECT (respond "false") if the username:
- Contains racial, ethnic, or homophobic slurs
- Contains hate speech or references to supremacist ideology
- Contains explicit sexual language or references
- Contains harassment, threats, or calls to violence
- Promotes self-harm or graphic violence
- References illegal drugs or criminal activity (e.g. cocaine, killcops)
- Contains profanity or offensive swear words — "hell" and "damn" are fine, obvious expletives are not
- References sexual content involving minors (even subtle, e.g. "ilikekids", "teen_lover")
- Impersonates site staff or the brand (e.g. "admin", "moderator", "owner", "coverscafe_mod", "jakesmusic_admin") — but "adminfan" or a generic name is fine
- Is clearly designed to provoke or harass

APPROVE (respond "true") if the username is a generic name, nickname, music-related handle, or any otherwise normal user handle.

When in doubt, approve. Respond with exactly one word: true or false. No explanation, no punctuation.`;

  try {
    const raw = await callOpenAI(prompt);
    const result = parseBool(raw);
    if (result === true) return { ok: true };
    if (result === false) {
      return { ok: false, reason: 'This username is not allowed. Please choose a different one.' };
    }
    // Unexpected response — fail open and log
    console.warn('[moderation] Unexpected username response:', raw);
    return { ok: true };
  } catch (err) {
    console.error('[moderation] Username check error:', err);
    throw new Error('Moderation service is temporarily unavailable. Please try again in a moment.');
  }
}

// ---------------------------------------------------------------------------
// Display name moderation
// ---------------------------------------------------------------------------
export async function moderateDisplayName(
  name: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!name || name.trim().length === 0) return { ok: true };
  if (name.length > 50) {
    return { ok: false, reason: 'Display name must be 50 characters or fewer.' };
  }

  const prompt = `You are a content safety classifier for covers.cafe, a music and album-cover community. Evaluate whether the display name below is acceptable.

Display name: "${name}"

REJECT (respond "false") if the display name:
- Contains racial, ethnic, or homophobic slurs
- Contains hate speech or promotes violence
- Contains explicit sexual content
- Contains a URL or any web link (any domain, even obfuscated or spaced out)
- Impersonates site staff ("admin", "moderator", "owner", or well-known site contributor names)
- Contains clear profanity or offensive slurs

APPROVE (respond "true") if the name is a personal name, nickname, music-related moniker, or any reasonable creative name.

When in doubt, approve. Respond with exactly one word: true or false. No explanation, no punctuation.`;

  try {
    const raw = await callOpenAI(prompt);
    const result = parseBool(raw);
    if (result === true) return { ok: true };
    if (result === false) {
      return {
        ok: false,
        reason: 'This display name is not allowed. Please choose a different one.',
      };
    }
    console.warn('[moderation] Unexpected display name response:', raw);
    return { ok: true };
  } catch (err) {
    console.error('[moderation] Display name check error:', err);
    throw new Error('Moderation service is temporarily unavailable. Please try again in a moment.');
  }
}

// ---------------------------------------------------------------------------
// Website / link moderation
// ---------------------------------------------------------------------------
export async function moderateWebsite(url: string): Promise<{ ok: boolean; reason?: string }> {
  if (!url || url.trim().length === 0) return { ok: true };

  let domain = url;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = parsed.hostname.replace(/^www\./, '');
  } catch {
    return { ok: false, reason: 'Invalid URL format.' };
  }

  const prompt = `You are a content safety classifier for covers.cafe, a music community. A user wants to link to the following domain in their profile: "${domain}"

REJECT (respond "false") ONLY if the site is:
- An adult or pornographic platform (e.g. pornhub.com, onlyfans.com, xvideos.com, xhamster.com, brazzers.com)
- A site primarily hosting illegal content (piracy hubs with no other purpose, darknet markets, CSAM, malware distribution)
- A dedicated hate speech or extremist platform (sites whose primary purpose is hate speech or inciting terrorism)

APPROVE (respond "true") if the site is:
- Any mainstream social media or creative platform (tumblr, twitter, instagram, tiktok, facebook, youtube, soundcloud, bandcamp, spotify, last.fm, linkedin, pinterest, etc.)
- A personal website, portfolio, or blog
- Any legitimate music, entertainment, news, or tech platform
- Unclear or ambiguous — give the user the benefit of the doubt

Respond with exactly one word: true or false. No explanation, no punctuation.`;

  try {
    const raw = await callOpenAI(prompt);
    const result = parseBool(raw);
    if (result === true) return { ok: true };
    if (result === false) {
      return { ok: false, reason: 'This website link is not permitted on this platform.' };
    }
    console.warn('[moderation] Unexpected website response:', raw);
    // Fail open for websites — unknown response means allow
    return { ok: true };
  } catch (err) {
    // Fail open: if moderation service is down, don't block website saves
    console.error('[moderation] Website check error:', err);
    return { ok: true };
  }
}
