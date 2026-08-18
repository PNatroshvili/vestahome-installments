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
  const payload = {
    merchantId: config.credo.merchantId,
    orderCode,
    check,
    products,
  };
  if (installmentLength) payload.installmentLength = installmentLength;
  if (clientFullName) payload.clientFullName = clientFullName;
  if (mobile) payload.mobile = mobile;
  if (email) payload.email = email;
  if (factAddress) payload.factAddress = factAddress;

  const res = await fetch(CREATE_ORDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual',
    body: JSON.stringify(payload),
  });

  const location = res.headers.get('location');
  if (location) {
    return { redirectUrl: location };
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
