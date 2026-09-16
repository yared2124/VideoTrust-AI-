# Ultra Plan: VideoTrust AI (MVP to Production Roadmap)

**Goal:** Provide unequivocal direction, engineering milestones, step-by-step deliverables, and acceptance criteria to take VideoTrust AI from empty directory to a battle-tested, production Chrome Extension and API.

---

## High-Level Milestone Timeline

```
[ Phase 0: Foundations ] ──> [ Phase 1: Ingestion & Filter ] ──> [ Phase 2: Trust & AI Engine ]
       (Days 1 - 3)                    (Days 4 - 7)                       (Days 8 - 11)
                                                                                 │
                                                                                 ▼
[ Production Release ] <── [ Phase 4: Chrome Extension ] <── [ Phase 3: Backend & Cache ]
      (Days 22 - 25)                  (Days 16 - 21)                     (Days 12 - 15)
```

---

## Phase 0: Foundations & Monorepo Architecture (Days 1–3)
**Milestone:** Monorepo scaffolding, strict TypeScript configs, and shared data contracts established.

### Tasks:
- [ ] **T0.1 Monorepo Workspace Setup**: Initialize root `package.json` with npm/pnpm workspaces: `shared`, `backend`, `extension`.
- [ ] **T0.2 Shared Contracts (`shared/src/types/`)**:
  - `VideoMetadata`: title, channel, views, likes, publishedAt, duration.
  - `CommentItem`: id, author, text, likes, timestamp, isPinned.
  - `TrustScore`: overall (0–100), authenticity, sentiment, integrity, engagement.
  - `Verdict`: recommendation (`WATCH` | `MAYBE` | `SKIP`), confidence, isClickbait, divergenceScore.
  - `AnalysisReport`: full aggregated schema linking metadata, verdict, scores, takeaways, and red flags.
- [ ] **T0.3 Zod Validation Schemas (`shared/src/schemas/`)**: Strict runtime validation schemas ensuring backend and extension never transmit malformed data.
- [ ] **T0.4 Tooling & Linters**: Set up ESLint, Prettier, Vitest, and TypeScript strict mode configurations.

**Deliverable:** Compiling monorepo where `shared` types can be imported by both `backend` and `extension` with 100% type safety.

---

## Phase 1: Ingestion & Comment Reduction Pipeline (Days 4–7)
**Milestone:** 1,000 comments and transcript extracted in $<2.5$s with zero API quota consumption.

### Tasks:
- [ ] **T1.1 InnerTube Ingestion Service (`backend/src/ingestion/innertube.ts`)**:
  - Initialize `youtubei.js` wrapper.
  - Extract video metadata (views, likes, channel metrics).
  - Implement continuation token cursor loop to page through 500–1,000 comments.
- [ ] **T1.2 Transcript Extractor (`backend/src/ingestion/transcript.ts`)**:
  - Fetch official closed captions or auto-generated English subtitles.
  - Implement timestamped segment chunking.
  - Build non-blocking fallback for missing transcripts (flagging `transcriptAvailable: false`).
- [ ] **T1.3 Bot Ring & Spam Detector (`backend/src/filter/spam-detector.ts`)**:
  - Exact & fuzzy hash deduplication (MD5/SimHash) to catch bot rings copy-pasting identical praise.
  - Regex patterns for WhatsApp financial scams, Telegram handles, and promotion links.
  - Emoji density calculator (flags comments with $>40\%$ emojis).
- [ ] **T1.4 Tri-Bucket Sampler (`backend/src/filter/tri-bucket.ts`)**:
  - Bucket 1 (40%): Top upvoted comments (community consensus).
  - Bucket 2 (40%): Most recent comments (detects if video/code became outdated recently).
  - Bucket 3 (20%): Long-form comments ($>150$ characters with technical depth).
  - Keyword booster: prioritizes comments matching `deprecated`, `broken`, `error`, `scam`, `outdated`, `saved my`.

**Deliverable:** An automated pipeline that ingests 1,000 raw comments and outputs ~120 curated, high-signal comments in $<1.5$s.

---

## Phase 2: Semantic Clickbait & Trust Scoring Engine (Days 8–11)
**Milestone:** Pure mathematical Trust Score and AI-synthesized Red-Flag warnings generated with sub-3-second inference.

### Tasks:
- [ ] **T2.1 Semantic Clickbait Divergence (`backend/src/scorer/clickbait.ts`)**:
  - Convert Video Title + Description into a semantic vector embedding.
  - Convert the first 5 minutes & key transcript segments into vector embeddings.
  - Compute Cosine Similarity distance. If divergence $>65\%$, trigger `isClickbait = true`.
- [ ] **T2.2 Deterministic Trust Score Calculator (`backend/src/scorer/trust-calculator.ts`)**:
  - Implement weighted formula:
    $$Trust = 0.30 \times Authenticity + 0.25 \times Sentiment + 0.25 \times Integrity + 0.20 \times Engagement$$
  - Pure function: zero external dependencies, 100% testable via unit tests.
