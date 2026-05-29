import Link from "next/link";

const legalLinks = [
  {
    href: "/terms",
    label: "Terms of Service",
    description: "Read the service terms for Clips Automation.",
  },
  {
    href: "/privacy",
    label: "Privacy Policy",
    description: "Review how this MVP handles submitted content and integration data.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen text-[#e2e2e1]">
      <header className="fixed left-0 right-0 top-0 z-50 h-20 border-b border-[rgba(69,73,50,0.35)] bg-[#121414]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-5 md:px-10">
          <Link href="/" className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.06em] text-[#dffe00] transition hover:text-[#39ff14]">
            AI Video Clipper
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/dashboard" className="border-b-2 border-[#dffe00] pb-1 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#dffe00]">
              Dashboard
            </Link>
            <Link href="/terms" className="border-b-2 border-transparent pb-1 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#c6c9ab] transition hover:text-[#dffe00]">
              Terms
            </Link>
            <Link href="/privacy" className="border-b-2 border-transparent pb-1 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#c6c9ab] transition hover:text-[#dffe00]">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-screen max-w-[1280px] content-center gap-12 px-5 pb-16 pt-32 md:px-10">
        <div className="max-w-4xl">
          <p className="mb-4 inline-block rounded-full border border-[rgba(57,255,20,0.20)] bg-[rgba(57,255,20,0.08)] px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">
            Clips automation
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[3rem] font-black leading-[3.25rem] tracking-[-0.05em] text-[#dffe00] md:text-[4.5rem] md:leading-[5rem]">
            AI Video Clipper
          </h1>
          <p className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-black leading-10 tracking-[-0.04em] text-white md:text-5xl md:leading-[3.5rem]">
            AI-assisted video clipping and TikTok upload workflows.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c6c9ab]">
            This MVP helps authorized users submit source videos, review generated clips, prepare metadata, and queue TikTok upload workflows through server-side integrations.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-12">
          <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl md:col-span-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]/80">App access</p>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-[#dffe00]">Operator dashboard</h2>
                <p className="mt-4 max-w-xl leading-7 text-[#c6c9ab]">
                  The dashboard requires production database and queue environment variables. Legal and app information pages remain publicly accessible for platform review.
                </p>
              </div>
              <div className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
                <p className="font-[family-name:var(--font-mono)] text-[13px] font-medium uppercase leading-[18px] text-[#909378]">QUEUE</p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">READY</p>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/dashboard" className="inline-flex h-14 items-center justify-center rounded-lg bg-[#d3f000] px-6 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14]">
                Access dashboard
              </Link>
              <span className="font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-[#c6c9ab]">
                <span className="mr-2 inline-block size-2 rounded-full bg-[#39ff14]" />
                System ready
              </span>
            </div>
          </article>

          <div className="grid gap-5 md:col-span-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex min-h-40 flex-col justify-between rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-[rgba(51,53,53,0.55)]"
              >
                <div>
                  <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#909378]">Public page</p>
                  <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white transition group-hover:text-[#dffe00]">{link.label}</h2>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#c6c9ab]">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>

      </section>
    </main>
  );
}
