"use client";

import { useEffect } from "react";
import { useTrackingStore } from "@/lib/store";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useTrackingStore((s) => s.hydrated);
  const setHydrated = useTrackingStore((s) => s.setHydrated);

  useEffect(() => {
    const unsub = useTrackingStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useTrackingStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, [setHydrated]);

  if (!hydrated) {
    return (
      <div className="surface flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-ink-muted">កំពុងផ្ទុកទិន្នន័យតាមដានរបស់អ្នក…</p>
      </div>
    );
  }

  return <>{children}</>;
}
