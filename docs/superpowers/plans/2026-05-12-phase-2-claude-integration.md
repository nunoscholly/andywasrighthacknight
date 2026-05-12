# Phase 2: Claude Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked AM briefing with a real Claude analysis: form submit → Claude tool-use call → structured findings written to Supabase → briefing page renders real data.

**Architecture:** Synchronous request flow. `POST /api/analyze` inserts briefing row → calls Claude with a Zod-validated tool schema → inserts findings → updates briefing with TL;DR and `status='ready'` → mirrors the result to Notion as one page per briefing → returns id. The form shows a loading screen during the call (~15–30s expected). Briefing page becomes a server component that reads from Supabase. Notion is a display sink (not the source of truth); a Notion failure is logged but does not fail the request.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk` v0.95, `zod` v4, `@supabase/supabase-js`, Claude Sonnet 4.6 with tool use.

**Trade-off note (ship over perfection):** No test runner is configured. Tasks skip TDD ceremony and use end-to-end curl smoke tests instead. Prompt caching is not added — single-shot hackathon usage, not worth the complexity.

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `lib/analyzer.ts` | Create | Anthropic client, tool schema, `analyzeBriefing()` function |
| `lib/notion.ts` | Create | Notion client + `writeBriefingToNotion()` (page + blocks) |
| `lib/types.ts` | Modify | Add `AnalysisResult` type |
| `app/api/analyze/route.ts` | Modify | Insert → call analyzer → write findings → mirror to Notion → return id |
| `app/briefing/[id]/page.tsx` | Modify | Server component reading from Supabase (incl. notion_url link) |
| `app/page.tsx` | Modify | Full-screen loading state during submission |
| `.env.local` | Already set | `ANTHROPIC_API_KEY`, `NOTION_TOKEN`, `NOTION_DATABASE_ID` |

**Supabase schema addition required:** the `briefings` table needs a `notion_page_url text` column to store the page link after a successful Notion write. This will be applied in Task 2.5 via the Management API.

---

## Task 1: Analyzer module (Anthropic + Zod tool schema)

**Files:**
- Create: `lib/analyzer.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `AnalysisResult` type to `lib/types.ts`**

Append to the end of `lib/types.ts`:

```ts
export interface AnalysisResult {
  tldr: string;
  findings: Finding[];
}
```

- [ ] **Step 2: Create `lib/analyzer.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnalysisResult, BriefingForm, Finding } from "./types";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY.");
}

const client = new Anthropic({ apiKey });

const FindingSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  category: z.enum(["completeness", "plausibility", "risk", "consistency"]),
  title: z.string().min(1),
  what_to_clarify: z.string().min(1),
  why_it_matters: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
});

const AnalysisSchema = z.object({
  tldr: z.string().min(1),
  findings: z.array(FindingSchema),
});

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    tldr: {
      type: "string",
      description:
        "Three to five sentences. State the project in one line, then the biggest blockers before the agency can quote.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "warning", "info"],
            description:
              "critical = blocks quoting / will cause production failure. warning = needs clarification but not blocking. info = noted, low risk.",
          },
          category: {
            type: "string",
            enum: ["completeness", "plausibility", "risk", "consistency"],
          },
          title: { type: "string", description: "Six to ten words." },
          what_to_clarify: {
            type: "string",
            description:
              "One or two sentences. The exact question or missing fact.",
          },
          why_it_matters: {
            type: "string",
            description:
              "One or two sentences. The downstream consequence if unresolved.",
          },
          priority: {
            type: ["integer", "null"],
            enum: [1, 2, 3, null],
            description:
              "1, 2, or 3 for the three most important questions to ask the client. null for the rest.",
          },
        },
        required: [
          "severity",
          "category",
          "title",
          "what_to_clarify",
          "why_it_matters",
          "priority",
        ],
      },
    },
  },
  required: ["tldr", "findings"],
};

const SYSTEM_PROMPT = `You are a senior Account Manager analyst at Andy Was Right, a Zurich-based creative content agency. A client has submitted a project briefing. Your job: produce a structured analysis for the AM who will respond.

