# DATEV-Kontenrahmen SKR03 & SKR04 als JSON

Maschinenlesbare Kontenrahmen für die automatisierte Buchhaltung/Steuererklärung.
Automatisch aus den offiziellen DATEV-PDFs extrahiert (gültig für **2026**, Stand 2026-01-01).

## Dateien

| Datei | Inhalt | Konten |
|-------|--------|--------|
| [`../skr03.json`](../skr03.json) | SKR03 – Prozessgliederungsprinzip (Art.-Nr. 11174) | 1.517 |
| [`../skr04.json`](../skr04.json) | SKR04 – Abschlussgliederungsprinzip (Art.-Nr. 11175) | 1.594 |
| `skr_pdf_to_json.py` | Parser, um die JSONs aus den PDFs neu zu erzeugen | – |

## Struktur

```jsonc
{
  "kontenrahmen": "SKR03",
  "bezeichnung": "DATEV-Standardkontenrahmen SKR03 (Prozessgliederungsprinzip)",
  "version": "2026",
  "stand": "2026-01-01",
  "quelle": "DATEV eG, Art.-Nr. 11174",
  "anzahl_konten": 1517,
  "kontenklassen": { "0": "Anlage- und Kapitalkonten", ... },
  "typ_je_kontenklasse": { "0": "gemischt", ... },
  "konten": [
    {
      "nummer": "1200",
      "bezeichnung": "Bank",
      "kontenklasse": "1",
      "kontenklasse_bezeichnung": "Finanz- und Privatkonten",
      "kontengruppe": "12",
      "kategorie": "Kreditinstituten und Schecks",
      "typ": "gemischt"
    }
  ]
}
```

### Felder pro Konto

| Feld | Quelle | Hinweis |
|------|--------|---------|
| `nummer` | PDF | 4-stellige Kontonummer |
| `bezeichnung` | PDF | offizieller Kontoname |
| `kontenklasse` | abgeleitet | 1. Ziffer (0–9) |
| `kontenklasse_bezeichnung` | abgeleitet | Name der Kontenklasse |
| `kontengruppe` | abgeleitet | erste 2 Ziffern |
| `kategorie` | PDF (näherungsweise) | Bilanz-/Gliederungsposten-Überschrift |
| `typ` | abgeleitet | `Aktiv` / `Passiv` / `Aufwand` / `Ertrag` / `Statistisch` / `gemischt` |

> **Wichtig für die Buchungslogik:** `nummer` und `bezeichnung` stammen direkt aus dem
> DATEV-PDF und sind verlässlich. `typ` und `kontenklasse_bezeichnung` sind aus der
> Kontenklasse abgeleitet – bei SKR03 (prozessorientiert) enthalten einige Klassen sowohl
> Aktiv- als auch Passivkonten, daher `gemischt`. Vor produktivem Einsatz verifizieren.

## Bekannte Einschränkung

Jeweils wenige Konten (SKR03: 1778, 4222, 8310, 9908 · SKR04: 1218, 2910, 4184, 4646,
5925, 5985) enden mit `-`: ihre Bezeichnung bricht am PDF-Seitenende um und der letzte
Wortteil ließ sich nicht zuverlässig zuordnen. Der Name bleibt erkennbar
(z. B. „Umsatzsteuer aus im Inland steuer-“). Bei Bedarf manuell ergänzen.

## Neu erzeugen (z. B. für einen neuen DATEV-Jahrgang)

```bash
pip install pdfplumber
python3 kontenrahmen/skr_pdf_to_json.py skr03.pdf SKR03 skr03.json
python3 kontenrahmen/skr_pdf_to_json.py skr04.pdf SKR04 skr04.json
```
