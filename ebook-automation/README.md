# E-Book-Versand nach Land (Shopify → E-Mail)

Läuft komplett automatisch auf Vercel und GitHub Actions – ohne Claude, ohne
eigenen Server, ohne dass du irgendetwas bestätigen musst.

**Ablauf bei jeder Bestellung**

1. Sofort nach der Zahlung meldet Shopify die Bestellung an Vercel (siehe
   „Sofortversand“). Zusätzlich prüft GitHub alle 10 Minuten, ob etwas
   liegen geblieben ist.
2. Es nimmt nur Bestellungen, die **bezahlt**, **nicht storniert** und **noch
   nicht bedient** sind und das E-Book-Produkt enthalten
   („Het Astaxanthine Voordeel – E-book“).
3. Das Land kommt aus der Rechnungsadresse (sonst Lieferadresse) → daraus die Sprache.
4. Die E-Mail in der passenden Sprache geht raus – mit Vorname des Kunden und
   dem E-Book in seiner Sprache als **PDF-Anhang** (kein Link, nirgends steht
   Shopify).
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
| `"test"` | Jede E-Mail geht **nur an `testEmpfaenger`** (z. B. deine Gmail-Adresse) – genau so, wie der Kunde sie bekäme. Kunden bekommen nichts. Die Bestellung bekommt den Tag `ebook-test`, damit jede nur einmal getestet wird. |
| `"live"` (aktuell) | Die E-Mails gehen an die Kunden. |

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

- Die PDFs liegen in Shopify unter **Inhalte → Dateien**. Die Automation lädt
  sie beim Versand selbst (`pdfUrl` in `config.json`) und hängt sie unter dem
  Namen `attachmentName` an – der Kunde sieht diese Adresse nie. Neues PDF? In
  Shopify hochladen, Link kopieren und `pdfUrl` ersetzen. **Wichtig: unter 3 MB
  halten** (die aktuellen Mail-Versionen `…_mail.pdf` haben ca. 1,3 MB) – größere
  Anhänge bräuchten in Microsoft zusätzlich die Berechtigung `Mail.ReadWrite`.
- Die E-Mail-Texte stehen in `templates/de.html`, `nl.html`, `fr.html`, `en.html`.
  Der **Betreff** steht im `<title>…</title>`.
- Platzhalter: `{{Vorname}}`, `{{Nachname}}`, `{{Bestellnummer}}`,
  `{{E-Book-Titel}}`, `{{Absenderin}}`, `{{Shop}}`.
- Unterschrift: `absenderin` je Sprache in `config.json` (Lena Hoffmann,
  Lotte de Vries, Chloé Martin, Emily Carter), darunter „Team Eveom™“.
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

### B. E-Mail-Versand über Outlook (Microsoft 365)

Weil für `info@eveom.health` die Zwei-Faktor-Anmeldung aktiv ist, wird nicht
über SMTP mit Passwort verschickt, sondern über die Microsoft Graph API:

- App-Registrierung **„Eveom E-Book-Versand“** in Microsoft Entra
  (Anwendungs-ID `48203263-eece-4c74-8134-cfb7829c1ba9`, steht in `config.json`)
- Berechtigung `Mail.Send` (Anwendung) mit Administratorzustimmung
- Geheimer Clientschlüssel „Vercel“ (gültig bis 18.10.2028) liegt bei Vercel
  als `MS_CLIENT_SECRET`. **Vor Ablauf** in Entra → App-Registrierungen →
  „Eveom E-Book-Versand“ → Zertifikate & Geheimnisse einen neuen erstellen und
  bei Vercel und GitHub ersetzen.
- Die Mails erscheinen in info@ unter „Gesendete Elemente“.

Hinweis: `Mail.Send` erlaubt der App das Senden aus jedem Postfach der Firma.
Wer das auf `info@eveom.health` beschränken will, kann in Exchange Online eine
„Application Access Policy“ bzw. „RBAC for Applications“ einrichten.

### C. GitHub-Secrets eintragen

https://github.com/brahimkhaleel818-prog/claude-projekt/settings/secrets/actions
→ **New repository secret** – nur diese zwei:

| Secret | Wert |
|---|---|
| `SHOPIFY_CLIENT_SECRET` | Client-Secret der App „E-Book-Versand“ (Dev Dashboard → App → Einstellungen) |
| `MS_CLIENT_SECRET` | eigener geheimer Clientschlüssel „GitHub“ der Entra-App (siehe B) |

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

