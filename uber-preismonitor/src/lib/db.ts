import { PrismaClient } from "@prisma/client";

/**
 * Bei Connection-Poolern im Transaktionsmodus (Neon "-pooler", Supabase
 * Port 6543, PgBouncer) braucht Prisma "pgbouncer=true" (keine Prepared
 * Statements). Wird automatisch ergänzt, falls es fehlt.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const url = raw.trim().replace(/^(["'])(.*)\1$/, "$2");
  try {
    const u = new URL(url);
    const pooled = u.hostname.includes("-pooler.") || u.port === "6543" || u.hostname.includes("pooler.supabase.com");
    if (pooled && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (pooled && !u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
    return u.toString();
  } catch {
    return url;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["warn", "error"], datasourceUrl: normalizeDatabaseUrl(process.env.DATABASE_URL) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
