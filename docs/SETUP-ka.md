# ნაბიჯ-ნაბიჯ ინსტრუქცია — vestahome.ge-ზე განვადების ჩაშენება

ეს ინსტრუქცია არ ითხოვს პროგრამირების ცოდნას — მხოლოდ კოპირება/ჩასმას და
ღილაკებზე დაჭერას. სულ **6 ნაბიჯია**. თითოეულის შემდეგ შეგიძლიათ გაჩერდეთ.

პროექტის ყველა ფაილი უკვე მზადაა თქვენს კომპიუტერზე, აქ:
`C:\Users\geo\Desktop\skup projects\shopify-bank-installments`

---

## ნაბიჯი 1 — Shopify-ს Dev Dashboard-ში აპის მომზადება

⚠️ Shopify-მ 2025-2026-ში ძველი "Develop apps" ნაკადი **Dev Dashboard**-ით
ჩაანაცვლა, სადაც token პირდაპირ არ ჩანს — installაციისთვის სრული OAuth
გავლა სჭირდება. ამიტომ ამ token-ს **ჩვენივე backend-ით** მივიღებთ
(ნაბიჯი 4-ის შემდეგ, `/auth/shopify/install` გვერდით) — ეს ნაბიჯი მხოლოდ
მოსამზადებელია.

1. Shopify Admin → **Settings → Apps → Develop apps → Build apps in Dev Dashboard**
2. **Create app** → სახელი, მაგ. `Installment-Middleware`
3. შექმენით ახალი **version**:
   - **Scopes**: `write_draft_orders,read_draft_orders,write_orders,read_orders`
   - ✅ **Use legacy install flow**
   - **App URL**: დროებით `https://vestahome.ge` (მნიშვნელობა არა აქვს)
   - **Allowed redirection URL(s)**: ჯერ ცარიელი დატოვეთ — ნაბიჯ 4-ის
     შემდეგ დაბრუნდებით და შეავსებთ რეალური backend-მისამართით
   - **Release**
4. მარცხენა მენიუში **Settings** → იპოვეთ **Client ID** და **Client secret**
   (ან "API key" / "API secret key") — დააკოპირეთ ორივე, დაგჭირდებათ
   ნაბიჯ 3-ში (.env-ში `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`)
5. თქვენი `*.myshopify.com` მისამართიც დაგჭირდებათ (Dev Dashboard-ის ზედა
   მარჯვენა კუთხეში "Vesta Home" ღილაკზე ან Admin-ის URL-ში ჩანს)

---

## ნაბიჯი 2 — ბანკების მონაცემების მომზადება

**საქართველოს ბანკი** — გჭირდებათ `Client ID` და `Client Secret`
(ეს განსხვავებულია ჩვეულებრივი ონლაინ ბანკინგისგან — ეს არის API-წვდომის
მონაცემები, რომელსაც გცემთ თქვენი BOG-ის ბიზნეს-მენეჯერი/e-commerce
გუნდი, რომელთანაც უკვე გაქვთ ხელშეკრულება). თუ ჯერ არ გაქვთ — სთხოვეთ მათ:
> "გვჭირდება api.bog.ge-ს ონლაინ გადახდის/განვადების API-ს client_id და
> client_secret ჩვენი e-commerce ინტეგრაციისთვის."

**კრედო ბანკი** — გჭირდებათ `merchantId` და `password` (secret სტრიქონი,
რომელიც შეთანხმებულია თქვენსა და ბანკს შორის MD5 ხელმოწერისთვის). ასევე
Credo-ს დოკუმენტაცია მიუთითებს:
> "გთხოვთ მოგვაწოდოთ თქვენი IP მისამართი, რომ დაგამატოთ ქსელის Whitelist-ში."

— ეს ნიშნავს, რომ backend-ის deploy-ის შემდეგ (ნაბიჯი 4), მიღებული სერვერის
IP მისამართი უნდა გაუგზავნოთ Credo-ს, სანამ განვადების მოთხოვნები დაიწყებს
მუშაობას.

---

## ნაბიჯი 3 — გარემოს ცვლადების (.env) შევსება

