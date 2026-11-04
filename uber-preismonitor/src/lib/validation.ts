import { z } from "zod";
import { SUPPORTED_INTERVALS } from "./env";

export const routeInput = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(120),
  originAddress: z.string().trim().min(3).max(300),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destAddress: z.string().trim().min(3).max(300),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  active: z.boolean().default(true),
  intervalMinutes: z
    .number()
    .int()
    .refine((v) => (SUPPORTED_INTERVALS as readonly number[]).includes(v), "Intervall muss 1, 5, 10, 15, 30 oder 60 sein"),
  categories: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const routePatch = routeInput.partial();

export const alertInput = z.object({
  name: z.string().trim().min(1).max(120),
  routeId: z.string().nullable().optional(),
  categoryKey: z.string().nullable().optional(),
  type: z.enum(["PCT_INCREASE", "PCT_DECREASE", "ABOVE_AMOUNT", "BELOW_AMOUNT", "DAILY_HIGH", "DAILY_LOW"]),
  threshold: z.number().min(0).max(100000).default(0),
  channels: z.array(z.enum(["dashboard", "push", "telegram", "email"])).min(1).default(["dashboard"]),
  active: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(0).max(24 * 60).default(30),
});

export const manualInput = z.object({
  routeId: z.string().min(1),
  category: z.string().trim().min(1).max(40),
  price: z.number().positive().max(10000),
  observedAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(300).optional(),
});
