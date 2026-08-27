export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "brand" | "accent" | "success" | "danger";
  className?: string;
}) {
  const accents = {
    default: "bg-line-strong",
    brand: "bg-brand",
    accent: "bg-accent",
    success: "bg-success",
    danger: "bg-danger",
  };

  const values = {
    default: "text-ink",
    brand: "text-brand-deep",
    accent: "text-accent",
    success: "text-success",
    danger: "text-danger",
  };

  return (
    <div className={`surface relative overflow-hidden p-4 md:p-5 ${className}`}>
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${accents[tone]}`}
        aria-hidden
      />
      <p className="pl-2 text-[0.8rem] font-medium tracking-wide text-ink-muted">
        {label}
      </p>
      <p className={`font-display pl-2 mt-2 text-2xl md:text-[1.7rem] ${values[tone]}`}>
        {value}
      </p>
      {hint ? (
        <p className="font-subtitle pl-2 mt-1.5 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
