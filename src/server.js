require('dotenv').config();

const express = require('express');
const config = require('./config');

const checkoutRouter = require('./routes/checkout');
const webhooksRouter = require('./routes/webhooks');
const authRouter = require('./routes/auth');
const { router: adminRouter, pollCredoOnce } = require('./routes/admin');

const app = express();

// CORS — რომ vestahome.ge-ს თემიდან (ბრაუზერიდან) fetch()-ით მოთხოვნები
// ჩვენს backend-მდე ჩავიდეს. მხოლოდ ჩვენი მაღაზიის დომენებს ვუშვებთ.
const ALLOWED_ORIGINS = new Set([
  'https://vestahome.ge',
  'https://www.vestahome.ge',
  'https://mc1gjm-nn.myshopify.com',
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));

// დროებითი დიაგნოსტიკური route — რომ ვნახოთ ამ სერვერის outbound IP,
// რომელიც Credo-ს whitelist-ში უნდა მიუთითოთ. მუშაობის დასრულების
// შემდეგ შეგიძლიათ წაშალოთ.
app.get('/debug/outbound-ip', async (req, res) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// checkout & admin routes მუშაობენ JSON body-ით
app.use('/api', express.json(), checkoutRouter);
app.use('/', express.json(), adminRouter);
// Shopify OAuth "install/callback" — ერთჯერადად, Admin API token-ის მისაღებად
app.use('/', authRouter);

// webhook route-ს ცალკე ვამონტაჟებთ — მას sub-route-ის შიგნით აქვს express.raw(),
// რადგან BOG-ის ხელმოწერის ვერიფიკაციას raw body სჭირდება.
app.use('/', webhooksRouter);

app.get('/payment/success', (req, res) => {
  res.send('გადახდა დასრულებულია — გმადლობთ! შეგიძლიათ დაბრუნდეთ მაღაზიაში.');
});
app.get('/payment/fail', (req, res) => {
  res.send('გადახდა ვერ შესრულდა ან გაუქმდა. სცადეთ თავიდან, ან დაუკავშირდით მაღაზიას.');
});

app.listen(config.port, () => {
  console.log(`[server] გაშვებულია პორტზე ${config.port}`);
});

// Credo-ს pending შეკვეთების პერიოდული შემოწმება იმავე პროცესში.
// ⚠️ ეს მუშაობს მხოლოდ მანამ, სანამ სერვისი "ცოცხალია". თუ თქვენი ჰოსტინგი
// (მაგ. Render-ის უფასო tier) უმოქმედობისას პროცესს აჩერებს, დამატებით
// მიამაგრეთ გარე cron POST /admin/poll-credo-ზე — იხ. docs/SETUP-ka.md.
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 წუთი
setInterval(() => {
  pollCredoOnce().catch((err) => console.error('[credo-poll]', err));
}, POLL_INTERVAL_MS);
