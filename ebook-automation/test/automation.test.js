import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickLanguage } from '../src/language.js';
import { renderTemplate } from '../src/template.js';
import { needsEbook, templateVars, loadConfig, resolveEnv, missingSecrets } from '../src/index.js';

const config = await loadConfig();
const EBOOK = config.triggerProductIds[0];

function order(overrides = {}) {
  return {
    id: 'gid://shopify/Order/1',
    name: '#1001',
    email: 'kunde@example.com',
    createdAt: '2030-01-01T10:00:00Z',
    cancelledAt: null,
    displayFinancialStatus: 'PAID',
    tags: [],
    billingAddress: { firstName: 'Anna', lastName: 'Muster', countryCodeV2: 'DE' },
    shippingAddress: { firstName: 'Anna', lastName: 'Muster', countryCodeV2: 'DE' },
    customer: null,
    lineItems: { nodes: [{ product: { id: EBOOK } }] },
    ...overrides,
  };
}

test('Sprache kommt aus dem Land der Rechnungsadresse', () => {
  for (const [country, language] of [['DE', 'de'], ['AT', 'de'], ['CH', 'de'], ['NL', 'nl'], ['BE', 'nl'], ['FR', 'fr'], ['US', 'en']]) {
    const o = order({ billingAddress: { countryCodeV2: country }, shippingAddress: null });
    assert.deepEqual(pickLanguage(o, config), { country, language });
  }
});

test('Fällt auf Lieferadresse und dann Standardsprache zurück', () => {
  assert.equal(pickLanguage(order({ billingAddress: null, shippingAddress: { countryCodeV2: 'FR' } }), config).language, 'fr');
  assert.equal(pickLanguage(order({ billingAddress: null, shippingAddress: null }), config).language, config.defaultLanguage);
  assert.equal(pickLanguage(order({ billingAddress: { countryCodeV2: 'JP' } }), config).language, config.defaultLanguage);
});

test('Nur bezahlte, nicht stornierte, noch nicht bediente Bestellungen mit E-Book', () => {
  assert.equal(needsEbook(order(), config), true);
  assert.equal(needsEbook(order({ displayFinancialStatus: 'PENDING' }), config), false);
  assert.equal(needsEbook(order({ cancelledAt: '2030-01-02T00:00:00Z' }), config), false);
  assert.equal(needsEbook(order({ tags: [config.sentTag] }), config), false);
  assert.equal(needsEbook(order({ tags: ['ebook-test'] }), { ...config, modus: 'test' }), false);
  assert.equal(needsEbook(order({ tags: ['ebook-test'] }), { ...config, modus: 'live' }), true);
  assert.equal(needsEbook(order({ createdAt: '2020-01-01T00:00:00Z' }), config), false);
  assert.equal(needsEbook(order({ lineItems: { nodes: [{ product: { id: 'gid://shopify/Product/9' } }, { product: null }] } }), config), false);
});

test('Jede Sprache hat eine Vorlage mit Betreff, Name und eigenem Download-Link', async () => {
  const o = order({ billingAddress: { firstName: 'Zoë <b>', countryCodeV2: 'DE' } });
  const links = new Set();
  for (const [language, settings] of Object.entries(config.languages)) {
    const mail = renderTemplate(await readFile(new URL(`../${settings.template}`, import.meta.url), 'utf8'), templateVars(o, config, language));
    assert.ok(mail.subject.includes('📖'), language);
    assert.ok(mail.html.includes('Zoë &lt;b&gt;'), language);
    assert.ok(mail.html.includes(`href="${settings.downloadUrl}"`), language);
    assert.ok(mail.html.includes(settings.ebookTitle), language);
    assert.ok(!/\{\{/.test(mail.html), `${language}: nicht ersetzter Platzhalter`);
    assert.ok(mail.text.includes('Zoë <b>'), language);
    links.add(settings.downloadUrl);
  }
  assert.equal(links.size, Object.keys(config.languages).length, 'jede Sprache braucht ein eigenes PDF');
  for (const language of Object.values(config.countryToLanguage)) {
    assert.ok(config.languages[language], `Sprache ${language} fehlt in "languages"`);
  }
});

test('Einstellungen aus config.json, Secrets überschreiben, fehlende Secrets werden gemeldet', () => {
  const env = resolveEnv({ SMTP_PASS: '', SMTP_HOST: 'smtp.example.com' }, config);
  assert.equal(env.SHOPIFY_CLIENT_ID, config.shopifyClientId);
  assert.equal(env.SHOPIFY_STORE, config.shopifyStore);
  assert.equal(env.SMTP_USER, config.mail.smtpUser);
  assert.equal(env.SMTP_HOST, 'smtp.example.com');
  assert.deepEqual(missingSecrets(env, false), ['SHOPIFY_CLIENT_SECRET', 'SMTP_PASS']);
  assert.deepEqual(missingSecrets(env, true), ['SHOPIFY_CLIENT_SECRET']);
  assert.deepEqual(missingSecrets({ ...env, SHOPIFY_CLIENT_SECRET: 's', MS_CLIENT_ID: 'm' }, false), ['MS_CLIENT_SECRET']);
  assert.deepEqual(missingSecrets({ ...env, SHOPIFY_CLIENT_SECRET: 's', SMTP_PASS: 'p' }, false), []);
});
