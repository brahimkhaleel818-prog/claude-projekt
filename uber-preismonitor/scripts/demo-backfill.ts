/**
 * NUR FÜR ENTWICKLUNG/TESTS: erzeugt SIMULIERTE Demo-Historie (isDemo=true)
 * für die vergangenen N Tage, damit Charts/Heatmap getestet werden können.
 * Läuft ausschließlich bei PRICE_PROVIDER=demo. Echte Daten werden nie erzeugt.
 *   PRICE_PROVIDER=demo npx tsx scripts/demo-backfill.ts 14
 */
import { prisma } from "../src/lib/db";
import { DemoProvider } from "../src/lib/providers/demo";
import { berlinParts } from "../src/lib/time";

async function main() {
  if (process.env.PRICE_PROVIDER !== "demo") {
    console.error("Abbruch: nur im Demo-Modus erlaubt (PRICE_PROVIDER=demo).");
    process.exit(1);
  }
  const days = Number(process.argv[2] ?? 14);
  const p = new DemoProvider();
  const routes = await prisma.route.findMany();
  const now = Date.now();
  let n = 0;
  for (const r of routes) {
    for (let t = now - days * 86_400_000; t < now - 10 * 60_000; t += 15 * 60_000) {
      const at = new Date(t);
      // simulierte Ausfälle, damit Lücken sichtbar werden
      if (Math.random() < 0.02) {
        await prisma.fetchRun.create({ data: { routeId: r.id, provider: "demo", isDemo: true, status: "FAILED", errorMessage: "DEMO: simulierter Ausfall", startedAt: at, finishedAt: at } });
        continue;
      }
      const res = await p.fetchPrices({ lat: r.originLat, lng: r.originLng }, { lat: r.destLat, lng: r.destLng }, undefined, at);
      const run = await prisma.fetchRun.create({ data: { routeId: r.id, provider: "demo", isDemo: true, status: "SUCCESS", productCount: res.products.length, startedAt: at, finishedAt: at } });
      await prisma.priceMeasurement.createMany({
        data: res.products.map((x) => ({
          routeId: r.id, runId: run.id, provider: "demo", isDemo: true, priceType: "DEMO", productId: x.productId, category: x.category, categoryKey: x.categoryKey,
          priceValue: x.value!, priceLow: x.low, priceHigh: x.high, displayText: x.display, currency: "EUR", surgeMultiplier: x.surgeMultiplier,
          distanceKm: x.distanceKm, durationSec: x.durationSec, pickupEtaMin: x.pickupEtaMin, originAddress: r.originAddress, destAddress: r.destAddress,
          direction: `${r.originAddress} → ${r.destAddress}`, fetchedAt: at, ...berlinParts(at),
        })),
      });
      n += res.products.length;
    }
  }
  console.log(`${n} DEMO-Messwerte erzeugt (isDemo=true).`);
}

main().finally(() => prisma.$disconnect());
