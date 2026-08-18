// POST /api/checkout/start — თემიდან (installment-widget.js) გამოძახებული endpoint.
// ქმნის Shopify Draft Order-ს + ბანკის (BOG ან Credo) შეკვეთას და აბრუნებს
// redirect ბმულს, სადაც ბრაუზერი გადაამისამართებს მომხმარებელს.

const express = require('express');
const crypto = require('crypto');

const bog = require('../lib/bog');
const credo = require('../lib/credo');
const shopify = require('../lib/shopify');
const store = require('../lib/store');

const router = express.Router();

function genRef(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

router.post('/checkout/start', async (req, res) => {
  try {
    const { bank, items, email, customer = {}, installmentMonths } = req.body || {};

    if (!bank || !['bog', 'credo'].includes(bank)) {
      return res.status(400).json({ error: 'bank უნდა იყოს "bog" ან "credo"' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items ცარიელია' });
    }
    for (const it of items) {
      if (!it.variantId || !it.quantity || !it.price) {
        return res.status(400).json({ error: 'items-ის ველები არასრულია (variantId/quantity/price)' });
      }
    }

    // 1) Draft Order Shopify-ში — ჯერ გადაუხდელი, ბანკის დადასტურებამდე
    const lineItems = items.map((it) => ({ variant_id: it.variantId, quantity: it.quantity }));
    const draftOrder = await shopify.createDraftOrder({
      lineItems,
      email,
      note: `განვადება: ${bank === 'bog' ? 'საქართველოს ბანკი' : 'კრედო ბანკი'}`,
      tags: `installment-pending,${bank}`,
    });

    const totalAmount = Number(draftOrder.total_price);
    const currency = draftOrder.currency;
    const orderRef = genRef(bank);

    await store.saveOrder(orderRef, {
      bank,
      status: 'pending',
      draftOrderId: draftOrder.id,
      totalAmount,
      currency,
    });

    // 2) ბანკის შეკვეთა
    if (bank === 'bog') {
      const basket = items.map((it) => ({
        product_id: String(it.productId || it.variantId),
        description: it.title || 'პროდუქტი',
        quantity: it.quantity,
        unit_price: it.price,
      }));

      const { bogOrderId, redirectUrl } = await bog.createOrder({
        externalOrderId: orderRef,
        totalAmount,
        currency,
        basket,
        buyerFullName: customer.fullName,
        installmentMonths,
      });

      await store.saveOrder(orderRef, { bogOrderId });
      return res.json({ redirectUrl, orderRef });
    }

    // bank === 'credo'
    const products = items.map((it) => ({
      id: String(it.productId || it.variantId),
      title: it.title || 'პროდუქტი',
      amount: String(it.quantity),
      price: String(Math.round(it.price * 100)), // ლარი -> თეთრი
      type: '0',
    }));

    const { redirectUrl } = await credo.createOrder({
      orderCode: orderRef,
      products,
      installmentLength: installmentMonths,
      clientFullName: customer.fullName,
      mobile: customer.mobile,
      email,
    });

    return res.json({ redirectUrl, orderRef });
  } catch (err) {
    console.error('[checkout/start]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
