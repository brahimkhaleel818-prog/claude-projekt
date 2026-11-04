import { HttpError, handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Fahrtrichtung wechseln: liefert die Gegenrichtung (eigene Strecke mit
 * eigenem Preisverlauf). Existiert sie noch nicht, wird sie angelegt.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const route = await prisma.route.findUnique({ where: { id }, include: { reverseRoute: true, reverseOf: true } });
  if (!route) throw new HttpError(404, "Strecke nicht gefunden");
  const existing = route.reverseRoute ?? route.reverseOf;
  if (existing) return json({ route: existing, created: false });

  const reversed = await prisma.$transaction(async (tx) => {
    const r = await tx.route.create({
      data: {
        name: reverseName(route.name, route.originAddress, route.destAddress),
        originAddress: route.destAddress,
        originLat: route.destLat,
        originLng: route.destLng,
        destAddress: route.originAddress,
        destLat: route.originLat,
        destLng: route.originLng,
        active: route.active,
        intervalMinutes: route.intervalMinutes,
        categories: route.categories,
        sortOrder: route.sortOrder,
        nextRunAt: new Date(),
      },
    });
    await tx.route.update({ where: { id: route.id }, data: { reverseRouteId: r.id } });
    return r;
  });
  return json({ route: reversed, created: true }, 201);
});

function reverseName(name: string, origin: string, dest: string) {
  const parts = name.split(/\s*(?:→|->|⇄)\s*/);
  if (parts.length === 2) return `${parts[1]} → ${parts[0]}`;
  return `${dest.split(",")[0]} → ${origin.split(",")[0]}`;
}
