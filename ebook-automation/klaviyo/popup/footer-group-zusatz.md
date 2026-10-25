# Einbau ins Theme

Die Section `sections/eveom-gluecks-popup.liquid` (= `eveom-gluecks-popup.section.liquid`) wird in
`sections/footer-group.json` eingetragen:

    "sections": { …, "eveom_gluecks_popup": { "type": "eveom-gluecks-popup", "settings": {} } },
    "order": [ "footer", "eveom_gluecks_popup" ]

Testen: Theme-Vorschau öffnen und `?eveom_popup=test` an die Adresse hängen (optional `&lang=de|nl|fr|en`).
Für Kunden einschalten: in der Section `var LIVE = false;` auf `true` setzen.
