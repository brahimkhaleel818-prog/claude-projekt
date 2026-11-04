#!/bin/sh
# Migrationen über die DIREKTE (nicht gepoolte) Verbindung ausführen.
# Neon (Vercel-Integration): DATABASE_URL_UNPOOLED · Supabase: DIRECT_URL
set -e
DIRECT="${DATABASE_URL_UNPOOLED:-${DIRECT_URL:-$DATABASE_URL}}"
if [ -z "$DIRECT" ]; then
  echo "FEHLER: DATABASE_URL ist nicht gesetzt – bitte in Vercel unter Settings → Environment Variables eintragen." >&2
  exit 1
fi
DATABASE_URL="$DIRECT" npx prisma migrate deploy
