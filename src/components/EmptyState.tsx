export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-2 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
      </div>
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="font-subtitle mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
