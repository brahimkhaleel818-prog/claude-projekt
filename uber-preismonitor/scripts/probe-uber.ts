/**
 * Prüft die konfigurierte Uber-Integration mit EINER echten Anfrage
 * (Hbf → DUS) und gibt das Ergebnis aus. Es werden keine Daten gespeichert.
 *   npm run probe:uber
 */
import { describeActiveProvider, getActiveProvider } from "../src/lib/providers";

async function main() {
  const info = describeActiveProvider();
  console.log("Datenquelle:", info.id, "-", info.label);
  if (!info.configured) {
    console.error("Nicht konfiguriert:", info.reason);
    process.exit(2);
  }
  const p = getActiveProvider()!;
  const res = await p.fetchPrices({ lat: 51.21992, lng: 6.7943 }, { lat: 51.2785, lng: 6.7648 });
  console.log(`HTTP ${res.httpStatus}, fares_unavailable=${res.faresUnavailable}, Produkte: ${res.products.length}`);
  for (const pr of res.products)
    console.log(`  ${pr.category.padEnd(16)} ${String(pr.display ?? pr.value ?? "Nicht verfügbar").padEnd(14)} ${pr.priceType}${pr.pickupEtaMin !== null ? `  ETA ${pr.pickupEtaMin} Min` : ""}`);
  if (info.isDemo) console.log("\nACHTUNG: Das sind SIMULIERTE Demo-Werte, keine Uber-Preise.");
}

main().catch((err) => {
  console.error("Fehler:", (err as Error).message);
  process.exit(1);
});
