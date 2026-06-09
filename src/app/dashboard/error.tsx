"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center text-[#e2e2e1]">
      <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#ffb4ab]">
        Dashboard unavailable
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-black text-white">
        The database is temporarily busy.
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-[#c6c9ab]">
        The dashboard could not load its task summary. Wait a moment, then retry the request.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#d3f000] px-6 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dffe00]"
      >
        Retry dashboard
      </button>
      {error.digest ? (
        <p className="mt-6 font-[family-name:var(--font-mono)] text-xs text-[#81866f]">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
