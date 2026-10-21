// Info-Mails an ausgewählte Bestellungen, frei formuliert pro Auftrag (keine
// feste Vorlage). Ein Auftrag ist eine Datei auftraege/<name>.json:
//
//   {
//     "bestellungen": "#213700-#213720, #213739",
//     "modus": "senden",                      // vorschau | test | senden
//     "mails": {
//       "de": { "betreff": "…", "text": "Absatz 1\n\nAbsatz 2 mit {{Bestellnummer}}",
//               "button": { "text": "Jetzt bezahlen" },     // optional, Link: {{Zahlungslink}}
//               "schluss": "Text unter dem Button",         // optional
//               "anrede": "Beste {{Vorname}},", "gruss": "Met vriendelijke groet,",
//               "absenderin": "Sophie van Dijk" },           // optional, sonst Standard
//       "nl": { … }, "fr": { … }, "en": { … }
//     }
//   }
//
// Platzhalter: {{Vorname}}, {{Bestellnummer}}, {{Betrag}} (offen), {{Zahlungslink}}.
// Jeder Kunde bekommt den Text in der Sprache seines Landes, im Eveom-Design mit
// Anrede und Unterschrift. Versendet wird parallel, aber nicht schneller als
// Microsoft erlaubt (30 Mails/Minute). Jede bediente Bestellung bekommt den Tag
// info-<name> und wird bei diesem Auftrag nie zweimal angeschrieben.
//
// Aufruf:  node src/info.js auftraege/<name>.json [--modus vorschau|test|senden]

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, templateVars, loadConfig } from './index.js';
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

export function infoTag(name) {
  return `info-${name}`;
}

const GREETING = {
  de: ['Hallo {{Vorname}},', 'Guten Tag,'],
  nl: ['Hallo {{Vorname}},', 'Beste klant,'],
  fr: ['Bonjour {{Vorname}},', 'Bonjour,'],
  en: ['Hello {{Vorname}},', 'Hello,'],
};
const LOCALE = { de: 'de-DE', nl: 'nl-NL', fr: 'fr-FR', en: 'en-IE' };

// Zusätzliche Platzhalter für Info-Mails: {{Betrag}} (offener Betrag) und {{Zahlungslink}}.
export function infoVars(order, language) {
  const money = order.totalOutstandingSet?.shopMoney;
  const betrag = money
    ? new Intl.NumberFormat(LOCALE[language] || 'en-IE', { style: 'currency', currency: money.currencyCode }).format(Number(money.amount))
    : '';
  return { Betrag: betrag, Zahlungslink: order.paymentCollectionDetails?.additionalPaymentCollectionUrl || '' };
}

const CLOSING = { de: 'Herzliche Grüße', nl: 'Hartelijke groet,', fr: 'Bien cordialement,', en: 'Warm regards,' };

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Baut aus Betreff + Freitext eine Mail im Eveom-Design (wie die E-Book-Mail).
function toParagraphs(text) {
  return String(text || '')
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `            <p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function buildInfoHtml(language, { betreff, text, button, schluss, anrede, gruss, absenderin }, { withName = true } = {}) {
  const [defaultNamed, unnamed] = GREETING[language] || GREETING.en;
  const named = anrede ? escapeHtml(anrede) : defaultNamed;
  const paragraphs = toParagraphs(text);
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(betreff)}</title>
</head>
<body style="margin:0;padding:0;background:#7D000D;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#7D000D" style="background:#7D000D;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:Helvetica,Arial,sans-serif;color:#2b2b2b;">
        <tr>
          <td style="padding:28px 32px 4px;font-size:22px;font-weight:bold;letter-spacing:3px;">EVEOM</td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px;font-size:16px;line-height:1.6;">
            <p>${withName ? named : unnamed}</p>
${paragraphs}
${button ? `            <p style="margin:24px 0;text-align:center;">
              <a href="${escapeHtml(button.link || '{{Zahlungslink}}')}" style="display:inline-block;background:#7D000D;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;">${escapeHtml(button.text)}</a>
            </p>` : ''}
${toParagraphs(schluss)}
            <p>${gruss ? escapeHtml(gruss) : CLOSING[language] || CLOSING.en}</p>
            <p>${absenderin ? escapeHtml(absenderin) : '{{Absenderin}}'}<br>Team Eveom™</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

export async function loadAuftrag(file, config) {
  const name = path.basename(file).replace(/\.json$/, '');
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Auftragsname "${name}" bitte nur mit a-z, 0-9 und -`);
  if (infoTag(name).length > 40) throw new Error(`Auftragsname "${name}" ist zu lang (Shopify-Tags max. 40 Zeichen)`);
  const auftrag = JSON.parse(await readFile(path.resolve(ROOT, file), 'utf8'));
  const missing = Object.keys(config.languages).filter((l) => !auftrag.mails?.[l]?.betreff || !auftrag.mails?.[l]?.text);
  if (missing.length) throw new Error(`Im Auftrag fehlt Betreff oder Text für: ${missing.join(', ')}`);
  if (!auftrag.bestellungen) throw new Error('Im Auftrag fehlen die Bestellungen');
  return { name, ...auftrag };
}

