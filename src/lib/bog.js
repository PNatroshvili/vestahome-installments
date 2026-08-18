// საქართველოს ბანკის (Bank of Georgia) e-commerce API-სთან სამუშაო კლიენტი.
// წყარო: https://api.bog.ge/docs/payments/authentication
//        https://api.bog.ge/docs/payments/standard-process/create-order
//        https://api.bog.ge/docs/payments/standard-process/callback

const crypto = require('crypto');
const config = require('../config');

const TOKEN_URL = 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const ORDERS_URL = 'https://api.bog.ge/payments/v1/ecommerce/orders';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 5000) {
    return cachedToken;
  }

  const basic = Buffer.from(`${config.bog.clientId}:${config.bog.clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`BOG ავტორიზაცია ჩავარდა: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;

  // დოკუმენტაციის მაგალითში expires_in უჩვეულოდ დიდი რიცხვია (შეიძლება იყოს ms-timestamp
  // ტიპის მნიშვნელობა და არა წამების TTL) — უსაფრთხოებისთვის, თუ მნიშვნელობა "გონივრულ"
  // დიაპაზონს სცდება, 5 წუთიან ქეშს ვიყენებთ.
  const seconds = Number(data.expires_in);
  const ttlMs = seconds > 0 && seconds < 24 * 3600 ? seconds * 1000 : 5 * 60 * 1000;
  tokenExpiresAt = Date.now() + ttlMs;

  return cachedToken;
}

/**
 * BOG-ზე შეკვეთის შექმნა და გადახდის/განვადების გვერდზე გადამისამართების ბმულის მიღება.
 */
async function createOrder({
  externalOrderId,
  totalAmount,
  currency,
  basket,
  buyerFullName,
  installmentMonths,
}) {
  const token = await getAccessToken();

  const body = {
    callback_url: config.bog.callbackUrl,
    external_order_id: externalOrderId,
    purchase_units: {
      currency: currency || 'GEL',
      total_amount: totalAmount,
      basket,
    },
    redirect_urls: {
      success: `${config.appBaseUrl}/payment/success?ref=${encodeURIComponent(externalOrderId)}&bank=bog`,
      fail: `${config.appBaseUrl}/payment/fail?ref=${encodeURIComponent(externalOrderId)}&bank=bog`,
    },
    // "bog_loan" და "bnpl" პარამეტრებით მომხმარებელი ბანკის გვერდზევე ირჩევს
    // განვადების/BNPL პირობებს — ცალკე calculator modal-ის ჩაშენება საჭირო არაა.
    payment_method: ['bog_loan', 'bnpl'],
  };

  if (installmentMonths) {
    body.config = { loan: { month: installmentMonths } };
  }
  if (buyerFullName) {
    body.buyer = { full_name: buyerFullName };
  }

  const res = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ka',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`BOG-ის შეკვეთის შექმნა ჩავარდა: ${res.status} ${JSON.stringify(data)}`);
  }

  return {
    bogOrderId: data.id,
    redirectUrl: data._links && data._links.redirect && data._links.redirect.href,
    detailsUrl: data._links && data._links.details && data._links.details.href,
  };
}

/** შეკვეთის დეტალების/სტატუსის წამოღება BOG-იდან (fallback, თუ webhook არ მოვიდა). */
async function getOrderDetails(bogOrderId) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.bog.ge/payments/v1/receipt/${bogOrderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`BOG-ის შეკვეთის დეტალების წამოღება ჩავარდა: ${res.status}`);
  }
  return res.json();
}

/** ამოწმებს BOG-ის callback-ის ხელმოწერას (SHA256withRSA + public key). */
function verifyCallbackSignature(rawBody, signatureBase64) {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(rawBody);
  verifier.end();
  return verifier.verify(config.bog.callbackPublicKey, signatureBase64, 'base64');
}

module.exports = {
  getAccessToken,
  createOrder,
  getOrderDetails,
  verifyCallbackSignature,
};
