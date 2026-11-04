import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError, clientIp, handler, json, parseBody, rateLimit } from "@/lib/api";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, safeEqual } from "@/lib/session";

const schema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });

export const POST = handler(async (req: Request) => {
  rateLimit(`login:${clientIp(req)}`, 8, 10 * 60_000);
  const { username, password } = await parseBody(req, schema);
  if (!env.adminPasswordHash) throw new HttpError(503, "ADMIN_PASSWORD_HASH ist nicht gesetzt (siehe README)");
  const okUser = safeEqual(username, env.adminUsername);
  const okPass = await bcrypt.compare(password, env.adminPasswordHash);
  if (!okUser || !okPass) {
    logger.warn({ ip: clientIp(req) }, "Fehlgeschlagener Login");
    throw new HttpError(401, "Benutzername oder Passwort falsch");
  }
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
