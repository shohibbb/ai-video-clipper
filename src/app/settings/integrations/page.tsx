import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getIntegrations } from "@/lib/reap/api";
import { getReapConfig } from "@/lib/reap/config";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireCurrentUser();

  let reapIntegrations: { id: string; platform: string; isActive: boolean; username: string; name: string }[] = [];
  let reapError: string | null = null;
  let reapConnected = false;

  try {
    const config = getReapConfig();
    if (config.apiKey) {
      const response = await getIntegrations();
      reapIntegrations = response.integrations.map((i) => ({
        id: i.id,
        platform: i.platform,
        isActive: i.isActive,
        username: i.username,
        name: i.name,
      }));
      reapConnected = true;
    }
  } catch (error) {
    reapError = error instanceof Error ? error.message : "Failed to check Reap integrations.";
  }

  const tiktokIntegration = reapIntegrations.find((i) => i.platform === "tiktok" && i.isActive);
  const reapAppUrl = process.env.REAP_APP_URL ?? "https://reap.video";

  return (
    <AppShell
      eyebrow="Settings"
      title="Reap clips, publish to TikTok."
      description="Connect your Reap account and TikTok integration to start clipping and publishing."
      activeHref="/settings/integrations"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
          <p className={`font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] ${reapConnected ? "text-[#dffe00]" : "text-[#c6c9ab]"}`}>
            {reapConnected ? "Connected" : "Not configured"}
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">Reap API</h2>
          <p className="mt-4 leading-7 text-[#c6c9ab]">
            {reapConnected
              ? "Your REAP_API_KEY is set. The worker can create clips and publish to TikTok through Reap."
              : "Set REAP_API_KEY in your .env file to enable clip generation and TikTok publishing."}
          </p>
          {reapError && (
            <p className="mt-2 text-sm font-bold text-[#ffb4ab]">{reapError}</p>
          )}
        </article>

        <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
          <p className={`font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] ${tiktokIntegration ? "text-[#dffe00]" : "text-[#ffb4ab]"}`}>
            {tiktokIntegration ? "Active" : "Not connected"}
          </p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">TikTok (via Reap)</h2>
          <p className="mt-4 leading-7 text-[#c6c9ab]">
            {tiktokIntegration
              ? `Connected as @${tiktokIntegration.username}. Clips can be published directly to TikTok.`
              : `Connect your TikTok account at ${reapAppUrl}/settings/integrations to enable publishing.`}
          </p>
        </article>

        <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">Ready</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">Storage Provider</h2>
          <p className="mt-4 leading-7 text-[#c6c9ab]">
            Server-side uploads use Supabase Storage. Cloudflare R2 can be added behind the same storage interface later.
          </p>
        </article>

        <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">Active</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">Redis / BullMQ</h2>
          <p className="mt-4 leading-7 text-[#c6c9ab]">
            Jobs are enqueued in BullMQ and processed by background workers for Reap submission, webhook-triggered clip download, polling fallback, and publishing.
          </p>
        </article>

        <article className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl md:col-span-2">
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#c6c9ab]">Setup Required</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">Reap Webhook</h2>
          <p className="mt-4 leading-7 text-[#c6c9ab]">
            Webhooks are the primary completion signal. A quota-conscious polling fallback starts after fifteen minutes and checks every five minutes only when the webhook has not already queued clip download work.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
              <p className="font-black text-[#dffe00]">For Local Development (ngrok)</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#c6c9ab]">
                <li>Install ngrok: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">npm install -g ngrok</code> atau download dari ngrok.com</li>
                <li>Login ke ngrok: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">ngrok config add-authtoken YOUR_TOKEN</code></li>
                <li>Jalankan tunnel: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">ngrok http 3000</code></li>
                <li>Copy HTTPS URL (misal: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">https://xxxx.ngrok-free.app</code>)</li>
                <li>Buka <a href={reapAppUrl} target="_blank" rel="noopener noreferrer" className="text-[#dffe00] underline">{reapAppUrl.replace("https://", "")}</a> → Profile → Settings → Webhooks</li>
                <li>Tambahkan webhook URL: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">https://xxxx.ngrok-free.app/api/reap/webhook</code></li>
                <li>Pastikan webhook aktif ✅</li>
              </ol>
            </div>

            <div className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
              <p className="font-black text-[#dffe00]">For Production</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#c6c9ab]">
                <li>Pastikan domain kamu punya SSL/HTTPS (wajib untuk webhook)</li>
                <li>Di Reap dashboard, tambahkan webhook URL: <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">https://your-domain.com/api/reap/webhook</code></li>
                <li>Reap akan kirim callback saat project selesai processing</li>
              </ol>
            </div>

            <div className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
              <p className="font-black text-[#dffe00]">Important Notes</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#c6c9ab]">
                <li>Reap requires HTTPS endpoint (ngrok provides this automatically)</li>
                <li>Webhook must respond 200 within 5 seconds (validation) or 10 seconds (live)</li>
                <li>5 consecutive failures will auto-disable the webhook in Reap</li>
                <li>Reap does NOT retry failed deliveries; delayed polling recovers missed events automatically</li>
                <li>Free Reap plan: 0 webhooks. Creator plan: 1 webhook. Studio plan: 5 webhooks.</li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </AppShell>
  );
}
