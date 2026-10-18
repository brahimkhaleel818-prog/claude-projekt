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
4. Die E-Mail in der passenden Sprache geht raus – mit Vorname des Kunden und
   dem Download-Link zum E-Book in seiner Sprache.
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

## E-Books und E-Mail-Vorlagen

| Sprache | E-Book | Betreff |
|---|---|---|
| `de` | Nieren. Balance. Wohlbefinden. | Ihr Eveom E-Book ist da 📖 |
| `nl` | Nieren. Balans. Welzijn. (NL & BE) | Uw Eveom e-book is er 📖 |
| `fr` | Reins. Équilibre. Bien-être. | Votre e-book Eveom est arrivé 📖 |
| `en` | Kidneys. Balance. Wellbeing. | Your Eveom e-book is here 📖 |

- Die PDFs liegen in Shopify unter **Inhalte → Dateien**, die Download-Links
  stehen in `config.json` (`downloadUrl`). Neues PDF? In Shopify hochladen,
  Link kopieren und in `config.json` ersetzen.
- Die E-Mail-Texte stehen in `templates/de.html`, `nl.html`, `fr.html`, `en.html`.
  Der **Betreff** steht im `<title>…</title>`.
- Platzhalter: `{{Vorname}}`, `{{Nachname}}`, `{{Bestellnummer}}`,
  `{{Download-Link}}`, `{{E-Book-Titel}}`, `{{Shop}}`.
- Neue Sprache? Vorlage anlegen, in `config.json` unter `languages` eintragen
  und Länder zuordnen.

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

### B. E-Mail-Versand über Outlook / Microsoft 365

`info@eveom.health` läuft über Microsoft 365. Die Mails werden über die
Microsoft-Graph-Schnittstelle direkt aus diesem Postfach verschickt und landen
dort auch unter „Gesendete Elemente“. (SMTP mit Passwort schaltet Microsoft ab
Ende 2026 standardmäßig ab, deshalb nicht SMTP.)

Einmalig im **Microsoft Entra Admin Center** (https://entra.microsoft.com,
mit einem Admin-Konto von eveom.health anmelden):

1. **Anwendungen → App-Registrierungen → Neue Registrierung**, Name z. B.
   „Eveom E-Book-Versand“, Kontotyp „Nur Konten in diesem Organisationsverzeichnis“
   → **Registrieren**.
2. Auf der Übersichtsseite kopieren: **Anwendungs-ID (Client)** und
   **Verzeichnis-ID (Mandant)**.
3. **API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph →
   Anwendungsberechtigungen → `Mail.Send`** → Hinzufügen → danach
   **„Administratorzustimmung erteilen“** klicken.
4. **Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel** (Laufzeit
   z. B. 24 Monate) → den **Wert** sofort kopieren (wird nur einmal angezeigt).
   Vor Ablauf einen neuen erstellen und das Secret in GitHub ersetzen.

Tipp für mehr Sicherheit: `Mail.Send` erlaubt der App das Senden aus jedem
Postfach eurer Firma. Mit einer „Application Access Policy“ in Exchange Online
lässt sich das auf `info@eveom.health` beschränken.

Andere Anbieter (Google, IONOS, Strato, Brevo …) gehen auch – dann statt der
`MS_…`-Secrets `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` eintragen.

### C. GitHub-Secrets eintragen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Wert |
|---|---|
| `SHOPIFY_STORE` | `cd7d0a-1c.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | aus Schritt A |
| `SHOPIFY_CLIENT_SECRET` | aus Schritt A |
| `MS_TENANT_ID` | Verzeichnis-ID (Mandant) aus Schritt B |
| `MS_CLIENT_ID` | Anwendungs-ID (Client) aus Schritt B |
| `MS_CLIENT_SECRET` | geheimer Clientschlüssel (Wert) aus Schritt B |
| `MAIL_FROM` | `info@eveom.health` |
| `MAIL_BCC` (optional) | deine Adresse, falls du eine Kopie jeder Mail willst |
| `MAIL_REPLY_TO` (optional) | Antwortadresse, falls nicht info@ |

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

- Die Download-Links sind öffentliche Shopify-Links: Wer den Link hat (oder
  ihn in `config.json` im öffentlichen Repo findet), kann das PDF laden.
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
