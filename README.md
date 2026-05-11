# Hostify AI Agent

A polished AI project-builder starter app powered by **OpenRouter** and **Supabase**.

It includes:

- OpenRouter AI endpoint for generating and editing project files.
- File explorer + in-browser code editor.
- Live project preview for HTML/CSS/JS output.
- One-click zip export.
- Supabase Storage publishing endpoint.
- Supabase schema for saved projects and deployment records.
- A premium responsive homepage/interface.

## 1. Install

```bash
cd hostify-ai-agent
npm install
cp .env.example .env.local
```

## 2. Configure OpenRouter

Create an OpenRouter API key and put it in `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Hostify AI Agent
```

If no key is set, the app runs in demo mode and returns a local sample project.

## 3. Configure Supabase publishing

Create a Supabase project, then run:

```sql
-- Paste and run supabase/schema.sql in Supabase SQL Editor
```

Add your Supabase values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=hostify-projects
```

> Keep `SUPABASE_SERVICE_ROLE_KEY` private. It is used only in server routes.

## 4. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## 5. How it works

### AI file editing

`POST /api/agent` receives:

```json
{
  "prompt": "Build a SaaS landing page",
  "model": "anthropic/claude-3.5-sonnet",
  "files": {
    "index.html": "...",
    "style.css": "..."
  }
}
```

It asks OpenRouter to return structured JSON:

```json
{
  "reply": "I updated the landing page.",
  "files": [
    { "path": "index.html", "action": "update", "content": "..." }
  ],
  "nextSteps": ["Preview it", "Export zip"]
}
```

### Supabase publishing

`POST /api/publish` uploads each generated file and a zip archive to Supabase Storage, then inserts a row into `hostify_deployments`.

Supabase Storage is not a full replacement for Vercel/Netlify for dynamic apps, but it works well for publishing static generated HTML/CSS/JS projects and downloadable zip files. For advanced deployment, connect this starter to Vercel, Netlify, Cloudflare Pages, or a Docker runner and keep Supabase as the database/storage/auth layer.

## Suggested next upgrades

- Add Supabase Auth and user-owned projects.
- Add streaming AI responses.
- Add Monaco editor.
- Add terminal/container execution for frameworks.
- Add GitHub export.
- Add Vercel/Netlify deployment providers.
- Add tool-calling for file operations instead of JSON-only responses.
