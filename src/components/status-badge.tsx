const statusStyles: Record<string, string> = {
  pending: "border-[#c49d3c] bg-[#fff4cc] text-[#6f5010]",
  queued: "border-[#7b8da8] bg-[#e8eef7] text-[#273746]",
  completed: "border-[#6c8b53] bg-[#e6efdf] text-[#39502d]",
  failed: "border-[#d45f47] bg-[#ffe4dc] text-[#8a2d1d]",
  uploading: "border-[#273746] bg-[#e8eef7] text-[#273746]",
  uploaded: "border-[#6c8b53] bg-[#e6efdf] text-[#39502d]",
  cancelled: "border-[#7b8da8] bg-[#e8eef7] text-[#273746]",
  "not queued": "border-[color:var(--line)] bg-[#fffaf0] text-[color:var(--muted)]",
  ready_to_upload: "border-[#516a43] bg-[#e6efdf] text-[#39502d]",
  uploading_to_tiktok: "border-[#273746] bg-[#e8eef7] text-[#273746]",
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
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
        dynamicStyle ?? "border-[color:var(--line)] bg-[#fffaf0] text-[color:var(--muted)]"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