1. გახსენით საქაღალდე `shopify-bank-installments`
2. დააკოპირეთ ფაილი `.env.example` და დაარქვით `.env`
3. გახსენით ტექსტურ რედაქტორში (Notepad საკმარისია) და შეავსეთ:

| ცვლადი | რა ჩავწეროთ |
|---|---|
| `APP_BASE_URL` | დროებით დატოვეთ ცარიელი, ნაბიჯ 4-ის შემდეგ შეავსებთ |
| `SHOPIFY_STORE_DOMAIN` | თქვენი `xxxxx.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | ჯერ ცარიელი — შეავსებთ ნაბიჯი 4-ის შემდეგ |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | ნაბიჯი 1-დან, Dev Dashboard → Settings |
| `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET` | ბანკისგან მიღებული |
| `BOG_CALLBACK_URL` | დროებით დატოვეთ ცარიელი |
| `CREDO_MERCHANT_ID`, `CREDO_PASSWORD` | ბანკისგან მიღებული |
| `POLL_SECRET` | თვითონ მოიფიქრეთ გრძელი შემთხვევითი სტრიქონი (მაგ. 20+ სიმბოლო) |

⚠️ **ეს ფაილი (`.env`) არასდროს გააზიაროთ საჯაროდ** (GitHub-ზე ატვირთვისას
ის ავტომატურად გამოტოვება — `.gitignore`-შია ჩამატებული).

---

## ნაბიჯი 4 — Backend-ის ატვირთვა ინტერნეტში (Render.com)

Backend უნდა იყოს "ცოცხალ" სერვერზე, რომ ბანკებმა და Shopify-ს თემამ
შეძლონ მასთან დაკავშირება. ვიყენებთ **Render.com**-ს (უფასო ტიერი
საკმარისია დასაწყისისთვის, მარტივია, GitHub-ის ანგარიშით შესვლა შეგიძლიათ).

1. **GitHub-ის ანგარიშის შექმნა** (თუ არ გაქვთ): github.com → Sign up
2. შექმენით ახალი repository, მაგ. სახელით `vestahome-installments`
   (private-ად დატოვეთ)
3. Repository-ს გვერდზე → **Add file → Upload files** → გადმოათრიეთ მთელი
   `shopify-bank-installments` საქაღალდის შიგთავსი (გარდა `.env`-ისა და
   `node_modules`-ისა, თუ შემთხვევით შეიქმნა) → **Commit changes**
4. გადადით render.com-ზე → **Sign up** (მოსახერხებელია "Sign up with GitHub")
5. **New +** → **Web Service** → აირჩიეთ თქვენი `vestahome-installments` repo
6. კონფიგურაცია:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (დასაწყისისთვის; იხ. შენიშვნა ბოლოში)
7. **Environment** სექციაში დაამატეთ ყველა ცვლადი თქვენი `.env` ფაილიდან
   (თითო-თითოდ, Key/Value ველებში — **არა თავად `.env` ფაილი**)
8. **Create Web Service** → დაელოდეთ deploy-ს დასრულებას (2-5 წუთი)
9. წარმატების შემდეგ დაინახავთ თქვენს backend-ის მისამართს, მაგ.:
   `https://vestahome-installments.onrender.com`

**ახლა დააბრუნეთ ეს URL Render-ის Environment-ში**:
- `APP_BASE_URL` = `https://vestahome-installments.onrender.com`
- `BOG_CALLBACK_URL` = `https://vestahome-installments.onrender.com/webhooks/bog`

შეინახეთ (Save Changes) — Render ავტომატურად თავიდან გაუშვებს სერვისს.

📌 **BOG_CALLBACK_URL ეს მისამართი გადაეცით BOG-ის მენეჯერს**, რომ
გადახდის დადასტურების callback-ები აქ მოვიდეს.

📌 **Render-ის უფასო tier-ი "იძინებს" უმოქმედობის დროს** — ეს BOG-ის
webhook-ს არ აწუხებს (მოთხოვნისას იღვიძებს), მაგრამ ნიშნავს, რომ Credo-ს
პერიოდული სტატუსის შემოწმება (30 წუთში ერთხელ, კოდში built-in) შეიძლება
არარეგულარულად იმუშაოს. თუ ეს პრობლემად იქცევა: (ა) გადადით Render-ის
ფასიან "Starter" გეგმაზე (~$7/თვე, ყოველთვის ჩართული), ან (ბ) გამოიყენეთ
უფასო გარე cron სერვისი (მაგ. cron-job.org), რომელიც 30-60 წუთში ერთხელ
გამოგიძახებთ `POST https://.../admin/poll-credo` headers-ით
`X-Poll-Secret: <თქვენი POLL_SECRET>`.

