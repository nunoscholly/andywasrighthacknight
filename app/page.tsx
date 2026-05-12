"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRESTLINE_BRIEFING } from "@/lib/sample-briefing";
import type { BriefingForm } from "@/lib/types";

type FormState = BriefingForm;

const eyebrow = "text-xs font-medium tracking-[0.18em] uppercase text-awr-grey";

const inputBase =
  "w-full bg-transparent border border-awr-border px-4 py-3 text-base text-awr-off-white placeholder:text-awr-grey focus:border-awr-green-light";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-medium tracking-[0.18em] uppercase text-awr-grey">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({
  eyebrowLabel,
  children,
}: {
  eyebrowLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-awr-border py-12">
      <p className={`${eyebrow} mb-8`}>{eyebrowLabel}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(CRESTLINE_BRIEFING);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-8 md:px-16 py-16">
        <header className="flex items-baseline justify-between border-b border-awr-border pb-10">
          <span className="text-awr-green text-lg font-medium tracking-tight">
            Andy Was Right
          </span>
          <span className={eyebrow}>Briefing Intake</span>
        </header>

        <div className="pt-16 pb-12">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[0.95]">
            New Briefing
          </h1>
          <p className="mt-6 text-awr-grey text-lg">
            Submit a client briefing for automated analysis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="pb-24">
          <Section eyebrowLabel="Contact">
            <Field label="Name">
              <input
                className={inputBase}
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputBase}
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputBase}
                value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
              />
            </Field>
            <Field label="Company">
              <input
                className={inputBase}
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </Field>
          </Section>

          <Section eyebrowLabel="Project">
            <div className="md:col-span-2">
              <Field label="Project Title">
                <input
                  className={inputBase}
                  value={form.projectTitle}
                  onChange={(e) => update("projectTitle", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Short Description">
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.shortDescription}
                  onChange={(e) => update("shortDescription", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Background">
                <textarea
                  rows={4}
                  className={inputBase}
                  value={form.background}
                  onChange={(e) => update("background", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section eyebrowLabel="Creative">
            <div className="md:col-span-2">
              <Field label="Message / Guiding Line">
                <textarea
                  rows={3}
                  className={inputBase}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Project Detail">
                <textarea
                  rows={4}
                  className={inputBase}
                  value={form.projectDetail}
                  onChange={(e) => update("projectDetail", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Goals">
                <textarea
                  rows={5}
                  className={inputBase}
                  value={form.goals}
                  onChange={(e) => update("goals", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section eyebrowLabel="Scope">
            <Field label="Target Audience">
              <input
                className={inputBase}
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
              />
            </Field>
            <Field label="Platforms / Channels">
              <input
                className={inputBase}
                value={form.platforms}
                onChange={(e) => update("platforms", e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Deliverables Description">
                <textarea
                  rows={3}
                  className={inputBase}
                  value={form.deliverablesDescription}
                  onChange={(e) =>
                    update("deliverablesDescription", e.target.value)
                  }
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Formats (comma-separated)">
                <input
                  className={inputBase}
                  value={form.formats}
                  onChange={(e) => update("formats", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section eyebrowLabel="Logistics">
            <Field label="Submitted Date">
              <input
                type="date"
                className={inputBase}
                value={form.submittedDate}
                onChange={(e) => update("submittedDate", e.target.value)}
              />
            </Field>
            <Field label="Offer Due Date">
              <input
                type="date"
                className={inputBase}
                value={form.offerDueDate}
                onChange={(e) => update("offerDueDate", e.target.value)}
              />
            </Field>
            <Field label="Production Window Start">
              <input
                type="date"
                className={inputBase}
                value={form.productionStart}
                onChange={(e) => update("productionStart", e.target.value)}
              />
            </Field>
            <Field label="Production Window End">
              <input
                type="date"
                className={inputBase}
                value={form.productionEnd}
                onChange={(e) => update("productionEnd", e.target.value)}
              />
            </Field>
            <Field label="Agency Budget CHF">
              <input
                type="number"
                className={inputBase}
                value={form.budgetChf}
                onChange={(e) =>
                  update("budgetChf", Number(e.target.value) || 0)
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Budget Notes">
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.budgetNotes}
                  onChange={(e) => update("budgetNotes", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section eyebrowLabel="Models & Final Notes">
            <div className="md:col-span-2">
              <Field label="Models / Experience">
                <textarea
                  rows={3}
                  className={inputBase}
                  value={form.models}
                  onChange={(e) => update("models", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Timing Notes">
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.timingNotes}
                  onChange={(e) => update("timingNotes", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Final Notes">
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.finalNotes}
                  onChange={(e) => update("finalNotes", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <div className="border-t border-awr-border pt-12">
            {error && (
              <p className="mb-6 text-sev-critical text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-awr-green hover:bg-awr-green-light text-awr-off-white py-5 text-base font-medium tracking-wide rounded-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Analyze Briefing →"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
