import Link from "next/link";

const eyebrow =
  "text-xs font-medium tracking-[0.18em] uppercase text-awr-grey";

export default function ThanksPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-8 md:px-16 py-16">
        <header className="flex items-baseline justify-between border-b border-awr-border pb-10">
          <span className="text-awr-green text-lg font-medium tracking-tight">
            Andy Was Right
          </span>
          <span className={eyebrow}>Briefing Received</span>
        </header>
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-2xl text-center -mt-16">
          <p className={`${eyebrow} mb-10`}>Thank you</p>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[0.95]">
            We&rsquo;ve got it
            <br />
            from here.
          </h1>
          <p className="mt-10 text-awr-grey text-lg leading-relaxed max-w-xl mx-auto">
            Your briefing is with the Andy Was Right team. We&rsquo;ll review it
            carefully and come back to you with any questions — and our offer —
            within two business days.
          </p>
          <div className="mt-12">
            <Link
              href="/"
              className="inline-block border border-awr-border hover:border-awr-green-light text-awr-off-white px-6 py-3 text-sm font-medium tracking-wide rounded-sm transition-colors"
            >
              Submit another briefing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