Look for:
- completeness: missing facts the agency needs before quoting (venue, dates, contacts, deliverable specs)
- plausibility: budget vs scope mismatches, timelines that don't fit production realities
- risk: legal/usage rights, weather, model availability, location permits, dependencies on unspecified assets
- consistency: contradictions within the brief, references to attachments not provided, dates that don't line up

Be specific. Reference concrete details from the brief. Avoid generic advice. Mark exactly three findings with priority 1, 2, 3 — these are the top questions the AM should ask the client first. All other findings get priority null.

Severity rules:
- critical: blocks the quote, will derail production, or signals a legal issue.
- warning: needs clarification, scope creep risk.
- info: worth noting, not actionable now.

Produce 5–10 findings total. Quality over quantity. If the brief is unusually clean, return fewer.`;

export async function analyzeBriefing(
  briefing: BriefingForm,
): Promise<AnalysisResult> {
  const userMessage = `Client briefing payload (JSON):\n\n${JSON.stringify(
    briefing,
    null,
    2,
  )}\n\nAnalyze it and return findings via the report_findings tool.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "report_findings",
        description:
          "Submit the structured analysis of the client briefing.",
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "report_findings" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block.");
  }

  const parsed = AnalysisSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Analyzer schema validation failed: ${parsed.error.message}`,
    );
  }

  const findings: Finding[] = parsed.data.findings;
  return { tldr: parsed.data.tldr, findings };
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add lib/analyzer.ts lib/types.ts
git commit -m "Add Claude analyzer with Zod-validated tool schema"
```

---

## Task 2: Wire analyzer into the API route

**Files:**
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Replace `app/api/analyze/route.ts` contents**

```ts
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

    let notionPageUrl: string | null = null;
    try {
      notionPageUrl = await writeBriefingToNotion({
        clientName: body.company || body.contactName || "Untitled",
        projectTitle: body.projectTitle,
        tldr: analysis.tldr,
        findings: analysis.findings,
        briefing: body,
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

    return NextResponse.json({ id: briefing.id, notion_page_url: notionPageUrl });
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Make sure `ANTHROPIC_API_KEY` is set in `.env.local`**

Open `.env.local`, confirm `ANTHROPIC_API_KEY=sk-ant-...` is filled in. If empty, stop and ask the user for the key.

- [ ] **Step 4: Smoke test the API end-to-end**

Start the dev server:
```bash
PORT=3017 npm run dev > /tmp/awr-dev.log 2>&1 &
sleep 5
grep -E "Ready|Error" /tmp/awr-dev.log
```

POST a minimal Crestline-style briefing:
```bash
curl -sS -X POST http://localhost:3017/api/analyze \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "contactName": "Anna Müller",
  "contactEmail": "anna@example.com",
  "company": "Crestline Card",
  "projectTitle": "Winter Shoot 2026",
  "shortDescription": "Instagram content from a Swiss Alpine hotel",
  "background": "Premium mountain hotel, Michelin restaurant, private railway",
  "budgetChf": 25000,
  "offerDueDate": "2026-01-09",
  "productionStart": "2025-12-21",
  "productionEnd": "2026-01-23",
  "finalNotes": "Shoot is on Jan 28, 2026"
}
EOF
```
Expected: `{"id":"<uuid>"}` and HTTP 200 after ~15-30s.

Verify findings landed:
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/vcikwwqskagohffsvkei/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select b.id, b.status, b.tldr, count(f.id) as findings from briefings b left join findings f on f.briefing_id=b.id group by b.id order by b.created_at desc limit 3;"}'
```
Expected: latest row has `status='ready'`, non-null `tldr`, `findings >= 3`.

