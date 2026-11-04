"use client";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";

export type Range = { key: "today" | "yesterday" | "7d" | "30d" | "custom"; from?: string; to?: string };

const OPTS: Array<{ key: Range["key"]; label: string }> = [
  { key: "today", label: "Heute" },
  { key: "yesterday", label: "Gestern" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "custom", label: "Zeitraum" },
];

export function rangeQuery(r: Range) {
  const q = new URLSearchParams({ range: r.key });
  if (r.key === "custom") {
    if (r.from) q.set("from", r.from);
    if (r.to) q.set("to", r.to);
  }
  return q.toString();
}

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-zinc-900 p-0.5">
        {OPTS.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key === "custom" ? { key: "custom", from: value.from ?? today, to: value.to ?? today } : { key: o.key })}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value.key === o.key ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.key === "custom" ? (
        <div className="flex items-center gap-1.5">
          <Input type="date" className="h-8 w-[140px] text-xs" max={today} value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-xs text-muted">bis</span>
          <Input type="date" className="h-8 w-[140px] text-xs" max={today} value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      ) : null}
    </div>
  );
}
