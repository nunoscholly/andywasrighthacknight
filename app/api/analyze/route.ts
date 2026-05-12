import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { analyzeBriefing } from "@/lib/analyzer";
import { writeBriefingToNotion } from "@/lib/notion";
import type { BriefingForm } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: BriefingForm;
  try {
    body = (await request.json()) as BriefingForm;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = supabaseServer();

  const { data: briefing, error: insertError } = await supabase
    .from("briefings")
    .insert({
      client_name: body.company || body.contactName || "Untitled",
      raw_input: body,
      status: "analyzing",
    })
    .select("id")
    .single();

  if (insertError || !briefing) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert briefing." },
      { status: 500 },
    );
  }

  try {
    const analysis = await analyzeBriefing(body);

    const findingsRows = analysis.findings.map((f) => ({
      briefing_id: briefing.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      what_to_clarify: f.what_to_clarify,
      why_it_matters: f.why_it_matters,
      priority: f.priority,
    }));

    if (findingsRows.length > 0) {
      const { error: findingsError } = await supabase
        .from("findings")
        .insert(findingsRows);
      if (findingsError) throw new Error(findingsError.message);
    }

    const reqUrl = new URL(request.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? `${reqUrl.protocol}//${reqUrl.host}`;
    const briefingUrl = `${baseUrl}/briefing/${briefing.id}`;

    let notionPageUrl: string | null = null;
    try {
      notionPageUrl = await writeBriefingToNotion({
        briefingUrl,
        briefing: body,
        submittedAt: new Date().toISOString(),
        analysis,
      });
    } catch (notionErr) {
      console.error(
        "[analyze] Notion write failed (continuing):",
        notionErr,
      );
    }

    const { error: updateError } = await supabase
      .from("briefings")
      .update({
        tldr: analysis.tldr,
        status: "ready",
        notion_page_url: notionPageUrl,
      })
      .eq("id", briefing.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      id: briefing.id,
      notion_page_url: notionPageUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("briefings")
      .update({ status: "failed", tldr: `Analysis failed: ${message}` })
      .eq("id", briefing.id);
    return NextResponse.json(
      { error: message, id: briefing.id },
      { status: 500 },
    );
  }
}
