// Sofortversand: Shopify ruft diese Vercel-Funktion bei jeder bezahlten
// Bestellung auf (Webhook "orders/paid"). Der 10-Minuten-Lauf auf GitHub
// bleibt als Sicherheitsnetz – dank der Tags wird nie doppelt verschickt.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { setup, needsEbook, deliverEbook } from '../src/index.js';
import { fetchOrder } from '../src/shopify.js';

export function isValidShopifyHmac(rawBody, header, secret) {
  if (!header || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(header, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function handleOrder(orderId, env = process.env) {
  try {
    const ctx = await setup(env);
    if (ctx.message) {
      console.log(ctx.message);
      return;
    }
    const order = await fetchOrder(ctx.graphql, orderId);
    if (!order || !needsEbook(order, ctx.config)) {
      console.log(`${order?.name ?? orderId}: kein E-Book nötig`);
      return;
    }
    await deliverEbook(order, ctx);
  } catch (err) {
    console.error(`${orderId}: ${err.message}`);
  }
}

export async function POST(request) {
  const rawBody = await request.text();
  if (!isValidShopifyHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), process.env.SHOPIFY_CLIENT_SECRET)) {
    return new Response('Ungültige Signatur', { status: 401 });
  }
  const orderId = JSON.parse(rawBody).admin_graphql_api_id;
  // Shopify sofort antworten (sonst wiederholt es den Aufruf), danach versenden.
  waitUntil(handleOrder(orderId));
  return new Response('ok');
}
