import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const GET = handler(async () => json({ publicKey: env.vapidPublicKey || null }));

export const POST = handler(async (req: Request) => {
  const sub = await parseBody(req, schema);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string() }));
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return json({ ok: true });
});
