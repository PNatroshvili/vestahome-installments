// მარტივი ფაილზე დაფუძნებული "ბაზა" შეკვეთების თვალის-დევნებისთვის
// (ბანკის ორდერი <-> Shopify draft order მიმართებები, სტატუსები).
//
// ⚠️ ეს საკმარისია დაბალი ტრაფიკის მაღაზიისთვის და სწრაფი გასაშვებად, მაგრამ:
//  - თუ ჰოსტინგზე დისკი დროებითია (ephemeral), deploy-ისას მონაცემები შეიძლება წაიშალოს.
//  - თუ მოცულობა გაიზრდება, ღირს გადასვლა ნამდვილ ბაზაზე (მაგ. Render/Railway-ს
//    Postgres დანამატი). სტრუქტურა (getOrder/saveOrder/listPendingCredo) ისეა
//    დაწერილი, რომ ადვილად ჩანაცვლდეს.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: {} }, null, 2));
  }
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ძალიან მარტივი "საკეტი", რომ პარალელურმა request-ებმა ფაილი ერთმანეთს არ გადააწერონ.
let queue = Promise.resolve();
function withLock(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}

module.exports = {
  saveOrder(orderRef, record) {
    return withLock(() => {
      const data = readAll();
      data.orders[orderRef] = {
        ...data.orders[orderRef],
        ...record,
        updatedAt: new Date().toISOString(),
      };
      writeAll(data);
      return data.orders[orderRef];
    });
  },

  getOrder(orderRef) {
    const data = readAll();
    return data.orders[orderRef] || null;
  },

  listPendingCredo() {
    const data = readAll();
    return Object.entries(data.orders)
      .filter(([, o]) => o.bank === 'credo' && o.status === 'pending')
      .map(([orderRef, o]) => ({ orderRef, ...o }));
  },
};
