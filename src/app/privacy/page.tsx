import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Clips Automation",
  description: "Privacy Policy for Clips Automation.",
};

const lastUpdated = "May 18, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 leading-7 text-[#e2e2e1] md:px-10">
      <Link href="/" className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
        Clips Automation
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">Privacy Policy</h1>
      <p className="mt-4 text-[#c6c9ab]">Last updated: {lastUpdated}</p>

      <section className="mt-10 grid gap-6 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
        <p>
          Clips Automation is an MVP web application that helps users submit videos, prepare short clips, and queue TikTok uploads. This Privacy Policy explains what information the app processes and how it is used.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Information We Process</h2>
        <p>
          The app may process account identifiers, video files or video URLs submitted by users, generated clip files, titles, captions, hashtags, TikTok upload status, platform response metadata, logs, and basic technical information needed to operate the service.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">How Information Is Used</h2>
        <p>
          Information is used to create video processing jobs, store source videos and generated clips, prepare metadata, queue TikTok uploads requested by the user, troubleshoot failed jobs, and maintain the security and reliability of the app.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Third-Party Services</h2>
        <p>
          The app may use third-party services such as Supabase for storage and database infrastructure, Reap for user-directed video clipping and publish workflows, and TikTok for authorized publishing workflows. These providers process data according to their own terms and privacy policies.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Sharing</h2>
        <p>
          We do not sell personal information. Data is shared only as needed to operate user-requested workflows, comply with legal obligations, protect the service, or work with service providers that support the app.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Data Retention And Deletion</h2>
        <p>
          Source videos, generated clips, job records, and logs are retained only as long as needed for the MVP workflow, debugging, security, or legal requirements. Users may request deletion of their submitted content and related records by contacting the app operator.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Security</h2>
        <p>
          The app is designed to keep API keys, OAuth tokens, storage service keys, and other server-side credentials out of frontend code. No system can guarantee perfect security, but reasonable technical and organizational measures are used to protect the service.
        </p>

        <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Contact</h2>
        <p>
          For privacy requests or questions, contact the operator of the TikTok developer account associated with this application.
        </p>
      </section>
    </main>
  );
}
