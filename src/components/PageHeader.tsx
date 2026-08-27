export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="page-header-title">{title}</h1>
        {subtitle ? (
          <p className="font-subtitle mt-2 max-w-2xl text-[0.9rem] text-ink-muted sm:text-[0.95rem]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="page-header-actions">{action}</div> : null}
    </div>
  );
}
