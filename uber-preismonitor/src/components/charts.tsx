"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WEEKDAYS_DE_SHORT, WEEKDAYS_DE } from "@/lib/time";
import { categoryColor, cn, eur } from "@/lib/utils";

const tf = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const dtf = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const df = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });

export function Empty({ text = "Noch keine Messungen in diesem Zeitraum.", className }: { text?: string; className?: string }) {
  return (
    <div className={cn("grid h-full min-h-40 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted", className)}>
      {text}
    </div>
  );
}

type SeriesPoint = Record<string, number | string | null>;

function TooltipBox({ active, payload, label, multiDay, labels }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; payload: SeriesPoint }>; label?: number; multiDay: boolean; labels: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rows = payload.filter((x) => !String(x.dataKey).includes("__") && typeof x.value === "number");
  return (
    <div className="min-w-44 rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-xl">
      <div className="mb-1.5 font-medium text-zinc-200">{(multiDay ? dtf : tf).format(new Date(label!))} Uhr</div>
      {p.__gap ? <div className="text-red-300">Abfrage fehlgeschlagen – kein Preis (Nicht verfügbar)</div> : null}
      {rows.map((r) => {
        const lo = p[`${r.dataKey}__lo`] as number | null;
        const hi = p[`${r.dataKey}__hi`] as number | null;
        const peak = p[`${r.dataKey}__peak`] !== undefined;
        return (
          <div key={r.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: r.color }} />{labels[r.dataKey] ?? r.dataKey}</span>
            <span className="tabular font-medium">
              {eur(r.value)}
              {lo !== null && hi !== null && lo !== hi ? <span className="ml-1 text-zinc-500">({eur(lo, 0)}–{eur(hi, 0)})</span> : null}
              {peak ? <span className="ml-1 text-amber-300">▲ Spitze</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Preisverlauf: Lücken bei fehlgeschlagenen Abfragen, Durchschnittslinie, Spitzen markiert */
export function PriceLineChart({
  points,
  categories,
  labels,
  avg,
  multiDay,
  height = 320,
}: {
  points: SeriesPoint[];
  categories: string[];
  labels: Record<string, string>;
  avg?: number | null;
  multiDay: boolean;
  height?: number;
}) {
  if (points.filter((p) => categories.some((c) => typeof p[c] === "number")).length === 0) return <Empty />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => (multiDay ? df : tf).format(new Date(t))}
            minTickGap={40}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tickFormatter={(v) => `${v} €`} width={56} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip content={<TooltipBox multiDay={multiDay} labels={labels} />} />
          {avg ? <ReferenceLine y={avg} stroke="#71717a" strokeDasharray="6 4" label={{ value: `Ø ${eur(avg)}`, position: "insideTopRight", fill: "#a1a1aa", fontSize: 11 }} /> : null}
          {categories.map((c, i) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              name={labels[c] ?? c}
              stroke={categoryColor(c, i)}
              strokeWidth={2}
              dot={points.length < 60 ? { r: 2.5 } : false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {categories.map((c) => (
            <Scatter key={`${c}-peak`} dataKey={`${c}__peak`} fill="#fbbf24" shape="star" legendType="none" isAnimationActive={false} />
          ))}
          {categories.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-zinc-300">{v}</span>} /> : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourChart({ data, height = 240 }: { data: Array<{ hour: number; avg: number | null; min: number | null; max: number | null; count: number }>; height?: number }) {
  if (!data.some((d) => d.count > 0)) return <Empty />;
  const overall = data.filter((d) => d.avg !== null);
  const mean = overall.reduce((a, d) => a + d.avg! * d.count, 0) / Math.max(1, overall.reduce((a, d) => a + d.count, 0));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => `${v} €`} width={56} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-xl">
                  <div className="mb-1 font-medium">{String(d.hour).padStart(2, "0")}:00 – {String(d.hour).padStart(2, "0")}:59 Uhr</div>
                  {d.count ? (
                    <>
                      <div>Ø {eur(d.avg)}</div>
                      <div className="text-zinc-400">Min {eur(d.min)} · Max {eur(d.max)}</div>
                      <div className="text-zinc-500">{d.count} Messungen</div>
                    </>
                  ) : (
                    <div className="text-zinc-400">Keine Messungen</div>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine y={mean} stroke="#71717a" strokeDasharray="6 4" />
          <Line dataKey="max" stroke="#22c55e" strokeOpacity={0.5} strokeWidth={1} dot={false} connectNulls={false} name="Max" isAnimationActive={false} />
          <Line dataKey="avg" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls={false} name="Ø" isAnimationActive={false} />
          <Line dataKey="min" stroke="#ef4444" strokeOpacity={0.5} strokeWidth={1} dot={false} connectNulls={false} name="Min" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekdayChart({ data, height = 240 }: { data: Array<{ weekday: number; avg: number | null; count: number; min: number | null; max: number | null }>; height?: number }) {
  if (!data.some((d) => d.count > 0)) return <Empty />;
  const vals = data.filter((d) => d.avg !== null).map((d) => d.avg!);
  const max = Math.max(...vals), min = Math.min(...vals);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="weekday" tickFormatter={(d) => WEEKDAYS_DE_SHORT[d]} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => `${v} €`} width={56} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-xl">
                  <div className="mb-1 font-medium">{WEEKDAYS_DE[d.weekday]}</div>
                  {d.count ? <><div>Ø {eur(d.avg)}</div><div className="text-zinc-400">Min {eur(d.min)} · Max {eur(d.max)} · {d.count} Messungen</div></> : <div className="text-zinc-400">Keine Messungen</div>}
                </div>
              );
            }}
          />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.weekday} fill={d.avg === max ? "#22c55e" : d.avg === min ? "#ef4444" : "#3f3f46"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DAY_COLORS = ["#60a5fa", "#a78bfa", "#f59e0b", "#2dd4bf", "#f472b6", "#e4e4e7", "#fb923c"];

export function DayCompareChart({ rows, days, height = 260 }: { rows: Array<Record<string, number | null>>; days: string[]; height?: number }) {
  const shown = days.slice(-7);
  if (shown.length === 0) return <Empty />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}h`} tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis tickFormatter={(v) => `${v} €`} width={56} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-xl">
                  <div className="mb-1 font-medium">{String(label).padStart(2, "0")}:00 Uhr</div>
                  {payload.filter((p) => typeof p.value === "number").map((p) => (
                    <div key={String(p.dataKey)} className="flex justify-between gap-4"><span style={{ color: p.color }}>{fmtDay(String(p.dataKey))}</span><span className="tabular">{eur(p.value as number)}</span></div>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-zinc-300">{fmtDay(String(v))}</span>} />
          {shown.map((d, i) => (
            <Line key={d} dataKey={d} stroke={DAY_COLORS[i % DAY_COLORS.length]} strokeWidth={i === shown.length - 1 ? 2.5 : 1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtDay(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const wd = (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS_DE_SHORT[wd]} ${String(day).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}

/** Heatmap Wochentag × Uhrzeit – nur Zellen mit echten Messungen werden eingefärbt */
export function Heatmap({ grid }: { grid: Array<Array<{ avg: number | null; min: number | null; max: number | null; count: number }>> }) {
  const vals = grid.flat().filter((c) => c.avg !== null).map((c) => c.avg!);
  if (vals.length === 0) return <Empty />;
  const min = Math.min(...vals), max = Math.max(...vals);
  const color = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    // rot (günstig) → grau → grün (teuer)
    if (t < 0.5) return `rgba(239,68,68,${0.85 - t * 1.4})`;
    return `rgba(34,197,94,${(t - 0.5) * 1.6 + 0.1})`;
  };
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px] text-muted">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</div>
          ))}
          {grid.map((row, wd) => (
            <Row key={wd} wd={wd} row={row} color={color} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
          <span>günstig {eur(min)}</span>
          <div className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg, rgba(239,68,68,.85), rgba(63,63,70,.3), rgba(34,197,94,.9))" }} />
          <span>teuer {eur(max)}</span>
          <span className="ml-3 inline-flex items-center gap-1"><span className="size-3 rounded-sm border border-border bg-zinc-900" /> keine Messung</span>
        </div>
      </div>
    </div>
  );
}

function Row({ wd, row, color }: { wd: number; row: Array<{ avg: number | null; min: number | null; max: number | null; count: number }>; color: (v: number) => string }) {
  return (
    <>
      <div className="flex items-center text-[11px] text-zinc-400">{WEEKDAYS_DE_SHORT[wd]}</div>
      {row.map((c, h) => (
        <div
          key={h}
          title={c.avg !== null ? `${WEEKDAYS_DE[wd]} ${String(h).padStart(2, "0")}:00 – Ø ${eur(c.avg)} (Min ${eur(c.min)}, Max ${eur(c.max)}, ${c.count} Messungen)` : `${WEEKDAYS_DE[wd]} ${String(h).padStart(2, "0")}:00 – keine Messung`}
          className="aspect-square rounded-[4px] border border-zinc-800/80"
          style={{ background: c.avg !== null ? color(c.avg) : "#111113" }}
        />
      ))}
    </>
  );
}
