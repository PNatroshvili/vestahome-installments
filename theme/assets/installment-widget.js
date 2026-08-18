// vestahome.ge — "განვადებით ყიდვის" ღილაკების ლოგიკა.
// ორი რეჟიმი: "product" (ერთი პროდუქტი, პროდუქტის გვერდზე) და
// "cart" (მთელი კალათა, cart გვერდზე — Shopify-ს /cart.js-იდან იკითხავს).
// ორივე შემთხვევაში აგზავნის items-ს ჩვენს backend-ზე (POST /api/checkout/start),
// რომელიც ქმნის Shopify Draft Order-ს + ბანკის შეკვეთას და აბრუნებს redirect ბმულს.

(function () {
  var BACKEND_URL = 'https://vestahome-installments.onrender.com';

  function findVariantId(widget) {
    var scope = widget.closest('.product, [data-product], body') || document;
    var input = scope.querySelector('form[action*="/cart/add"] [name="id"]') || document.querySelector('[name="id"]');
    return input ? input.value : widget.getAttribute('data-variant-id');
  }

  function findQuantity(widget) {
    var scope = widget.closest('.product, [data-product], body') || document;
    var input = scope.querySelector('[name="quantity"]') || document.querySelector('[name="quantity"]');
    var qty = input ? parseInt(input.value, 10) : 1;
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  }

  function buildProductItems(widget) {
    var variantId = parseInt(findVariantId(widget), 10);
    var price = parseFloat(widget.getAttribute('data-price'));
    if (!variantId || !price) return null;
    return [
      {
        variantId: variantId,
        productId: widget.getAttribute('data-product-id'),
        title: widget.getAttribute('data-product-title'),
        quantity: findQuantity(widget),
        price: price,
      },
    ];
  }

  // კალათის რეჟიმისთვის — Shopify-ს საკუთარი /cart.js AJAX endpoint-იდან
  // ვკითხულობთ ყველა ამჟამინდელ line item-ს.
  function fetchCartItems() {
    return fetch('/cart.js')
      .then(function (res) {
        return res.json();
      })
      .then(function (cart) {
        if (!cart.items || cart.items.length === 0) return null;
        return cart.items.map(function (li) {
          return {
            variantId: li.variant_id,
            productId: li.product_id,
            title: li.product_title,
            quantity: li.quantity,
            price: li.price / 100, // Shopify /cart.js ფასს თეთრებში აბრუნებს
          };
        });
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.installment-btn');
    if (!btn) return;

    var widget = btn.closest('[data-installment-widget]');
    if (!widget) return;
    var statusEl = widget.querySelector('.installment-status');
    var bank = btn.getAttribute('data-bank');
    var mode = widget.getAttribute('data-mode') || 'product';

    var allButtons = widget.querySelectorAll('.installment-btn');

    function fail(message) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = message;
      }
      allButtons.forEach(function (b) {
        b.disabled = false;
      });
    }

    function proceed(items) {
      if (!items || items.length === 0) {
        fail(mode === 'cart' ? 'კალათა ცარიელია.' : 'ვერ დადგინდა პროდუქტის ვარიანტი — სცადეთ გვერდის განახლება.');
        return;
      }

      allButtons.forEach(function (b) {
        b.disabled = true;
      });
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'გთხოვთ მოიცადოთ, მიმდინარეობს გადამისამართება...';
      }

      fetch(BACKEND_URL + '/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank: bank, items: items }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'უცნობი შეცდომა');
            return data;
          });
        })
        .then(function (data) {
          window.location.href = data.redirectUrl;
        })
        .catch(function (err) {
          fail('ვერ მოხერხდა: ' + err.message);
        });
    }

    if (mode === 'cart') {
      allButtons.forEach(function (b) {
        b.disabled = true;
      });
      fetchCartItems()
        .then(proceed)
        .catch(function (err) {
          fail('კალათის წაკითხვა ვერ მოხერხდა: ' + err.message);
        });
    } else {
      proceed(buildProductItems(widget));
    }
  });
})();
