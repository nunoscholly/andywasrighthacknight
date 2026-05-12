"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRESTLINE_BRIEFING, EMPTY_BRIEFING } from "@/lib/sample-briefing";
import type { BriefingForm } from "@/lib/types";

type FormState = BriefingForm;

const eyebrow = "text-xs font-medium tracking-[0.18em] uppercase text-awr-grey";

const inputBase =
  "w-full bg-transparent border border-awr-border px-4 py-3 text-base text-awr-off-white placeholder:text-awr-grey/60 focus:border-awr-green-light rounded-sm";

const LOADING_PHASES = [
  "Reading briefing…",
  "Checking completeness…",
  "Stress-testing the plan…",
  "Drafting findings…",
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-awr-off-white">{label}</span>
      {hint && <span className="text-xs text-awr-grey leading-snug">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Section({
  eyebrowLabel,
  title,
  description,
  children,
}: {
  eyebrowLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-awr-border pt-12 pb-16">
      <div className="md:grid md:grid-cols-[200px_1fr] md:gap-12">
        <header className="mb-8 md:mb-0">
          <p className={`${eyebrow} mb-3`}>{eyebrowLabel}</p>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-3 text-sm text-awr-grey leading-relaxed max-w-[14rem]">
              {description}
            </p>
          )}
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-7">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(CRESTLINE_BRIEFING);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLoadingPhase(0);

    const interval = setInterval(() => {
      setLoadingPhase((p) => Math.min(p + 1, LOADING_PHASES.length - 1));
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
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-8 md:px-16 py-16">
        <header className="flex items-baseline justify-between border-b border-awr-border pb-10">
          <span className="text-awr-green text-lg font-medium tracking-tight">
            Andy Was Right
          </span>
          <span className={eyebrow}>Project Briefing</span>
        </header>

        <div className="pt-20 pb-14 max-w-3xl">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[0.95]">
            Tell us about
            <br />
            your project.
          </h1>
          <p className="mt-8 text-awr-grey text-lg leading-relaxed max-w-2xl">
            Share what you have. Nothing here is required — fill in what you
            know, leave the rest blank. We&apos;ll come back to you with
            questions before we quote.
          </p>
          <div className="mt-6 flex gap-6 text-sm">
            <button
              type="button"
              onClick={() => setForm(EMPTY_BRIEFING)}
              className="text-awr-grey hover:text-awr-off-white underline-offset-4 hover:underline"
            >
              Start blank
            </button>
            <button
              type="button"
              onClick={() => setForm(CRESTLINE_BRIEFING)}
              className="text-awr-grey hover:text-awr-off-white underline-offset-4 hover:underline"
            >
              Load sample (Crestline)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="pb-24">
          <Section
            eyebrowLabel="01"
            title="About you"
            description="So we know who we&rsquo;re talking to."
          >
            <Field label="Your name">
              <input
                className={inputBase}
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                placeholder="Anna Müller"
              />
            </Field>
            <Field label="Email" hint="Where we&rsquo;ll reply.">
              <input
                type="email"
                className={inputBase}
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Phone" hint="Optional, in case we need to call.">
              <input
                className={inputBase}
                value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                placeholder="+41 79 ..."
              />
            </Field>
            <Field label="Company">
              <input
                className={inputBase}
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Your organization"
              />
            </Field>
          </Section>

          <Section
            eyebrowLabel="02"
            title="The project"
            description="A working title is fine — we&rsquo;ll figure out the rest together."
          >
            <div className="md:col-span-2">
              <Field label="Project title">
                <input
                  className={inputBase}
                  value={form.projectTitle}
                  onChange={(e) => update("projectTitle", e.target.value)}
                  placeholder="Winter Photo Shoot 2026"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="In one or two sentences, what do you want to make?"
                hint="The elevator pitch. Don't worry about polishing it."
              >
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.shortDescription}
                  onChange={(e) => update("shortDescription", e.target.value)}
                  placeholder="A series of Instagram posts that..."
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Background & context"
                hint="Why this project, why now? Anything we should know about your brand, past work, or this moment."
              >
                <textarea
                  rows={4}
                  className={inputBase}
                  value={form.background}
                  onChange={(e) => update("background", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            eyebrowLabel="03"
            title="What you want to say"
            description="The idea, the feeling, the references. The more, the better."
          >
            <div className="md:col-span-2">
              <Field
                label="Core message or guiding line"
                hint="One sentence that captures what this should feel like to the viewer."
              >
                <textarea
                  rows={3}
                  className={inputBase}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Put people at the center..."
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Concrete details"
                hint="Locations, props, wardrobe, references, anything specific you've pictured."
              >
                <textarea
                  rows={4}
                  className={inputBase}
                  value={form.projectDetail}
                  onChange={(e) => update("projectDetail", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="What does success look like?"
                hint="Goals, KPIs, past work to build on, content ideas you've been chewing on."
              >
                <textarea
                  rows={5}
                  className={inputBase}
                  value={form.goals}
                  onChange={(e) => update("goals", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            eyebrowLabel="04"
            title="Audience & channels"
            description="Who is this for, and where will they see it?"
          >
            <Field label="Who is this for?" hint="Your audience in plain words.">
              <input
                className={inputBase}
                value={form.targetAudience}
                onChange={(e) => update("targetAudience", e.target.value)}
                placeholder="Members and prospects"
              />
            </Field>
            <Field
              label="Where will it live?"
              hint="Instagram, web, paid, internal — list any you know."
            >
              <input
                className={inputBase}
                value={form.platforms}
                onChange={(e) => update("platforms", e.target.value)}
                placeholder="Instagram, website"
              />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="What would you like us to deliver?"
                hint="Rough volume is fine — e.g. '10 stills, 4 reels'. We'll firm it up."
              >
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
              <Field
                label="Formats needed"
                hint="Comma-separated. Skip if unsure."
              >
                <input
                  className={inputBase}
                  value={form.formats}
                  onChange={(e) => update("formats", e.target.value)}
                  placeholder="1:1, 4:5, 9:16"
                />
              </Field>
            </div>
          </Section>

          <Section
            eyebrowLabel="05"
            title="Timing & budget"
            description="Approximate is fine. Ranges are fine."
          >
            <Field label="Today's date">
              <input
                type="date"
                className={inputBase}
                value={form.submittedDate}
                onChange={(e) => update("submittedDate", e.target.value)}
              />
            </Field>
            <Field
              label="When do you need our quote?"
              hint="So we know how fast to turn this around."
            >
              <input
                type="date"
                className={inputBase}
                value={form.offerDueDate}
                onChange={(e) => update("offerDueDate", e.target.value)}
              />
            </Field>
            <Field
              label="Earliest production date"
              hint="When could we start?"
            >
              <input
                type="date"
                className={inputBase}
                value={form.productionStart}
                onChange={(e) => update("productionStart", e.target.value)}
              />
            </Field>
            <Field
              label="Latest production date"
              hint="When does this need to be wrapped?"
            >
              <input
                type="date"
                className={inputBase}
                value={form.productionEnd}
                onChange={(e) => update("productionEnd", e.target.value)}
              />
            </Field>
            <Field
              label="Indicative budget (CHF)"
              hint="A rough number helps us scope. Leave 0 if unsure."
            >
              <input
                type="number"
                min={0}
                className={inputBase}
                value={form.budgetChf || ""}
                onChange={(e) =>
                  update("budgetChf", Number(e.target.value) || 0)
                }
                placeholder="25000"
              />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="What's included in that budget?"
                hint="Travel, models, accommodation, buyouts — anything specific."
              >
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.budgetNotes}
                  onChange={(e) => update("budgetNotes", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            eyebrowLabel="06"
            title="Anything else"
            description="The stuff that doesn&rsquo;t fit anywhere else."
          >
            <div className="md:col-span-2">
              <Field
                label="Casting & models"
                hint="Anyone you've worked with before, or specific casting requirements."
              >
                <textarea
                  rows={3}
                  className={inputBase}
                  value={form.models}
                  onChange={(e) => update("models", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Timing details"
                hint="Specific shoot days, travel, anything time-sensitive."
              >
                <textarea
                  rows={2}
                  className={inputBase}
                  value={form.timingNotes}
                  onChange={(e) => update("timingNotes", e.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Anything we haven't asked but should know?"
                hint="The footnotes."
              >
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
              {submitting ? "Sending…" : "Send to Andy Was Right →"}
            </button>
            <p className="mt-4 text-xs text-awr-grey text-center">
              You&apos;ll hear back within two business days.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
