#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { AuthGuard } from "./auth.js";
import { extractVideoId } from "./types.js";
import {
  analyzeVideoSchema,
  getVideoReportSchema,
  checkClickbaitSchema,
  compareVideosSchema,
  performAnalysis,
  reportCache,
} from "./tools/index.js";
import { listResourceTemplates, readResourceByUri } from "./resources/index.js";
import { listAvailablePrompts, generatePromptMessages } from "./prompts/index.js";

const server = new Server(
  {
    name: "videotrust-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {
        listTemplates: true,
      },
      prompts: {},
    },
  }
);

const authGuard = new AuthGuard();

/**
 * 1. Tools Handler: List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_video",
        description: "Analyze any YouTube video URL or ID to calculate Trust Score (0-100), Watch/Skip verdict, clickbait divergence, and audience red flags.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The YouTube video URL (or 11-char ID)",
            },
            force_refresh: {
              type: "boolean",
              description: "Whether to bypass cached results and re-scrape comments live",
              default: false,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "get_video_report",
        description: "Retrieve a cached trust report for a previously analyzed video by 11-character video ID.",
        inputSchema: {
          type: "object",
          properties: {
            video_id: {
              type: "string",
              description: "11-character YouTube video ID",
            },
          },
          required: ["video_id"],
        },
      },
      {
        name: "check_clickbait",
        description: "Assess semantic clickbait divergence between the video title and transcript content.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "YouTube URL to check for clickbait",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "compare_videos",
        description: "Compare and rank 2 to 5 YouTube tutorial URLs by trust score, community consensus, and recency.",
        inputSchema: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: { type: "string" },
              description: "List of 2 to 5 YouTube video URLs to compare",
            },
          },
          required: ["urls"],
        },
      },
    ],
  };
});

/**
 * 2. Tools Handler: Execute tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "analyze_video": {
        const parsed = analyzeVideoSchema.parse(args);
        const videoId = extractVideoId(parsed.url);
        if (!videoId) {
          throw new McpError(ErrorCode.InvalidParams, `Could not parse valid 11-char YouTube ID from: ${parsed.url}`);
        }

        const report = await performAnalysis(videoId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case "get_video_report": {
        const parsed = getVideoReportSchema.parse(args);
        const report = reportCache.get(parsed.video_id);
        if (!report) {
          throw new McpError(ErrorCode.InvalidRequest, `No cached report found for video ID: ${parsed.video_id}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      }

      case "check_clickbait": {
        const parsed = checkClickbaitSchema.parse(args);
        const videoId = extractVideoId(parsed.url);
        if (!videoId) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid YouTube URL: ${parsed.url}`);
        }

        const report = await performAnalysis(videoId);
        const clickbaitVerdict = {
          videoId,
          title: report.metadata.title,
          isClickbait: report.verdict.isClickbait,
          clickbaitDivergence: report.verdict.clickbaitDivergence,
          summary: report.verdict.isClickbait
            ? `High divergence (${Math.round(report.verdict.clickbaitDivergence * 100)}%): Video promises more than content delivers.`
            : `Low divergence (${Math.round(report.verdict.clickbaitDivergence * 100)}%): Content matches title promises.`,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(clickbaitVerdict, null, 2),
            },
          ],
        };
      }

      case "compare_videos": {
        const parsed = compareVideosSchema.parse(args);
        const reports = [];

        for (const url of parsed.urls) {
          const videoId = extractVideoId(url);
          if (videoId) {
            const report = await performAnalysis(videoId);
            reports.push({
              url,
              videoId,
              title: report.metadata.title,
              trustScore: report.verdict.trustScore,
              recommendation: report.verdict.recommendation,
              authenticity: report.scoreBreakdown.authenticity,
              redFlagCount: report.insights.audienceRedFlags.length,
            });
          }
        }

        // Rank by trust score descending
        reports.sort((a, b) => b.trustScore - a.trustScore);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  rankedResults: reports,
                  topPick: reports[0] || null,
                  comparisonNotes: `Evaluated ${reports.length} videos. Top pick has trust score of ${reports[0]?.trustScore ?? 0}/100.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err: any) {
    if (err instanceof McpError) {
      throw err;
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${err?.message || String(err)}`);
  }
});

/**
 * 3. Resources Handlers: List templates and Read resource
 */
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: listResourceTemplates(),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    return readResourceByUri(request.params.uri);
  } catch (err: any) {
    throw new McpError(ErrorCode.InvalidRequest, err.message);
  }
});

/**
 * 4. Prompts Handlers: List prompts and Get prompt
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: listAvailablePrompts(),
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  try {
    return generatePromptMessages(request.params.name, request.params.arguments || {});
  } catch (err: any) {
    throw new McpError(ErrorCode.InvalidParams, err.message);
  }
});

/**
 * Server Startup (stdio transport)
 */
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log status to stderr so stdio JSON-RPC remains clean
  console.error("VideoTrust AI MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
