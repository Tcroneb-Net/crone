"use client";

import JSZip from "jszip";
import { useMemo, useState } from "react";
import type { AgentResponse, FileAction } from "../lib/types";

type Files = Record<string, string>;
type ChatMessage = { role: "user" | "agent"; text: string };

const starterFiles: Files = {
  "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Hostify Project</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="hero">
    <p class="eyebrow">Generated with Hostify AI Agent</p>
    <h1>Launch your next idea faster.</h1>
    <p>Ask the agent to build a landing page, dashboard, SaaS UI, portfolio, or documentation website.</p>
    <a href="#" class="button">Get started</a>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
  "style.css": `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: Inter, system-ui, sans-serif;
  color: white;
  background: radial-gradient(circle at top left, #8b5cf6, transparent 34rem), linear-gradient(135deg, #09090f, #101935);
}
.hero {
  width: min(920px, calc(100% - 32px));
  padding: 80px 42px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 34px;
  background: rgba(255,255,255,.08);
  box-shadow: 0 30px 90px rgba(0,0,0,.35);
  text-align: center;
}
.eyebrow { color: #67e8f9; text-transform: uppercase; letter-spacing: .18em; font-size: 13px; }
h1 { font-size: clamp(42px, 8vw, 86px); line-height: .92; margin: 18px 0; letter-spacing: -.07em; }
p { color: #d7dcff; font-size: 18px; line-height: 1.7; }
.button { display:inline-block; margin-top: 18px; padding: 14px 18px; border-radius: 999px; color:white; text-decoration:none; background:linear-gradient(135deg,#8b5cf6,#22d3ee); font-weight:800; }`,
  "script.js": `console.log("Hello from Hostify AI Agent preview!");`
};

const models = [
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.1-70b-instruct"
];

function buildPreview(files: Files) {
  let html = files["index.html"] || "<h1>No index.html yet</h1>";
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith(".css")) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`<link[^>]+href=["']${escaped}["'][^>]*>`, "g"), `<style>\n${content}\n</style>`);
    }
    if (path.endsWith(".js")) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`<script[^>]+src=["']${escaped}["'][^>]*><\\/script>`, "g"), `<script>\n${content}\n<\/script>`);
    }
  }
  return html;
}

function applyFileActions(current: Files, actions: FileAction[]): Files {
  const next = { ...current };
  for (const file of actions) {
    const path = file.path.replace(/^\/+/, "");
    if (!path) continue;
    if (file.action === "delete") delete next[path];
    else next[path] = file.content ?? "";
  }
  return next;
}

