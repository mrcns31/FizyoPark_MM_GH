(function () {
  var MOBILE_MQ = window.matchMedia("(max-width: 767px)");
  var allItems = [];
  var consentVersion = "";
  var isAdmin = false;
  var sortColumn = "name";
  var sortDir = "asc";

  var SORT_LABELS = {
    name: "Ad Soyad",
    account: "Hesap",
    status: "Onay Durumu",
    date: "Onay Tarihi",
  };

  var webDateFmt = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function fmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '—' : webDateFmt.format(d);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMobileView() {
    return MOBILE_MQ.matches;
  }

  function updateLayout() {
    var cardsEl = document.getElementById("consentsCards");
    var tableWrap = document.getElementById("consentsTableWrap");
    var mobile = isMobileView();
    if (cardsEl) cardsEl.classList.toggle("hidden", !mobile);
    if (tableWrap) tableWrap.classList.toggle("hidden", mobile);
  }

  function filteredItems() {
    var q = (document.getElementById("consentsSearchInput") || {}).value || "";
    q = q.trim().toLowerCase();
    var status = (document.getElementById("consentsStatusFilter") || {}).value || "";
    var items = allItems.filter(function (item) {
      if (status === "accepted" && !item.consentAccepted) return false;
      if (status === "pending" && (item.consentAccepted || !item.hasAccount)) return false;
      if (status === "noaccount" && item.hasAccount) return false;
      if (!q) return true;
      var haystack = (item.memberName + " " + item.phone + " " + item.memberNo).toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
    return sortItems(items);
  }

  function sortValue(item, col) {
    switch (col) {
      case "name": return (item.memberName || "").toLowerCase();
      case "account": return item.hasAccount ? 1 : 0;
      case "status": return item.consentAccepted ? 2 : (item.hasAccount ? 1 : 0);
      case "date": return item.consentAcceptedAt ? new Date(item.consentAcceptedAt).getTime() : 0;
      default: return 0;
    }
  }

  function sortItems(items) {
    var col = sortColumn;
    var mult = sortDir === "asc" ? 1 : -1;
    return items.slice().sort(function (a, b) {
      var va = sortValue(a, col);
      var vb = sortValue(b, col);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }

  function renderStats() {
    var statsEl = document.getElementById("consentsStats");
    if (!statsEl) return;
    var total = allItems.length;
    var accepted = allItems.filter(function (i) { return i.consentAccepted; }).length;
    var noAccount = allItems.filter(function (i) { return !i.hasAccount; }).length;
    var pending = total - accepted - noAccount;
    statsEl.innerHTML =
      '<span class="consents-stat"><strong>' + total + '</strong> üye</span>' +
      '<span class="consents-stat consents-stat--ok"><strong>' + accepted + '</strong> onayladı</span>' +
      '<span class="consents-stat consents-stat--pending"><strong>' + pending + '</strong> onaylamadı</span>' +
      '<span class="consents-stat"><strong>' + noAccount + '</strong> hesabı yok</span>';
  }

  function updateSortHeaders() {
    document.querySelectorAll("[data-sort]").forEach(function (th) {
      var col = th.getAttribute("data-sort");
      var label = SORT_LABELS[col] || col;
      var isActive = sortColumn === col;
      th.textContent = label + (isActive ? (sortDir === "asc" ? " ▲" : " ▼") : "");
      th.classList.toggle("is-sorted", isActive);
    });
  }

  async function resetConsent(item) {
    if (!isAdmin) return;
    var ok = window.confirm(
      item.memberName + " için KVKK/gizlilik onayı sıfırlanacak.\n" +
      "Üye bir sonraki girişte tekrar onay ekranı görecek. Devam edilsin mi?"
    );
    if (!ok) return;
    try {
      await window.API.resetMemberConsent(item.id);
      item.consentAccepted = false;
      item.consentAcceptedAt = null;
      renderItems();
    } catch (e) {
      window.alert((e && e.data && e.data.error) || (e && e.message) || "Onay sıfırlanamadı.");
    }
  }

  function statusBadgeHtml(item) {
    if (!item.hasAccount) return '<span class="hint">Hesap yok</span>';
    return item.consentAccepted
      ? '<span class="consent-status-badge consent-status-badge--ok">Onayladı</span>'
      : '<span class="consent-status-badge consent-status-badge--pending">Onaylamadı</span>';
  }

  function actionHtml(item) {
    if (!isAdmin || !item.hasAccount || !item.consentAccepted) return "";
    return '<button type="button" class="btn btn--xs btn--ghost" data-reset-consent>Onayı Sıfırla</button>';
  }

  function bindRowAction(el, item) {
    var btn = el.querySelector("[data-reset-consent]");
    if (btn) btn.addEventListener("click", function () { resetConsent(item); });
  }

  function renderCards(items) {
    var cardsEl = document.getElementById("consentsCards");
    if (!cardsEl) return;
    cardsEl.innerHTML = "";
    if (!items.length) {
      cardsEl.innerHTML = '<div class="hint activity-logs-empty-hint">Kayıt yok.</div>';
      return;
    }
    items.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "activity-logs-card";
      card.innerHTML =
        '<div class="activity-logs-card__when">' + escapeHtml(item.memberName) + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Üye No:</span> ' + escapeHtml(item.memberNo || "—") + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Telefon:</span> ' + escapeHtml(item.phone || "—") + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Durum:</span> ' + statusBadgeHtml(item) + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Onay Tarihi:</span> ' + escapeHtml(fmtDate(item.consentAcceptedAt)) + "</div>" +
        '<div class="activity-logs-card__row">' + actionHtml(item) + "</div>";
      bindRowAction(card, item);
      cardsEl.appendChild(card);
    });
  }

  function renderTableRows(items) {
    var tbody = document.getElementById("consentsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="activity-logs-table__status-cell">Kayıt yok.</td></tr>';
      return;
    }
    items.forEach(function (item) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(item.memberNo || "—") + "</td>" +
        "<td>" + escapeHtml(item.memberName) + "</td>" +
        "<td>" + escapeHtml(item.phone || "—") + "</td>" +
        "<td>" + (item.hasAccount ? "Var" : "Yok") + "</td>" +
        "<td>" + statusBadgeHtml(item) + "</td>" +
        "<td>" + escapeHtml(fmtDate(item.consentAcceptedAt)) + "</td>" +
        "<td>" + actionHtml(item) + "</td>";
      bindRowAction(tr, item);
      tbody.appendChild(tr);
    });
  }

  function renderItems() {
    updateLayout();
    renderStats();
    updateSortHeaders();
    var items = filteredItems();
    if (isMobileView()) renderCards(items);
    else renderTableRows(items);
  }

  function loadConsents() {
    if (!window.API || !window.API.getMembersConsentStatus) return;
    var tbody = document.getElementById("consentsTableBody");
    var cardsEl = document.getElementById("consentsCards");
    var errEl = document.getElementById("consentsError");
    if (errEl) { errEl.classList.add("hidden"); errEl.textContent = ""; }
    updateLayout();
    if (isMobileView() && cardsEl) {
      cardsEl.innerHTML = '<div class="hint activity-logs-empty-hint">Yükleniyor…</div>';
    } else if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="activity-logs-table__status-cell">Yükleniyor…</td></tr>';
    }
    window.API.getMembersConsentStatus().then(function (data) {
      allItems = (data && data.items) || [];
      consentVersion = (data && data.consentVersion) || "";
      renderItems();
    }).catch(function (err) {
      if (tbody) tbody.innerHTML = "";
      if (cardsEl) cardsEl.innerHTML = "";
      if (errEl) {
        errEl.textContent = (err && (err.message || err.error)) || "Onay durumu yüklenemedi.";
        errEl.classList.remove("hidden");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.API || !window.API.getToken()) {
      window.location.href = "./index.html";
      return;
    }
    var closeBtn = document.getElementById("consentsCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        if (window.opener) window.close();
        else window.location.href = "./index.html";
      });
    }
    var searchEl = document.getElementById("consentsSearchInput");
    if (searchEl) searchEl.addEventListener("input", renderItems);
    var statusEl = document.getElementById("consentsStatusFilter");
    if (statusEl) statusEl.addEventListener("change", renderItems);
    MOBILE_MQ.addEventListener("change", renderItems);
    document.querySelectorAll("[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var col = th.getAttribute("data-sort");
        if (sortColumn === col) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortColumn = col; sortDir = "asc"; }
        renderItems();
      });
    });

    if (window.API && window.API.getMe) {
      window.API.getMe().then(function (me) {
        isAdmin = !!(me && me.role === "admin");
        loadConsents();
      }).catch(function () {
        loadConsents();
      });
    } else {
      loadConsents();
    }
  });
})();
