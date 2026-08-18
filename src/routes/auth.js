// Shopify-ს OAuth "დამაკავშირებელი" — საჭირო გახდა, რადგან ახალ Dev Dashboard-ის
// "legacy install flow" ჩვენს შემთხვევაში მაინც სრულ OAuth-ს ითხოვს (App URL-ზე
// კოდით გადამისამართებას), და ამ კოდის მიმღები/გადამცვლელი სერვერი ჩვენვე უნდა
// გვქონდეს. ეს route ერთჯერადი გამოყენებისთვისაა: აკავშირებთ აპს vestahome-ზე და
// ერთხელ გაჩვენებთ მიღებულ Admin API access token-ს დასაკოპირებლად.
//
// გამოყენება ინსტალაციისთვის:
//   1) დარწმუნდით, რომ .env-ში შევსებულია SHOPIFY_API_KEY და SHOPIFY_API_SECRET
//      (Dev Dashboard-ის აპის Settings გვერდიდან — Client ID / Client Secret)
//   2) Dev Dashboard-ში, აპის ვერსიაში, "Allowed redirection URL(s)"-ში დაამატეთ:
//        https://<თქვენი-backend-URL>/auth/shopify/callback
//   3) ბრაუზერში გახსენით:
//        https://<თქვენი-backend-URL>/auth/shopify/install?shop=vestahome.myshopify.com
//   4) დაადასტურეთ Shopify-ს თანხმობის ეკრანზე -> callback გვერდზე გამოჩნდება token

const crypto = require('crypto');
const express = require('express');
const config = require('../config');

const router = express.Router();

const REQUIRED_SCOPES = 'write_draft_orders,read_draft_orders,write_orders,read_orders';

// state-ის დროებითი შენახვა მეხსიერებაში (საკმარისია ერთჯერადი, ხელით გამოყენებისთვის)
const pendingStates = new Set();

function isValidShopDomain(shop) {
  return typeof shop === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

router.get('/auth/shopify/install', (req, res) => {
  const shop = req.query.shop;
  if (!isValidShopDomain(shop)) {
    return res.status(400).send('არასწორი ან ცარიელი ?shop= პარამეტრი (მაგ. ?shop=vestahome.myshopify.com)');
  }
  if (!config.shopifyOAuth.apiKey) {
    return res.status(500).send('SHOPIFY_API_KEY არაა დაყენებული .env-ში');
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);

  const redirectUri = `${config.appBaseUrl}/auth/shopify/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(config.shopifyOAuth.apiKey)}` +
    `&scope=${encodeURIComponent(REQUIRED_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(installUrl);
});

router.get('/auth/shopify/callback', async (req, res) => {
  try {
    const { shop, hmac, code, state } = req.query;

    if (!isValidShopDomain(shop) || !hmac || !code || !state) {
      return res.status(400).send('არასრული callback მოთხოვნა.');
    }
    if (!pendingStates.has(state)) {
      return res.status(400).send('უცნობი ან ვადაგასული state — თავიდან დაიწყეთ /auth/shopify/install-იდან.');
    }
    pendingStates.delete(state);

    if (!verifyHmac(req.query)) {
      return res.status(401).send('HMAC ვერიფიკაცია ჩავარდა — მოთხოვნა შესაძლოა არ იყოს Shopify-სგან.');
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.shopifyOAuth.apiKey,
        client_secret: config.shopifyOAuth.apiSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[auth/shopify/callback] token exchange failed', tokenData);
      return res.status(500).send('Token-ის გაცვლა ჩავარდა: ' + JSON.stringify(tokenData));
    }

    // ერთჯერადი, მარტივი წარმატების გვერდი — token მხოლოდ ამ ჩატვირთვაზე ჩანს.
    res.send(`
      <html><body style="font-family: sans-serif; max-width: 640px; margin: 40px auto; line-height: 1.5;">
        <h2>✅ დაკავშირება წარმატებით დასრულდა</h2>
        <p><b>მაღაზია:</b> ${escapeHtml(shop)}</p>
        <p><b>Scope:</b> ${escapeHtml(tokenData.scope || '')}</p>
        <p>დააკოპირეთ ეს token და ჩასვით Render-ის Environment Variables-ში,
           ცვლადში <code>SHOPIFY_ADMIN_ACCESS_TOKEN</code>:</p>
        <pre style="background:#f4f4f4; padding:16px; border-radius:8px; word-break:break-all;">${escapeHtml(
          tokenData.access_token
        )}</pre>
        <p style="color:#b00;">⚠️ ეს გვერდი მეორედ აღარ გაჩვენებთ token-ს — თუ დაკარგეთ,
           საჭირო იქნება აპის ხელახლა დაინსტალირება.</p>
      </body></html>
    `);
  } catch (err) {
    console.error('[auth/shopify/callback]', err);
    res.status(500).send('შეცდომა: ' + err.message);
  }
});

function verifyHmac(query) {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&');
  const digest = crypto
    .createHmac('sha256', config.shopifyOAuth.apiSecret)
    .update(message)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(hmac, 'utf8'));
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = router;
