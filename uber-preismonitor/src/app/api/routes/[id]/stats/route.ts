import { handler, json, rangeFromUrl } from "@/lib/api";
import { availableCategories, routeStats, runStats } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const range = rangeFromUrl(url);
  const category = url.searchParams.get("category") || null;
  const [stats, runs, categories] = await Promise.all([
    routeStats(id, range.from, range.to, category),
    runStats(id, range.from, range.to),
    availableCategories(id),
  ]);
  return json({ range, stats, runs, categories });
});