export default function Home() {
  const [files, setFiles] = useState<Files>(starterFiles);
  const [activeFile, setActiveFile] = useState("index.html");
  const [prompt, setPrompt] = useState("Build a premium SaaS landing page for an AI hosting platform with pricing, features, and CTA sections.");
  const [model, setModel] = useState(models[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", text: "Welcome to Hostify AI Agent. Tell me what to build and I will generate/edit files, preview them, export a zip, and publish to Supabase storage when configured." }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [toast, setToast] = useState("");
  const [projectName, setProjectName] = useState("my-hostify-project");
  const [deployUrl, setDeployUrl] = useState("");

  const preview = useMemo(() => buildPreview(files), [files]);
  const sortedPaths = useMemo(() => Object.keys(files).sort(), [files]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 4200);
  }

  async function askAgent() {
    if (!prompt.trim() || isThinking) return;
    const userPrompt = prompt.trim();
    setPrompt("");
    setMessages((m) => [...m, { role: "user", text: userPrompt }]);
    setIsThinking(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, files, model })
      });
      const data = (await res.json()) as AgentResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Agent failed");
      if (data.files?.length) {
        setFiles((current) => {
          const next = applyFileActions(current, data.files);
          const first = data.files.find((file) => file.action !== "delete")?.path;
          if (first) setActiveFile(first.replace(/^\/+/, ""));
          return next;
        });
      }
      setMessages((m) => [...m, { role: "agent", text: `${data.reply}${data.nextSteps?.length ? `\n\nNext steps:\n- ${data.nextSteps.join("\n- ")}` : ""}` }]);
      showToast(`Applied ${data.files?.length || 0} file change(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((m) => [...m, { role: "agent", text: `Error: ${message}` }]);
      showToast(message);
    } finally {
      setIsThinking(false);
    }
  }

  async function exportZip() {
    const zip = new JSZip();
    Object.entries(files).forEach(([path, content]) => zip.file(path, content));
    zip.file("README.md", `# ${projectName}\n\nGenerated by Hostify AI Agent. Open index.html to preview the project.\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "hostify-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Zip exported.");
  }

  function createFile() {
    const name = window.prompt("New file path", "about.html");
    if (!name) return;
    const path = name.replace(/^\/+/, "");
    setFiles((current) => ({ ...current, [path]: "" }));
    setActiveFile(path);
  }

  function deleteActiveFile() {
    if (!window.confirm(`Delete ${activeFile}?`)) return;
    setFiles((current) => {
      const next = { ...current };
      delete next[activeFile];
      const fallback = Object.keys(next)[0] || "index.html";
      setActiveFile(fallback);
      return next;
    });
  }

  async function publishProject() {
    setDeployUrl("");
    showToast("Publishing to Supabase storage...");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, files, entryFile: "index.html" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setDeployUrl(data.previewUrl || data.zipUrl || "");
      showToast("Published successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      showToast(message);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="logo"><span className="logoMark">H</span> Hostify AI Agent</div>
        <div className="navLinks">
          <a href="#workspace">Workspace</a>
          <a href="#features">Features</a>
          <span className="pill">OpenRouter + Supabase</span>
        </div>
      </nav>

      <section className="hero">
        <div className="card heroMain">
          <span className="kicker">⚡ Your AI project builder and deploy assistant</span>
          <h1><span className="gradientText">Generate, preview, zip, and publish</span> user projects.</h1>
          <p>
            Hostify AI Agent is a complete starter app for building an AI coding/product agent with OpenRouter.
            It can read your current files, create or update project files, show a live preview, download a zip,
            and publish generated output through Supabase Storage.
          </p>
          <div className="heroActions">
            <a className="btn" href="#workspace">Start building</a>
            <button className="btn secondary" onClick={exportZip}>Download current zip</button>
          </div>
        </div>
        <div className="card stats">
          <div className="stat"><b>{sortedPaths.length}</b><span>Files in the current generated project.</span></div>
          <div className="stat"><b>AI</b><span>OpenRouter-powered file editing endpoint.</span></div>
          <div className="stat"><b>ZIP</b><span>One-click browser zip export for users.</span></div>
          <div className="stat"><b>DB</b><span>Supabase schema for projects and deployments.</span></div>
        </div>
      </section>

      <section className="workspace" id="workspace">
        <aside className="panel">
          <div className="panelHeader"><h2>Agent</h2><span className="small">OpenRouter</span></div>
          <div className="panelBody">
            <div className="chatLog">
              {messages.map((message, index) => (
                <div className={`msg ${message.role}`} key={index}>{message.text}</div>
              ))}
              {isThinking && <div className="msg agent">Thinking and editing files...</div>}
            </div>
            <div className="composer">
              <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask Hostify to build or change something..." />
              <button className="btn" onClick={askAgent} disabled={isThinking}>{isThinking ? "Generating..." : "Generate / edit files"}</button>
              <p className="small">The API sends current file contents to OpenRouter so the agent can read and update your project.</p>
            </div>
          </div>
        </aside>

        <section className="panel">
          <div className="panelHeader">
            <h2>Files</h2>
            <div className="editorHeader">
              <button className="btn secondary" onClick={createFile}>New</button>
              <button className="btn danger" onClick={deleteActiveFile}>Delete</button>
            </div>
          </div>
          <div className="panelBody">
            <div className="fileList">
              {sortedPaths.map((path) => (
                <button className={`fileButton ${path === activeFile ? "active" : ""}`} key={path} onClick={() => setActiveFile(path)}>
                  <span>{path}</span><span>{files[path].length}b</span>
                </button>
              ))}
            </div>
            <div style={{ height: 12 }} />
            <textarea
              className="editor"
              value={files[activeFile] ?? ""}
              onChange={(e) => setFiles((current) => ({ ...current, [activeFile]: e.target.value }))}
              spellCheck={false}
            />
          </div>
        </section>

        <aside className="panel">
          <div className="panelHeader"><h2>Preview & Deploy</h2><button className="btn secondary" onClick={exportZip}>Zip</button></div>
          <div className="panelBody deployBox">
            <iframe className="previewFrame" title="Project preview" srcDoc={preview} sandbox="allow-scripts" />
            <label className="small">Project name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <button className="btn" onClick={publishProject}>Publish with Supabase</button>
            {deployUrl && <a className="btn secondary" href={deployUrl} target="_blank" rel="noreferrer">Open published project</a>}
            <p className="small">Publishing requires Supabase env vars, the SQL schema, and a public storage bucket.</p>
          </div>
        </aside>
      </section>

      <section className="featureGrid" id="features">
        <div className="card feature"><h3>File generation</h3><p>Server endpoint returns structured file actions so the UI can create, update, or delete files safely.</p></div>
        <div className="card feature"><h3>Read files</h3><p>The agent receives current files and can continue editing instead of starting from zero.</p></div>
        <div className="card feature"><h3>Project preview</h3><p>Instant iframe preview for generated HTML, CSS, and JavaScript projects.</p></div>
        <div className="card feature"><h3>Supabase publish</h3><p>Upload generated files, zip archives, manifests, and deployment records to Supabase.</p></div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
