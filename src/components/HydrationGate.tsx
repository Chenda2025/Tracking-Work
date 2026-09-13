"use client";

import { useEffect } from "react";
import { useTrackingStore } from "@/lib/store";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useTrackingStore((s) => s.hydrated);
  const bootstrap = useTrackingStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!hydrated) {
    return (
      <div className="surface flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-ink-muted">Loading your data...</p>
      </div>
    );
  }

  return <>{children}</>;
}
