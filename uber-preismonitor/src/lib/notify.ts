import nodemailer from "nodemailer";
import webpush from "web-push";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";

export function channelStatus() {
  return {
    dashboard: true,
    push: Boolean(env.vapidPublicKey && env.vapidPrivateKey),
    telegram: Boolean(env.telegramBotToken && env.telegramChatId),
    email: Boolean(env.smtpHost && env.smtpFrom && env.alertEmailTo),
  };
}

async function sendPush(title: string, body: string, url: string): Promise<string> {
  if (!channelStatus().push) return "nicht konfiguriert";
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return "kein Gerät registriert";
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url }),
        { TTL: 3600 },
      );
      ok++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      logger.warn({ code, err: (err as Error).message }, "Push fehlgeschlagen");
    }
  }
  return `${ok}/${subs.length} zugestellt`;
}

async function sendTelegram(text: string): Promise<string> {
  if (!channelStatus().telegram) return "nicht konfiguriert";
  const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.telegramChatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
  return "ok";
}

async function sendEmail(subject: string, text: string): Promise<string> {
  if (!channelStatus().email) return "nicht konfiguriert";
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  });
  await transport.sendMail({ from: env.smtpFrom, to: env.alertEmailTo, subject, text });
  return "ok";
}

/** Verschickt eine (bereits im Dashboard gespeicherte) Benachrichtigung über weitere Kanäle. */
export async function deliver(
  notificationId: string,
  channels: string[],
  title: string,
  message: string,
): Promise<Record<string, string>> {
  const url = `${env.appUrl}/alarme`;
  const results: Record<string, string> = { dashboard: "ok" };
  const tasks: Array<[string, () => Promise<string>]> = [];
  if (channels.includes("push")) tasks.push(["push", () => sendPush(title, message, url)]);
  if (channels.includes("telegram")) tasks.push(["telegram", () => sendTelegram(`${title}\n${message}\n${url}`)]);
  if (channels.includes("email")) tasks.push(["email", () => sendEmail(`[Uber Alkhaled] ${title}`, `${message}\n\n${url}`)]);
  await Promise.all(
    tasks.map(async ([name, fn]) => {
      try {
        results[name] = await fn();
      } catch (err) {
        results[name] = `Fehler: ${(err as Error).message}`;
        logger.warn({ channel: name, err: (err as Error).message }, "Benachrichtigung fehlgeschlagen");
      }
    }),
  );
  await prisma.notification.update({ where: { id: notificationId }, data: { deliveries: results } }).catch(() => {});
  return results;
}

/** Testnachricht über alle konfigurierten Kanäle. */
export async function sendTestNotification() {
  const n = await prisma.notification.create({
    data: { title: "Testbenachrichtigung", message: "Wenn du das liest, funktioniert der Kanal.", level: "info" },
  });
  return deliver(n.id, ["push", "telegram", "email"], n.title, n.message);
}
