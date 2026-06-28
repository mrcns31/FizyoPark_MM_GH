/* Seans Planlayıcı – API istemcisi (backend'e bağlantı) */
(function () {
  const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__)
    || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000/api` : 'http://localhost:3000/api');
  const TOKEN_KEY = 'seans_planner_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function apiFetch(path, options = {}) {
    try {
      const url = path.startsWith('http') ? path : API_BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, { ...options, headers });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {}
      if (!res.ok) {
        if (res.status === 401) removeToken();
        const msg = data?.error || data?.message || (data?.errors && Array.isArray(data.errors) ? data.errors.map(e => e.msg || e.message).join(', ') : null) || res.statusText;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (error) {
      // Network hatası veya fetch başarısız oldu
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkErr = new Error('Backend\'e bağlanılamıyor. Sunucu çalışıyor mu?');
        networkErr.status = 0;
        networkErr.data = { error: 'Backend\'e bağlanılamıyor. Sunucu çalışıyor mu?' };
        throw networkErr;
      }
      // Diğer hataları olduğu gibi fırlat
      throw error;
    }
  }

  function memberFromApi(row) {
    var name = (row.name || ((row.first_name || '') + ' ' + (row.last_name || '')).trim()) || '';
    return {
      id: row.id,
      name: name,
      memberNo: row.member_no || '',
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      phone: row.phone || '',
      email: row.email || '',
      birthDate: row.birth_date || '',
      profession: row.profession || '',
      address: row.address || '',
      contactName: row.contact_name || '',
      contactPhone: row.contact_phone || '',
      systemicDiseases: row.systemic_diseases || '',
      clinicalConditions: row.clinical_conditions || '',
      pastOperations: row.past_operations || '',
      notes: row.notes || '',
      cardNo: row.card_no || null,
      deletionRequestedAt: row.deletion_requested_at || null,
      deletedAt: row.deleted_at || null,
    };
  }
  function memberToApi(m) {
    const result = {
      first_name: m.firstName || m.first_name,
      last_name: m.lastName || m.last_name,
      phone: m.phone,
      email: m.email || null,
      birth_date: m.birthDate || m.birth_date || null,
      profession: m.profession || null,
      address: m.address || null,
      contact_name: m.contactName || m.contact_name || null,
      contact_phone: m.contactPhone || m.contact_phone || null,
      systemic_diseases: m.systemicDiseases || m.systemic_diseases || null,
      clinical_conditions: m.clinicalConditions || m.clinical_conditions || null,
      past_operations: m.pastOperations || m.past_operations || null,
      notes: m.notes || null,
      card_no: m.cardNo !== undefined ? (m.cardNo || null) : undefined
    };
    // member_no sadece düzenlemede gönderilir (yeni üyede backend otomatik atar)
    if (m.memberNo || m.member_no) {
      result.member_no = m.memberNo || m.member_no;
    }
    return result;
  }
  function staffFromApi(row) {
    const wh = typeof row.working_hours === 'string' ? (tryParse(row.working_hours) || {}) : (row.working_hours || {});
    return {
      id: row.id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      phone: row.phone || '',
      email: row.user_email || row.email || '',
      workingHours: wh,
      loginUsername: row.login_username || null,
      cardNo: row.card_no || null,
    };
  }
  function roomFromApi(row) {
    return { id: row.id, name: row.name || '', devices: row.devices || 1 };
  }
  function packageFromApi(row) {
    return {
      id: row.id,
      name: row.name || '',
      lessonCount: row.lesson_count,
      monthOverrun: row.month_overrun,
      weeklyLessonCount: row.weekly_lesson_count,
      packageType: row.package_type || 'fixed',
    };
  }
  function sessionFromApi(row) {
    const confirmerStaffName = (
      (row.confirmer_first_name || '') + ' ' + (row.confirmer_last_name || '')
    ).trim();
    const memberName = (
      (row.member_name || '').trim() ||
      ((row.member_first_name || '') + ' ' + (row.member_last_name || '')).trim()
    );
    return {
      id: row.id,
      staffId: row.staff_id,
      memberId: row.member_id,
      memberName: memberName,
      roomId: row.room_id || null,
      memberPackageId: row.member_package_id || null,
      startTs: Number(row.start_ts),
      endTs: Number(row.end_ts),
      note: row.note || '',
      checkedInAt: row.checked_in_at || null,
      checkInMethod: row.check_in_method || null,
      attendanceOutcome: row.attendance_outcome || null,
      attendanceConfirmedAt: row.attendance_confirmed_at || null,
      attendanceConfirmedBy: row.attendance_confirmed_by || null,
      confirmerStaffName: confirmerStaffName,
      confirmerRole: row.confirmer_role || null,
    };
  }
  function memberPackageFromApi(row) {
    return {
      id: row.id,
      memberId: row.member_id,
      packageId: row.package_id,
      packageName: row.package_name || '',
      lessonCount: row.lesson_count,
      startDate: row.start_date,
      endDate: row.end_date,
      skipDayDistribution: !!row.skip_day_distribution,
      status: row.status || 'active',
      slots: (row.slots || []).map(function (s) {
        return { id: s.id, dayOfWeek: s.day_of_week, startTime: s.start_time, staffId: s.staff_id };
      }),
      remainingSessions: row.remaining_sessions != null ? Number(row.remaining_sessions) : null,
      sessionConflicts: row.sessionConflicts || [],
      sessionsCreated: row.sessions_created != null ? Number(row.sessions_created) : (row.sessionsCreated != null ? Number(row.sessionsCreated) : null),
    };
  }
  function tryParse(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  async function login(email, password, rememberMe) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe: !!rememberMe }),
    });
    if (data.token) setToken(data.token);
    return data;
  }

  async function getMe() {
    return apiFetch('/auth/me');
  }

  async function acceptConsent() {
    return apiFetch('/auth/consent', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async function getLegalLinks() {
    return apiFetch('/auth/legal-links');
  }

  async function setPassword(newPassword, confirmPassword) {
    return apiFetch('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword, confirmPassword }),
    });
  }
  async function changePassword(currentPassword, newPassword, confirmPassword) {
    return apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async function updateAccountProfile(body) {
    return apiFetch('/auth/account', {
      method: 'PUT',
      body: JSON.stringify(body || {}),
    });
  }

  async function logout() {
    try {
      if (getToken()) {
        await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      }
    } catch (_) {
      /* ağ hatası olsa bile yerel oturumu kapat */
    }
    removeToken();
  }

  async function loadMemberPortalState() {
    /** Dashboard paket seansları → planner state.sessions (PERF-03: ayrı /sessions isteği yok) */
    function memberPortalSessionsFromDashboard(dashboard) {
      var profile = dashboard.profile || {};
      var memberId = profile.id;
      var byId = new Map();

      function addFromPackage(pkg) {
        if (!pkg || !Array.isArray(pkg.sessions)) return;
        var memberPackageId = pkg.id;
        pkg.sessions.forEach(function (s) {
          if (s.id == null) return;
          byId.set(String(s.id), {
            id: s.id,
            staffId: s.staffId,
            memberId: memberId,
            roomId: s.roomId || null,
            memberPackageId: memberPackageId,
            startTs: Number(s.startTs),
            endTs: Number(s.endTs),
            note: s.note || '',
            checkedIn: !!s.checkedIn,
            checkedInAt: s.checkedInAt || null,
            isCancelled: !!s.isCancelled,
            isConsumed: !!s.isConsumed,
            isPast: !!s.isPast,
            canCancel: !!s.canCancel,
            cancelReason: s.cancelReason || null,
            cancelReasonDetail: s.cancelReasonDetail || null,
            status: s.status,
            statusLabel: s.statusLabel || null,
          });
        });
      }

      addFromPackage(dashboard.activePackage);
      (dashboard.pastPackages || []).forEach(addFromPackage);
      return Array.from(byId.values()).sort(function (a, b) {
        return a.startTs - b.startTs;
      });
    }

    const settled = await Promise.allSettled([
      apiFetch('/member-portal/dashboard'),
      apiFetch('/staff'),
      apiFetch('/settings/working-hours'),
      apiFetch('/rooms'),
    ]);

    function unwrap(index, fallback) {
      const r = settled[index];
      if (r.status === 'fulfilled') return r.value != null ? r.value : fallback;
      console.warn('loadMemberPortalState kısmi hata:', r.reason && (r.reason.message || r.reason));
      return fallback;
    }

    const dashboard = unwrap(0, {});
    const staff = unwrap(1, []);
    const workingHours = unwrap(2, {});
    const rooms = unwrap(3, []);

    const whMap = workingHours || {};
    const defaultWh = { 0: { start: '08:00', end: '20:00', enabled: false }, 1: { start: '08:00', end: '20:00', enabled: true }, 2: { start: '08:00', end: '20:00', enabled: true }, 3: { start: '08:00', end: '20:00', enabled: true }, 4: { start: '08:00', end: '20:00', enabled: true }, 5: { start: '08:00', end: '20:00', enabled: true }, 6: { start: '08:00', end: '20:00', enabled: true } };
    Object.keys(whMap).forEach(function (k) {
      const v = whMap[k];
      defaultWh[k] = { start: v.start || '08:00', end: v.end || '20:00', enabled: !!v.enabled };
    });

    const profile = dashboard.profile || {};
    return {
      dashboard: dashboard,
      settings: { slotMinutes: 60 },
      workingHours: defaultWh,
      rooms: (rooms || []).map(roomFromApi),
      packages: [],
      memberPackages: [],
      staff: (staff || []).map(staffFromApi),
      members: profile.id ? [memberFromApi({
        id: profile.id,
        member_no: profile.memberNo,
        first_name: profile.firstName,
        last_name: profile.lastName,
        name: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        birth_date: profile.birthDate,
        profession: profile.profession,
        address: profile.address,
        contact_name: profile.contactName,
        contact_phone: profile.contactPhone,
        systemic_diseases: profile.systemicDiseases,
        clinical_conditions: profile.clinicalConditions,
        past_operations: profile.pastOperations,
        notes: profile.notes,
        deletion_requested_at: profile.deletionRequestedAt,
      })] : [],
      sessions: memberPortalSessionsFromDashboard(dashboard),
    };
  }

  async function getMemberDashboard() {
    return apiFetch('/member-portal/dashboard');
  }

  async function cancelMemberSession(sessionId, body) {
    return apiFetch('/member-portal/sessions/' + sessionId + '/cancel', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  }

  async function requestMemberAccountDeletion() {
    return apiFetch('/member-portal/request-account-deletion', { method: 'POST', body: JSON.stringify({}) });
  }

  async function createMemberPackageRequest(packageId) {
    return apiFetch('/member-portal/package-request', {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId }),
    });
  }

  async function getPackageRequests(status) {
    var q = status ? '?status=' + encodeURIComponent(status) : '';
    return apiFetch('/package-requests' + q);
  }

  async function getPackageRequestsUnseenCount() {
    return apiFetch('/package-requests/unseen-count');
  }

  async function markPackageRequestsSeen(ids) {
    var body = ids && ids.length ? { ids: ids } : {};
    return apiFetch('/package-requests/mark-seen', { method: 'POST', body: JSON.stringify(body) });
  }

  async function dismissPackageRequest(id) {
    return apiFetch('/package-requests/' + id + '/dismiss', { method: 'POST', body: JSON.stringify({}) });
  }

  async function getClosurePeriods() {
    return apiFetch('/closure-periods');
  }

  async function createClosurePeriod(body) {
    return apiFetch('/closure-periods', { method: 'POST', body: JSON.stringify(body) });
  }

  async function deleteClosurePeriod(id) {
    return apiFetch('/closure-periods/' + id, { method: 'DELETE' });
  }

  async function getMemberAccessQr() {
    return apiFetch('/member-portal/access-qr');
  }

  async function verifyMemberAccess(token) {
    return apiFetch('/member-portal/verify-access', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async function verifyMemberPhoneAccess(phone) {
    return apiFetch('/member-portal/verify-phone-access', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async function verifyMemberCardAccess(card) {
    return apiFetch('/member-portal/verify-card-access', {
      method: 'POST',
      body: JSON.stringify({ card }),
    });
  }

  async function getDeletionRequests() {
    var rows = await apiFetch('/members/deletion-requests');
    return (rows || []).map(function (row) {
      return {
        id: row.id,
        memberNo: row.memberNo || row.member_no || '',
        memberName: row.memberName || row.member_name || '',
        phone: row.phone || '',
        email: row.email || '',
        deletionRequestedAt: row.deletionRequestedAt || row.deletion_requested_at || null,
      };
    });
  }

  async function approveMemberDeletionRequest(id) {
    return apiFetch('/members/' + id + '/approve-deletion-request', { method: 'POST', body: JSON.stringify({}) });
  }

  async function rejectMemberDeletionRequest(id) {
    return apiFetch('/members/' + id + '/reject-deletion-request', { method: 'POST', body: JSON.stringify({}) });
  }

  async function resetMemberPassword(id) {
    return apiFetch('/members/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({}) });
  }

  async function forgotPassword(email) {
    return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async function getPasswordResetRequests() {
    return apiFetch('/auth/password-reset-requests');
  }

  async function handlePasswordResetRequest(id) {
    return apiFetch('/auth/password-reset-requests/' + id + '/reset', { method: 'POST', body: JSON.stringify({}) });
  }

  // Nadiren değişen veriler (personel, oda, paket tanımları, çalışma saatleri) — localStorage, 24 saat
  var RARE_CACHE_KEY  = 'fp_rare_v1';
  var RARE_CACHE_TTL  = 24 * 60 * 60 * 1000;
  // Sık değişen veriler (üyeler, üye paketleri) — localStorage, 30 dakika
  var FREQ_CACHE_KEY  = 'fp_freq_v1';
  var FREQ_CACHE_TTL  = 30 * 60 * 1000;

  function readCache(key, ttl) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.ts > ttl) { localStorage.removeItem(key); return null; }
      return entry.data;
    } catch (e) { return null; }
  }

  function writeCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
  }

  function getStaticCache() {
    var rare = readCache(RARE_CACHE_KEY, RARE_CACHE_TTL);
    var freq = readCache(FREQ_CACHE_KEY, FREQ_CACHE_TTL);
    if (!rare || !freq) return null;
    return Object.assign({}, rare, freq);
  }

  function setStaticCache(data) {
    writeCache(RARE_CACHE_KEY, { staff: data.staff, rooms: data.rooms,
                                  packages: data.packages, workingHours: data.workingHours });
    writeCache(FREQ_CACHE_KEY, { members: data.members, memberPackages: data.memberPackages });
  }

  function invalidateStaticCache() {
    // Sadece sık değişen veriyi sıfırla; personel/oda/paket tanımları geçerliliğini korur
    try { localStorage.removeItem(FREQ_CACHE_KEY); } catch (e) {}
  }

  function invalidateRareCache() {
    try { localStorage.removeItem(RARE_CACHE_KEY); } catch (e) {}
  }

  async function loadFullState(opts) {
    opts = opts || {};
    var sessionStart = opts.sessionStartDate || opts.sessionStart || opts.startDate;
    var sessionEnd = opts.sessionEndDate || opts.sessionEnd || opts.endDate;
    if (!sessionStart || !sessionEnd) {
      throw new Error('loadFullState requires startDate and endDate (or sessionStartDate/sessionEndDate)');
    }

    var staticData = getStaticCache();
    var sessionsUrl = '/sessions?startDate=' + encodeURIComponent(sessionStart) +
      '&endDate=' + encodeURIComponent(sessionEnd);

    if (staticData) {
      // Sadece sessions'ı çek, static veri önbellekten
      try {
        var sessions = await apiFetch(sessionsUrl);
        return mapBootstrapToState(Object.assign({}, staticData, { sessions: sessions }));
      } catch (e) {
        // Sessions başarısız olursa full bootstrap'a düş
      }
    }

    // İlk yükleme veya önbellek süresi dolmuş: tam bootstrap
    var bootstrapUrl = '/bootstrap?startDate=' + encodeURIComponent(sessionStart) +
      '&endDate=' + encodeURIComponent(sessionEnd);
    var data;
    try {
      data = await apiFetch(bootstrapUrl);
    } catch (bootstrapErr) {
      console.warn('bootstrap fallback:', bootstrapErr.message || bootstrapErr);
      return loadFullStateLegacy(sessionStart, sessionEnd);
    }
    // Static kısmı önbelleğe al (sessions hariç)
    var toCache = { members: data.members, staff: data.staff, rooms: data.rooms,
                    packages: data.packages, memberPackages: data.memberPackages,
                    workingHours: data.workingHours };
    setStaticCache(toCache);
    return mapBootstrapToState(data);
  }

  function mapBootstrapToState(data) {
    data = data || {};
    var workingHours = data.workingHours || {};
    var whMap = workingHours || {};
    var defaultWh = { 0: { start: '08:00', end: '20:00', enabled: false }, 1: { start: '08:00', end: '20:00', enabled: true }, 2: { start: '08:00', end: '20:00', enabled: true }, 3: { start: '08:00', end: '20:00', enabled: true }, 4: { start: '08:00', end: '20:00', enabled: true }, 5: { start: '08:00', end: '20:00', enabled: true }, 6: { start: '08:00', end: '20:00', enabled: true } };
    Object.keys(whMap).forEach(function (k) {
      var v = whMap[k];
      defaultWh[k] = { start: v.start || '08:00', end: v.end || '20:00', enabled: !!v.enabled };
    });
    return {
      settings: { slotMinutes: 60 },
      workingHours: defaultWh,
      rooms: (data.rooms || []).map(roomFromApi),
      packages: (data.packages || []).map(packageFromApi),
      memberPackages: (data.memberPackages || []).map(memberPackageFromApi),
      staff: (data.staff || []).map(staffFromApi),
      members: (data.members || []).map(memberFromApi),
      sessions: (data.sessions || []).map(sessionFromApi),
    };
  }

  async function loadFullStateLegacy(sessionStart, sessionEnd) {
    var sessionsUrl = '/sessions?startDate=' + encodeURIComponent(sessionStart) +
      '&endDate=' + encodeURIComponent(sessionEnd);
    const settled = await Promise.allSettled([
      apiFetch('/members'),
      apiFetch('/staff'),
      apiFetch('/rooms'),
      apiFetch('/packages'),
      apiFetch('/member-packages'),
      apiFetch('/settings/working-hours'),
      apiFetch(sessionsUrl),
    ]);

    function unwrap(index, fallback) {
      const r = settled[index];
      if (r.status === 'fulfilled') return r.value != null ? r.value : fallback;
      console.warn('loadFullState kısmi hata:', r.reason && (r.reason.message || r.reason));
      return fallback;
    }

    return mapBootstrapToState({
      members: unwrap(0, []),
      staff: unwrap(1, []),
      rooms: unwrap(2, []),
      packages: unwrap(3, []),
      memberPackages: unwrap(4, []),
      workingHours: unwrap(5, {}),
      sessions: unwrap(6, []),
    });
  }

  // CRUD – frontend state güncellemesi için API yanıtını döndürür
  async function createMember(body) {
    var row = await apiFetch('/members', { method: 'POST', body: JSON.stringify(memberToApi(body)) });
    invalidateStaticCache();
    return memberFromApi(row);
  }
  async function getFormerMembers(params) {
    var q = new URLSearchParams();
    if (params && params.name && params.name.trim()) q.set('name', params.name.trim());
    if (params && params.phone && params.phone.trim()) q.set('phone', params.phone.trim());
    var qs = q.toString();
    var rows = await apiFetch('/members/former' + (qs ? '?' + qs : ''));
    return (rows || []).map(function (row) {
      var m = memberFromApi(row);
      m.packageCount = row.package_count;
      m.sessionCount = row.session_count;
      return m;
    });
  }
  async function getFormerMemberPackages(memberId) {
    return apiFetch('/members/former/' + memberId + '/packages');
  }
  async function reactivateMember(id, body) {
    var row = await apiFetch('/members/' + id + '/reactivate', {
      method: 'POST',
      body: JSON.stringify(body ? memberToApi(body) : {}),
    });
    invalidateStaticCache();
    return memberFromApi(row);
  }
  async function updateMember(id, body) {
    var row = await apiFetch('/members/' + id, { method: 'PUT', body: JSON.stringify(memberToApi(body)) });
    invalidateStaticCache();
    return memberFromApi(row);
  }
  async function deleteMember(id, body) {
    await apiFetch('/members/' + id, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined
    });
    invalidateStaticCache();
  }

  async function createStaff(body) {
    const row = await apiFetch('/staff', {
      method: 'POST',
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone || null,
        email: body.email,
        workingHours: body.workingHours || {},
      }),
    });
    invalidateRareCache();
    return staffFromApi(row);
  }
  async function updateStaff(id, body) {
    const row = await apiFetch('/staff/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        workingHours: body.workingHours,
        cardNo: body.cardNo !== undefined ? (body.cardNo || null) : undefined,
      }),
    });
    invalidateRareCache();
    return staffFromApi(row);
  }
  async function getAllStaffIncludingDeleted() {
    const rows = await apiFetch('/staff?includeDeleted=true');
    return (rows || []).map(staffFromApi);
  }

  async function deleteStaff(id, body) {
    await apiFetch('/staff/' + id, { method: 'DELETE', body: JSON.stringify(body || {}) });
    invalidateRareCache();
  }

  async function resetStaffPassword(id) {
    return apiFetch('/staff/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({}) });
  }

  async function createRoom(body) {
    const row = await apiFetch('/rooms', { method: 'POST', body: JSON.stringify({ name: body.name, devices: body.devices || 1 }) });
    invalidateRareCache();
    return roomFromApi(row);
  }
  async function updateRoom(id, body) {
    const row = await apiFetch('/rooms/' + id, { method: 'PUT', body: JSON.stringify(body) });
    invalidateRareCache();
    return roomFromApi(row);
  }
  async function deleteRoom(id) {
    await apiFetch('/rooms/' + id, { method: 'DELETE' });
    invalidateRareCache();
  }

  async function getPackages() {
    const rows = await apiFetch('/packages');
    return (rows || []).map(packageFromApi);
  }

  async function createPackage(body) {
    const payload = {
      name: body.name,
      lesson_count: body.lessonCount ?? body.lesson_count ?? 1,
      month_overrun: body.monthOverrun ?? body.month_overrun ?? 0,
      package_type: body.packageType ?? body.package_type ?? 'fixed',
    };
    const wlc = body.weeklyLessonCount ?? body.weekly_lesson_count;
    if (wlc != null && wlc !== '') payload.weekly_lesson_count = Number(wlc);
    const row = await apiFetch('/packages', { method: 'POST', body: JSON.stringify(payload) });
    invalidateRareCache();
    return packageFromApi(row);
  }
  async function updatePackage(id, body) {
    const payload = {};
    if (body.name !== undefined) payload.name = body.name;
    if (body.lessonCount !== undefined) payload.lesson_count = body.lessonCount;
    if (body.monthOverrun !== undefined) payload.month_overrun = body.monthOverrun;
    if (body.weeklyLessonCount !== undefined) payload.weekly_lesson_count = body.weeklyLessonCount;
    if (body.packageType !== undefined) payload.package_type = body.packageType;
    const row = await apiFetch('/packages/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    invalidateRareCache();
    return packageFromApi(row);
  }
  async function deletePackage(id) {
    await apiFetch('/packages/' + id, { method: 'DELETE' });
    invalidateRareCache();
  }
  async function verifyAdminPassword(password) {
    return apiFetch('/auth/verify-password', { method: 'POST', body: JSON.stringify({ password }) });
  }

  async function getMemberPackages(memberId) {
    const rows = memberId != null ? await apiFetch('/member-packages?memberId=' + memberId) : await apiFetch('/member-packages');
    return (rows || []).map(memberPackageFromApi);
  }
  async function getMemberPackage(id) {
    const row = await apiFetch('/member-packages/' + id);
    return memberPackageFromApi(row);
  }
  async function getMemberPackageUpgradePreview(id, newPackageId) {
    return apiFetch('/member-packages/' + id + '/upgrade-preview?new_package_id=' + encodeURIComponent(newPackageId));
  }
  async function checkMemberPackageAvailability(body) {
    const payload = {
      member_id: body.memberId,
      start_date: body.startDate,
      end_date: body.endDate,
      slots: (body.slots || []).map(function (s) {
        return { day_of_week: s.dayOfWeek, start_time: s.startTime, staff_id: s.staffId };
      }),
    };
    if (body.excludeMemberPackageId != null) payload.exclude_member_package_id = body.excludeMemberPackageId;
    return apiFetch('/member-packages/check-availability', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function createMemberPackage(body) {
    const payload = {
      member_id: body.memberId,
      package_id: body.packageId,
      start_date: body.startDate,
      end_date: body.endDate,
      skip_day_distribution: !!body.skipDayDistribution,
      slots: (body.slots || []).map(function (s) {
        return { day_of_week: s.dayOfWeek, start_time: s.startTime, staff_id: s.staffId };
      }),
    };
    const row = await apiFetch('/member-packages', { method: 'POST', body: JSON.stringify(payload) });
    invalidateStaticCache();
    return memberPackageFromApi(row);
  }
  async function updateMemberPackage(id, body) {
    const payload = {};
    if (body.startDate !== undefined) payload.start_date = body.startDate;
    if (body.endDate !== undefined) payload.end_date = body.endDate;
    if (body.status !== undefined) payload.status = body.status;
    if (body.skipDayDistribution !== undefined) payload.skip_day_distribution = body.skipDayDistribution;
    if (body.effectiveDate !== undefined) payload.effective_date = body.effectiveDate;
    if (body.packageId !== undefined) payload.package_id = body.packageId;
    if (body.slots !== undefined) payload.slots = body.slots.map(function (s) {
      return { day_of_week: s.dayOfWeek, start_time: s.startTime, staff_id: s.staffId };
    });
    const row = await apiFetch('/member-packages/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    invalidateStaticCache();
    return memberPackageFromApi(row);
  }
  async function endMemberPackage(id, endDate) {
    const body = endDate ? { end_date: endDate } : {};
    const row = await apiFetch('/member-packages/' + id + '/end', { method: 'POST', body: JSON.stringify(body) });
    invalidateStaticCache();
    return row ? memberPackageFromApi(row) : null;
  }
  async function getMemberPackageSessions(id) {
    const rows = await apiFetch('/member-packages/' + id + '/sessions');
    return (rows || []).map(packageSessionFromApi);
  }
  function packageSessionFromApi(row) {
    return {
      id: row.id,
      startTs: Number(row.startTs != null ? row.startTs : row.start_ts),
      endTs: Number(row.endTs != null ? row.endTs : row.end_ts),
      note: row.note || '',
      staffName: row.staffName || row.staff_name || '',
      roomName: row.roomName || row.room_name || '',
      checkedIn: row.checkedIn != null ? !!row.checkedIn : !!row.checked_in,
      checkedInAt: row.checkedInAt || row.checked_in_at || null,
      checkInMethod: row.checkInMethod || row.check_in_method || null,
      attendanceOutcome: row.attendanceOutcome || row.attendance_outcome || null,
      attendanceConfirmedAt: row.attendanceConfirmedAt || row.attendance_confirmed_at || null,
      isPast: !!row.isPast,
      isCancelled: !!(row.isCancelled || row.is_cancelled),
      isConsumed: !!(row.isConsumed || row.is_consumed),
      canCancel: !!row.canCancel,
      cancelReason: row.cancelReason || null,
      cancelReasonDetail: row.cancelReasonDetail || null,
      status: row.status || null,
      statusLabel: row.statusLabel || null,
      approvalLabel: row.approvalLabel || row.approval_label || null,
      approvalKind: row.approvalKind || row.approval_kind || null,
    };
  }
  async function getSessions(startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('getSessions requires startDate and endDate');
    }
    const rows = await apiFetch('/sessions?startDate=' + encodeURIComponent(startDate) + '&endDate=' + encodeURIComponent(endDate) + '&_=' + Date.now());
    return (rows || []).map(sessionFromApi);
  }

  async function getNotifications(params) {
    var qs = [];
    if (params && params.since != null) qs.push('since=' + encodeURIComponent(params.since));
    if (params && params.until != null) qs.push('until=' + encodeURIComponent(params.until));
    if (params && params.limit != null) qs.push('limit=' + encodeURIComponent(params.limit));
    if (params && params.page != null) qs.push('page=' + encodeURIComponent(params.page));
    if (params && params.per_page != null) qs.push('per_page=' + encodeURIComponent(params.per_page));
    return apiFetch('/sessions/notifications' + (qs.length ? '?' + qs.join('&') : ''));
  }

  async function exportPackagesCsv() {
    const url = API_BASE.replace(/\/$/, '') + '/packages/export/csv';
    const token = getToken();
    const headers = { Accept: 'text/csv' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(res.status === 401 ? 'Oturum açmanız gerekir' : 'Dışa aktarım başarısız');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'paketler.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toValidInt(val, name) {
    const n = typeof val === 'number' && !isNaN(val) ? Math.floor(val) : parseInt(String(val).trim(), 10);
    if (isNaN(n) || !Number.isFinite(n)) throw new Error(name + ' geçerli bir sayı olmalı');
    return n;
  }

  async function createSession(body) {
    const staffId = toValidInt(body.staffId, 'Personel ID');
    const memberId = toValidInt(body.memberId, 'Üye ID');
    let roomId = null;
    if (body.roomId != null && body.roomId !== '') {
      const r = toValidInt(body.roomId, 'Oda ID');
      roomId = r;
    }
    const startTs = toValidInt(body.startTs, 'Başlangıç zamanı');
    const endTs = toValidInt(body.endTs, 'Bitiş zamanı');
    const note = body.note != null && body.note !== '' ? String(body.note) : null;
    const memberPackageId = body.memberPackageId != null && body.memberPackageId !== '' ? parseInt(body.memberPackageId, 10) : null;

    const payload = { staffId, memberId, roomId, startTs, endTs, note };
    if (memberPackageId != null) payload.memberPackageId = memberPackageId;
    if (body.skipStaffHoursCheck) payload.skipStaffHoursCheck = true;
    if (body.skipTrim) payload.skipTrim = true;

    const row = await apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return sessionFromApi(row);
  }
  async function updateSession(id, body) {
    const payload = {};
    ['staffId', 'memberId', 'roomId', 'startTs', 'endTs', 'note', 'memberPackageId', 'adminPassword', 'skipTrim'].forEach(function (k) {
      if (body[k] !== undefined) payload[k] = body[k];
    });
    const res = await apiFetch('/sessions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    const session = res && res.session ? res.session : res;
    return session && session.id ? sessionFromApi(session) : { ...payload, id: parseInt(id, 10) };
  }
  async function deleteSession(id, options) {
    var opts = options || {};
    await apiFetch('/sessions/' + id, {
      method: 'DELETE',
      body: opts.adminPassword ? JSON.stringify({ adminPassword: opts.adminPassword }) : undefined,
    });
  }

  async function updateWorkingHours(workingHours) {
    var payload = {};
    Object.keys(workingHours || {}).forEach(function (k) {
      payload[k] = workingHours[k];
    });
    await apiFetch('/settings/working-hours', { method: 'PUT', body: JSON.stringify(payload) });
    invalidateRareCache();
  }

  async function getInstitutionWhatsapp() {
    return apiFetch('/settings/institution-whatsapp');
  }

  async function saveInstitutionWhatsapp(whatsapp) {
    return apiFetch('/settings/institution-whatsapp', {
      method: 'PUT',
      body: JSON.stringify({ whatsapp: whatsapp != null ? String(whatsapp) : '' }),
    });
  }

  async function getStaffCalendarRange() {
    return apiFetch('/settings/staff-calendar-range');
  }

  async function saveStaffCalendarRange(daysBefore, daysAfter) {
    return apiFetch('/settings/staff-calendar-range', {
      method: 'PUT',
      body: JSON.stringify({ daysBefore: Number(daysBefore), daysAfter: Number(daysAfter) }),
    });
  }

  async function clearStaffCalendarRange() {
    return apiFetch('/settings/staff-calendar-range', { method: 'DELETE' });
  }

  async function getActivityLogs(params) {
    var q = new URLSearchParams();
    if (params && typeof params === 'object') {
      if (params.page != null) q.set('page', params.page);
      if (params.limit != null) q.set('limit', params.limit);
      if (params.action) q.set('action', params.action);
      if (params.entityType) q.set('entityType', params.entityType);
      if (params.actorId != null) q.set('actorId', params.actorId);
      if (params.from) q.set('from', params.from);
      if (params.to) q.set('to', params.to);
    }
    var path = '/activity-logs' + (q.toString() ? '?' + q.toString() : '');
    return apiFetch(path);
  }

  async function getDevResetMeta() {
    return apiFetch('/dev-reset/meta');
  }
  async function previewDevReset(targets) {
    return apiFetch('/dev-reset/preview', { method: 'POST', body: JSON.stringify({ targets }) });
  }
  async function executeDevReset(targets, adminPassword) {
    return apiFetch('/dev-reset', { method: 'POST', body: JSON.stringify({ targets, adminPassword }) });
  }
  async function getDevSeedMeta() {
    return apiFetch('/dev-reset/seed-test-members/meta');
  }
  async function seedTestMembers(count, adminPassword) {
    return apiFetch('/dev-reset/seed-test-members', {
      method: 'POST',
      body: JSON.stringify({ count, adminPassword }),
    });
  }

  async function getAttendanceEntryList(params) {
    var q = new URLSearchParams();
    if (params && params.startDate) q.set('startDate', params.startDate);
    if (params && params.endDate) q.set('endDate', params.endDate);
    if (params && params.date) q.set('date', params.date);
    if (params && params.staffId != null) q.set('staffId', params.staffId);
    var path = '/sessions/attendance/entry-list' + (q.toString() ? '?' + q.toString() : '');
    return apiFetch(path);
  }

  async function getWalkInAccessList(params) {
    var q = new URLSearchParams();
    if (params && params.startDate) q.set('startDate', params.startDate);
    if (params && params.endDate) q.set('endDate', params.endDate);
    if (params && params.date) q.set('date', params.date);
    var path = '/sessions/attendance/walk-in-list' + (q.toString() ? '?' + q.toString() : '');
    return apiFetch(path);
  }

  async function getPendingAttendance(params) {
    var q = new URLSearchParams();
    if (params && params.date) q.set('date', params.date);
    var path = '/sessions/attendance/pending' + (q.toString() ? '?' + q.toString() : '');
    return apiFetch(path);
  }

  async function confirmSessionAttendance(sessionId, action) {
    return apiFetch('/sessions/attendance/' + sessionId, {
      method: 'POST',
      body: JSON.stringify({ action: action }),
    });
  }

  async function getStaffNotifications(unreadOnly) {
    var path = '/sessions/attendance/notifications/list' + (unreadOnly ? '?unread=1' : '');
    return apiFetch(path);
  }

  async function markStaffNotificationRead(id) {
    return apiFetch('/sessions/attendance/notifications/' + id + '/read', { method: 'POST' });
  }

  async function checkStaffShiftReminder() {
    return apiFetch('/sessions/attendance/shift-reminder', { method: 'POST' });
  }

  async function sendBroadcast(memberIds, title, body) {
    return apiFetch('/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ memberIds, title, body }),
    });
  }

  async function getBroadcasts(page, limit) {
    var qs = '?page=' + (page || 1) + '&limit=' + (limit || 20);
    return apiFetch('/admin/broadcast' + qs);
  }

  async function getBroadcastRecipients(broadcastId) {
    return apiFetch('/admin/broadcast/' + broadcastId + '/recipients');
  }

  async function openDoor() {
    return apiFetch('/door/open', { method: 'POST' });
  }

  window.API = {
    getToken,
    setToken,
    removeToken,
    login,
    getMe,
    acceptConsent,
    getLegalLinks,
    setPassword,
    changePassword,
    updateAccountProfile,
    logout,
    loadFullState,
    invalidateStaticCache,
    invalidateRareCache,
    loadMemberPortalState,
    getMemberDashboard,
    cancelMemberSession,
    requestMemberAccountDeletion,
    createMemberPackageRequest,
    getPackageRequests,
    getPackageRequestsUnseenCount,
    markPackageRequestsSeen,
    dismissPackageRequest,
    getClosurePeriods,
    createClosurePeriod,
    deleteClosurePeriod,
    getMemberAccessQr,
    verifyMemberAccess,
    verifyMemberPhoneAccess,
    verifyMemberCardAccess,
    getDeletionRequests,
    approveMemberDeletionRequest,
    rejectMemberDeletionRequest,
    resetMemberPassword,
    forgotPassword,
    getPasswordResetRequests,
    handlePasswordResetRequest,
    createMember,
    getFormerMembers,
    getFormerMemberPackages,
    reactivateMember,
    updateMember,
    deleteMember,
    createStaff,
    updateStaff,
    deleteStaff,
    getAllStaffIncludingDeleted,
    resetStaffPassword,
    createRoom,
    updateRoom,
    deleteRoom,
    getPackages,
    createPackage,
    updatePackage,
    deletePackage,
    verifyAdminPassword,
    exportPackagesCsv,
    getMemberPackages,
    getMemberPackage,
    getMemberPackageUpgradePreview,
    checkMemberPackageAvailability,
    createMemberPackage,
    updateMemberPackage,
    endMemberPackage,
    getMemberPackageSessions,
    getSessions,
    getNotifications,
    createSession,
    updateSession,
    deleteSession,
    updateWorkingHours,
    getInstitutionWhatsapp,
    saveInstitutionWhatsapp,
    getStaffCalendarRange,
    saveStaffCalendarRange,
    clearStaffCalendarRange,
    apiFetch,
    getActivityLogs,
    getDevResetMeta,
    previewDevReset,
    executeDevReset,
    getDevSeedMeta,
    seedTestMembers,
    getPendingAttendance,
    getAttendanceEntryList,
    getWalkInAccessList,
    confirmSessionAttendance,
    getStaffNotifications,
    markStaffNotificationRead,
    checkStaffShiftReminder,
    openDoor,
    sendBroadcast,
    getBroadcasts,
    getBroadcastRecipients,
  };
  window.__API_BASE__ = API_BASE;
})();
