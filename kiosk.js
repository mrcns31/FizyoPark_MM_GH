/* Kapı girişi kiosk ekranı — USB QR okuyucu (klavye-wedge) ile çalışır. */
(function () {
  var RESET_DELAY_MS = 4000;

  var iconEl = document.getElementById('kioskIcon');
  var titleEl = document.getElementById('kioskTitle');
  var subtitleEl = document.getElementById('kioskSubtitle');
  var clockEl = document.getElementById('kioskClock');
  var inputEl = document.getElementById('kioskInput');
  var phoneOverlay = document.getElementById('phoneOverlay');
  var phoneDisplay = document.getElementById('phoneDisplay');
  var phonePad = document.getElementById('phonePad');
  var phoneConfirm = document.getElementById('phoneConfirm');
  var phoneBackspace = document.getElementById('phoneBackspace');
  var phoneCancelBtn = document.getElementById('phoneCancelBtn');
  var kioskPhoneBtn = document.getElementById('kioskPhoneBtn');

  var phoneEntry = false;
  var phoneDigitsBuf = [];
  var MAX_PHONE_DIGITS = 11;

  var resetTimer = null;
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

  function updatePhoneDisplay() {
    var digits = phoneDigitsBuf.join('');
    var display = '';
    var len = Math.min(digits.length, MAX_PHONE_DIGITS);
    for (var i = 0; i < 10; i++) {
      display += i < len ? digits[i] : '_';
      if (i === 2 || i === 5 || i === 7) display += ' ';
    }
    phoneDisplay.textContent = display;
    var count = phoneDigitsBuf.length;
    phoneConfirm.disabled = !(count >= 10 && count <= MAX_PHONE_DIGITS);
  }

  function openPhoneOverlay() {
    phoneDigitsBuf = [];
    updatePhoneDisplay();
    phoneEntry = true;
    phoneOverlay.removeAttribute('hidden');
  }

  function closePhoneOverlay() {
    phoneEntry = false;
    phoneOverlay.setAttribute('hidden', '');
    phoneDigitsBuf = [];
  }

  async function handlePhoneAccess(rawDigits) {
    closePhoneOverlay();
    setBusy();
    try {
      var result = await window.API.verifyMemberPhoneAccess(rawDigits);
      if (result && result.valid) {
        triggerDoor();
        setSuccess(result.memberName, result.checkIn);
      } else {
        setFailure(INVALID_REASON_MESSAGES[result && result.reason] || 'Lütfen tekrar deneyin');
      }
    } catch (err) {
      var reason = err && err.data && err.data.reason;
      setFailure(INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası, tekrar deneyin');
    }
  }

  function setIdle() {
    busy = false;
    iconEl.className = 'kiosk__icon is-idle';
    iconEl.textContent = '📷';
    titleEl.textContent = 'GİRİŞ İÇİN\nQR OKUTUNUZ';
    subtitleEl.textContent = '';
    if (kioskPhoneBtn) kioskPhoneBtn.style.display = '';
    focusInput();
  }

  function setBusy() {
    busy = true;
    if (kioskPhoneBtn) kioskPhoneBtn.style.display = 'none';
    iconEl.className = 'kiosk__icon';
    iconEl.textContent = '⏳';
    titleEl.textContent = 'Kontrol ediliyor…';
    subtitleEl.textContent = '';
  }

  var DOOR_CONTROL_URL = 'http://127.0.0.1:7000/open';

  function triggerDoor() {
    fetch(DOOR_CONTROL_URL, { method: 'POST' }).catch(function () {});
  }

  function setSuccess(memberName, checkIn) {
    iconEl.className = 'kiosk__icon is-ok';
    iconEl.textContent = '✓';
    titleEl.textContent = memberName ? 'MERHABA ' + memberName : 'Giriş başarılı';
    if (checkIn && checkIn.ok) {
      subtitleEl.textContent = 'Seansınıza giriş kaydedildi';
    } else {
      subtitleEl.textContent = 'Bugün için planlı bir seansınız yok';
    }
    scheduleReset();
  }

  function setFailure(message) {
    iconEl.className = 'kiosk__icon is-fail';
    iconEl.textContent = '✕';
    titleEl.textContent = 'Giriş doğrulanamadı';
    subtitleEl.textContent = message || 'Lütfen tekrar deneyin';
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

  // Bu kiosk'taki USB QR okuyucu, klavye düzeni farkı nedeniyle bazı sembolleri
  // farklı karakterlerle "yazıyor". Gözlemlenen eşleme: " -> ` , : -> ? , , -> \ , . -> / , i -> '
  // ({ ve } karakterleri ise hiç üretilmiyor ve trim ile baştan/sondan siliniyor).
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
    } catch (_) {
      // Doğrudan JSON değilse, okuyucunun karakter eşlemesini düzeltip tekrar dene
    }
    try {
      var fixed = fixScannerChars(value);
      if (fixed.charAt(0) !== '{') fixed = '{' + fixed + '}';
      var payload2 = JSON.parse(fixed);
      if (payload2 && typeof payload2.t === 'string') return payload2.t;
    } catch (_) {
      // yine de başarısızsa ham değeri kullan
    }
    return value;
  }

  async function handleScan(raw) {
    var value = (raw || '').trim();
    if (!value) { setFailure(INVALID_REASON_MESSAGES.empty || 'Lütfen tekrar deneyin'); return; }

    var token = extractToken(raw);
    // JSON {"t":"..."} formatından çözümlendiyse QR, aksi halde kart numarası
    var isQrToken = token !== value;

    setBusy();
    try {
      var result = isQrToken
        ? await window.API.verifyMemberAccess(token)
        : await window.API.verifyMemberCardAccess(value);
      if (result && result.valid) {
        triggerDoor();
        setSuccess(result.memberName, result.checkIn);
      } else {
        setFailure(INVALID_REASON_MESSAGES[result && result.reason] || 'Lütfen tekrar deneyin');
      }
    } catch (err) {
      var reason = err && err.data && err.data.reason;
      setFailure(INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası, tekrar deneyin');
    }
  }

  phonePad.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-digit]');
    if (btn && phoneDigitsBuf.length < MAX_PHONE_DIGITS) {
      phoneDigitsBuf.push(btn.dataset.digit);
      updatePhoneDisplay();
    }
  });

  phoneBackspace.addEventListener('click', function () {
    if (phoneDigitsBuf.length > 0) {
      phoneDigitsBuf.pop();
      updatePhoneDisplay();
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
    if (busy) {
      inputEl.value = '';
      return;
    }
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

  function tickClock() {
    var now = new Date();
    clockEl.textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' })
      + ' — ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 30000);

  setIdle();
})();
