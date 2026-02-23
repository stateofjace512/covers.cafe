import { getEnvString } from './env.server.js';

export const moderateUsername = async (username) => {
  const apiKey = getEnvString('OPENAI_API_KEY');

  if (!apiKey) {
    console.error('OpenAI API key not configured');
    throw new Error('Username moderation service is temporarily unavailable');
  }

  if (typeof username !== 'string' || username.length < 4 || username.length > 24) {
    return { valid: false, error: 'Username must be between 4 and 24 characters' };
  }

  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return { valid: false, error: 'Username must contain only letters and numbers' };
  }

  const moderationPrompt = `You are an automated content moderation classifier. Your sole function is to evaluate a given username and determine if it violates safety policies.

This is the user's chosen username: ${username}

Rules: Respond 'false' if the username contains any of the following:

Racial, ethnic, or homophobic slurs
Hate speech or symbols
Explicit sexual language or references
Harassment or threats
Promotion of self-harm or graphic violence
References to illegal drugs or criminal activity
Uses any swear words (excluding common identifiers like 'hell' or 'damn')
Content possibly involving minors (ie: ILikeKids)
Uses official-adjacent or authoritarian usernames to display control; this includes the following: Usernames attempting to mimic our brand (MSTRJK, MisterJK, Mister JK, MRJK, Jake Robison, Natalia Wallen, Jasmine Erica, Danica Williams, Georgia Wixen, Georgia Smith, Harley Towers, KAIRA, Lamel Brown, NiceGirls, The Nice Girls), or trying to use "admin", "moderator", "owner", etc in a username. 
Obviously, you will have to take into consideration false positives—‘AdminFan’, ‘GeorgiaLovesMusic’, ‘MisterJake42’ technically break the mould, but are safe.
Output Format:

If the username is inappropriate (violates any rule), respond with the single word: false
If the username is appropriate (safe for a general audience), respond with the single word: true

Do not provide any explanation, punctuation, or capitalization. Your entire response must be only 'true' or 'false'.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: moderationPrompt,
          },
        ],
        max_tokens: 10,
        temperature: 0, 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error('Username moderation service failed');
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim()?.toLowerCase();

    if (result === 'true') {
      return { valid: true };
    } else if (result === 'false') {
      return { valid: false, error: 'This username is not allowed. Please choose a different username.' };
    } else {
      console.error('Unexpected moderation response:', result);
      return { valid: false, error: 'Unable to validate username. Please try a different one.' };
    }
  } catch (error) {
    console.error('Username moderation error:', error);
    throw new Error('Username moderation service is temporarily unavailable');
  }
};

export const generateUniqueSuffix = async (baseUsername, supabase) => {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', baseUsername)
      .eq('username_suffix', suffix)
      .is('archived_at', null)
      .single();

    if (!existing) {
      return suffix;
    }
  }

  throw new Error('Unable to generate unique username suffix. Please try a different username.');
};
