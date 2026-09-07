"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrackingStore } from "@/lib/store";

type AuthMode = "login" | "signup";

export function LoginScreen() {
  const router = useRouter();
  const login = useTrackingStore((s) => s.login);
  const signUp = useTrackingStore((s) => s.signUp);
  const profile = useTrackingStore((s) => s.profile);
  const hasAccounts = useTrackingStore((s) => Object.keys(s.accounts).length > 0);
  const [mode, setMode] = useState<AuthMode>(
    profile?.username || profile?.password || hasAccounts ? "login" : "signup"
  );
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setPassword("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const message =
      mode === "signup"
        ? signUp({ name, username, password })
        : login(username, password);
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    router.replace("/");
  }

  return (
    <div className="login-screen">
      <div className="login-screen-media" aria-hidden />
      <div className="login-screen-veil" aria-hidden />

      <form className="login-card" onSubmit={submit}>
        <header className="login-head">
          <h1 className="login-title">
            {mode === "signup" ? "បង្កើតគណនី" : "ចូលគណនី"}
          </h1>
          <p className="login-lead">ប្រព័ន្ធតាមដានការងារផ្ទាល់ខ្លួន</p>
        </header>

        <div className="login-modes" role="tablist" aria-label="auth mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            data-active={mode === "login"}
            onClick={() => switchMode("login")}
          >
            ចូល
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            data-active={mode === "signup"}
            onClick={() => switchMode("signup")}
          >
            បង្កើតគណនី
          </button>
        </div>

        <div className="login-fields">
          {mode === "signup" ? (
            <label className="login-field">
              <span>ឈ្មោះ</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="បញ្ចូលឈ្មោះ"
              />
            </label>
          ) : null}
          <label className="login-field">
            <span>ឈ្មោះអ្នកប្រើ</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="បញ្ចូលឈ្មោះអ្នកប្រើ"
            />
          </label>
          <label className="login-field">
            <span>សម្ងាត់</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="បញ្ចូលពាក្យសម្ងាត់"
            />
          </label>
        </div>

        {error ? <p className="login-error">{error}</p> : null}

        <button type="submit" className="btn login-submit" disabled={busy}>
          {busy ? "កំពុងផ្ទុក…" : mode === "signup" ? "បង្កើតគណនី" : "ចូល"}
        </button>
      </form>
    </div>
  );
}
