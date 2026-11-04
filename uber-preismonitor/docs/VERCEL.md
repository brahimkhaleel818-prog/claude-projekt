# Betrieb über GitHub + Vercel

Vercel hostet das Dashboard und die API und stellt kostenlos HTTPS unter `https://<projekt>.vercel.app` bereit. Eine eigene Domain ist nicht nötig, und Browser-Push funktioniert.

Was man vorher wissen muss:

| Thema | Details |
|---|---|
| **Kein Dauer-Worker** | Vercel führt keinen Prozess rund um die Uhr aus. Die Preisabfrage läuft deshalb über den Endpunkt `/api/cron/collect`, der jede Minute aufgerufen werden muss (siehe Schritt 6). |
| **Tarif** | Laut Vercel ist **Hobby (kostenlos) nur für private, nicht-kommerzielle Nutzung** erlaubt. Für ein Unternehmen ist **Pro** (ca. 20 $/Monat) vorgesehen. Vercel-Crons laufen im Hobby-Tarif höchstens 1× täglich, in Pro jede Minute. |
| **Datenbank** | Wird extern benötigt: **Supabase** (Free: 500 MB) oder **Neon** (Free: 0,5 GB, 100 Compute-Stunden pro Monat; das reicht bei Abfragen im Minutentakt **nicht** für den ganzen Monat, weil die Datenbank dann nie schläft). |
| **Speicherbedarf** | ca. 0,5 KB pro Messwert. Beispiel: 2 Strecken × 4 Kategorien × jede Minute ≈ 6 MB/Tag; bei alle 5 Minuten ≈ 1,2 MB/Tag. |

## Schritt für Schritt

### 1. Code auf GitHub
Der Code liegt bereits im Repository `claude-projekt`, Ordner `uber-preismonitor/`, Branch `claude/admiring-ride-mwi2i1`. Entweder den Branch per Pull Request nach `main` übernehmen oder in Vercel diesen Branch als Production-Branch einstellen (Schritt 5).

### 2. Datenbank anlegen (Supabase, kostenlos)
1. <https://supabase.com> → mit GitHub anmelden → **New project**, Region **Frankfurt (eu-central-1)**, Datenbank-Passwort notieren.
2. Im Projekt auf **Connect** klicken:
   - **Transaction pooler** (Port **6543**) kopieren → wird `DATABASE_URL`
   - **Session pooler** (Port **5432**) kopieren → wird `DIRECT_URL` (für Migrationen)
   - `[YOUR-PASSWORD]` jeweils durch dein Datenbank-Passwort ersetzen.

*(Alternative Neon: in Vercel unter **Storage → Neon** verbinden. Dann werden `DATABASE_URL` und `DATABASE_URL_UNPOOLED` automatisch gesetzt.)*

### 3. Vercel-Projekt anlegen
1. <https://vercel.com> → **Sign up with GitHub**.
2. **Add New → Project** → Repository `claude-projekt` importieren.
3. **Root Directory:** `uber-preismonitor` (wichtig!). Framework: Next.js (wird erkannt).

### 4. Umgebungsvariablen (vor dem ersten Deploy)
Unter **Environment Variables** eintragen:

| Name | Wert |
|---|---|
| `DATABASE_URL` | Transaction-Pooler-URL (Supabase) |
| `DIRECT_URL` | Session-Pooler-URL (Supabase) |
| `ADMIN_USERNAME` | z. B. `admin` |
| `ADMIN_PASSWORD` | dein Login-Passwort (mind. 12 Zeichen) – oder sicherer `ADMIN_PASSWORD_HASH` (siehe README) |
| `AUTH_SECRET` | zufällige Zeichenkette, mind. 32 Zeichen (z. B. aus einem Passwort-Generator) |
| `CRON_SECRET` | weitere zufällige Zeichenkette, mind. 16 Zeichen |
| `COOKIE_SECURE` | `true` |
| `PRICE_PROVIDER` | `none` (bis Uber freigibt), `demo` zum Ausprobieren, später `uber-guest-rides` |
| `APP_URL` | `https://<projekt>.vercel.app` |
| `NOMINATIM_CONTACT` | deine E-Mail-Adresse (Pflichtangabe für die Adresssuche) |
| optional | `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VAPID_*`, `SMTP_*` |

### 5. Deploy
**Deploy** klicken. Beim Build werden automatisch die Datenbanktabellen angelegt und die Strecken Hbf ⇄ DUS eingetragen (Skript `vercel-build`).
Falls du den Branch nicht nach `main` übernimmst: **Settings → Git → Production Branch** auf `claude/admiring-ride-mwi2i1` setzen und neu deployen.

### 6. Preisabfrage jede Minute starten
**Mit Vercel Pro:** Den Inhalt von `vercel.pro-cron.json` nach `vercel.json` kopieren und pushen. Vercel ruft den Endpunkt dann jede Minute auf und sendet `CRON_SECRET` automatisch mit.

**Ohne Pro (kostenlos): cron-job.org**
1. <https://cron-job.org> → kostenloses Konto → **Create cronjob**.
2. URL: `https://<projekt>.vercel.app/api/cron/collect`
3. Zeitplan: **jede Minute**.
4. **Advanced → Headers:** `Authorization` = `Bearer <dein CRON_SECRET>`
5. Speichern. Unter **Status** im Dashboard sollte „Worker: läuft“ erscheinen.

### 7. Testen
- `https://<projekt>.vercel.app` öffnen und anmelden.
- Unter **Status** prüfen: Datenquelle, „Worker läuft“, letzte Abfragen.

## Hinweise
- Jeder Cron-Aufruf fragt alle fälligen Strecken ab, höchstens 10 pro Aufruf, und hält die Rate-Limits über die Datenbank ein. Doppelte Aufrufe sind unschädlich, weil Strecken atomar reserviert werden.
- Logs: Vercel → Projekt → **Logs**.
- Funktionen laufen in der Region Frankfurt (`fra1`, siehe `vercel.json`).

## Aktuelle Einrichtung (04.11.2026)

| Teil | Einstellung |
|---|---|
| Vercel-Projekt | `uber-alkhaled` → <https://uber-alkhaled.vercel.app> (Region `fra1`, Node 22, Vercel-Login-Sperre aus, die App hat ein eigenes Login) |
| Code-Quelle | öffentliches GitHub-Repository `brahimkhaleel818-prog/claude-projekt`, Ordner `uber-preismonitor`. Das Projekt ist **nicht** mit Git verknüpft (anderes GitHub-Konto), Deployments werden gezielt pro Commit ausgelöst. |
| Datenbank | Supabase-Projekt `uber-alkhaled` (Frankfurt, Free). Eigener DB-Benutzer `uber_app` im Schema `uber`, das über die Supabase-Daten-API nicht erreichbar ist. |
| Minutentakt | Supabase `pg_cron` + `pg_net`: Job `uber-alkhaled-preisabfrage` ruft jede Minute `/api/cron/collect` mit dem `CRON_SECRET` auf. Job `uber-alkhaled-cron-log-aufraeumen` löscht täglich alte Cron-Protokolle. |
| Datenquelle | `PRICE_PROVIDER=demo` (simuliert), bis Uber die API freigibt |

Den Takt ändern oder pausieren (Supabase → SQL Editor):

```sql
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'uber-alkhaled-preisabfrage'), active := false);
```
