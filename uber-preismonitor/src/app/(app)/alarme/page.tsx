"use client";
import { BellRing, CheckCheck, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import type { RouteOverview } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Switch } from "@/components/ui/input";
import { usePoll } from "@/lib/hooks";
import { api, cn } from "@/lib/utils";

const TYPES: Record<string, { label: string; unit: string | null; hint: string }> = {
  PCT_INCREASE: { label: "Preisanstieg um mehr als … %", unit: "%", hint: "Vergleich mit der vorherigen Messung derselben Strecke & Kategorie" },
  PCT_DECREASE: { label: "Starker Preisrückgang um mehr als … %", unit: "%", hint: "Vergleich mit der vorherigen Messung" },
  ABOVE_AMOUNT: { label: "Preis überschreitet … €", unit: "€", hint: "Löst beim Überschreiten der Grenze aus" },
  BELOW_AMOUNT: { label: "Preis unterschreitet … €", unit: "€", hint: "Löst beim Unterschreiten der Grenze aus" },
  DAILY_HIGH: { label: "Neue Tageshöchstmarke", unit: null, hint: "Höher als alle bisherigen Messungen des Tages" },
  DAILY_LOW: { label: "Neuer Tagestiefstwert", unit: null, hint: "Niedriger als alle bisherigen Messungen des Tages" },
};
const CHANNELS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "push", label: "Browser-Push" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "E-Mail" },
];
const CATS = [
  { key: "", label: "Alle Kategorien" },
  { key: "uberx", label: "UberX" },
  { key: "comfort", label: "Comfort" },
  { key: "uberxl", label: "UberXL" },
  { key: "green", label: "Green" },
  { key: "black", label: "Black" },
];

interface Rule {
  id: string;
  name: string;
  routeId: string | null;
  categoryKey: string | null;
  type: string;
  threshold: number;
  channels: string[];
  active: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  route: { name: string } | null;
}
interface Notif { id: string; title: string; message: string; level: string; createdAt: string; readAt: string | null; isDemo: boolean; deliveries: Record<string, string> | null; route: { name: string } | null }

