(function () {
  "use strict";
  var app = document.getElementById("app");
  var FN = "https://lkuhoyeeylileuuavukj.supabase.co/functions/v1/quote-approval";
  var token = new URLSearchParams(location.search).get("t") || "";
  var esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var longDate = function (iso) {
    try { return new Date(iso).toLocaleDateString("en", { dateStyle: "long" }); }
    catch (e) { return ""; }
  };
  var symbols = { USD: "$", GBP: "£", EUR: "€", PKR: "Rs ", INR: "₹", AUD: "A$", CAD: "C$" };
  var money = function (value, code) {
    return (symbols[code] || (code ? code + " " : "")) +
      Number(value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var fail = function (message) {
    app.innerHTML = '<div class="state">' + esc(message) + "</div>";
  };

  if (!token || token.length < 32) { fail("This approval link is unavailable or has expired."); return; }

  fetch(FN + "?token=" + encodeURIComponent(token) + "&format=json")
    .then(function (response) { if (!response.ok) throw new Error("unavailable"); return response.json(); })
    .then(function (share) {
      var contact = share.business_email
        ? '<a href="mailto:' + encodeURIComponent(share.business_email) + '">' + esc(share.business_email) + "</a>"
        : share.business_phone
        ? '<a href="tel:' + esc(String(share.business_phone).replace(/[^+0-9]/g, "")) + '">' + esc(share.business_phone) + "</a>"
        : "Contact " + esc(share.business_name) + ".";
      // Good-better-best: when the quote carries options, the customer
      // picks one; the recommended itemized scope is the default selection.
      var optionsBlock = "";
      var optionField = "";
      if (share.status === "pending" && Array.isArray(share.options) && share.options.length) {
        var cards = '<button type="button" class="option selected" data-option-index="-1">' +
          '<div class="name">Recommended — as itemized above</div>' +
          '<div class="price">' + money(share.total, share.currency_code) + "</div></button>";
        share.options.forEach(function (option, index) {
          cards += '<button type="button" class="option" data-option-index="' + index + '">' +
            '<div class="name">' + esc(option.name) + "</div>" +
            (option.scope ? '<div class="scope">' + esc(option.scope) + "</div>" : "") +
            '<div class="price">' + money(option.price, share.currency_code) + "</div></button>";
        });
        optionsBlock = '<h2 style="margin-top:22px">Choose an option</h2><div class="options">' + cards + "</div>";
        optionField = '<input type="hidden" name="option_index" id="option_index" value="-1" />';
      }
      var decision = share.status !== "pending"
        ? '<div class="decision ' + share.status + '"><span class="seal">' + (share.status === "approved" ? "✓" : "✕") +
          "</span><div><strong>Quote " + esc(share.status) + " by " + esc(share.decided_by_name || "the client") +
          "</strong>" + (share.chosen_option ? "<br /><small>Selected option: " + esc(share.chosen_option) + "</small>" : "") +
          "<br /><small>" + esc(share.decided_at ? longDate(share.decided_at) : "") + "</small></div></div>"
        : '<div class="actions">' +
          '<form method="post" action="' + esc(share.decide_base + "approve") + '">' +
          optionField +
          '<label>Your name<input name="decided_by_name" required="required" maxlength="120" autocomplete="name" /></label>' +
          '<button type="submit" class="primary">Approve this quote</button></form>' +
          '<form method="post" action="' + esc(share.decide_base + "decline") + '">' +
          '<button type="submit" class="secondary">Decline</button></form></div>' +
          '<p class="fine">Your choice is recorded once and sent to ' + esc(share.business_name) +
          ". CrewFlow records the name entered above; it does not independently verify identity.</p>";
      var rows = (share.items || []).map(function (item) {
        return "<tr><td>" + esc(item.name) + "</td><td>" + esc(item.quantity) + "</td><td>" +
          money(item.unitPrice, share.currency_code) + "</td><td>" +
          money(item.quantity * item.unitPrice, share.currency_code) + "</td></tr>";
      }).join("");

      document.title = share.quote_title + " — quote from " + share.business_name;
      app.innerHTML =
        '<header class="hero"><div class="eyebrow">Quote for approval</div><h1>' + esc(share.quote_title) +
        "</h1><p>Prepared for " + esc(share.client_name) + " by " + esc(share.business_name) +
        (share.business_trade ? " · " + esc(share.business_trade) : "") + "</p></header>" +
        '<div class="content"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>' +
        rows + '</tbody></table><div class="total"><span>Total</span><span>' +
        money(share.total, share.currency_code) + "</span></div>" + optionsBlock + decision +
        '<p class="contact">Questions about this quote? ' + contact + "</p>" +
        '<p class="expiry">This link expires ' + esc(longDate(share.expires_at)) + ".</p></div>";

      // Inline onclick attributes would be blocked by the page's
      // script-src 'self' CSP, so the option cards are wired here, after
      // the markup exists: a click records the index in the hidden field
      // the approve form submits and moves the selected highlight.
      Array.prototype.forEach.call(app.querySelectorAll(".option"), function (card) {
        card.addEventListener("click", function () {
          var field = document.getElementById("option_index");
          if (field) field.value = card.getAttribute("data-option-index") || "-1";
          Array.prototype.forEach.call(app.querySelectorAll(".option.selected"), function (other) {
            other.classList.remove("selected");
          });
          card.classList.add("selected");
        });
      });
    })
    .catch(function () { fail("This approval link is unavailable or has expired."); });
})();
