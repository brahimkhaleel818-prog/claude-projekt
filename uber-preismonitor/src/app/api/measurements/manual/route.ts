import { HttpError, handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { showDemoData } from "@/lib/providers";
import { normalizeCategory } from "@/lib/providers/types";
import { berlinParts } from "@/lib/time";
import { manualInput } from "@/lib/validation";

/**
 * Manuelle Erfassung eines Preises, den der Nutzer selbst in der Uber-App
 * gesehen hat. Wird als Quelle "manual" / Preistyp MANUAL gespeichert.
 */
export const POST = handler(async (req: Request) => {
  if (showDemoData()) throw new HttpError(409, "Im Demo-Modus können keine echten Preise erfasst werden");
  const d = await parseBody(req, manualInput);
  const route = await prisma.route.findUnique({ where: { id: d.routeId } });
  if (!route) throw new HttpError(404, "Strecke nicht gefunden");
  const at = d.observedAt ? new Date(d.observedAt) : new Date();
  if (at.getTime() > Date.now() + 60_000) throw new HttpError(400, "Zeitpunkt liegt in der Zukunft");
  const m = await prisma.priceMeasurement.create({
    data: {
      routeId: route.id,
      provider: "manual",
      isDemo: false,
      priceType: "MANUAL",
      category: d.category,
      categoryKey: normalizeCategory(d.category),
      priceValue: d.price,
      priceLow: d.price,
      priceHigh: d.price,
      displayText: `€${d.price.toFixed(2)} (manuell)`,
      currency: "EUR",
      originAddress: route.originAddress,
      destAddress: route.destAddress,
      direction: `${route.originAddress} → ${route.destAddress}`,
      fetchedAt: at,
      ...berlinParts(at),
      status: "OK",
      note: d.note,
    },
  });
  return json(m, 201);
});
