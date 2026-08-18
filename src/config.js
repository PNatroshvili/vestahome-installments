require('dotenv').config();

function required(name, value) {
  if (!value) {
    console.warn(`[config] გაფრთხილება: ${name} არაა დაყენებული .env ფაილში`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 3000,
  appBaseUrl: required('APP_BASE_URL', process.env.APP_BASE_URL),

  shopify: {
    domain: required('SHOPIFY_STORE_DOMAIN', process.env.SHOPIFY_STORE_DOMAIN),
    token: required('SHOPIFY_ADMIN_ACCESS_TOKEN', process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
  },

  // მხოლოდ ერთჯერადი გამოსაყენებლად — /auth/shopify/install გავლისთვის,
  // რომ თავად მივიღოთ ზემოთა SHOPIFY_ADMIN_ACCESS_TOKEN. Dev Dashboard-ის
  // აპის Settings გვერდიდან (Client ID / Client Secret).
  shopifyOAuth: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
  },

  bog: {
    clientId: required('BOG_CLIENT_ID', process.env.BOG_CLIENT_ID),
    clientSecret: required('BOG_CLIENT_SECRET', process.env.BOG_CLIENT_SECRET),
    callbackUrl: required('BOG_CALLBACK_URL', process.env.BOG_CALLBACK_URL),
    // BOG-ის callback-ის ხელმოწერის დადასტურების public key
    // (api.bog.ge/docs/payments/standard-process/callback).
    //
    // ⚠️ მნიშვნელოვანი: ეს გასაღები ავტომატურად ამოვიღეთ დოკუმენტაციის გვერდიდან.
    // სანამ production-ში webhook-ს ჩართავთ, აუცილებლად შეადარეთ ეს მნიშვნელობა
    // ცოცხალ api.bog.ge/docs/payments/standard-process/callback გვერდზე მოცემულს —
    // თუ არასწორია, ხელმოწერის ვერიფიკაცია ყოველთვის ჩავარდება და webhook-ები
    // ჩუმად უარყოფილი იქნება (401), რაც ნიშნავს, რომ შეკვეთები არასდროს მოინიშნება
    // "გადახდილად". სასურველია გასაღები env-ში (BOG_CALLBACK_PUBLIC_KEY) გქონდეთ,
    // რომ საჭიროების შემთხვევაში კოდის გადაშლის გარეშე შეცვალოთ.
    callbackPublicKey:
      process.env.BOG_CALLBACK_PUBLIC_KEY ||
      `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQhzHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrrTYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhxtcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPnPwIDAQAB\n-----END PUBLIC KEY-----`,
  },

  credo: {
    merchantId: required('CREDO_MERCHANT_ID', process.env.CREDO_MERCHANT_ID),
    password: required('CREDO_PASSWORD', process.env.CREDO_PASSWORD),
  },

  pollSecret: required('POLL_SECRET', process.env.POLL_SECRET),
};
