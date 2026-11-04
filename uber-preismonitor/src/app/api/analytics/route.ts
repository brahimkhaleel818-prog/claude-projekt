import { handler, json, rangeFromUrl } from "@/lib/api";
import { buildInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const range = rangeFromUrl(url);
  return json({ range, ...(await buildInsights(range.from, range.to, url.searchParams.get("category") || null)) });
});
