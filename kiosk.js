/* Kapı girişi kiosk ekranı — USB QR okuyucu (klavye-wedge) ile çalışır. */
(function () {
  var RESET_DELAY_MS = 4000;
  var PHONE_IDLE_MS = 15000;
  var MAX_PHONE_DIGITS = 10;

  var iconEl = document.getElementById('kioskIcon');
  var titleEl = document.getElementById('kioskTitle');
  var nameEl = document.getElementById('kioskName');
  var subtitleEl = document.getElementById('kioskSubtitle');
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
      setFailure(INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası, tekrar deneyin');
    }
  }

  /* ─── Ekran durumları ───────────────────────────────────────────────────── */

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
    kioskPhoneBtn.style.display = 'none';
  }

  var DOOR_CONTROL_URL = 'http://127.0.0.1:7000/open';

  function triggerDoor() {
    fetch(DOOR_CONTROL_URL, { method: 'POST' }).catch(function () {});
  }

  function setSuccess(memberName, checkIn, source, packageStats) {
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

    var lines = [];
    if (checkIn && checkIn.isStaff) {
      // personel/admin girişi — ek mesaj yok
    } else if (checkIn && checkIn.ok) {
      lines.push('Seansınıza giriş kaydedildi');
    } else {
      lines.push('Bugün için planlı bir seansınız yok');
    }
    if ((source === 'phone' || source === 'card') && packageStats && packageStats.totalSessions) {
      lines.push(packageStats.totalSessions + ' Seans Paketinizden Kalan : ' + packageStats.remainingSessions);
    }
    if (lines.length > 0) {
      subtitleEl.textContent = lines.join('\n');
      subtitleEl.removeAttribute('hidden');
    } else {
      subtitleEl.setAttribute('hidden', '');
    }

    kioskPhoneBtn.style.display = 'none';
    scheduleReset();
  }

  function setFailure(message) {
    iconEl.removeAttribute('hidden');
    iconEl.className = 'kiosk__icon is-fail';
    iconEl.textContent = '✕';
    titleEl.textContent = 'Giriş doğrulanamadı';
    nameEl.setAttribute('hidden', '');
    subtitleEl.textContent = message || 'Lütfen tekrar deneyin';
    subtitleEl.removeAttribute('hidden');
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
      setFailure(INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası, tekrar deneyin');
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

  /* ─── Saat ──────────────────────────────────────────────────────────────── */

  function tickClock() {
    var now = new Date();
    clockEl.textContent =
      now.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }) +
      ' — ' +
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 30000);

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
