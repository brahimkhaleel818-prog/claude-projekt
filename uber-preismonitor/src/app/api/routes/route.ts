import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { routesOverview } from "@/lib/queries";
import { routeInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json(await routesOverview()));

export const POST = handler(async (req: Request) => {
  const data = await parseBody(req, routeInput);
  const max = await prisma.route.aggregate({ _max: { sortOrder: true } });
  const route = await prisma.route.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1, nextRunAt: new Date() } });
  return json(route, 201);
});
