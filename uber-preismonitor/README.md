# Uber Alkhaled – Preisüberwachung Düsseldorf

Diese Web-App überwacht Uber-Fahrpreise auf frei wählbaren Strecken rund um die Uhr. Jede Messung wird dauerhaft gespeichert. Das Dashboard zeigt Preisverläufe, Muster nach Uhrzeit und Wochentag sowie Preisalarme.

> **Wichtig: Woher kommen die Preise?** Uber gibt Fahrpreise nur über **freigeschaltete** Schnittstellen heraus. Die App ist für die offizielle **Uber for Business Guest Rides API** fertig implementiert (Upfront-Festpreise je Kategorie). Die Zugangsdaten musst du bei Uber beantragen, die Anleitung steht in [`docs/UBER-API-ZUGANG.md`](docs/UBER-API-ZUGANG.md). Bis dahin gilt:
> - ohne Datenquelle: aktuelle Preise werden als **„Nicht verfügbar“** angezeigt
> - Preise, die du in der Uber-App siehst, kannst du als **„Manuell (Uber-App)“** erfassen
> - zum Ausprobieren gibt es eine **Demo-Quelle**. Sie ist überall deutlich als **DEMO** markiert und wird nie mit echten Daten vermischt.
>
> Die App liest **nicht** die Uber-App mit deinem Login aus und betreibt kein Scraping. Beides ist von Uber verboten und gefährdet dein Konto.

## Funktionen

- **Automatische Preisabfrage** im Background-Worker, unabhängig vom Browser. Intervalle 1, 5, 10, 15, 30 oder 60 Minuten pro Strecke. Dazu Rate-Limiting, Retry mit exponentiellem Backoff, Pause bei HTTP 429, längere Intervalle nach wiederholten Fehlern, Heartbeat und ein Protokoll jeder Abfrage, auch der fehlgeschlagenen.
- **Strecken verwalten:** anlegen, bearbeiten, löschen, (de)aktivieren, Intervall wählen, Kategorien filtern. Adresssuche mit Geocoding über OpenStreetMap, GPS-Koordinaten. Start und Ziel lassen sich per ⇄ vertauschen.
- **Fahrtrichtung wechseln mit einem Klick:** Die Gegenrichtung ist eine eigene Strecke mit eigenem Preisverlauf und wird bei Bedarf automatisch angelegt.
- **Historie** in PostgreSQL. Zeiträume: Heute, Gestern, 7 Tage, 30 Tage oder frei wählbar. Gespeichert werden Datum, Uhrzeit (Europe/Berlin), Adressen, Richtung, Kategorie, Preis bzw. Spanne, Preistyp, Währung, Quelle, Abfragezeitpunkt und Status.
- **Dashboard** im Dark Mode, responsiv für Smartphone und Desktop. Es zeigt den aktuellen und den letzten Preis, die Änderung in € und % (grün = steigt, rot = sinkt), Höchst-, Tiefst- und Durchschnittswert sowie Charts (Recharts) mit Tooltips, Durchschnittslinie und Markierung von Preisspitzen. Fehlgeschlagene Abfragen erscheinen als **Lücke**; es wird kein Wert eingesetzt.
- **Analyse:** teuerste und günstigste Uhrzeiten, typischer Anstieg, morgens vs. abends, Wochentage, Vergleich der Richtungen, Heatmap Wochentag × Uhrzeit und eine Prognose für die nächsten Stunden. Alles ist klar gekennzeichnet als *Gemessen*, *Statistische Auswertung* oder *Prognose*.
- **Kategorien:** UberX, Comfort, XL, Green, Black usw., je nachdem, was die Quelle liefert. Zwischen den Kategorien lässt sich wechseln und vergleichen.
- **Preisalarme:** Anstieg > X %, starker Rückgang, über bzw. unter X €, neues Tageshoch bzw. -tief. Je Strecke und Kategorie einstellbar, mit Pause nach dem Auslösen. Kanäle: Dashboard, Browser-Push, Telegram, E-Mail.
- **Export** als CSV (für deutsches Excel) und als Excel-Datei (.xlsx), inklusive fehlgeschlagener Abfragen.
- **Sicherheit:** Login, geschützte API, Secrets nur in der `.env`, Logging (pino), Docker.

## Architektur

```
Browser (Next.js/React, Tailwind, Recharts, Lucide)
   │  HTTPS + Session-Cookie
   ▼
Next.js 16 App Router ── API-Routen (/api/*) ── Proxy (Login-Schutz)
   │                                              │
   └──────────── Prisma ORM ──────────── PostgreSQL ◄──┐
                                                       │
Worker (Node, eigener Prozess) ── Scheduler (FOR UPDATE SKIP LOCKED)
   ├─ Rate-Limiter (pro Minute/Stunde, 429-Pause)
   ├─ Retry + Backoff
   ├─ Provider-Registry ─┬─ uber-guest-rides  (Uber for Business, OAuth client_credentials)
   │                     ├─ uber-riders-v12   (Uber Riders API, nur mit Freigabe)
   │                     └─ demo              (SIMULIERT, isDemo=true)
   └─ Alarm-Engine → Dashboard / Web-Push / Telegram / E-Mail
```

