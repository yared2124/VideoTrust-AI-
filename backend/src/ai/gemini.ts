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

  // Curate up to 45 highest-signal comments (including timestamped and keyword warnings)
  const commentExcerpts = inputs.curatedComments
    .slice(0, 45)
    .map((c, i) => {
      const timeMatch = c.text.match(/\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/);
      const stamp = timeMatch ? ` [⏱️ ${timeMatch[0]}]` : '';
      return `[Comment ${i + 1}] (${c.likeCount} likes)${stamp}: "${c.text.replace(/[\r\n]+/g, ' ').slice(0, 200)}"`;
    })
    .join('\n');

  const transcriptPreview = inputs.transcriptText
    ? inputs.transcriptText.slice(0, 4000)
    : 'Transcript unavailable.';

  const totalCommentsNote = inputs.curatedComments.length > 0
    ? `${inputs.curatedComments.length} curated community comments (searched up to 2,000 maximum ceiling)`
    : 'No community comments available';

  const prompt = `
You are VideoTrust AI, a rigorous, truth-first integrity analyst evaluating YouTube videos before users invest their time.

YOUR OBJECTIVE:
Produce a 100% accurate, fact-grounded breakdown based STRICTLY on the video transcript, metadata, and real audience comments below.

CRITICAL RULES — READ CAREFULLY BEFORE GENERATING:

1. AUDIENCE RED FLAGS — SYNTHESIS ONLY (most important rule):
   - DO NOT quote or copy raw comment text verbatim. You are an analyst, not a copy-paste bot.
   - SYNTHESIZE findings: identify the actual underlying problem and write it as a short, informative warning sentence.
   - Only flag issues that MULTIPLE viewers reported, OR that are factually verified by the transcript.
   - IGNORE: comments that say a problem was already fixed, thank-you notes, off-topic questions, and isolated personal opinions.
   - IGNORE: any comment with 0 likes unless it specifically identifies a critical issue (broken link, dangerous advice, major error).
   - Each red flag MUST start with "⚠️ " and describe an ACTIONABLE issue (e.g. "⚠️ Some viewers report the Node.js version shown (v14) is outdated and breaks on newer setups").
   - If there are no real red flags, return an empty array [].
   - MAXIMUM 4 red flags. Quality over quantity.

2. ACCURACY & VERIFICATION:
   - Base your summary and takeaways strictly on what the video actually demonstrates.
   - Explicitly note if the video fails to deliver on its title promise.

3. KEY TAKEAWAYS:
   - Provide 3 to 5 concrete, verifiable takeaways explaining what viewers will learn.

VIDEO DETAILS:
- Title: "${inputs.metadata.title}"
- Channel: "${inputs.metadata.channelTitle}"
- Duration: ${Math.round(inputs.metadata.durationSeconds / 60)} minutes
- Views: ${inputs.metadata.views.toLocaleString()}
- Likes: ${inputs.metadata.likes.toLocaleString()}
- Comments Analyzed: ${totalCommentsNote}

TRANSCRIPT EXCERPT:
${transcriptPreview}

AUDIENCE COMMENTS (Sampled & Filtered — DO NOT quote these verbatim):
${commentExcerpts}

TASK:
Generate an objective, highly truthful analysis in JSON format with:
1. "summaryShort": A 40-to-60 word accurate summary of what this video teaches or demonstrates.
2. "keyTakeaways": An array of 3 to 5 concrete bullet points summarizing key verified concepts.
3. "audienceRedFlags": An array of 0 to 4 SYNTHESIZED warnings. Must start with "⚠️ ". Do NOT include quotes from comments. Return [] if there are no real issues.
4. "topAudiencePraise": An array of 1 to 3 SYNTHESIZED genuine positive highlights from the audience.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
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
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => typeof p?.text === 'string' && p.text.trim().length > 0);
    const jsonText = textPart?.text;

    if (!jsonText) {
      return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
    }

    const parsed = JSON.parse(jsonText) as VideoInsights;

    // Post-process red flags: strip any that are raw comment quotes or false positives
    const POSITIVE_PHRASES = [
      'thanks for', 'thank you', 'great video', 'awesome', 'love this',
      'fixed', "it's fixed", 'it is fixed', 'update:', 'problem solved',
      '!!! youtube came through', 'works now', 'solved', 'working now',
    ];
    const QUOTE_PATTERN = /^⚠️\s*".*"\s*(\(\d+ likes\))?$/;

    const filteredRedFlags = (Array.isArray(parsed.audienceRedFlags) ? parsed.audienceRedFlags : [])
      .filter((flag: string) => {
        const lower = flag.toLowerCase();
        // Remove flags that are raw comment quotes (starts with ⚠️ then a quote)
        if (QUOTE_PATTERN.test(flag.trim())) return false;
        // Remove flags that describe already-resolved or positive situations
        if (POSITIVE_PHRASES.some((phrase) => lower.includes(phrase))) return false;
        // Remove flags shorter than 20 chars (not actionable)
        if (flag.replace(/^⚠️\s*/, '').trim().length < 20) return false;
        return true;
      })
      .slice(0, 4);

    return {
      summaryShort: parsed.summaryShort || '',
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      audienceRedFlags: filteredRedFlags,
      topAudiencePraise: Array.isArray(parsed.topAudiencePraise) ? parsed.topAudiencePraise : [],
    };
  } catch {
    return generateHeuristicInsights(inputs.metadata, inputs.curatedComments);
  }
}
