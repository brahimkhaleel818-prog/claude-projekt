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
