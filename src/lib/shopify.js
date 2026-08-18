// Shopify Admin API კლიენტი (vestahome.ge).
// საჭირო scope-ები Custom App-ზე: write_draft_orders, read_draft_orders,
// write_orders, read_orders.

const config = require('../config');

function adminUrl(pathname) {
  return `https://${config.shopify.domain}/admin/api/${config.shopify.apiVersion}${pathname}`;
}

async function shopifyFetch(pathname, options = {}) {
  const res = await fetch(adminUrl(pathname), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopify.token,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Shopify API შეცდომა ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

/** ქმნის Draft Order-ს კალათის შემადგენლობით (გადაუხდელი — ბანკის დადასტურებამდე). */
async function createDraftOrder({ lineItems, note, tags, email }) {
  const data = await shopifyFetch('/draft_orders.json', {
    method: 'POST',
    body: JSON.stringify({
      draft_order: {
        line_items: lineItems, // [{ variant_id, quantity }]
        note,
        tags,
        email,
        use_customer_default_address: true,
      },
    }),
  });
  return data.draft_order;
}

/** გარდაქმნის Draft Order-ს ნამდვილ შეკვეთად. payment_pending=true -> "გადახდის მოლოდინში". */
async function completeDraftOrder(draftOrderId, { paymentPending = false } = {}) {
  const data = await shopifyFetch(`/draft_orders/${draftOrderId}/complete.json?payment_pending=${paymentPending}`, {
    method: 'PUT',
  });
  return data.draft_order;
}

/** აღნიშნავს დასრულებულ შეკვეთას გადახდილად (sale ტრანზაქციის დამატებით). */
async function markOrderPaid(orderId, { amount, currency, gateway }) {
  const data = await shopifyFetch(`/orders/${orderId}/transactions.json`, {
    method: 'POST',
    body: JSON.stringify({
      transaction: { kind: 'sale', status: 'success', amount, currency, gateway },
    }),
  });
  return data.transaction;
}

/** უმატებს tag-ებს არსებულ შეკვეთას (არსებულის წაშლის გარეშე). */
async function addOrderTags(orderId, tagsToAdd) {
  const existing = await shopifyFetch(`/orders/${orderId}.json?fields=tags`);
  const currentTags = (existing.order && existing.order.tags) || '';
  const merged = Array.from(
    new Set(
      currentTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .concat(tagsToAdd)
    )
  ).join(', ');
  await shopifyFetch(`/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ order: { id: orderId, tags: merged } }),
  });
}

/** გაუქმებული/ჩავარდნილი ბანკის შეკვეთისას — draft order-ის წაშლა. */
async function cancelDraftOrder(draftOrderId) {
  await shopifyFetch(`/draft_orders/${draftOrderId}.json`, { method: 'DELETE' });
}

module.exports = {
  createDraftOrder,
  completeDraftOrder,
  markOrderPaid,
  addOrderTags,
  cancelDraftOrder,
};
