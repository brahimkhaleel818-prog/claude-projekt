// Zugriff auf die Shopify Admin GraphQL API.
//
// Zwei Anmeldearten werden unterstützt:
//  - SHOPIFY_ACCESS_TOKEN (shpat_...) – fester Token einer bestehenden Custom App
//  - SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET – App aus dem Shopify Dev Dashboard,
//    der Token wird bei jedem Lauf per "client credentials grant" neu geholt.

const API_VERSION = '2026-07';

export async function getAccessToken(env) {
  if (env.SHOPIFY_ACCESS_TOKEN) return env.SHOPIFY_ACCESS_TOKEN;
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
    throw new Error('SHOPIFY_ACCESS_TOKEN oder SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET fehlen');
  }
  const res = await fetch(`https://${env.SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify-Token konnte nicht geholt werden (HTTP ${res.status}): ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

export function createClient(store, token) {
  return async function graphql(query, variables = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      });
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Shopify API HTTP ${res.status}: ${await res.text()}`);
      const body = await res.json();
      const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (body.errors?.length) {
        throw new Error(`Shopify API Fehler: ${body.errors.map((e) => e.message).join('; ')}`);
      }
      return body.data;
    }
  };
}

const ORDERS_QUERY = `
  query EbookOrders($query: String!, $after: String) {
    orders(first: 100, after: $after, query: $query, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        email
        createdAt
        cancelledAt
        test
        displayFinancialStatus
        tags
        billingAddress { firstName lastName countryCodeV2 }
        shippingAddress { firstName lastName countryCodeV2 }
        customer { firstName lastName defaultAddress { countryCodeV2 } }
        lineItems(first: 50) { nodes { product { id } } }
      }
    }
  }
`;

export async function fetchCandidateOrders(graphql, { since, sentTag }) {
  const query = `created_at:>='${since.toISOString()}' -tag:'${sentTag}'`;
  const orders = [];
  let after = null;
  do {
    const data = await graphql(ORDERS_QUERY, { query, after });
    orders.push(...data.orders.nodes);
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);
  return orders;
}

const TAGS_ADD = `
  mutation TagOrder($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
  }
`;

export async function tagOrder(graphql, orderId, tags) {
  const data = await graphql(TAGS_ADD, { id: orderId, tags });
  const errors = data.tagsAdd.userErrors;
  if (errors.length) throw new Error(`Tag konnte nicht gesetzt werden: ${errors.map((e) => e.message).join('; ')}`);
}
