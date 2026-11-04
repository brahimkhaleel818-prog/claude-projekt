import { HttpError, clientIp, handler, json, rateLimit } from "@/lib/api";
import { geocode } from "@/lib/geocode";

export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) throw new HttpError(400, "Mindestens 3 Zeichen eingeben");
  rateLimit(`geo:${clientIp(req)}`, 30, 60_000);
  return json({ results: await geocode(q) });
});
