# VideoTrust AI 🎬🔍

Analyzes any YouTube video and tells you whether it's worth watching — detecting clickbait, spam comments, and misleading content in real time via a Chrome extension.

---

## What It Does

When you open a YouTube video, the extension automatically:
- Fetches comments, transcript, and metadata
- Runs them through a spam/bot filter pipeline
- Scores the video on **Authenticity**, **Sentiment**, **Integrity**, and **Engagement**
- Shows a trust badge: **Watch It**, **Maybe**, or **Skip**

---

## Requirements

Before you start, make sure you have these installed:

| Tool | Version | Download |
|------|---------|----------|
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop |
| **Git** | Any | https://git-scm.com |
| **Google Chrome** | Any | https://www.google.com/chrome |

> **No Node.js or Python needed.** Docker handles everything.

---

## Setup (5 Steps)

### 1. Clone the repository

```bash
git clone https://github.com/yared2124/VideoTrust-AI-.git
cd VideoTrust-AI-
```

### 2. Create your environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your Gemini API key (optional but recommended for better analysis):

```env
GEMINI_API_KEY="your_key_here"
```

> Get a free key at: https://aistudio.google.com/app/apikey

### 3. Start the backend

```bash
docker compose up -d
```

This starts three services:
- `videotrust-api` → the analysis engine on **port 4000**
- `videotrust-db` → PostgreSQL database on **port 5432**
- `videotrust-redis` → Redis cache on **port 6379**

Wait about 10 seconds, then verify everything is running:

```bash
docker compose ps
```

You should see all three containers with `running` / `healthy` status.

### 4. Run the schema migration (first time only)

```bash
docker compose exec videotrust-api npx prisma db push
```

You should see: `The database is already in sync with the Prisma schema.`

### 5. Load the Chrome extension

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `extension/dist/` folder inside the project

The VideoTrust AI icon will appear in your Chrome toolbar.

---

## Using the App

1. Go to **YouTube** and open any video
2. The trust badge appears automatically next to the Subscribe button
3. Click the badge to open the full analysis drawer

### Verdict meanings

| Badge | Trust Score | Meaning |
|-------|------------|---------|
| ✅ **Watch It** | 70–100 | Trustworthy content, authentic community |
| ⚠️ **Maybe** | 45–69 | Mixed signals — use your judgment |
| ❌ **Skip** | 0–44 | Clickbait, spam-heavy, or misleading |

---

## Stopping the App

```bash
docker compose down
```

To also delete all saved data (database + cache):

```bash
docker compose down -v
```

---

## Updating to the Latest Version

```bash
git pull
docker compose build videotrust-api
docker compose up -d
docker compose exec videotrust-api npx prisma db push
```

---

## Troubleshooting

### Extension shows no badge
- Make sure `docker compose ps` shows all 3 containers running
- Check the API is reachable: open http://localhost:4000/health in your browser
- Reload the YouTube page after starting Docker

### API returns 500 errors
- Check logs: `docker compose logs videotrust-api --tail=50`
- Most common cause: YouTube network access blocked inside Docker (VPN or firewall)

### Badge always shows "Watch It"
- Add your `GEMINI_API_KEY` in `backend/.env` for more accurate clickbait detection
- Restart: `docker compose up -d`

### Port already in use
Edit `docker-compose.yml` and change the left side of the port mapping:
```yaml
ports:
  - "4001:4000"   # change 4000 to 4001 if port 4000 is busy
```

---

## Project Structure

```
VideoTrust-AI/
├── backend/               # Fastify API — scoring, caching, ingestion
│   ├── src/
│   │   ├── server.ts      # API routes
│   │   ├── scorer/        # Trust score calculator
│   │   ├── ingestion/     # YouTube data fetcher
│   │   ├── filter/        # Spam and bot filter pipeline
│   │   ├── cache/         # Redis cache layer
│   │   └── db/            # PostgreSQL via Prisma
│   └── Dockerfile
├── extension/             # Chrome extension (React + TypeScript)
│   ├── src/
│   │   ├── content/       # YouTube page injection
│   │   └── ui/            # Trust badge + analysis drawer
│   └── dist/              # Pre-built — load this folder in Chrome
├── mcp-server/            # MCP server for AI assistant integration
└── docker-compose.yml
```

---

## Tech Stack

- **Backend**: Node.js, Fastify, TypeScript, Prisma
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **AI**: Google Gemini (embeddings + synthesis)
- **Extension**: React, TypeScript, Vite
- **Infrastructure**: Docker Compose

---

## License

MIT
