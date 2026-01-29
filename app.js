/* Seans Planlayıcı - kurulum gerektirmeyen statik uygulama */

const STORAGE_KEY = "seans_planner_v1";
// Saat satırı yüksekliği (px) - görünüm ferahlığı
const CELL_HEIGHT_PX = 64;

const DEFAULT_STATE = {
  settings: {
    slotMinutes: 60,
  },
  // Gün bazlı çalışma saatleri: { dayOfWeek: { start, end, enabled } }
  // dayOfWeek: 0=Pazar, 1=Pzt, ..., 6=Cumartesi
  workingHours: {
    1: { start: "08:00", end: "20:00", enabled: true }, // Pazartesi
    2: { start: "08:00", end: "20:00", enabled: true }, // Salı
    3: { start: "08:00", end: "20:00", enabled: true }, // Çarşamba
    4: { start: "08:00", end: "20:00", enabled: true }, // Perşembe
    5: { start: "08:00", end: "20:00", enabled: true }, // Cuma
    6: { start: "08:00", end: "20:00", enabled: true }, // Cumartesi
    0: { start: "08:00", end: "20:00", enabled: false }, // Pazar (kapalı)
  },
  rooms: [
    { id: "r1", name: "Oda 1", devices: 3 },
    { id: "r2", name: "Oda 2", devices: 3 },
    { id: "r3", name: "Oda 3", devices: 2 },
  ],
  staff: [
    {
      id: "s1",
      firstName: "Personel",
      lastName: "1",
      phone: "",
      workingHours: {
        1: { start: "08:00", end: "20:00", enabled: true },
        2: { start: "08:00", end: "20:00", enabled: true },
        3: { start: "08:00", end: "20:00", enabled: true },
        4: { start: "08:00", end: "20:00", enabled: true },
        5: { start: "08:00", end: "20:00", enabled: true },
        6: { start: "08:00", end: "20:00", enabled: true },
        0: { start: "08:00", end: "20:00", enabled: false },
      },
    },
    {
      id: "s2",
      firstName: "Personel",
      lastName: "2",
      phone: "",
      workingHours: {
        1: { start: "08:00", end: "20:00", enabled: true },
        2: { start: "08:00", end: "20:00", enabled: true },
        3: { start: "08:00", end: "20:00", enabled: true },
        4: { start: "08:00", end: "20:00", enabled: true },
        5: { start: "08:00", end: "20:00", enabled: true },
        6: { start: "08:00", end: "20:00", enabled: true },
        0: { start: "08:00", end: "20:00", enabled: false },
      },
    },
    {
      id: "s3",
      firstName: "Personel",
      lastName: "3",
      phone: "",
      workingHours: {
        1: { start: "08:00", end: "20:00", enabled: true },
        2: { start: "08:00", end: "20:00", enabled: true },
        3: { start: "08:00", end: "20:00", enabled: true },
        4: { start: "08:00", end: "20:00", enabled: true },
        5: { start: "08:00", end: "20:00", enabled: true },
        6: { start: "08:00", end: "20:00", enabled: true },
        0: { start: "08:00", end: "20:00", enabled: false },
      },
    },
    {
      id: "s4",
      firstName: "Personel",
      lastName: "4",
      phone: "",
      workingHours: {
        1: { start: "08:00", end: "20:00", enabled: true },
        2: { start: "08:00", end: "20:00", enabled: true },
        3: { start: "08:00", end: "20:00", enabled: true },
        4: { start: "08:00", end: "20:00", enabled: true },
        5: { start: "08:00", end: "20:00", enabled: true },
        6: { start: "08:00", end: "20:00", enabled: true },
        0: { start: "08:00", end: "20:00", enabled: false },
      },
    },
  ],
  members: [
    { id: "m1", name: "Üye 1" },
    { id: "m2", name: "Üye 2" },
  ],
  // startTs/endTs: number (ms)
  sessions: [],
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return deepClone(DEFAULT_STATE);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...deepClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...deepClone(DEFAULT_STATE.settings), ...(parsed.settings || {}) },
      workingHours: { ...deepClone(DEFAULT_STATE.workingHours), ...(parsed.workingHours || {}) },
    };
  } catch {
    return deepClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Telefon: (xxx)xxx-xx-xx — tam 10 hane, fazlası kullanılmaz. */
const PHONE_MAX_DIGITS = 10;
function normalizePhone(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  if (digits.length !== PHONE_MAX_DIGITS) return null;
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}
function formatPhone(digits) {
  const d = String(digits).replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  if (d.length !== PHONE_MAX_DIGITS) return null;
  return `(${d.slice(0, 3)})${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}
function toPhoneFormat(value) {
  if (value == null || value === "") return null;
  return normalizePhone(String(value));
}
/** Input'ta sadece rakam, en fazla 10 hane; fazlası silinir (format blur'da uygulanır). */
function restrictPhoneInput(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  if (input.value !== digits) input.value = digits;
}
function displayPhone(value) {
  if (value == null || value === "") return "";
  return toPhoneFormat(value) || value;
}

function timeToMinutes(t) {
  const [hh, mm] = String(t).split(":").map((x) => Number(x));
  return hh * 60 + mm;
}

function minutesToTime(min) {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Pazar, 1 Pzt...
  const diff = (day === 0 ? -6 : 1 - day);
  return addDays(x, diff);
}

function dateToInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function makeLocalDate(dateStr /* yyyy-mm-dd */, timeStr /* HH:mm */) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function fmtDayHeader(d) {
  const dayName = new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(d);
  const dt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" }).format(d);
  return { dayName, dt };
}

function fmtWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const f = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  return `${f.format(weekStart)} – ${f.format(weekEnd)}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function normId(id) {
  const n = Number(id);
  return Number.isNaN(n) ? id : n;
}
function getRoomById(roomId) {
  const id = normId(roomId);
  return state.rooms.find((r) => r.id === id || r.id === roomId) || null;
}
function getStaffById(staffId) {
  const id = normId(staffId);
  return state.staff.find((s) => s.id === id || s.id === staffId) || null;
}

function getStaffFullName(staff) {
  if (!staff) return "Personel";
  if (staff.name) return staff.name; // Eski format desteği
  return `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || "Personel";
}

/** Personel kısa: Ad + Soyadın ilk harfi. (örn: Arzum Ç.) */
function getStaffShortName(staff) {
  if (!staff) return "—";
  const full = getStaffFullName(staff).trim();
  if (!full) return "—";
  const parts = full.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
  return parts[0] ? `${parts[0]}.` : "—";
}

/** Üye kısa: Ad + Soyadın ilk üç harfi. (örn: Meriç Mul.) */
function getMemberShortName(member) {
  if (!member) return "Üye";
  const ad = member.firstName ?? member.first_name ?? "";
  const soyad = member.lastName ?? member.last_name ?? "";
  const name = (member.name || `${ad} ${soyad}`.trim()) || "Üye";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const soyad3 = parts[1].slice(0, 3);
    return `${parts[0]} ${soyad3}${soyad3.length >= 3 ? "." : ""}`;
  }
  return parts[0] ? `${parts[0]}.` : "Üye";
}

function getStaffWorkingHoursForDay(staff, dayOfWeek) {
  // Personelin o gün için çalışma saatlerini döndür
  if (!staff || !staff.workingHours) return null;
  const wh = staff.workingHours[dayOfWeek];
  if (!wh || !wh.enabled || !wh.start || !wh.end) return null;
  return {
    startMin: timeToMinutes(wh.start),
    endMin: timeToMinutes(wh.end),
    start: wh.start,
    end: wh.end,
  };
}
function getMemberById(memberId) {
  const id = normId(memberId);
  return state.members.find((m) => m.id === id || m.id === memberId) || null;
}

function getSessionsInRange(startTs, endTs) {
  return state.sessions.filter((s) => overlaps(s.startTs, s.endTs, startTs, endTs));
}

function getStaffBusyRoomId(candidate, { ignoreSessionId = null } = {}) {
  const relevant = state.sessions.filter((s) => normId(s.id) !== normId(ignoreSessionId));
  const overlap = relevant.filter(
    (s) => normId(s.staffId) === normId(candidate.staffId) && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
  );
  const roomIds = [...new Set(overlap.map((s) => normId(s.roomId)).filter((id) => id != null && id !== ""))];
  if (roomIds.length === 0) return null;
  if (roomIds.length === 1) return roomIds[0];
  return "__MULTI__";
}

function checkConflicts(candidate, { ignoreSessionId = null } = {}) {
  const conflicts = [];
  const relevant = state.sessions.filter((s) => s.id !== ignoreSessionId);

  // Personel kuralı:
  // - Aynı saat aralığında birden fazla seans ALABİLİR
  // - Ama sadece aynı oda içinde (tek personel/oda kuralı ile uyumlu)
  const busyRoomId = getStaffBusyRoomId(candidate, { ignoreSessionId });
  if (busyRoomId === "__MULTI__") {
    conflicts.push("Seçilen personel bu saat aralığında farklı odalarda seanslı görünüyor (uygunsuz durum).");
  } else if (busyRoomId && candidate.roomId && normId(candidate.roomId) !== normId(busyRoomId)) {
    const busyRoom = getRoomById(busyRoomId);
    conflicts.push(
      `Seçilen personel bu saat aralığında ${busyRoom?.name ? `"${busyRoom.name}"` : "başka bir odada"} seanslı. Aynı anda farklı oda olmaz.`,
    );
  }

  for (const s of relevant) {
    if (!overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs)) continue;
    if (normId(s.memberId) === normId(candidate.memberId)) {
      conflicts.push("Seçilen üye bu saat aralığında zaten planlı.");
      break;
    }
  }

  const room = getRoomById(candidate.roomId);
  if (room) {
    const overlapInRoom = relevant.filter(
      (s) => normId(s.roomId) === normId(candidate.roomId) && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
    );
    const count = overlapInRoom.length;
    if (count >= room.devices) {
      conflicts.push(`"${room.name}" için bu saat aralığında kapasite dolu (alet: ${room.devices}).`);
    }

    // KURAL: Aynı anda aynı odada sadece 1 personel olabilir.
    const otherStaff = overlapInRoom.find((s) => s.staffId != null && normId(s.staffId) !== normId(candidate.staffId));
    if (otherStaff) {
      const other = getStaffById(otherStaff.staffId);
      conflicts.push(
        `"${room.name}" odasında bu saat aralığında başka bir personel var${other?.name ? ` (${other.name})` : ""}.`,
      );
    }
  }

  return conflicts;
}

function autoAssignRoom(candidate, { ignoreSessionId = null } = {}) {
  const relevant = state.sessions.filter((s) => normId(s.id) !== normId(ignoreSessionId));
  const rooms = [...state.rooms];
  for (const room of rooms) {
    const overlapInRoom = relevant.filter(
      (s) => normId(s.roomId) === normId(room.id) && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
    );

    if (overlapInRoom.length >= room.devices) continue;

    const hasOtherStaff = overlapInRoom.some((s) => s.staffId != null && normId(s.staffId) !== normId(candidate.staffId));
    if (hasOtherStaff) continue;

    return room.id;
  }
  return null;
}

let state = loadState();
let ui = {
  weekStart: startOfWeekMonday(new Date()),
  currentDay: new Date(),
  viewMode: "day",
  editingSessionId: null,
  editingMemberId: null, // Üye Kimlik Kartı düzenleme
};

const els = {};
function cacheEls() {
  const ids = [
    "prevBtn",
    "nextBtn",
    "todayBtn",
    "viewWeekBtn",
    "viewDayBtn",
    "weekLabel",
    "addSessionBtn",
    "exportBtn",
    "importFile",
    "plannerHeader",
    "plannerGrid",
    "startTime",
    "endTime",
    "slotMinutes",
    "saveSettingsBtn",
    "roomsList",
    "staffList",
    "membersList",
    "newStaffName",
    "newStaffShift",
    "addStaffBtn",
    "addMemberBtn",
    "memberCardModal",
    "memberCardTitle",
    "mcMemberNo",
    "mcFirstName",
    "mcLastName",
    "mcPhone",
    "mcEmail",
    "mcBirthDate",
    "mcProfession",
    "mcAddress",
    "mcContactName",
    "mcContactPhone",
    "mcSystemicDiseases",
    "mcClinicalConditions",
    "mcPastOperations",
    "memberCardError",
    "saveMemberCardBtn",
    "deleteMemberCardBtn",
    "sessionModal",
    "sessionModalTitle",
    "sessionDate",
    "sessionTime",
    "sessionMember",
    "sessionStaff",
    "sessionRoom",
    "sessionNote",
    "sessionError",
    "saveSessionBtn",
    "deleteSessionBtn",
    "openWorkingHoursBtn",
    "workingHoursModal",
    "workingHoursList",
    "workingHoursError",
    "saveWorkingHoursBtn",
    "workingHoursSummary",
    "openRoomsBtn",
    "roomsModal",
    "roomsError",
    "newRoomName",
    "newRoomDevices",
    "addRoomBtn",
    "roomsSummary",
    "openStaffBtn",
    "staffModal",
    "staffError",
    "staffSummary",
    "newStaffFirstName",
    "newStaffLastName",
    "newStaffPhone",
    "staffCardModal",
    "staffCardTitle",
    "editStaffFirstName",
    "editStaffLastName",
    "editStaffPhone",
    "staffCardWorkingHours",
    "staffCardError",
    "saveStaffCardBtn",
    "deleteStaffCardBtn",
    "taskDistributionBtn",
    "taskDistributionModal",
    "taskDistributionContent",
    "printBtn",
    "groupSessionModal",
    "groupSessionModalTitle",
    "groupSessionCreateFields",
    "groupSessionDisplayFields",
    "groupSessionNewDate",
    "groupSessionNewTime",
    "groupSessionNewStaff",
    "groupSessionNewRoom",
    "groupSessionDate",
    "groupSessionTime",
    "groupSessionStaff",
    "groupSessionRoom",
    "groupSessionMembers",
    "groupSessionNewMemberSelect",
    "groupSessionAddMemberBtn",
    "groupSessionError",
    "saveGroupSessionBtn",
  ];
  for (const id of ids) els[id] = document.getElementById(id);
}

function setModal(open) {
  els.sessionModal.classList.toggle("hidden", !open);
}

function showError(msg) {
  els.sessionError.textContent = msg;
  els.sessionError.classList.toggle("hidden", !msg);
}

function setWeekStart(d) {
  ui.weekStart = startOfWeekMonday(d);
  render();
}

function setCurrentDay(d) {
  ui.currentDay = startOfDay(d);
  render();
}

function setViewMode(mode) {
  ui.viewMode = mode;
  if (mode === "day" && !ui.currentDay) {
    ui.currentDay = startOfDay(new Date());
  }
  render();
}

function updateWorkingHoursSummary() {
  const dayNamesShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const summaries = [];
  for (let day = 0; day < 7; day++) {
    const wh = state.workingHours[day];
    if (wh && wh.enabled && wh.start && wh.end) {
      summaries.push(`${dayNamesShort[day]}: ${wh.start}-${wh.end}`);
    }
  }
  if (summaries.length > 0) {
    els.workingHoursSummary.textContent = summaries.slice(0, 3).join(", ") + (summaries.length > 3 ? "..." : "");
  } else {
    els.workingHoursSummary.textContent = "Çalışma saatleri ayarlanmadı";
  }
}

function renderHeader() {
  const header = els.plannerHeader;
  header.innerHTML = "";

  if (ui.viewMode === "day") {
    // Günlük görünüm: Sadece seçili gün
    const d = ui.currentDay;
    const dayOfWeek = d.getDay();
    if (!isDayEnabled(dayOfWeek)) {
      els.weekLabel.textContent = `${fmtDayHeader(d).dayName} ${dateToInputValue(d)} - Kapalı`;
      header.style.gridTemplateColumns = "74px 1fr";
      const blank = document.createElement("div");
      blank.className = "headCell";
      blank.textContent = "Saat";
      header.appendChild(blank);
      const cell = document.createElement("div");
      cell.className = "headCell headCell--day";
      cell.innerHTML = `${fmtDayHeader(d).dayName} <small>${dateToInputValue(d)}</small><br><small style="font-size:10px; color:var(--danger);">Kapalı</small>`;
      header.appendChild(cell);
      return;
    }

    const { dayName, dt } = fmtDayHeader(d);
    const wh = getWorkingHoursForDay(dayOfWeek);
    els.weekLabel.textContent = `${dayName} ${dt}`;

    header.style.gridTemplateColumns = "74px 1fr";
    const blank = document.createElement("div");
    blank.className = "headCell";
    blank.textContent = "Saat";
    header.appendChild(blank);

    const cell = document.createElement("div");
    cell.className = "headCell headCell--day";
    if (wh) {
      cell.innerHTML = `${dayName} <small>${dt}</small><br><small style="font-size:10px; color:var(--muted);">${wh.start}–${wh.end}</small>`;
    }
    header.appendChild(cell);
  } else {
    // Haftalık görünüm
    els.weekLabel.textContent = fmtWeekLabel(ui.weekStart);

    // Açık günleri say
    let enabledCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ui.weekStart, i);
      const dayOfWeek = d.getDay();
      if (isDayEnabled(dayOfWeek)) enabledCount++;
    }

    // Grid column sayısını dinamik yap; gün sütunları min 180px (aynı saatte 2 randevu yan yana sığsın)
    header.style.gridTemplateColumns = `74px repeat(${enabledCount}, minmax(180px, 1fr))`;

    const blank = document.createElement("div");
    blank.className = "headCell";
    blank.textContent = "Saat";
    header.appendChild(blank);

    // Sadece açık günleri göster
    for (let i = 0; i < 7; i++) {
      const d = addDays(ui.weekStart, i);
      const dayOfWeek = d.getDay();
      if (!isDayEnabled(dayOfWeek)) continue; // Kapalı günleri atla

      const { dayName, dt } = fmtDayHeader(d);
      const wh = getWorkingHoursForDay(dayOfWeek);
      const cell = document.createElement("div");
      cell.className = "headCell headCell--day";
      if (wh) {
        cell.innerHTML = `${dayName} <small>${dt}</small><br><small style="font-size:10px; color:var(--muted);">${wh.start}–${wh.end}</small>`;
      }
      header.appendChild(cell);
    }
  }
}

function buildTimeSlots() {
  // Sadece açık günlerin çalışma saatlerini birleştir, en erken başlangıç ve en geç bitişi bul
  let globalStartMin = 24 * 60; // 24:00
  let globalEndMin = 0; // 00:00

  for (const dayOfWeek in state.workingHours) {
    const wh = state.workingHours[dayOfWeek];
    if (!wh || !wh.enabled || !wh.start || !wh.end) continue;
    const startMin = timeToMinutes(wh.start);
    const endMin = timeToMinutes(wh.end);
    if (startMin < globalStartMin) globalStartMin = startMin;
    if (endMin > globalEndMin) globalEndMin = endMin;
  }

  // Eğer hiç çalışma saati yoksa varsayılan
  if (globalStartMin >= 24 * 60 || globalEndMin <= 0) {
    globalStartMin = timeToMinutes("08:00");
    globalEndMin = timeToMinutes("20:00");
  }

  // Görünüm satır aralığı: her zaman 60 dk (1 saat)
  const safeSlot = 60;

  const slots = [];
  for (let m = globalStartMin; m < globalEndMin; m += safeSlot) {
    slots.push(m);
  }
  return { startMin: globalStartMin, endMin: globalEndMin, slotMin: safeSlot, slots };
}

function getWorkingHoursForDay(dayOfWeek) {
  // dayOfWeek: 0=Pazar, 1=Pzt, ..., 6=Cumartesi
  const wh = state.workingHours[dayOfWeek];
  if (!wh || !wh.enabled || !wh.start || !wh.end) return null;
  return {
    startMin: timeToMinutes(wh.start),
    endMin: timeToMinutes(wh.end),
    start: wh.start,
    end: wh.end,
    enabled: true,
  };
}

function isDayEnabled(dayOfWeek) {
  const wh = state.workingHours[dayOfWeek];
  return wh && wh.enabled === true;
}

function getEnabledDays() {
  // Hafta içinde açık olan günlerin listesini döndür (0-6 arası)
  const enabled = [];
  for (let day = 0; day < 7; day++) {
    if (isDayEnabled(day)) enabled.push(day);
  }
  return enabled;
}

function buildTimeSlotsForDay(dayOfWeek) {
  // Belirli bir gün için çalışma saatlerine göre slot oluştur
  const wh = getWorkingHoursForDay(dayOfWeek);
  if (!wh) {
    // Kapalı gün için boş slot listesi
    return { startMin: timeToMinutes("08:00"), endMin: timeToMinutes("20:00"), slotMin: 60, slots: [] };
  }

  const safeSlot = 60;
  const slots = [];
  for (let m = wh.startMin; m < wh.endMin; m += safeSlot) {
    slots.push(m);
  }
  return { startMin: wh.startMin, endMin: wh.endMin, slotMin: safeSlot, slots };
}

function renderGrid() {
  const grid = els.plannerGrid;
  grid.innerHTML = "";

  const now = new Date();
  const nowDate = dateToInputValue(now);

  if (ui.viewMode === "day") {
    // Günlük görünüm
    const d = ui.currentDay;
    const dayOfWeek = d.getDay();
    const dStr = dateToInputValue(d);

    if (!isDayEnabled(dayOfWeek)) {
      // Kapalı gün - boş grid göster
      grid.style.gridTemplateColumns = "74px 1fr";
      return;
    }

    const { startMin, slotMin, slots } = buildTimeSlotsForDay(dayOfWeek);
    const wh = getWorkingHoursForDay(dayOfWeek);

    grid.style.gridTemplateColumns = "74px 1fr";

    for (let row = 0; row < slots.length; row++) {
      const minuteOfDay = slots[row];
      const tCell = document.createElement("div");
      tCell.className = "timeCell";
      tCell.textContent = minutesToTime(minuteOfDay);
      grid.appendChild(tCell);

      const cell = document.createElement("div");
      cell.className = "dayCell";

      if (dStr === nowDate && minuteOfDay === timeToMinutes(`${pad2(now.getHours())}:${pad2(now.getMinutes() - (now.getMinutes() % slotMin))}`)) {
        cell.classList.add("dayCell--now");
      }
      cell.id = `cell_0_${row}`;
      cell.dataset.day = "0";
      cell.dataset.row = String(row);
      cell.dataset.date = dStr;
      cell.dataset.time = minutesToTime(minuteOfDay);
      tCell.dataset.row = String(row);
      cell.addEventListener("click", () => {
        if (wh && minuteOfDay >= wh.startMin && minuteOfDay < wh.endMin) {
          openGroupSessionModal(null, { date: dStr, time: minutesToTime(minuteOfDay) });
        }
      });
      grid.appendChild(cell);
    }

    // events
    renderEvents({ startMin, slotMin, slotsCount: slots.length });
  } else {
    // Haftalık görünüm
    const { startMin, slotMin, slots } = buildTimeSlots();

    // Açık günleri bul ve sırala
    const enabledDaysInWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(ui.weekStart, i);
      const dayOfWeek = d.getDay();
      if (isDayEnabled(dayOfWeek)) {
        enabledDaysInWeek.push({ dayIndex: i, dayOfWeek, date: d });
      }
    }

    const enabledCount = enabledDaysInWeek.length;
    // Grid column sayısını dinamik yap; gün sütunları min 180px (aynı saatte 2 randevu yan yana sığsın)
    grid.style.gridTemplateColumns = `74px repeat(${enabledCount}, minmax(180px, 1fr))`;

    // grid: rows = slots.length, cols = 1 (time) + enabledDaysInWeek.length
    for (let row = 0; row < slots.length; row++) {
      const minuteOfDay = slots[row];
      const tCell = document.createElement("div");
      tCell.className = "timeCell";
      tCell.textContent = minutesToTime(minuteOfDay);
      grid.appendChild(tCell);

      // Sadece açık günleri render et
      for (const { dayIndex, dayOfWeek, date } of enabledDaysInWeek) {
        const dStr = dateToInputValue(date);
        const wh = getWorkingHoursForDay(dayOfWeek);

        const cell = document.createElement("div");
        cell.className = "dayCell";

        // Çalışma saatleri dışındaki hücreleri gri/görünmez yap
        if (wh) {
          const cellMin = minuteOfDay;
          if (cellMin < wh.startMin || cellMin >= wh.endMin) {
            cell.classList.add("dayCell--disabled");
            cell.style.opacity = "0.25";
            cell.style.cursor = "not-allowed";
          }
        }

        if (dStr === nowDate && minuteOfDay === timeToMinutes(`${pad2(now.getHours())}:${pad2(now.getMinutes() - (now.getMinutes() % slotMin))}`)) {
          cell.classList.add("dayCell--now");
        }
        cell.id = `cell_${dayIndex}_${row}`;
        cell.dataset.day = String(dayIndex);
        cell.dataset.row = String(row);
        cell.dataset.date = dStr;
        cell.dataset.time = minutesToTime(minuteOfDay);
        tCell.dataset.row = String(row);
        cell.addEventListener("click", () => {
          if (wh && minuteOfDay >= wh.startMin && minuteOfDay < wh.endMin) {
            openGroupSessionModal(null, { date: dStr, time: minutesToTime(minuteOfDay) });
          }
        });
        grid.appendChild(cell);
      }
    }

    // events
    renderEvents({ startMin, slotMin, slotsCount: slots.length });
  }
}

function buildOverlapLayoutForWeek(inWeek) {
  // return: Map(sessionId -> { col, cols })
  const byDay = new Map(); // dayIdx -> session[]

  for (const s of inWeek) {
    const d = new Date(s.startTs);
    let dayIdx;
    if (ui.viewMode === "day") {
      // Günlük görünüm: sadece seçili günü kontrol et
      const currentDayStart = startOfDay(ui.currentDay).getTime();
      const sessionDayStart = startOfDay(d).getTime();
      if (sessionDayStart !== currentDayStart) continue; // Farklı gün, atla
      dayIdx = 0; // Günlük görünümde her zaman 0
    } else {
      // Haftalık görünüm
      dayIdx = Math.floor(
        (startOfDay(d).getTime() - startOfDay(ui.weekStart).getTime()) / (24 * 60 * 60 * 1000),
      );
      if (dayIdx < 0 || dayIdx > 6) continue;
    }
    if (!byDay.has(dayIdx)) byDay.set(dayIdx, []);
    byDay.get(dayIdx).push(s);
  }

  const layout = new Map();

  for (const [dayIdx, daySessions] of byDay.entries()) {
    // Aynı gün içinde çakışan seansları gruplandırıp kolon atayalım.
    const list = [...daySessions].sort((a, b) => a.startTs - b.startTs || a.endTs - b.endTs);

    let groupId = 0;
    let groupMaxCols = 0;
    let currentGroupIds = [];
    let active = []; // { id, endTs, col }

    const finalizeGroup = () => {
      const cols = Math.max(1, groupMaxCols);
      for (const id of currentGroupIds) {
        const prev = layout.get(id);
        if (prev) layout.set(id, { ...prev, cols });
      }
      groupId += 1;
      groupMaxCols = 0;
      currentGroupIds = [];
    };

    for (const s of list) {
      // aktiflerden bitenleri çıkar (endTs <= startTs ise artık çakışmıyor)
      active = active.filter((a) => a.endTs > s.startTs);

      // aktif boşaldıysa önceki overlap grubu bitti demektir
      if (active.length === 0 && currentGroupIds.length > 0) {
        finalizeGroup();
      }

      // en küçük boş kolonu bul
      const used = new Set(active.map((a) => a.col));
      let col = 0;
      while (used.has(col)) col += 1;

      active.push({ id: s.id, endTs: s.endTs, col });
      currentGroupIds.push(s.id);
      groupMaxCols = Math.max(groupMaxCols, active.length);

      layout.set(s.id, { col, cols: 1, dayIdx, groupId });
    }

    if (currentGroupIds.length > 0) {
      finalizeGroup();
    }
  }

  return layout;
}

function groupSessionsByStaffAndTime(inWeek) {
  // Aynı personelin çakışan seanslarını grupla
  // return: Map(groupKey -> { sessions[], staffId, roomId, startTs, endTs })
  const groups = new Map();

  for (const s of inWeek) {
    const d = new Date(s.startTs);
    let dayIdx;
    if (ui.viewMode === "day") {
      // Günlük görünüm: sadece seçili günü kontrol et
      const currentDayStart = startOfDay(ui.currentDay).getTime();
      const sessionDayStart = startOfDay(d).getTime();
      if (sessionDayStart !== currentDayStart) continue; // Farklı gün, atla
      dayIdx = 0; // Günlük görünümde her zaman 0
    } else {
      // Haftalık görünüm
      dayIdx = Math.floor((startOfDay(d).getTime() - startOfDay(ui.weekStart).getTime()) / (24 * 60 * 60 * 1000));
      if (dayIdx < 0 || dayIdx > 6) continue;
    }

    // Aynı personelin çakışan seanslarını bul
    let foundGroup = null;
    for (const [key, group] of groups.entries()) {
      if (
        group.staffId === s.staffId &&
        group.dayIdx === dayIdx &&
        overlaps(group.startTs, group.endTs, s.startTs, s.endTs)
      ) {
        foundGroup = group;
        break;
      }
    }

    if (foundGroup) {
      // Mevcut gruba ekle
      foundGroup.sessions.push(s);
      foundGroup.startTs = Math.min(foundGroup.startTs, s.startTs);
      foundGroup.endTs = Math.max(foundGroup.endTs, s.endTs);
    } else {
      // Yeni grup oluştur
      const key = `staff_${s.staffId}_day_${dayIdx}_${s.startTs}`;
      groups.set(key, {
        sessions: [s],
        staffId: s.staffId,
        roomId: s.roomId,
        dayIdx,
        startTs: s.startTs,
        endTs: s.endTs,
      });
    }
  }

  return groups;
}

function renderEvents({ startMin, slotMin, slotsCount }) {
  // Önce mevcut event DOM'larını temizlemek için grid içindeki tüm event'leri kaldır.
  document.querySelectorAll(".event").forEach((e) => e.remove());
  document.querySelectorAll(".dayCell--raise").forEach((e) => e.classList.remove("dayCell--raise"));

  let inWeek;
  if (ui.viewMode === "day") {
    // Günlük görünüm: sadece seçili günün seansları
    const dayStartTs = startOfDay(ui.currentDay).getTime();
    const dayEndTs = addDays(ui.currentDay, 1).getTime();
    inWeek = state.sessions.filter((s) => s.startTs >= dayStartTs && s.startTs < dayEndTs);
  } else {
    // Haftalık görünüm
    const weekStartTs = ui.weekStart.getTime();
    const weekEndTs = addDays(ui.weekStart, 7).getTime();
    inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);
  }

  const staffGroups = groupSessionsByStaffAndTime(inWeek);
  const overlapLayout = buildOverlapLayoutForWeek(inWeek);

  // Hücre başına kart sayısı (layout.cols hatalı olabildiği için gerçek sayıyı kullanıyoruz)
  const sessionInMultiGroup = new Set();
  for (const [, group] of staffGroups.entries()) {
    if (group.sessions.length > 1) {
      for (const sess of group.sessions) sessionInMultiGroup.add(sess.id);
    }
  }
  const cellEventCount = new Map();
  function addToCell(dayIdx, row) {
    if (row < 0 || row >= slotsCount) return;
    const key = `${dayIdx}_${row}`;
    cellEventCount.set(key, (cellEventCount.get(key) || 0) + 1);
  }
  for (const [, group] of staffGroups.entries()) {
    if (group.sessions.length <= 1) continue;
    const d = new Date(group.startTs);
    const dayIdx = group.dayIdx;
    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((group.startTs - dayStartTs) / 60000);
    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    addToCell(dayIdx, row);
  }
  for (const s of inWeek) {
    if (sessionInMultiGroup.has(s.id)) continue;
    const d = new Date(s.startTs);
    let dayIdx;
    if (ui.viewMode === "day") dayIdx = 0;
    else {
      dayIdx = Math.floor((startOfDay(d).getTime() - startOfDay(ui.weekStart).getTime()) / (24 * 60 * 60 * 1000));
      if (dayIdx < 0 || dayIdx > 6) continue;
    }
    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((s.startTs - dayStartTs) / 60000);
    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    addToCell(dayIdx, row);
  }

  // Render edilmiş seansları takip et (grup içindeki seansları tekrar render etmemek için)
  const renderedSessionIds = new Set();

  // Satır yüksekliklerini takip et: row -> maxHeight
  const rowHeights = new Map();

  // Önce grupları render et
  for (const [key, group] of staffGroups.entries()) {
    if (group.sessions.length === 1) continue; // Tek seanslı grupları atla (aşağıda normal render edilecek)

    const s = group.sessions[0]; // İlk seansı referans al
    const d = new Date(group.startTs);
    const dayIdx = group.dayIdx;

    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((group.startTs - dayStartTs) / 60000);
    const endMinOfDay = Math.ceil((group.endTs - dayStartTs) / 60000);

    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    if (row < 0 || row >= slotsCount) continue;

    const cellKey = `${dayIdx}_${row}`;
    const colsInCell = Math.max(1, cellEventCount.get(cellKey) || 1);

    const rowStartMin = startMin + row * slotMin;
    const withinCellMin = startMinOfDay - rowStartMin;
    const topPx = 4 + (withinCellMin / slotMin) * CELL_HEIGHT_PX;
    const durMin = Math.max(15, endMinOfDay - startMinOfDay);
    const heightPx = Math.max(32, (durMin / slotMin) * CELL_HEIGHT_PX - 8);

    const cell = document.getElementById(`cell_${dayIdx}_${row}`);
    if (!cell) continue;
    cell.classList.add("dayCell--raise");

    const ev = document.createElement("div");
    ev.className = "event event--group";
    ev.style.top = `${topPx}px`;
    ev.style.height = "auto";
    ev.style.minHeight = `${heightPx}px`;
    ev.style.zIndex = "10";

    // Çakışan seanslar için kolon: hücredeki gerçek kart sayısını kullan (layout.cols bazen hatalı)
    const layout = overlapLayout.get(s.id) || { col: 0, cols: 1 };
    const cols = colsInCell;
    const col = Math.max(0, Math.min(Number(layout.col || 0), cols - 1));

    const sidePad = 6;
    const MIN_EVENT_WIDTH = 100;
    let gap = cols > 1 ? 6 : 0;
    let available = Math.max(0, cell.clientWidth - sidePad * 2);
    // Günlük görünümde aynı saatte birden fazla kartı yan yana eşit dağıtmak için hücre genişliği yoksa/azsa grid genişliğini kullan
    if (ui.viewMode === "day" && cols > 1 && (available < 80 || !cell.clientWidth) && els.plannerGrid && els.plannerGrid.clientWidth > 74) {
      available = Math.max(available, els.plannerGrid.clientWidth - 74 - sidePad * 2);
    }
    let width = cols > 0 ? (available - gap * (cols - 1)) / cols : available;
    if (width < 110 && cols > 1) {
      gap = 3;
      width = (available - gap * (cols - 1)) / cols;
    }
    // Aynı hücrede birden fazla kart varsa (aynı gün/saat, farklı personel) hepsinin sığması için min genişlik sadece tek kartta uygula
    if (cols === 1) width = Math.max(MIN_EVENT_WIDTH, width);
    const isCompact = width < 140;

    const left = sidePad + col * (width + gap);
    ev.style.left = `${left}px`;
    ev.style.width = `${width}px`;
    ev.style.maxWidth = `${width}px`;
    ev.style.right = "auto";
    ev.dataset.col = String(col);
    ev.dataset.cols = String(cols);
    if (isCompact) ev.classList.add("event--compact");

    const staff = getStaffById(group.staffId);
    const room = getRoomById(group.roomId);
    const color = staffColor(group.staffId);
    const memberShortNames = group.sessions.map((sess) => {
      const m = getMemberById(sess.memberId);
      return getMemberShortName(m);
    });

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);
    const fullTitle = `${group.sessions.length} seans • ${room?.name || "Oda"} • ${getStaffFullName(staff)} • ${startTime}-${endTime}`;
    const staffShort = getStaffShortName(staff);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;

    if (isCompact) {
      ev.innerHTML = `
        <div class="event__row event__row--single">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          <button class="event__deleteBtn" title="Tüm seansları iptal et" data-staff-id="${group.staffId}" data-start-ts="${group.startTs}" data-end-ts="${group.endTs}" data-room-id="${group.roomId}">🗑️</button>
        </div>
        <div class="event__members">${memberShortNames.map((n) => escapeHtml(n)).join("<br>")}</div>
      `;
    } else {
      ev.innerHTML = `
        <div class="event__row event__row--head">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          <button class="event__deleteBtn" title="Tüm seansları iptal et" data-staff-id="${group.staffId}" data-start-ts="${group.startTs}" data-end-ts="${group.endTs}" data-room-id="${group.roomId}">🗑️</button>
        </div>
        <div class="event__members">${memberShortNames.map((n) => escapeHtml(n)).join("<br>")}</div>
      `;
    }
    
    // Silme butonu event listener (grup silindiğinde state + API'den kaldır)
    const deleteBtn = ev.querySelector(".event__deleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const staffId = deleteBtn.dataset.staffId;
        const startTs = parseInt(deleteBtn.dataset.startTs, 10);
        const endTs = parseInt(deleteBtn.dataset.endTs, 10);
        const roomId = deleteBtn.dataset.roomId;

        const staff = getStaffById(staffId);
        const staffName = getStaffFullName(staff);
        const sessionCount = group.sessions.length;

        if (confirm(`${staffName} personelinin bu saatteki ${sessionCount} seansını iptal etmek istediğinize emin misiniz?`)) {
          const toRemove = state.sessions.filter(s =>
            normId(s.staffId) === normId(staffId) &&
            overlaps(s.startTs, s.endTs, startTs, endTs) &&
            normId(s.roomId) === normId(roomId)
          );
          const idsToRemove = new Set(toRemove.map(s => normId(s.id)));
          state.sessions = state.sessions.filter(x => !idsToRemove.has(normId(x.id)));
          for (const sess of toRemove) {
            if (window.API && window.API.getToken()) {
              window.API.deleteSession(sess.id).catch(() => {});
            }
          }
          saveState();
          render();
        }
      });
    }

    // Grup bloğuna tıklanınca grup seans detay modalını aç
    ev.addEventListener("click", (e) => {
      e.stopPropagation();
      openGroupSessionModal(group);
    });

    cell.appendChild(ev);

    // Bu gruptaki seansları işaretle
    for (const sess of group.sessions) {
      renderedSessionIds.add(sess.id);
    }
  }

  // Grup event'leri sonrası satır yükseklikleri (tüm event'ler bittikten sonra tekrar çağrılacak)
  setTimeout(() => {
    measureAndUpdateRowHeights(rowHeights);
  }, 0);

  // Grup olmayan seansları normal şekilde render et
  for (const s of inWeek) {
    if (renderedSessionIds.has(s.id)) continue; // Grup içinde render edilmiş, atla

    const d = new Date(s.startTs);
    let dayIdx;
    if (ui.viewMode === "day") {
      // Günlük görünüm: her zaman 0
      dayIdx = 0;
    } else {
      // Haftalık görünüm
      dayIdx = Math.floor((startOfDay(d).getTime() - startOfDay(ui.weekStart).getTime()) / (24 * 60 * 60 * 1000));
      if (dayIdx < 0 || dayIdx > 6) continue;
    }

    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((s.startTs - dayStartTs) / 60000);
    const endMinOfDay = Math.ceil((s.endTs - dayStartTs) / 60000);

    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    if (row < 0 || row >= slotsCount) continue;

    const cellKeySingle = `${dayIdx}_${row}`;
    const colsInCellSingle = Math.max(1, cellEventCount.get(cellKeySingle) || 1);

    const rowStartMin = startMin + row * slotMin;
    const withinCellMin = startMinOfDay - rowStartMin;
    const topPx = 4 + (withinCellMin / slotMin) * CELL_HEIGHT_PX;
    const durMin = Math.max(15, endMinOfDay - startMinOfDay);
    const heightPx = Math.max(32, (durMin / slotMin) * CELL_HEIGHT_PX - 8);

    const cell = document.getElementById(`cell_${dayIdx}_${row}`);
    if (!cell) continue;
    cell.classList.add("dayCell--raise");

    const ev = document.createElement("div");
    ev.className = "event";
    ev.style.top = `${topPx}px`;
    ev.style.height = "auto";
    ev.style.minHeight = `${heightPx}px`;
    ev.style.zIndex = "10";

    // Çakışan seanslar için kolon: hücredeki gerçek kart sayısını kullan (layout.cols bazen hatalı)
    const layout = overlapLayout.get(s.id) || { col: 0, cols: 1 };
    const cols = colsInCellSingle;
    const col = Math.max(0, Math.min(Number(layout.col || 0), cols - 1));

    const sidePad = 6;
    const MIN_EVENT_WIDTH = 100;
    let gap = cols > 1 ? 6 : 0;
    let available = Math.max(0, cell.clientWidth - sidePad * 2);
    // Günlük görünümde aynı saatte birden fazla kartı yan yana eşit dağıtmak için hücre genişliği yoksa/azsa grid genişliğini kullan
    if (ui.viewMode === "day" && cols > 1 && (available < 80 || !cell.clientWidth) && els.plannerGrid && els.plannerGrid.clientWidth > 74) {
      available = Math.max(available, els.plannerGrid.clientWidth - 74 - sidePad * 2);
    }
    let width = cols > 0 ? (available - gap * (cols - 1)) / cols : available;
    if (width < 110 && cols > 1) {
      gap = 3;
      width = (available - gap * (cols - 1)) / cols;
    }
    // Aynı hücrede birden fazla kart varsa (aynı gün/saat, farklı personel) hepsinin sığması için min genişlik sadece tek kartta uygula
    if (cols === 1) width = Math.max(MIN_EVENT_WIDTH, width);
    const isCompact = width < 140;

    const left = sidePad + col * (width + gap);
    ev.style.left = `${left}px`;
    ev.style.width = `${width}px`;
    ev.style.maxWidth = `${width}px`;
    ev.style.right = "auto";
    ev.dataset.col = String(col);
    ev.dataset.cols = String(cols);
    if (isCompact) ev.classList.add("event--compact");

    const member = getMemberById(s.memberId);
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const color = staffColor(s.staffId);

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);
    const fullTitle = `${member?.name || "Üye"} • ${room?.name || "Oda"} • ${getStaffFullName(staff)} • ${startTime}-${endTime}`;
    const staffShort = getStaffShortName(staff);
    const memberShort = getMemberShortName(member);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;

    if (isCompact) {
      ev.innerHTML = `
        <div class="event__row event__row--single">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          <button class="event__deleteBtn" title="Seansı iptal et" data-session-id="${s.id}" type="button">🗑️</button>
        </div>
        <div class="event__members">${escapeHtml(memberShort)}</div>
      `;
    } else {
      ev.innerHTML = `
        <div class="event__row event__row--head">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          <button class="event__deleteBtn" title="Seansı iptal et" data-session-id="${s.id}" type="button">🗑️</button>
        </div>
        <div class="event__members">${escapeHtml(memberShort)}</div>
      `;
    }

    const singleDeleteBtn = ev.querySelector(".event__deleteBtn");
    if (singleDeleteBtn) {
      singleDeleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Bu seansı iptal etmek istediğinize emin misiniz?")) {
          const id = singleDeleteBtn.dataset.sessionId;
          state.sessions = state.sessions.filter(x => normId(x.id) !== normId(id));
          if (window.API && window.API.getToken()) {
            window.API.deleteSession(id).catch(() => {});
          }
          saveState();
          render();
        }
      });
    }

    ev.addEventListener("click", (e) => {
      if (e.target.closest(".event__deleteBtn")) return;
      e.stopPropagation();
      const group = getGroupForSession(s);
      openGroupSessionModal(group);
    });

    cell.appendChild(ev);
  }

  // Tüm event'ler render edildikten sonra yükseklikleri ölç ve kartları hücre genişliğine göre eşit dağıt (günlük + haftalık)
  setTimeout(() => {
    measureAndUpdateRowHeights(rowHeights);
    repositionOverlappingEvents();
  }, 0);
}

/** Aynı hücredeki kartları hücre genişliğine göre yan yana eşit dağıt (layout sonrası; günlük ve haftalık görünüm) */
function repositionOverlappingEvents() {
  if (!els.plannerGrid) return;
  const cells = els.plannerGrid.querySelectorAll(".dayCell");
  const sidePad = 6;
  const gap = 6;
  cells.forEach((cell) => {
    const events = cell.querySelectorAll(".event");
    if (events.length <= 1) return;
    // Hücredeki tüm kartların cols değerlerinin en büyüğünü kullan; böylece "2 yan yana 1 açıkta" olmaz
    let maxCol = 0;
    let cols = 1;
    events.forEach((ev) => {
      const c = Math.max(0, parseInt(ev.dataset.col || "0", 10));
      const cs = Math.max(1, parseInt(ev.dataset.cols || "1", 10));
      if (c > maxCol) maxCol = c;
      if (cs > cols) cols = cs;
    });
    cols = Math.max(cols, maxCol + 1);
    const available = Math.max(0, cell.clientWidth - sidePad * 2);
    const width = Math.max(0, (available - gap * (cols - 1)) / cols);
    events.forEach((ev) => {
      const col = Math.max(0, parseInt(ev.dataset.col || "0", 10));
      const left = sidePad + col * (width + gap);
      ev.style.left = `${left}px`;
      ev.style.width = `${width}px`;
      ev.style.maxWidth = `${width}px`;
    });
  });
}

function measureAndUpdateRowHeights(rowHeights) {
  // Tüm event'leri bul ve her satır için en uzun event'in yüksekliğini bul
  const allEvents = document.querySelectorAll(".event");
  
  for (const ev of allEvents) {
    const cell = ev.closest(".dayCell");
    if (!cell) continue;
    
    const row = parseInt(cell.dataset.row);
    if (isNaN(row)) continue;
    
    // Event'in gerçek yüksekliğini ölç (top + height + padding)
    const top = parseFloat(ev.style.top) || 0;
    const height = ev.offsetHeight;
    const totalHeight = top + height + 8; // 8px padding
    
    const currentMax = rowHeights.get(row) || 64;
    rowHeights.set(row, Math.max(currentMax, totalHeight));
  }
  
  // Her satır için yüksekliği ayarla
  for (const [row, height] of rowHeights.entries()) {
    updateRowHeight(row, height);
  }
}

function updateRowHeight(row, height) {
  // Belirli bir satırdaki tüm hücrelerin (timeCell + dayCell'ler) yüksekliğini ayarla
  const grid = els.plannerGrid;
  const allCells = grid.querySelectorAll(`[data-row="${row}"]`);
  
  const finalHeight = Math.max(64, Math.ceil(height));
  for (const cell of allCells) {
    if (cell.classList.contains("timeCell") || cell.classList.contains("dayCell")) {
      cell.style.height = `${finalHeight}px`;
      cell.style.minHeight = `${finalHeight}px`;
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Her personel için kendine özgü, birbirinden ayrışan renk paleti (HSL) */
const STAFF_COLOR_PALETTE = [
  { h: 265, s: 75 },  // mor
  { h: 45, s: 85 },   // amber/sarı
  { h: 165, s: 55 },  // yeşil-turkuaz
  { h: 340, s: 70 },  // pembe-kırmızı
  { h: 195, s: 75 },  // mavi
  { h: 25, s: 90 },   // turuncu
  { h: 290, s: 65 },  // eflatun
  { h: 140, s: 60 },  // yeşil
  { h: 0, s: 70 },    // kırmızı
  { h: 220, s: 70 },  // lacivert
  { h: 50, s: 80 },   // altın
  { h: 180, s: 60 },  // camgöbeği
];

function staffColor(staffId) {
  // Personel indeksine veya ID hash'ine göre paletten renk seç (her personel kendine özgü)
  const id = normId(staffId);
  const idx = state.staff.findIndex((s) => normId(s.id) === id);
  const paletteIdx = idx >= 0 ? idx % STAFF_COLOR_PALETTE.length : (id.length ? [...id].reduce((a, c) => (a * 17 + c.charCodeAt(0)) % STAFF_COLOR_PALETTE.length, 0) : 0);
  const { h: hue, s: sat } = STAFF_COLOR_PALETTE[paletteIdx];
  const border = `hsla(${hue}, ${sat}%, 62%, .82)`;
  const bg = `hsla(${hue}, ${sat}%, 55%, .28)`;
  const badge = `hsla(${hue}, ${sat}%, 70%, .22)`;
  return { hue, border, bg, badge };
}

function updateRoomsSummary() {
  if (state.rooms.length === 0) {
    els.roomsSummary.textContent = "Oda ayarlanmadı";
    return;
  }
  const summaries = state.rooms.map((r) => `${r.name} (${r.devices} alet)`);
  els.roomsSummary.textContent = summaries.slice(0, 2).join(", ") + (summaries.length > 2 ? "..." : "");
}

function renderRooms() {
  const wrap = els.roomsList;
  wrap.innerHTML = "";
  for (const r of state.rooms) {
    const item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML = `
      <div class="listItem__left" style="flex:1;">
        <div class="listItem__title">${escapeHtml(r.name)}</div>
        <div class="listItem__meta">Alet sayısı</div>
      </div>
      <div class="listItem__actions" style="display:flex; gap:8px; align-items:center;">
        <input class="input" style="width:90px" type="number" min="1" step="1" value="${r.devices}" aria-label="Alet sayısı" data-room-id="${r.id}" />
        <button class="btn btn--xs btn--ghost" type="button" data-room-id="${r.id}">Sil</button>
      </div>
    `;
    const input = item.querySelector("input");
    const deleteBtn = item.querySelector("button");

    input.addEventListener("change", () => {
      const v = clamp(Number(input.value || 1), 1, 999);
      r.devices = v;
      saveState();
      updateRoomsSummary();
      render(); // kapasite değişti
    });

    deleteBtn.addEventListener("click", () => {
      // Bu odaya bağlı seanslar var mı kontrol et
      const hasSessions = state.sessions.some((s) => s.roomId === r.id);
      if (hasSessions) {
        if (!confirm(`"${r.name}" odasına bağlı seanslar var. Yine de silmek istiyor musunuz?`)) return;
      }
      state.rooms = state.rooms.filter((x) => x.id !== r.id);
      saveState();
      updateRoomsSummary();
      renderRooms(); // Modal içindeki listeyi yenile
      render(); // Ana görünümü yenile
    });

    wrap.appendChild(item);
  }
}

function openRoomsModal() {
  els.roomsError.classList.add("hidden");
  renderRooms();
  els.newRoomName.value = "";
  els.newRoomDevices.value = "1";
  els.roomsModal.classList.remove("hidden");
}

function closeRoomsModal() {
  els.roomsModal.classList.add("hidden");
}

function updateStaffSummary() {
  if (state.staff.length === 0) {
    els.staffSummary.textContent = "Personel ayarlanmadı";
    return;
  }
  const summaries = state.staff.map((s) => getStaffFullName(s));
  els.staffSummary.textContent = summaries.slice(0, 2).join(", ") + (summaries.length > 2 ? "..." : "");
}

function renderStaff() {
  const wrap = els.staffList;
  wrap.innerHTML = "";
  for (const s of state.staff) {
    const fullName = getStaffFullName(s);
    const card = document.createElement("div");
    card.className = "panel";
    card.style.padding = "12px";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-weight:800; font-size:15px; margin-bottom:4px;">${escapeHtml(fullName)}</div>
          <div style="font-size:12px; color:var(--muted); margin-bottom:2px;">
            ${escapeHtml(displayPhone(s.phone) || "Telefon yok")}
          </div>
        </div>
        <button class="btn btn--xs btn--ghost" type="button" data-staff-id="${s.id}" data-action="edit">Düzenle</button>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:8px; padding-top:8px; border-top:1px solid var(--border);">
        Çalışma saatleri: ${getStaffWorkingHoursSummary(s)}
      </div>
    `;
    const editBtn = card.querySelector("button[data-action='edit']");
    editBtn.addEventListener("click", () => {
      openStaffCardModal(s.id);
    });
    wrap.appendChild(card);
  }
}

function getStaffWorkingHoursSummary(staff) {
  if (!staff || !staff.workingHours) return "Ayarlanmamış";
  const dayNamesShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const summaries = [];
  for (let day = 0; day < 7; day++) {
    const wh = staff.workingHours[day];
    if (wh && wh.enabled && wh.start && wh.end) {
      summaries.push(`${dayNamesShort[day]}: ${wh.start}-${wh.end}`);
    }
  }
  return summaries.length > 0 ? summaries.slice(0, 2).join(", ") + (summaries.length > 2 ? "..." : "") : "Ayarlanmamış";
}

function openStaffModal() {
  els.staffError.classList.add("hidden");
  renderStaff();
  els.newStaffFirstName.value = "";
  els.newStaffLastName.value = "";
  els.newStaffPhone.value = "";
  
  // Telefon alanına otomatik formatlama ekle
  if (els.newStaffPhone) {
    els.newStaffPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.newStaffPhone.addEventListener("blur", formatPhoneOnBlur);
  }
  
  els.staffModal.classList.remove("hidden");
}

function closeStaffModal() {
  els.staffModal.classList.add("hidden");
}

function openStaffCardModal(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  els.staffCardError.classList.add("hidden");
  els.staffCardTitle.textContent = `Personel Kartı: ${getStaffFullName(staff)}`;

  // Temel bilgiler
  els.editStaffFirstName.value = staff.firstName || "";
  els.editStaffLastName.value = staff.lastName || "";
  els.editStaffPhone.value = displayPhone(staff.phone) || "";
  
  // Telefon alanına otomatik formatlama ekle
  if (els.editStaffPhone) {
    els.editStaffPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.editStaffPhone.addEventListener("blur", formatPhoneOnBlur);
  }

  // Çalışma saatleri
  const whList = els.staffCardWorkingHours;
  whList.innerHTML = "";

  for (let day = 0; day < 7; day++) {
    const wh = staff.workingHours?.[day] || { start: "08:00", end: "20:00", enabled: false };
    const enabled = wh.enabled !== false;
    const item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML = `
      <div class="listItem__left" style="flex:1; display:flex; align-items:center; gap:10px;">
        <input type="checkbox" id="staff_wh_enabled_${day}" data-day="${day}" ${enabled ? "checked" : ""} style="cursor:pointer;" />
        <label for="staff_wh_enabled_${day}" style="cursor:pointer; flex:1;">
          <div class="listItem__title">${DAY_NAMES[day]}</div>
        </label>
      </div>
      <div class="listItem__actions" style="display:flex; gap:8px; align-items:center;">
        <input class="input" type="time" data-day="${day}" data-type="start" value="${wh.start || "08:00"}" style="width:100px;" ${!enabled ? "disabled" : ""} />
        <span style="color:var(--muted);">–</span>
        <input class="input" type="time" data-day="${day}" data-type="end" value="${wh.end || "20:00"}" style="width:100px;" ${!enabled ? "disabled" : ""} />
      </div>
    `;
    const checkbox = item.querySelector(`#staff_wh_enabled_${day}`);
    const startInput = item.querySelector(`input[data-type="start"][data-day="${day}"]`);
    const endInput = item.querySelector(`input[data-type="end"][data-day="${day}"]`);

    checkbox.addEventListener("change", (e) => {
      const checked = e.target.checked;
      startInput.disabled = !checked;
      endInput.disabled = !checked;
    });

    whList.appendChild(item);
  }

  // Event listener'ları temizle ve yeniden ekle
  els.saveStaffCardBtn.onclick = () => saveStaffCard(staffId);
  els.deleteStaffCardBtn.onclick = () => deleteStaffCard(staffId);

  els.staffCardModal.classList.remove("hidden");
}

function closeStaffCardModal() {
  els.staffCardModal.classList.add("hidden");
}

function saveStaffCard(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  els.staffCardError.classList.add("hidden");

  const firstName = (els.editStaffFirstName.value || "").trim();
  const lastName = (els.editStaffLastName.value || "").trim();
  const phoneRaw = (els.editStaffPhone.value || "").trim();
  const phone = phoneRaw ? toPhoneFormat(phoneRaw) : "";

  if (!firstName || !lastName) {
    els.staffCardError.textContent = "Ad ve soyad girin.";
    els.staffCardError.classList.remove("hidden");
    return;
  }
  if (phoneRaw && !phone) {
    els.staffCardError.textContent = "Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.";
    els.staffCardError.classList.remove("hidden");
    return;
  }

  // Çalışma saatlerini topla
  const checkboxes = els.staffCardWorkingHours.querySelectorAll("input[type='checkbox']");
  const timeInputs = els.staffCardWorkingHours.querySelectorAll("input[type='time']");
  const newWorkingHours = {};

  for (const checkbox of checkboxes) {
    const day = Number(checkbox.dataset.day);
    newWorkingHours[day] = { enabled: checkbox.checked };
  }

  for (const input of timeInputs) {
    if (input.disabled) continue;
    const day = Number(input.dataset.day);
    const type = input.dataset.type;
    const value = input.value;

    if (!newWorkingHours[day]) newWorkingHours[day] = { enabled: false };
    newWorkingHours[day][type] = value;
  }

  // Doğrulama
  for (const day in newWorkingHours) {
    const wh = newWorkingHours[day];
    if (!wh.enabled) continue;

    if (!wh.start || !wh.end) {
      els.staffCardError.textContent = `${DAY_NAMES[Number(day)]} için başlangıç ve bitiş saati girin.`;
      els.staffCardError.classList.remove("hidden");
      return;
    }
    const startMin = timeToMinutes(wh.start);
    const endMin = timeToMinutes(wh.end);
    if (endMin <= startMin) {
      els.staffCardError.textContent = `${DAY_NAMES[Number(day)]} için bitiş saati, başlangıçtan sonra olmalı.`;
      els.staffCardError.classList.remove("hidden");
      return;
    }
  }

  // Güncelle
  staff.firstName = firstName;
  staff.lastName = lastName;
  staff.phone = phone || "";
  staff.workingHours = newWorkingHours;

  saveState();
  closeStaffCardModal();
  updateStaffSummary();
  renderStaff(); // Personel listesini yenile
  render(); // Ana görünümü yenile
}

function deleteStaffCard(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  const fullName = getStaffFullName(staff);
  const hasSessions = state.sessions.some((sess) => sess.staffId === staffId);
  if (hasSessions) {
    if (!confirm(`"${fullName}" personeline bağlı seanslar var. Yine de silmek istiyor musunuz?`)) return;
  }

  state.staff = state.staff.filter((x) => x.id !== staffId);
  saveState();
  closeStaffCardModal();
  updateStaffSummary();
  renderStaff();
  render();
}

function getMemberDisplayName(m) {
  return (m && (m.name || ((m.firstName || "") + " " + (m.lastName || "")).trim())) || "Üye";
}

function renderMembers() {
  const wrap = els.membersList;
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const m of state.members) {
    const item = document.createElement("div");
    item.className = "listItem";
    const name = getMemberDisplayName(m);
    const meta = (m.memberNo || m.phone) ? [m.memberNo, displayPhone(m.phone)].filter(Boolean).join(" · ") : "Üye";
    item.innerHTML = `
      <div class="listItem__left">
        <div class="listItem__title">${escapeHtml(name)}</div>
        <div class="listItem__meta">${escapeHtml(meta)}</div>
      </div>
      <div class="listItem__actions">
        <button class="btn btn--xs btn--ghost" type="button" data-action="card">Kimlik Kartı</button>
        <button class="btn btn--xs btn--ghost" type="button" data-action="delete">Sil</button>
      </div>
    `;
    item.querySelector('[data-action="card"]').addEventListener("click", () => openMemberCard(m.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteMemberFromList(m.id));
    wrap.appendChild(item);
  }
}

function openMemberCard(memberId) {
  ui.editingMemberId = memberId;
  const m = memberId ? state.members.find((x) => x.id === normId(memberId)) : null;
  if (els.memberCardTitle) els.memberCardTitle.textContent = m ? "Üye Kimlik Kartı – Düzenle" : "Üye Kimlik Kartı – Yeni";
  // Üye numarası: yeni üyede gizli, düzenlemede görünür
  if (els.mcMemberNo) {
    const memberNoRow = els.mcMemberNo.closest('.formRow');
    if (m) {
      // Düzenleme: göster ve readonly yap
      els.mcMemberNo.value = m.memberNo || "";
      els.mcMemberNo.placeholder = "";
      if (memberNoRow) memberNoRow.style.display = "";
    } else {
      // Yeni üye: gizle
      els.mcMemberNo.value = "";
      if (memberNoRow) memberNoRow.style.display = "none";
    }
  }
  if (els.mcFirstName) els.mcFirstName.value = m ? (m.firstName || "") : "";
  if (els.mcLastName) els.mcLastName.value = m ? (m.lastName || "") : "";
  if (els.mcPhone) els.mcPhone.value = m ? (displayPhone(m.phone) || "") : "";
  if (els.mcEmail) els.mcEmail.value = m ? (m.email || "") : "";
  if (els.mcBirthDate) els.mcBirthDate.value = m && m.birthDate ? (m.birthDate.slice ? m.birthDate.slice(0, 10) : m.birthDate) : "";
  if (els.mcProfession) els.mcProfession.value = m ? (m.profession || "") : "";
  if (els.mcAddress) els.mcAddress.value = m ? (m.address || "") : "";
  if (els.mcContactName) els.mcContactName.value = m ? (m.contactName || "") : "";
  if (els.mcContactPhone) els.mcContactPhone.value = m ? (displayPhone(m.contactPhone) || "") : "";
  if (els.mcSystemicDiseases) els.mcSystemicDiseases.value = m ? (m.systemicDiseases || "") : "";
  if (els.mcClinicalConditions) els.mcClinicalConditions.value = m ? (m.clinicalConditions || "") : "";
  if (els.mcPastOperations) els.mcPastOperations.value = m ? (m.pastOperations || "") : "";
  if (els.memberCardError) { els.memberCardError.classList.add("hidden"); els.memberCardError.textContent = ""; }
  if (els.deleteMemberCardBtn) els.deleteMemberCardBtn.style.display = m ? "inline-block" : "none";
  
  // Telefon alanlarına otomatik formatlama ekle
  if (els.mcPhone) {
    els.mcPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.mcPhone.addEventListener("blur", formatPhoneOnBlur);
  }
  if (els.mcContactPhone) {
    els.mcContactPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.mcContactPhone.addEventListener("blur", formatPhoneOnBlur);
  }
  
  if (els.memberCardModal) els.memberCardModal.classList.remove("hidden");
}

function formatPhoneOnBlur(e) {
  const input = e.target;
  const raw = (input.value || "").replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  if (raw.length === PHONE_MAX_DIGITS) {
    input.value = `(${raw.slice(0, 3)})${raw.slice(3, 6)}-${raw.slice(6, 8)}-${raw.slice(8, 10)}`;
  }
}

function closeMemberCardModal() {
  if (els.memberCardModal) els.memberCardModal.classList.add("hidden");
  ui.editingMemberId = null;
}

async function saveMemberCard() {
  const firstName = (els.mcFirstName && els.mcFirstName.value || "").trim();
  const lastName = (els.mcLastName && els.mcLastName.value || "").trim();
  const phoneRaw = (els.mcPhone && els.mcPhone.value || "").trim();
  const phone = toPhoneFormat(phoneRaw);
  if (!firstName || !lastName) {
    if (els.memberCardError) {
      els.memberCardError.textContent = "* Ad ve soyad zorunludur.";
      els.memberCardError.classList.remove("hidden");
    }
    return;
  }
  if (!phoneRaw) {
    if (els.memberCardError) {
      els.memberCardError.textContent = "* Telefon zorunludur.";
      els.memberCardError.classList.remove("hidden");
    }
    return;
  }
  if (!phone) {
    if (els.memberCardError) {
      els.memberCardError.textContent = "Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.";
      els.memberCardError.classList.remove("hidden");
    }
    return;
  }
  const contactPhoneRaw = (els.mcContactPhone && els.mcContactPhone.value || "").trim();
  const contactPhone = contactPhoneRaw ? toPhoneFormat(contactPhoneRaw) : null;
  if (contactPhoneRaw && !contactPhone) {
    if (els.memberCardError) {
      els.memberCardError.textContent = "Yakını telefonu (xxx)xxx-xx-xx formatında olmalı, 10 hane.";
      els.memberCardError.classList.remove("hidden");
    }
    return;
  }
  // Yeni üyede üye numarası backend tarafından otomatik atanır (FP001, FP002...); düzenlemede mevcut numara gönderilir
  const payload = {
    firstName,
    lastName,
    phone,
    email: (els.mcEmail && els.mcEmail.value || "").trim() || null,
    birthDate: (els.mcBirthDate && els.mcBirthDate.value) || null,
    profession: (els.mcProfession && els.mcProfession.value || "").trim() || null,
    address: (els.mcAddress && els.mcAddress.value || "").trim() || null,
    contactName: (els.mcContactName && els.mcContactName.value || "").trim() || null,
    contactPhone,
    systemicDiseases: (els.mcSystemicDiseases && els.mcSystemicDiseases.value || "").trim() || null,
    clinicalConditions: (els.mcClinicalConditions && els.mcClinicalConditions.value || "").trim() || null,
    pastOperations: (els.mcPastOperations && els.mcPastOperations.value || "").trim() || null,
    notes: null,
  };
  // Düzenlemede üye numarası gönderilir; yeni üyede gönderilmez (backend otomatik atar)
  if (ui.editingMemberId && els.mcMemberNo) {
    const memberNo = (els.mcMemberNo.value || "").trim();
    if (memberNo) payload.memberNo = memberNo;
  }
  if (els.memberCardError) { els.memberCardError.classList.add("hidden"); els.memberCardError.textContent = ""; }
  if (window.API && window.API.getToken()) {
    try {
      if (ui.editingMemberId) {
        const updated = await window.API.updateMember(ui.editingMemberId, { ...payload, id: ui.editingMemberId });
        const idx = state.members.findIndex((x) => x.id === normId(ui.editingMemberId));
        if (idx >= 0) state.members[idx] = updated;
      } else {
        const created = await window.API.createMember(payload);
        state.members.push(created);
      }
    } catch (e) {
      if (els.memberCardError) {
        let errorMsg = "Kaydedilemedi.";
        if (e.data) {
          if (e.data.errors && Array.isArray(e.data.errors)) {
            // Validation errors array
            errorMsg = e.data.errors.map(err => err.msg || err.param).join(', ');
          } else if (e.data.error) {
            errorMsg = e.data.error;
            if (e.data.detail) {
              errorMsg += ` (${e.data.detail})`;
            }
            if (e.data.code) {
              errorMsg += ` [Kod: ${e.data.code}]`;
            }
          } else if (e.data.details) {
            errorMsg = `${e.data.error || 'Hata'}: ${e.data.details}`;
          }
        } else if (e.message) {
          errorMsg = e.message;
        } else if (e.status === 0) {
          errorMsg = "Backend'e bağlanılamıyor. Sunucu çalışıyor mu?";
        }
        els.memberCardError.textContent = errorMsg;
        els.memberCardError.classList.remove("hidden");
      }
      console.error("Üye kaydetme hatası:", e);
      console.error("Hata detayları:", {
        status: e.status,
        data: e.data,
        message: e.message,
        code: e.data?.code,
        detail: e.data?.detail,
        stack: e.stack
      });
      return;
    }
  } else {
    if (ui.editingMemberId) {
      const idx = state.members.findIndex((x) => x.id === normId(ui.editingMemberId));
      if (idx >= 0) state.members[idx] = { ...state.members[idx], ...payload, name: payload.firstName + " " + payload.lastName };
    } else {
      state.members.push({ id: uid("mem"), ...payload, name: payload.firstName + " " + payload.lastName });
    }
  }
  saveState();
  closeMemberCardModal();
  render();
}

function deleteMemberFromList(memberId) {
  if (!confirm("Bu üyeyi silmek istiyor musunuz?")) return;
  if (window.API && window.API.getToken()) {
    window.API.deleteMember(memberId).catch((e) => { console.error(e); alert((e.data && e.data.error) || "Silinemedi."); return; }).then(() => {
      state.members = state.members.filter((x) => x.id !== normId(memberId));
      saveState();
      render();
    });
  } else {
    state.members = state.members.filter((x) => x.id !== memberId);
    saveState();
    render();
  }
}

async function deleteMemberCardFromModal() {
  if (!ui.editingMemberId) return;
  if (!confirm("Bu üyeyi silmek istiyor musunuz?")) return;
  if (window.API && window.API.getToken()) {
    try {
      await window.API.deleteMember(ui.editingMemberId);
    } catch (e) {
      alert((e.data && e.data.error) || "Silinemedi.");
      return;
    }
  }
  state.members = state.members.filter((x) => x.id !== normId(ui.editingMemberId));
  saveState();
  closeMemberCardModal();
  render();
}

function refreshSessionFormOptions({ dateStr = null, timeStr = null } = {}) {
  // Members
  els.sessionMember.innerHTML = "";
  for (const m of state.members) {
    const o = document.createElement("option");
    o.value = String(Number(m.id));
    o.textContent = getMemberDisplayName(m);
    els.sessionMember.appendChild(o);
  }

  // Staff - sadece personelin o gün çalışma saatlerine göre filtrele
  els.sessionStaff.innerHTML = "";
  let filteredStaff = state.staff;

  if (dateStr && timeStr) {
    const targetDate = makeLocalDate(dateStr, timeStr);
    const dayOfWeek = targetDate.getDay();
    const [hh, mm] = timeStr.split(":").map(Number);
    const timeMin = hh * 60 + mm;

    filteredStaff = state.staff.filter((s) => {
      // Personelin o gün çalışma saatleri kontrolü
      const staffWh = getStaffWorkingHoursForDay(s, dayOfWeek);
      if (!staffWh) return false; // O gün çalışmıyor

      // Seçilen saat personelin çalışma saatleri içinde mi?
      return timeMin >= staffWh.startMin && timeMin < staffWh.endMin;
    });
  }

  for (const s of filteredStaff) {
    const o = document.createElement("option");
    o.value = String(Number(s.id));
    o.textContent = getStaffFullName(s);
    els.sessionStaff.appendChild(o);
  }

  // Rooms
  els.sessionRoom.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "AUTO";
  auto.textContent = "AUTO (Uygun oda seç)";
  els.sessionRoom.appendChild(auto);
  for (const r of state.rooms) {
    const o = document.createElement("option");
    o.value = String(Number(r.id));
    o.textContent = `${r.name} (alet: ${r.devices})`;
    els.sessionRoom.appendChild(o);
  }
}

function openSessionModal({ mode, date, time, sessionId }) {
  refreshSessionFormOptions({ dateStr: date, timeStr: time });
  showError("");

  if (mode === "new") {
    ui.editingSessionId = null;
    els.sessionModalTitle.textContent = "Seans Ekle";
    els.deleteSessionBtn.classList.add("hidden");

    const now = new Date();
    const defaultDate = date || dateToInputValue(now);
    const defaultTime = time || state.settings.startTime;

    els.sessionDate.value = defaultDate;
    els.sessionTime.value = defaultTime;
    els.sessionNote.value = "";

    // Varsayılan seçimler
    if (state.members[0]) els.sessionMember.value = state.members[0].id;
    // Personel listesi zaten refreshSessionFormOptions ile filtrelenmiş
    if (els.sessionStaff.options.length > 0) {
      els.sessionStaff.value = els.sessionStaff.options[0].value;
    }
    els.sessionRoom.value = "AUTO";

    // Tarih/saat değiştiğinde personel listesini güncelle
    const updateStaffOnChange = () => {
      const dateVal = els.sessionDate.value;
      const timeVal = els.sessionTime.value;
      if (dateVal && timeVal) {
        const currentStaffId = els.sessionStaff.value;
        refreshSessionFormOptions({ dateStr: dateVal, timeStr: timeVal });
        // Eğer seçili personel hala listede varsa seçili tut, yoksa ilkini seç
        if (els.sessionStaff.querySelector(`option[value="${currentStaffId}"]`)) {
          els.sessionStaff.value = currentStaffId;
        } else if (els.sessionStaff.options.length > 0) {
          els.sessionStaff.value = els.sessionStaff.options[0].value;
        }
      }
    };
    els.sessionDate.removeEventListener("change", updateStaffOnChange);
    els.sessionTime.removeEventListener("change", updateStaffOnChange);
    els.sessionDate.addEventListener("change", updateStaffOnChange);
    els.sessionTime.addEventListener("change", updateStaffOnChange);
  } else {
    const s = state.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    ui.editingSessionId = s.id;
    els.sessionModalTitle.textContent = "Seansı Düzenle";
    els.deleteSessionBtn.classList.remove("hidden");

    const d = new Date(s.startTs);
    const dateStr = dateToInputValue(d);
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    els.sessionDate.value = dateStr;
    els.sessionTime.value = timeStr;
    els.sessionMember.value = s.memberId;
    els.sessionRoom.value = s.roomId || "AUTO";
    els.sessionNote.value = s.note || "";

    // Personel listesini güncelle (vardiya kısıtlaması için)
    refreshSessionFormOptions({ dateStr, timeStr });
    els.sessionStaff.value = s.staffId; // Seçili personeli koru

    // Tarih/saat değiştiğinde personel listesini güncelle
    const updateStaffOnChange = () => {
      const dateVal = els.sessionDate.value;
      const timeVal = els.sessionTime.value;
      if (dateVal && timeVal) {
        const currentStaffId = els.sessionStaff.value;
        refreshSessionFormOptions({ dateStr: dateVal, timeStr: timeVal });
        // Eğer seçili personel hala listede varsa seçili tut, yoksa ilkini seç
        if (els.sessionStaff.querySelector(`option[value="${currentStaffId}"]`)) {
          els.sessionStaff.value = currentStaffId;
        } else if (els.sessionStaff.options.length > 0) {
          els.sessionStaff.value = els.sessionStaff.options[0].value;
        }
      }
    };
    els.sessionDate.removeEventListener("change", updateStaffOnChange);
    els.sessionTime.removeEventListener("change", updateStaffOnChange);
    els.sessionDate.addEventListener("change", updateStaffOnChange);
    els.sessionTime.addEventListener("change", updateStaffOnChange);
  }

  setModal(true);
}

function closeSessionModal() {
  setModal(false);
  ui.editingSessionId = null;
}

let currentGroupSessions = [];
let isNewGroupSession = false;

function getGroupForSession(session) {
  const same = state.sessions.filter(
    (s) =>
      s.staffId === session.staffId &&
      s.roomId === session.roomId &&
      overlaps(s.startTs, s.endTs, session.startTs, session.endTs)
  );
  return {
    sessions: same,
    staffId: session.staffId,
    roomId: session.roomId,
    startTs: Math.min(...same.map((s) => s.startTs)),
    endTs: Math.max(...same.map((s) => s.endTs)),
  };
}

function openGroupSessionModal(group, options = {}) {
  els.groupSessionError.classList.add("hidden");

  if (!group) {
    // Yeni grup seansı ekleme
    isNewGroupSession = true;
    currentGroupSessions = [];
    els.groupSessionCreateFields.classList.remove("hidden");
    els.groupSessionDisplayFields.classList.add("hidden");
    els.groupSessionModalTitle.textContent = "Grup Seans Ekle";

    if (options.date && options.time) {
      els.groupSessionNewDate.value = options.date;
      els.groupSessionNewTime.value = options.time;
    } else {
      const now = new Date();
      els.groupSessionNewDate.value = dateToInputValue(now);
      els.groupSessionNewTime.value = state.settings.startTime || "08:00";
    }

    els.groupSessionNewStaff.innerHTML = "";
    for (const s of state.staff) {
      const o = document.createElement("option");
      o.value = String(Number(s.id));
      o.textContent = getStaffFullName(s);
      els.groupSessionNewStaff.appendChild(o);
    }
    if (state.staff.length > 0) els.groupSessionNewStaff.value = String(Number(state.staff[0].id));

    els.groupSessionNewRoom.innerHTML = "";
    const autoO = document.createElement("option");
    autoO.value = "AUTO";
    autoO.textContent = "AUTO (Uygun oda seç)";
    els.groupSessionNewRoom.appendChild(autoO);
    for (const r of state.rooms) {
      const o = document.createElement("option");
      o.value = String(Number(r.id));
      o.textContent = `${r.name} (${r.devices} alet)`;
      els.groupSessionNewRoom.appendChild(o);
    }
    els.groupSessionNewRoom.value = "AUTO";

    renderGroupSessionMembers();
    els.groupSessionModal.classList.remove("hidden");
    return;
  }

  // Mevcut grup düzenleme
  isNewGroupSession = false;
  currentGroupSessions = [...group.sessions];
  if (currentGroupSessions.length === 0) return;

  els.groupSessionCreateFields.classList.add("hidden");
  els.groupSessionDisplayFields.classList.remove("hidden");

  const firstSession = currentGroupSessions[0];
  const d = new Date(firstSession.startTs);
  const dateStr = dateToInputValue(d);
  const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const staff = getStaffById(firstSession.staffId);
  const room = getRoomById(firstSession.roomId);

  els.groupSessionModalTitle.textContent = `Grup Seans (${currentGroupSessions.length} seans)`;
  els.groupSessionDate.value = dateStr;
  els.groupSessionTime.value = timeStr;
  els.groupSessionStaff.value = getStaffFullName(staff);
  els.groupSessionRoom.value = room?.name || "Oda";

  renderGroupSessionMembers();
  els.groupSessionModal.classList.remove("hidden");
}

function closeGroupSessionModal() {
  els.groupSessionModal.classList.add("hidden");
  currentGroupSessions = [];
  isNewGroupSession = false;
}

function refreshGroupSessionNewMemberSelect() {
  const select = els.groupSessionNewMemberSelect;
  if (!select) return;
  const usedMemberIds = new Set(currentGroupSessions.map(s => normId(s.memberId)));
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Üye seçin...";
  select.appendChild(placeholder);
  for (const m of state.members) {
    if (usedMemberIds.has(normId(m.id))) continue;
    const o = document.createElement("option");
    o.value = String(Number(m.id));
    o.textContent = getMemberDisplayName(m);
    select.appendChild(o);
  }
}

function renderGroupSessionMembers() {
  const container = els.groupSessionMembers;
  container.innerHTML = "";
  refreshGroupSessionNewMemberSelect();

  for (let i = 0; i < currentGroupSessions.length; i++) {
    const session = currentGroupSessions[i];
    const member = getMemberById(session.memberId);
    
    const memberRow = document.createElement("div");
    memberRow.style.display = "flex";
    memberRow.style.alignItems = "center";
    memberRow.style.gap = "8px";
    memberRow.style.padding = "8px";
    memberRow.style.border = "1px solid var(--border)";
    memberRow.style.borderRadius = "8px";
    memberRow.style.background = "rgba(255,255,255,.02)";
    
    const select = document.createElement("select");
    select.className = "input";
    select.style.flex = "1";
    
    for (const m of state.members) {
      const option = document.createElement("option");
      option.value = String(Number(m.id));
      option.textContent = getMemberDisplayName(m);
      if (String(Number(m.id)) === String(Number(session.memberId))) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    
    select.addEventListener("change", () => {
      currentGroupSessions[i].memberId = select.value;
    });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn--danger btn--xs";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Kaldır";
    deleteBtn.addEventListener("click", () => {
      currentGroupSessions.splice(i, 1);
      renderGroupSessionMembers();
    });
    
    memberRow.appendChild(select);
    memberRow.appendChild(deleteBtn);
    container.appendChild(memberRow);
  }
}

async function saveGroupSession() {
  if (currentGroupSessions.length === 0) {
    els.groupSessionError.textContent = "En az bir üye ekleyin (+ Üye Ekle).";
    els.groupSessionError.classList.remove("hidden");
    return;
  }

  const firstSession = currentGroupSessions[0];
  const room = firstSession ? getRoomById(firstSession.roomId) : null;
  if (room && currentGroupSessions.length > room.devices) {
    els.groupSessionError.textContent = `"${room.name}" bu saatte en fazla ${room.devices} seans alabilir (alet sayısı). Şu an ${currentGroupSessions.length} seans var.`;
    els.groupSessionError.classList.remove("hidden");
    return;
  }

  els.groupSessionError.classList.add("hidden");

  if (isNewGroupSession) {
    // Yeni grup: tüm seansları state'e ekle ve API'ye gönder
    for (const session of currentGroupSessions) {
      state.sessions.push(session);
      if (window.API && window.API.getToken()) {
        try {
          const created = await window.API.createSession(session);
          const idx = state.sessions.findIndex(s => s.id === session.id);
          if (idx >= 0) state.sessions[idx] = created;
        } catch (e) {
          els.groupSessionError.textContent = (e.data && e.data.error) || e.message || "Seans kaydedilemedi.";
          els.groupSessionError.classList.remove("hidden");
          return;
        }
      }
    }
    state.sessions.sort((a, b) => a.startTs - b.startTs);
    saveState();
    render();
    closeGroupSessionModal();
    return;
  }

  // Mevcut grup düzenleme (silinen seansları state ve API'den kaldır)
  const existingSessionIds = new Set();
  for (const session of currentGroupSessions) {
    const sid = normId(session.id);
    const existingSession = state.sessions.find(s => normId(s.id) === sid);
    if (existingSession) {
      existingSessionIds.add(sid);
      existingSession.memberId = session.memberId;
    }
  }

  const groupSessionIds = new Set(currentGroupSessions.map(s => normId(s.id)));
  const sameGroupSessions = state.sessions.filter(s =>
    normId(s.staffId) === normId(firstSession.staffId) &&
    normId(s.roomId) === normId(firstSession.roomId) &&
    s.startTs === firstSession.startTs &&
    s.endTs === firstSession.endTs
  );

  for (const s of sameGroupSessions) {
    if (!groupSessionIds.has(normId(s.id))) {
      const index = state.sessions.findIndex(x => normId(x.id) === normId(s.id));
      if (index >= 0) state.sessions.splice(index, 1);
      if (window.API && window.API.getToken()) {
        try { await window.API.deleteSession(s.id); } catch (_) {}
      }
    }
  }

  for (const session of currentGroupSessions) {
    if (!existingSessionIds.has(normId(session.id))) {
      state.sessions.push(session);
      if (window.API && window.API.getToken()) {
        try {
          const created = await window.API.createSession(session);
          const idx = state.sessions.findIndex(s => normId(s.id) === normId(session.id));
          if (idx >= 0) state.sessions[idx] = created;
        } catch (_) {}
      }
    }
  }

  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  render();
  closeGroupSessionModal();
}

async function saveSessionFromModal() {
  showError("");

  if (!state.members.length) {
    showError("Önce en az 1 üye ekleyin.");
    return;
  }
  if (!state.staff.length) {
    showError("Önce en az 1 personel ekleyin.");
    return;
  }

  const dateStr = els.sessionDate.value;
  const timeStr = els.sessionTime.value;
  const durationMin = 60; // Standart seans süresi sabit 60 dk
  const memberId = els.sessionMember.value;
  const staffId = els.sessionStaff.value;
  const roomChoice = els.sessionRoom.value;
  const note = els.sessionNote.value || "";

  if (!dateStr || !timeStr) {
    showError("Tarih ve saat seçin.");
    return;
  }
  if (!memberId || !staffId) {
    showError("Üye ve personel seçin.");
    return;
  }

  const start = makeLocalDate(dateStr, timeStr);
  const end = new Date(start.getTime() + clamp(durationMin, 15, 24 * 60) * 60000);

  const startMinDay = start.getHours() * 60 + start.getMinutes();
  const endMinDay = end.getHours() * 60 + end.getMinutes();
  const dayOfWeek = start.getDay(); // 0=Pazar, 1=Pzt, ...

  // Günün açık olup olmadığını kontrol et
  if (!isDayEnabled(dayOfWeek)) {
    showError(`${DAY_NAMES[dayOfWeek]} günü kapalı. Seans eklenemez.`);
    return;
  }

  const wh = getWorkingHoursForDay(dayOfWeek);
  if (!wh) {
    showError("Bu gün için çalışma saati tanımlanmamış. Lütfen önce çalışma saatlerini ayarlayın.");
    return;
  }

  if (startMinDay < wh.startMin || endMinDay > wh.endMin) {
    showError(`Seans saat aralığı, çalışma saatleri dışında. (${wh.start}–${wh.end})`);
    return;
  }

  // Seçilen personelin o gün çalışma saatlerini kontrol et
  const selectedStaff = getStaffById(staffId);
  if (selectedStaff) {
    const staffWh = getStaffWorkingHoursForDay(selectedStaff, dayOfWeek);
    if (!staffWh) {
      showError(`Seçilen personel (${getStaffFullName(selectedStaff)}) bu gün çalışmıyor.`);
      return;
    }
    if (startMinDay < staffWh.startMin || endMinDay > staffWh.endMin) {
      showError(
        `Seçilen personel (${getStaffFullName(selectedStaff)}) bu saat aralığında çalışmıyor. (${staffWh.start}–${staffWh.end})`,
      );
      return;
    }
  }

  const candidateBase = {
    id: ui.editingSessionId || uid("sess"),
    memberId,
    staffId,
    roomId: "",
    startTs: start.getTime(),
    endTs: end.getTime(),
    note,
  };

  const ignoreSessionId = ui.editingSessionId;
  let roomId = roomChoice;
  if (roomChoice === "AUTO") {
    // Personel bu saat aralığında seanslıysa, aynı odasına öncelik ver.
    const busyRoomId = getStaffBusyRoomId(candidateBase, { ignoreSessionId });
    if (busyRoomId === "__MULTI__") {
      showError("Seçilen personel bu saat aralığında birden fazla odada seanslı görünüyor (uygunsuz durum).");
      return;
    }

    if (busyRoomId) {
      // Aynı odada yer var mı kontrol et (kapasite + odada tek personel kuralı)
      const candidateTry = { ...candidateBase, roomId: busyRoomId };
      const conflicts = checkConflicts(candidateTry, { ignoreSessionId });
      if (conflicts.length) {
        showError(conflicts.join(" "));
        return;
      }
      roomId = busyRoomId;
    } else {
      const picked = autoAssignRoom(candidateBase, { ignoreSessionId });
      if (!picked) {
        showError("Bu saat aralığında hiçbir odada boş alet yok (kapasite dolu).");
        return;
      }
      roomId = picked;
    }
  }

  const candidate = { ...candidateBase, roomId };

  const conflicts = checkConflicts(candidate, { ignoreSessionId });
  if (conflicts.length) {
    showError(conflicts.join(" "));
    return;
  }

  if (window.API && window.API.getToken()) {
    try {
      if (ui.editingSessionId) {
        await window.API.updateSession(ui.editingSessionId, {
          staffId: candidate.staffId,
          memberId: candidate.memberId,
          roomId: candidate.roomId,
          startTs: candidate.startTs,
          endTs: candidate.endTs,
          note: candidate.note || null,
        });
        state.sessions = state.sessions.map((s) => (s.id === ui.editingSessionId ? { ...candidate, id: normId(ui.editingSessionId) } : s));
      } else {
        const created = await window.API.createSession(candidate);
        state.sessions.push(created);
      }
    } catch (e) {
      const msg = (e.data && (e.data.error || (e.data.errors && Array.isArray(e.data.errors) ? e.data.errors.map(x => x.msg || x.message).join(', ') : null))) || e.message || "Seans kaydedilemedi.";
      showError(msg);
      return;
    }
  } else {
    if (ui.editingSessionId) {
      state.sessions = state.sessions.map((s) => (s.id === ui.editingSessionId ? candidate : s));
    } else {
      state.sessions.push(candidate);
    }
  }

  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  closeSessionModal();
  render();
}

async function deleteSessionFromModal() {
  if (!ui.editingSessionId) return;
  const ok = confirm("Seansı silmek istiyor musunuz?");
  if (!ok) return;
  if (window.API && window.API.getToken()) {
    try {
      await window.API.deleteSession(ui.editingSessionId);
    } catch (e) {
      console.error("Seans silinemedi:", e);
      return;
    }
  }
  state.sessions = state.sessions.filter((s) => s.id !== ui.editingSessionId);
  saveState();
  closeSessionModal();
  render();
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seans-plan-${dateToInputValue(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getSessionsAtTime(dateStr, timeStr) {
  // Belirli bir tarih/saatte aktif olan seansları döndür
  const targetDate = makeLocalDate(dateStr, timeStr);
  const targetTs = targetDate.getTime();
  return state.sessions.filter((s) => s.startTs <= targetTs && s.endTs > targetTs);
}

function getStaffAtTime(dateStr, timeStr) {
  // Belirli bir tarih/saatte merkezde olan personelleri döndür
  const sessions = getSessionsAtTime(dateStr, timeStr);
  const staffIds = [...new Set(sessions.map((s) => s.staffId))];
  return staffIds.map((id) => getStaffById(id)).filter(Boolean);
}

function openTaskDistributionModal() {
  const content = els.taskDistributionContent;
  content.innerHTML = "";

  const weekStartTs = ui.weekStart.getTime();
  const weekEndTs = addDays(ui.weekStart, 7).getTime();
  const inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);

  // Her gün ve saat için 4 personel olan zamanları bul
  const fourStaffTimes = [];
  const { startMin, endMin, slotMin } = buildTimeSlots();

  for (let day = 0; day < 7; day++) {
    const d = addDays(ui.weekStart, day);
    const dayOfWeek = d.getDay();
    if (!isDayEnabled(dayOfWeek)) continue;

    const wh = getWorkingHoursForDay(dayOfWeek);
    if (!wh) continue;

    const dateStr = dateToInputValue(d);

    for (let min = wh.startMin; min < wh.endMin; min += slotMin) {
      const timeStr = minutesToTime(min);
      const staffAtTime = getStaffAtTime(dateStr, timeStr);
      if (staffAtTime.length === 4) {
        const sessions = getSessionsAtTime(dateStr, timeStr);
        fourStaffTimes.push({
          date: d,
          dateStr,
          timeStr,
          staff: staffAtTime,
          sessions,
        });
      }
    }
  }

  if (fourStaffTimes.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted);">
        <p>Bu hafta 4 personelin aynı anda merkezde olduğu bir saat bulunamadı.</p>
      </div>
    `;
  } else {
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.marginTop = "10px";
    table.innerHTML = `
      <thead>
        <tr style="background:rgba(255,255,255,.05); border-bottom:1px solid var(--border);">
          <th style="padding:10px; text-align:left; font-weight:700;">Tarih</th>
          <th style="padding:10px; text-align:left; font-weight:700;">Saat</th>
          <th style="padding:10px; text-align:left; font-weight:700;">Personeller</th>
          <th style="padding:10px; text-align:left; font-weight:700;">Seanslar</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const item of fourStaffTimes) {
      const { dayName, dt } = fmtDayHeader(item.date);
      const staffNames = item.staff.map((s) => getStaffFullName(s)).join(", ");
      const sessionDetails = item.sessions.map((s) => {
        const member = getMemberById(s.memberId);
        const room = getRoomById(s.roomId);
        return `${member?.name || "Üye"} (${room?.name || "Oda"})`;
      }).join(", ");

      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--border)";
      row.innerHTML = `
        <td style="padding:10px;">${dayName} ${dt}</td>
        <td style="padding:10px;">${item.timeStr}</td>
        <td style="padding:10px;">${escapeHtml(staffNames)}</td>
        <td style="padding:10px; font-size:12px; color:var(--muted);">${escapeHtml(sessionDetails)}</td>
      `;
      table.querySelector("tbody").appendChild(row);
    }

    content.appendChild(table);
  }

  els.taskDistributionModal.classList.remove("hidden");
}

function closeTaskDistributionModal() {
  els.taskDistributionModal.classList.add("hidden");
}

function printWeeklySchedule() {
  // Print-friendly görünüm oluştur
  const printWindow = window.open("", "_blank");
  const weekLabel = fmtWeekLabel(ui.weekStart);
  const weekStartTs = ui.weekStart.getTime();
  const weekEndTs = addDays(ui.weekStart, 7).getTime();
  const inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Haftalık Seans Programı - ${weekLabel}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; padding:20px; }
        h1 { margin-bottom:20px; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th, td { border:1px solid #ddd; padding:8px; text-align:left; }
        th { background:#f5f5f5; font-weight:bold; }
        .day-header { background:#e8e8e8; font-weight:bold; }
      </style>
    </head>
    <body>
      <h1>Haftalık Seans Programı</h1>
      <p><strong>Hafta:</strong> ${weekLabel}</p>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Gün</th>
            <th>Saat</th>
            <th>Üye</th>
            <th>Personel</th>
            <th>Oda</th>
            <th>Süre</th>
          </tr>
        </thead>
        <tbody>
  `;

  const sortedSessions = [...inWeek].sort((a, b) => a.startTs - b.startTs);
  for (const s of sortedSessions) {
    const d = new Date(s.startTs);
    const dateStr = dateToInputValue(d);
    const { dayName } = fmtDayHeader(d);
    const startTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const endTime = `${pad2(new Date(s.endTs).getHours())}:${pad2(new Date(s.endTs).getMinutes())}`;
    const duration = Math.round((s.endTs - s.startTs) / 60000);
    const member = getMemberById(s.memberId);
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);

    html += `
      <tr>
        <td>${dateStr}</td>
        <td>${dayName}</td>
        <td>${startTime}–${endTime}</td>
        <td>${escapeHtml(member?.name || "Üye")}</td>
        <td>${escapeHtml(getStaffFullName(staff))}</td>
        <td>${escapeHtml(room?.name || "Oda")}</td>
        <td>${duration} dk</td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

async function importJsonFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const incoming = parsed?.state;
  if (!incoming || typeof incoming !== "object") {
    alert("Geçersiz dosya.");
    return;
  }

  // çok basit doğrulama/merge
  const next = {
    ...deepClone(DEFAULT_STATE),
    ...incoming,
    settings: { ...deepClone(DEFAULT_STATE.settings), ...(incoming.settings || {}) },
    workingHours: { ...deepClone(DEFAULT_STATE.workingHours), ...(incoming.workingHours || {}) },
  };

  // tip güvenliği
  next.rooms = Array.isArray(next.rooms) ? next.rooms : deepClone(DEFAULT_STATE.rooms);
  next.members = Array.isArray(next.members) ? next.members : deepClone(DEFAULT_STATE.members);
  next.sessions = Array.isArray(next.sessions) ? next.sessions : [];

  // Personel verilerini eski formattan yeni formata dönüştür
  if (Array.isArray(next.staff)) {
    next.staff = next.staff.map((s) => {
      // Eğer zaten yeni formatta ise olduğu gibi döndür
      if (s.firstName || s.lastName) return s;

      // Eski format: { id, name, shift } -> Yeni format: { id, firstName, lastName, phone, workingHours }
      const nameParts = (s.name || "Personel").split(" ");
      const firstName = nameParts[0] || "Personel";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Varsayılan çalışma saatleri (genel varsayılan)
      const defaultWorkingHours = {};
      for (let day = 0; day < 7; day++) {
        defaultWorkingHours[day] = {
          start: "08:00",
          end: "20:00",
          enabled: day !== 0, // Pazar kapalı
        };
      }

      return {
        id: s.id,
        firstName,
        lastName,
        phone: "",
        workingHours: defaultWorkingHours,
      };
    });
  } else {
    next.staff = deepClone(DEFAULT_STATE.staff);
  }

  state = next;
  saveState();
  render();
}

function resetAll() {
  const ok = confirm("Tüm veriler silinecek. Emin misiniz?");
  if (!ok) return;
  state = deepClone(DEFAULT_STATE);
  saveState();
  setWeekStart(new Date());
  render();
}

function bindEvents() {
  // Görünüm modu değiştirme
  els.viewWeekBtn.addEventListener("click", () => {
    setViewMode("week");
    els.viewWeekBtn.classList.add("btn--primary");
    els.viewDayBtn.classList.remove("btn--primary");
  });
  els.viewDayBtn.addEventListener("click", () => {
    setViewMode("day");
    els.viewDayBtn.classList.add("btn--primary");
    els.viewWeekBtn.classList.remove("btn--primary");
  });

  // Navigasyon butonları
  els.prevBtn.addEventListener("click", () => {
    if (ui.viewMode === "day") {
      setCurrentDay(addDays(ui.currentDay, -1));
    } else {
      setWeekStart(addDays(ui.weekStart, -7));
    }
  });
  els.nextBtn.addEventListener("click", () => {
    if (ui.viewMode === "day") {
      setCurrentDay(addDays(ui.currentDay, 1));
    } else {
      setWeekStart(addDays(ui.weekStart, 7));
    }
  });
  els.todayBtn.addEventListener("click", () => {
    if (ui.viewMode === "day") {
      setCurrentDay(new Date());
    } else {
      setWeekStart(new Date());
    }
  });

  els.addSessionBtn.addEventListener("click", () => openGroupSessionModal(null));
  els.taskDistributionBtn.addEventListener("click", openTaskDistributionModal);
  els.printBtn.addEventListener("click", printWeeklySchedule);
  els.exportBtn.addEventListener("click", exportJson);
  els.importFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importJsonFile(file);
    } catch {
      alert("İçe aktarma başarısız.");
    } finally {
      e.target.value = "";
    }
  });
  els.openWorkingHoursBtn.addEventListener("click", openWorkingHoursModal);
  els.openRoomsBtn.addEventListener("click", openRoomsModal);
  els.openStaffBtn.addEventListener("click", openStaffModal);

  els.addRoomBtn.addEventListener("click", async () => {
    const name = (els.newRoomName.value || "").trim();
    const devices = clamp(Number(els.newRoomDevices.value || 1), 1, 999);
    if (!name) {
      els.roomsError.textContent = "Oda adı girin.";
      els.roomsError.classList.remove("hidden");
      return;
    }
    if (state.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      els.roomsError.textContent = "Bu isimde bir oda zaten var.";
      els.roomsError.classList.remove("hidden");
      return;
    }
    if (window.API && window.API.getToken()) {
      try {
        const r = await window.API.createRoom({ name, devices });
        state.rooms.push(r);
      } catch (e) {
        els.roomsError.textContent = (e.data && e.data.error) || e.message || "Oda eklenemedi.";
        els.roomsError.classList.remove("hidden");
        return;
      }
    } else {
      state.rooms.push({ id: uid("room"), name, devices });
    }
    els.newRoomName.value = "";
    els.newRoomDevices.value = "1";
    els.roomsError.classList.add("hidden");
    saveState();
    updateRoomsSummary();
    renderRooms();
    render();
  });

  els.addStaffBtn.addEventListener("click", async () => {
    const firstName = (els.newStaffFirstName.value || "").trim();
    const lastName = (els.newStaffLastName.value || "").trim();
    const phoneRaw = (els.newStaffPhone.value || "").trim();
    const phone = phoneRaw ? toPhoneFormat(phoneRaw) : "";

    if (!firstName || !lastName) {
      els.staffError.textContent = "Ad ve soyad girin.";
      els.staffError.classList.remove("hidden");
      return;
    }
    if (phoneRaw && !phone) {
      els.staffError.textContent = "Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.";
      els.staffError.classList.remove("hidden");
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();
    if (state.staff.some((s) => getStaffFullName(s).toLowerCase() === fullName.toLowerCase())) {
      els.staffError.textContent = "Bu isimde bir personel zaten var.";
      els.staffError.classList.remove("hidden");
      return;
    }

    const defaultWorkingHours = {};
    for (let day = 0; day < 7; day++) {
      defaultWorkingHours[day] = { start: "08:00", end: "20:00", enabled: day !== 0 };
    }

    if (window.API && window.API.getToken()) {
      try {
        const s = await window.API.createStaff({ firstName, lastName, phone, workingHours: defaultWorkingHours });
        state.staff.push(s);
      } catch (e) {
        els.staffError.textContent = (e.data && e.data.error) || e.message || "Personel eklenemedi.";
        els.staffError.classList.remove("hidden");
        return;
      }
    } else {
      state.staff.push({
        id: uid("staff"),
        firstName,
        lastName,
        phone,
        workingHours: defaultWorkingHours,
      });
    }

    els.newStaffFirstName.value = "";
    els.newStaffLastName.value = "";
    els.newStaffPhone.value = "";
    els.staffError.classList.add("hidden");
    saveState();
    updateStaffSummary();
    renderStaff();
    render();
  });

  els.addMemberBtn.addEventListener("click", () => openMemberCard(null));

  // Üye Kimlik Kartı modal
  if (els.memberCardModal) {
    els.memberCardModal.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberCardModal") closeMemberCardModal();
    });
  }
  if (els.saveMemberCardBtn) els.saveMemberCardBtn.addEventListener("click", saveMemberCard);
  if (els.deleteMemberCardBtn) els.deleteMemberCardBtn.addEventListener("click", deleteMemberCardFromModal);

  // modal close
  els.sessionModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeSessionModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.sessionModal.classList.contains("hidden")) closeSessionModal();
  });

  els.saveSessionBtn.addEventListener("click", saveSessionFromModal);
  els.deleteSessionBtn.addEventListener("click", deleteSessionFromModal);

  // Çalışma saatleri modal
  els.workingHoursModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeWorkingHoursModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.workingHoursModal.classList.contains("hidden")) closeWorkingHoursModal();
      if (!els.roomsModal.classList.contains("hidden")) closeRoomsModal();
      if (!els.staffModal.classList.contains("hidden")) closeStaffModal();
    }
  });
  els.saveWorkingHoursBtn.addEventListener("click", saveWorkingHours);

  // Odalar modal
  els.roomsModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeRoomsModal();
  });

  // Personel modal
  els.staffModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeStaffModal();
  });

  // Personel kartı modal
  els.staffCardModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeStaffCardModal();
  });

  // Görev dağıtım modal
  els.taskDistributionModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeTaskDistributionModal();
  });
  
  // Grup seans modal
  els.groupSessionModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close === "groupSessionModal") {
      closeGroupSessionModal();
    }
  });
  els.groupSessionAddMemberBtn.addEventListener("click", () => {
    const selectedId = els.groupSessionNewMemberSelect?.value?.trim();
    if (!selectedId) {
      els.groupSessionError.textContent = "Listeden eklenecek üyeyi seçin.";
      els.groupSessionError.classList.remove("hidden");
      return;
    }
    const availableMember = state.members.find(m => normId(m.id) === normId(selectedId));
    if (!availableMember) {
      els.groupSessionError.textContent = "Seçilen üye bulunamadı.";
      els.groupSessionError.classList.remove("hidden");
      return;
    }

    let startTs, endTs, staffId, roomId;

    if (isNewGroupSession && currentGroupSessions.length === 0) {
      const dateStr = els.groupSessionNewDate?.value;
      const timeStr = els.groupSessionNewTime?.value;
      staffId = els.groupSessionNewStaff?.value;
      const roomChoice = els.groupSessionNewRoom?.value;
      if (!dateStr || !timeStr || !staffId) {
        els.groupSessionError.textContent = "Tarih, saat ve personel seçin.";
        els.groupSessionError.classList.remove("hidden");
        return;
      }
      const start = makeLocalDate(dateStr, timeStr);
      const durationMin = 60;
      endTs = start.getTime() + durationMin * 60000;
      startTs = start.getTime();
      const dayOfWeek = start.getDay();
      if (!isDayEnabled(dayOfWeek)) {
        els.groupSessionError.textContent = `${DAY_NAMES[dayOfWeek]} günü kapalı.`;
        els.groupSessionError.classList.remove("hidden");
        return;
      }
      const wh = getWorkingHoursForDay(dayOfWeek);
      if (!wh) {
        els.groupSessionError.textContent = "Bu gün için çalışma saati tanımlanmamış.";
        els.groupSessionError.classList.remove("hidden");
        return;
      }
      const startMinDay = start.getHours() * 60 + start.getMinutes();
      if (startMinDay < wh.startMin || startMinDay + durationMin > wh.endMin) {
        els.groupSessionError.textContent = `Seans çalışma saatleri dışında (${wh.start}–${wh.end}).`;
        els.groupSessionError.classList.remove("hidden");
        return;
      }
      const selectedStaff = getStaffById(staffId);
      if (selectedStaff) {
        const staffWh = getStaffWorkingHoursForDay(selectedStaff, dayOfWeek);
        if (!staffWh || startMinDay < staffWh.startMin || startMinDay + durationMin > staffWh.endMin) {
          els.groupSessionError.textContent = "Seçilen personel bu saatte çalışmıyor.";
          els.groupSessionError.classList.remove("hidden");
          return;
        }
      }
      if (roomChoice === "AUTO") {
        const candidateBase = { startTs, endTs, staffId, memberId: availableMember.id, roomId: "", note: "" };
        const picked = autoAssignRoom(candidateBase, { ignoreSessionId: null });
        if (!picked) {
          els.groupSessionError.textContent = "Bu saatte hiçbir odada boş alet yok (kapasite dolu).";
          els.groupSessionError.classList.remove("hidden");
          return;
        }
        roomId = picked;
      } else {
        roomId = roomChoice;
      }
    } else {
      const firstSession = currentGroupSessions[0];
      if (!firstSession) return;
      startTs = firstSession.startTs;
      endTs = firstSession.endTs;
      staffId = firstSession.staffId;
      roomId = firstSession.roomId;
      const room = getRoomById(roomId);
      const maxInSlot = room ? room.devices : 1;
      if (currentGroupSessions.length + 1 > maxInSlot) {
        els.groupSessionError.textContent = `Bu oda bu saatte en fazla ${maxInSlot} seans alabilir (alet: ${maxInSlot}).`;
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    }

    const newSession = {
      id: uid("sess"),
      startTs,
      endTs,
      memberId: availableMember.id,
      staffId,
      roomId,
      note: "",
    };

    const conflicts = checkConflicts(newSession, { ignoreSessionId: null });
    if (conflicts.length > 0) {
      els.groupSessionError.textContent = conflicts.join(" ");
      els.groupSessionError.classList.remove("hidden");
      return;
    }

    currentGroupSessions.push(newSession);
    renderGroupSessionMembers();
    els.groupSessionError.classList.add("hidden");
  });
  els.saveGroupSessionBtn.addEventListener("click", saveGroupSession);
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.workingHoursModal.classList.contains("hidden")) closeWorkingHoursModal();
      if (!els.roomsModal.classList.contains("hidden")) closeRoomsModal();
      if (!els.staffModal.classList.contains("hidden")) closeStaffModal();
      if (!els.staffCardModal.classList.contains("hidden")) closeStaffCardModal();
      if (!els.taskDistributionModal.classList.contains("hidden")) closeTaskDistributionModal();
      if (!els.groupSessionModal.classList.contains("hidden")) closeGroupSessionModal();
    }
  });

  // Ekran boyutu değişince event genişlikleri tekrar hesaplanmalı
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const { startMin, slotMin, slots } = buildTimeSlots();
      renderEvents({ startMin, slotMin, slotsCount: slots.length });
    }, 80);
  });
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function openWorkingHoursModal() {
  els.workingHoursError.classList.add("hidden");
  const list = els.workingHoursList;
  list.innerHTML = "";

  for (let day = 0; day < 7; day++) {
    const wh = state.workingHours[day] || { start: "08:00", end: "20:00", enabled: false };
    const enabled = wh.enabled !== false; // varsayılan true (eski veriler için)
    const item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML = `
      <div class="listItem__left" style="flex:1; display:flex; align-items:center; gap:10px;">
        <input type="checkbox" id="wh_enabled_${day}" data-day="${day}" ${enabled ? "checked" : ""} style="cursor:pointer;" />
        <label for="wh_enabled_${day}" style="cursor:pointer; flex:1;">
          <div class="listItem__title">${DAY_NAMES[day]}</div>
        </label>
      </div>
      <div class="listItem__actions" style="display:flex; gap:8px; align-items:center;">
        <input class="input" type="time" data-day="${day}" data-type="start" value="${wh.start || "08:00"}" style="width:100px;" ${!enabled ? "disabled" : ""} />
        <span style="color:var(--muted);">–</span>
        <input class="input" type="time" data-day="${day}" data-type="end" value="${wh.end || "20:00"}" style="width:100px;" ${!enabled ? "disabled" : ""} />
      </div>
    `;
    const checkbox = item.querySelector(`#wh_enabled_${day}`);
    const startInput = item.querySelector(`input[data-type="start"][data-day="${day}"]`);
    const endInput = item.querySelector(`input[data-type="end"][data-day="${day}"]`);

    checkbox.addEventListener("change", (e) => {
      const checked = e.target.checked;
      startInput.disabled = !checked;
      endInput.disabled = !checked;
    });

    list.appendChild(item);
  }
  els.workingHoursModal.classList.remove("hidden");
}

