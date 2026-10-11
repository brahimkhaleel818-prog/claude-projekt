# Agent-Check (Eveom / YLFulfilment)

Rechnet aus den Shopify-Bestellungen aus, was der China-Agent pro Bestellung
berechnen darf, in EUR und USD (Tageskurs), und vergleicht auf Wunsch mit
seiner Rechnung.

## Dateien
- `prices.json` – Einkaufspreise je Land und Staffel (1 / 3 / 5 Flaschen) plus Pillendoos. Hier Preise ändern, wenn der Agent neue schickt.
- `agent_check.py` – das Skript.

## Benutzung
```bash
# Zeitraum nach Bestelldatum, Excel-Bericht schreiben
python3 agent_check.py --from 2026-10-01 --to 2026-10-31 --xlsx oktober.xlsx

# Zeitraum nach Versanddatum (so rechnet der Agent meistens ab)
python3 agent_check.py --from 2026-10-01 --to 2026-10-31 --basis fulfilled

# Mit Rechnung des Agenten vergleichen
python3 agent_check.py --from 2026-10-01 --to 2026-10-31 --invoice 1234.56 --invoice-currency USD

# Nur bestimmte Bestellnummern
python3 agent_check.py --orders "#213039,#212999"
```

Für Live-Zugriff müssen zwei Umgebungsvariablen gesetzt sein
(Shopify Admin > Apps > App entwickeln > Admin-API-Token mit `read_orders`):
```bash
export SHOPIFY_SHOP=eveom.myshopify.com
export SHOPIFY_ACCESS_TOKEN=shpat_...
```
Alternativ gespeicherte GraphQL-Antworten mit `--input pages/*.json` einlesen.

## Regeln
- Gezählt werden nur physische Artikel: Astaxanthin-Flaschen und Pillendoos. E-Book, "Gratis Verzending" und Shipping Protection kosten nichts.
- Preis = Staffelpreis des Landes für die Flaschenanzahl + 1,20 EUR je Pillendoos.
- Stornierte Bestellungen kosten 0 und werden markiert.
- Flaschenanzahlen ohne Staffel (z. B. 2 oder 4) werden geschätzt und markiert.
- Länder ohne Preisliste, Mitochondrial-Bestellungen und unbekannte Artikel werden markiert.
- Umsatz unter 5 EUR wird als mögliche Testbestellung markiert.
