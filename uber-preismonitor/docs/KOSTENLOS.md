# Kostenlos betreiben

## Option 1 (empfohlen): Oracle Cloud „Always Free“
Oracle bietet einen dauerhaft kostenlosen Cloud-Server an (ARM, „Ampere A1“), auch in **Frankfurt**. Darauf läuft genau das fertige Docker-Setup, inklusive Worker rund um die Uhr. Ein separater Cron-Dienst ist nicht nötig. Die aktuellen Bedingungen stehen bei Oracle: <https://www.oracle.com/cloud/free/>

1. Konto anlegen und als Home-Region **Germany Central (Frankfurt)** wählen. Eine Kreditkarte wird nur zur Identitätsprüfung verlangt; „Always Free“-Ressourcen kosten nichts.
2. **Compute → Instances → Create Instance**
   - Image: **Ubuntu 24.04**, Shape: **Ampere (VM.Standard.A1.Flex)**, z. B. 2 OCPU / 8 GB RAM (innerhalb der Free-Grenzen)
   - SSH-Schlüssel herunterladen
   - Meldet Oracle „Out of capacity“, später erneut versuchen. Das kommt bei Free-Servern vor.
3. Per SSH verbinden und Docker installieren:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
   sudo usermod -aG docker $USER && newgrp docker
   ```
4. App einrichten, wie in [`DEPLOYMENT.md`](DEPLOYMENT.md) beschrieben (`git clone …`, `.env` füllen, `docker compose up -d --build`).
5. Zugriff ohne Domain: **Tailscale** (kostenlos) auf dem Server und dem Handy installieren, siehe [`DEPLOYMENT.md` → „Ohne eigene Domain“](DEPLOYMENT.md#ohne-eigene-domain).

## Option 2: eigener Rechner zu Hause
Ein alter PC, Laptop oder Mini-PC, der dauerhaft eingeschaltet bleibt. Docker installieren, dann wie oben vorgehen. Den Zugriff von unterwegs regelt Tailscale. Kosten: nur Strom.

## Option 3: Vercel Hobby + Supabase Free + cron-job.org
Funktioniert technisch (siehe [`VERCEL.md`](VERCEL.md)), aber **Vercel erlaubt im Hobby-Tarif nur private, nicht-kommerzielle Nutzung**. Für ein Unternehmen ist das nicht zulässig. Außerdem ist die kostenlose Datenbank (500 MB) bei Abfragen im Minutentakt nach einigen Monaten voll.

## Was in jedem Fall kostenlos bleibt
- Telegram-Benachrichtigungen
- Tailscale (privater Zugriff; der kostenlose Personal-Tarif reicht für dich und deine Geräte)
- die App selbst (eigener Code, keine Lizenzkosten, kein Claude-Abo nötig)
- die Uber-API: bisher in der Regel ohne Gebühren, verbindlich ist aber nur, was Uber bei der Freischaltung mitteilt
