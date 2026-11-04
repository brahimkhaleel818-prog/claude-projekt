import { handler, rangeFromUrl } from "@/lib/api";
import { exportRows, toCsv, toXlsx } from "@/lib/export";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const range = rangeFromUrl(url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = await exportRows({
    routeId: url.searchParams.get("routeId"),
    categoryKey: url.searchParams.get("category"),
    from: range.from,
    to: range.to,
    includeFailed: url.searchParams.get("includeFailed") !== "0",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `uber-preise-${stamp}.${format}`;
  if (format === "csv") {
    return new Response(toCsv(rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
    });
  }
  const buf = await toXlsx(rows, range.label);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
});