- **Kein Redis nötig:** Die Jobs stehen in PostgreSQL (`Route.nextRunAt`). Fällige Strecken werden atomar per `FOR UPDATE SKIP LOCKED` übernommen, das ist auch mit mehreren Workern sicher und übersteht Neustarts.
- **Modulare Datenquellen:** Jede Quelle implementiert `PriceProvider` (`src/lib/providers/types.ts`).
- **Demo-Trennung:** Jeder Messwert hat `isDemo`. Ansichten, Export und Analyse zeigen immer nur *entweder* Demo- *oder* echte Daten.

Wichtige Dateien:

| Pfad | Inhalt |
|---|---|
| `prisma/schema.prisma` | Datenbankschema |
| `src/worker/index.ts` | Background-Worker und Scheduler |
| `src/lib/collector.ts` | eine Abfrage ausführen, speichern, Alarme prüfen |
| `src/lib/providers/*` | Datenquellen |
| `src/lib/queries.ts`, `src/lib/insights.ts` | Auswertungen |
| `src/app/(app)/*` | Dashboard, Analyse, Strecken, Alarme, Status |
| `src/app/api/*` | REST-API |

## Schnellstart (lokal)

Voraussetzungen: Node.js 22 und PostgreSQL 14 oder neuer.

```bash
cd uber-preismonitor
npm ci
cp .env.example .env
npm run hash-password -- "DeinPasswort123"   # → ADMIN_PASSWORD_HASH
openssl rand -base64 48                       # → AUTH_SECRET
# DATABASE_URL anpassen; lokal ohne HTTPS: COOKIE_SECURE="false"
npx prisma migrate deploy && npm run db:seed
npm run dev        # Dashboard: http://localhost:3000
npm run worker     # zweites Terminal: Preisabfragen
```

Zum Ausprobieren ohne Uber-Zugang: `PRICE_PROVIDER="demo"`. Dann ist alles als DEMO markiert.

## Produktion / Hosting

| Weg | Anleitung |
|---|---|
| Eigener Server mit Docker (Worker läuft 24/7) | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Kostenlos: Oracle Cloud Always Free oder eigener PC | [`docs/KOSTENLOS.md`](docs/KOSTENLOS.md) |
| GitHub + Vercel (Cron-Endpunkt `/api/cron/collect`) | [`docs/VERCEL.md`](docs/VERCEL.md) |

## API (Auszug)

Alle Endpunkte erfordern ein Session-Cookie oder `Authorization: Bearer $API_TOKEN`.

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/overview` | Strecken mit aktuellen Preisen, Quelle, Worker-Status |
| GET/POST | `/api/routes` | Strecken auflisten bzw. anlegen |
| PATCH/DELETE | `/api/routes/:id` | bearbeiten bzw. löschen |
| POST | `/api/routes/:id/reverse` | Gegenrichtung holen oder anlegen |
| POST | `/api/routes/:id/run` | sofort abfragen |
| GET | `/api/routes/:id/series?range=today\|yesterday\|7d\|30d\|custom&from&to&categories=uberx` | Zeitreihe |
| GET | `/api/routes/:id/stats?range=…&category=…` | Kennzahlen, Stunde, Wochentag, Heatmap, Tagesvergleich |
| GET | `/api/analytics?range=…` | Muster und Prognose |
| GET | `/api/export?format=csv\|xlsx&range=…&routeId=…` | Export |
| POST | `/api/measurements/manual` | App-Preis manuell erfassen |
| GET/POST/PATCH/DELETE | `/api/alerts[/:id]` | Alarmregeln |
| GET | `/api/status` | Quelle, Limits, Worker, letzte Abfragen |
| GET/POST | `/api/cron/collect` | eine Scheduler-Runde (für Vercel/Cron, Header `Authorization: Bearer $CRON_SECRET`) |

## Tests

```bash
npm test          # 40 Unit-Tests: Uber-Parser (Doku-Beispiele), OAuth-/401-/403-/429-Verhalten,
                  # Zeitzone inkl. Sommer-/Winterzeit, Alarme, Statistik, Retry, Rate-Limit, CSV
npm run typecheck
npm run probe:uber  # echte Testabfrage gegen die konfigurierte Uber-API (speichert nichts)
```

Ergebnisse der Tests und bekannte Grenzen: [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md).