- [ ] **T2.3 Structured AI Synthesis (`backend/src/ai/gemini-synthesizer.ts`)**:
  - Prompt Google Gemini 1.5/2.0 Flash using JSON schema output mode.
  - Generate:
    - 50-word TL;DR.
    - 5 bullet-point technical takeaways.
    - Audience Red Flags (e.g., *"⚠️ 14 users warn Node 20 breaks syntax"*).
    - Top Audience Praise (e.g., *"✅ Best explanation of Docker Compose"*).

**Deliverable:** A complete Trust & Insights report generated from raw inputs, validated against Zod schemas.

---

## Phase 3: Backend API & Caching Layer (Days 12–15)
**Milestone:** Fastify/Express API with Cache-Aside pattern delivering cached reports in $<100$ms.

### Tasks:
- [ ] **T3.1 Database Schema (`backend/src/db/`)**:
  - SQLite (for dev) & PostgreSQL (for prod) using Prisma or Drizzle ORM.
  - Tables: `videos`, `analysis_reports`, `comment_samples`, `user_feedback`.
- [ ] **T3.2 Cache-Aside Layer (`backend/src/cache/`)**:
  - Check in-memory / Redis cache by `videoId`.
  - Cache Hit: return analysis in $<50$ms.
  - Cache Miss: run Phase 1 + Phase 2 pipelines, write to database, and return.
- [ ] **T3.3 REST API Endpoints (`backend/src/api/`)**:
  - `POST /api/analyze`: Takes `{ url: string }` or `{ videoId: string }`, returns `AnalysisReport`.
  - `GET /api/video/:id`: Retrieves cached report.
  - `POST /api/feedback`: Records user rating on accuracy (agree/disagree with recommendation).
- [ ] **T3.4 Rate Limiting & Error Boundaries**:
  - Global rate limiting (e.g. 30 requests/min per IP).
  - Standardized JSON error envelopes `{ success: false, error: { code, message } }`.

**Deliverable:** Fully functional backend server passing automated integration tests with benchmarked $<100$ms cached latency.

---

## Phase 4: Chrome Extension (Manifest V3) (Days 16–21)
**Milestone:** Native-feeling YouTube injection with in-page trust badge and sliding analysis drawer.

### Tasks:
- [ ] **T4.1 Manifest V3 Configuration (`extension/manifest.json`)**:
  - Configure permissions (`storage`, `activeTab`, host permissions for `youtube.com/*`).
  - Set up background service worker and content script registration.
- [ ] **T4.2 YouTube SPA Observer (`extension/src/content/observer.ts`)**:
  - Listen for YouTube SPA events (`yt-navigate-finish`).
  - Attach a debounced `MutationObserver` on `#above-the-fold` / title container.
  - Prevent duplicate badge injections.
- [ ] **T4.3 In-Page Trust Badge Component (`extension/src/ui/TrustBadge.tsx`)**:
  - Render compact pill badge: 🟢 **88% Trust** | 🟡 **64% Check Notes** | 🔴 **31% Clickbait**.
  - Micro-animations on hover with tooltip preview.
- [ ] **T4.4 Sliding Analysis Drawer (`extension/src/ui/Drawer.tsx`)**:
  - Tailwind CSS glassmorphic panel sliding in from the right edge.
  - Sections:
    - **Header**: Watch/Skip Verdict, Confidence score.
    - **Tab 1 (Summary)**: 50-word overview + 5 key takeaways.
    - **Tab 2 (Audience Truth)**: Red-flag warnings vs. top praise.
    - **Tab 3 (Score Breakdown)**: Radar or bar charts for Authenticity, Sentiment, Integrity, Engagement.
- [ ] **T4.5 Extension Storage & Offline Cache**: Cache viewed video results in `chrome.storage.local` to avoid redundant network calls during back-button navigation.

**Deliverable:** Working Chrome Extension that auto-detects YouTube videos, renders the badge, and opens the detailed drawer.

---

## Phase 5: Production Hardening, Security & Launch (Days 22–25)
**Milestone:** Hardened code, E2E test suite, Docker deployment, and Chrome Web Store submission package.

### Tasks:
- [ ] **T5.1 Security & Sanitization**:
  - DOMPurify on all YouTube comments to prevent stored XSS.
  - CORS policies locked down to extension origin and authorized domains.
  - Secure `.env` handling (zero API keys bundled into extension build).
- [ ] **T5.2 End-to-End Testing**:
  - Vitest unit tests for scoring math, spam filtering, and Zod schemas ($>85\%$ coverage).
  - Playwright test verifying extension injection on live YouTube URLs.
- [ ] **T5.3 Docker & Cloud Deployment**:
  - Multi-stage `Dockerfile` for backend API.
  - GitHub Actions CI/CD for automated linting, testing, and Docker build.
- [ ] **T5.4 Chrome Web Store Submission**:
  - Generate promotional tiles, icon assets (16x16, 48x48, 128x128).
  - Privacy policy and Manifest V3 security compliance review.

**Deliverable:** Deployed backend API and `.zip` build artifact ready for Chrome Web Store review.

---

## Phase 6: Post-Launch Growth & Advanced Features (v1.1+)
- **Search Result Badges**: Show trust scores directly on YouTube search cards before clicking.
- **Side-by-Side Video Comparison**: Compare 3 tutorials for the same topic to pick the best.
- **"Ask Video" AI Chat**: Ask questions answered by the video's transcript directly in the extension.
