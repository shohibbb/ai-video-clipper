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
    <div className="w-full max-w-[13rem] self-start justify-self-center overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--ink)] text-[#fffaf0] shadow-[0_24px_70px_rgba(30,26,21,0.18)] lg:justify-self-start">
      <div className="relative aspect-[9/16] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(232,85,47,0.35),transparent_32%),linear-gradient(160deg,#1e1a15,#273746)]">
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
              <p className="text-xs font-black uppercase tracking-[0.34em] text-[#f2a17f]">Preview pending</p>
              <h3 className="mt-3 text-3xl font-black tracking-[-0.06em]">{title || "Clip preview"}</h3>
              <p className="mt-4 text-sm leading-6 text-[#e8ddc8]">
                {previewError || "No preview URL is available yet. Once storage paths or signed URLs are ready, the clip will play here."}
              </p>
            </div>
            <p className="break-all text-xs text-[#cdbf9e]">{storagePath || "No storage path yet"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
