(function () {
  var currentPage = 1;
  var totalPages = 1;
  var total = 0;
  var MOBILE_LOGS_MQ = window.matchMedia("(max-width: 767px)");

  var actionLabels = {
    "auth.login": "Giriş",
    "auth.login_failed": "Giriş başarısız",
    "auth.set_password": "İlk şifre belirleme",
    "auth.change_password": "Şifre değiştirme",
    "member.create": "Üye ekleme",
    "member.update": "Üye güncelleme",
    "member.delete": "Üye silme",
    "member.delete_permanent": "Üye tam silme",
    "member.reset_consent": "KVKK/gizlilik onayı sıfırlama",
    "member.request_deletion": "Üyelik iptal talebi",
    "member.approve_deletion_request": "Üyelik iptali onayı",
    "member.reject_deletion_request": "Üyelik iptal talebi reddi",
    "session.create": "Seans ekleme",
    "session.update": "Seans güncelleme",
    "session.delete": "Seans silme",
    "session.delete_bulk": "Grup seans silme",
    "session.cancel_by_member": "Üye seans iptali",
    "session.check_in_qr": "QR ile giriş",
    "session.attendance_confirm": "Seans giriş onayı",
    "room.create": "Oda ekleme",
    "room.update": "Oda güncelleme",
    "room.delete": "Oda silme",
    "staff.create": "Personel ekleme",
    "staff.update": "Personel güncelleme",
    "staff.reset_password": "Personel şifre sıfırlama",
    "staff.delete": "Personel silme",
    "package.create": "Paket ekleme",
    "package.update": "Paket güncelleme",
    "package.delete": "Paket silme",
    "member_package.create": "Üye paketi ekleme",
    "member_package.update": "Üye paketi güncelleme",
    "member_package.end": "Üye paketi sonlandırma",
    "settings.working_hours_update": "Çalışma saatleri güncelleme",
    "dev_reset": "Test – veritabanı sıfırlama"
  };

  var entityTypeLabels = {
    session: "Seans",
    member: "Üye",
    room: "Oda",
    staff: "Personel",
    package: "Paket",
    member_package: "Üye paketi",
    settings: "Ayarlar",
    user: "Kullanıcı",
    database: "Veritabanı"
  };

  var webLogDateFmt = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function fmtLogDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '—' : webLogDateFmt.format(d);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function actionLabel(action) {
    return actionLabels[action] || action || "—";
  }

  function formatEntity(entityType, entityId) {
    if (!entityType) return "—";
    var label = entityTypeLabels[entityType] || entityType;
    if (entityId != null && entityId !== "") return label + " #" + entityId;
    return label;
  }

  function formatDetails(details, action) {
    if (!details) return "—";
    if (typeof details === "string") return details;
    if (typeof details === "object") {
      if (action === "session.attendance_confirm") {
        var outcome =
          details.action === "present"
            ? "Geldi"
            : details.action === "no_show"
              ? "Gelmedi"
              : details.outcome || "—";
        var member =
          details.memberName ||
          (details.memberId != null ? "Üye #" + details.memberId : "");
        var by = details.confirmedByAdmin
          ? "Yönetici"
          : details.role === "staff"
            ? "Personel"
            : details.role || "";
        var parts = [outcome];
        if (member) parts.push(member);
        if (by) parts.push("(" + by + ")");
        if (details.override) parts.push("[düzenleme]");
        return parts.join(" · ");
      }
      if (action === "session.check_in_qr") {
        var qrMember =
          details.memberName ||
          (details.memberId != null ? "Üye #" + details.memberId : "");
        return qrMember ? "QR · " + qrMember : "QR giriş";
      }
      try {
        var text = JSON.stringify(details);
        return text.length > 160 ? text.slice(0, 157) + "…" : text;
      } catch (_) {
        return "—";
      }
    }
    return String(details);
  }

  function isMobileLogsView() {
    return MOBILE_LOGS_MQ.matches;
  }

  function updateLogsLayout() {
    var cardsEl = document.getElementById("activityLogsCards");
    var tableWrap = document.getElementById("activityLogsTableWrap");
    var mobile = isMobileLogsView();
    if (cardsEl) cardsEl.classList.toggle("hidden", !mobile);
    if (tableWrap) tableWrap.classList.toggle("hidden", mobile);
  }

  function renderLogCards(items) {
    var cardsEl = document.getElementById("activityLogsCards");
    if (!cardsEl) return;
    cardsEl.innerHTML = "";
    if (!items.length) {
      cardsEl.innerHTML = '<div class="hint activity-logs-empty-hint">Kayıt yok.</div>';
      return;
    }
    items.forEach(function (row) {
      var created = fmtLogDate(row.created_at);
      var who = row.actor_display || row.actor_name || (row.actor_type === "user" ? "Kullanıcı #" + (row.actor_id || "?") : row.actor_type) || "—";
      var entity = row.entity_display || formatEntity(row.entity_type, row.entity_id);
      var details = row.details_display || formatDetails(row.details, row.action);
      var card = document.createElement("article");
      card.className = "activity-logs-card";
      card.innerHTML =
        '<div class="activity-logs-card__when">' + escapeHtml(created) + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Kim:</span> ' + escapeHtml(who) + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">İşlem:</span> ' + escapeHtml(actionLabel(row.action)) + "</div>" +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Varlık:</span> ' + escapeHtml(entity) + "</div>" +
        (details !== "—" ? '<div class="activity-logs-card__details">' + escapeHtml(details) + "</div>" : "");
      cardsEl.appendChild(card);
    });
  }

  function renderLogTableRows(items) {
    var tbody = document.getElementById("activityLogsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="activity-logs-table__status-cell">Kayıt yok.</td></tr>';
      return;
    }
    items.forEach(function (row) {
      var tr = document.createElement("tr");
      var created = fmtLogDate(row.created_at);
      var who = row.actor_display || row.actor_name || (row.actor_type === "user" ? "Kullanıcı #" + (row.actor_id || "?") : row.actor_type) || "—";
      var entity = row.entity_display || formatEntity(row.entity_type, row.entity_id);
      var details = row.details_display || formatDetails(row.details, row.action);
      tr.innerHTML =
        "<td>" + escapeHtml(created) + "</td>" +
        "<td>" + escapeHtml(who) + "</td>" +
        "<td>" + escapeHtml(actionLabel(row.action)) + "</td>" +
        "<td>" + escapeHtml(entity) + "</td>" +
        '<td class="activity-logs-table__details-cell" title="' + escapeHtml(details) + '">' + escapeHtml(details) + "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderLogsItems(items) {
    updateLogsLayout();
    if (isMobileLogsView()) renderLogCards(items);
    else renderLogTableRows(items);
  }

  function loadLogs(page) {
    if (!window.API || !window.API.getActivityLogs) return;
    var tbody = document.getElementById("activityLogsTableBody");
    var cardsEl = document.getElementById("activityLogsCards");
    var errEl = document.getElementById("activityLogsError");
    var filterEl = document.getElementById("activityLogsActionFilter");
    var fromEl = document.getElementById("activityLogsFrom");
    var toEl = document.getElementById("activityLogsTo");
    var params = { page: page || 1, limit: 50 };
    if (filterEl && filterEl.value) params.action = filterEl.value;
    if (fromEl && fromEl.value) params.from = fromEl.value;
    if (toEl && toEl.value) params.to = toEl.value;

    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    updateLogsLayout();
    if (isMobileLogsView() && cardsEl) {
      cardsEl.innerHTML = '<div class="hint activity-logs-empty-hint">Yükleniyor…</div>';
    } else if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="activity-logs-table__status-cell">Yükleniyor…</td></tr>';
    }

    window.API.getActivityLogs(params).then(function (data) {
      var items = (data && data.items) || [];
      var pagination = (data && data.pagination) || {};
      currentPage = pagination.page || 1;
      totalPages = pagination.totalPages || 1;
      total = pagination.total || 0;
      renderLogsItems(items);
      renderPagination();
    }).catch(function (err) {
      if (tbody) tbody.innerHTML = "";
      if (cardsEl) cardsEl.innerHTML = "";
      if (errEl) {
        errEl.textContent = (err && (err.message || err.error)) || "Loglar yüklenemedi.";
        errEl.classList.remove("hidden");
      }
      renderPagination(true);
    });
  }

  function renderPagination(clear) {
    var pagEl = document.getElementById("activityLogsPagination");
    if (!pagEl) return;
    pagEl.innerHTML = "";
    if (clear) return;
    pagEl.appendChild(document.createTextNode("Toplam " + total + " kayıt. Sayfa " + currentPage + " / " + (totalPages || 1) + " "));
    if (currentPage > 1) {
      var prevBtn = document.createElement("button");
      prevBtn.className = "btn btn--ghost";
      prevBtn.type = "button";
      prevBtn.textContent = "Önceki";
      prevBtn.addEventListener("click", function () { loadLogs(currentPage - 1); });
      pagEl.appendChild(prevBtn);
    }
    if (currentPage < totalPages) {
      var nextBtn = document.createElement("button");
      nextBtn.className = "btn btn--ghost";
      nextBtn.type = "button";
      nextBtn.textContent = "Sonraki";
      nextBtn.addEventListener("click", function () { loadLogs(currentPage + 1); });
      pagEl.appendChild(nextBtn);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.API || !window.API.getToken()) {
      window.location.href = "./index.html";
      return;
    }
    var closeBtn = document.getElementById("logsCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        if (window.opener) window.close();
        else window.location.href = "./index.html";
      });
    }
    var applyBtn = document.getElementById("activityLogsApplyFilterBtn");
    if (applyBtn) applyBtn.addEventListener("click", function () { loadLogs(1); });
    MOBILE_LOGS_MQ.addEventListener("change", function () {
      loadLogs(currentPage);
    });
    loadLogs(1);
  });
})();
