// Info-Mails an ausgewählte Bestellungen: Jeder Kunde bekommt die Vorlage
// info-mails/<vorlage>/<sprache>.html in der Sprache seines Landes. Versendet
// wird parallel, aber nicht schneller als Microsoft erlaubt (30 Mails/Minute).
// Jede bediente Bestellung bekommt den Tag info-<vorlage> und wird bei einem
// erneuten Lauf derselben Vorlage übersprungen.
//
// Aufruf:  node src/info.js --vorlage versandinfo --bestellungen "#213600-#213699, #213705"
//          --modus vorschau   zeigt nur an, wer welche Mail bekäme
//          --modus test       schickt je Sprache ein Beispiel an den Testempfänger
//          --modus senden     schickt an die Kunden

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, templateVars } from './index.js';
import { pickLanguage } from './language.js';
import { renderTemplate } from './template.js';
import { fetchOrdersBySelection, tagOrder } from './shopify.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAILS_PER_MINUTE = 28;
const PARALLEL = 5;

// "#213600-#213699, #213705 213710 bis 213720" → { numbers, ranges }
export function parseSelection(text) {
  const numbers = [];
  const ranges = [];
  const cleaned = String(text).replace(/\s*(?:-|–|bis|to)\s*/gi, '-');
  for (const token of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const range = token.match(/^#?(\d+)-#?(\d+)$/);
    const single = token.match(/^#?(\d+)$/);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      ranges.push([from, to]);
    } else if (single) {
      numbers.push(Number(single[1]));
    } else {
      throw new Error(`Bestellnummer nicht verstanden: "${token}"`);
    }
  }
  if (!numbers.length && !ranges.length) throw new Error('Keine Bestellnummern angegeben');
  return { numbers, ranges };
}

export function infoTag(vorlage) {
  return `info-${vorlage}`;
}

export function needsInfoMail(order, vorlage) {
  if (order.cancelledAt) return { ok: false, reason: 'storniert' };
  if (!order.email) return { ok: false, reason: 'keine E-Mail-Adresse' };
  if (order.tags.includes(infoTag(vorlage))) return { ok: false, reason: 'hat diese Info schon bekommen' };
  return { ok: true };
}

// Führt fn für alle Einträge aus: höchstens `parallel` gleichzeitig und
// höchstens `perMinute` Starts pro Minute.
export async function runPaced(items, fn, { perMinute = MAILS_PER_MINUTE, parallel = PARALLEL } = {}) {
  const gap = 60000 / perMinute;
  const results = [];
  const running = new Set();
  for (const [i, item] of items.entries()) {
    while (running.size >= parallel) await Promise.race(running);
    const task = Promise.resolve()
      .then(() => fn(item))
      .then((value) => (results[i] = { ok: true, value }), (error) => (results[i] = { ok: false, error }))
      .finally(() => running.delete(task));
    running.add(task);
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, gap));
  }
  await Promise.all(running);
  return results;
}

async function loadTemplates(vorlage, config) {
  const dir = path.join(ROOT, 'info-mails', vorlage);
  const templates = {};
  const missing = [];
  for (const language of Object.keys(config.languages)) {
    const file = path.join(dir, `${language}.html`);
    try {
      await access(file);
      templates[language] = await readFile(file, 'utf8');
    } catch {
      missing.push(`info-mails/${vorlage}/${language}.html`);
    }
  }
  if (missing.length) throw new Error(`Vorlage unvollständig, es fehlt: ${missing.join(', ')}`);
  return templates;
}

export async function sendInfoMails({ vorlage, bestellungen, modus = 'vorschau' }, processEnv = process.env) {
  if (!/^[a-z0-9-]+$/.test(vorlage || '')) throw new Error('Vorlage bitte als Ordnername angeben, z. B. "versandinfo"');
  if (!['vorschau', 'test', 'senden'].includes(modus)) throw new Error(`Unbekannter Modus "${modus}"`);
  const selection = parseSelection(bestellungen);

  // Der E-Book-Modus (aus/test/live) gilt hier nicht – Info-Mails steuert --modus.
  const ctx = await setup(processEnv, { dryRun: modus === 'vorschau', ignoreModus: true });
  if (ctx.message) throw new Error(ctx.message);
  const { config, graphql, mailer } = ctx;
  const templates = await loadTemplates(vorlage, config);

  const orders = await fetchOrdersBySelection(graphql, selection);
  const wanted = selection.numbers.length + (selection.ranges.length ? ' + Bereich(e)' : '');
  console.log(`${orders.length} Bestellungen gefunden (angefragt: ${wanted}).`);
  for (const n of selection.numbers) {
    if (!orders.some((o) => o.name === `#${n}`)) console.log(`  ! #${n} nicht gefunden (falsche Nummer oder älter als 60 Tage)`);
  }

  const jobs = [];
  for (const order of orders) {
    const check = needsInfoMail(order, vorlage);
    const { country, language } = pickLanguage(order, config);
    const label = `${order.name} (${country || 'Land unbekannt'} → ${language})`;
    if (!check.ok) {
      console.log(`  – ${label}: übersprungen, ${check.reason}`);
      continue;
    }
    const mail = renderTemplate(templates[language], templateVars(order, config, language));
    jobs.push({ order, language, label, mail });
  }

  if (modus === 'vorschau') {
    for (const job of jobs) console.log(`  [Vorschau] ${job.label}: "${job.mail.subject}"`);
    console.log(`${jobs.length} Mails würden verschickt.`);
    return { sent: 0, failed: 0, planned: jobs.length };
  }

  if (modus === 'test') {
    // Je Sprache ein Beispiel an den Testempfänger – keine Tags, Kunden bekommen nichts.
    const examples = [...new Map(jobs.map((job) => [job.language, job])).values()];
    for (const job of examples) {
      await mailer.send({ to: config.testEmpfaenger, ...job.mail });
      console.log(`  ✓ Beispiel ${job.language} (aus ${job.order.name}) an Testempfänger geschickt`);
    }
    return { sent: examples.length, failed: 0, planned: jobs.length };
  }

  const results = await runPaced(jobs, async (job) => {
    await mailer.send({ to: job.order.email, ...job.mail });
    await tagOrder(graphql, job.order.id, [infoTag(vorlage)]);
    console.log(`  ✓ ${job.label}: verschickt`);
  });
  let failed = 0;
  results.forEach((result, i) => {
    if (!result.ok) {
      failed++;
      console.error(`  ✗ ${jobs[i].label}: ${result.error.message}`);
    }
  });
  console.log(`${jobs.length - failed} verschickt, ${failed} fehlgeschlagen.`);
  return { sent: jobs.length - failed, failed, planned: jobs.length };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  sendInfoMails({
    vorlage: arg('vorlage') || process.env.VORLAGE,
    bestellungen: arg('bestellungen') || process.env.BESTELLUNGEN,
    modus: arg('modus') || process.env.MODUS || 'vorschau',
  })
    .then(({ failed }) => {
      if (failed) process.exitCode = 1;
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
