# CLAUDE.md — VideoTrust AI Development Guide

> **Goal:** Consistency, reproducibility, and high engineering standards across all components of the VideoTrust AI project.

---

## 1. Project Overview
**VideoTrust AI** is an AI-powered Chrome Extension (Manifest V3) and Backend Intelligence Engine that analyzes YouTube videos before users watch them. It evaluates comment authenticity, detects bot rings, calculates title-to-transcript clickbait divergence, and generates explainable Trust Scores (0–100) with audience red-flag warnings.

---

## 2. Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Extension** | TypeScript, Chrome Extensions API (Manifest V3), Tailwind CSS, Vite |
| **Backend API** | Node.js / TypeScript, Fastify (or Express), `youtubei.js` (InnerTube), `zod` |
| **AI / NLP** | Google Gemini Flash API (Summaries/Warnings), Text Embeddings (Cosine Divergence) |
| **Database & Cache** | PostgreSQL / SQLite (with Prisma / Drizzle ORM), Redis (Cache-Aside pattern) |
| **Testing** | Vitest / Jest, Supertest, Playwright (for Extension E2E) |

---

## 3. Project Directory Structure

```text
videotrust-ai/
├── CLAUDE.md                     # Project governance and developer instructions
├── package.json                  # Monorepo / root workspace script orchestration
├── tsconfig.json                 # Base TypeScript configuration
├── shared/                       # Shared types, constants, and validation schemas
│   ├── src/
│   │   ├── types/                # VideoAnalysis, TrustScore, Comment, Verdict types
│   │   └── schemas/              # Zod validation schemas (contracts)
│   └── package.json
├── backend/                      # Core Intelligence API & Ingestion Service
│   ├── src/
│   │   ├── api/                  # Route handlers (/api/analyze, /api/video/:id)
│   │   ├── ingestion/            # InnerTube comment scraper & transcript fetcher
│   │   ├── filter/               # Tri-bucket sampler, bot-ring deduplicator, spam detector
│   │   ├── scorer/               # Pure mathematical trust scoring algorithm
│   │   ├── ai/                   # Gemini client, structured prompt templates, embeddings
│   │   ├── db/                   # Database client, schema, and migrations
│   │   └── index.ts              # Server bootstrap
│   ├── tests/                    # Unit, integration, and mock ingestion tests
│   └── tsconfig.json
└── extension/                    # Manifest V3 Chrome Extension
    ├── manifest.json             # Manifest V3 specification
    ├── src/
    │   ├── background/           # Service worker (tab listeners, API messaging)
    │   ├── content/              # Injected DOM script (badge injection, MutationObserver)
    │   ├── ui/                   # React/Tailwind sliding drawer and badge components
    │   └── utils/                # DOM helpers, URL parsers, storage utilities
    └── vite.config.ts            # Extension bundling config
```

---

## 4. Key Commands

### Setup & Installation
```bash
# Install all dependencies across workspaces
npm install

# Setup environment variables
cp .env.example .env
```

### Development
```bash
# Start backend API in watch/dev mode
npm run dev --workspace=backend

# Start extension in watch mode (outputs to /extension/dist)
npm run dev --workspace=extension
```

### Testing & Quality
```bash
# Run all unit tests
npm test

# Run backend unit tests specifically
npm run test --workspace=backend

# Run linter and type-checking
npm run lint
npm run type-check

# Format codebase
npm run format
```

### Build & Release
```bash
# Production build for both backend and extension
npm run build

# Load extension in Chrome:
# Navigate to chrome://extensions -> Enable Developer Mode -> "Load unpacked" -> Select videotrust-ai/extension/dist
```

---

## 5. Code Style & Conventions

### 5.1 TypeScript & Types
- **Strict Mode Enabled**: `"strict": true` is non-negotiable. Avoid `any`; use `unknown` with type guards if a type is truly uncertain.
- **Shared Data Contracts**: All data contracts between the Backend and Extension must live in `shared/src/types` and be validated with `zod`.
- **Explicit Return Types**: All public functions and API handlers must have explicit return type annotations.

### 5.2 Functional Purity & Architecture
- **Separation of Concerns**:
  - Ingestion does not calculate scores.
  - Scoring algorithms must be **pure functions** (given the same input metrics, they must always return the exact same score without side effects).
  - Database access is restricted to the data layer; never call queries directly inside scoring logic.
- **Error Handling**:
  - Never swallow errors with empty `catch {}` blocks.
  - Graceful degradation: If a transcript is unavailable, do NOT fail the request. Fall back to `transcriptAvailable: false` and calculate score from audience signals.
  - All API routes must return standard error envelopes: `{ success: false, error: { code: string, message: string } }`.

### 5.3 Naming Conventions
- `PascalCase` for Components, Classes, and Types/Interfaces (`TrustBadge`, `VideoAnalyzer`).
- `camelCase` for functions, methods, variables, and properties (`calculateTrustScore`, `isClickbait`).
- `UPPER_SNAKE_CASE` for global constants, configuration limits, and regexes (`MAX_COMMENT_SAMPLE`, `BOT_DETECTION_REGEX`).
- `kebab-case` for directory names and filenames (`video-analyzer.ts`, `trust-badge.tsx`).

---

## 6. Architectural Best Practices & Guardrails

1. **Zero Google API Quota Rule**:
   - Never use official YouTube Data API v3 endpoints that consume daily quota units for comment scraping.
   - Always route comment and metadata retrieval through `youtubei.js` (InnerTube).
2. **Performance SLA Guardrails**:
   - **Cached Requests**: Must respond in `< 150ms`.
   - **Cold Ingestion**: Raw scraping + heuristic filtering must complete in `< 2.5s`.
   - **Token Economy**: Never pass raw, unfiltered comments to an LLM. Always pre-filter through the Tri-Bucket sampler (reducing 1,000 raw comments $\rightarrow$ top 100 high-signal comments).
3. **Security & Extension Safety**:
   - Never inject unescaped HTML from YouTube comments into the DOM (mitigate XSS).
   - Never bundle API keys inside the extension frontend. All AI calls must go through the backend proxy.
   - Use `MutationObserver` cleanly with debounce to prevent CPU thrashing during rapid YouTube browsing.
