/** Legt die beiden Startstrecken an (Hbf ⇄ Flughafen DUS) – ohne Preise. */
import { prisma } from "../src/lib/db";

const HBF = { address: "Düsseldorf Hauptbahnhof, Konrad-Adenauer-Platz 14, 40210 Düsseldorf", lat: 51.21992, lng: 6.79430 };
const DUS = { address: "Flughafen Düsseldorf (DUS), Terminal, Flughafenstraße 105, 40474 Düsseldorf", lat: 51.27850, lng: 6.76480 };

async function main() {
  const existing = await prisma.route.count();
  if (existing > 0) {
    console.log(`Es existieren bereits ${existing} Strecken – Seed übersprungen.`);
    return;
  }
  const a = await prisma.route.create({
    data: {
      name: "Düsseldorf Hbf → Flughafen DUS",
      originAddress: HBF.address, originLat: HBF.lat, originLng: HBF.lng,
      destAddress: DUS.address, destLat: DUS.lat, destLng: DUS.lng,
      intervalMinutes: 5, sortOrder: 1,
    },
  });
  const b = await prisma.route.create({
    data: {
      name: "Flughafen DUS → Düsseldorf Hbf",
      originAddress: DUS.address, originLat: DUS.lat, originLng: DUS.lng,
      destAddress: HBF.address, destLat: HBF.lat, destLng: HBF.lng,
      intervalMinutes: 5, sortOrder: 2,
    },
  });
  await prisma.route.update({ where: { id: a.id }, data: { reverseRouteId: b.id } });
  await prisma.alertRule.createMany({
    data: [
      { name: "Anstieg > 20 %", type: "PCT_INCREASE", threshold: 20, channels: ["dashboard", "push"] },
      { name: "Starker Rückgang > 20 %", type: "PCT_DECREASE", threshold: 20, channels: ["dashboard"] },
      { name: "Neues Tageshoch", type: "DAILY_HIGH", threshold: 0, channels: ["dashboard"], cooldownMinutes: 60 },
    ],
  });
  console.log("Startstrecken und Beispiel-Alarmregeln angelegt.");
}

main().finally(() => prisma.$disconnect());
