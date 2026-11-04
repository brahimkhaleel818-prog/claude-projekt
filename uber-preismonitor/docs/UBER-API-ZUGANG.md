# Echte Uber-Preise: Datenquellen, Zugang und Kosten

Stand der Prüfung: **04.11.2026**. Grundlage ist die öffentliche Uber-Entwicklerdokumentation. Ein Live-Test mit gültigen Zugangsdaten war noch nicht möglich, weil noch keine vorliegen.

## 1. Ergebnis der technischen Prüfung

| Quelle | Liefert | Zugang | Bewertung |
|---|---|---|---|
| **Uber for Business – Guest Rides API**<br>`POST https://api.uber.com/v1/guests/trips/estimates` | Je Kategorie (UberX, Comfort, XL …) einen **Upfront-Fahrpreis** (`fare.value`, `fare.display`, `fare_id`) oder eine Preisspanne, dazu Abholzeit (ETA), Distanz und Dauer | OAuth 2.0 *client credentials*, Scope `guests.trips`. Erfordert ein **Uber-for-Business-Konto** und die **Freischaltung der API durch Uber** | ✅ **Empfohlen.** Am nächsten an dem Preis, den die App anzeigt: Es ist ein buchbarer Festpreis |
| Uber Riders API v1.2<br>`GET https://api.uber.com/v1.2/estimates/price` | Nur **Preisspannen** (`low_estimate`–`high_estimate`, Surge-Faktor) | Laut Doku: *„Access to this API endpoint requires approval from Uber.“* Server-Token | ⚠️ Nur Schätzungen. Freigabe wird selten erteilt |
| Uber-App mit deinem Fahrgast-Login automatisieren | – | Verstößt gegen die Nutzungsbedingungen, Bot-Erkennung, Kontosperre droht | ❌ **Nicht umgesetzt** (unerlaubt, Risiko für dein Konto) |
| Scraping von Uber-Webseiten | – | Unerlaubt, CAPTCHAs | ❌ Nicht umgesetzt |
| **Manuelle Erfassung** in dieser App | Exakt der Preis, den du in der App siehst | Kein Zugang nötig | ✅ Sofort nutzbar, als „Manuell (Uber-App)“ gekennzeichnet |

**Live verifiziert (04.11.2026):**
- `https://auth.uber.com/oauth/v2/token` antwortet auf ungültige Zugangsdaten mit `401 {"error":"invalid_client"}`.
- `https://api.uber.com/v1/guests/trips/estimates` antwortet ohne Token mit `401`.
- `https://api.uber.com/v1.2/estimates/price` antwortet mit `401 Invalid OAuth 2.0 credentials provided.`

Die Endpunkte existieren also, und die App erkennt und meldet diese Fehler korrekt. Ob der Preis-Endpunkt mit **deinen** Zugangsdaten Preise für Düsseldorf liefert, lässt sich erst mit freigeschalteten Zugangsdaten bestätigen. Dafür gibt es `npm run probe:uber` (siehe unten).

### Upfront-Preis vs. App-Preis: was du erwarten kannst

Die Guest Rides API liefert pro Kategorie einen Upfront-Fahrpreis. Das ist der Preis, zu dem Uber die Fahrt in diesem Moment anbietet. Er entsteht nach demselben Prinzip wie der Festpreis in der App und berücksichtigt Nachfrage, Uhrzeit und Strecke. Er kann trotzdem leicht von dem abweichen, was **dein persönliches Fahrgastkonto** in der App sieht, etwa wegen Uber One, Aktionen, Gutscheinen oder Zahlungsart. Die App kennzeichnet deshalb jeden Messwert mit seinem **Preistyp**:

- `UPFRONT`: buchbarer Festpreis von Uber
- `RANGE`: Preisspanne, also eine Schätzung von Uber. Mit `ONLY_UPFRONT_FARES=true` werden solche Werte gar nicht gespeichert.
- `MANUAL`: von dir aus der App übernommen
- `DEMO`: simuliert, niemals echte Daten

## 2. Zugang beantragen: Schritt für Schritt

1. **Uber-for-Business-Konto anlegen** (kostenlos): <https://www.uber.com/de/de/business/>
   Firmenkonto auf dein Unternehmen (Mietwagenunternehmen Düsseldorf) registrieren.
