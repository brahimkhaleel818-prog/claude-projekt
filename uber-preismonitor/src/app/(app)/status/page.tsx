"use client";
import { ExternalLink, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RunStatusBadge } from "@/components/status-badge";
import { usePoll } from "@/lib/hooks";
import { api } from "@/lib/utils";

interface StatusResp {
  provider: { id: string; label: string; isLive: boolean; isDemo: boolean; configured: boolean; reason?: string; description: string; knownCategories: string[] };
  limits: { perMinute: number; perHour: number; minIntervalMinutes: number; onlyUpfrontFares: boolean; maxRetries: number };
  worker: { beatAt: string; startedAt: string; alive: boolean; provider: string; info: { runs: number; success: number; failed: number; noData: number; running: number; lastError: string | null; limiter: { lastMinute: number; lastHour: number; pausedUntil: string | null } } } | null;
  channels: Record<string, boolean>;
  runs: Array<{ id: string; status: string; provider: string; isDemo: boolean; attempts: number; httpStatus: number | null; errorMessage: string | null; productCount: number; durationMs: number | null; startedAt: string; route: { name: string } }>;
  counts: Array<{ provider: string; priceType: string; isDemo: boolean; _count: number }>;
  demoCount: number;
}

const dt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function StatusPage() {
  const toast = useToast();
  const { data, reload } = usePoll<StatusResp>("/api/status", 15_000);
  if (!data) return null;
  const w = data.worker;

  const clearDemo = async () => {
    if (!confirm("Alle simulierten Demo-Daten löschen? Echte und manuelle Messungen bleiben erhalten.")) return;
    const r = await api<{ measurements: number }>("/api/demo-data", { method: "DELETE" });
    toast({ kind: "success", title: "Demo-Daten gelöscht", text: `${r.measurements} Messwerte entfernt` });
    reload();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">System & Datenquelle</h1>
        <p className="text-sm text-muted">Transparenz darüber, woher die Preise stammen und ob die Überwachung läuft.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div><CardTitle>Preis-Datenquelle</CardTitle><CardDescription>{data.provider.description}</CardDescription></div>
            {data.provider.isDemo ? <Badge variant="demo">DEMO</Badge> : data.provider.configured ? <Badge variant="live">Live</Badge> : <Badge variant="error">nicht verfügbar</Badge>}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Quelle" v={`${data.provider.label} (${data.provider.id})`} />
            <Row k="Status" v={data.provider.configured ? "konfiguriert" : `nicht konfiguriert – ${data.provider.reason ?? ""}`} />
            <Row k="Kategorien" v={data.provider.knownCategories.join(", ") || "–"} />
            <Row k="Rate-Limit" v={`${data.limits.perMinute}/Min · ${data.limits.perHour}/Std · min. Intervall ${data.limits.minIntervalMinutes} Min.`} />
            <Row k="Wiederholungen" v={`${data.limits.maxRetries} (exponentielles Backoff)`} />
            <Row k="Nur Festpreise" v={data.limits.onlyUpfrontFares ? "ja – Preisspannen werden verworfen" : "nein – Spannen werden als „Schätzung“ markiert"} />
            {!data.provider.isLive || !data.provider.configured ? (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100">
                <strong>Echte Uber-Preise einrichten:</strong> Uber gibt Fahrpreise nur über freigeschaltete APIs heraus (Uber for Business – Guest Rides API). Schritt-für-Schritt-Anleitung: <code>docs/UBER-API-ZUGANG.md</code>. Danach <code>PRICE_PROVIDER=uber-guest-rides</code> setzen und mit <code>npm run probe:uber</code> testen.
                <div className="mt-2 flex flex-wrap gap-3">
                  <a className="inline-flex items-center gap-1 underline" href="https://developer.uber.com/docs/guest-rides/references/api/v1/guest-trips-estimates-post" target="_blank" rel="noreferrer">Guest Rides API <ExternalLink className="size-3" /></a>
                  <a className="inline-flex items-center gap-1 underline" href="https://www.uber.com/de/de/business/" target="_blank" rel="noreferrer">Uber for Business <ExternalLink className="size-3" /></a>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div><CardTitle>Background-Worker</CardTitle><CardDescription>Läuft unabhängig vom Browser rund um die Uhr</CardDescription></div>
            {w?.alive ? <Badge variant="up">läuft</Badge> : <Badge variant="error">offline</Badge>}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {w ? (
              <>
                <Row k="Letztes Lebenszeichen" v={dt.format(new Date(w.beatAt))} />
                <Row k="Gestartet" v={dt.format(new Date(w.startedAt))} />
                <Row k="Läufe seit Start" v={`${w.info.runs} (✓ ${w.info.success} · ohne Preis ${w.info.noData} · ✗ ${w.info.failed})`} />
                <Row k="Anfragen" v={`${w.info.limiter.lastMinute} in letzter Minute · ${w.info.limiter.lastHour} in letzter Stunde`} />
                {w.info.limiter.pausedUntil ? <Row k="Pausiert bis" v={dt.format(new Date(w.info.limiter.pausedUntil))} /> : null}
                {w.info.lastError ? <Row k="Letzter Fehler" v={w.info.lastError} /> : null}
              </>
            ) : (
              <p className="text-muted">Noch kein Worker gestartet (<code>npm run worker</code> bzw. Docker-Service „worker“).</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div><CardTitle>Gespeicherte Messwerte nach Herkunft</CardTitle></div>
          {data.demoCount > 0 ? <Button variant="destructive" size="sm" onClick={clearDemo}><Trash2 /> Demo-Daten löschen ({data.demoCount})</Button> : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.counts.length === 0 ? <span className="text-sm text-muted">Noch keine Messwerte.</span> : null}
          {data.counts.map((c) => (
            <Badge key={`${c.provider}-${c.priceType}-${c.isDemo}`} variant={c.isDemo ? "demo" : "default"}>{c.provider} · {c.priceType}: {c._count}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Letzte Abfragen</CardTitle><CardDescription>Jede Abfrage wird protokolliert – auch fehlgeschlagene</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto px-0 scrollbar-thin sm:px-0">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="text-left uppercase tracking-wider text-muted"><tr className="border-b border-border"><th className="px-5 py-2 font-medium">Zeit</th><th className="px-3 py-2 font-medium">Strecke</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Quelle</th><th className="px-3 py-2 font-medium">Versuche</th><th className="px-3 py-2 font-medium">HTTP</th><th className="px-3 py-2 font-medium">Produkte</th><th className="px-5 py-2 font-medium">Meldung</th></tr></thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="whitespace-nowrap px-5 py-2 text-zinc-400">{dt.format(new Date(r.startedAt))}</td>
                  <td className="px-3 py-2">{r.route.name}</td>
                  <td className="px-3 py-2"><RunStatusBadge status={r.status} /></td>
                  <td className="px-3 py-2">{r.provider}{r.isDemo ? <Badge variant="demo" className="ml-1">DEMO</Badge> : null}</td>
                  <td className="px-3 py-2">{r.attempts}</td>
                  <td className="px-3 py-2">{r.httpStatus ?? "–"}</td>
                  <td className="px-3 py-2">{r.productCount}</td>
                  <td className="max-w-[360px] truncate px-5 py-2 text-zinc-400" title={r.errorMessage ?? ""}>{r.errorMessage ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 pb-2 last:border-0 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 text-xs text-muted">{k}</span>
      <span className="break-words text-zinc-200">{v}</span>
    </div>
  );
}
