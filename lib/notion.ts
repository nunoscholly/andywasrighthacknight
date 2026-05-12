import type { BriefingForm, Finding, Severity } from "./types";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "🔴",
  warning: "🟠",
  info: "🟢",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "red_background",
  warning: "orange_background",
  info: "green_background",
};

interface RichText {
  type: "text";
  text: { content: string };
  annotations?: { bold?: boolean; italic?: boolean; color?: string };
}

function rt(content: string, annotations?: RichText["annotations"]): RichText {
  return {
    type: "text",
    text: { content },
    ...(annotations ? { annotations } : {}),
  };
}

interface NotionBlock {
  object: "block";
  type: string;
  [key: string]: unknown;
}

function heading(level: 1 | 2 | 3, text: string): NotionBlock {
  const type = `heading_${level}` as const;
  return {
    object: "block",
    type,
    [type]: { rich_text: [rt(text)] },
  };
}

function paragraph(rich: RichText[]): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: rich },
  };
}

function divider(): NotionBlock {
  return { object: "block", type: "divider", divider: {} };
}

function callout(severity: Severity, finding: Finding): NotionBlock {
  const titleParts: RichText[] = [rt(finding.title, { bold: true })];
  if (finding.priority !== null) {
    titleParts.push(rt(`  ·  MUST ASK #${finding.priority}`, { italic: true }));
  }
  return {
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: SEVERITY_EMOJI[severity] },
      color: SEVERITY_COLOR[severity],
      rich_text: [
        rt(`[${severity.toUpperCase()} · ${finding.category}]  `, {
          bold: true,
        }),
        ...titleParts,
      ],
      children: [
        paragraph([
          rt("Clarify: ", { bold: true }),
          rt(finding.what_to_clarify),
        ]),
        paragraph([
          rt("Why it matters: ", { bold: true }),
          rt(finding.why_it_matters),
        ]),
      ],
    },
  };
}

function metaLine(briefing: BriefingForm): string {
  const parts: string[] = [];
  if (briefing.contactName) parts.push(`Contact: ${briefing.contactName}`);
  if (briefing.offerDueDate) parts.push(`Offer due: ${briefing.offerDueDate}`);
  if (briefing.budgetChf && briefing.budgetChf > 0) {
    parts.push(`Budget: CHF ${briefing.budgetChf.toLocaleString("en-CH")}`);
  }
  if (briefing.productionStart && briefing.productionEnd) {
    parts.push(
      `Production: ${briefing.productionStart} → ${briefing.productionEnd}`,
    );
  }
  return parts.join("  ·  ");
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export interface WriteToNotionInput {
  clientName: string;
  projectTitle: string;
  tldr: string;
  findings: Finding[];
  briefing: BriefingForm;
}

export async function writeBriefingToNotion(
  input: WriteToNotionInput,
): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID.");
  }

  const titleText = input.projectTitle
    ? `${input.clientName} — ${input.projectTitle}`
    : input.clientName;

  const sorted = [...input.findings].sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    return (a.priority ?? 99) - (b.priority ?? 99);
  });

  const meta = metaLine(input.briefing);

  const children: NotionBlock[] = [];
  if (meta) {
    children.push(paragraph([rt(meta, { italic: true, color: "gray" })]));
  }
  children.push(heading(2, "TL;DR"));
  children.push(paragraph([rt(input.tldr)]));
  children.push(divider());
  children.push(heading(2, "Findings"));
  for (const f of sorted) {
    children.push(callout(f.severity, f));
  }

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [rt(titleText)] },
    },
    children,
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
  return json.url ?? `https://www.notion.so/${(json.id ?? "").replace(/-/g, "")}`;
}
