import { AppShell } from "@/components/app-shell";
import { VideoSubmitForm } from "@/components/video-submit-form";

export default function NewVideoPage() {
  return (
    <AppShell
      eyebrow="New Task"
      title="Drop in a source video and queue the first cut."
      description="Submit a URL or upload an MP4, MOV, or WEBM source file. Uploaded files are stored through the server-side storage service before queueing."
      activeHref="/videos/new"
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <VideoSubmitForm />
        </div>

        <aside className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl lg:col-span-4">
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">Guardrails</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">MVP processing lane</h2>
          <div className="mt-5 grid gap-4 text-sm leading-7 text-[#c6c9ab]">
            <p>Only TikTok is exposed as a target because the project brief keeps YouTube and Instagram out of this MVP slice.</p>
            <p>File uploads go through the server-side Supabase Storage adapter; service role keys never go to the browser.</p>
            <p>Reap API handles clip generation and TikTok publishing through Reap Publish. No Composio or browser automation is used.</p>
          </div>
          <div className="mt-6 grid gap-3">
            {["Create DB record", "Enqueue BullMQ job", "Worker sends to Reap", "Store clips server-side"].map((item) => (
              <div key={item} className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-3">
                <p className="font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-white">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
