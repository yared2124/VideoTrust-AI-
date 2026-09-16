# VideoTrust AI MCP Server

Model Context Protocol (MCP) server for **VideoTrust AI**. Integrates directly with Claude Desktop, Antigravity IDE, Cursor, and other MCP clients to evaluate YouTube tutorials, verify authenticity, and detect clickbait natively.

---

## Capabilities

### Tools
1. **`analyze_video`**: Evaluates a YouTube URL or video ID. Returns Trust Score (0-100), Watch/Skip recommendation, clickbait divergence, and audience red flags.
2. **`get_video_report`**: Fast cached report lookup by 11-character YouTube video ID.
3. **`check_clickbait`**: Evaluates semantic divergence between video title and transcript content.
4. **`compare_videos`**: Compares 2 to 5 YouTube URLs and outputs a ranked evaluation table.

### Resources
- **`videotrust://reports/{video_id}`**: Direct JSON resource for full analysis reports.
- **`videotrust://cache/stats`**: In-memory / cache telemetry metrics.

### Prompts
- **`evaluate_tutorial`**: Guided evaluation prompt analyzing video reliability for a student or developer.
- **`compare_learning_resources`**: Directs the LLM to inspect multiple video candidates and recommend the best starting point.

---

## Setup & Installation

```bash
cd /home/yared2124/.gemini/antigravity-ide/scratch/videotrust-ai/mcp-server
npm install
npm run build
```

---

## Client Integration

### 1. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "videotrust": {
      "command": "node",
      "args": ["/home/yared2124/.gemini/antigravity-ide/scratch/videotrust-ai/mcp-server/dist/index.js"],
      "env": {
        "VIDEOTRUST_API_KEY": "optional_secret_key"
      }
    }
  }
}
```

### 2. Antigravity IDE MCP Config
Add to your `mcp_config.json`:
```json
{
  "mcpServers": {
    "videotrust": {
      "command": "node",
      "args": ["/home/yared2124/.gemini/antigravity-ide/scratch/videotrust-ai/mcp-server/dist/index.js"]
    }
  }
}
```
