# Testbericht – 04.11.2026

## Automatisierte Tests (`npm test`): 39/39 bestanden
- **Uber Guest Rides Parser:** Antwortstruktur aus der Uber-Doku. Upfront-Festpreis (`fare.value`), Preisspanne (`estimate.low/high`), Stundenpakete ausgefiltert, `fares_unavailable` ergibt keine Werte.
- **Uber Guest Rides HTTP (gemockt):** Token per `client_credentials` mit Scope `guests.trips`, Token wird wiederverwendet, korrekter Request-Body und Header (`x-uber-organizationuuid`), einmalige Token-Erneuerung bei 401, 403 wird nicht wiederholt und mit verständlicher Meldung ausgegeben, 429 wird wiederholt und `Retry-After` beachtet.
- **Uber Riders v1.2:** Preisspanne und Surge-Faktor, Taxameter ohne Preis bleibt leer, Server-Token-Header.
- **Zeitzone Europe/Berlin:** Winter- und Sommerzeit, Zeitumstellung März/Oktober, Zeiträume Heute/Gestern/7 Tage/benutzerdefiniert.
- **Preisalarme:** Anstieg, Rückgang, Über-/Unterschreiten (nur beim Überschreiten, nicht dauerhaft), Tageshoch, Filter nach Strecke und Kategorie.
- **Statistik, Scheduler, Retry, Rate-Limiter, CSV-Export** (Escaping, Schutz vor Formel-Injection).

## Gegen die echten Uber-Server (ohne gültige Zugangsdaten)
| Aufruf | Antwort | Verhalten der App |
|---|---|---|
| `auth.uber.com/oauth/v2/token` | `401 invalid_client` | Meldung „Zugangsdaten ungültig“, Abfrage wird nicht endlos wiederholt |
| `api.uber.com/v1/guests/trips/estimates` | `401` | dito |
| `api.uber.com/v1.2/estimates/price` | `401 Invalid OAuth 2.0 credentials` | dito |

**Noch nicht getestet:** eine erfolgreiche Preisabfrage mit freigeschalteten Zugangsdaten. Das ist erst möglich, wenn Uber den Zugang erteilt hat. Danach mit `npm run probe:uber` prüfen.

## End-to-End (lokal, PostgreSQL 16, Demo-Quelle)
- Login: falsches Passwort wird abgewiesen, richtiges akzeptiert. Ohne Login liefern Seiten eine Weiterleitung auf /login und die API 401.
- Worker: fragt fällige Strecken ab, speichert Messwerte mit `isDemo=true`, schreibt den Heartbeat und plant den nächsten Lauf. Neue Strecken werden sofort abgefragt.
- Strecke anlegen, ungültiges Intervall (7 Min.) wird abgelehnt, Gegenrichtung anlegen. Ein zweiter Klick liefert dieselbe Gegenrichtung und keine Kopie.
- Manuelle Erfassung ist im Demo-Modus gesperrt, damit echte und simulierte Daten nicht vermischt werden.
- Export: CSV (Semikolon/Dezimalkomma, BOM) und Excel (.xlsx), Datei geprüft.
- Adresssuche (Nominatim): „Königsallee 60 Düsseldorf“ liefert Treffer mit Koordinaten.
- Charts: Fehlgeschlagene Abfragen erscheinen als Lücke im Verlauf; es wird kein Wert eingesetzt.
- Oberfläche per Playwright auf Desktop (1440 px) und iPhone 13 geprüft, keine Konsolenfehler.

## Docker
- `docker build` erfolgreich. Container gegen PostgreSQL getestet: Migration, Seed, Web (`/api/health` ok, `/login` 200) und Worker inkl. sauberem Beenden bei `docker stop`.
- `docker compose up` konnte in der Testumgebung nicht vollständig laufen, weil Docker Hub die Downloads begrenzt hat (HTTP 429 beim Laden von `postgres:16-alpine`). Auf einem normalen Server tritt das nicht auf.

## Bekannte Grenzen
- Echte Preise erst nach Uber-Freigabe (siehe `UBER-API-ZUGANG.md`).
- Upfront-Preise der API können geringfügig von deinem persönlichen App-Preis abweichen (Uber One, Aktionen).
- Abhängigkeiten mit bekannten Hinweisen von `npm audit`: `exceljs` bringt ältere Pakete (`uuid`, `minimatch`) mit, und `prisma` 6 enthält `deepmerge-ts`. Beide Stellen werden von der App nicht mit fremden Eingaben angesprochen. Ein Update auf Prisma 7 ist möglich, erfordert aber eine Umstellung der Konfiguration.
