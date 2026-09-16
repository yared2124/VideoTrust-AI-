import type { RawComment } from '../ingestion/types.js';
import type { SpamClassification } from './types.js';

// Common scam & bot ring signatures found in YouTube comments
const SCAM_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /wa\.me\/[0-9]+/i,
    reason: 'WhatsApp direct messaging link',
  },
  {
    regex: /(?:whatsapp|contact|telegram|reach)\s*(?:me|him|her)?\s*(?:on|at|via)?\s*[:\s]*\+?[0-9\s-]{9,16}/i,
    reason: 'Phone/WhatsApp number solicitation',
  },
  {
    regex: /(?:telegram|t\.me)\/([a-zA-Z0-9_]+)/i,
    reason: 'Telegram channel / user solicitation',
  },
  {
    regex: /(?:crypto|bitcoin|eth|usdt)\s+(?:recovery|expert|specialist|profits?|trader)/i,
    reason: 'Cryptocurrency investment / recovery scam keyword',
  },
  {
    regex: /(?:lost|stolen)\s+(?:funds?|crypto|btc)\s+and\s+(?:got|received)\s+(?:them|it)\s+back/i,
    reason: 'Fund recovery scam testimonial',
  },
  {
    regex: /(?:bit\.ly|tinyurl\.com|cutt\.ly|is\.gd)\/[a-zA-Z0-9_-]+/i,
    reason: 'Shortened suspicious redirect link',
  },
  {
    regex: /check\s+my\s+(?:channel|bio|link\s+in\s+description|profile)/i,
    reason: 'Self-promotional channel link bait',
  },
];

// Unicode Regex for matching emojis
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

/**
 * Normalizes text by lowercasing, stripping special symbols, and collapsing whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Keep only letters, numbers, and spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates the percentage of a string made up of emoji characters.
 */
export function calculateEmojiDensity(text: string): { count: number; density: number } {
  const matches = text.match(EMOJI_REGEX);
  const count = matches ? matches.length : 0;
  
  // Non-whitespace character count
  const nonWhitespaceChars = text.replace(/\s+/g, '').length;
  if (nonWhitespaceChars === 0) {
    return { count, density: 0 };
  }

  const density = count / nonWhitespaceChars;
  return { count, density };
}

/**
 * Classifies whether an individual comment is spam, scam, or low-quality noise.
 */
export function classifySpam(comment: RawComment): SpamClassification {
  const trimmed = comment.text.trim();

  // 1. Too short to carry any analytical value (e.g. "hi", "lol", "🔥")
  if (trimmed.length < 3) {
    return {
      isSpam: true,
      category: 'too_short',
      reason: 'Comment too short to contain analytical signal (< 3 characters)',
    };
  }

  // 2. Regex pattern checks (WhatsApp, Telegram, Financial recovery scams)
  for (const { regex, reason } of SCAM_PATTERNS) {
    if (regex.test(trimmed)) {
      return {
        isSpam: true,
        category: 'scam_regex',
        reason,
      };
    }
  }

  // 3. Emoji flood check (> 40% emojis with at least 4 emojis)
  const { count: emojiCount, density: emojiDensity } = calculateEmojiDensity(trimmed);
  if (emojiCount >= 4 && emojiDensity > 0.4) {
    return {
      isSpam: true,
      category: 'emoji_flood',
      reason: `Excessive emoji density (${Math.round(emojiDensity * 100)}% of characters are emojis)`,
    };
  }

  return { isSpam: false };
}
