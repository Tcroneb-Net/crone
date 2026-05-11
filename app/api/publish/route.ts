import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { sanitizePath } from "../../../lib/paths";

export const runtime = "nodejs";

type Body = {
  projectName?: string;
  entryFile?: string;
  files?: Record<string, string>;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 70) || "hostify-project";
}

function contentTypeFor(path: string) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const files = body.files || {};
  const projectName = body.projectName || "hostify-project";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "hostify-projects";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const safeFiles = Object.entries(files)
    .map(([path, content]) => [sanitizePath(path), String(content ?? "")] as const)
    .filter(([path]) => Boolean(path));

  if (!safeFiles.length) return NextResponse.json({ error: "No files supplied." }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const deploymentId = `${slugify(projectName)}-${Date.now()}`;
  const basePath = `deployments/${deploymentId}`;

  for (const [path, content] of safeFiles) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(`${basePath}/${path}`, Buffer.from(content, "utf8"), {
        contentType: contentTypeFor(path),
        upsert: true
      });
    if (error) return NextResponse.json({ error: `Upload failed for ${path}: ${error.message}` }, { status: 500 });
  }

  const zip = new JSZip();
  safeFiles.forEach(([path, content]) => zip.file(path, content));
  zip.file("hostify-manifest.json", JSON.stringify({ projectName, deploymentId, files: safeFiles.map(([path]) => path) }, null, 2));
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipPath = `${basePath}/${slugify(projectName)}.zip`;
  const { error: zipError } = await supabase.storage.from(bucket).upload(zipPath, zipBuffer, {
    contentType: "application/zip",
    upsert: true
  });
  if (zipError) return NextResponse.json({ error: `Zip upload failed: ${zipError.message}` }, { status: 500 });

  const manifestPath = `${basePath}/hostify-manifest.json`;
  await supabase.storage.from(bucket).upload(manifestPath, Buffer.from(JSON.stringify({ projectName, deploymentId, createdAt: new Date().toISOString() }, null, 2)), {
    contentType: "application/json; charset=utf-8",
    upsert: true
  });

  const entry = sanitizePath(body.entryFile || "index.html");
  const { data: previewData } = supabase.storage.from(bucket).getPublicUrl(`${basePath}/${entry}`);
  const { data: zipData } = supabase.storage.from(bucket).getPublicUrl(zipPath);

  await supabase.from("hostify_deployments").insert({
    project_name: projectName,
    deployment_id: deploymentId,
    storage_bucket: bucket,
    storage_path: basePath,
    preview_url: previewData.publicUrl,
    zip_url: zipData.publicUrl
  });

  return NextResponse.json({
    deploymentId,
    previewUrl: previewData.publicUrl,
    zipUrl: zipData.publicUrl,
    storagePath: basePath
  });
}
