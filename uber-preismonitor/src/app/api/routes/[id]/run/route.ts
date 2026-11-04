import { HttpError, handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Sofortige Abfrage anstoßen: der Worker übernimmt im nächsten Takt. */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const r = await prisma.route.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Strecke nicht gefunden");
  if (r.lastRunAt && Date.now() - r.lastRunAt.getTime() < 30_000) throw new HttpError(429, "Bitte mindestens 30 Sekunden warten");
  await prisma.route.update({ where: { id }, data: { nextRunAt: new Date() } });
  return json({ ok: true, message: "Abfrage eingeplant – der Worker führt sie in wenigen Sekunden aus." });
});
