"use client";
import { ArrowLeftRight, ArrowRight, Clock, Download, FileSpreadsheet, Loader2, PenLine, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayCompareChart, Empty, Heatmap, HourChart, PriceLineChart, WeekdayChart } from "@/components/charts";
import { ManualEntryDialog } from "@/components/manual-entry";
import { type Range, RangePicker, rangeQuery } from "@/components/range-picker";
import { ChangeBadge, RunStatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast";
import { type Overview, PRICE_TYPE_SHORT, type PriceInfo, type RouteOverview } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePoll } from "@/lib/hooks";
import { api, categoryColor, cn, eur } from "@/lib/utils";

const dt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmt = (d: string | null | undefined) => (d ? `${dt.format(new Date(d))} Uhr` : "–");

interface SeriesResp {
  bucketMinutes: number;
  categories: string[];
  points: Array<Record<string, number | string | null>>;
  failedRuns: number;
}
interface StatsResp {
  stats: {
    summary: { count: number; min: number | null; max: number | null; avg: number | null; std: number | null; maxAt: string | null; minAt: string | null };
    byHour: Array<{ hour: number; avg: number | null; min: number | null; max: number | null; count: number }>;
    byWeekday: Array<{ weekday: number; avg: number | null; min: number | null; max: number | null; count: number }>;
    heatmap: Array<Array<{ avg: number | null; min: number | null; max: number | null; count: number }>>;
    days: string[];
    dayCompare: Array<Record<string, number | null>>;
  };
  runs: Record<string, number>;
  categories: Array<{ key: string; label: string; count: number }>;
}

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export default function DashboardPage() {
  const toast = useToast();
  const { data: ov, reload: reloadOv, loading } = usePoll<Overview>("/api/overview", 20_000);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>({ key: "today" });
  const [category, setCategory] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!ov || routeId) return;
    const fromUrl = new URLSearchParams(window.location.search).get("route");
    const stored = fromUrl ?? readStored("upm.route");
    setRouteId(ov.routes.find((r) => r.id === stored)?.id ?? ov.routes[0]?.id ?? null);
  }, [ov, routeId]);

  const selectRoute = useCallback((id: string) => {
    setRouteId(id);
    store("upm.route", id);
    const u = new URL(window.location.href);
    u.searchParams.set("route", id);
    window.history.replaceState(null, "", u);
  }, []);

  const route = ov?.routes.find((r) => r.id === routeId) ?? null;
  const q = rangeQuery(range);
  const { data: stats } = usePoll<StatsResp>(routeId ? `/api/routes/${routeId}/stats?${q}${category ? `&category=${category}` : ""}` : null, 60_000);
  const { data: series, loading: seriesLoading } = usePoll<SeriesResp>(routeId ? `/api/routes/${routeId}/series?${q}${category ? `&categories=${category}` : ""}` : null, 30_000);

  const cats = useMemo(() => stats?.categories ?? [], [stats]);
  useEffect(() => {
    // Standard: UberX bzw. häufigste Kategorie
    if (category === null && cats.length > 0) setCategory(cats.find((c) => c.key === "uberx")?.key ?? cats[0].key);
  }, [cats, category]);
  const labels = useMemo(() => Object.fromEntries(cats.map((c) => [c.key, c.label])), [cats]);

  const swap = async () => {
    if (!route) return;
    setSwapping(true);
    try {
      const r = await api<{ route: { id: string }; created: boolean }>(`/api/routes/${route.id}/reverse`, { method: "POST" });
      if (r.created) toast({ kind: "success", title: "Gegenrichtung angelegt", text: "Sie hat einen eigenen Preisverlauf und wird ab sofort überwacht." });
      await reloadOv();
      selectRoute(r.route.id);
    } catch (e) {
      toast({ kind: "error", title: "Richtungswechsel fehlgeschlagen", text: (e as Error).message });
    } finally {
      setSwapping(false);
    }
  };

  const runNow = async () => {
    if (!route) return;
    try {
      const r = await api<{ message: string }>(`/api/routes/${route.id}/run`, { method: "POST" });
      toast({ kind: "info", title: "Abfrage eingeplant", text: r.message });
      setTimeout(reloadOv, 8000);
    } catch (e) {
      toast({ kind: "error", title: "Nicht möglich", text: (e as Error).message });
    }
  };

  if (loading && !ov) return <div className="grid h-[60vh] place-items-center text-muted"><Loader2 className="animate-spin" /></div>;
  if (!ov) return <Empty text="Daten konnten nicht geladen werden." />;
  if (ov.routes.length === 0)
    return (
      <Empty
        className="h-[50vh]"
        text="Noch keine Strecken angelegt. Unter „Strecken“ kannst du die erste Strecke hinzufügen."
      />
    );

  const multiDay = range.key === "7d" || range.key === "30d" || (range.key === "custom" && range.from !== range.to);
  const s = stats?.stats;
  const exportUrl = (format: "csv" | "xlsx") => `/api/export?format=${format}&${q}${routeId ? `&routeId=${routeId}` : ""}${category ? `&category=${category}` : ""}`;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Streckenauswahl */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {ov.routes.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRoute(r.id)}
              className={cn(
                "shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                r.id === routeId ? "border-zinc-500 bg-zinc-800 text-white" : "border-border bg-panel text-zinc-400 hover:text-white",
                !r.active && "opacity-60",
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={runNow} disabled={!route}><RefreshCw /> Jetzt abfragen</Button>
          <Button variant="secondary" size="sm" onClick={() => setManualOpen(true)} disabled={!route || ov.provider.isDemo} title={ov.provider.isDemo ? "Im Demo-Modus nicht verfügbar" : undefined}>
            <PenLine /> App-Preis erfassen
          </Button>
        </div>
      </div>

      {route ? (
        <>
          {/* Strecke + Richtungswechsel */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 pt-4 sm:p-5 sm:pt-5 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Start</div>
                  <div className="truncate text-sm font-medium" title={route.originAddress}>{route.originAddress}</div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={swap}
                  disabled={swapping}
                  className="size-10 shrink-0 rounded-full"
                  title="Fahrtrichtung wechseln"
                  aria-label="Fahrtrichtung wechseln"
                >
                  {swapping ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
                </Button>
                <div className="min-w-0 flex-1 text-right md:text-left">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Ziel</div>
                  <div className="truncate text-sm font-medium" title={route.destAddress}>{route.destAddress}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <RunStatusBadge status={route.lastStatus} active={route.active} />
                <span className="inline-flex items-center gap-1"><Clock className="size-3" /> alle {route.effectiveIntervalMinutes} Min.</span>
                <span>Letzte erfolgreiche Aktualisierung: <span className="text-zinc-300">{fmt(route.lastSuccessAt)}</span></span>
              </div>
            </CardContent>
            {route.lastStatus && route.lastStatus !== "SUCCESS" && route.lastError ? (
              <div className="border-t border-border px-5 py-2 text-xs text-red-300">Letzte Abfrage ({fmt(route.lastRunAt)}): {route.lastError}</div>
            ) : null}
          </Card>

          {/* Aktuelle Preise */}
          {route.prices.length === 0 ? (
            <Card>
              <CardContent className="p-5 pt-5">
                <div className="text-sm font-medium">Aktueller Preis: <span className="text-zinc-400">Nicht verfügbar</span></div>
                <p className="mt-1 text-xs text-muted">
                  Für diese Strecke existieren noch keine Messungen{ov.provider.isDemo ? " (Demo)" : ""}. Historische Werte werden nicht nachträglich erzeugt – die Aufzeichnung beginnt mit der ersten erfolgreichen Abfrage.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sortPrices(route.prices).map((p, i) => (
                <PriceCard key={p.categoryKey} p={p} color={categoryColor(p.categoryKey, i)} selected={category === p.categoryKey} onSelect={() => setCategory(p.categoryKey)} demo={ov.provider.isDemo} />
              ))}
            </div>
          )}

          {/* Zeitraum, Kategorie, Export */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <RangePicker value={range} onChange={setRange} />
            <div className="flex flex-wrap items-center gap-2">
              {cats.length > 0 ? (
                <div className="inline-flex flex-wrap rounded-lg border border-border bg-zinc-900 p-0.5">
                  {cats.map((c) => (
                    <button key={c.key} onClick={() => setCategory(c.key)} className={cn("cursor-pointer rounded-md px-2.5 py-1 text-xs", category === c.key ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white")}>
                      {c.label}
                    </button>
                  ))}
                  <button onClick={() => setCategory("")} className={cn("cursor-pointer rounded-md px-2.5 py-1 text-xs", category === "" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white")}>Alle vergleichen</button>
                </div>
              ) : null}
              <Button asChild variant="ghost" size="sm"><a href={exportUrl("csv")}><Download /> CSV</a></Button>
              <Button asChild variant="ghost" size="sm"><a href={exportUrl("xlsx")}><FileSpreadsheet /> Excel</a></Button>
            </div>
          </div>

          {/* Kennzahlen */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Höchster Preis" value={eur(s?.summary.max)} sub={s?.summary.maxAt ? fmt(s.summary.maxAt) : undefined} tone="up" />
            <Kpi label="Niedrigster Preis" value={eur(s?.summary.min)} sub={s?.summary.minAt ? fmt(s.summary.minAt) : undefined} tone="down" />
            <Kpi label="Durchschnitt" value={eur(s?.summary.avg)} sub={s?.summary.std !== null && s?.summary.std !== undefined ? `σ ${eur(s.summary.std)}` : undefined} />
            <Kpi
              label="Messungen"
              value={String(s?.summary.count ?? 0)}
              sub={`${stats?.runs.SUCCESS ?? 0} erfolgreich · ${(stats?.runs.FAILED ?? 0) + (stats?.runs.NO_DATA ?? 0)} ohne Preis`}
            />
          </div>

          {/* Preisverlauf */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Preisverlauf {category ? `· ${labels[category] ?? category}` : "· Kategorienvergleich"}</CardTitle>
                <CardDescription>
                  Nur gemessene Werte. Lücken = fehlgeschlagene oder fehlende Abfragen (kein Wert eingesetzt). ★ = auffällige Preisspitze (&gt; 2σ).
                  {series && series.bucketMinutes > 0 ? ` Zusammengefasst in ${series.bucketMinutes}-Minuten-Mittelwerten.` : ""}
                </CardDescription>
              </div>
              {seriesLoading ? <Loader2 className="size-4 animate-spin text-muted" /> : null}
            </CardHeader>
            <CardContent>
              <PriceLineChart
                points={series?.points ?? []}
                categories={category ? [category] : series?.categories ?? []}
                labels={labels}
                avg={category ? s?.summary.avg : null}
                multiDay={multiDay}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Preis nach Uhrzeit</CardTitle><CardDescription>Ø je Stunde (blau), Max (grün), Min (rot) im Zeitraum</CardDescription></div></CardHeader>
              <CardContent><HourChart data={s?.byHour ?? []} /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Preis nach Wochentag</CardTitle><CardDescription>Ø je Wochentag · grün = teuerster, rot = günstigster Tag</CardDescription></div></CardHeader>
              <CardContent><WeekdayChart data={s?.byWeekday ?? []} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><div><CardTitle>Tagesvergleich</CardTitle><CardDescription>Stündliche Durchschnittspreise der einzelnen Tage im gewählten Zeitraum (max. 7 Tage)</CardDescription></div></CardHeader>
            <CardContent><DayCompareChart rows={s?.dayCompare ?? []} days={s?.days ?? []} /></CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Heatmap Wochentag × Uhrzeit</CardTitle><CardDescription>Durchschnitt der gemessenen Preise je Zelle. Für aussagekräftige Muster „30 Tage“ wählen.</CardDescription></div></CardHeader>
            <CardContent>{s ? <Heatmap grid={s.heatmap} /> : <Empty />}</CardContent>
          </Card>
        </>
      ) : null}

      <RoutesTable routes={ov.routes} selected={routeId} onSelect={selectRoute} />

      {route ? (
        <ManualEntryDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          route={route}
          categories={cats.map((c) => c.label).concat(["UberX", "Comfort", "UberXL", "Black", "Green"]).filter((v, i, a) => a.indexOf(v) === i)}
          onSaved={() => {
            reloadOv();
            toast({ kind: "success", title: "Preis gespeichert", text: "Als „Manuell (Uber-App)“ erfasst." });
          }}
        />
      ) : null}
    </div>
  );
}

const ORDER = ["uberx", "comfort", "uberxl", "green", "black", "van", "wav", "taxi"];
function sortPrices(ps: PriceInfo[]) {
  return [...ps].sort((a, b) => (ORDER.indexOf(a.categoryKey) + 1 || 99) - (ORDER.indexOf(b.categoryKey) + 1 || 99));
}

function PriceCard({ p, color, selected, onSelect, demo }: { p: PriceInfo; color: string; selected: boolean; onSelect: () => void; demo: boolean }) {
  const range = p.lastLow !== null && p.lastHigh !== null && p.lastLow !== p.lastHigh;
  return (
    <button onClick={onSelect} className={cn("cursor-pointer rounded-xl border bg-panel p-4 text-left transition-colors hover:border-zinc-600", selected ? "border-zinc-500" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium"><span className="size-2.5 rounded-full" style={{ background: color }} />{p.category}</span>
        <Badge variant={demo ? "demo" : p.priceType === "RANGE" ? "warn" : p.priceType === "MANUAL" ? "default" : "live"}>{PRICE_TYPE_SHORT[p.priceType] ?? p.priceType}</Badge>
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-muted">Aktueller Fahrpreis</div>
      <div className={cn("tabular text-3xl font-semibold tracking-tight", p.current === null && "text-xl text-zinc-500")}>
        {p.current !== null ? (range ? `${p.lastLow!.toLocaleString("de-DE")}–${p.lastHigh!.toLocaleString("de-DE")} €` : eur(p.current)) : "Nicht verfügbar"}
      </div>
      {range && p.current !== null ? <div className="text-[11px] text-muted">Mittelwert {eur(p.current)} · {p.lastDisplay}</div> : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <ChangeBadge abs={p.change.abs} pct={p.change.pct} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
        <div>
          <div className="text-muted">Letzter Messwert</div>
          <div className="tabular text-zinc-200">{eur(p.last)}</div>
          <div className="text-zinc-500">{fmt(p.lastAt)}</div>
        </div>
        <div>
          <div className="text-muted">Davor</div>
          <div className="tabular text-zinc-200">{eur(p.previous)}</div>
          <div className="text-zinc-500">{fmt(p.previousAt)}</div>
        </div>
      </div>
    </button>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("tabular mt-1 text-xl font-semibold sm:text-2xl", tone === "up" && "text-up", tone === "down" && "text-down", value === "Nicht verfügbar" && "text-base text-zinc-500")}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function RoutesTable({ routes, selected, onSelect }: { routes: RouteOverview[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Streckenübersicht</CardTitle><CardDescription>Alle überwachten Strecken mit aktuellem Preis (UberX bzw. erste Kategorie)</CardDescription></div>
        <Button asChild variant="ghost" size="sm"><Link href="/strecken">Strecken verwalten <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent className="px-0 sm:px-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Strecke</th>
                <th className="px-3 py-2 font-medium">Aktueller Preis</th>
                <th className="px-3 py-2 font-medium">Letzte Änderung</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Aktualisiert</th>
                <th className="px-5 py-2 text-right font-medium">Richtung</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => {
                const p = r.prices.find((x) => x.categoryKey === "uberx") ?? r.prices[0];
                return (
                  <tr key={r.id} className={cn("border-b border-border/60 last:border-0 hover:bg-zinc-900/60", selected === r.id && "bg-zinc-900")}>
                    <td className="px-5 py-3">
                      <button onClick={() => onSelect(r.id)} className="cursor-pointer text-left font-medium hover:underline">{r.name}</button>
                      <div className="text-[11px] text-zinc-500">alle {r.effectiveIntervalMinutes} Min.</div>
                    </td>
                    <td className="tabular px-3 py-3">{p ? <>{eur(p.current)} <span className="text-[11px] text-zinc-500">{p.category}</span></> : <span className="text-zinc-500">Nicht verfügbar</span>}</td>
                    <td className="px-3 py-3">{p ? <ChangeBadge abs={p.change.abs} pct={p.change.pct} /> : "–"}</td>
                    <td className="px-3 py-3"><RunStatusBadge status={r.lastStatus} active={r.active} /></td>
                    <td className="px-3 py-3 text-xs text-zinc-400">{fmt(r.lastSuccessAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {r.reverseRouteId ? (
                        <Button variant="ghost" size="sm" onClick={() => onSelect(r.reverseRouteId!)} title="Gegenrichtung anzeigen"><ArrowLeftRight /> Gegenrichtung</Button>
                      ) : (
                        <span className="text-[11px] text-zinc-500">⇄ im Dashboard</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
