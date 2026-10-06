(function () {
  "use strict";
  var app = document.getElementById("app");
  var FN = "https://crewflow-api.akhlaq.cloud/functions/v1/diagnostics-ops";
  var KEY_STORE = "crewflow.ops.adminKey";
  var state = { key: "", data: null };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function when(iso) {
    if (!iso) return "";
    var ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms)) return iso;
    var minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
  }
  function fail(message) {
    app.innerHTML = '<div class="state">' + esc(message) + "</div>";
  }

  // ---- key gate -----------------------------------------------------------
  var saved = "";
  try { saved = localStorage.getItem(KEY_STORE) || ""; } catch (e) { /* private mode */ }
  if (!saved) { renderGate(""); return; }
  load(saved, false);

  function renderGate(preset) {
    app.innerHTML =
      '<form class="gate" id="gate">' +
      '<div><div class="eyebrow">CrewFlow Ops</div><h1>Diagnostics dashboard</h1>' +
      '<p class="fine">Reads app-reported diagnostics (sync rejections, unreadable rows) from the live database. The key is the diagnostics-ops admin key.</p></div>' +
      '<label>Admin key<input type="password" id="key" autocomplete="off" value="' + esc(preset) + '" required></label>' +
      '<label class="checkline"><input type="checkbox" id="remember" checked> Remember on this device</label>' +
      '<button class="primary" type="submit">Open dashboard</button>' +
      '<p class="fine" id="gateError"></p></form>';
    var form = document.getElementById("gate");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var key = document.getElementById("key").value.trim();
      var remember = document.getElementById("remember").checked;
      if (!key) return;
      load(key, remember);
    });
  }

  function load(key, remember) {
    app.innerHTML = '<div class="state">Loading diagnostics…</div>';
    fetch(FN + "?limit=500", { headers: { Authorization: "Bearer " + key } })
      .then(function (response) {
        if (response.status === 401) throw new Error("key");
        if (!response.ok) throw new Error("http " + response.status);
        return response.json();
      })
      .then(function (data) {
        state.key = key;
        if (remember) { try { localStorage.setItem(KEY_STORE, key); } catch (e) { /* ignore */ } }
        state.data = data;
        render();
      })
      .catch(function (error) {
        if (error.message === "key") {
          try { localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
          renderGate("");
          document.getElementById("gateError").textContent = "That key was rejected (401). Check the diagnostics_ops_settings admin_key.";
        } else {
          fail("Could not load diagnostics (" + error.message + "). Is the updated diagnostics-ops function deployed?");
        }
      });
  }

  // ---- dashboard ----------------------------------------------------------
  function filtered() {
    var data = state.data || {};
    var events = data.events || [];
    var query = (document.getElementById("q") || {}).value || "";
    var severity = (document.getElementById("sev") || {}).value || "all";
    var syncOnly = document.getElementById("syncOnly") ? document.getElementById("syncOnly").checked : false;
    query = query.trim().toLowerCase();
    return events.filter(function (row) {
      if (severity !== "all" && row.severity !== severity) return false;
      if (syncOnly && String(row.code).indexOf("sync.") !== 0) return false;
      if (!query) return true;
      return [row.code, row.user_message, row.category, row.app_version, row.company_id]
        .some(function (field) { return String(field || "").toLowerCase().indexOf(query) !== -1; });
    });
  }

  function render() {
    var data = state.data || {};
    var events = data.events || [];
    var syncCount = events.filter(function (row) { return String(row.code).indexOf("sync.") === 0; }).length;
    var errorCount = events.filter(function (row) { return row.severity === "error" || row.severity === "critical"; }).length;

    app.innerHTML =
      '<div class="hero"><div class="eyebrow">CrewFlow Ops</div><h1>Diagnostics dashboard</h1>' +
      '<p>' + events.length + ' events stored &middot; updated ' + esc(when(new Date().toISOString())) + '</p></div>' +
      '<div class="content">' +
      '<div class="stats">' +
      '<div class="stat"><b>' + events.length + "</b><span>stored events (latest " + 500 + ")</span></div>" +
      '<div class="stat"><b>' + syncCount + "</b><span>sync.* issues</span></div>" +
      '<div class="stat"><b>' + errorCount + "</b><span>error or critical</span></div>" +
      "</div>" +
      '<div class="filters">' +
      '<div class="wide"><label>Search (code, message, version, company)<input id="q" type="search" placeholder="e.g. sync.push or permission denied"></label></div>' +
      '<label>Severity<select id="sev"><option value="all">All</option><option value="error">error</option><option value="warning">warning</option><option value="critical">critical</option><option value="info">info</option></select></label>' +
      '<label class="checkline"><input type="checkbox" id="syncOnly" checked> Sync issues only</label>' +
      "</div>" +
      '<div class="toolbar">' +
      '<button class="secondary" id="refresh" type="button">Refresh</button>' +
      '<button class="ghost" id="copyAll" type="button">Copy filtered as JSON</button>' +
      '<button class="ghost" id="forget" type="button">Forget key</button>' +
      "</div>" +
      '<div id="list"></div></div>';

    document.getElementById("q").addEventListener("input", renderList);
    document.getElementById("sev").addEventListener("change", renderList);
    document.getElementById("syncOnly").addEventListener("change", renderList);
    document.getElementById("refresh").addEventListener("click", function () { load(state.key, true); });
    document.getElementById("forget").addEventListener("click", function () {
      try { localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
      renderGate("");
    });
    document.getElementById("copyAll").addEventListener("click", function () {
      var rows = filtered();
      var payload = JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, events: rows }, null, 2);
      copyText(payload, document.getElementById("copyAll"), "Copied " + rows.length + " events");
    });
    renderList();
  }

  function renderList() {
    var rows = filtered();
    var list = document.getElementById("list");
    if (!rows.length) {
      list.innerHTML = '<div class="empty">No matching events. If a sync failure should be here, check that the app build reports diagnostics and the queue uploaded (open the app and tap Sync now).</div>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var rowJson = JSON.stringify(row, null, 2);
      return '<details class="event" data-json="' + esc(rowJson) + '">' +
        "<summary>" +
        '<span class="badge ' + esc(row.severity) + '">' + esc(row.severity) + "</span>" +
        '<span><span class="code">' + esc(row.code) + "</span>" +
        '<div class="fine">' + esc(row.user_message) + "</div></span>" +
        '<span class="when">' + esc(when(row.received_at)) + (row.occurrence_count > 1 ? " &times;" + esc(row.occurrence_count) : "") + "</span>" +
        "</summary>" +
        '<div class="detail"><div class="msg">' + esc(row.user_message) + "</div><dl>" +
        "<dt>code</dt><dd>" + esc(row.code) + "</dd>" +
        "<dt>category</dt><dd>" + esc(row.category) + "</dd>" +
        "<dt>recovery</dt><dd>" + esc(row.recovery_suggestion) + "</dd>" +
        "<dt>app version</dt><dd>" + esc(row.app_version) + "</dd>" +
        "<dt>os</dt><dd>" + esc(row.os_version) + "</dd>" +
        "<dt>company</dt><dd>" + esc(row.company_id) + "</dd>" +
        "<dt>user</dt><dd>" + esc(row.user_id) + "</dd>" +
        "<dt>occurrences</dt><dd>" + esc(row.occurrence_count) + "</dd>" +
        "<dt>first occurred</dt><dd>" + esc(row.first_occurred_at) + "</dd>" +
        "<dt>last occurred</dt><dd>" + esc(row.last_occurred_at) + "</dd>" +
        "<dt>received</dt><dd>" + esc(row.received_at) + "</dd>" +
        "<dt>auto recovered</dt><dd>" + esc(row.auto_recovered) + "</dd>" +
        "<dt>event id</dt><dd>" + esc(row.id) + "</dd>" +
        "</dl>" +
        '<button class="rowbtn" type="button">Copy JSON</button>' +
        "</div></details>";
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll("details .rowbtn"), function (button) {
      button.addEventListener("click", function () {
        copyText(button.closest("details").getAttribute("data-json"), button, "Copied");
      });
    });
  }

  function copyText(text, button, doneLabel) {
    var original = button.textContent;
    var done = function (ok) {
      button.textContent = ok ? doneLabel : "Copy failed";
      setTimeout(function () { button.textContent = original; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      done(ok);
    }
  }
})();