const dt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AlertsPage() {
  const toast = useToast();
  const { data, reload } = usePoll<{ rules: Rule[]; channels: Record<string, boolean> }>("/api/alerts", 0);
  const { data: notifs, reload: reloadN } = usePoll<{ items: Notif[]; unread: number }>("/api/notifications", 20_000);
  const { data: ov } = usePoll<{ routes: RouteOverview[] }>("/api/overview", 0);
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const patch = async (id: string, body: Partial<Rule>) => {
    try {
      await api(`/api/alerts/${id}`, { method: "PATCH", json: body });
      reload();
    } catch (e) {
      toast({ kind: "error", title: "Fehler", text: (e as Error).message });
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Dieser Browser unterstützt keine Push-Benachrichtigungen (iOS: App zum Home-Bildschirm hinzufügen).");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt.");
      const { publicKey } = await api<{ publicKey: string | null }>("/api/push/subscribe");
      if (!publicKey) {
        toast({ kind: "warning", title: "Nur In-App-Benachrichtigungen", text: "VAPID-Schlüssel fehlen auf dem Server – Push bei geschlossenem Browser ist deaktiviert. Siehe README." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api("/api/push/subscribe", { method: "POST", json: sub.toJSON() });
      toast({ kind: "success", title: "Browser-Push aktiviert", text: "Dieses Gerät erhält jetzt Preisalarme." });
    } catch (e) {
      toast({ kind: "error", title: "Push nicht aktiviert", text: (e as Error).message });
    } finally {
      setPushBusy(false);
    }
  };

  const test = async () => {
    try {
      const r = await api<{ results: Record<string, string> }>("/api/push/test", { method: "POST" });
      toast({ kind: "info", title: "Testbenachrichtigung", text: Object.entries(r.results).map(([k, v]) => `${k}: ${v}`).join(" · ") });
      reloadN();
    } catch (e) {
      toast({ kind: "error", title: "Fehler", text: (e as Error).message });
    }
  };

  const markRead = async () => {
    await api("/api/notifications", { method: "POST", json: {} });
    reloadN();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Preisalarme</h1>
          <p className="text-sm text-muted">Grenzwerte selbst festlegen – geprüft wird nach jeder neuen Messung im Hintergrund.</p>
        </div>
        <Button onClick={() => setEditing({ type: "PCT_INCREASE", threshold: 20, channels: ["dashboard"], cooldownMinutes: 30, active: true, name: "" })}><Plus /> Neuer Alarm</Button>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Benachrichtigungskanäle</CardTitle><CardDescription>Telegram & E-Mail werden über Umgebungsvariablen konfiguriert (siehe README).</CardDescription></div></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {CHANNELS.map((c) => (
            <Badge key={c.key} variant={data?.channels[c.key] ? "up" : "muted"}>{c.label}: {data?.channels[c.key] ? "bereit" : "nicht konfiguriert"}</Badge>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={enablePush} disabled={pushBusy}>{pushBusy ? <Loader2 className="animate-spin" /> : <BellRing />} Push auf diesem Gerät aktivieren</Button>
            <Button variant="secondary" size="sm" onClick={test}><Send /> Test senden</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Alarmregeln</CardTitle></div></CardHeader>
        <CardContent className="space-y-2">
          {data?.rules.length === 0 ? <p className="text-sm text-muted">Noch keine Regeln.</p> : null}
          {data?.rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-zinc-950/40 p-3">
              <Switch checked={r.active} onChange={(v) => patch(r.id, { active: v })} label="Aktiv" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted">
                  {TYPES[r.type]?.label.replace("…", TYPES[r.type]?.unit ? String(r.threshold) : "")} · {r.route?.name ?? "alle Strecken"} · {CATS.find((c) => c.key === (r.categoryKey ?? ""))?.label ?? r.categoryKey} · Pause {r.cooldownMinutes} Min.
                </div>
                <div className="mt-1 flex flex-wrap gap-1">{r.channels.map((c) => <Badge key={c} variant="muted">{CHANNELS.find((x) => x.key === c)?.label ?? c}</Badge>)}{r.lastTriggeredAt ? <Badge variant="warn">zuletzt {dt.format(new Date(r.lastTriggeredAt))}</Badge> : null}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Bearbeiten</Button>
              <Button variant="ghost" size="sm" className="text-red-300" aria-label="Löschen" onClick={async () => { if (confirm("Regel löschen?")) { await api(`/api/alerts/${r.id}`, { method: "DELETE" }); reload(); } }}><Trash2 /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div><CardTitle>Benachrichtigungen</CardTitle><CardDescription>{notifs?.unread ?? 0} ungelesen</CardDescription></div>
          <Button variant="ghost" size="sm" onClick={markRead}><CheckCheck /> Alle gelesen</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifs?.items.length === 0 ? <p className="text-sm text-muted">Noch keine Benachrichtigungen.</p> : null}
          {notifs?.items.map((n) => (
            <div key={n.id} className={cn("rounded-lg border p-3", n.readAt ? "border-border/60 opacity-70" : "border-border bg-zinc-900/60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("size-2 rounded-full", n.level === "error" ? "bg-red-500" : n.level === "warning" ? "bg-amber-400" : "bg-blue-400")} />
                <span className="text-sm font-medium">{n.title}</span>
                {n.isDemo ? <Badge variant="demo">DEMO</Badge> : null}
                <span className="ml-auto text-[11px] text-zinc-500">{dt.format(new Date(n.createdAt))}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">{n.message}</p>
              {n.deliveries ? <p className="mt-1 text-[10px] text-zinc-600">{Object.entries(n.deliveries).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {editing ? <RuleDialog rule={editing} routes={ov?.routes ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </div>
  );
}

function RuleDialog({ rule, routes, onClose, onSaved }: { rule: Partial<Rule>; routes: RouteOverview[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: rule.name ?? "",
    type: rule.type ?? "PCT_INCREASE",
    threshold: String(rule.threshold ?? 20),
    routeId: rule.routeId ?? "",
    categoryKey: rule.categoryKey ?? "",
    channels: rule.channels ?? ["dashboard"],
    cooldownMinutes: String(rule.cooldownMinutes ?? 30),
    active: rule.active ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const t = TYPES[f.type];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body = {
      name: f.name || t.label.replace("…", t.unit ? `${f.threshold} ` : ""),
      type: f.type,
      threshold: t.unit ? Number(f.threshold.replace(",", ".")) : 0,
      routeId: f.routeId || null,
      categoryKey: f.categoryKey || null,
      channels: f.channels.includes("dashboard") ? f.channels : ["dashboard", ...f.channels],
      cooldownMinutes: Number(f.cooldownMinutes),
      active: f.active,
    };
    try {
      await api(rule.id ? `/api/alerts/${rule.id}` : "/api/alerts", { method: rule.id ? "PATCH" : "POST", json: body });
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={rule.id ? "Alarm bearbeiten" : "Neuer Alarm"}>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Bedingung</Label>
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <p className="mt-1 text-[11px] text-muted">{t.hint}</p>
          </div>
          {t.unit ? (
            <div><Label>Grenzwert ({t.unit})</Label><Input inputMode="decimal" value={f.threshold} onChange={(e) => setF({ ...f, threshold: e.target.value })} required /></div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Strecke</Label>
              <Select value={f.routeId} onChange={(e) => setF({ ...f, routeId: e.target.value })}>
                <option value="">Alle Strecken</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </div>
            <div><Label>Kategorie</Label>
              <Select value={f.categoryKey} onChange={(e) => setF({ ...f, categoryKey: e.target.value })}>
                {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </div>
          </div>
          <div><Label>Kanäle</Label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((c) => {
                const on = f.channels.includes(c.key) || c.key === "dashboard";
                return (
                  <button type="button" key={c.key} disabled={c.key === "dashboard"} onClick={() => setF({ ...f, channels: on ? f.channels.filter((x) => x !== c.key) : [...f.channels, c.key] })}
                    className={cn("cursor-pointer rounded-md border px-2.5 py-1 text-xs disabled:cursor-default", on ? "border-blue-500/50 bg-blue-500/15 text-blue-200" : "border-border text-zinc-400")}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Pause nach Auslösung (Min.)</Label><Input inputMode="numeric" value={f.cooldownMinutes} onChange={(e) => setF({ ...f, cooldownMinutes: e.target.value })} /></div>
            <div><Label>Name (optional)</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          </div>
          {err ? <p className="text-xs text-red-300">{err}</p> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button><Button type="submit">Speichern</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
