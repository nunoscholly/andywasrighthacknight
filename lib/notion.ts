import type { AnalysisResult, BriefingForm } from "./types";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

const AM_MAP: Record<string, string> = {
  crestline: "Anna Schmidt",
};

function resolveAM(company: string): string {
  const n = company.toLowerCase().trim();
  for (const [k, v] of Object.entries(AM_MAP)) {
    if (n.includes(k)) return v;
  }
  return "Unassigned — triage queue";
}

interface RichText {
  type: "text";
  text: { content: string };
}

function rt(content: string): RichText {
  return { type: "text", text: { content } };
}

export interface WriteToNotionInput {
  briefingUrl: string;
  briefing: BriefingForm;
  submittedAt: string;
  analysis: AnalysisResult;
}

export async function writeBriefingToNotion(
  input: WriteToNotionInput,
): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID.");
  }

  const { briefing, analysis, briefingUrl, submittedAt } = input;
  const company = briefing.company?.trim() || "Untitled";

  const status =
    analysis.findings.length > 0 ? "Needs clarification" : "Ready for pitch";

  const draftedReply = analysis.drafted_reply.slice(0, 1900);

  const properties: Record<string, unknown> = {
    Client: { title: [rt(company)] },
    Status: { select: { name: status } },
    "Risk Level": { select: { name: analysis.risk_level } },
    "Findings Count": { number: analysis.findings.length },
    "Recommended Action": {
      rich_text: [rt(analysis.recommended_action)],
    },
    "AM Owner": { rich_text: [rt(resolveAM(company))] },
    "Drafted Reply": { rich_text: [rt(draftedReply)] },
  };

  if (briefing.projectTitle?.trim()) {
    properties["Project Title"] = {
      rich_text: [rt(briefing.projectTitle.trim())],
    };
  }
  if (submittedAt) {
    properties["Submitted"] = { date: { start: submittedAt } };
  }
  if (briefing.offerDueDate?.trim()) {
    properties["Offer Due"] = {
      date: { start: briefing.offerDueDate.trim() },
    };
  }
  if (typeof briefing.budgetChf === "number" && briefing.budgetChf > 0) {
    properties["Budget CHF"] = { number: briefing.budgetChf };
  }
  if (briefingUrl) {
    properties["Briefing URL"] = { url: briefingUrl };
  }

  const body = {
    parent: { database_id: databaseId },
    properties,
  };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { url?: string; id?: string };
  return (
    json.url ??
    `https://www.notion.so/${(json.id ?? "").replace(/-/g, "")}`
  );
}
