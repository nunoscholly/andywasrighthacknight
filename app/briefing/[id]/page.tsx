import type { Finding, Severity } from "@/lib/types";

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

const MOCK_FINDINGS: Finding[] = [
  {
    severity: "critical",
    category: "completeness",
    title: "Hotel name and location not specified",
    what_to_clarify:
      "Which specific premium mountain hotel in the Swiss Alps is the production base? The brief references the hotel's Michelin restaurant, private railway, and chalet — but never names it.",
    why_it_matters:
      "Without the venue locked, we can't scout, secure permits, lock travel, or align the model brief on color/wardrobe with the actual setting.",
    priority: 1,
  },
  {
    severity: "critical",
    category: "risk",
    title: "Production window ends before stated shoot date",
    what_to_clarify:
      "Production window is Dec 21 – Jan 23, but the shoot is on Wednesday Jan 28, 2026. Confirm whether the production window should extend, or the shoot date should move.",
    why_it_matters:
      "If we honor the stated window, the shoot date is impossible. If we honor the shoot date, we need a contract extension and possibly revised crew/model availability.",
    priority: 2,
  },
  {
    severity: "warning",
    category: "plausibility",
    title: "Budget appears tight for stated scope",
    what_to_clarify:
      "CHF 25k must cover travel, 3 models, accommodation at a premium Alpine hotel, crew (incl. Alex), production, post, AND a 2-year model buyout. Confirm whether buyout is in-budget or a separate line.",
    why_it_matters:
      "Premium Alpine locations and multi-year buyouts typically each consume a large share of this budget. Misalignment here surfaces late as scope-creep arguments.",
    priority: 3,
  },
  {
    severity: "warning",
    category: "consistency",
    title: "Visual guidelines referenced but not attached",
    what_to_clarify:
      "The client says color guidelines will be attached 'later' but the model brief depends on them. Get them before the model brief is finalized.",
    why_it_matters:
      "Locking models and wardrobe without the color code risks reshoots or retouching pressure later.",
    priority: null,
  },
  {
    severity: "info",
    category: "completeness",
    title: "Status call requested Jan 8/9",
    what_to_clarify:
      "Confirm which of Jan 8 or 9 works and put it on the calendar. Offer due date is Jan 9.",
    why_it_matters:
      "Same-day-as-offer status calls usually mean a last-minute push. Better to land on Jan 8.",
    priority: null,
  },
];

const eyebrow = "text-xs font-medium tracking-[0.18em] uppercase text-awr-grey";

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

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const findings = [...MOCK_FINDINGS].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  const clientName = "Crestline Card Switzerland GmbH";
  const submitted = "2025-12-19";
  const dueDate = "2026-01-09";
  const budget = "CHF 25,000";

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-8 md:px-16 py-16">
        <header className="border-b border-awr-border pb-10">
          <p className={eyebrow}>Account Manager Brief</p>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            {clientName}
          </h1>
          <p className="mt-6 text-awr-grey text-sm">
            Submitted {submitted} · Offer due {dueDate} · Budget {budget} ·
            ID {id.slice(0, 8)}
          </p>
        </header>

        <section className="border-t border-awr-border mt-12 pt-12">
          <p className={`${eyebrow} mb-6`}>TL;DR</p>
          <p className="text-lg leading-relaxed text-awr-off-white max-w-3xl">
            Winter shoot at an unnamed premium Alpine hotel. Concept is solid
            and well-anchored in prior shoot success. Three blockers before
            pitch: venue identity, calendar conflict between production window
            and shoot date, and budget viability against a multi-year buyout.
          </p>
        </section>

        <section className="border-t border-awr-border mt-12 pt-12">
          <p className={`${eyebrow} mb-8`}>Findings</p>
          <div className="flex flex-col gap-4">
            {findings.map((f, i) => (
              <FindingCard key={i} finding={f} />
            ))}
          </div>
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
