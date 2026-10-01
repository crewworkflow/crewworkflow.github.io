(function () {
  "use strict";
  var app = document.getElementById("app");
  // Hard-coded, allowlisted endpoint: protocol and host are constants, and
  // the only variable part of the request is the slug query value, which is
  // restricted to [a-z0-9-] below. (Browser-side fetch — the "server makes
  // the request" SSRF class does not apply, but the target is pinned anyway.)
  var endpoint = new URL("https://lkuhoyeeylileuuavukj.supabase.co/functions/v1/portfolio");
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

  var slug = new URLSearchParams(location.search).get("c") || "";
  if (!/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    fail("Portfolio not found.");
    return;
  }
  endpoint.searchParams.set("company", slug);

  fetch(endpoint)
    .then(function (response) { if (!response.ok) throw new Error("unavailable"); return response.json(); })
    .then(function (data) {
      var business = data.business || {};
      if (!business.name) { fail("Portfolio not found."); return; }
      document.title = business.name + " — recent work";
      var hero = '<header class="hero"><div class="brand"><div>' +
        '<div class="eyebrow">Recent work</div><h1>' + esc(business.name) + "</h1>" +
        (business.trade ? "<p>" + esc(business.trade) + "</p>" : "") +
        "</div></div></header>";
      var jobs = (data.projects || []).map(function (project) {
        var photos = '<figure class="photo"><img src="' + esc(project.before_url) +
          '" alt="Before work" loading="lazy" /><span class="tag">BEFORE</span></figure>' +
          '<figure class="photo"><img src="' + esc(project.after_url) +
          '" alt="Completed work" loading="lazy" /><span class="tag">AFTER</span></figure>';
        return '<div class="project"><div class="photos">' + photos + "</div>" +
          '<div class="body"><h2>' + esc(project.name) + "</h2>" +
          '<div class="when">Completed ' + esc(longDate(project.completed_at)) +
          " · approved by the customer</div></div></div>";
      }).join("");
      var body = jobs
        ? '<div class="grid">' + jobs + "</div>"
        : '<div class="state">New photos are on the way — check back soon.</div>';
      // Every portfolio page credits the tool, in front of exactly the
      // audience that needs it: other contractors' customers.
      var powered = '<div class="powered">This portfolio is kept with <strong>CrewFlow</strong></div>';
      app.innerHTML = hero + '<div class="content">' + body + "</div>" + powered;
    })
    .catch(function () { fail("Portfolio not found."); });
})();