export function needsInfoMail(order, name) {
  if (order.cancelledAt) return { ok: false, reason: 'storniert' };
  if (!order.email) return { ok: false, reason: 'keine E-Mail-Adresse' };
  if (order.tags.includes(infoTag(name))) return { ok: false, reason: 'hat diese Info schon bekommen' };
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

export async function sendInfoMails(file, { modus: modusOverride } = {}, processEnv = process.env) {
  const auftrag = await loadAuftrag(file, await loadConfig());
  const modus = modusOverride || auftrag.modus || 'vorschau';
  if (!['vorschau', 'test', 'senden'].includes(modus)) throw new Error(`Unbekannter Modus "${modus}"`);
  const selection = parseSelection(auftrag.bestellungen);
  console.log(`Auftrag "${auftrag.name}" – Modus: ${modus}`);

  // Der E-Book-Modus (aus/test/live) gilt hier nicht – Info-Mails steuert der Auftrag.
  const ctx = await setup(processEnv, { dryRun: modus === 'vorschau', ignoreModus: true });
  if (ctx.message) throw new Error(ctx.message);
  const { config, graphql, mailer } = ctx;

  const orders = await fetchOrdersBySelection(graphql, selection);
  const wanted = selection.numbers.length + (selection.ranges.length ? ' + Bereich(e)' : '');
  console.log(`${orders.length} Bestellungen gefunden (angefragt: ${wanted}).`);
  for (const n of selection.numbers) {
    if (!orders.some((o) => o.name === `#${n}`)) console.log(`  ! #${n} nicht gefunden (falsche Nummer oder älter als 60 Tage)`);
  }

  const jobs = [];
  for (const order of orders) {
    const check = needsInfoMail(order, auftrag.name);
    const { country, language } = pickLanguage(order, config);
    const label = `${order.name} (${country || 'Land unbekannt'} → ${language})`;
    if (!check.ok) {
      console.log(`  – ${label}: übersprungen, ${check.reason}`);
      continue;
    }
    const vars = { ...templateVars(order, config, language), ...infoVars(order, language) };
    const usesLink = JSON.stringify(auftrag.mails[language]).includes('Zahlungslink') || auftrag.mails[language].button;
    if (usesLink && !vars.Zahlungslink) {
      console.log(`  – ${label}: übersprungen, kein Zahlungslink (schon bezahlt?)`);
      continue;
    }
    const mail = renderTemplate(buildInfoHtml(language, auftrag.mails[language], { withName: Boolean(vars.Vorname) }), vars);
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
    await tagOrder(graphql, job.order.id, [infoTag(auftrag.name)]);
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
  const files = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--modus');
  (async () => {
    if (!files.length) throw new Error('Bitte Auftragsdatei angeben, z. B. auftraege/2026-10-21-zahlung.json');
    let failed = 0;
    for (const file of files) failed += (await sendInfoMails(file, { modus: arg('modus') })).failed;
    if (failed) process.exitCode = 1;
  })().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
