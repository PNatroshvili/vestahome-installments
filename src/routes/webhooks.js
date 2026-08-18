// BOG-ის callback (webhook) — POST /webhooks/bog
//
// ⚠️ Credo-ს ამ API ვერსიას webhook არ აქვს (დოკუმენტში მხოლოდ GET სტატუსის
// მოთხოვნაა), ამიტომ Credo-ს დადასტურება ხდება პერიოდული "poll"-ით
// (იხ. routes/admin.js და server.js-ში setInterval).

const express = require('express');
const bog = require('../lib/bog');
const shopify = require('../lib/shopify');
const store = require('../lib/store');

const router = express.Router();

// მნიშვნელოვანი: raw body გვჭირდება ხელმოწერის ვერიფიკაციისთვის — ამიტომ
// ეს route ცალკეა server.js-ში, express.json()-ის გვერდის ავლით.
router.post('/webhooks/bog', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signature = req.header('Callback-Signature');
    const rawBody = req.body; // Buffer

    if (!signature || !bog.verifyCallbackSignature(rawBody, signature)) {
      console.warn('[webhooks/bog] ხელმოწერა არასწორია — callback უარყოფილია');
      return res.status(401).send('invalid signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const body = payload.body || {};

    // ⚠️ BOG-ის დოკუმენტაცია ზუსტად არ აკონკრეტებს callback body-ს ყველა ველის
    // სახელს (ჩვენ ვიღებთ external_order_id-ს და ვცდით რამდენიმე შესაძლო
    // სტატუსის ველს). აუცილებლად გადაამოწმეთ რეალურ sandbox callback-ზე და
    // საჭიროებისამებრ დააკორექტირეთ ქვემოთ მონიშნული ადგილი.
    const externalOrderId = body.external_order_id || body.externalOrderId;
    const rawStatus =
      (body.order_status && (body.order_status.key || body.order_status.value)) ||
      body.status ||
      payload.event;

    if (!externalOrderId) {
      console.warn('[webhooks/bog] external_order_id ვერ მოიძებნა callback-ში', payload);
      return res.status(200).send('ok');
    }

    const order = await store.getOrder(externalOrderId);
    if (!order) {
      console.warn('[webhooks/bog] უცნობი orderRef:', externalOrderId);
      return res.status(200).send('ok');
    }

    const status = String(rawStatus || '').toLowerCase();

    if (['completed', 'success', 'succeeded', 'paid'].includes(status)) {
      const draft = await shopify.completeDraftOrder(order.draftOrderId, { paymentPending: false });
      if (draft.order_id) {
        await shopify.addOrderTags(draft.order_id, ['bog-განვადება', 'გადახდილი']);
      }
      await store.saveOrder(externalOrderId, { status: 'paid', shopifyOrderId: draft.order_id });
      console.log(`[webhooks/bog] ${externalOrderId} -> გადახდილია, Shopify order ${draft.order_id}`);
    } else if (['declined', 'failed', 'rejected', 'cancelled', 'canceled'].includes(status)) {
      await shopify.cancelDraftOrder(order.draftOrderId);
      await store.saveOrder(externalOrderId, { status: 'failed' });
      console.log(`[webhooks/bog] ${externalOrderId} -> ჩავარდა/გაუქმდა`);
    } else {
      await store.saveOrder(externalOrderId, { status: status || 'unknown' });
      console.log(`[webhooks/bog] ${externalOrderId} -> სტატუსი: ${status}`);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('[webhooks/bog] შეცდომა:', err);
    // მაინც 200-ს ვაბრუნებთ, რომ BOG-მა უსასრულოდ არ გაიმეოროს retry;
    // შეცდომა ლოგში რჩება შემდგომი შემოწმებისთვის.
    res.status(200).send('ok');
  }
});

module.exports = router;
