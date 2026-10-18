# E-Book-Versand nach Land (Shopify → E-Mail)

Läuft komplett automatisch auf GitHub Actions – ohne Claude, ohne eigenen Server,
ohne dass du irgendetwas bestätigen musst.

**Ablauf bei jeder Bestellung**

1. Alle 10 Minuten (oder sofort, wenn Shopify Flow eingerichtet ist) holt das
   Skript neue Bestellungen aus Shopify.
2. Es nimmt nur Bestellungen, die **bezahlt**, **nicht storniert** und **noch
   nicht bedient** sind und das E-Book-Produkt enthalten
   („Het Astaxanthine Voordeel – E-book“).
3. Das Land kommt aus der Rechnungsadresse (sonst Lieferadresse) → daraus die Sprache.
4. Die passende E-Mail-Vorlage wird gefüllt und das passende PDF angehängt.
5. Die Bestellung bekommt in Shopify die Tags `ebook-versendet` und `ebook-de`
   (bzw. `ebook-nl`, …). So wird nie doppelt verschickt, und du siehst im
   Shopify-Admin bei jeder Bestellung, welches E-Book rausging.

Schlägt eine E-Mail fehl, wird sie beim nächsten Lauf erneut versucht, und
GitHub schickt dir eine Fehler-Mail.

## Länder → Sprache

| Land | Sprache |
|---|---|
| Deutschland, Österreich, Schweiz, Liechtenstein, Luxemburg | Deutsch (`de`) |
| Niederlande, Belgien | Niederländisch (`nl`) |
| Frankreich, Monaco | Französisch (`fr`) |
| USA, UK, Irland, Kanada, Australien | Englisch (`en`) |
| alle anderen | Englisch (`defaultLanguage`) |

Ändern in `config.json` → `countryToLanguage` (Ländercodes nach ISO, z. B. `"BE": "fr"`).
Hinweis: Die Sprache aus dem Checkout ist bei deinem Shop fast immer Englisch
(`en-DE`, `en-BE` …), deshalb geht die Automation nach dem **Land**.

## Was du mir / dem Repo noch geben musst

### 1. E-Mail-Vorlagen

`templates/de.html`, `nl.html`, `fr.html`, `en.html` – dort liegen schon
Beispielvorlagen, die du durch deine eigenen ersetzen kannst.

- Der **Betreff** steht im `<title>…</title>` der Vorlage.
- Platzhalter: `{{first_name}}`, `{{last_name}}`, `{{order_number}}`, `{{shop_name}}`.
- Neue Sprache? Vorlage anlegen, in `config.json` unter `languages` eintragen
  und Länder zuordnen.

### 2. Die E-Books (PDF)

Dieses Repository ist **öffentlich** – PDFs hier hochzuladen würde sie für alle
downloadbar machen. Deshalb:

1. Shopify-Admin → **Inhalte → Dateien** → PDF je Sprache hochladen.
2. Link kopieren (`https://cdn.shopify.com/s/files/…`).
3. Als GitHub-Secret speichern: `EBOOK_URL_DE`, `EBOOK_URL_NL`, `EBOOK_URL_FR`, `EBOOK_URL_EN`.

Das Skript lädt das PDF bei jedem Lauf und hängt es an die E-Mail an.
Dateiname im Anhang: `attachmentName` in `config.json`.
(Max. ca. 18 MB pro PDF, sonst lehnen viele Postfächer die Mail ab.)

## Einrichtung (einmalig, ca. 20 Minuten)

### A. Shopify-Zugang

1. Shopify-Admin → **Einstellungen → Apps → Apps entwickeln** → App im
   **Dev Dashboard** erstellen (z. B. „E-Book-Versand“).
2. Neue Version anlegen, API-Berechtigungen (Scopes): `read_orders`, `write_orders`.
3. Unter „Geschützte Kundendaten“ Zugriff auf **Name, E-Mail, Adresse** aktivieren
   (sonst sind E-Mail-Adressen leer).
4. Version veröffentlichen und die App in deinem Shop **installieren**.
5. In den App-Einstellungen **Client-ID** und **Client-Secret** kopieren.

