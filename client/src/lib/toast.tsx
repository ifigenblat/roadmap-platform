import { useCallback, useState } from "react";

export type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (
      message: string,
      tone: ToastTone = "success",
      /** ms; omit to use defaults (errors stay longer). `0` = no auto-dismiss (tap to close). */
      autoDismissMs?: number,
    ) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, message, tone }]);
      const ms =
        autoDismissMs !== undefined
          ? autoDismissMs
          : tone === "error"
            ? 18_000
            : 4000;
      if (ms > 0) {
        setTimeout(() => dismiss(id), ms);
      }
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Array<{ id: number; message: string; tone: ToastTone }>;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className={`rounded-md border px-3 py-2 text-left text-sm ${
            t.tone === "success"
              ? "border-emerald-700 bg-emerald-950/90 text-emerald-100"
              : "border-rose-700 bg-rose-950/90 text-rose-100"
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