## Sofortversand (1–2 Minuten) über Vercel

Shopify meldet jede bezahlte Bestellung sofort (Webhook `orders/paid` der App
„E-Book-Versand“) an die Vercel-Funktion `api/shopify-order.js`:

- Projekt: **eveom-ebook-versand** im Vercel-Konto infoibrahimkh-5870
- Adresse: https://eveom-ebook-versand.vercel.app/api/shopify-order
- Die Funktion prüft die Shopify-Signatur, liest die Bestellung frisch aus
  Shopify und verschickt sofort – mit demselben Code wie der GitHub-Lauf.
- Umgebungsvariablen bei Vercel (Project → Settings → Environment Variables):
  `SHOPIFY_CLIENT_SECRET` und `MS_CLIENT_SECRET`. Nach einer Änderung neu deployen.
- Code-Änderungen (Vorlagen, `config.json`) kommen zu Vercel mit
  `vercel deploy --prod` aus dem Ordner `ebook-automation`.

Der 10-Minuten-Lauf auf GitHub bleibt als Sicherheitsnetz: Fällt Vercel einmal
aus, holt er die Bestellung nach. Dank der Tags wird nie doppelt verschickt.

## Info-Mails an ausgewählte Bestellungen

Für Infos zur Bestellung (z. B. Versand-Update, Anleitung): Du nennst die
Bestellnummern, jeder Kunde bekommt die Mail in der Sprache seines Landes –
im selben Eveom-Design, Unterschrift wie beim E-Book.

**Vorlage anlegen:** Ordner `info-mails/<name>/` mit `de.html`, `nl.html`,
`fr.html`, `en.html` (Vorbild: `info-mails/beispiel/`). Betreff steht im
`<title>`, Platzhalter wie beim E-Book (`{{Vorname}}`, `{{Bestellnummer}}`,
`{{Absenderin}}` …).

**Versand starten (ohne Claude):** GitHub → **Actions → „Info-Mail senden“ →
Run workflow**:

| Feld | Beispiel |
|---|---|
| Vorlage | `beispiel` |
| Bestellungen | `#213600-#213699, #213705` (einzeln, Bereiche oder gemischt, auch „213600 bis 213650“) |
| Modus | `vorschau` → nur anzeigen, wer welche Mail bekäme · `test` → je Sprache ein Beispiel an den Testempfänger · `senden` → an die Kunden |

- Immer erst `vorschau`, dann `test`, dann `senden`.
- Gesendet wird parallel, aber höchstens ~28 Mails pro Minute (Microsoft
  erlaubt pro Postfach 30/Minute und 10.000 Empfänger/Tag). 100 Mails ≈ 4 Minuten.
- Jede Bestellung bekommt den Tag `info-<name>` und wird bei derselben Vorlage
  nie zweimal angeschrieben. Stornierte Bestellungen werden übersprungen.
- Shopify gibt der App nur Bestellungen der letzten 60 Tage heraus.
- Nur für Infos zur Bestellung gedacht – Werbung/Newsletter brauchen laut
  DSGVO die Einwilligung des Kunden.

## Wichtig zu wissen

- Die PDF-Adressen in `config.json` sind öffentlich (öffentliches Repo) – wer
  sie dort findet, kann die PDFs laden. In den E-Mails tauchen sie nicht auf.
- **Logs sind öffentlich** (öffentliches Repo). Das Skript schreibt deshalb nur
  Bestellnummer, Land und Sprache ins Log – keine Namen oder E-Mail-Adressen.
- GitHub pausiert geplante Workflows in öffentlichen Repos nach **60 Tagen ohne
  Commit**. Du bekommst vorher eine Mail von GitHub; ein Klick auf „Enable
  workflow“ reicht. Der Sofortversand über Vercel ist davon nicht betroffen.
- Bestellungen ohne E-Mail-Adresse (Kunde hat nur mit Telefonnummer bestellt)
  bekommen den Tag `ebook-keine-email` und werden übersprungen. Trägst du
  später eine E-Mail nach: Tag entfernen, dann geht das E-Book beim nächsten
  Lauf raus (innerhalb von `lookbackDays`).
- Bestellung soll ein E-Book nochmal bekommen? Tag `ebook-versendet` in Shopify
  entfernen – beim nächsten Lauf geht es erneut raus (innerhalb von `lookbackDays`).

## Lokal ausführen

```bash
cd ebook-automation
npm ci
npm test                                   # Tests
SHOPIFY_CLIENT_SECRET=… npm run dry-run
```
