// vestahome.ge — "განვადებით ყიდვის" ღილაკების ლოგიკა.
// აგზავნის მიმდინარე ვარიანტს/რაოდენობას ჩვენს backend-ზე (POST /api/checkout/start),
// რომელიც ქმნის Shopify Draft Order-ს + ბანკის შეკვეთას და აბრუნებს redirect ბმულს.

(function () {
  // ⚠️ ჩაანაცვლეთ ეს მისამართი backend-ის deploy-ის შემდეგ მიღებული URL-ით
  // (მაგ. https://vestahome-installments.onrender.com)
  var BACKEND_URL = 'https://your-backend-domain.example.com';

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

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.installment-btn');
    if (!btn) return;

    var widget = btn.closest('[data-installment-widget]');
    if (!widget) return;
    var statusEl = widget.querySelector('.installment-status');
    var bank = btn.getAttribute('data-bank');

    var payload = {
      bank: bank,
      items: [
        {
          variantId: parseInt(findVariantId(widget), 10),
          productId: widget.getAttribute('data-product-id'),
          title: widget.getAttribute('data-product-title'),
          quantity: findQuantity(widget),
          price: parseFloat(widget.getAttribute('data-price')),
        },
      ],
    };

    if (!payload.items[0].variantId || !payload.items[0].price) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'ვერ დადგინდა პროდუქტის ვარიანტი — სცადეთ გვერდის განახლება.';
      }
      return;
    }

    var allButtons = widget.querySelectorAll('.installment-btn');
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
      body: JSON.stringify(payload),
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
        if (statusEl) statusEl.textContent = 'ვერ მოხერხდა: ' + err.message;
        allButtons.forEach(function (b) {
          b.disabled = false;
        });
      });
  });
})();