Stop the server: `pkill -f "next-server\|next dev"`

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "Wire analyzer into /api/analyze, write findings + tldr to Supabase + Notion"
```

---

## Task 2.5: Notion writer (one page per briefing)

**Files:**
- Create: `lib/notion.ts`
- Modify: `supabase/migrations/20260512190001_add_notion_url.sql` (new migration)

**Database target:** `Andy Briefing Card` (ID `35e68e1c-2f9c-80d9-a1d9-cc125390d5b6`). Schema is minimal — one `Name` (title) property. Strategy: rich blocks inside the page body.

- [ ] **Step 1: Add the schema column via Supabase Management API**

Run (PAT from earlier conversation, paste yours):
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/vcikwwqskagohffsvkei/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"alter table briefings add column if not exists notion_page_url text;"}'
```
Expected: `[]` and HTTP 201.

Also write a migration file for repeatability — create `supabase/migrations/20260512190001_add_notion_url.sql`:
```sql
alter table briefings add column if not exists notion_page_url text;
```

- [ ] **Step 2: Create `lib/notion.ts`**

```ts
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

function callout(
  severity: Severity,
  finding: Finding,
): NotionBlock {
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Unit smoke test against real Notion**

Write a temporary script `/tmp/notion-smoke.mjs`:
```js
import { writeBriefingToNotion } from "./lib/notion.ts";
// run with: npx tsx /tmp/notion-smoke.mjs
```
Easier: re-run the full end-to-end smoke from Task 2 step 4 — it now writes Notion too. After the curl, hit Notion's API to confirm a fresh page exists:
```bash
curl -sS -X POST "https://api.notion.com/v1/databases/35e68e1c-2f9c-80d9-a1d9-cc125390d5b6/query" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"page_size":3,"sorts":[{"timestamp":"created_time","direction":"descending"}]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(p['url'], '-', p['properties']['Name']['title'][0]['plain_text'] if p['properties']['Name']['title'] else '(no title)') for p in d['results']]"
```
Expected: top result is a newly created page for the most recent test briefing.

- [ ] **Step 5: Commit**

```bash
git add lib/notion.ts supabase/migrations/20260512190001_add_notion_url.sql
git commit -m "Add Notion sink: one page per briefing with TL;DR + findings"
```

---

## Task 3: Render real data on the briefing page

**Files:**
- Modify: `app/briefing/[id]/page.tsx`

- [ ] **Step 1: Replace `app/briefing/[id]/page.tsx` contents**

```tsx
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import type { Finding, Severity } from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_BAR: Record<Severity, string> = {
  critical: "bg-sev-critical",
  warning: "bg-sev-warning",
  info: "bg-sev-info",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "text-sev-critical",
  warning: "text-sev-warning",
  info: "text-sev-info",
};

const eyebrow =
  "text-xs font-medium tracking-[0.18em] uppercase text-awr-grey";

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="relative flex border border-awr-border bg-awr-black">
      <div className={`w-1 ${SEVERITY_BAR[finding.severity]}`} />
      <div className="flex-1 px-8 py-7">
        <div className="flex items-center gap-4 text-[11px] tracking-[0.18em] uppercase font-medium">
          <span className={SEVERITY_BADGE[finding.severity]}>
            {finding.severity}
          </span>
          <span className="text-awr-grey">{finding.category}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold tracking-tight">{finding.title}</h3>
          {finding.priority !== null && (
            <span className="text-[10px] tracking-[0.18em] uppercase font-medium bg-awr-green text-awr-off-white px-2 py-1 rounded-sm">
              Must ask
            </span>
          )}
        </div>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed">
          <p className="text-awr-off-white">{finding.what_to_clarify}</p>
          <p className="text-awr-grey">{finding.why_it_matters}</p>
        </div>
      </div>
    </article>
  );
}

interface BriefingRow {
  id: string;
  client_name: string | null;
  submitted_at: string;
  status: "analyzing" | "ready" | "failed";
  tldr: string | null;
  raw_input: Record<string, unknown> | null;
  notion_page_url: string | null;
}

