const statusStyles: Record<string, string> = {
  pending: "border-[#909378] bg-[rgba(144,147,120,0.15)] text-[#c6c9ab]",
  queued: "border-[#909378] bg-[rgba(144,147,120,0.15)] text-[#c6c9ab]",
  active: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  completed: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  failed: "border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] text-[#ffb4ab]",
  created: "border-[#909378] bg-[rgba(144,147,120,0.15)] text-[#c6c9ab]",
  stored: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  uploading: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  uploaded: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  cancelled: "border-[#909378] bg-[rgba(144,147,120,0.15)] text-[#c6c9ab]",
  publishing: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  "not queued": "border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] text-[#909378]",
  uploading_to_reap: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  processing_in_reap: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  downloading_from_reap: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  storing_clips: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  generating_caption: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
  ready_to_upload: "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]",
  uploading_to_tiktok: "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-[#dffe00]",
};

export function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const dynamicStyle =
    statusStyles[normalizedStatus] ??
    (normalizedStatus.includes("failed")
      ? statusStyles.failed
      : normalizedStatus.includes("completed") || normalizedStatus.includes("uploaded")
        ? statusStyles.completed
        : normalizedStatus.includes("queued") || normalizedStatus.includes("uploading")
          ? statusStyles.queued
          : undefined);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] ${
        dynamicStyle ?? "border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] text-[#909378]"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
