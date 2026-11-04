import ExcelJS from "exceljs";
import { prisma } from "./db";
import { showDemoData } from "./providers";
import { PRICE_TYPE_LABELS, type PriceType, categoryLabel } from "./providers/types";
import { WEEKDAYS_DE, berlinParts } from "./time";

export const EXPORT_COLUMNS = [
  "Datum",
  "Uhrzeit (Europe/Berlin)",
  "Wochentag",
  "Strecke",
  "Startadresse",
  "Zieladresse",
  "Fahrtrichtung",
  "Uber-Kategorie",
  "Preistyp",
  "Preis (EUR)",
  "Preis min",
  "Preis max",
  "Anzeige laut Quelle",
  "Währung",
  "Surge-Faktor",
  "Entfernung (km)",
  "Fahrtdauer (Min)",
  "Abholzeit (Min)",
  "Datenquelle",
  "Demo-Daten",
  "Abfragezeitpunkt (UTC)",
  "Status der Abfrage",
  "Fehlermeldung",
] as const;

export type ExportRow = (string | number | null)[];

export async function exportRows(opts: { routeId?: string | null; from: Date; to: Date; categoryKey?: string | null; includeFailed?: boolean }) {
  const isDemo = showDemoData();
  const where = {
    isDemo,
    fetchedAt: { gte: opts.from, lt: opts.to },
    ...(opts.routeId ? { routeId: opts.routeId } : {}),
    ...(opts.categoryKey ? { categoryKey: opts.categoryKey } : {}),
  };
  const ms = await prisma.priceMeasurement.findMany({ where, orderBy: { fetchedAt: "asc" }, include: { route: { select: { name: true } } }, take: 500_000 });
  const rows: Array<{ t: number; row: ExportRow }> = ms.map((m) => ({
    t: m.fetchedAt.getTime(),
    row: [
      m.localDate,
      m.localTime,
      WEEKDAYS_DE[m.weekday],
      m.route.name,
      m.originAddress,
      m.destAddress,
      m.direction,
      categoryLabel(m.categoryKey, m.category),
      PRICE_TYPE_LABELS[m.priceType as PriceType] ?? m.priceType,
      Number(m.priceValue),
      m.priceLow !== null ? Number(m.priceLow) : null,
      m.priceHigh !== null ? Number(m.priceHigh) : null,
      m.displayText,
      m.currency,
      m.surgeMultiplier,
      m.distanceKm,
      m.durationSec !== null ? Math.round(m.durationSec / 60) : null,
      m.pickupEtaMin,
      m.provider,
      m.isDemo ? "JA – simuliert" : "nein",
      m.fetchedAt.toISOString(),
      m.status,
      null,
    ],
  }));

  if (opts.includeFailed !== false) {
    const runs = await prisma.fetchRun.findMany({
      where: { isDemo, status: { not: "SUCCESS" }, startedAt: { gte: opts.from, lt: opts.to }, ...(opts.routeId ? { routeId: opts.routeId } : {}) },
      include: { route: true },
      orderBy: { startedAt: "asc" },
    });
    for (const r of runs) {
      const p = berlinParts(r.startedAt);
      rows.push({
        t: r.startedAt.getTime(),
        row: [
          p.localDate, p.localTime, WEEKDAYS_DE[p.weekday], r.route.name, r.route.originAddress, r.route.destAddress,
          `${r.route.originAddress} → ${r.route.destAddress}`, null, null, null, null, null, "Nicht verfügbar", null,
          null, null, null, null, r.provider, r.isDemo ? "JA – simuliert" : "nein", r.startedAt.toISOString(), r.status,
          r.errorMessage,
        ],
      });
    }
  }
  rows.sort((a, b) => a.t - b.t);
  return rows.map((r) => r.row);
}

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  const s = String(v);
  // Formel-Injection in Excel verhindern
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV für deutsches Excel: Semikolon, Dezimalkomma, UTF-8 mit BOM */
export function toCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export async function toXlsx(rows: ExportRow[], title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Uber Alkhaled – Preisüberwachung Düsseldorf";
  wb.created = new Date();
  const ws = wb.addWorksheet("Messwerte", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = EXPORT_COLUMNS.map((h) => ({ header: h, key: h, width: Math.max(12, Math.min(40, h.length + 4)) }));
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  for (const col of [10, 11, 12]) ws.getColumn(col).numFmt = '#,##0.00 "€"';
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };
  const info = wb.addWorksheet("Info");
  info.addRows([
    ["Export", title],
    ["Erstellt", new Date().toISOString()],
    ["Hinweis", "Alle Preise stammen aus gespeicherten Messungen. Fehlgeschlagene Abfragen sind ohne Preis aufgeführt (Nicht verfügbar)."],
  ]);
  info.getColumn(1).width = 14;
  info.getColumn(2).width = 100;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