interface FindingRow {
  severity: Severity;
  category: Finding["category"];
  title: string;
  what_to_clarify: string;
  why_it_matters: string;
  priority: number | null;
}

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseServer();

  const { data: briefing } = await supabase
    .from("briefings")
    .select(
      "id, client_name, submitted_at, status, tldr, raw_input, notion_page_url",
    )
    .eq("id", id)
    .single<BriefingRow>();

  if (!briefing) notFound();

  const { data: findingsRaw } = await supabase
    .from("findings")
    .select(
      "severity, category, title, what_to_clarify, why_it_matters, priority",
    )
    .eq("briefing_id", id)
    .returns<FindingRow[]>();

  const findings: Finding[] = (findingsRaw ?? []).sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    const ap = a.priority ?? 99;
    const bp = b.priority ?? 99;
    return ap - bp;
  });

  const raw = (briefing.raw_input ?? {}) as Record<string, unknown>;
  const dueDate = typeof raw.offerDueDate === "string" ? raw.offerDueDate : "—";
  const budget =
    typeof raw.budgetChf === "number" && raw.budgetChf > 0
      ? `CHF ${raw.budgetChf.toLocaleString("en-CH")}`
      : "—";
  const submitted = briefing.submitted_at.slice(0, 10);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-8 md:px-16 py-16">
        <header className="border-b border-awr-border pb-10">
          <p className={eyebrow}>Account Manager Brief</p>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            {briefing.client_name ?? "Untitled briefing"}
          </h1>
          <p className="mt-6 text-awr-grey text-sm">
            Submitted {submitted} · Offer due {dueDate} · Budget {budget} ·
            Status {briefing.status}
          </p>
        </header>

        <section className="border-t border-awr-border mt-12 pt-12">
          <p className={`${eyebrow} mb-6`}>TL;DR</p>
          {briefing.tldr ? (
            <p className="text-lg leading-relaxed text-awr-off-white max-w-3xl">
              {briefing.tldr}
            </p>
          ) : (
            <p className="text-awr-grey italic">
              {briefing.status === "analyzing"
                ? "Analysis in progress…"
                : "No summary available."}
            </p>
          )}
        </section>

        <section className="border-t border-awr-border mt-12 pt-12">
          <p className={`${eyebrow} mb-8`}>Findings</p>
          {findings.length > 0 ? (
            <div className="flex flex-col gap-4">
              {findings.map((f, i) => (
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          ) : (
            <p className="text-awr-grey italic">
              No findings recorded for this briefing.
            </p>
          )}
        </section>

        <section className="border-t border-awr-border mt-12 pt-12 pb-24">
          <p className={`${eyebrow} mb-8`}>Actions</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="bg-awr-green hover:bg-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors"
            >
              Reply to client (drafted)
            </button>
            {briefing.notion_page_url && (
              <a
                href={briefing.notion_page_url}
                target="_blank"
                rel="noreferrer"
                className="border border-awr-border hover:border-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors inline-flex items-center"
              >
                Open in Notion ↗
              </a>
            )}
            <button
              type="button"
              className="border border-awr-border hover:border-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors"
            >
              Move to pitch phase
            </button>
            <button
              type="button"
              className="border border-awr-border hover:border-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors"
            >
              Escalate to senior
            </button>
            <button
              type="button"
              className="border border-awr-border hover:border-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors"
            >
              Mark as incomplete
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Visual smoke test**

Start the dev server, then open the most-recent ready briefing in a browser:
```bash
PORT=3017 npm run dev > /tmp/awr-dev.log 2>&1 &
sleep 5
```
Get the latest briefing id:
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/vcikwwqskagohffsvkei/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"select id from briefings where status=\u0027ready\u0027 order by created_at desc limit 1;"}'
```
Curl the page and check it renders real content (not mocks):
```bash
curl -sS http://localhost:3017/briefing/<ID> | grep -o "Account Manager Brief\|TL;DR\|Findings\|Must ask"
```
Expected: all four strings appear.

Stop the server: `pkill -f "next-server\|next dev"`

- [ ] **Step 4: Commit**

```bash
git add app/briefing/[id]/page.tsx
git commit -m "Read briefing + findings from Supabase, remove mocks"
```

---

## Task 4: Loading screen during submission

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the `submitting` state branch in `app/page.tsx`**

Find the `return (` statement of the `Home` component. Replace the entire returned JSX so that when `submitting` is true, a full-screen loading view renders instead of the form. Add this block right after the existing `const [error, setError] = useState<string | null>(null);` line:

```tsx
const [loadingPhase, setLoadingPhase] = useState(0);
```

Replace the existing `handleSubmit` function with:

```tsx
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setSubmitting(true);
  setError(null);
  setLoadingPhase(0);

  const phases = [
    "Reading briefing…",
    "Checking completeness…",
    "Stress-testing the plan…",
    "Drafting findings…",
  ];
  const interval = setInterval(() => {
    setLoadingPhase((p) => Math.min(p + 1, phases.length - 1));
  }, 4500);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
    const data = (await res.json()) as { id: string };
    router.push(`/briefing/${data.id}`);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    setSubmitting(false);
  } finally {
    clearInterval(interval);
  }
}
```

Add this constant at module scope (above `export default function Home()`):

```tsx
const LOADING_PHASES = [
  "Reading briefing…",
  "Checking completeness…",
  "Stress-testing the plan…",
  "Drafting findings…",
];
```

In the JSX, wrap the existing return with the loading branch. Replace the existing top-level `return (` block with:

```tsx
if (submitting) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8">
      <div className="text-center max-w-md">
        <p className={`${eyebrow} mb-8`}>Andy is reading</p>
        <div className="flex justify-center gap-2 mb-10">
          <span className="w-2 h-2 bg-awr-green rounded-full animate-pulse" />
          <span
            className="w-2 h-2 bg-awr-green rounded-full animate-pulse"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 bg-awr-green rounded-full animate-pulse"
            style={{ animationDelay: "400ms" }}
          />
        </div>
        <p className="text-2xl font-bold tracking-tight">
          {LOADING_PHASES[loadingPhase]}
        </p>
        <p className="mt-6 text-awr-grey text-sm">
          This usually takes 20–30 seconds.
        </p>
      </div>
    </main>
  );
}

