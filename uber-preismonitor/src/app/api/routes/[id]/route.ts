import { HttpError, handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { routePatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const route = await prisma.route.findUnique({ where: { id } });
  if (!route) throw new HttpError(404, "Strecke nicht gefunden");
  return json(route);
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = await parseBody(req, routePatch);
  const existing = await prisma.route.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Strecke nicht gefunden");
  const scheduleChanged = data.intervalMinutes !== undefined || (data.active === true && !existing.active);
  const route = await prisma.route.update({
    where: { id },
    data: { ...data, ...(scheduleChanged ? { nextRunAt: new Date() } : {}) },
  });
  return json(route);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await prisma.route.delete({ where: { id } }).catch(() => {
    throw new HttpError(404, "Strecke nicht gefunden");
  });
  return json({ ok: true });
});
