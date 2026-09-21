import type { RawVideoMetadata } from '../ingestion/types.js';
import type { CuratedComment } from '../filter/types.js';
import type { VideoInsights } from '../scorer/types.js';

export interface SynthesisInputs {
  metadata: RawVideoMetadata;
  transcriptText: string;
  curatedComments: CuratedComment[];
  apiKey?: string;
}

/**
 * Heuristic fallback generator when Gemini API is offline or unconfigured.
 */
export function generateHeuristicInsights(
  metadata: RawVideoMetadata,
  curatedComments: CuratedComment[]
): VideoInsights {
  const redFlags: string[] = [];
  const praise: string[] = [];

  for (const c of curatedComments) {
    const text = c.text.replace(/[\r\n]+/g, ' ').trim();
    const timeMatch = text.match(/\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/);
    const timePrefix = timeMatch ? `[⏱️ ${timeMatch[0]}] ` : '';

    if (c.matchedKeywords.length > 0 && redFlags.length < 4) {
      redFlags.push(`⚠️ ${timePrefix}"${text.slice(0, 130).trim()}..." (${c.likeCount} likes)`);
    } else if (c.likeCount >= 3 && praise.length < 3) {
      praise.push(`${timePrefix}"${text.slice(0, 130).trim()}..." (${c.likeCount} likes)`);
    }
  }

  if (redFlags.length === 0) {
    redFlags.push('⚠️ No severe community warnings detected in sampled comments.');
  }

  if (praise.length === 0) {
    praise.push('Community acknowledges the content as informative.');
  }

  // Key takeaways derived from video title and description
  const takeaways = [
    `Explains "${metadata.title}" by ${metadata.channelTitle}`,
    `Duration: ${Math.round(metadata.durationSeconds / 60)} minutes • Views: ${metadata.views.toLocaleString()} • Likes: ${metadata.likes.toLocaleString()}`,
    `Analyzed across ${curatedComments.length}+ filtered community comments`,
  ];

  return {
    summaryShort: `${metadata.title} by ${metadata.channelTitle}. Analysis synthesized from ${curatedComments.length} high-signal community reviews, like-to-view ratios, and engagement depth.`,
    keyTakeaways: takeaways,
    audienceRedFlags: redFlags,
    topAudiencePraise: praise,
  };
}

/**
 * Synthesizes video insights using Google Gemini Flash API with structured JSON output.
 */
export async function synthesizeInsights(inputs: SynthesisInputs): Promise<VideoInsights> {
  const apiKey = inputs.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
  }

  const commentExcerpts = inputs.curatedComments
    .slice(0, 20)
    .map((c, i) => `[Comment ${i + 1}] (${c.likeCount} likes): "${c.text.slice(0, 160)}"`)
    .join('\n');

  const transcriptPreview = inputs.transcriptText
    ? inputs.transcriptText.slice(0, 3000)
    : 'Transcript unavailable.';

  const prompt = `
You are VideoTrust AI, an objective analyzer evaluating YouTube tutorials and videos before users watch them.

VIDEO DETAILS:
- Title: "${inputs.metadata.title}"
- Channel: "${inputs.metadata.channelTitle}"
- Duration: ${Math.round(inputs.metadata.durationSeconds / 60)} minutes
- Views: ${inputs.metadata.views}
- Likes: ${inputs.metadata.likes}

TRANSCRIPT EXCERPT:
${transcriptPreview}

AUDIENCE COMMENTS (Sampled & Filtered):
${commentExcerpts}

TASK:
Generate an objective, highly truthful analysis in JSON format with:
1. "summaryShort": A 40-to-60 word concise summary of what this video actually teaches or demonstrates.
2. "keyTakeaways": An array of 3 to 5 clear, concrete bullet points summarizing key concepts or claims.
3. "audienceRedFlags": An array of 1 to 4 specific audience warnings or issues (e.g. outdated syntax, broken repo links, missing prerequisites). Each bullet MUST start with the "⚠️ " emoji.
4. "topAudiencePraise": An array of 1 to 3 genuine positive highlights cited by the audience.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              summaryShort: { type: 'STRING' },
              keyTakeaways: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              audienceRedFlags: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
              topAudiencePraise: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['summaryShort', 'keyTakeaways', 'audienceRedFlags', 'topAudiencePraise'],
          },
        },
      }),
    });

    if (!response.ok) {
      return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
    }

    const data = (await response.json()) as any;
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
    }

    const parsed = JSON.parse(jsonText) as VideoInsights;
    return {
      summaryShort: parsed.summaryShort || '',
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      audienceRedFlags: Array.isArray(parsed.audienceRedFlags) ? parsed.audienceRedFlags : [],
      topAudiencePraise: Array.isArray(parsed.topAudiencePraise) ? parsed.topAudiencePraise : [],
    };
  } catch {
    return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
  }
}
