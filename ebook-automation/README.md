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

## Modus: aus / test / live

In `config.json` steht `"modus"`:

| Modus | Was passiert |
|---|---|
| `"aus"` | Nichts wird verschickt. |
| `"test"` (aktuell) | Jede E-Mail geht **nur an `testEmpfaenger`** (info@eveom.health), Betreff beginnt mit `[TEST #Bestellnummer, Land]`. Kunden bekommen nichts. Die Bestellung bekommt den Tag `ebook-test`, damit jede nur einmal getestet wird. |
| `"live"` | Die E-Mails gehen an die Kunden. |

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

Die App **„E-Book-Versand“** (Client-ID `2989f2ac42fc81043bc3966a116cb719`,
Berechtigungen `read_orders`, `write_orders`) ist schon im Dev Dashboard der
Organisation Eveom™ angelegt:
https://dev.shopify.com/dashboard/114010597/apps/436981071873

Noch zu tun:

1. App im Shop installieren:
   https://admin.shopify.com/store/cd7d0a-1c/oauth/install?client_id=2989f2ac42fc81043bc3966a116cb719
2. Im Dev Dashboard bei der App den Zugriff auf **geschützte Kundendaten**
   (Name, E-Mail, Adresse) freigeben – sonst darf die App keine Bestellungen lesen.
3. In den App-Einstellungen das **Client-Secret** kopieren (für Schritt C).

Hast du schon eine ältere Custom App mit Admin-API-Token (`shpat_…`), reicht
stattdessen das Secret `SHOPIFY_ACCESS_TOKEN` (gleiche Scopes nötig).

### B. E-Mail-Versand über Outlook (Microsoft 365 von GoDaddy)

`info@eveom.health` ist ein Microsoft-365-Postfach, das über GoDaddy läuft.
Die Mails gehen über `smtp.office365.com` (Port 587) direkt aus diesem Postfach
raus. Server, Port, Absender und Benutzer stehen schon in `config.json` – es
fehlt nur das Passwort.

1. Bei GoDaddy anmelden → **E-Mail & Office Dashboard** → bei
   `info@eveom.health` auf **Verwalten**.
2. Unter **Erweiterte Einstellungen** die **SMTP-Authentifizierung**
   einschalten (ohne das lehnt Microsoft den Versand ab).
3. Das Passwort von `info@eveom.health` brauchst du gleich als Secret
   `SMTP_PASS`. Ändert sich das Passwort später, das Secret mit ändern.

Hinweis: Microsoft schaltet SMTP mit Passwort ab Ende 2026 standardmäßig ab,
Admins können es aber wieder einschalten. Falls der Versand dann stoppt:
SMTP-Authentifizierung bei GoDaddy erneut prüfen – oder auf die Microsoft-
Graph-Variante wechseln (App-Registrierung mit `Mail.Send` und die Secrets
`MS_CLIENT_ID` / `MS_CLIENT_SECRET`; geht nur mit vollem Microsoft-Admin-Zugang,
den GoDaddy oft nicht gibt).

### C. GitHub-Secrets eintragen

https://github.com/brahimkhaleel818-prog/claude-projekt/settings/secrets/actions
→ **New repository secret** – nur diese zwei:

| Secret | Wert |
|---|---|
| `SHOPIFY_CLIENT_SECRET` | Client-Secret der App „E-Book-Versand“ (Dev Dashboard → App → Einstellungen) |
| `SMTP_PASS` | Passwort von `info@eveom.health` |

Optional: `MAIL_BCC` (deine Adresse, wenn du eine Kopie jeder Mail willst),
`MAIL_REPLY_TO`. Alles andere (Shop, Client-ID der App, Absender, Server) steht in `config.json`
und kann dort geändert werden.

Solange Secrets fehlen, schreibt der Lauf nur „Noch nicht eingerichtet …“ ins
Log und schlägt nicht fehl – du bekommst also keine Fehler-Mails.

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
SHOPIFY_CLIENT_SECRET=… npm run dry-run
```
