import { HttpError, handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { alertInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = await parseBody(req, alertInput.partial());
  return json(await prisma.alertRule.update({ where: { id }, data }).catch(() => { throw new HttpError(404, "Regel nicht gefunden"); }));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await prisma.alertRule.delete({ where: { id } }).catch(() => { throw new HttpError(404, "Regel nicht gefunden"); });
  return json({ ok: true });
});
