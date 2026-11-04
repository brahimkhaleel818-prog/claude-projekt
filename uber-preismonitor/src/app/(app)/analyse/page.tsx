"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Empty, Heatmap, HourChart, WeekdayChart } from "@/components/charts";
import { type Range, RangePicker, rangeQuery } from "@/components/range-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { usePoll } from "@/lib/hooks";
import { WEEKDAYS_DE_SHORT } from "@/lib/time";
import { cn, eur } from "@/lib/utils";

type Cell = { avg: number | null; min: number | null; max: number | null; count: number };
interface Resp {
  category: string | null;
  categoryLabel: string | null;
  total: number;
  enoughData: boolean;
  insights: Array<{ kind: "measured" | "estimate" | "forecast"; title: string; text: string }>;
  global: { summary: { count: number; min: number | null; max: number | null; avg: number | null }; byHour: Array<{ hour: number } & Cell>; byWeekday: Array<{ weekday: number } & Cell>; heatmap: Cell[][] };
  perRoute: Array<{ id: string; name: string; count: number; min: number | null; max: number | null; avg: number | null; byHour: Array<{ hour: number } & Cell> }>;
  forecast: Array<{ at: string; label: string; expected: number | null; basedOn: number }>;
}

const KIND = {
  measured: { label: "Gemessen", variant: "live" as const },
  estimate: { label: "Statistische Auswertung", variant: "warn" as const },
  forecast: { label: "Prognose", variant: "demo" as const },
};

export default function AnalysePage() {
  const [range, setRange] = useState<Range>({ key: "30d" });
  const [cat, setCat] = useState("");
  const { data, loading } = usePoll<Resp>(`/api/analytics?${rangeQuery(range)}${cat ? `&category=${cat}` : ""}`, 120_000);
  const { data: cats } = usePoll<{ categories: Array<{ key: string; label: string }> }>("/api/categories", 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Intelligente Preisanalyse</h1>
          <p className="text-sm text-muted">Muster aus gespeicherten Messungen – klar getrennt nach Messwert, Auswertung und Prognose.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangePicker value={range} onChange={setRange} />
          <Select className="h-8 w-auto text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategorie">
            <option value="">{data?.categoryLabel ? `Standard (${data.categoryLabel})` : "Standard-Kategorie"}</option>
            {(cats?.categories ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </div>
      </div>

      {loading && !data ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-muted" /></div> : null}
      {data && data.total === 0 ? <Empty className="h-60" text="Im gewählten Zeitraum gibt es noch keine Messungen. Analysen erscheinen, sobald Daten gesammelt wurden." /> : null}

      {data && data.total > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.insights.map((i, idx) => (
              <Card key={idx}>
                <CardContent className="p-4 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{i.title}</span>
                    <Badge variant={KIND[i.kind].variant}>{KIND[i.kind].label}</Badge>
                  </div>
                  <p className="text-sm text-zinc-300">{i.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><div><CardTitle>Fahrtrichtungen im Vergleich · {data.categoryLabel}</CardTitle><CardDescription>Gemessene Werte je Strecke im Zeitraum</CardDescription></div></CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr className="border-b border-border"><th className="py-2 font-medium">Strecke</th><th className="py-2 font-medium">Ø</th><th className="py-2 font-medium">Min</th><th className="py-2 font-medium">Max</th><th className="py-2 font-medium">Messungen</th></tr></thead>
                <tbody>
                  {[...data.perRoute].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).map((r, i) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5">{r.name} {i === 0 && r.avg !== null ? <Badge variant="up" className="ml-1">teuerste</Badge> : null}</td>
                      <td className="tabular py-2.5 font-medium">{eur(r.avg)}</td>
                      <td className="tabular py-2.5 text-down">{eur(r.min)}</td>
                      <td className="tabular py-2.5 text-up">{eur(r.max)}</td>
                      <td className="tabular py-2.5 text-muted">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Heatmap Wochentag × Uhrzeit · alle Strecken</CardTitle><CardDescription>Durchschnitt gemessener Preise. Leere Zellen = keine Messung (nicht geschätzt).</CardDescription></div></CardHeader>
            <CardContent><Heatmap grid={data.global.heatmap} /></CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Preis nach Uhrzeit</CardTitle><CardDescription>alle Strecken</CardDescription></div></CardHeader><CardContent><HourChart data={data.global.byHour} /></CardContent></Card>
            <Card><CardHeader><div><CardTitle>Preis nach Wochentag</CardTitle><CardDescription>alle Strecken</CardDescription></div></CardHeader><CardContent><WeekdayChart data={data.global.byWeekday} /></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">Erwartung für die nächsten Stunden <Badge variant="demo">Prognose</Badge></CardTitle>
                <CardDescription>Durchschnitt der letzten 8 Wochen für denselben Wochentag und dieselbe Stunde (alle Strecken). Keine Messung, keine Garantie – nur ein statistischer Erwartungswert.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {data.forecast.map((f) => (
                  <div key={f.at} className={cn("rounded-lg border border-dashed p-3", f.expected !== null ? "border-amber-500/30" : "border-border")}>
                    <div className="text-[11px] text-muted">{f.label}</div>
                    <div className="tabular mt-1 text-base font-semibold">{f.expected !== null ? `≈ ${eur(f.expected)}` : <span className="text-xs font-normal text-zinc-500">zu wenig Daten</span>}</div>
                    <div className="text-[10px] text-zinc-600">{f.basedOn} Messungen</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Morgens vs. abends je Strecke</CardTitle><CardDescription>Ø gemessener Preis</CardDescription></div></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {data.perRoute.map((r) => {
                const avg = (a: number, b: number) => {
                  const xs = r.byHour.filter((h) => h.hour >= a && h.hour < b && h.avg !== null);
                  const n = xs.reduce((s, h) => s + h.count, 0);
                  return n ? xs.reduce((s, h) => s + h.avg! * h.count, 0) / n : null;
                };
                const m = avg(5, 11), e = avg(16, 22);
                return (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 text-sm font-medium">{r.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><div className="text-muted">Morgens 05–11</div><div className="tabular text-base font-semibold">{eur(m)}</div></div>
                      <div><div className="text-muted">Abends 16–22</div><div className="tabular text-base font-semibold">{eur(e)}</div></div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <p className="text-[11px] text-zinc-600">Wochentage: {WEEKDAYS_DE_SHORT.join(", ")} · Zeitzone Europe/Berlin</p>
        </>
      ) : null}
    </div>
  );
}