function closeWorkingHoursModal() {
  els.workingHoursModal.classList.add("hidden");
}

async function saveWorkingHours() {
  els.workingHoursError.classList.add("hidden");

  const checkboxes = els.workingHoursList.querySelectorAll("input[type='checkbox']");
  const timeInputs = els.workingHoursList.querySelectorAll("input[type='time']");
  const newHours = {};

  // Önce enabled durumlarını kaydet
  for (const checkbox of checkboxes) {
    const day = Number(checkbox.dataset.day);
    newHours[day] = { enabled: checkbox.checked };
  }

  // Sonra saatleri kaydet (sadece enabled olanlar için doğrulama yap)
  for (const input of timeInputs) {
    if (input.disabled) continue; // Disabled input'ları atla
    const day = Number(input.dataset.day);
    const type = input.dataset.type;
    const value = input.value;

    if (!newHours[day]) newHours[day] = { enabled: false };
    newHours[day][type] = value;
  }

  // Doğrulama (sadece enabled günler için)
  for (const day in newHours) {
    const wh = newHours[day];
    if (!wh.enabled) continue; // Kapalı günler için doğrulama yapma

    if (!wh.start || !wh.end) {
      els.workingHoursError.textContent = `${DAY_NAMES[Number(day)]} için başlangıç ve bitiş saati girin.`;
      els.workingHoursError.classList.remove("hidden");
      return;
    }
    const startMin = timeToMinutes(wh.start);
    const endMin = timeToMinutes(wh.end);
    if (endMin <= startMin) {
      els.workingHoursError.textContent = `${DAY_NAMES[Number(day)]} için bitiş saati, başlangıçtan sonra olmalı.`;
      els.workingHoursError.classList.remove("hidden");
      return;
    }
  }

  state.workingHours = newHours;
  if (window.API && window.API.getToken()) {
    try {
      await window.API.updateWorkingHours(newHours);
    } catch (e) {
      console.error("Çalışma saatleri kaydedilemedi:", e);
    }
  }
  saveState();
  closeWorkingHoursModal();
  updateWorkingHoursSummary();
  render();
}

