(function () {
  var currentPage = 1;
  var totalPages = 1;
  var total = 0;
  var MOBILE_MQ = window.matchMedia("(max-width: 767px)");

  var broadcastDateFmt = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  function fmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '—' : broadcastDateFmt.format(d);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isMobile() { return MOBILE_MQ.matches; }

  function updateLayout() {
    var cards = document.getElementById('broadcastsCards');
    var wrap = document.getElementById('broadcastsTableWrap');
    var mobile = isMobile();
    if (cards) cards.classList.toggle('hidden', !mobile);
    if (wrap) wrap.classList.toggle('hidden', mobile);
  }

  function renderCards(items) {
    var el = document.getElementById('broadcastsCards');
    if (!el) return;
    el.innerHTML = '';
    if (!items.length) {
      el.innerHTML = '<div class="hint activity-logs-empty-hint">Henüz bildirim gönderilmemiş.</div>';
      return;
    }
    items.forEach(function (row) {
      var card = document.createElement('article');
      card.className = 'activity-logs-card';
      card.innerHTML =
        '<div class="activity-logs-card__when">' + escapeHtml(fmtDate(row.created_at)) + '</div>' +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Gönderen:</span> ' + escapeHtml(row.sent_by_name || '—') + '</div>' +
        '<div class="activity-logs-card__row"><span class="activity-logs-card__label">Başlık:</span> ' + escapeHtml(row.title) + '</div>' +
        '<div class="activity-logs-card__details">' + escapeHtml(row.body) + '</div>' +
        '<div class="activity-logs-card__row" style="gap:12px;flex-wrap:wrap;">' +
        '<span>Seçilen: <strong>' + escapeHtml(String(row.total_selected)) + '</strong></span>' +
        '<span style="color:var(--color-ok,#2ecc71)">İletildi: <strong>' + escapeHtml(String(row.total_sent)) + '</strong></span>' +
        (row.total_no_token > 0 ? '<span style="color:var(--color-muted,#8890a0)">Ulaşılamadı: ' + escapeHtml(String(row.total_no_token)) + '</span>' : '') +
        '</div>';
      el.appendChild(card);
    });
  }

  function renderTableRows(items) {
    var tbody = document.getElementById('broadcastsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="activity-logs-table__status-cell">Henüz bildirim gönderilmemiş.</td></tr>';
      return;
    }
    items.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(fmtDate(row.created_at)) + '</td>' +
        '<td>' + escapeHtml(row.sent_by_name || '—') + '</td>' +
        '<td>' + escapeHtml(row.title) + '</td>' +
        '<td class="activity-logs-table__details-cell" title="' + escapeHtml(row.body) + '">' + escapeHtml(row.body) + '</td>' +
        '<td style="text-align:center;">' + escapeHtml(String(row.total_selected)) + '</td>' +
        '<td style="text-align:center;color:var(--color-ok,#2ecc71)">' + escapeHtml(String(row.total_sent)) + '</td>' +
        '<td style="text-align:center;">' + escapeHtml(String(row.total_no_token || 0)) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderItems(items) {
    updateLayout();
    if (isMobile()) renderCards(items);
    else renderTableRows(items);
  }

  function loadBroadcasts(page) {
    if (!window.API || !window.API.getBroadcasts) return;
    var tbody = document.getElementById('broadcastsTableBody');
    var cards = document.getElementById('broadcastsCards');
    var errEl = document.getElementById('broadcastsError');
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
    updateLayout();
    if (isMobile() && cards) cards.innerHTML = '<div class="hint activity-logs-empty-hint">Yükleniyor…</div>';
    else if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="activity-logs-table__status-cell">Yükleniyor…</td></tr>';

    window.API.getBroadcasts(page || 1, 20).then(function (data) {
      var items = (data && data.items) || [];
      currentPage = data.page || 1;
      totalPages = data.totalPages || 1;
      total = data.total || 0;
      renderItems(items);
      renderPagination();
    }).catch(function (err) {
      if (tbody) tbody.innerHTML = '';
      if (cards) cards.innerHTML = '';
      if (errEl) {
        errEl.textContent = (err && (err.message || err.error)) || 'Geçmiş yüklenemedi.';
        errEl.classList.remove('hidden');
      }
      renderPagination(true);
    });
  }

  function renderPagination(clear) {
    var el = document.getElementById('broadcastsPagination');
    if (!el) return;
    el.innerHTML = '';
    if (clear) return;
    el.appendChild(document.createTextNode('Toplam ' + total + ' kayıt. Sayfa ' + currentPage + ' / ' + (totalPages || 1) + ' '));
    if (currentPage > 1) {
      var prev = document.createElement('button');
      prev.className = 'btn btn--ghost'; prev.type = 'button'; prev.textContent = 'Önceki';
      prev.addEventListener('click', function () { loadBroadcasts(currentPage - 1); });
      el.appendChild(prev);
    }
    if (currentPage < totalPages) {
      var next = document.createElement('button');
      next.className = 'btn btn--ghost'; next.type = 'button'; next.textContent = 'Sonraki';
      next.addEventListener('click', function () { loadBroadcasts(currentPage + 1); });
      el.appendChild(next);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.API || !window.API.getToken()) {
      window.location.href = './index.html';
      return;
    }
    var closeBtn = document.getElementById('broadcastsCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (window.opener) window.close();
        else window.location.href = './index.html';
      });
    }
    MOBILE_MQ.addEventListener('change', function () { loadBroadcasts(currentPage); });
    loadBroadcasts(1);
  });
})();
