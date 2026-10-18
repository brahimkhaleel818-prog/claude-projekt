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
const TEST_TAG = 'ebook-test';

export function needsEbook(order, config) {
  if (order.cancelledAt) return false;
  if (!SENDABLE_STATUSES.has(order.displayFinancialStatus)) return false;
  if (order.tags.includes(config.sentTag)) return false;
  if (config.modus === 'test' && order.tags.includes(TEST_TAG)) return false;
  if (new Date(order.createdAt) < new Date(config.sendOrdersCreatedAfter)) return false;
  if (!config.triggerProductIds.length) return true;
  return order.lineItems.nodes.some((item) => config.triggerProductIds.includes(item.product?.id));
}

export function templateVars(order, config, language) {
  const person = order.billingAddress || order.shippingAddress || {};
  const settings = config.languages[language];
  return {
    Vorname: person.firstName || '',
    Nachname: person.lastName || '',
    Bestellnummer: order.name,
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
    SHOPIFY_CLIENT_ID: config.shopifyClientId,
    MAIL_FROM: config.mail?.from,
    SMTP_HOST: config.mail?.smtpHost,
    SMTP_PORT: config.mail?.smtpPort && String(config.mail.smtpPort),
    SMTP_USER: config.mail?.smtpUser,
    MS_TENANT_ID: config.mail?.msTenantId,
    MS_CLIENT_ID: config.mail?.msClientId,
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

// Liest Einstellungen und meldet sich bei Shopify an. Gibt { message } zurück,
// wenn (noch) nichts verschickt werden soll.
export async function setup(processEnv, { dryRun = false } = {}) {
  const config = await loadConfig();
  const env = resolveEnv(processEnv, config);

  // Solange die Zugangsdaten fehlen, nur Hinweis statt Fehler (sonst schickt
  // GitHub alle 10 Minuten eine Fehler-Mail).
  const missing = missingSecrets(env, dryRun);
  if (missing.length) return { message: `Noch nicht eingerichtet – bitte diese Secrets anlegen: ${missing.join(', ')}` };

  // modus "aus": nichts tun, "test": alles nur an testEmpfaenger, "live": an Kunden
  if (config.modus === 'aus') return { message: 'Versand ist ausgeschaltet (modus "aus" in config.json).' };
  const testMode = config.modus === 'test';
  if (testMode && !config.testEmpfaenger) throw new Error('modus "test" braucht "testEmpfaenger" in config.json');

  return {
    config,
    dryRun,
    testMode,
    graphql: createClient(env.SHOPIFY_STORE, await getAccessToken(env)),
    mailer: dryRun ? null : createMailer(env),
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
  };
}

// PDFs einmal pro Lauf laden. Die Adresse (Shopify-Dateien) sieht der Kunde nie.
const pdfCache = new Map();
function loadPdf(url) {
  if (!pdfCache.has(url)) {
    const pdf = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`E-Book-PDF konnte nicht geladen werden (HTTP ${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    });
    pdf.catch(() => pdfCache.delete(url));
    pdfCache.set(url, pdf);
  }
  return pdfCache.get(url);
}

// Verschickt das E-Book für eine Bestellung, die needsEbook() bestanden hat.
export async function deliverEbook(order, { config, graphql, mailer, dryRun, testMode }) {
  const { country, language } = pickLanguage(order, config);
  const label = `${order.name} (${country || 'Land unbekannt'} → ${language})`;
  try {
    if (!order.email) throw new Error('Bestellung hat keine E-Mail-Adresse');
    const settings = config.languages[language];
    const template = await readFile(path.join(ROOT, settings.template), 'utf8');
    const mail = renderTemplate(template, templateVars(order, config, language));
    mail.attachments = [{ filename: settings.attachmentName, content: await loadPdf(settings.pdfUrl) }];

    if (dryRun) {
      console.log(`[Test] ${label}: würde "${mail.subject}" mit ${settings.attachmentName} senden`);
      return true;
    }
    if (testMode) {
      // Jede Bestellung nur einmal als Test – der echte Versand ("live") folgt trotzdem.
      await mailer.send({ to: config.testEmpfaenger, ...mail, subject: `[TEST ${order.name}, ${country || '?'}] ${mail.subject}` });
      await tagOrder(graphql, order.id, [TEST_TAG]);
      console.log(`✓ ${label}: Test-Mail an Testempfänger verschickt (Kunde bekommt nichts)`);
      return true;
    }
    await mailer.send({ to: order.email, ...mail });
    await tagOrder(graphql, order.id, [config.sentTag, `ebook-${language}`]);
    console.log(`✓ ${label}: E-Book verschickt`);
    return true;
  } catch (err) {
    console.error(`✗ ${label}: ${err.message}`);
    return false;
  }
}

async function main() {
  const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN).toLowerCase());
  const ctx = await setup(process.env, { dryRun });
  if (ctx.message) {
    console.log(ctx.message);
    return;
  }

  const since = new Date(Date.now() - ctx.config.lookbackDays * 24 * 60 * 60 * 1000);
  const candidates = await fetchCandidateOrders(ctx.graphql, { since, sentTag: ctx.config.sentTag });
  const orders = candidates.filter((order) => needsEbook(order, ctx.config));
  console.log(`${candidates.length} neue Bestellungen geprüft, ${orders.length} brauchen ein E-Book${dryRun ? ' (Testlauf)' : ''}${ctx.testMode ? ' – TESTMODUS: Mails gehen nur an den Testempfänger' : ''}.`);

  let failures = 0;
  for (const order of orders) {
    if (!(await deliverEbook(order, ctx))) failures++;
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
