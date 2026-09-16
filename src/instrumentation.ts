export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.npm_lifecycle_event === "build") return;

  setTimeout(() => {
    void import("./lib/telegramInbox")
      .then((mod) => mod.ensureTelegramRuntime())
      .catch((error) => console.error("[telegram-inbox]", error));
    void import("./lib/telegramDispatch")
      .then((mod) => mod.startTelegramDispatcher())
      .catch((error) => console.error("[telegram-dispatch]", error));
  }, 1500);
}
