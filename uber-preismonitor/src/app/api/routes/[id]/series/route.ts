import { handler, json, rangeFromUrl } from "@/lib/api";
import { series } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const range = rangeFromUrl(url);
  const cats = (url.searchParams.get("categories") ?? "").split(",").filter(Boolean);
  return json({ range, ...(await series(id, range.from, range.to, cats)) });
});
