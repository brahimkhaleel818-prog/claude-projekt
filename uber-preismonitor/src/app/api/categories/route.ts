import { handler, json } from "@/lib/api";
import { availableCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const routeId = new URL(req.url).searchParams.get("routeId") ?? undefined;
  return json({ categories: await availableCategories(routeId) });
});
