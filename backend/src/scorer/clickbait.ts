import { normalizeText } from '../filter/spam-detector.js';

const CLICKBAIT_TRIGGERS = [
  /\b(you won'?t believe|shocking|secret|unbelievable|never seen before)\b/i,
  /\b(will blow your mind|insane trick|changed my life|nobody tells you)\b/i,
  /\b(don'?t do this|stop doing|ruined|is dead|end of)\b/i,
  /\b(free money|100x|guaranteed|overnight|passive income)\b/i,
  /[!?]{2,}/, // Multiple question marks or exclamation points
];

/**
 * Calculates Cosine Similarity between two numeric vectors.
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Fetches text embeddings from Google Gemini API (gemini-embedding-2).
 */
async function fetchGeminiEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: {
          parts: [{ text: text.slice(0, 2048) }], // Limit input size
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    return data?.embedding?.values || null;
  } catch {
    return null;
  }
}

/**
 * Fallback heuristic clickbait divergence when Gemini embeddings are unavailable.
 * Evaluates sensationalist triggers, uppercase ratio, and lexical topic overlap.
 */
export function calculateHeuristicDivergence(
  title: string,
  description: string,
  transcriptText: string
): number {
  let divergence = 0.25; // Neutral baseline

  // 1. Sensationalist trigger regex matches
  for (const trigger of CLICKBAIT_TRIGGERS) {
    if (trigger.test(title)) {
      divergence += 0.18;
    }
  }

  // 2. All-caps ratio in title
  const letters = title.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 5) {
    const uppercaseLetters = letters.replace(/[^A-Z]/g, '').length;
    const upperRatio = uppercaseLetters / letters.length;
    if (upperRatio > 0.6) {
      divergence += 0.20;
    }
  }

  // 3. Keyword presence in transcript or description
  const titleTokens = normalizeText(title)
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (titleTokens.length > 0 && transcriptText.length > 50) {
    const normalizedBody = normalizeText(transcriptText.slice(0, 4000));
    let matchedCount = 0;

    for (const token of titleTokens) {
      if (normalizedBody.includes(token)) {
        matchedCount++;
      }
    }

    const coverage = matchedCount / titleTokens.length;
    if (coverage > 0.7) {
      // Content strongly discusses what the title promises
      divergence -= 0.15;
    } else if (coverage < 0.3) {
      // Title keywords are barely mentioned in the actual video
      divergence += 0.25;
    }
  }

  return Math.min(0.95, Math.max(0.05, Number(divergence.toFixed(2))));
}

/**
 * Calculates the Clickbait Divergence score (0.00 to 1.00).
 * Divergence > 0.65 indicates probable clickbait.
 */
export async function calculateClickbaitDivergence(
  title: string,
  description: string,
  transcriptText: string,
  apiKey?: string
): Promise<number> {
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (effectiveApiKey && transcriptText.trim().length > 100) {
    const titleEmbedding = await fetchGeminiEmbedding(title, effectiveApiKey);
    const bodyEmbedding = await fetchGeminiEmbedding(transcriptText.slice(0, 2048), effectiveApiKey);

    if (titleEmbedding && bodyEmbedding) {
      const similarity = calculateCosineSimilarity(titleEmbedding, bodyEmbedding);
      // Cosine distance = 1 - similarity
      const divergence = Math.max(0, 1 - similarity);
      return Math.min(0.95, Math.max(0.05, Number(divergence.toFixed(2))));
    }
  }

  // Fall back to rule-based heuristic divergence
  return calculateHeuristicDivergence(title, description, transcriptText);
}
