export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ember" | "moss" | "steel";
}) {
  const toneClass = {
    neutral: "text-white",
    ember: "border-[#ffb4ab] bg-[rgba(255,180,171,0.08)] text-[#ffb4ab]",
    moss: "border-[#dffe00] text-[#dffe00]",
    steel: "border-[#39ff14] text-[#39ff14]",
  }[tone];

  return (
    <article className={`rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl ${toneClass}`}>
      <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#c6c9ab]">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em]">{value}</p>
    </article>
  );
}
