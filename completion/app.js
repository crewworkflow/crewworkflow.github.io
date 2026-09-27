(function () {
  "use strict";
  var app = document.getElementById("app");
  var FN = "https://lkuhoyeeylileuuavukj.supabase.co/functions/v1/project-completion";
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
  var fail = function (message) {
    app.innerHTML = '<div class="state">' + esc(message) + "</div>";
  };

  if (!token || token.length < 32) { fail("This completion link is unavailable or has expired."); return; }

  fetch(FN + "?token=" + encodeURIComponent(token) + "&format=json")
    .then(function (response) { if (!response.ok) throw new Error("unavailable"); return response.json(); })
    .then(function (share) {
      var logo = share.has_logo && share.assets.logo
        ? '<img class="logo" src="' + esc(share.assets.logo) + '" alt="' + esc(share.business_name) + ' logo" />'
        : "";
      var approval = share.approved_at
        ? '<div class="approved"><span class="seal">✓</span><div><strong>Work approved by ' + esc(share.approver_name) +
          "</strong><br /><small>" + esc(longDate(share.approved_at)) + "</small></div></div>"
        : '<form class="approval" method="post" action="' + esc(share.approve_url) + '">' +
          "<h2>Approve completed work</h2><p>Confirm that you have reviewed this completion summary.</p>" +
          '<label>Your name<input name="approver_name" required="required" maxlength="120" autocomplete="name" /></label>' +
          '<button type="submit">Approve completed work</button>' +
          "<p><small>CrewFlow records the name entered here; it does not independently verify identity.</small></p></form>";
      var requestHref = share.business_email
        ? "mailto:" + encodeURIComponent(share.business_email) +
          "?subject=" + encodeURIComponent("Request similar work " + share.business_name) +
          "&body=" + encodeURIComponent("Hi " + share.business_name + ",\n\nI saw the completion page for " +
            share.project_name + " and would like to request similar work.\n")
        : share.business_phone ? "tel:" + share.business_phone.replace(/[^+0-9]/g, "") : "";
      var requestButton = requestHref
        ? '<a class="button secondary" href="' + esc(requestHref) + '">Request similar work</a>' : "";
      // The happiest moment: an approved job can ask for a Google review.
      var reviewLink = share.approved_at && share.google_review_url &&
                       String(share.google_review_url).indexOf("https://") === 0
        ? '<a class="button review" href="' + esc(share.google_review_url) +
          '" target="_blank" rel="noopener">Happy with the work? Leave us a review</a>' : "";
      var formatWarranty = function (text) {
        if (!text) return "";
        var t = String(text).trim().replace(/\.+$/, "");
        if (!t) return "";
        if (/^(this work|backed by|all work|we offer|comes with)/i.test(t)) {
          return '<p class="warranty">🛡 ' + esc(t) + ".</p>";
        }
        var normalized = t
          .replace(/^(\d+)\s+years?(\s+warranty)?$/i, function (_, count) { return count + "-year warranty"; })
          .replace(/^(\d+)\s+months?(\s+warranty)?$/i, function (_, count) { return count + "-month warranty"; })
          .replace(/^(\d+)\s+days?(\s+warranty)?$/i, function (_, count) { return count + "-day warranty"; });
        if (!/warranty|guarantee/i.test(normalized)) {
          normalized = normalized + " warranty";
        }
        var article = /^[aeiou]/i.test(normalized) ? "an" : "a";
        return '<p class="warranty">🛡 This work carries ' + article + " <strong>" + esc(normalized) + "</strong>.</p>";
      };
      var warranty = formatWarranty(share.warranty_text);
      var powered = share.show_powered_by
        ? '<div class="powered">Project proof powered by <strong>CrewFlow</strong></div>' : "";

      document.title = share.project_name + " completed by " + share.business_name;
      app.innerHTML =
        '<header class="hero"><div class="brand">' + logo +
        '<div><div class="eyebrow">Project completion</div><strong>' + esc(share.business_name) + "</strong>" +
        (share.business_trade ? "<br /><span>" + esc(share.business_trade) + "</span>" : "") +
        "</div></div><h1>" + esc(share.project_name) + "</h1><p>Prepared for " + esc(share.client_name) + "</p></header>" +
        '<div class="content"><div class="photos">' +
        '<figure class="photo"><img src="' + esc(share.assets.before) + '" alt="Before work" /><span class="tag">BEFORE</span></figure>' +
        '<figure class="photo"><img src="' + esc(share.assets.after) + '" alt="Completed work" /><span class="tag">AFTER</span></figure>' +
        "</div><section><h2>Completed scope</h2>" +
        '<div class="scope">' + esc(share.completed_scope) + "</div>" +
        '<div class="meta"><span>Completed ' + esc(longDate(share.completed_at)) + "</span><span>Prepared by " +
        esc(share.business_name) + "</span></div></section>" +
        '<div class="actions"><a class="button" href="' + esc(share.assets.report) + '">Download completion report</a>' +
        requestButton + "</div>" + approval + reviewLink + warranty + "</div>" + powered;
    })
    .catch(function () { fail("This completion link is unavailable or has expired."); });
})();
