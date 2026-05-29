import { StatusBadge } from "@/components/status-badge";

export function ClipPreview({
  title,
  status,
  previewUrl,
  storagePath,
  previewError,
}: {
  title?: string | null;
  status: string;
  previewUrl?: string | null;
  storagePath?: string | null;
  previewError?: string | null;
}) {
  return (
    <div className="w-full max-w-[13rem] self-start justify-self-center overflow-hidden rounded-xl border border-[rgba(223,254,0,0.15)] bg-[#0b0a09] text-[#e2e2e1] shadow-[0_24px_70px_rgba(0,0,0,0.40)] lg:justify-self-start">
      <div className="relative aspect-[9/16] overflow-hidden bg-[linear-gradient(160deg,#0b0a09,#1e2020)]">
        {previewUrl ? (
          <video
            src={previewUrl}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover object-center"
            aria-label={title ?? "Clip preview"}
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-5">
            <div className="flex justify-end">
              <StatusBadge status={status} />
            </div>
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">Preview pending</p>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em]">{title || "Clip preview"}</h3>
              <p className="mt-4 text-sm leading-6 text-[#c6c9ab]">
                {previewError || "No preview URL is available yet. Once storage paths or signed URLs are ready, the clip will play here."}
              </p>
            </div>
            <p className="break-all font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-[#909378]">{storagePath || "No storage path yet"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
