/* Kapı girişi kiosk ekranı — USB QR okuyucu (klavye-wedge) ile çalışır. */
(function () {
  var RESET_DELAY_MS = 4000;
  var PHONE_IDLE_MS = 15000;
  var MAX_PHONE_DIGITS = 10;

  var iconEl = document.getElementById('kioskIcon');
  var titleEl = document.getElementById('kioskTitle');
  var nameEl = document.getElementById('kioskName');
  var subtitleEl = document.getElementById('kioskSubtitle');
  var headerRowEl = document.getElementById('kioskHeaderRow');
  var kioskBottomEl = document.getElementById('kioskBottom');
  var pkgNameEl = document.getElementById('kioskPkgName');
  var pkgRemainingEl = document.getElementById('kioskPkgRemaining');
  var clockEl = document.getElementById('kioskClock');
  var inputEl = document.getElementById('kioskInput');
  var phoneOverlay = document.getElementById('phoneOverlay');
  var phoneDisplay = document.getElementById('phoneDisplay');
  var phonePad = document.getElementById('phonePad');
  var phoneConfirm = document.getElementById('phoneConfirm');
  var phoneBackspace = document.getElementById('phoneBackspace');
  var phoneTimerBar = document.getElementById('phoneTimerBar');
  var phoneCancelBtn = document.getElementById('phoneCancelBtn');
  var kioskPhoneBtn = document.getElementById('kioskPhoneBtn');

  var phoneEntry = false;
  var phoneDigitsBuf = [];

  var resetTimer = null;
  var phoneIdleTimer = null;
  var busy = false;

  var INVALID_REASON_MESSAGES = {
    expired: 'QR kodunun süresi doldu. Üye portalından kodu yenileyip tekrar deneyin.',
    empty: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    format: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    parse: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    invalid_sig: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
    member_mismatch: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
    not_found: 'Bu telefon numarasına kayıtlı üye bulunamadı.',
    card_not_found: 'Bu karta kayıtlı üye bulunamadı.',
  };

  /* ─── Telefon ekranı gösterimi ─────────────────────────────────────────── */

  function updatePhoneDisplay() {
    var d = phoneDigitsBuf;
    function g(i) { return i < d.length ? d[i] : '_'; }
    phoneDisplay.textContent =
      '0(' + g(0) + ' ' + g(1) + ' ' + g(2) + ') ' +
      g(3) + ' ' + g(4) + ' ' + g(5) + ' - ' +
      g(6) + ' ' + g(7) + ' - ' +
      g(8) + ' ' + g(9);
    phoneConfirm.disabled = d.length !== MAX_PHONE_DIGITS;
  }

  /* ─── 15 saniyelik hareketsizlik sayacı ────────────────────────────────── */

  function startPhoneIdleTimer() {
    clearPhoneIdleTimer();
    phoneTimerBar.classList.remove('is-running');
    void phoneTimerBar.offsetWidth; // reflow — animasyonu sıfırla
    phoneTimerBar.classList.add('is-running');
    phoneIdleTimer = setTimeout(function () {
      closePhoneOverlay();
      setIdle();
    }, PHONE_IDLE_MS);
  }

  function clearPhoneIdleTimer() {
    if (phoneIdleTimer) { clearTimeout(phoneIdleTimer); phoneIdleTimer = null; }
    phoneTimerBar.classList.remove('is-running');
  }

  /* ─── Telefon overlay aç / kapat ───────────────────────────────────────── */

  function openPhoneOverlay() {
    phoneDigitsBuf = [];
    updatePhoneDisplay();
    phoneEntry = true;
    phoneOverlay.removeAttribute('hidden');
    startPhoneIdleTimer();
  }

  function closePhoneOverlay() {
    phoneEntry = false;
    phoneOverlay.setAttribute('hidden', '');
    phoneDigitsBuf = [];
    clearPhoneIdleTimer();
  }

  /* ─── Telefon ile giriş ─────────────────────────────────────────────────── */

  async function handlePhoneAccess(rawDigits) {
    closePhoneOverlay();
    setBusy();
    try {
      var result = await window.API.verifyMemberPhoneAccess(rawDigits);
      if (result && result.valid) {
        triggerDoor();
        setSuccess(result.memberName, result.checkIn, 'phone', result.packageStats);
      } else {
        setFailure(INVALID_REASON_MESSAGES[result && result.reason] || 'Lütfen tekrar deneyin');
      }
    } catch (err) {
      var reason = err && err.data && err.data.reason;
      var detail = err && err.message ? err.message : '';
      var status = err && err.status ? ' [' + err.status + ']' : '';
      setFailure((INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası') + (detail ? '\n' + detail + status : status));
    }
  }

  /* ─── Ekran durumları ───────────────────────────────────────────────────── */

  function hideBottom() {
    if (kioskBottomEl) kioskBottomEl.setAttribute('hidden', '');
    if (pkgNameEl) pkgNameEl.textContent = '';
    if (pkgRemainingEl) pkgRemainingEl.textContent = '';
  }

  function showBottom(pkgName, remaining) {
    if (!kioskBottomEl) return;
    if (pkgNameEl) pkgNameEl.textContent = pkgName;
    if (pkgRemainingEl) pkgRemainingEl.textContent = 'Kalan Seans : ' + remaining;
    kioskBottomEl.removeAttribute('hidden');
  }

  function setHeaderInline() {
    if (headerRowEl) {
      headerRowEl.classList.remove('kiosk__header-row--stacked');
    }
  }

  function setHeaderStacked() {
    if (headerRowEl) {
      headerRowEl.classList.add('kiosk__header-row--stacked');
    }
  }

  function setIdle() {
    busy = false;
    iconEl.setAttribute('hidden', '');
    iconEl.className = 'kiosk__icon';
    iconEl.textContent = '';
    titleEl.textContent = 'HOŞGELDİNİZ';
    nameEl.setAttribute('hidden', '');
    nameEl.textContent = '';
    subtitleEl.setAttribute('hidden', '');
    subtitleEl.textContent = '';
    setHeaderStacked();
    hideBottom();
    kioskPhoneBtn.style.display = '';
    focusInput();
  }

  function setBusy() {
    busy = true;
    iconEl.removeAttribute('hidden');
    iconEl.className = 'kiosk__icon';
    iconEl.textContent = '⏳';
    titleEl.textContent = 'Kontrol ediliyor…';
    nameEl.setAttribute('hidden', '');
    subtitleEl.setAttribute('hidden', '');
    setHeaderInline();
    hideBottom();
    kioskPhoneBtn.style.display = 'none';
  }

  var DOOR_CONTROL_URL = 'http://127.0.0.1:7000/open';

  function triggerDoor() {
    fetch(DOOR_CONTROL_URL, { method: 'POST' }).catch(function () {});
  }

  function setSuccess(memberName, checkIn, source, packageStats) {
    // İkon + HOŞGELDİNİZ yan yana
    setHeaderInline();
    iconEl.removeAttribute('hidden');
    iconEl.className = 'kiosk__icon is-ok';
    iconEl.textContent = '✓';
    titleEl.textContent = 'HOŞGELDİNİZ';

    if (memberName) {
      nameEl.textContent = memberName.toLocaleUpperCase('tr-TR');
      nameEl.removeAttribute('hidden');
    } else {
      nameEl.setAttribute('hidden', '');
    }

    if (checkIn && checkIn.isStaff) {
      subtitleEl.setAttribute('hidden', '');
    } else if (checkIn && checkIn.ok) {
      subtitleEl.textContent = 'Seansınıza Giriş Kaydedildi';
      subtitleEl.removeAttribute('hidden');
    } else {
      subtitleEl.textContent = 'Bugün için planlı bir seansınız yok';
      subtitleEl.removeAttribute('hidden');
    }

    // Alt panel: paket adı + kalan seans
    if ((source === 'phone' || source === 'card') && packageStats && packageStats.totalSessions) {
      var pkgName = packageStats.packageName || (packageStats.totalSessions + ' Seans Paketi');
      showBottom(pkgName, packageStats.remainingSessions);
    } else {
      hideBottom();
    }

    kioskPhoneBtn.style.display = 'none';
    scheduleReset();
  }

  function setFailure(message) {
    setHeaderInline();
    iconEl.removeAttribute('hidden');
    iconEl.className = 'kiosk__icon is-fail';
    iconEl.textContent = '✕';
    titleEl.textContent = 'Giriş doğrulanamadı';
    nameEl.setAttribute('hidden', '');
    subtitleEl.textContent = message || 'Lütfen tekrar deneyin';
    subtitleEl.removeAttribute('hidden');
    hideBottom();
    kioskPhoneBtn.style.display = 'none';
    scheduleReset();
  }

  function scheduleReset() {
    busy = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(setIdle, RESET_DELAY_MS);
  }

  function focusInput() {
    inputEl.value = '';
    inputEl.focus();
  }

  /* ─── QR okuyucu karakter düzeltmesi ───────────────────────────────────── */
  // USB QR okuyucu klavye düzeni farkı nedeniyle bazı sembolleri farklı üretiyor.
  var SCANNER_CHAR_FIX = { '`': '"', '?': ':', '\\': ',', '/': '.', "'": 'i' };

  function fixScannerChars(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += SCANNER_CHAR_FIX[str[i]] || str[i];
    }
    return out;
  }

  function extractToken(raw) {
    var value = (raw || '').trim();
    if (!value) return '';
    try {
      var payload = JSON.parse(value);
      if (payload && typeof payload.t === 'string') return payload.t;
    } catch (_) {}
    try {
      var fixed = fixScannerChars(value);
      if (fixed.charAt(0) !== '{') fixed = '{' + fixed + '}';
      var payload2 = JSON.parse(fixed);
      if (payload2 && typeof payload2.t === 'string') return payload2.t;
    } catch (_) {}
    return value;
  }

  /* ─── QR / kart tarama ──────────────────────────────────────────────────── */

  async function handleScan(raw) {
    var value = (raw || '').trim();
    if (!value) { setFailure(INVALID_REASON_MESSAGES.empty || 'Lütfen tekrar deneyin'); return; }

    var token = extractToken(raw);
    // JSON {"t":"..."} formatından çözümlendiyse QR, aksi hâlde RFID kart numarası
    var isQrToken = token !== value;

    setBusy();
    try {
      var result = isQrToken
        ? await window.API.verifyMemberAccess(token)
        : await window.API.verifyMemberCardAccess(value);
      if (result && result.valid) {
        triggerDoor();
        setSuccess(result.memberName, result.checkIn, isQrToken ? 'qr' : 'card', result.packageStats);
      } else {
        setFailure(INVALID_REASON_MESSAGES[result && result.reason] || 'Lütfen tekrar deneyin');
      }
    } catch (err) {
      var reason = err && err.data && err.data.reason;
      var detail = err && err.message ? err.message : '';
      var status = err && err.status ? ' [' + err.status + ']' : '';
      setFailure((INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası') + (detail ? '\n' + detail + status : status));
    }
  }

  /* ─── Olay dinleyicileri ────────────────────────────────────────────────── */

  phonePad.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-digit]');
    if (btn && phoneDigitsBuf.length < MAX_PHONE_DIGITS) {
      phoneDigitsBuf.push(btn.dataset.digit);
      updatePhoneDisplay();
      startPhoneIdleTimer(); // her tuş vuruşu sayacı sıfırlar
    }
  });

  phoneBackspace.addEventListener('click', function () {
    if (phoneDigitsBuf.length > 0) {
      phoneDigitsBuf.pop();
      updatePhoneDisplay();
      startPhoneIdleTimer();
    }
  });

  phoneConfirm.addEventListener('click', function () {
    if (phoneConfirm.disabled) return;
    handlePhoneAccess(phoneDigitsBuf.join(''));
  });

  phoneCancelBtn.addEventListener('click', function () {
    closePhoneOverlay();
    setIdle();
  });

  kioskPhoneBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (!busy) openPhoneOverlay();
  });

  inputEl.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    if (busy) { inputEl.value = ''; return; }
    var raw = inputEl.value;
    inputEl.value = '';
    handleScan(raw);
  });

  inputEl.addEventListener('blur', function () {
    if (phoneEntry) return;
    setTimeout(focusInput, 50);
  });

  document.addEventListener('click', function () {
    if (!phoneEntry) focusInput();
  });

  /* ─── Saat & sunucu bağlantı kontrolü ──────────────────────────────────── */

  var serverOnline = false;

  function tickClock() {
    if (!serverOnline) {
      clockEl.textContent = 'Sunucuya bağlanılamıyor…';
      return;
    }
    var now = new Date();
    clockEl.textContent =
      now.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }) +
      ' — ' +
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function checkServer() {
    // API base'den /health URL'i türet: ".../api" → ".../health"
    var base = (window.__API_BASE__ || '').replace(/\/api\/?$/, '');
    var healthUrl = base ? base + '/health' : '/health';
    fetch(healthUrl, { method: 'GET', cache: 'no-store' })
      .then(function (r) {
        var wasOffline = !serverOnline;
        serverOnline = r.ok;
        if (wasOffline && serverOnline) tickClock();
        else if (!serverOnline) tickClock();
      })
      .catch(function () {
        serverOnline = false;
        tickClock();
      });
  }

  checkServer();
  setInterval(checkServer, 30000);
  setInterval(tickClock, 30000);

  /* ─── Ekran uyanık tutma (07:30–22:00) ─────────────────────────────────── */
  var WAKE_START_MIN = 7 * 60 + 30;  // 07:30
  var WAKE_END_MIN   = 22 * 60;       // 22:00
  var wakeLock = null;

  function isWakeHours() {
    var now = new Date();
    var m = now.getHours() * 60 + now.getMinutes();
    return m >= WAKE_START_MIN && m < WAKE_END_MIN;
  }

  function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock && !wakeLock.released) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
    }).catch(function () {});
  }

  function releaseWakeLock() {
    if (wakeLock && !wakeLock.released) {
      wakeLock.release().catch(function () {});
    }
    wakeLock = null;
  }

  function syncWakeLock() {
    if (isWakeHours()) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }

  syncWakeLock();
  // Sayfa tekrar görünür olduğunda kilit yeniden alınır (tarayıcı gizlendikten sonra otomatik bırakır)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') syncWakeLock();
  });
  // Her dakika sınır geçişini (07:30 / 22:00) yakala
  setInterval(syncWakeLock, 60000);

  /* ─── Her saat :30'da otomatik yenileme ────────────────────────────────── */
  (function scheduleReload() {
    var now = new Date();
    var next = new Date(now);
    next.setSeconds(0, 0);
    if (now.getMinutes() < 30) {
      next.setMinutes(30);
    } else {
      next.setHours(now.getHours() + 1);
      next.setMinutes(30);
    }
    var msUntilNext = next - now;
    setTimeout(function () {
      if (!busy && !phoneEntry) {
        location.reload(true);
      } else {
        // İşlem devam ediyorsa 5 dk sonra tekrar dene
        setTimeout(function () { location.reload(true); }, 5 * 60 * 1000);
      }
    }, msUntilNext);
  })();

  setIdle();
})();
