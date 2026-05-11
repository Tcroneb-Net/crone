import { NextRequest, NextResponse } from "next/server";
import type { AgentResponse, FileAction, ProjectFile } from "../../../lib/types";
import { sanitizePath } from "../../../lib/paths";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  model?: string;
  files?: Record<string, string>;
};

const FALLBACK_RESPONSE: AgentResponse = {
  reply: "Demo mode: OPENROUTER_API_KEY is not configured, so I generated a polished sample landing page locally. Add your key to .env.local to enable real AI generation.",
  files: [
    {
      path: "index.html",
      action: "update",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hostify Demo</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <nav><strong>Hostify</strong><a>Features</a><a>Deploy</a><a>Pricing</a></nav>
  <section class="hero">
    <p class="tag">AI-generated demo</p>
    <h1>Ship beautiful web projects with an AI agent.</h1>
    <p>Generate files, preview instantly, export zip archives, and publish to Supabase storage.</p>
    <button>Launch project</button>
  </section>
  <section class="cards">
    <article><h2>Generate</h2><p>Create complete HTML/CSS/JS projects from a prompt.</p></article>
    <article><h2>Preview</h2><p>See every change live before you download or publish.</p></article>
    <article><h2>Deploy</h2><p>Store project files and deployments in Supabase.</p></article>
  </section>
</body>
</html>`
    },
    {
      path: "style.css",
      action: "update",
      content: `body{margin:0;font-family:Inter,system-ui,sans-serif;color:#fff;background:#070814}nav{display:flex;gap:24px;align-items:center;justify-content:center;padding:24px;border-bottom:1px solid rgba(255,255,255,.12)}nav strong{margin-right:auto;padding-left:28px}.hero{text-align:center;padding:110px 24px;background:radial-gradient(circle at 50% 0,#8b5cf655,transparent 38rem)}.tag{color:#67e8f9;text-transform:uppercase;letter-spacing:.2em}h1{font-size:clamp(42px,8vw,90px);line-height:.9;letter-spacing:-.07em;max-width:980px;margin:16px auto}p{color:#cbd5ff;font-size:18px;line-height:1.7}button{border:0;border-radius:999px;padding:15px 22px;color:#fff;font-weight:900;background:linear-gradient(135deg,#8b5cf6,#22d3ee)}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:24px;max-width:1100px;margin:auto}article{border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:24px;background:rgba(255,255,255,.07)}@media(max-width:800px){.cards{grid-template-columns:1fr}}`
    }
  ],
  nextSteps: ["Create .env.local from .env.example", "Add OPENROUTER_API_KEY", "Run npm run dev"]
};

function toProjectFiles(files: Record<string, string> = {}): ProjectFile[] {
  return Object.entries(files)
    .map(([path, content]) => ({ path: sanitizePath(path), content: String(content ?? "") }))
    .filter((file) => file.path)
    .slice(0, 40);
}

function extractJson(text: string): AgentResponse {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/({[\s\S]*})/);
    if (match?.[1]) return JSON.parse(match[1]);
    throw new Error("The model did not return valid JSON.");
  }
}

function normalizeAgentResponse(response: AgentResponse): AgentResponse {
  return {
    reply: String(response.reply || "Done."),
    files: Array.isArray(response.files)
      ? response.files
          .map((file): FileAction => {
            const action: FileAction["action"] = file.action === "delete" ? "delete" : file.action === "create" ? "create" : "update";
            return {
              path: sanitizePath(String(file.path || "")),
              content: action === "delete" ? undefined : String(file.content ?? ""),
              action
            };
          })
          .filter((file) => file.path)
      : [],
    nextSteps: Array.isArray(response.nextSteps) ? response.nextSteps.map(String).slice(0, 6) : []
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json(FALLBACK_RESPONSE);

  const currentFiles = toProjectFiles(body.files);
  const system = `You are Hostify AI Agent, a senior product engineer and AI coding agent.
You generate and edit small web projects for users.
Return ONLY valid JSON matching this TypeScript type:
{
  "reply": string,
  "files": [{ "path": string, "action": "create" | "update" | "delete", "content"?: string }],
  "nextSteps": string[]
}
Rules:
- Read the existing files provided by the user and modify them intentionally.
- Prefer complete, runnable HTML/CSS/JS unless the user asks for another stack.
- Include full file contents for every create/update action.
- Never wrap the JSON in markdown.
- Keep paths relative. Do not use .. or absolute paths.
- Make the UI beautiful, responsive, and production-ready.`;

  const user = JSON.stringify({
    request: prompt,
    currentFiles
  });

  const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Hostify AI Agent"
    },
    body: JSON.stringify({
      model: body.model || process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.35,
      max_tokens: 6000,
      response_format: { type: "json_object" }
    })
  });

  if (!openRouterRes.ok) {
    const details = await openRouterRes.text();
    return NextResponse.json({ error: "OpenRouter request failed.", details }, { status: 502 });
  }

  const completion = await openRouterRes.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) return NextResponse.json({ error: "OpenRouter returned no content." }, { status: 502 });

  try {
    const parsed = extractJson(content);
    return NextResponse.json(normalizeAgentResponse(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse model output.";
    return NextResponse.json({ error: message, raw: content }, { status: 502 });
  }
}
