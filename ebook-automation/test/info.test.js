import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSelection, needsInfoMail, runPaced, buildInfoHtml, infoVars } from '../src/info.js';
import { renderTemplate } from '../src/template.js';
import { loadConfig, templateVars } from '../src/index.js';

test('Bestellnummern: einzeln, Bereiche und gemischt', () => {
  assert.deepEqual(parseSelection('#213699'), { numbers: [213699], ranges: [] });
  assert.deepEqual(parseSelection('#213600-#213699, #213705 213710'), { numbers: [213705, 213710], ranges: [[213600, 213699]] });
  assert.deepEqual(parseSelection('213600 bis 213650; #213699 – #213680'), { numbers: [], ranges: [[213600, 213650], [213680, 213699]] });
  assert.throws(() => parseSelection('abc'), /nicht verstanden/);
  assert.throws(() => parseSelection('  '), /Keine Bestellnummern/);
});

test('Info-Mail nur an nicht stornierte Bestellungen mit E-Mail, nie doppelt', () => {
  const order = { cancelledAt: null, email: 'a@example.com', tags: [] };
  assert.equal(needsInfoMail(order, 'versand').ok, true);
  assert.equal(needsInfoMail({ ...order, cancelledAt: '2030-01-01' }, 'versand').ok, false);
  assert.equal(needsInfoMail({ ...order, email: null }, 'versand').ok, false);
  assert.equal(needsInfoMail({ ...order, tags: ['info-versand'] }, 'versand').ok, false);
  assert.equal(needsInfoMail({ ...order, tags: ['info-andere'] }, 'versand').ok, true);
});

test('Versand läuft parallel, aber gebremst, und Fehler stoppen die anderen nicht', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const started = Date.now();
  const results = await runPaced([1, 2, 3, 4, 5, 6], async (n) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 50));
    inFlight--;
    if (n === 3) throw new Error('kaputt');
    return n * 2;
  }, { perMinute: 6000, parallel: 3 });
  assert.equal(results.filter((r) => r.ok).length, 5);
  assert.equal(results[2].ok, false);
  assert.equal(results[5].value, 12);
  assert.ok(maxInFlight > 1 && maxInFlight <= 3, `parallel: ${maxInFlight}`);
  assert.ok(Date.now() - started >= 50, 'Abstand zwischen den Starts');
});

test('Freitext wird zur Mail im Eveom-Design mit Anrede und Unterschrift', async () => {
  const config = await loadConfig();
  const order = { name: '#1001', billingAddress: { firstName: 'Anna <b>', countryCodeV2: 'DE' } };
  const vars = templateVars(order, config, 'de');
  const html = buildInfoHtml('de', { betreff: 'Ihre Bestellung {{Bestellnummer}}', text: 'Erster Absatz.\n\nZweiter <Absatz>\nmit Umbruch.' });
  const mail = renderTemplate(html, vars);
  assert.equal(mail.subject, 'Ihre Bestellung #1001');
  assert.ok(mail.html.includes('Hallo Anna &lt;b&gt;,'));
  assert.ok(mail.html.includes('<p>Zweiter &lt;Absatz&gt;<br>mit Umbruch.</p>'));
  assert.ok(mail.html.includes('#7D000D'));
  assert.ok(mail.text.includes(`Herzliche Grüße\n\n${config.languages.de.absenderin}\nTeam Eveom™`));
  const noName = renderTemplate(buildInfoHtml('fr', { betreff: 'x', text: 'y' }, { withName: false }), vars);
  assert.ok(noName.text.startsWith('EVEOM\n\nBonjour,\n'));
});

test('Zahlungserinnerung: Betrag je Sprache formatiert, Button mit Zahlungslink', async () => {
  const config = await loadConfig();
  const order = { name: '#1001', billingAddress: { firstName: 'Sanne', countryCodeV2: 'NL' }, totalOutstandingSet: { shopMoney: { amount: '89.9', currencyCode: 'EUR' } }, paymentCollectionDetails: { additionalPaymentCollectionUrl: 'https://www.eveom.health/pay/1?secret=a&b=c' } };
  const vars = { ...templateVars(order, config, 'nl'), ...infoVars(order, 'nl') };
  assert.equal(vars.Betrag.replace(/\s/g, ' '), '€ 89,90');
  assert.equal(infoVars(order, 'de').Betrag.replace(/\s/g, ' '), '89,90 €');
  const mail = renderTemplate(buildInfoHtml('nl', { betreff: 'Betaling {{Bestellnummer}}', text: 'Openstaand: {{Betrag}}', button: { text: 'Nu betalen' } }), vars);
  assert.ok(mail.html.includes('href="https://www.eveom.health/pay/1?secret=a&amp;b=c"'));
  assert.ok(mail.html.includes('>Nu betalen</a>'));
  assert.ok(mail.text.includes('Openstaand: € 89,90') || mail.text.includes('Openstaand: €\u00a089,90'));
});

test('Anrede, Gruß und Absenderin lassen sich pro Auftrag festlegen', async () => {
  const config = await loadConfig();
  const vars = templateVars({ name: '#1', billingAddress: { firstName: 'Valentina', countryCodeV2: 'NL' } }, config, 'nl');
  const mail = renderTemplate(buildInfoHtml('nl', { betreff: 'x', text: 'y', anrede: 'Beste {{Vorname}},', gruss: 'Met vriendelijke groet,', absenderin: 'Sophie van Dijk' }), vars);
  assert.ok(mail.text.includes('Beste Valentina,'));
  assert.ok(mail.text.includes('Met vriendelijke groet,\n\nSophie van Dijk\nTeam Eveom™'));
  const noName = renderTemplate(buildInfoHtml('nl', { betreff: 'x', text: 'y', anrede: 'Beste {{Vorname}},' }, { withName: false }), vars);
  assert.ok(noName.text.includes('Beste klant,'));
});
