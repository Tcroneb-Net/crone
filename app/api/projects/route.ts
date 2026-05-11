import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const payload = {
      id: body.id,
      name: body.name || "Untitled Project",
      files: body.files || {},
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("hostify_projects").upsert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id query param is required." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("hostify_projects").select("*").eq("id", id).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
