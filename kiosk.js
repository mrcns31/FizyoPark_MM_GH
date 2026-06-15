/* Kapı girişi kiosk ekranı — USB QR okuyucu (klavye-wedge) ile çalışır. */
(function () {
  var RESET_DELAY_MS = 4000;

  var iconEl = document.getElementById('kioskIcon');
  var titleEl = document.getElementById('kioskTitle');
  var subtitleEl = document.getElementById('kioskSubtitle');
  var clockEl = document.getElementById('kioskClock');
  var inputEl = document.getElementById('kioskInput');

  var resetTimer = null;
  var busy = false;

  var INVALID_REASON_MESSAGES = {
    expired: 'QR kodunun süresi doldu. Üye portalından kodu yenileyip tekrar deneyin.',
    empty: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    format: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    parse: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    invalid_sig: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
    member_mismatch: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
  };

  function setIdle() {
    busy = false;
    iconEl.className = 'kiosk__icon is-idle';
    iconEl.textContent = '📷';
    titleEl.textContent = 'GİRİŞ İÇİN\nQR OKUTUNUZ';
    subtitleEl.textContent = '';
    focusInput();
  }

  function setBusy() {
    busy = true;
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
    var token = extractToken(raw);
    if (!token) {
      scheduleReset();
      focusInput();
      return;
    }
    setBusy();
    try {
      var result = await window.API.verifyMemberAccess(token);
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
    setTimeout(focusInput, 50);
  });

  document.addEventListener('click', focusInput);

  function tickClock() {
    var now = new Date();
    clockEl.textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' })
      + ' — ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 30000);

  setIdle();
})();
