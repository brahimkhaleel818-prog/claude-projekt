import { handler, json, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { channelStatus } from "@/lib/notify";
import { alertInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const rules = await prisma.alertRule.findMany({ orderBy: { createdAt: "asc" }, include: { route: { select: { name: true } } } });
  return json({ rules, channels: channelStatus() });
});

export const POST = handler(async (req: Request) => {
  const data = await parseBody(req, alertInput);
  return json(await prisma.alertRule.create({ data }), 201);
});