Hast du schon eine ältere Custom App mit Admin-API-Token (`shpat_…`), reicht
stattdessen das Secret `SHOPIFY_ACCESS_TOKEN` (gleiche Scopes nötig).

### B. E-Mail-Versand (SMTP)

Die Mails gehen über dein normales Postfach raus (z. B. `info@eveom.health`):

| Anbieter | `SMTP_HOST` | `SMTP_PORT` | Passwort |
|---|---|---|---|
| Google Workspace / Gmail | `smtp.gmail.com` | `465` | App-Passwort (2FA nötig) |
| IONOS | `smtp.ionos.de` | `465` | Postfach-Passwort |
| Strato | `smtp.strato.de` | `465` | Postfach-Passwort |
| Brevo (für viele Mails) | `smtp-relay.brevo.com` | `587` | SMTP-Schlüssel |

### C. GitHub-Secrets eintragen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Beispiel |
|---|---|
| `SHOPIFY_STORE` | `cd7d0a-1c.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | aus Schritt A |
| `SHOPIFY_CLIENT_SECRET` | aus Schritt A |
| `SMTP_HOST` / `SMTP_PORT` | aus Schritt B |
| `SMTP_USER` | `info@eveom.health` |
| `SMTP_PASS` | Passwort / App-Passwort |
| `MAIL_FROM` | `Eveom <info@eveom.health>` |
| `EBOOK_URL_DE` … `EBOOK_URL_EN` | Links aus „Die E-Books“ |
| `MAIL_BCC` (optional) | deine Adresse, falls du eine Kopie jeder Mail willst |
| `MAIL_REPLY_TO` (optional) | Antwortadresse |

### D. Starttermin festlegen

In `config.json` steht `sendOrdersCreatedAfter`. Nur Bestellungen **nach**
diesem Zeitpunkt bekommen automatisch ein E-Book – so erhalten Kunden, denen du
schon manuell geschickt hast, keine zweite Mail.

### E. Testen und scharf schalten

1. Änderungen in den `main`-Branch übernehmen (geplante Workflows laufen nur von `main`).
2. GitHub → **Actions → E-Book-Versand → Run workflow** mit Haken bei
   „Nur testen“ → im Log steht für jede Bestellung Land, Sprache und Betreff,
   es wird aber nichts verschickt.
3. Passt alles: fertig. Ab jetzt läuft es alle 10 Minuten von selbst.

## Optional: Sofortversand mit Shopify Flow

Ohne Flow kommt das E-Book innerhalb von ca. 10–20 Minuten. Für sofortigen Versand:

1. GitHub → Settings → Developer settings → **Fine-grained token** nur für dieses
   Repository, Berechtigung **Contents: Read and write**.
2. Shopify **Flow** → neuer Workflow → Auslöser **„Bestellung bezahlt“** →
   Aktion **„HTTP-Anfrage senden“**:
   - Methode `POST`, URL `https://api.github.com/repos/brahimkhaleel818-prog/claude-projekt/dispatches`
   - Header `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`
   - Body `{"event_type": "shopify-order"}`

Der 10-Minuten-Lauf bleibt als Sicherheitsnetz aktiv.

## Wichtig zu wissen

- **Logs sind öffentlich** (öffentliches Repo). Das Skript schreibt deshalb nur
  Bestellnummer, Land und Sprache ins Log – keine Namen oder E-Mail-Adressen.
- GitHub pausiert geplante Workflows in öffentlichen Repos nach **60 Tagen ohne
  Commit**. Du bekommst vorher eine Mail von GitHub; ein Klick auf „Enable
  workflow“ reicht. Mit Shopify Flow ist das egal, weil Flow den Lauf direkt startet.
- Bestellung soll ein E-Book nochmal bekommen? Tag `ebook-versendet` in Shopify
  entfernen – beim nächsten Lauf geht es erneut raus (innerhalb von `lookbackDays`).

## Lokal ausführen

```bash
cd ebook-automation
npm ci
npm test                                   # Tests
SHOPIFY_STORE=… SHOPIFY_CLIENT_ID=… SHOPIFY_CLIENT_SECRET=… npm run dry-run
```
