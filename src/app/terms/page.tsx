import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Clips Automation",
  description: "Terms of Service for Clips Automation.",
};

const lastUpdated = "May 18, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 leading-7 text-[#e2e2e1] md:px-10">
      <Link href="/" className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
        Clips Automation
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">Terms of Service</h1>
      <p className="mt-4 text-[#c6c9ab]">Last updated: {lastUpdated}</p>

      <section className="mt-10 grid gap-6 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
        <p>
          These Terms of Service govern access to and use of Clips Automation, an MVP web application for submitting videos, preparing short clips, and queueing user-directed TikTok upload workflows.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Use Of The Service</h2>
        <p>
          You may use the service only for lawful purposes and only with videos, captions, hashtags, and accounts that you own or are authorized to use. You are responsible for ensuring that your content and publishing activity comply with applicable laws and platform rules.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">User Content</h2>
        <p>
          You retain ownership of content you submit. By submitting content, you grant the app permission to process, store, transform, and transmit that content as needed to perform the requested clipping and upload workflows.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Third-Party Platforms</h2>
        <p>
          Clips Automation may interact with services such as Reap, Supabase, and TikTok. Your use of those services is also subject to their separate terms, policies, account requirements, rate limits, and review processes.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">TikTok Publishing</h2>
        <p>
          TikTok upload functionality is user-directed and requires authorized access. The app does not grant permission to publish content that violates TikTok policies, third-party rights, or applicable law.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">MVP Availability</h2>
        <p>
          The service is provided as an MVP and may include incomplete workflows, downtime, data loss, or workflow failures. The service is provided without warranties to the fullest extent permitted by law.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Limitation Of Liability</h2>
        <p>
          To the fullest extent permitted by law, the app operator is not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, content, revenue, or business opportunities arising from use of the service.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Changes</h2>
        <p>
          These Terms may be updated as the MVP evolves. Continued use of the service after updates means you accept the revised Terms.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Contact</h2>
        <p>
          For questions about these Terms, contact the operator of the TikTok developer account associated with this application.
        </p>
      </section>
    </main>
  );
}
