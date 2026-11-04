# Installation & Deployment

## Variante A: Docker (empfohlen)

Voraussetzungen: ein Linux-Server (z. B. Ubuntu 24.04, 2 vCPU, 2–4 GB RAM) mit Docker und dem Docker-Compose-Plugin. Für HTTPS und Browser-Push brauchst du außerdem eine Domain, deren DNS-A-Eintrag auf den Server zeigt.

```bash
# 1. Code holen
git clone <REPO-URL> && cd claude-projekt/uber-preismonitor

# 2. Konfiguration anlegen
cp .env.example .env
```

In `.env` mindestens setzen:

```bash
# Passwort-Hash für den Login erzeugen (Node.js 22 nötig, alternativ im Container, siehe unten)
npm ci && npm run hash-password -- "DeinSicheresPasswort"
# Ausgabe (b64:…) als ADMIN_PASSWORD_HASH eintragen

openssl rand -base64 48   # Ergebnis als AUTH_SECRET eintragen
```

Ohne lokales Node.js:

```bash
docker compose build
docker compose run --rm --no-deps web npx tsx scripts/hash-password.ts "DeinSicheresPasswort"
```

```bash
# 3. Datenbank-Passwort festlegen (wird von docker-compose.yml verwendet)
echo 'POSTGRES_PASSWORD=ein-langes-zufaelliges-passwort' >> .env.compose

# 4. Starten
docker compose --env-file .env.compose up -d --build

# 5. Mit HTTPS (Let's Encrypt, Port 80/443 müssen frei sein)
DOMAIN=preise.deine-domain.de docker compose --env-file .env.compose --profile https up -d
```

Dann `APP_URL=https://preise.deine-domain.de` in `.env` setzen und `docker compose restart web worker` ausführen.

Was dabei startet:

| Dienst | Aufgabe |
|---|---|
| `db` | PostgreSQL 16, Daten im Volume `pgdata` |
| `migrate` | wendet beim Start die Datenbank-Migrationen an und legt die Startstrecken Hbf ⇄ DUS an |
| `web` | Dashboard und API auf Port 3000 (nur lokal gebunden, öffentlich über Caddy) |
| `worker` | Background-Worker: fragt Preise rund um die Uhr ab, auch bei geschlossenem Browser |
| `caddy` | optional, HTTPS-Reverse-Proxy |

Nützliche Befehle:

```bash
docker compose logs -f worker              # Live-Log der Preisabfragen
docker compose exec web npm run probe:uber # Uber-Zugang testen (speichert nichts)
docker compose restart worker              # nach Änderungen an .env
docker compose pull && docker compose up -d --build   # Update
```

**Backup** der Datenbank (z. B. täglich per Cron):

```bash
docker compose exec -T db pg_dump -U monitor uber_monitor | gzip > backup-$(date +%F).sql.gz
```

## Ohne eigene Domain

Eine Domain ist **nicht nötig**. Es gibt zwei Wege:

**1. Privat über Tailscale (empfohlen, kostenlos, verschlüsselt, nicht öffentlich)**

```bash
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up
```

Tailscale-App aufs Handy installieren und mit demselben Konto anmelden. Danach ist das Dashboard unter `http://<server-name>:3000` erreichbar, nur von deinen eigenen Geräten. Dafür in `.env.compose` `WEB_BIND=0.0.0.0` setzen und den Port 3000 in der Server-Firewall **nicht** öffentlich freigeben. Optional liefert `sudo tailscale serve --bg 3000` sogar HTTPS unter `https://<server-name>.<tailnet>.ts.net`, womit auch Browser-Push funktioniert.

**2. Direkt über die IP-Adresse**

`WEB_BIND=0.0.0.0` in `.env.compose` und `COOKIE_SECURE="false"` in `.env` setzen. Erreichbar ist die App dann unter `http://SERVER-IP:3000`. Ohne HTTPS wird das Login unverschlüsselt übertragen, deshalb ein langes Passwort verwenden. Browser-Push funktioniert ohne HTTPS nicht; **Telegram-Alarme funktionieren dagegen problemlos**.