2. **Developer-Konto**: <https://developer.uber.com/dashboard/>. Eine App anlegen. Du erhältst `Client ID` und `Client Secret`.
3. **API-Freischaltung anfragen.** Die Guest-Rides-API ist nicht frei verfügbar. Am schnellsten geht es über deinen **Ansprechpartner bei Uber** (als Flotten- bzw. Mietwagenpartner hast du in der Regel einen) oder über das Kontaktformular von Uber for Business. Vorschlag für die Anfrage:

   > Betreff: API-Zugang Uber for Business – Guest Rides API (Fare Estimates)
   >
   > Guten Tag, wir sind ein Uber-Mietwagenpartner in Düsseldorf (Firmenname, Partner-ID). Für unsere Disposition möchten wir die Fahrpreisangebote auf festen Strecken (z. B. Düsseldorf Hbf ⇄ Flughafen DUS) in regelmäßigen Abständen abfragen und intern auswerten. Wir bitten um Freischaltung der Guest Rides API mit dem Scope `guests.trips` für unser Uber-for-Business-Konto (Organisation-UUID: …) und unsere Developer-App (Client ID: …). Bitte teilen Sie uns außerdem die für uns geltenden Rate-Limits und Nutzungsbedingungen für die regelmäßige Abfrage von `/v1/guests/trips/estimates` mit.

4. **Nutzungsbedingungen klären.** Lass dir ausdrücklich bestätigen, dass regelmäßige Preisabfragen ohne anschließende Buchung erlaubt sind und in welchem Takt. Trage die Limits danach in `.env` ein (`PROVIDER_MAX_REQUESTS_PER_MINUTE`, `PROVIDER_MAX_REQUESTS_PER_HOUR`, `PROVIDER_MIN_INTERVAL_MINUTES`).
5. **In `.env` eintragen:**
   ```env
   PRICE_PROVIDER="uber-guest-rides"
   UBER_CLIENT_ID="…"
   UBER_CLIENT_SECRET="…"
   UBER_ORGANIZATION_UUID="…"   # falls Uber sie verlangt
   ONLY_UPFRONT_FARES="true"    # nur echte Festpreise speichern
   ```
6. **Testen, ohne etwas zu speichern:**
   ```bash
   npm run probe:uber
   ```
   Erwartete Ausgabe bei Erfolg: `HTTP 200` und eine Zeile pro Kategorie mit Preis.
7. Worker neu starten (`docker compose restart worker`). Ab jetzt werden echte Preise gespeichert. Demo-Daten werden ausgeblendet und lassen sich unter **Status** löschen.

## 3. Kosten

| Posten | Kosten |
|---|---|
| Uber-for-Business-Konto | kostenlos (Abrechnung nur für tatsächlich gebuchte Fahrten) |
| Developer-Konto / API | Uber veröffentlicht keine Preise für Estimates-Abfragen; bisher fallen dafür üblicherweise **keine Gebühren** an. Verbindlich ist nur, was Uber dir bei der Freischaltung mitteilt |
| Server (VPS, z. B. 2 vCPU / 4 GB RAM) | ca. 5–15 € pro Monat |
| Domain + HTTPS (Let's Encrypt über Caddy) | ca. 1 € pro Monat bzw. kostenlos |
| Telegram-Bot | kostenlos |
| E-Mail (SMTP) | meist im vorhandenen Mail-Paket enthalten |

## 4. Abfragehäufigkeit

Die App unterstützt die Intervalle 1, 5, 10, 15, 30 und 60 Minuten. Das **tatsächliche** Intervall ist nie kürzer als `PROVIDER_MIN_INTERVAL_MINUTES`. Zusätzlich begrenzt ein Rate-Limiter die Anfragen pro Minute und Stunde. Rechenbeispiel: 2 Strecken alle 1 Minute ergeben 2.880 Abfragen pro Tag; 10 Strecken alle 5 Minuten ebenfalls 2.880 pro Tag. Lass dir von Uber bestätigen, dass dieses Volumen erlaubt ist.

Für das Token gilt laut Uber: Es ist 30 Tage gültig, es dürfen maximal 100 Token-Anfragen pro Stunde gestellt werden, und ab 100 Tokens wird das älteste ungültig. Die App holt das Token deshalb nur einmal und verwendet es weiter. Bei `401` holt sie genau einmal ein neues.

## 5. Weitere Quellen anbinden

Neue autorisierte Datenquellen implementieren das Interface `PriceProvider` in `src/lib/providers/types.ts` und werden in `src/lib/providers/index.ts` registriert. Scheduler, Datenbank, Charts, Export und Alarme funktionieren dann ohne weitere Änderungen.

Quellen:
- [Guest Rides – Trip Estimates](https://developer.uber.com/docs/guest-rides/references/api/v1/guest-trips-estimates-post)
- [Guest Rides – Authentifizierung](https://developer.uber.com/docs/guest-rides/guides/authentication)
- [Guest Rides – Pulling Product Estimates](https://developer.uber.com/docs/guest-rides/guest-ride-api-build-guide/pulling-product-estimates)
- [Riders API v1.2 – Price Estimates](https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get)
- [Uber for Business](https://www.uber.com/de/de/business/)
