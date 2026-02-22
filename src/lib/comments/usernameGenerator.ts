/**
 * Random Username Generator for Anonymous Comments
 *
 * Generates usernames in format: AdjectiveNoun12345678
 * Example: DuckMan81072194, BraveWizard42069420
 *
 * - 2 words (adjective + noun)
 * - 8 random digits
 * - Wide variety of word combinations
 */

// ============================================================================
// ADJECTIVES (100+ words)
// ============================================================================
const ADJECTIVES = [
  'Ancient', 'Brave', 'Clever', 'Daring', 'Epic', 'Fierce', 'Golden', 'Happy',
  'Invisible', 'Jolly', 'Keen', 'Lucky', 'Mighty', 'Noble', 'Opulent', 'Proud',
  'Quick', 'Radiant', 'Silent', 'Turbo', 'Ultimate', 'Vivid', 'Wild', 'Xenial',
  'Young', 'Zealous', 'Agile', 'Bold', 'Cosmic', 'Dynamic', 'Electric', 'Frosty',
  'Graceful', 'Heroic', 'Infinite', 'Jazzy', 'Kinetic', 'Legendary', 'Mystic',
  'Neon', 'Omega', 'Phoenix', 'Quantum', 'Rogue', 'Shadow', 'Stellar', 'Thunder',
  'Uber', 'Vortex', 'Wicked', 'Xtreme', 'Yonder', 'Zesty', 'Arctic', 'Blazing',
  'Crimson', 'Diamond', 'Emerald', 'Fabled', 'Glacial', 'Hyper', 'Iron', 'Jade',
  'Lunar', 'Marble', 'Nebula', 'Obsidian', 'Plasma', 'Royal', 'Sapphire', 'Titan',
  'Ultra', 'Velvet', 'Crystal', 'Digital', 'Ember', 'Frozen', 'Ghost', 'Hidden',
  'Ivory', 'Cyber', 'Primal', 'Raging', 'Sacred', 'Toxic', 'Vapor', 'Zen',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Sigma', 'Omega', 'Prime', 'Nova',
  'Astral', 'Ethereal', 'Spectral', 'Temporal', 'Eternal', 'Infinite', 'Cosmic',
];

// ============================================================================
// NOUNS (100+ words)
// ============================================================================
const NOUNS = [
  'Warrior', 'Wizard', 'Dragon', 'Phoenix', 'Tiger', 'Eagle', 'Wolf', 'Bear',
  'Lion', 'Hawk', 'Shark', 'Falcon', 'Panther', 'Viper', 'Cobra', 'Raven',
  'Knight', 'Samurai', 'Ninja', 'Pirate', 'Viking', 'Spartan', 'Gladiator', 'Hunter',
  'Ranger', 'Scout', 'Sniper', 'Soldier', 'Guardian', 'Sentinel', 'Champion', 'Hero',
  'Legend', 'Titan', 'Giant', 'Golem', 'Demon', 'Angel', 'Spirit', 'Ghost',
  'Shadow', 'Phantom', 'Specter', 'Wraith', 'Reaper', 'Slayer', 'Blade', 'Sword',
  'Arrow', 'Spear', 'Axe', 'Hammer', 'Shield', 'Storm', 'Thunder', 'Lightning',
  'Blaze', 'Flame', 'Frost', 'Ice', 'Fire', 'Water', 'Earth', 'Wind',
  'Star', 'Moon', 'Sun', 'Comet', 'Meteor', 'Galaxy', 'Nebula', 'Cosmos',
  'Void', 'Abyss', 'Chaos', 'Order', 'Dawn', 'Dusk', 'Night', 'Day',
  'Rogue', 'Thief', 'Assassin', 'Spy', 'Agent', 'Operative', 'Mercenary', 'Bounty',
  'King', 'Queen', 'Prince', 'Duke', 'Baron', 'Lord', 'Master', 'Chief',
  'Fox', 'Owl', 'Cat', 'Dog', 'Horse', 'Bull', 'Ram', 'Stag',
  'Sage', 'Monk', 'Priest', 'Shaman', 'Oracle', 'Prophet', 'Seer', 'Mystic',
];

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

/**
 * Gets a random element from an array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates N random digits
 */
function randomDigits(count: number): string {
  let digits = '';
  for (let i = 0; i < count; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

/**
 * Generates a random username
 * Format: AdjectiveNoun12345678
 *
 * @param seed - Optional seed for deterministic generation (use identity hash)
 * @returns Random username string
 */
export function generateUsername(seed?: string): string {
  let adjective: string;
  let noun: string;
  let digits: string;

  if (seed) {
    // Deterministic generation from seed (so same user gets same name per page)
    const hash = simpleHash(seed);
    adjective = ADJECTIVES[hash % ADJECTIVES.length];
    noun = NOUNS[(hash >> 8) % NOUNS.length];
    digits = (hash % 100000000).toString().padStart(8, '0');
  } else {
    // Random generation
    adjective = randomElement(ADJECTIVES);
    noun = randomElement(NOUNS);
    digits = randomDigits(8);
  }

  return `${adjective}${noun}${digits}`;
}

/**
 * Simple hash function for deterministic username generation
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic username from an identity hash
 * Same identity = same username
 */
export function generateUsernameFromIdentity(identityHash: string): string {
  return generateUsername(identityHash);
}

/**
 * Validates if a string is a valid generated username
 */
export function isValidUsername(username: string): boolean {
  // Match format: AdjectiveNoun12345678
  const pattern = /^[A-Z][a-z]+[A-Z][a-z]+\d{8}$/;
  return pattern.test(username);
}

/**
 * Gets username stats (for debugging)
 */
export function getUsernameStats() {
  return {
    adjectiveCount: ADJECTIVES.length,
    nounCount: NOUNS.length,
    possibleCombinations: ADJECTIVES.length * NOUNS.length * 100000000, // 8 digits = 100M combinations
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateUsername,
  generateUsernameFromIdentity,
  isValidUsername,
  getUsernameStats,
};