Ein passender Server: Ein kleiner Cloud-Server in Deutschland (z. B. Hetzner Cloud, 2 vCPU / 4 GB RAM, ca. 4–6 €/Monat) reicht für Dutzende Strecken. Alternativ geht ein eigener, dauerhaft eingeschalteter PC oder Mini-PC.

## Variante B: ohne Docker (systemd)

```bash
sudo apt install -y postgresql nodejs npm   # Node.js 22 LTS verwenden (z. B. über NodeSource)
sudo -u postgres psql -c "CREATE USER monitor WITH PASSWORD '…';" -c "CREATE DATABASE uber_monitor OWNER monitor;"
sudo useradd -r -m -d /opt/uber-alkhaled uberpreis
# Code nach /opt/uber-alkhaled kopieren, .env anlegen (DATABASE_URL auf localhost)
cd /opt/uber-alkhaled && npm ci && npm run build && npm run db:migrate && npm run db:seed
sudo cp deploy/uber-alkhaled-*.service /etc/systemd/system/
sudo systemctl enable --now uber-alkhaled-web uber-alkhaled-worker
```

Für HTTPS einen Reverse-Proxy (Caddy oder nginx) vor Port 3000 schalten.

## Benachrichtigungen einrichten

- **Browser-Push:** Schlüssel mit `npm run vapid` erzeugen und `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` sowie `VAPID_SUBJECT` (z. B. `mailto:du@firma.de`) setzen. Danach unter **Alarme → „Push auf diesem Gerät aktivieren“** einschalten. Push funktioniert nur über HTTPS. Auf dem iPhone muss die Seite zuerst „Zum Home-Bildschirm“ hinzugefügt werden (iOS 16.4+).
- **Telegram:** Mit [@BotFather](https://t.me/BotFather) einen Bot anlegen und dann `TELEGRAM_BOT_TOKEN` setzen. Dem Bot eine Nachricht schicken und die Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates` ermitteln (`TELEGRAM_CHAT_ID`).
- **E-Mail:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` und `ALERT_EMAIL_TO` setzen.
- Danach unter **Alarme → „Test senden“** prüfen.

## Sicherheit

- Alle Seiten und API-Endpunkte sind geschützt: Login mit bcrypt-gehashtem Passwort, signiertes Session-Cookie (HttpOnly, SameSite, Secure). Der Login ist auf 8 Versuche pro 10 Minuten und IP begrenzt.
- Für Skripte gibt es optional `API_TOKEN` (`Authorization: Bearer …`).
- Zugangsdaten (Uber, SMTP, Telegram) stehen nur in `.env` und nie im Code. `.env` ist in `.gitignore` eingetragen.
- `COOKIE_SECURE="true"` beibehalten, sobald die App über HTTPS läuft.
- `/api/health` ist für Healthchecks öffentlich und gibt nur `{ok:true}` zurück.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| Banner „Keine Live-Datenquelle aktiv“ | `PRICE_PROVIDER` ist nicht gesetzt oder Uber-Zugangsdaten fehlen, siehe `docs/UBER-API-ZUGANG.md` |
| Status „Fehler“, HTTP 401 | Client ID/Secret falsch |
| Status „Fehler“, HTTP 403 | API für dein Konto/Scope nicht freigeschaltet, an Uber wenden |
| Status „keine Preise“ | Uber meldet `fares_unavailable` oder liefert nur Spannen bei `ONLY_UPFRONT_FARES=true` |
| Worker „offline“ | `docker compose logs worker` prüfen; der Worker sendet alle 30 s ein Lebenszeichen |
| Adresssuche „ausgelastet“ | OpenStreetMap/Nominatim begrenzt auf 1 Anfrage pro Sekunde, kurz warten. `NOMINATIM_CONTACT` setzen |
