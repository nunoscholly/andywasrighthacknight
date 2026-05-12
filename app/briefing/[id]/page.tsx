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
