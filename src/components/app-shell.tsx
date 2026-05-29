import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/videos/new", label: "Add Video" },
  { href: "/videos", label: "Videos" },
  { href: "/settings/integrations", label: "Integrations" },
];

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M10 21h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20c1.1-3.2 3.5-5 7-5s5.9 1.8 7 5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function renderTitle(title: string) {
  const highlight = "TikTok-ready";

  if (!title.includes(highlight)) {
    return title;
  }

  const [before, after] = title.split(highlight);

  return (
    <>
      {before}
      <span className="italic text-[#dffe00]">{highlight}</span>
      {after}
    </>
  );
}

export function AppShell({
  children,
  eyebrow,
  title,
  description,
  activeHref = "/dashboard",
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  activeHref?: string;
}) {
  return (
    <div className="min-h-screen text-[#e2e2e1]">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(69,73,50,0.35)] bg-[#121414]/85 shadow-sm shadow-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between px-5 md:px-10">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/dashboard" className="shrink-0 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.06em] text-[#dffe00] transition hover:text-[#39ff14]">
              AI Video Clipper
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 pb-1 font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] transition-colors ${
                    activeHref === item.href
                      ? "border-[#dffe00] text-[#dffe00]"
                      : "border-transparent text-[#c6c9ab] hover:text-[#dffe00]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <label className="relative hidden lg:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c6c9ab]">
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder="Search tasks..."
                className="h-10 w-64 rounded-lg border border-transparent bg-[#161514]/70 pl-10 pr-4 text-sm text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[rgba(223,254,0,0.35)] focus:bg-[#161514]"
              />
            </label>
            <button type="button" aria-label="Notifications" className="text-[#c6c9ab] transition hover:text-[#dffe00] active:scale-95">
              <BellIcon />
            </button>
            <button type="button" aria-label="Account" className="text-[#c6c9ab] transition hover:text-[#dffe00] active:scale-95">
              <UserIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-5 pb-24 pt-32 md:px-10">
        <section className="mb-12 max-w-3xl">
          <p className="mb-3 block font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.4em] text-[#dffe00]/70">{eyebrow}</p>
          <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-[2.5rem] font-black leading-[3rem] tracking-[-0.04em] text-white md:text-5xl md:leading-[3.5rem]">
            {renderTitle(title)}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#c6c9ab]">{description}</p>
        </section>

        {children}
      </main>

      {activeHref !== "/videos/new" ? (
        <Link
          href="/videos/new"
          aria-label="New clip task"
          className="group fixed bottom-8 right-8 z-40 hidden size-14 items-center justify-center rounded-full bg-[#d3f000] font-[family-name:var(--font-display)] text-4xl font-black leading-none text-[#2c3400] shadow-[0_18px_50px_rgba(223,254,0,0.20)] transition hover:scale-110 hover:bg-[#39ff14] active:scale-95 sm:inline-flex"
        >
          <span className="-mt-1">+</span>
          <span className="pointer-events-none absolute right-16 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#333535] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#e2e2e1] opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.30)] transition-opacity group-hover:opacity-100">
            New clip task
          </span>
        </Link>
      ) : null}

      <footer className="border-t border-[rgba(69,73,50,0.20)] bg-[#121414]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 py-12 text-[#909378] md:flex-row md:items-center md:justify-between md:px-10">
          <div className="grid gap-2">
            <span className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.06em] text-[#dffe00]">AI Video Clipper</span>
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase leading-4 tracking-[0.25em]">Reap API -&gt; Storage -&gt; TikTok Publish</span>
          </div>
          <nav className="flex flex-wrap gap-6">
            {[
              ["Terms", "/terms"],
              ["Privacy", "/privacy"],
              ["Videos", "/videos"],
              ["Integrations", "/settings/integrations"],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#c6c9ab] transition hover:text-[#dffe00]">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
