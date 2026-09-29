const styles: Record<string, string> = {
  ACTIVE: "bg-[#eaf4f0] text-[#27745c]",
  PLANNING: "bg-[#f0f2f6] text-[#65718a]",
  ON_HOLD: "bg-[#fff4df] text-[#9a6b20]",
  COMPLETED: "bg-[#eaf4f0] text-[#27745c]",
  CANCELLED: "bg-[#f4eeee] text-[#9a5550]",
  ARCHIVED: "bg-[#f0f2f6] text-[#65718a]",
  TODO: "bg-[#f0f2f6] text-[#65718a]",
  IN_PROGRESS: "bg-[#e9f1fa] text-[#47709d]",
  REVIEW: "bg-[#f2edfb] text-[#79609f]",
  BLOCKED: "bg-[#fff0eb] text-[#a6533e]",
  REVISION_REQUIRED: "bg-[#fff4df] text-[#9a6b20]",
  URGENT: "bg-[#fff0eb] text-[#a6533e]",
  HIGH: "bg-[#fff4df] text-[#9a6b20]",
  MEDIUM: "bg-[#e9f1fa] text-[#47709d]",
  LOW: "bg-[#f0f2f6] text-[#65718a]",
};

export function StatusBadge({ value }: { value: string }) {
  const label = value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[value] ?? "bg-[#f0f2f6] text-[#65718a]"}`}>{label}</span>;
}
