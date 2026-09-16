import { prisma, disconnectDatabase } from "./client.js";

async function main() {
  console.log("🌱 Seeding VideoTrust AI database with benchmark test fixtures...");

  // Clean existing seed data
  await prisma.userFeedback.deleteMany();
  await prisma.commentSample.deleteMany();
  await prisma.analysisReport.deleteMany();
  await prisma.video.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Demo User
  const demoUser = await prisma.user.create({
    data: {
      email: "engineer@videotrust.ai",
      name: "Senior Backend Candidate",
      plan: "PRO",
      apiKey: "vt_live_benchmark_key_999",
    },
  });

  // 2. Fixture 1: High-Trust Technical Masterclass (WATCH)
  const v1 = await prisma.video.create({
    data: {
      videoId: "dQw4w9WgXcQ",
      title: "Zero-Copy TCP Sockets & Network Primitives in Production",
      channel: "Distributed Systems Deep Dive",
      channelId: "UC_DIST_SYS_01",
      views: 420000,
      likes: 28500,
      likeRatio: 0.067,
      durationSeconds: 1420,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      publishedAt: new Date("2024-06-10T10:00:00Z"),
    },
  });

  await prisma.analysisReport.create({
    data: {
      videoId: v1.videoId,
      recommendation: "WATCH",
      confidence: 0.94,
      trustScore: 88,
      isClickbait: false,
      clickbaitDivergence: 0.12,
      authenticityScore: 92,
      sentimentScore: 86,
      integrityScore: 90,
      engagementScore: 84,
      summaryShort: "Exhaustive deep dive into Linux epoll, kernel buffer transitions, and non-blocking TCP socket implementation.",
      keyTakeaways: JSON.stringify([
        "Visualizes socket buffer allocation in kernel memory",
        "Demonstrates epoll level-triggered vs edge-triggered tradeoffs",
        "Includes production Go benchmarks showing 250k RPS",
        "Provides reproducible GitHub repository with docker-compose"
      ]),
      audienceRedFlags: JSON.stringify([]),
      topAudiencePraise: JSON.stringify([
        "Best visual explanation of TCP window sizing on YouTube",
        "Clear packet diagrams saved me during my senior infra interview"
      ]),
      commentsSampled: 950,
      spamDetected: 28,
      transcriptAvailable: true,
    },
  });

  await prisma.commentSample.createMany({
    data: [
      {
        videoId: v1.videoId,
        author: "@kernel_enthusiast",
        commentText: "The explanation of SO_REUSEPORT and epoll kernel queues at 12:40 is something you rarely see outside of Linux man pages.",
        likes: 420,
        isPinned: false,
        isSpam: false,
        bucketType: "LONGFORM",
      },
      {
        videoId: v1.videoId,
        author: "@gopher_dan",
        commentText: "Tested the benchmark on Ubuntu 24.04 and hit 210k connections easily.",
        likes: 180,
        isPinned: false,
        isSpam: false,
        bucketType: "RECENT",
      },
    ],
  });

  // 3. Fixture 2: Mixed / Caution Tutorial with Outdated Syntax (MAYBE)
  const v2 = await prisma.video.create({
    data: {
      videoId: "abc123nodeX",
      title: "Full-Stack Node.js & Next.js 13 API Framework",
      channel: "CodeRush",
      channelId: "UC_CODERUSH_02",
      views: 180000,
      likes: 6400,
      likeRatio: 0.035,
      durationSeconds: 960,
      publishedAt: new Date("2023-04-12T14:30:00Z"),
    },
  });

  await prisma.analysisReport.create({
    data: {
      videoId: v2.videoId,
      recommendation: "MAYBE",
      confidence: 0.82,
      trustScore: 61,
      isClickbait: false,
      clickbaitDivergence: 0.35,
      authenticityScore: 64,
      sentimentScore: 58,
      integrityScore: 60,
      engagementScore: 62,
      summaryShort: "Decent architectural setup, but contains outdated Next.js 13 App Router patterns that break in modern Next.js 15.",
      keyTakeaways: JSON.stringify([
        "Shows REST API routing with Express and Next.js",
        "Configures JWT authentication in middleware",
        "Uses deprecated route segment config options"
      ]),
      audienceRedFlags: JSON.stringify([
        "⚠️ 24 users confirm route handlers fail on Next.js 14+",
        "⚠️ Package.json dependencies have known vulnerability warnings"
      ]),
      topAudiencePraise: JSON.stringify([
        "Good folder structure setup for beginners"
      ]),
      commentsSampled: 620,
      spamDetected: 85,
      transcriptAvailable: true,
    },
  });

  // 4. Fixture 3: Clickbait / Low Trust Video (SKIP)
  const v3 = await prisma.video.create({
    data: {
      videoId: "xyz999scam0",
      title: "Build & Deploy a $10,000/mo AI Micro-SaaS in 8 MINUTES! (No Coding)",
      channel: "HustleGuru",
      channelId: "UC_HUSTLE_99",
      views: 540000,
      likes: 9200,
      likeRatio: 0.017,
      durationSeconds: 512,
      publishedAt: new Date("2024-08-01T08:00:00Z"),
    },
  });

  await prisma.analysisReport.create({
    data: {
      videoId: v3.videoId,
      recommendation: "SKIP",
      confidence: 0.96,
      trustScore: 32,
      isClickbait: true,
      clickbaitDivergence: 0.84,
      authenticityScore: 24,
      sentimentScore: 35,
      integrityScore: 28,
      engagementScore: 41,
      summaryShort: "High clickbait divergence: Video title promises a production SaaS in 8 minutes, but content is an affiliate funnel for a $497 course.",
      keyTakeaways: JSON.stringify([
        "Spends 4 minutes reviewing generic landing page templates",
        "Never deploys a backend or writes authentication logic",
        "Pushes paid masterclass affiliate link from minute 5:00 onwards"
      ]),
      audienceRedFlags: JSON.stringify([
        "⚠️ 68% of comments match identical bot-ring praise patterns",
        "⚠️ Multiple users report the promised GitHub repo requires payment",
        "⚠️ Title claims 'No Coding' but video requires paid API credits"
      ]),
      topAudiencePraise: JSON.stringify([]),
      commentsSampled: 820,
      spamDetected: 340,
      transcriptAvailable: true,
    },
  });

  // Seed sample feedback
  await prisma.userFeedback.create({
    data: {
      videoId: v1.videoId,
      userId: demoUser.id,
      isHelpful: true,
      agreedWithVerdict: true,
      userNotes: "Spot on! The video is one of the highest quality TCP breakdowns available.",
    },
  });

  console.log("✅ Database successfully seeded with 3 benchmark test fixtures!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });
