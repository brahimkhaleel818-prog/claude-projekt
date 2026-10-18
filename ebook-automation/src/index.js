// Verschickt für jede neue, bezahlte Shopify-Bestellung mit E-Book das E-Book
// in der Sprache des Landes der Bestellung. Bereits bediente Bestellungen
// bekommen einen Tag und werden danach nie wieder angefasst.
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

export function templateVars(order, config) {
  const person = order.billingAddress || order.shippingAddress || order.customer || {};
  return {
    first_name: person.firstName || order.customer?.firstName || '',
    last_name: person.lastName || order.customer?.lastName || '',
    order_number: order.name,
    shop_name: config.shopName,
  };
}

export function loadConfig() {
  return readFile(path.join(ROOT, 'config.json'), 'utf8').then(JSON.parse);
}

function createEbookLoader(env) {
  const cache = new Map();
  return (language, settings) => {
    if (!cache.has(language)) {
      const url = env[`EBOOK_URL_${language.toUpperCase()}`];
      cache.set(language, url ? download(url) : readFile(path.join(ROOT, settings.ebookFile)));
    }
    return cache.get(language);
  };
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`E-Book-Download fehlgeschlagen (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(env = process.env) {
  const dryRun = ['1', 'true', 'yes'].includes(String(env.DRY_RUN).toLowerCase());
  const config = await loadConfig();
  if (!env.SHOPIFY_STORE) throw new Error('SHOPIFY_STORE fehlt (z. B. mein-shop.myshopify.com)');

  const graphql = createClient(env.SHOPIFY_STORE, await getAccessToken(env));
  const mailer = dryRun ? null : createMailer(env);
  const loadEbook = createEbookLoader(env);

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
      const settings = config.languages[language];
      const template = await readFile(path.join(ROOT, settings.template), 'utf8');
      const mail = renderTemplate(template, templateVars(order, config));
      const content = await loadEbook(language, settings);

      if (dryRun) {
        console.log(`[Test] ${label}: würde "${mail.subject}" mit ${settings.attachmentName} senden`);
        continue;
      }
      await mailer.send({ to: order.email, ...mail, attachment: { name: settings.attachmentName, content } });
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