return (
```
(Keep the rest of the original JSX as the non-submitting return.)

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 3: End-to-end smoke test in browser**

```bash
PORT=3017 npm run dev > /tmp/awr-dev.log 2>&1 &
sleep 5
```
Open `http://localhost:3017/` in the browser, hit "Send to Andy Was Right", observe: form replaced by centered pulsing-dot loader with rotating phase text. After ~15-30s, redirect to `/briefing/[id]` showing real findings.

Stop the server: `pkill -f "next-server\|next dev"`

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Show loading screen during analysis instead of disabled button"
```

---

## Task 5: Push and tag

- [ ] **Step 1: Push all Phase 2 commits**

```bash
git push
```

- [ ] **Step 2: Tag the milestone**

```bash
git tag -a phase-2 -m "Phase 2: real Claude analysis pipeline"
git push origin phase-2
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Claude integration | Task 1, 2 |
| Zod tool schema | Task 1 |
| Anthropic SDK + tool use | Task 1 |
| Findings written to Supabase | Task 2 |
| TL;DR written to Supabase | Task 2 |
| Status transitions analyzing→ready/failed | Task 2 |
| Briefing page reads from DB (no mocks) | Task 3 |
| Loading screen between submit and redirect | Task 4 |
| Severity-sorted findings | Task 3 |
| MUST ASK tag rendered for priority findings | Task 3 |
| Notion mirror (one page per briefing) | Task 2.5 |
| Notion link surfaced in Actions row | Task 3 |
| `notion_page_url` column on briefings | Task 2.5 |

Not in this plan (Phase 3): "Draft reply" modal wired to the "Reply to client" button.
