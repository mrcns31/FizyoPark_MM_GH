/* Seans Planlayıcı – API istemcisi (backend'e bağlantı) */
(function () {
  const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'http://localhost:3000/api';
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
      notes: row.notes || ''
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
      notes: m.notes || null
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
      workingHours: wh,
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
    return {
      id: row.id,
      staffId: row.staff_id,
      memberId: row.member_id,
      roomId: row.room_id || null,
      memberPackageId: row.member_package_id || null,
      startTs: Number(row.start_ts),
      endTs: Number(row.end_ts),
      note: row.note || '',
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
      sessionConflicts: row.sessionConflicts || [],
    };
  }
  function tryParse(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  async function login(username, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) setToken(data.token);
    return data;
  }

  async function loadFullState() {
    const [members, staff, rooms, packages, memberPackagesRes, workingHours, sessionsRes] = await Promise.all([
      apiFetch('/members'),
      apiFetch('/staff'),
      apiFetch('/rooms'),
      apiFetch('/packages'),
      apiFetch('/member-packages'),
      apiFetch('/settings/working-hours'),
      apiFetch('/sessions?startDate=2000-01-01&endDate=2030-12-31'),
    ]);
    const whMap = workingHours || {};
    const defaultWh = { 0: { start: '08:00', end: '20:00', enabled: false }, 1: { start: '08:00', end: '20:00', enabled: true }, 2: { start: '08:00', end: '20:00', enabled: true }, 3: { start: '08:00', end: '20:00', enabled: true }, 4: { start: '08:00', end: '20:00', enabled: true }, 5: { start: '08:00', end: '20:00', enabled: true }, 6: { start: '08:00', end: '20:00', enabled: true } };
    Object.keys(whMap).forEach(function (k) {
      const v = whMap[k];
      defaultWh[k] = { start: v.start || '08:00', end: v.end || '20:00', enabled: !!v.enabled };
    });
    return {
      settings: { slotMinutes: 60 },
      workingHours: defaultWh,
      rooms: (rooms || []).map(roomFromApi),
      packages: (packages || []).map(packageFromApi),
      memberPackages: (memberPackagesRes || []).map(memberPackageFromApi),
      staff: (staff || []).map(staffFromApi),
      members: (members || []).map(memberFromApi),
      sessions: (sessionsRes || []).map(sessionFromApi),
    };
  }

  // CRUD – frontend state güncellemesi için API yanıtını döndürür
  async function createMember(body) {
    var row = await apiFetch('/members', { method: 'POST', body: JSON.stringify(memberToApi(body)) });
    return memberFromApi(row);
  }
  async function updateMember(id, body) {
    var row = await apiFetch('/members/' + id, { method: 'PUT', body: JSON.stringify(memberToApi(body)) });
    return memberFromApi(row);
  }
  async function deleteMember(id, body) {
    await apiFetch('/members/' + id, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async function createStaff(body) {
    const row = await apiFetch('/staff', {
      method: 'POST',
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone || null,
        workingHours: body.workingHours || {},
      }),
    });
    return staffFromApi(row);
  }
  async function updateStaff(id, body) {
    const row = await apiFetch('/staff/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        workingHours: body.workingHours,
      }),
    });
    return staffFromApi(row);
  }
  async function deleteStaff(id) {
    await apiFetch('/staff/' + id, { method: 'DELETE' });
  }

  async function createRoom(body) {
    const row = await apiFetch('/rooms', { method: 'POST', body: JSON.stringify({ name: body.name, devices: body.devices || 1 }) });
    return roomFromApi(row);
  }
  async function updateRoom(id, body) {
    const row = await apiFetch('/rooms/' + id, { method: 'PUT', body: JSON.stringify(body) });
    return roomFromApi(row);
  }
  async function deleteRoom(id) {
    await apiFetch('/rooms/' + id, { method: 'DELETE' });
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
    return packageFromApi(row);
  }
  async function deletePackage(id) {
    await apiFetch('/packages/' + id, { method: 'DELETE' });
  }

  async function getMemberPackages(memberId) {
    const rows = memberId != null ? await apiFetch('/member-packages?memberId=' + memberId) : await apiFetch('/member-packages');
    return (rows || []).map(memberPackageFromApi);
  }
  async function getMemberPackage(id) {
    const row = await apiFetch('/member-packages/' + id);
    return memberPackageFromApi(row);
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
    return memberPackageFromApi(row);
  }
  async function updateMemberPackage(id, body) {
    const payload = {};
    if (body.startDate !== undefined) payload.start_date = body.startDate;
    if (body.endDate !== undefined) payload.end_date = body.endDate;
    if (body.skipDayDistribution !== undefined) payload.skip_day_distribution = body.skipDayDistribution;
    if (body.effectiveDate !== undefined) payload.effective_date = body.effectiveDate;
    if (body.packageId !== undefined) payload.package_id = body.packageId;
    if (body.slots !== undefined) payload.slots = body.slots.map(function (s) {
      return { day_of_week: s.dayOfWeek, start_time: s.startTime, staff_id: s.staffId };
    });
    const row = await apiFetch('/member-packages/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    return memberPackageFromApi(row);
  }
  async function endMemberPackage(id, endDate) {
    const body = endDate ? { end_date: endDate } : {};
    const row = await apiFetch('/member-packages/' + id + '/end', { method: 'POST', body: JSON.stringify(body) });
    return row ? memberPackageFromApi(row) : null;
  }
  async function getMemberPackageSessions(id) {
    return apiFetch('/member-packages/' + id + '/sessions');
  }
  async function getSessions() {
    const rows = await apiFetch('/sessions?startDate=2000-01-01&endDate=2030-12-31&_=' + Date.now());
    return (rows || []).map(sessionFromApi);
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

    const row = await apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return sessionFromApi(row);
  }
  async function updateSession(id, body) {
    const payload = {};
    ['staffId', 'memberId', 'roomId', 'startTs', 'endTs', 'note', 'memberPackageId'].forEach(function (k) {
      if (body[k] !== undefined) payload[k] = body[k];
    });
    const res = await apiFetch('/sessions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    const session = res && res.session ? res.session : res;
    return session && session.id ? sessionFromApi(session) : { ...payload, id: parseInt(id, 10) };
  }
  async function deleteSession(id) {
    await apiFetch('/sessions/' + id, { method: 'DELETE' });
  }

  async function updateWorkingHours(workingHours) {
    var payload = {};
    Object.keys(workingHours || {}).forEach(function (k) {
      payload[k] = workingHours[k];
    });
    await apiFetch('/settings/working-hours', { method: 'PUT', body: JSON.stringify(payload) });
  }

  /** İşlem logları listesi (admin/manager). params: { page, limit, action, entityType, from, to } */
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

  window.API = {
    getToken,
    setToken,
    removeToken,
    login,
    loadFullState,
    createMember,
    updateMember,
    deleteMember,
    createStaff,
    updateStaff,
    deleteStaff,
    createRoom,
    updateRoom,
    deleteRoom,
    createPackage,
    updatePackage,
    deletePackage,
    exportPackagesCsv,
    getMemberPackages,
    getMemberPackage,
    checkMemberPackageAvailability,
    createMemberPackage,
    updateMemberPackage,
    endMemberPackage,
    getMemberPackageSessions,
    getSessions,
    createSession,
    updateSession,
    deleteSession,
    updateWorkingHours,
    apiFetch,
    getActivityLogs,
  };
  window.__API_BASE__ = API_BASE;
})();
