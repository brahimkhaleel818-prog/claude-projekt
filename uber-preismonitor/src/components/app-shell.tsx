"use client";
import { Activity, Bell, BarChart3, Gauge, LogOut, Route as RouteIcon, Server } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, cn } from "@/lib/utils";
import { ToastProvider, useToast } from "./toast";
import { Badge } from "./ui/badge";

const NAV = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/analyse", label: "Analyse", icon: BarChart3 },
  { href: "/strecken", label: "Strecken", icon: RouteIcon },
  { href: "/alarme", label: "Alarme", icon: Bell },
  { href: "/status", label: "Status", icon: Server },
];

export interface ShellData {
  provider: { id: string; label: string; isLive: boolean; isDemo: boolean; configured: boolean; reason?: string };
  worker: { alive: boolean; beatAt: string } | null;
  unread: number;
  fresh: Array<{ id: string; title: string; message: string; level: string }>;
  serverTime: string;
}

export function ProviderBadge({ p }: { p: ShellData["provider"] | undefined }) {
  if (!p) return null;
  if (p.isDemo) return <Badge variant="demo">DEMO-DATEN</Badge>;
  if (p.isLive && p.configured) return <Badge variant="live"><span className="size-1.5 rounded-full bg-blue-400" />Live · {p.id}</Badge>;
  return <Badge variant="error">Keine Datenquelle</Badge>;
}

function Inner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const since = useRef<string | null>(null);
  const toast = useToast();
  const [data, setData] = useState<ShellData | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await api<ShellData>(`/api/shell${since.current ? `?since=${encodeURIComponent(since.current)}` : ""}`);
        if (stop) return;
        if (since.current) {
          for (const n of d.fresh) {
            toast({ title: n.title, text: n.message, kind: n.level === "error" ? "error" : n.level === "warning" ? "warning" : "info" });
            if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
              new Notification(n.title, { body: n.message, icon: "/icon.svg" });
            }
          }
        }
        since.current = d.serverTime;
        setData(d);
      } catch {
        /* Netzwerkfehler ignorieren – nächster Versuch folgt */
      }
    };
    tick();
    const t = setInterval(tick, 20_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [toast]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-panel/60 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-white text-zinc-950"><Activity className="size-4" /></div>
          <div>
            <div className="text-sm font-semibold leading-tight">Uber Alkhaled</div>
            <div className="text-[11px] text-muted">Preisüberwachung · Düsseldorf</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
                {n.href === "/alarme" && data?.unread ? <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{data.unread}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border pt-4 text-xs text-muted">
          <div className="flex items-center justify-between"><span>Quelle</span><ProviderBadge p={data?.provider} /></div>
          <div className="flex items-center justify-between">
            <span>Worker</span>
            {data?.worker?.alive ? <Badge variant="up">läuft</Badge> : <Badge variant="error">offline</Badge>}
          </div>
          <button onClick={logout} className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <LogOut className="size-3.5" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-white text-zinc-950"><Activity className="size-3.5" /></div>
            <span className="text-sm font-semibold">Uber Alkhaled</span>
          </div>
          <div className="flex items-center gap-2">
            <ProviderBadge p={data?.provider} />
            {data?.worker?.alive ? <span className="size-2 rounded-full bg-up" title="Worker läuft" /> : <span className="size-2 rounded-full bg-down" title="Worker offline" />}
            <button onClick={logout} aria-label="Abmelden" className="p-1 text-zinc-400"><LogOut className="size-4" /></button>
          </div>
        </header>

        {data?.provider.isDemo ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
            <strong>DEMO-MODUS:</strong> Alle Preise sind SIMULIERT und keine echten Uber-Preise. Für echte Daten eine Uber-API-Freigabe einrichten (Status → Einrichtung).
          </div>
        ) : data && !data.provider.configured ? (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-200">
            <strong>Keine Live-Datenquelle aktiv:</strong> {data.provider.reason} Aktuelle Preise werden als „Nicht verfügbar“ angezeigt.
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-24 pt-4 sm:px-6 md:pb-10 md:pt-6">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-panel/95 backdrop-blur md:hidden">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-white" : "text-zinc-500")}>
                <n.icon className="size-5" />
                {n.label}
                {n.href === "/alarme" && data?.unread ? <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-red-500" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Inner>{children}</Inner>
    </ToastProvider>
  );
}
