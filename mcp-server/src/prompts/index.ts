export function listAvailablePrompts() {
  return [
    {
      name: "evaluate_tutorial",
      description: "Prompt the model to evaluate whether a specific YouTube tutorial is technically sound, up-to-date, or clickbait.",
      arguments: [
        {
          name: "url",
          description: "YouTube URL to evaluate",
          required: true,
        },
        {
          name: "skill_level",
          description: "Target audience skill level (beginner, intermediate, advanced)",
          required: false,
        },
      ],
    },
    {
      name: "compare_learning_resources",
      description: "Direct the model to inspect and rank multiple tutorial videos for a topic.",
      arguments: [
        {
          name: "topic",
          description: "The concept or framework being studied (e.g. Next.js 15, Docker Compose)",
          required: true,
        },
        {
          name: "urls",
          description: "Comma-separated list of YouTube URLs",
          required: true,
        },
      ],
    },
  ];
}

export function generatePromptMessages(name: string, args: Record<string, string | undefined>) {
  if (name === "evaluate_tutorial") {
    const url = args.url || "";
    const skillLevel = args.skill_level || "intermediate";

    return {
      description: `Evaluation instructions for ${url}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze this YouTube video using the VideoTrust AI tools:
URL: ${url}
Target audience skill level: ${skillLevel}

Step 1: Call the analyze_video tool to retrieve the Trust Score, Watch/Skip recommendation, and audience red flags.
Step 2: Synthesize the findings into an executive report with:
- Final Verdict: [WATCH / MAYBE / SKIP] with Confidence %
- Clickbait Divergence: Does the title promise match what is taught?
- Audience Warnings: Highlight any user complaints regarding outdated code or breaking versions.
- Key Technical Takeaways: 3 to 5 core concepts covered.`,
          },
        },
      ],
    };
  }

  if (name === "compare_learning_resources") {
    const topic = args.topic || "Technical Topic";
    const urls = args.urls || "";

    return {
      description: `Comparison guide for ${topic}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `We need to find the best YouTube tutorial for "${topic}".
Candidate URLs:
${urls}

Please use the compare_videos tool to evaluate these URLs and output:
1. Ranked order from #1 (Best) to Lowest Trust.
2. Direct comparison table (Trust Score, Authenticity, Freshness).
3. The definitive recommended video for a student/developer to watch first and why.`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt name: ${name}`);
}
