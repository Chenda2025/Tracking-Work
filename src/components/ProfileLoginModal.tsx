"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, LogOut, Send, User, UserRound } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { useTrackingStore } from "@/lib/store";

type ProfilePanel = "name" | "password" | "photo" | null;

function profileInitial(name?: string | null): string {
  const value = (name ?? "").trim();
  return value ? [...value][0] ?? "" : "";
}

async function readProfilePhoto(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 256;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

function ProfileAvatar({
  name,
  photo,
  size = 20,
}: {
  name?: string;
  photo?: string;
  size?: number;
}) {
  if (photo) {
    return <img src={photo} alt="" className="profile-avatar-photo" />;
  }
  const initial = profileInitial(name);
  return initial ? (
    <span aria-hidden>{initial}</span>
  ) : (
    <User size={size} strokeWidth={1.9} />
  );
}

export function ProfileButton({
  className = "app-topbar-profile",
}: {
  className?: string;
}) {
  const router = useRouter();
  const signOut = useTrackingStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<ProfilePanel>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const profile = useTrackingStore((s) => s.profile);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openPanel(next: ProfilePanel) {
    setMenuOpen(false);
    setPanel(next);
  }

  return (
    <div className="profile-anchor" ref={wrapRef}>
      <button
        type="button"
        className={className}
        aria-label={profile ? `ប្រវត្តិរូប ${profile.name}` : "ចូលគណនី"}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <ProfileAvatar name={profile?.name} photo={profile?.photo} />
      </button>

      {profile && menuOpen ? (
        <div className="profile-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => openPanel("name")}>
            <UserRound size={16} strokeWidth={1.9} />
            <span>ប្តូរឈ្មោះ</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openPanel("password")}
          >
            <KeyRound size={16} strokeWidth={1.9} />
            <span>ប្តូរពាក្យសម្ងាត់</span>
          </button>
          <button type="button" role="menuitem" onClick={() => openPanel("photo")}>
            <Camera size={16} strokeWidth={1.9} />
            <span>បន្ថែមរូប</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setTelegramOpen(true);
            }}
          >
            <Send size={16} strokeWidth={1.9} />
            <span>កំណត់ Telegram</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              signOut();
              router.replace("/login");
            }}
          >
            <LogOut size={16} strokeWidth={1.9} />
            <span>ចាកចេញ</span>
          </button>
        </div>
      ) : null}
      <ChangeNameModal open={panel === "name"} onClose={() => setPanel(null)} />
      <ChangePasswordModal
        open={panel === "password"}
        onClose={() => setPanel(null)}
      />
      <AddPhotoModal open={panel === "photo"} onClose={() => setPanel(null)} />
      <TelegramConfigModal
        open={telegramOpen}
        onClose={() => setTelegramOpen(false)}
      />
    </div>
  );
}

export function ProfileLoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setProfile = useTrackingStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setPassword("");
    setError("");
  }, [open]);

  function login(e: FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("បញ្ចូលឈ្មោះ");
      return;
    }
    if (!password.trim()) {
      setError("បញ្ចូលពាក្យសម្ងាត់");
      return;
    }
    setProfile({ name: nextName, password });
    onClose();
  }

  return (
    <Modal open={open} title="ចូលគណនី" onClose={onClose} size="sm">
      <form className="profile-login" onSubmit={login}>
        <section className="event-card">
          <label className="event-row">
            <span className="event-row-label">ឈ្មោះ</span>
            <input
              className="event-row-input"
              type="text"
              autoComplete="username"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="event-row">
            <span className="event-row-label">សម្ងាត់</span>
            <input
              className="event-row-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </section>
        {error ? <p className="profile-login-error">{error}</p> : null}
        <div className="profile-login-actions">
          <button type="submit" className="btn btn-primary">
            ចូល
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangeNameModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const profile = useTrackingStore((s) => s.profile);
  const setProfile = useTrackingStore((s) => s.setProfile);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setError("");
  }, [open, profile?.name]);

  function save(e: FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("បញ្ចូលឈ្មោះ");
      return;
    }
    setProfile({ name: nextName });
    onClose();
  }

  return (
    <Modal open={open} title="ប្តូរឈ្មោះ" onClose={onClose} size="sm">
      <form className="profile-login" onSubmit={save}>
        <section className="event-card">
          <label className="event-row">
            <span className="event-row-label">ឈ្មោះ</span>
            <input
              className="event-row-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </section>
        {error ? <p className="profile-login-error">{error}</p> : null}
        <div className="profile-login-actions">
          <button type="submit" className="btn btn-primary">
            រក្សាទុក
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const profile = useTrackingStore((s) => s.profile);
  const setProfile = useTrackingStore((s) => s.setProfile);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const hasCurrent = Boolean(profile?.password);

  useEffect(() => {
    if (!open) return;
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
  }, [open]);

  function save(e: FormEvent) {
    e.preventDefault();
    if (hasCurrent && current !== profile?.password) {
      setError("ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រូវ");
      return;
    }
    if (!next.trim()) {
      setError("បញ្ចូលពាក្យសម្ងាត់ថ្មី");
      return;
    }
    if (next !== confirm) {
      setError("ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នា");
      return;
    }
    setProfile({ password: next });
    onClose();
  }

  return (
    <Modal open={open} title="ប្តូរពាក្យសម្ងាត់" onClose={onClose} size="sm">
      <form className="profile-login" onSubmit={save}>
        <section className="event-card">
          {hasCurrent ? (
            <label className="event-row">
              <span className="event-row-label">ចាស់</span>
              <input
                className="event-row-input"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
          ) : null}
          <label className="event-row">
            <span className="event-row-label">ថ្មី</span>
            <input
              className="event-row-input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="event-row">
            <span className="event-row-label">ម្តងទៀត</span>
            <input
              className="event-row-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        </section>
        {error ? <p className="profile-login-error">{error}</p> : null}
        <div className="profile-login-actions">
          <button type="submit" className="btn btn-primary">
            រក្សាទុក
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddPhotoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const profile = useTrackingStore((s) => s.profile);
  const setProfile = useTrackingStore((s) => s.setProfile);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(profile?.photo ?? "");
    setError("");
    setBusy(false);
  }, [open, profile?.photo]);

  async function onFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("សូមជ្រើសរូបភាព");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await readProfilePhoto(file);
      if (!data) throw new Error("empty");
      setPreview(data);
    } catch {
      setError("មិនអាចអានរូបបាន");
    } finally {
      setBusy(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!preview) {
      setError("សូមបន្ថែមរូប");
      return;
    }
    setProfile({ photo: preview });
    onClose();
  }

  return (
    <Modal open={open} title="បន្ថែមរូប" onClose={onClose} size="sm">
      <form className="profile-login" onSubmit={save}>
        <div className="profile-photo-preview">
          <span className="profile-login-avatar">
            <ProfileAvatar
              name={profile?.name}
              photo={preview || profile?.photo}
              size={28}
            />
          </span>
          <label className="btn btn-secondary">
            ជ្រើសរូប
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void onFile(file);
              }}
            />
          </label>
        </div>
        {error ? <p className="profile-login-error">{error}</p> : null}
        <div className="profile-login-actions">
          {profile?.photo ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setProfile({ photo: "" });
                onClose();
              }}
            >
              លុបរូប
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            រក្សាទុក
          </button>
        </div>
      </form>
    </Modal>
  );
}
