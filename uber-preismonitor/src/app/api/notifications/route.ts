import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const items = await prisma.notification.findMany({
    where: since ? { createdAt: { gt: new Date(since) } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { route: { select: { name: true } } },
  });
  const unread = await prisma.notification.count({ where: { readAt: null } });
  return json({ items, unread });
});

/** Als gelesen markieren: { ids?: string[] } (ohne ids = alle) */
export const POST = handler(async (req: Request) => {
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string()).optional() }));
  await prisma.notification.updateMany({ where: { readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  return json({ ok: true });
});
