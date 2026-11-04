import { clientIp, handler, json, rateLimit } from "@/lib/api";
import { sendTestNotification } from "@/lib/notify";

export const POST = handler(async (req: Request) => {
  rateLimit(`test-notify:${clientIp(req)}`, 5, 60_000);
  return json({ results: await sendTestNotification() });
});
