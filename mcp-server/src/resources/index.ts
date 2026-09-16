import { reportCache } from "../tools/index.js";

export function listResourceTemplates() {
  return [
    {
      uriTemplate: "videotrust://reports/{videoId}",
      name: "Video Trust Report",
      description: "Full JSON analysis report for a specific YouTube video",
      mimeType: "application/json",
    },
    {
      uriTemplate: "videotrust://cache/stats",
      name: "Cache & Ingestion Statistics",
      description: "Live telemetry on analyzed videos, cache hits, and spam metrics",
      mimeType: "application/json",
    }
  ];
}

export function readResourceByUri(uri: string) {
  if (uri === "videotrust://cache/stats") {
    const total = reportCache.size;
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              totalCachedVideos: total,
              cacheStatus: "ONLINE",
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const match = uri.match(/^videotrust:\/\/reports\/([a-zA-Z0-9_-]{11})$/);
  if (match) {
    const videoId = match[1];
    const report = reportCache.get(videoId);
    if (!report) {
      throw new Error(`Report for video '${videoId}' not found in cache. Run analyze_video first.`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }

  throw new Error(`Resource not found for URI: ${uri}`);
}