---

## ნაბიჯი 5 — თემაში ღილაკების ჩამატება

1. Shopify Admin → **Online Store → Themes** → თქვენი აქტიური თემა
   (Dawn) → **⋯ → Edit code**
2. **Assets** სექციაში → **Add a new asset → Create a blank file**:
   - შექმენით `installment-widget.js`, ჩასვით
     `theme/assets/installment-widget.js`-ის შიგთავსი — **მაგრამ ჯერ
     შეცვალეთ ფაილში `BACKEND_URL` მნიშვნელობა** თქვენი Render-ის
     რეალური მისამართით (ნაბიჯი 4-დან)
   - იგივანაირად შექმენით `installment-widget.css`
     (`theme/assets/installment-widget.css`-იდან)
3. **Snippets** სექციაში → **Add a new snippet** → სახელი: `installment-buttons`
   → ჩასვით `theme/snippets/installment-buttons.liquid`-ის შიგთავსი
4. გახსენით **Sections → main-product.liquid**, იპოვეთ ადგილი "buy
   buttons"/"ADD TO CART" ბლოკის მახლობლად და დაამატეთ ახალ ხაზზე:

   ```liquid
   {% render 'installment-buttons', product: product %}
   ```

5. **Save** → გახსენით ნებისმიერი პროდუქტის გვერდი მაღაზიაში და
   შეამოწმეთ, ჩანს თუ არა ორი ღილაკი ("განვადება — საქართველოს ბანკი" და
   "განვადება — კრედო ბანკი").

---

## ნაბიჯი 6 — ტესტირება (სავალდებულო, სანამ რეალურ მომხმარებელს გახსნით)

1. სთხოვეთ ორივე ბანკს **sandbox/ტესტ credential-ები** (თუ უკვე მოცემული
   client_id/merchantId production-ისთვისაა, სთხოვეთ ცალკე ტესტ-გარემო)
2. გაუშვით სრული ტესტ-შესყიდვა საიტიდან ბოლომდე — ორივე ბანკით
3. შეამოწმეთ:
   - შეიქმნა თუ არა Shopify-ში შეკვეთა (თავიდან როგორც Draft, შემდეგ —
     დადასტურების შემდეგ — როგორც სრული, "გადახდილი" Order)
   - Render-ის **Logs** ტაბში ნახეთ, მოვიდა თუ არა BOG-ის callback და
     გაიარა თუ არა ხელმოწერის შემოწმება (`src/routes/webhooks.js`)
   - Credo-ს შემთხვევაში, დაელოდეთ 30 წუთს და გამოიძახეთ
     `POST /admin/poll-credo` ხელით (`X-Poll-Secret` header-ით), ან
     დაელოდეთ ავტომატურ poll-ს

⚠️ **მნიშვნელოვანი**: BOG-ის callback-ის ზუსტი ველების სახელები
(`src/routes/webhooks.js`-ში `⚠️`-ით მონიშნული ადგილი) აგებულია
დოკუმენტაციის ნაწილობრივ აღწერაზე. პირველივე ტესტ-callback-ის Render
Logs-ში ნახვის შემდეგ, საჭიროების შემთხვევაში მითხარით რეალური payload-ი
(ან ჩასვით აქვე ჩატში ლოგის ტექსტი, პერსონალური მონაცემების გარეშე) — მე
დაგეხმარებით კოდის ზუსტ მორგებაში.

---

## კითხვების შემთხვევაში

დამიბრუნდით ამავე საუბარში ნებისმიერ ეტაპზე — მაგალითად, თუ:
- Render-ზე deploy ვერ გაივლის (მომეცით შეცდომის ტექსტი)
- BOG/Credo-ს callback/response რეალურად სხვანაირად გამოიყურება
- გინდათ, რომ ღილაკების დიზაინი თემას მეტად მოვარგო
