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
      // Tier selection was removed from the customer page: the customer sees
      // one clear price (the quote as shared) and approves or declines. A
      // decided share that recorded a chosen tier (legacy links) shows that
      // tier's price as the approved total instead of the stale itemized
      // snapshot the decision overrode.
      var chosen = null;
      if (share.status !== "pending" && share.chosen_option && Array.isArray(share.options)) {
        var wanted = String(share.chosen_option).trim();
        for (var i = 0; i < share.options.length; i++) {
          if (String(share.options[i].name || "").trim() === wanted) { chosen = share.options[i]; break; }
        }
      }
      var decision = share.status !== "pending"
        ? '<div class="decision ' + share.status + '"><span class="seal">' + (share.status === "approved" ? "✓" : "✕") +
          "</span><div><strong>Quote " + esc(share.status) + " by " + esc(share.decided_by_name || "the client") +
          "</strong>" + (share.chosen_option ? "<br /><small>Selected option: " + esc(share.chosen_option) +
          (chosen ? " — " + money(chosen.price, share.currency_code) : "") + "</small>" : "") +
          "<br /><small>" + esc(share.decided_at ? longDate(share.decided_at) : "") + "</small></div></div>"
        : '<form method="post" action="' + esc(share.decide_base + "approve") + '">' +
          '<label>Your name<input name="decided_by_name" required="required" maxlength="120" autocomplete="name" /></label>' +
          '<div class="actions">' +
          '<button type="submit" class="primary">Approve this quote</button>' +
          '<button type="submit" formaction="' + esc(share.decide_base + "decline") + '" class="secondary">Decline</button>' +
          '</div></form>' +
          '<p class="fine">Your choice is recorded once and sent to ' + esc(share.business_name) +
          ". CrewFlow records the name entered above, and does not independently verify identity.</p>";
      var rows = (share.items || []).map(function (item) {
        return "<tr><td>" + esc(item.name) + "</td><td>" + esc(item.quantity) + "</td><td>" +
          money(item.unitPrice, share.currency_code) + "</td><td>" +
          money(item.quantity * item.unitPrice, share.currency_code) + "</td></tr>";
      }).join("");
      // A decided tier pick overrides the itemized scope, so the base table
      // and its total would contradict the approved price — hide them.
      var scopeBlock = chosen ? "" :
        '<table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>' +
        rows + '</tbody></table><div class="total"><span>Total</span><span>' +
        money(share.total, share.currency_code) + "</span></div>";

      document.title = share.quote_title + " — quote from " + share.business_name;
      app.innerHTML =
        '<header class="hero"><div class="eyebrow">Quote for approval</div><h1>' + esc(share.quote_title) +
        "</h1><p>Prepared for " + esc(share.client_name) + " by " + esc(share.business_name) +
        (share.business_trade ? " · " + esc(share.business_trade) : "") + "</p></header>" +
        '<div class="content">' + scopeBlock + decision +
        '<p class="contact">Questions about this quote? ' + contact + "</p>" +
        '<p class="expiry">This link expires ' + esc(longDate(share.expires_at)) + ".</p></div>";
    })
    .catch(function () { fail("This approval link is unavailable or has expired."); });
})();
