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
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl content-center gap-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[color:var(--moss)]">
            Clips Automation
          </p>
          <h1 className="mt-5 text-5xl font-black leading-[0.92] tracking-[-0.07em] md:text-7xl">
            AI-assisted video clipping and TikTok upload workflows.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
            This MVP helps authorized users submit source videos, review generated clips, prepare metadata, and queue TikTok upload workflows through server-side integrations.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
          <article className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(30,26,21,0.08)] backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--ember)]">
              App Access
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">Operator dashboard</h2>
            <p className="mt-3 leading-7 text-[color:var(--muted)]">
              The dashboard requires production database and queue environment variables. Legal and app information pages remain publicly accessible for platform review.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-full bg-[color:var(--ink)] px-5 py-3 font-black text-[#fffaf0] transition hover:-translate-y-0.5 hover:bg-[color:var(--ember)]"
            >
              Open dashboard
            </Link>
          </article>

          <div className="grid gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[2rem] border border-[color:var(--line)] bg-[#fffaf0]/80 p-6 shadow-[0_18px_50px_rgba(30,26,21,0.07)] transition hover:-translate-y-0.5 hover:border-[color:var(--ember)]"
              >
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--moss)]">
                  Public page
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">{link.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
