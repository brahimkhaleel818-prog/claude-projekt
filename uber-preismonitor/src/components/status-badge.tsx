import { Badge } from "./ui/badge";

export function RunStatusBadge({ status, active = true }: { status: string | null; active?: boolean }) {
  if (!active) return <Badge variant="muted">pausiert</Badge>;
  switch (status) {
    case "SUCCESS":
      return <Badge variant="up">aktuell</Badge>;
    case "NO_DATA":
      return <Badge variant="warn">keine Preise</Badge>;
    case "FAILED":
      return <Badge variant="error">Fehler</Badge>;
    case "NOT_CONFIGURED":
      return <Badge variant="error">keine Quelle</Badge>;
    default:
      return <Badge variant="muted">wartet</Badge>;
  }
}

export function ChangeBadge({ abs, pct }: { abs: number | null; pct: number | null }) {
  if (abs === null) return <span className="text-xs text-muted">–</span>;
  if (abs === 0) return <Badge variant="muted">± 0,00 €</Badge>;
  const up = abs > 0;
  return (
    <Badge variant={up ? "up" : "down"} className="tabular">
      {up ? "▲" : "▼"} {abs > 0 ? "+" : ""}
      {abs.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
      {pct !== null ? ` (${pct > 0 ? "+" : ""}${pct.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %)` : ""}
    </Badge>
  );
}
