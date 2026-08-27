export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-2 py-8 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-brand-soft" />
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="font-subtitle mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
        {description}
      </p>
    </div>
  );
}
