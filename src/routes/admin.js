// Credo-ს პერიოდული სტატუსის შემოწმება (webhook არ არსებობს, ამიტომ poll-ით ვამოწმებთ).
// POST /admin/poll-credo — დაცულია POLL_SECRET-ით (header: X-Poll-Secret).
// გამოსადეგია გარე cron სერვისისთვის (cron-job.org, GitHub Actions scheduled workflow),
// თუ ჰოსტინგი უმოქმედობისას პროცესს აჩერებს და setInterval ვერ მუშაობს.

const express = require('express');
const credo = require('../lib/credo');
const shopify = require('../lib/shopify');
const store = require('../lib/store');
const config = require('../config');

const router = express.Router();

async function pollCredoOnce() {
  const pending = await store.listPendingCredo();
  const results = [];

  for (const p of pending) {
    try {
      const statusRes = await credo.getStatus(p.orderRef);

      if (statusRes.status !== 200) {
        // 300/400/404 -> მოთხოვნის/მოძებნის პრობლემა, არაა საბოლოო წარმატება/ჩავარდნა
        results.push({ orderRef: p.orderRef, note: statusRes });
        continue;
      }

      const statusId = statusRes.data;
      const statusName = credo.CREDO_STATUS_MAP[statusId] || `UNKNOWN(${statusId})`;

      if (credo.SUCCESS_STATUS_NAMES.includes(statusName)) {
        const draft = await shopify.completeDraftOrder(p.draftOrderId, { paymentPending: false });
        if (draft.order_id) {
          await shopify.addOrderTags(draft.order_id, ['credo-განვადება', 'გადახდილი']);
        }
        await store.saveOrder(p.orderRef, { status: 'paid', shopifyOrderId: draft.order_id });
        results.push({ orderRef: p.orderRef, statusName, action: 'completed' });
      } else if (credo.FAILURE_STATUS_NAMES.includes(statusName)) {
        await shopify.cancelDraftOrder(p.draftOrderId);
        await store.saveOrder(p.orderRef, { status: 'failed' });
        results.push({ orderRef: p.orderRef, statusName, action: 'cancelled' });
      } else {
        results.push({ orderRef: p.orderRef, statusName, action: 'still-pending' });
      }
    } catch (err) {
      results.push({ orderRef: p.orderRef, error: err.message });
    }
  }

  return results;
}

router.post('/admin/poll-credo', async (req, res) => {
  if (!config.pollSecret || req.header('X-Poll-Secret') !== config.pollSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const results = await pollCredoOnce();
  res.json({ results });
});

module.exports = { router, pollCredoOnce };
