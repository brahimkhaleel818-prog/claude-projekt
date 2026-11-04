/** Session-Token (JWT, HS256) – funktioniert in Proxy (Edge/Node) und API-Routen. */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "upm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

function key() {
  const secret = (process.env.AUTH_SECRET || "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (secret.length < 32) throw new Error("AUTH_SECRET muss mindestens 32 Zeichen lang sein");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Konstantzeit-Vergleich für API-Token */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
