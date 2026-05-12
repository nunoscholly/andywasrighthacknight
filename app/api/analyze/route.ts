import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import type { BriefingForm } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: BriefingForm;
  try {
    body = (await request.json()) as BriefingForm;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("briefings")
    .insert({
      client_name: body.company || body.contactName || "Untitled",
      raw_input: body,
      status: "analyzing",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to insert briefing." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
