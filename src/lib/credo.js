// კრედო ბანკის ონლაინ განვადების widget API-სთან სამუშაო კლიენტი.
// წყარო: მომხმარებლის მიერ მოწოდებული "Integration Documentation of Credo Installment" (Word).

const crypto = require('crypto');
const config = require('../config');

const CREATE_ORDER_URL = 'https://ganvadeba.credo.ge/widget_api/index.php';
const STATUS_URL = 'https://ganvadeba.credo.ge/widget/api.php';

// დოკუმენტში მოცემული StatusId -> სახელი მიმართება
const CREDO_STATUS_MAP = {
  10: 'NEED_IDENTIFICATION',
  2: 'SENT',
  9: 'SENT_TO_BRANCH',
  14: 'SENT_TO_BACK_OFFICE_2',
  3: 'APPROVED',
  4: 'LATEST_APPROVED',
  12: 'DOCUMENT_ASSIGNED',
  5: 'CLOSED_SUCCESSFULLY',
  6: 'REJECTED',
  7: 'CANCELED',
  11: 'DRAFT',
  13: 'SENT_TO_VIDEO_MONITORING',
};

const SUCCESS_STATUS_NAMES = ['CLOSED_SUCCESSFULLY'];
const FAILURE_STATUS_NAMES = ['REJECTED', 'CANCELED'];

/**
 * MD5(id+title+amount+price+type [+... შემდეგი პროდუქტები] + password)
 * ზუსტად დოკუმენტის მაგალითის მიხედვით.
 */
function buildCheckHash(products) {
  const concatenated = products
    .map((p) => `${p.id}${p.title}${p.amount}${p.price}${p.type}`)
    .join('');
  return crypto
    .createHash('md5')
    .update(concatenated + config.credo.password)
    .digest('hex');
}

/** MD5(merchantId + orderCode + password) — სტატუსის მოთხოვნისთვის. */
function buildStatusHash(orderCode) {
  return crypto
    .createHash('md5')
    .update(`${config.credo.merchantId}${orderCode}${config.credo.password}`)
    .digest('hex');
}

/**
 * ქმნის განვადების შეკვეთას Credo-ზე და აბრუნებს redirect ბმულს, სადაც
 * მომხმარებელი უნდა გადავამისამართოთ (installment/?OrderHash=...).
 *
 * ⚠️ დოკუმენტში ამ endpoint-ის მეთოდი მითითებულია როგორც "POST Redirect", და
 * მითითებულია, რომ ბმული "response header"-იდან მოდის. სანდობა/ზუსტი ფორმატი
 * (redirect header vs JSON body) აუცილებლად გადაამოწმეთ Credo-ს sandbox-ში,
 * სანამ production-ში გაუშვებთ — ქვემოთ ორივე შემთხვევა ვცადეთ.
 */
async function createOrder({
  orderCode,
  products,
  installmentLength,
  clientFullName,
  mobile,
  email,
  factAddress,
}) {
  const check = buildCheckHash(products);

  // ⚠️ დადასტურებულია რეალურ ტესტირებაზე (2026-08-20): Credo-ს widget_api
  // PHP endpoint-ს JSON body საერთოდ არ ესმის (ალბათ $_POST-ს ეყრდნობა) —
  // JSON-ით ყოველთვის "not-available"-ზე მიდიოდა, credentials-ის
  // სისწორის მიუხედავად. სწორი ფორმატია application/x-www-form-urlencoded,
  // მასივები კი PHP-ის bracket notation-ით (products[0][id] და ა.შ.).
  const params = new URLSearchParams();
  params.append('merchantId', config.credo.merchantId);
  params.append('orderCode', orderCode);
  params.append('check', check);
  products.forEach((p, i) => {
    params.append(`products[${i}][id]`, p.id);
    params.append(`products[${i}][title]`, p.title);
    params.append(`products[${i}][amount]`, p.amount);
    params.append(`products[${i}][price]`, p.price);
    params.append(`products[${i}][type]`, p.type);
  });
  if (installmentLength) params.append('installmentLength', installmentLength);
  if (clientFullName) params.append('clientFullName', clientFullName);
  if (mobile) params.append('mobile', mobile);
  if (email) params.append('email', email);
  if (factAddress) params.append('factAddress', factAddress);

  const res = await fetch(CREATE_ORDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
    body: params.toString(),
  });

  const location = res.headers.get('location');
  if (location) {
    return { redirectUrl: location };
  }

  // ⚠️ რეალურად Credo პასუხობს HTTP 200-ით (redirect: 'manual'-საც არ სჭირდება)
  // და გადამისამართებას აბრუნებს "Refresh" header-ის საშუალებით
  // (მაგ. `refresh: 0.1;url=https://ganvadeba.credo.ge/installment/...`) —
  // არა `Location`-ით და არა JSON body-ით, როგორც დოკუმენტაციიდან
  // თავდაპირველად ვივარაუდეთ. დადასტურებულია რეალურ API-ზე ტესტირებით.
  const refreshHeader = res.headers.get('refresh');
  if (refreshHeader) {
    const match = refreshHeader.match(/url=(\S+)/i);
    if (match) {
      return { redirectUrl: match[1] };
    }
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Credo-ს შეკვეთის პასუხი მოულოდნელია: ${text}`);
  }
  if (data.redirectUrl || data.url || data.OrderHash || data.orderHash) {
    const hash = data.OrderHash || data.orderHash;
    return {
      redirectUrl: data.redirectUrl || data.url || `https://ganvadeba.credo.ge/installment/?OrderHash=${hash}`,
    };
  }

  throw new Error(`Credo-ს შეკვეთის შექმნა ჩავარდა: ${text}`);
}

/** ორდერის სტატუსის შემოწმება (GET, hash-ით ხელმოწერილი). */
async function getStatus(orderCode) {
  const hash = buildStatusHash(orderCode);
  const url = `${STATUS_URL}?merchantId=${encodeURIComponent(config.credo.merchantId)}&orderCode=${encodeURIComponent(
    orderCode
  )}&hash=${hash}`;
  const res = await fetch(url);
  return res.json();
}

module.exports = {
  createOrder,
  getStatus,
  buildCheckHash,
  buildStatusHash,
  CREDO_STATUS_MAP,
  SUCCESS_STATUS_NAMES,
  FAILURE_STATUS_NAMES,
};
