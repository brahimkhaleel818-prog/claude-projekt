"use client";
import { ArrowLeftRight, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { RunStatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast";
import type { RouteOverview } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Switch } from "@/components/ui/input";
import { usePoll } from "@/lib/hooks";
import { api } from "@/lib/utils";

const INTERVALS = [
  { v: 1, l: "Jede Minute" },
  { v: 5, l: "Alle 5 Minuten" },
  { v: 10, l: "Alle 10 Minuten" },
  { v: 15, l: "Alle 15 Minuten" },
  { v: 30, l: "Alle 30 Minuten" },
  { v: 60, l: "Jede Stunde" },
];
const CATEGORY_OPTIONS = [
  { key: "uberx", label: "UberX" },
  { key: "comfort", label: "Comfort" },
  { key: "uberxl", label: "UberXL" },
  { key: "green", label: "Green" },
  { key: "black", label: "Black" },
  { key: "van", label: "Van" },
  { key: "wav", label: "WAV" },
  { key: "taxi", label: "Taxi" },
];

interface Form {
  name: string;
  originAddress: string;
  originLat: string;
  originLng: string;
  destAddress: string;
  destLat: string;
  destLng: string;
  active: boolean;
  intervalMinutes: number;
  categories: string[];
}
const EMPTY: Form = { name: "", originAddress: "", originLat: "", originLng: "", destAddress: "", destLat: "", destLng: "", active: true, intervalMinutes: 5, categories: [] };

interface Ov { routes: RouteOverview[]; provider: { knownCategories: string[]; id: string } }

export default function RoutesPage() {
  const toast = useToast();
  const { data, reload } = usePoll<Ov>("/api/overview", 30_000);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toForm = (r: RouteOverview): Form => ({
    name: r.name,
    originAddress: r.originAddress,
    originLat: String(r.originLat),
    originLng: String(r.originLng),
    destAddress: r.destAddress,
    destLat: String(r.destLat),
    destLng: String(r.destLng),
    active: r.active,
    intervalMinutes: r.intervalMinutes,
    categories: r.categories,
  });

  const patch = async (id: string, body: Partial<Record<string, unknown>>) => {
    setBusyId(id);
    try {
      await api(`/api/routes/${id}`, { method: "PATCH", json: body });
      await reload();
    } catch (e) {
      toast({ kind: "error", title: "Speichern fehlgeschlagen", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: RouteOverview) => {
    if (!confirm(`Strecke „${r.name}“ und ALLE gespeicherten Preise dieser Strecke endgültig löschen?`)) return;
    setBusyId(r.id);
    try {
      await api(`/api/routes/${r.id}`, { method: "DELETE" });
      toast({ kind: "success", title: "Strecke gelöscht" });
      await reload();
    } catch (e) {
      toast({ kind: "error", title: "Löschen fehlgeschlagen", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const reverse = async (r: RouteOverview) => {
    setBusyId(r.id);
    try {
      const res = await api<{ created: boolean; route: { name: string } }>(`/api/routes/${r.id}/reverse`, { method: "POST" });
      toast({ kind: "success", title: res.created ? "Gegenrichtung angelegt" : "Gegenrichtung existiert bereits", text: res.route.name });
      await reload();
    } catch (e) {
      toast({ kind: "error", title: "Fehler", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Strecken verwalten</h1>
          <p className="text-sm text-muted">Jede Fahrtrichtung ist eine eigene Strecke mit eigenem Preisverlauf.</p>
        </div>
        <Button onClick={() => setEditing({ id: null, form: EMPTY })}><Plus /> Neue Strecke</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {data?.routes.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{r.name}</CardTitle>
                <CardDescription>
                  {INTERVALS.find((i) => i.v === r.intervalMinutes)?.l}
                  {r.effectiveIntervalMinutes !== r.intervalMinutes ? ` (Quelle erlaubt min. ${r.effectiveIntervalMinutes} Min.)` : ""}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <RunStatusBadge status={r.lastStatus} active={r.active} />
                <Switch checked={r.active} disabled={busyId === r.id} onChange={(v) => patch(r.id, { active: v })} label="Aktiv" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-blue-400" /><span><span className="text-zinc-300">{r.originAddress}</span><span className="ml-1 text-zinc-600">({r.originLat.toFixed(5)}, {r.originLng.toFixed(5)})</span></span></div>
                <div className="flex gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-400" /><span><span className="text-zinc-300">{r.destAddress}</span><span className="ml-1 text-zinc-600">({r.destLat.toFixed(5)}, {r.destLng.toFixed(5)})</span></span></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.categories.length === 0 ? <Badge variant="muted">alle verfügbaren Kategorien</Badge> : r.categories.map((c) => <Badge key={c}>{CATEGORY_OPTIONS.find((o) => o.key === c)?.label ?? c}</Badge>)}
                {r.reverseRouteId ? <Badge variant="live">⇄ mit Gegenrichtung verknüpft</Badge> : null}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <Select className="h-8 w-auto text-xs" value={r.intervalMinutes} disabled={busyId === r.id} onChange={(e) => patch(r.id, { intervalMinutes: Number(e.target.value) })} aria-label="Intervall">
                  {INTERVALS.map((i) => <option key={i.v} value={i.v}>{i.l}</option>)}
                </Select>
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => reverse(r)} disabled={busyId === r.id} title="Gegenrichtung anlegen/anzeigen"><ArrowLeftRight /> <span className="hidden sm:inline">Gegenrichtung</span></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ id: r.id, form: toForm(r) })}><Pencil /> <span className="hidden sm:inline">Bearbeiten</span></Button>
                  <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200" onClick={() => remove(r)} disabled={busyId === r.id} aria-label="Löschen"><Trash2 /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing ? (
        <RouteDialog
          key={editing.id ?? "new"}
          initial={editing.form}
          id={editing.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            toast({ kind: "success", title: "Strecke gespeichert", text: "Die erste Abfrage startet in wenigen Sekunden." });
          }}
        />
      ) : null}
    </div>
  );
}

function RouteDialog({ initial, id, onClose, onSaved }: { initial: Form; id: string | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapN, setSwapN] = useState(0);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const swap = () => {
    setSwapN((n) => n + 1);
    setF((x) => ({
      ...x,
      originAddress: x.destAddress, originLat: x.destLat, originLng: x.destLng,
      destAddress: x.originAddress, destLat: x.originLat, destLng: x.originLng,
      name: x.name.includes("→") ? x.name.split("→").map((s) => s.trim()).reverse().join(" → ") : x.name,
    }));
  };

  const addressChanged = id !== null && (f.originLat !== initial.originLat || f.originLng !== initial.originLng || f.destLat !== initial.destLat || f.destLng !== initial.destLng);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body = {
      name: f.name || `${f.originAddress.split(",")[0]} → ${f.destAddress.split(",")[0]}`,
      originAddress: f.originAddress,
      originLat: Number(f.originLat),
      originLng: Number(f.originLng),
      destAddress: f.destAddress,
      destLat: Number(f.destLat),
      destLng: Number(f.destLng),
      active: f.active,
      intervalMinutes: f.intervalMinutes,
      categories: f.categories,
    };
    if ([body.originLat, body.originLng, body.destLat, body.destLng].some((v) => !Number.isFinite(v) || v === 0))
      return setError("Bitte Start und Ziel über die Adresssuche auswählen oder gültige GPS-Koordinaten eintragen.");
    setBusy(true);
    try {
      await api(id ? `/api/routes/${id}` : "/api/routes", { method: id ? "PATCH" : "POST", json: body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={id ? "Strecke bearbeiten" : "Neue Strecke"} description="Adresse suchen (OpenStreetMap) und Treffer auswählen – die GPS-Koordinaten werden übernommen." className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Streckenname</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Hbf → Messe" />
          </div>
          <AddressField key={`o${swapN}`} label="Startadresse" color="text-blue-400" address={f.originAddress} lat={f.originLat} lng={f.originLng}
            onChange={(a, la, ln) => setF((x) => ({ ...x, originAddress: a, originLat: la, originLng: ln }))} />
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={swap} title="Start und Ziel vertauschen"><ArrowLeftRight /> Start und Ziel vertauschen</Button>
          </div>
          <AddressField key={`d${swapN}`} label="Zieladresse" color="text-amber-400" address={f.destAddress} lat={f.destLat} lng={f.destLng}
            onChange={(a, la, ln) => setF((x) => ({ ...x, destAddress: a, destLat: la, destLng: ln }))} />
          {addressChanged ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Hinweis: Du änderst Start/Ziel einer bestehenden Strecke. Bisherige Messwerte behalten ihre ursprünglichen Adressen. Für die Gegenrichtung besser „Gegenrichtung“ nutzen – dann bleiben die Verläufe getrennt.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Aktualisierungsintervall</Label>
              <Select value={f.intervalMinutes} onChange={(e) => set("intervalMinutes", Number(e.target.value))}>
                {INTERVALS.map((i) => <option key={i.v} value={i.v}>{i.l}</option>)}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <div className="flex h-9 items-center gap-2 text-sm"><Switch checked={f.active} onChange={(v) => set("active", v)} label="Aktiv" /> {f.active ? "Überwachung aktiv" : "Pausiert"}</div>
            </div>
          </div>
          <div>
            <Label>Kategorien speichern (keine Auswahl = alle, die die Quelle liefert)</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => {
                const on = f.categories.includes(c.key);
                return (
                  <button key={c.key} type="button" onClick={() => set("categories", on ? f.categories.filter((x) => x !== c.key) : [...f.categories, c.key])}
                    className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs ${on ? "border-blue-500/50 bg-blue-500/15 text-blue-200" : "border-border text-zinc-400 hover:text-white"}`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Speichern</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddressField({ label, color, address, lat, lng, onChange }: { label: string; color: string; address: string; lat: string; lng: string; onChange: (a: string, lat: string, lng: string) => void }) {
  const [q, setQ] = useState(address);
  const [results, setResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    if (q.trim().length < 3) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ results: Array<{ label: string; lat: number; lng: number }> }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      setResults(r.results);
      if (r.results.length === 0) setErr("Keine Treffer – Adresse genauer angeben.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-zinc-950/50 p-3">
      <Label className="flex items-center gap-1.5"><MapPin className={`size-3.5 ${color}`} /> {label}</Label>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} placeholder="Adresse, Ort oder POI suchen" />
        <Button type="button" variant="secondary" onClick={search} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />} Suchen</Button>
      </div>
      {results.length > 0 ? (
        <ul className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border scrollbar-thin">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="w-full cursor-pointer px-3 py-2 text-left text-xs hover:bg-zinc-800" onClick={() => { onChange(r.label, String(r.lat), String(r.lng)); setQ(r.label); setResults([]); }}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {err ? <p className="mt-1 text-xs text-amber-300">{err}</p> : null}
      <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
        <div><Label className="mb-1 text-[10px]">Breitengrad</Label><Input className="h-8 text-xs" value={lat} onChange={(e) => onChange(address || q, e.target.value, lng)} inputMode="decimal" /></div>
        <div><Label className="mb-1 text-[10px]">Längengrad</Label><Input className="h-8 text-xs" value={lng} onChange={(e) => onChange(address || q, lat, e.target.value)} inputMode="decimal" /></div>
      </div>
      {address ? <p className="mt-1.5 truncate text-[11px] text-zinc-500" title={address}>Gespeicherte Adresse: {address}</p> : null}
    </div>
  );
}
