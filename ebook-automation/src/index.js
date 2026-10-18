// Verschickt für jede neue, bezahlte Shopify-Bestellung mit E-Book den
// Download-Link zum E-Book in der Sprache des Landes der Bestellung. Bereits
// bediente Bestellungen bekommen einen Tag und werden nie wieder angefasst.
//
// Aufruf:  node src/index.js            (verschickt wirklich)
//          DRY_RUN=1 node src/index.js  (zeigt nur an, was passieren würde)

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickLanguage } from './language.js';
import { renderTemplate } from './template.js';
import { getAccessToken, createClient, fetchCandidateOrders, tagOrder } from './shopify.js';
import { createMailer } from './mailer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED']);

export function needsEbook(order, config) {
  if (order.cancelledAt) return false;
  if (!SENDABLE_STATUSES.has(order.displayFinancialStatus)) return false;
  if (order.tags.includes(config.sentTag)) return false;
  if (new Date(order.createdAt) < new Date(config.sendOrdersCreatedAfter)) return false;
  if (!config.triggerProductIds.length) return true;
  return order.lineItems.nodes.some((item) => config.triggerProductIds.includes(item.product?.id));
}

export function templateVars(order, config, language) {
  const person = order.billingAddress || order.shippingAddress || order.customer || {};
  const settings = config.languages[language];
  return {
    Vorname: person.firstName || order.customer?.firstName || '',
    Nachname: person.lastName || order.customer?.lastName || '',
    Bestellnummer: order.name,
    'Download-Link': settings.downloadUrl,
    'E-Book-Titel': settings.ebookTitle,
    Shop: config.shopName,
  };
}

export function loadConfig() {
  return readFile(path.join(ROOT, 'config.json'), 'utf8').then(JSON.parse);
}

// Nicht geheime Einstellungen stehen in config.json, GitHub-Secrets überschreiben sie.
export function resolveEnv(env, config) {
  const defaults = {
    SHOPIFY_STORE: config.shopifyStore,
    MAIL_FROM: config.mail?.from,
    SMTP_HOST: config.mail?.smtpHost,
    SMTP_PORT: config.mail?.smtpPort && String(config.mail.smtpPort),
    SMTP_USER: config.mail?.smtpUser,
    MS_TENANT_ID: config.mail?.msTenantId,
  };
  const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value));
  return { ...defaults, ...set };
}

export function missingSecrets(env, dryRun) {
  const missing = [];
  if (!env.SHOPIFY_ACCESS_TOKEN) {
    for (const key of ['SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET']) if (!env[key]) missing.push(key);
  }
  if (!dryRun) {
    if (env.MS_CLIENT_ID) {
      if (!env.MS_CLIENT_SECRET) missing.push('MS_CLIENT_SECRET');
    } else if (!env.SMTP_PASS) {
      missing.push('SMTP_PASS');
    }
  }
  return missing;
}

async function main() {
  const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN).toLowerCase());
  const config = await loadConfig();
  const env = resolveEnv(process.env, config);

  // Solange die Zugangsdaten fehlen, nur Hinweis statt Fehler (sonst schickt
  // GitHub alle 10 Minuten eine Fehler-Mail).
  const missing = missingSecrets(env, dryRun);
  if (missing.length) {
    console.log(`Noch nicht eingerichtet – bitte diese GitHub-Secrets anlegen: ${missing.join(', ')}`);
    return;
  }

  const graphql = createClient(env.SHOPIFY_STORE, await getAccessToken(env));
  const mailer = dryRun ? null : createMailer(env);

  const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);
  const candidates = await fetchCandidateOrders(graphql, { since, sentTag: config.sentTag });
  const orders = candidates.filter((order) => needsEbook(order, config));
  console.log(`${candidates.length} neue Bestellungen geprüft, ${orders.length} brauchen ein E-Book${dryRun ? ' (Testlauf)' : ''}.`);

  let failures = 0;
  for (const order of orders) {
    const { country, language } = pickLanguage(order, config);
    const label = `${order.name} (${country || 'Land unbekannt'} → ${language})`;
    try {
      if (!order.email) throw new Error('Bestellung hat keine E-Mail-Adresse');
      const template = await readFile(path.join(ROOT, config.languages[language].template), 'utf8');
      const mail = renderTemplate(template, templateVars(order, config, language));

      if (dryRun) {
        console.log(`[Test] ${label}: würde "${mail.subject}" senden`);
        continue;
      }
      await mailer.send({ to: order.email, ...mail });
      await tagOrder(graphql, order.id, [config.sentTag, `ebook-${language}`]);
      console.log(`✓ ${label}: E-Book verschickt`);
    } catch (err) {
      failures++;
      console.error(`✗ ${label}: ${err.message}`);
    }
  }

  if (failures) {
    console.error(`${failures} Bestellung(en) fehlgeschlagen – werden beim nächsten Lauf erneut versucht.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