function render() {
  updateWorkingHoursSummary();
  updateRoomsSummary();
  updateStaffSummary();
  
  // Görünüm butonlarını güncelle
  if (ui.viewMode === "week") {
    els.viewWeekBtn.classList.add("btn--primary");
    els.viewDayBtn.classList.remove("btn--primary");
  } else {
    els.viewDayBtn.classList.add("btn--primary");
    els.viewWeekBtn.classList.remove("btn--primary");
  }

  renderHeader();
  renderMembers();
  renderGrid();
}

function bindLoginForm() {
  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  if (!form || !window.API) return;
  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const u = (document.getElementById("loginUsername") || {}).value.trim();
    const p = (document.getElementById("loginPassword") || {}).value;
    if (!u || !p) return;
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (btn) btn.disabled = true;
    try {
      await window.API.login(u, p);
      const ov = document.getElementById("loginOverlay");
      if (ov) ov.classList.add("hidden");
      location.reload();
    } catch (e) {
      if (errEl) {
        errEl.textContent = (e.data && e.data.error) || e.message || "Giriş başarısız";
        errEl.classList.remove("hidden");
      }
      if (btn) btn.disabled = false;
    }
  });
}

function init() {
  cacheEls();
  // Telefon alanları: sadece rakam, en fazla 10 hane
  [els.mcPhone, els.mcContactPhone, els.newStaffPhone, els.editStaffPhone].forEach((el) => {
    if (el) el.addEventListener("input", function () { restrictPhoneInput(this); });
  });
  bindEvents();
  // Varsayılan görünüm: günlük
  if (ui.viewMode === "week") {
    els.viewWeekBtn.classList.add("btn--primary");
  } else {
    els.viewDayBtn.classList.add("btn--primary");
  }
  render();
  // Pencere/alan boyutu değişince kartları yeniden konumla (günlük + haftalık)
  if (els.plannerGrid && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      repositionOverlappingEvents();
    });
    ro.observe(els.plannerGrid);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  if (!window.API || !window.API.getToken()) {
    const ov = document.getElementById("loginOverlay");
    if (ov) ov.classList.remove("hidden");
    bindLoginForm();
    return;
  }
  try {
    const loaded = await window.API.loadFullState();
    state = { ...deepClone(DEFAULT_STATE), ...loaded };
  } catch (e) {
    console.error("API load hatası:", e);
    if (e.status === 401) {
      if (window.API) window.API.removeToken();
      const ov = document.getElementById("loginOverlay");
      if (ov) ov.classList.remove("hidden");
      bindLoginForm();
      return;
    }
    state = loadState();
  }
  init();
});

