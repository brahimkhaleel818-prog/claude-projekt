/** Zentrale, typisierte Konfiguration aus Umgebungsvariablen. */
/** Liest eine Variable; entfernt umschließende Anführungszeichen (z. B. bei `docker run --env-file`). */
export function str(name: string, fallback = ""): string {
  let v = process.env[name];
  if (v === undefined) return fallback;
  v = v.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
  return v === "" ? fallback : v;
}
function int(name: string, fallback: number): number {
  const v = Number.parseInt(str(name), 10);
  return Number.isFinite(v) ? v : fallback;
}

export const env = {
  get databaseUrl() { return str("DATABASE_URL"); },
  get adminUsername() { return str("ADMIN_USERNAME", "admin"); },
  get adminPasswordHash() {
    const v = str("ADMIN_PASSWORD_HASH");
    return v.startsWith("b64:") ? Buffer.from(v.slice(4), "base64").toString("utf8") : v;
  },
  get authSecret() { return str("AUTH_SECRET"); },
  get cookieSecure() { return str("COOKIE_SECURE", "true") !== "false"; },
  get apiToken() { return str("API_TOKEN"); },

  get priceProvider() { return str("PRICE_PROVIDER", "none"); },
  get uberClientId() { return str("UBER_CLIENT_ID"); },
  get uberClientSecret() { return str("UBER_CLIENT_SECRET"); },
  get uberOrganizationUuid() { return str("UBER_ORGANIZATION_UUID"); },
  get uberScope() { return str("UBER_SCOPE", "guests.trips"); },
  get uberApiBase() { return str("UBER_API_BASE", "https://api.uber.com"); },
  get uberAuthUrl() { return str("UBER_AUTH_URL", "https://auth.uber.com/oauth/v2/token"); },
  get uberSandboxRunUuid() { return str("UBER_SANDBOX_RUN_UUID"); },
  get uberAcceptLanguage() { return str("UBER_ACCEPT_LANGUAGE", "de"); },
  get uberServerToken() { return str("UBER_SERVER_TOKEN"); },

  /** true = nur buchbare Festpreise speichern, Preisspannen verwerfen */
  get onlyUpfrontFares() { return str("ONLY_UPFRONT_FARES", "false") === "true"; },
  get providerMaxPerMinute() { return int("PROVIDER_MAX_REQUESTS_PER_MINUTE", 20); },
  get providerMaxPerHour() { return int("PROVIDER_MAX_REQUESTS_PER_HOUR", 600); },
  get providerMinIntervalMinutes() { return int("PROVIDER_MIN_INTERVAL_MINUTES", 1); },

  get workerPollSeconds() { return int("WORKER_POLL_SECONDS", 15); },
  get workerConcurrency() { return int("WORKER_CONCURRENCY", 2); },
  get workerMaxRetries() { return int("WORKER_MAX_RETRIES", 3); },
  get logLevel() { return str("LOG_LEVEL", "info"); },

  get nominatimUrl() { return str("NOMINATIM_URL", "https://nominatim.openstreetmap.org"); },
  get nominatimContact() { return str("NOMINATIM_CONTACT"); },

  get vapidPublicKey() { return str("VAPID_PUBLIC_KEY"); },
  get vapidPrivateKey() { return str("VAPID_PRIVATE_KEY"); },
  get vapidSubject() { return str("VAPID_SUBJECT", "mailto:admin@example.com"); },
  get telegramBotToken() { return str("TELEGRAM_BOT_TOKEN"); },
  get telegramChatId() { return str("TELEGRAM_CHAT_ID"); },
  get smtpHost() { return str("SMTP_HOST"); },
  get smtpPort() { return int("SMTP_PORT", 587); },
  get smtpUser() { return str("SMTP_USER"); },
  get smtpPassword() { return str("SMTP_PASSWORD"); },
  get smtpFrom() { return str("SMTP_FROM"); },
  get alertEmailTo() { return str("ALERT_EMAIL_TO"); },
  get appUrl() { return str("APP_URL", "http://localhost:3000"); },
};

export const SUPPORTED_INTERVALS = [1, 5, 10, 15, 30, 60] as const;
