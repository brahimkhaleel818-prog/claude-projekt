# Hinweise für Claude

Dieses Repository enthält neben Websites die **Eveom-Mail-Automation** in
`ebook-automation/` (Details: `ebook-automation/README.md`).

## Info-Mails an Kunden verschicken
Ibrahim nennt Bestellnummern und was los ist. Ablauf:
1. Bestellungen per Shopify prüfen (Land, Zahlungsstatus, E-Mail vorhanden).
2. Mail-Text zeigen und **erst nach seinem OK** senden.
3. Auftrag `ebook-automation/auftraege/<datum>-<name>.json` anlegen und nach
   `main` pushen – der Workflow „Info-Mail senden“ verschickt automatisch.
   Ein Push in `auftraege/` verschickt sofort, also nie unbestätigt pushen.

Gespeicherte Vorlagen in `ebook-automation/vorlagen/`:
- `zahlungsinfo-ueberweisung` – wenn Ibrahim sagt, Bestellungen mit offener
  Zahlung / Banküberweisung sollen „die gespeicherte Mail“ bekommen:
  `{ "bestellungen": "#…", "modus": "senden", "vorlage": "zahlungsinfo-ueberweisung" }`

## E-Book-Sicherheitsnetz sofort starten
`ebook-automation/jetzt-pruefen.txt` ändern und nach `main` pushen.

## Glücks-Pop-up & Klaviyo-Willkommens-Mail
- Pop-up: `ebook-automation/klaviyo/popup/eveom-gluecks-popup.section.liquid` (Shopify-Section in der
  Footer-Gruppe). Theme-Änderungen nur in einer Theme-Kopie – Live-Theme/Publish ist für Claude gesperrt.
- Gewinne → Klaviyo-Profil `gluecks_preis` (10 / 15 / versand), Liste „E-Mail-Liste“ (XDbA9H),
  Flow „Eveom · Willkommen (Glücks-Pop-up)“ (W5z745), Mail-Vorlagen aus `klaviyo/live_willkommen.py`.
- Codes: Shopify-Rabatte „Eveom Glücks-Pop-up · 10 % / 15 % / Gratis Versand“ mit Einmal-Codes, dieselben
  Codes in Klaviyo-Coupons WILLKOMMEN10 / WILLKOMMEN15 / GRATISVERSAND. Bei Bedarf in beiden nachfüllen.
