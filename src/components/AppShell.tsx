"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Goal, House, Wallet } from "lucide-react";
import { ProfileButton } from "@/components/ProfileLoginModal";
import { TelegramDailyScheduler } from "@/components/TelegramDailyScheduler";
import { useTrackingStore } from "@/lib/store";
import {
  formatKhmerLunarDateTime,
  type KhmerDateTimeStamp,
} from "@/lib/utils";

const links = [
  { href: "/", label: "ទិដ្ឋភាព", short: "ទូទៅ", icon: House, match: "exact" as const },
  {
    href: "/calendar",
    label: "ប្រតិទិន",
    short: "ប្រតិទិន",
    icon: CalendarDays,
    match: "prefix" as const,
  },
  {
    href: "/finance",
    label: "ចំណូល និង ចំណាយ",
    short: "លុយ",
    icon: Wallet,
    match: "prefix" as const,
  },
  {
    href: "/goals",
    label: "គោលដៅគ្រួសារ",
    short: "គោលដៅ",
    icon: Goal,
    match: "prefix" as const,
  },
];

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  return match === "exact" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useTrackingStore((s) => s.hydrated);
  const signedIn = useTrackingStore((s) => s.signedIn);
  const [nowStamp, setNowStamp] = useState<KhmerDateTimeStamp | null>(null);
  const isLogin = pathname === "/login";

  useEffect(() => {
    const tick = () => setNowStamp(formatKhmerLunarDateTime(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!signedIn && !isLogin) router.replace("/login");
    if (signedIn && isLogin) router.replace("/");
  }, [hydrated, signedIn, isLogin, router]);

  if (!hydrated || (!signedIn && !isLogin) || (signedIn && isLogin)) {
    return (
      <div className="app-shell is-auth">
        <div className="login-screen">
          <p className="login-loading">កំពុងផ្ទុក…</p>
        </div>
      </div>
    );
  }

  if (isLogin) {
    return <div className="app-shell is-auth">{children}</div>;
  }

  return (
    <div className="app-shell">
      <TelegramDailyScheduler />
      {/* Laptop / desktop sidebar */}
      <aside className="app-sidebar" aria-label="ម៉ឺនុយមេ">
        <div className="surface app-sidebar-panel">
          <div className="mb-6 px-2 pt-1 app-sidebar-brand">
            <div>
              <p className="font-display text-[1.65rem] text-brand">ថេរ</p>
              <p className="font-subtitle mt-1 text-[0.8rem] leading-snug text-ink-muted">
                ប្រព័ន្ធតាមដានការងារផ្ទាល់ខ្លួន
              </p>
            </div>
            <ProfileButton className="app-sidebar-profile" />
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {links.map(({ href, label, icon: Icon, match }) => {
              const active = isActive(pathname, href, match);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 ${
                    active
                      ? "bg-brand-soft text-brand-deep"
                      : "text-ink-muted hover:bg-bg-elevated hover:text-ink"
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} />
                  <span className="leading-snug">{label}</span>
                </Link>
              );
            })}
          </nav>

          <p className="font-subtitle mt-4 border-t border-line px-2 pt-4 text-[0.8rem] text-ink-soft">
            ប្រតិទិន · លុយ · គោលដៅគ្រួសារ
          </p>
        </div>
      </aside>

      <div className="app-main-column">
        {/* Phone / iPad top brand bar */}
        <header className="app-topbar">
          <div className="app-topbar-row">
            <h1 className="app-topbar-title">ការងារប្រចាំថ្ងៃ</h1>
            <ProfileButton />
          </div>
          {nowStamp ? (
            <p
              className="app-topbar-datetime"
              aria-live="polite"
              aria-label={nowStamp.label}
            >
              <span className="app-topbar-date-line">
                <span>{nowStamp.weekday}</span>
                <i aria-hidden />
                <span>{nowStamp.moon}</span>
                <i aria-hidden />
                <span>{nowStamp.month}</span>
                <i aria-hidden />
                <span>{nowStamp.year}</span>
                <i aria-hidden />
                <span>{nowStamp.sak}</span>
                <i aria-hidden />
                <span>{nowStamp.be}</span>
                <i aria-hidden />
                <span>{nowStamp.solar}</span>
                {nowStamp.observance ? (
                  <>
                    <i aria-hidden />
                    <span>{nowStamp.observance}</span>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}
        </header>

        <main className="app-main">{children}</main>
      </div>

      {/* Phone / iPad bottom navigation */}
      <nav className="app-bottom-nav" aria-label="ម៉ឺនុយចល័ត">
        {links.map(({ href, short, icon: Icon, match }) => {
          const active = isActive(pathname, href, match);
          return (
            <Link
              key={href}
              href={href}
              className={`app-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.35 : 1.75} />
              <span>{short}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
