import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSelection, needsInfoMail, runPaced } from '../src/info.js';
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

test('Beispiel-Vorlage gibt es in allen Sprachen mit Betreff und Unterschrift', async () => {
  const config = await loadConfig();
  const order = { name: '#1001', billingAddress: { firstName: 'Anna', countryCodeV2: 'DE' } };
  for (const language of Object.keys(config.languages)) {
    const source = await readFile(new URL(`../info-mails/beispiel/${language}.html`, import.meta.url), 'utf8');
    const mail = renderTemplate(source, templateVars(order, config, language));
    assert.ok(mail.subject.includes('#1001'), language);
    assert.ok(!/\{\{/.test(mail.html), `${language}: nicht ersetzter Platzhalter`);
    assert.ok(mail.text.includes(`${config.languages[language].absenderin}\nTeam Eveom™`), language);
  }
});
