"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; text?: string; kind: "info" | "error" | "success" | "warning" };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-3 z-[60] flex w-[min(92vw,360px)] flex-col gap-2 md:bottom-4" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border bg-panel-2 px-4 py-3 text-sm shadow-xl",
              t.kind === "error" && "border-red-500/40",
              t.kind === "success" && "border-green-500/40",
              t.kind === "warning" && "border-amber-500/40",
              t.kind === "info" && "border-border",
            )}
          >
            <div className="font-medium">{t.title}</div>
            {t.text ? <div className="mt-0.5 text-xs text-muted">{t.text}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
