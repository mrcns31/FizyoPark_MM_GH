/* Seans Planlayıcı - kurulum gerektirmeyen statik uygulama */

const STORAGE_KEY = "seans_planner_v1";
const STORAGE_UI_KEY = "seans_planner_ui";
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
  packages: [],
  memberPackages: [],
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
      packages: Array.isArray(parsed.packages) ? parsed.packages : deepClone(DEFAULT_STATE.packages),
      memberPackages: Array.isArray(parsed.memberPackages) ? parsed.memberPackages : deepClone(DEFAULT_STATE.memberPackages),
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

/** Üyenin tam adı (filtre eşleştirmesi için). */
function getMemberFullName(member) {
  if (!member) return "";
  const ad = member.firstName ?? member.first_name ?? "";
  const soyad = member.lastName ?? member.last_name ?? "";
  return (member.name || `${ad} ${soyad}`.trim()) || "";
}

/** Takvim filtre metni doluysa, seansın üyesi veya personeli bu metinle eşleşiyor mu? (büyük/küçük harf duyarsız, kısmi eşleşme) */
function sessionMatchesPlannerFilter(s) {
  const q = (ui.plannerFilter || "").trim();
  if (!q) return true;
  const qLower = q.toLowerCase();
  const member = getMemberById(s.memberId);
  const memberName = getMemberFullName(member);
  if (memberName.toLowerCase().includes(qLower)) return true;
  const staff = getStaffById(s.staffId);
  const staffName = getStaffFullName(staff);
  return staffName.toLowerCase().includes(qLower);
}

function getSessionsInRange(startTs, endTs) {
  return state.sessions.filter((s) => overlaps(s.startTs, s.endTs, startTs, endTs));
}

function getStaffBusyRoomId(candidate, { ignoreSessionId = null, ignoreSessionIds = null } = {}) {
  const ignoreSet = ignoreSessionIds && ignoreSessionIds.size ? ignoreSessionIds : (ignoreSessionId != null ? new Set([normId(ignoreSessionId)]) : null);
  const relevant = ignoreSet ? state.sessions.filter((s) => !ignoreSet.has(normId(s.id))) : state.sessions;
  const overlap = relevant.filter(
    (s) => normId(s.staffId) === normId(candidate.staffId) && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
  );
  const roomIds = [...new Set(overlap.map((s) => normId(s.roomId)).filter((id) => id != null && id !== ""))];
  if (roomIds.length === 0) return null;
  if (roomIds.length === 1) return roomIds[0];
  return "__MULTI__";
}

function checkConflicts(candidate, { ignoreSessionId = null, ignoreSessionIds = null } = {}) {
  const conflicts = [];
  const ignoreSet = ignoreSessionIds && ignoreSessionIds.size ? ignoreSessionIds : (ignoreSessionId != null ? new Set([normId(ignoreSessionId)]) : null);
  const relevant = ignoreSet
    ? state.sessions.filter((s) => !ignoreSet.has(normId(s.id)))
    : state.sessions;

  // Personel kuralı:
  // - Aynı saat aralığında birden fazla seans ALABİLİR
  // - Ama sadece aynı oda içinde (tek personel/oda kuralı ile uyumlu)
  const busyRoomId = getStaffBusyRoomId(candidate, { ignoreSessionId, ignoreSessionIds: ignoreSet });
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

function autoAssignRoom(candidate, { ignoreSessionId = null, ignoreSessionIds = null } = {}) {
  const ignoreSet = ignoreSessionIds && ignoreSessionIds.size ? ignoreSessionIds : (ignoreSessionId != null ? new Set([normId(ignoreSessionId)]) : null);
  const relevant = ignoreSet ? state.sessions.filter((s) => !ignoreSet.has(normId(s.id))) : state.sessions;
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

function loadUi() {
  try {
    const raw = localStorage.getItem(STORAGE_UI_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const weekStart = p.weekStart ? startOfWeekMonday(new Date(p.weekStart)) : null;
    const currentDay = p.currentDay ? new Date(p.currentDay) : null;
    const viewMode = p.viewMode === "week" ? "week" : "day";
    if (weekStart && currentDay) return { weekStart, currentDay, viewMode };
  } catch (_) {}
  return null;
}
function saveUi() {
  try {
    localStorage.setItem(STORAGE_UI_KEY, JSON.stringify({
      weekStart: dateToInputValue(ui.weekStart),
      currentDay: dateToInputValue(ui.currentDay),
      viewMode: ui.viewMode,
    }));
  } catch (_) {}
}

// Her açılışta/sayfa yenilenmesinde takvim günlük görünüm ve bugünün tarihi ile açılsın (kayıtlı görünüm kullanılmaz).
const now = new Date();
let ui = {
  weekStart: startOfWeekMonday(now),
  currentDay: startOfDay(now),
  viewMode: "day",
  plannerFilter: "", // Takvimde üye ismine göre filtre (haftalık: hangi günler, günlük: hangi saat)
  editingSessionId: null,
  editingMemberId: null, // Üye Kimlik Kartı düzenleme
  deleteMemberId: null,  // Üye silme modalında silinecek üye id
  pendingNewMember: null, // Yeni üye: paket kaydedilene kadar DB'ye yazılmaz; Vazgeç = iptal
};

const els = {};
function cacheEls() {
  const ids = [
    "prevBtn",
    "nextBtn",
    "todayBtn",
    "viewWeekBtn",
    "viewDayBtn",
    "plannerFilterInput",
    "weekLabel",
    "addSessionBtn",
    "exportBtn",
    "exportDropdown",
    "exportSessionsExcelBtn",
    "exportSessionsPdfBtn",
    "exportJsonBtn",
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
    "deleteMemberModal",
    "deleteMemberPassword",
    "deleteMemberStep1",
    "deleteMemberStep2",
    "deleteMemberHistoryYes",
    "deleteMemberHistoryNo",
    "deleteMemberError",
    "deleteMemberCancelBtn",
    "deleteMemberNextBtn",
    "deleteMemberConfirmBtn",
    "memberPackageInfoBtn",
    "memberPackageModal",
    "mpPackage",
    "mpPackageFirstSessionHint",
    "mpMemberNo",
    "mpStartDate",
    "mpEndDate",
    "mpSkipDayDistribution",
    "mpDaySlotsWrap",
    "mpDaySlots",
    "mpFormError",
    "mpAvailabilityError",
    "mpHistoryList",
    "mpEndMembershipBtn",
    "mpSaveBtn",
    "packageInconsistencyModal",
    "packageInconsistencyMessage",
    "packageInconsistencySaveAsIsBtn",
    "packageInconsistencySaveAndEndBtn",
    "packageInconsistencyCancelBtn",
    "packageSessionsModal",
    "packageSessionsTitle",
    "packageSessionsSubtitle",
    "packageSessionsTableWrap",
    "packageSessionsTable",
    "packageSessionsTableBody",
    "packageSessionsEmpty",
    "packageSessionsExportExcelBtn",
    "packageSessionsExportPdfBtn",
    "sessionModal",
    "sessionModalTitle",
    "sessionDate",
    "sessionTime",
    "sessionMember",
    "sessionStaff",
    "sessionRoom",
    "sessionNote",
    "sessionPackageHint",
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
    "openPackagesBtn",
    "packagesModal",
    "packagesSummary",
    "openActivityLogsBtn",
    "activityLogsModal",
    "activityLogsTableBody",
    "activityLogsError",
    "activityLogsPagination",
    "activityLogsActionFilter",
    "activityLogsFrom",
    "activityLogsTo",
    "activityLogsApplyFilterBtn",
    "packagesList",
    "packagesTable",
    "packagesExportExcelBtn",
    "packageName",
    "packageLessonCount",
    "packageMonthOverrun",
    "packageWeeklyLessonCount",
    "packageType",
    "packageSaveBtn",
    "packageCancelBtn",
    "packagesFormError",
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
    "openListMembersBtn",
    "listMembersModal",
    "listMembersFilter",
    "listMembersContent",
    "openExpiredMembershipsBtn",
    "expiredMembershipsModal",
    "expiredMembershipsContent",
    "expiredMembershipsFilter",
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
    "mainContent",
    "sidebarOpenBtn",
    "sidebarToggleBtn",
    "sidebarResizeBtn",
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
  saveUi();
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
  saveUi();
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
  if (!els.workingHoursSummary) return;
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

  // Üye ismine göre filtre: haftalıkta hangi günlerde, günlükte hangi saatte geldiği görünür
  if ((ui.plannerFilter || "").trim()) {
    inWeek = inWeek.filter(sessionMatchesPlannerFilter);
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
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const staffId = deleteBtn.dataset.staffId;
        const startTs = parseInt(deleteBtn.dataset.startTs, 10);
        const endTs = parseInt(deleteBtn.dataset.endTs, 10);

        const staff = getStaffById(staffId);
        const staffName = getStaffFullName(staff);
        const sessionCount = group.sessions.length;

        if (!confirm(`${staffName} personelinin bu saatteki ${sessionCount} seansını iptal etmek istediğinize emin misiniz?`)) return;
        // Aynı personel + aynı saat aralığındaki tüm seansları sil (oda farklı olsa bile, kartta görünen hepsi gitsin)
        const toRemove = state.sessions.filter(s =>
          normId(s.staffId) === normId(staffId) &&
          overlaps(s.startTs, s.endTs, startTs, endTs)
        );
        if (window.API && window.API.getToken()) {
          try {
            for (const sess of toRemove) await window.API.deleteSession(sess.id);
            if (window.API.getSessions) state.sessions = await window.API.getSessions();
          } catch (err) {
            console.error("Seanslar silinemedi:", err);
            alert("Seanslar silinemedi: " + (err?.data?.error || err?.message || "Bilinmeyen hata"));
            if (window.API.getSessions) {
              try {
                state.sessions = await window.API.getSessions();
                saveState();
              } catch (_) {}
            }
            render();
            return;
          }
        } else {
          const idsToRemove = new Set(toRemove.map(s => normId(s.id)));
          state.sessions = state.sessions.filter(x => !idsToRemove.has(normId(x.id)));
        }
        saveState();
        render();
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
      singleDeleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Bu seansı iptal etmek istediğinize emin misiniz?")) return;
        const id = singleDeleteBtn.dataset.sessionId;
        if (window.API && window.API.getToken()) {
          try {
            await window.API.deleteSession(id);
            if (window.API.getSessions) state.sessions = await window.API.getSessions();
          } catch (err) {
            console.error("Seans silinemedi:", err);
            alert("Seans silinemedi: " + (err?.data?.error || err?.message || "Bilinmeyen hata"));
            if (window.API.getSessions) {
              try {
                state.sessions = await window.API.getSessions();
                saveState();
              } catch (_) {}
            }
            render();
            return;
          }
        } else {
          state.sessions = state.sessions.filter(x => normId(x.id) !== normId(id));
        }
        saveState();
        render();
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
    // CTRL+F5 sonrası grid henüz ölçülmeden konumlanma yapılabiliyor; layout tamamlandıktan sonra tekrar konumla
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        repositionOverlappingEvents();
      });
    });
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
  if (!els.roomsSummary) return;
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

let editingPackageId = null;

function updatePackagesSummary() {
  if (!els.packagesSummary) return;
  if (!state.packages || state.packages.length === 0) {
    els.packagesSummary.textContent = "Paket tanımlanmadı";
    return;
  }
  const names = state.packages.map((p) => p.name).slice(0, 2).join(", ");
  els.packagesSummary.textContent = names + (state.packages.length > 2 ? "..." : "");
}

function renderPackages() {
  if (!els.packagesList) return;
  els.packagesList.innerHTML = "";
  const list = state.packages || [];
  for (const p of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${Number(p.lessonCount ?? p.lesson_count ?? 0)}</td>
      <td>${Number(p.monthOverrun ?? p.month_overrun ?? 0)}</td>
      <td><button class="btn btn--xs btn--ghost" type="button" data-package-edit="${p.id}" title="Düzelt">✎</button></td>
      <td><button class="btn btn--xs btn--ghost" type="button" data-package-delete="${p.id}" title="Sil">✕</button></td>
    `;
    tr.querySelector("[data-package-edit]").addEventListener("click", () => editPackage(p.id));
    tr.querySelector("[data-package-delete]").addEventListener("click", () => deletePackage(p.id));
    els.packagesList.appendChild(tr);
  }
}

function openPackagesModal() {
  editingPackageId = null;
  clearPackageForm();
  if (els.packagesFormError) els.packagesFormError.classList.add("hidden");
  renderPackages();
  if (els.packagesModal) els.packagesModal.classList.remove("hidden");
}

function closePackagesModal() {
  if (els.packagesModal) els.packagesModal.classList.add("hidden");
  editingPackageId = null;
}

var activityLogsCurrentPage = 1;
var activityLogsTotalPages = 1;
var activityLogsTotal = 0;

function actionLabel(action) {
  var labels = {
    "auth.login": "Giriş",
    "auth.login_failed": "Giriş başarısız",
    "member.create": "Üye ekleme",
    "member.update": "Üye güncelleme",
    "member.delete": "Üye silme",
    "member.delete_permanent": "Üye tam silme",
    "session.create": "Seans ekleme",
    "session.update": "Seans güncelleme",
    "session.delete": "Seans silme",
    "session.delete_bulk": "Grup seans silme",
    "room.create": "Oda ekleme",
    "room.update": "Oda güncelleme",
    "room.delete": "Oda silme",
    "staff.create": "Personel ekleme",
    "staff.update": "Personel güncelleme",
    "staff.delete": "Personel silme",
    "package.create": "Paket ekleme",
    "package.update": "Paket güncelleme",
    "package.delete": "Paket silme",
    "member_package.create": "Üye paketi ekleme",
    "member_package.update": "Üye paketi güncelleme",
    "member_package.end": "Üye paketi sonlandırma",
    "settings.working_hours_update": "Çalışma saatleri güncelleme"
  };
  return labels[action] || action || "—";
}

var entityTypeLabels = {
  session: "Seans",
  member: "Üye",
  room: "Oda",
  staff: "Personel",
  package: "Paket",
  member_package: "Üye paketi",
  settings: "Ayarlar",
  user: "Kullanıcı"
};

function formatLogEntity(entityType, entityId) {
  if (!entityType) return "—";
  var label = entityTypeLabels[entityType] || entityType;
  if (entityId != null && entityId !== "") return label + " #" + entityId;
  return label;
}

function formatLogEntityDisplay(entityType, entityId) {
  if (!entityType) return "—";
  var st = typeof state !== "undefined" ? state : (window.__state || {});
  var id = entityId != null && entityId !== "" ? parseInt(String(entityId), 10) : null;
  if (entityType === "member" && id != null && st.members && st.members.length) {
    var m = st.members.find(function (x) { return x.id === id; });
    if (m) return m.name || m.memberNo || "Üye #" + id;
  }
  if (entityType === "staff" && id != null && st.staff && st.staff.length) {
    var s = st.staff.find(function (x) { return x.id === id; });
    if (s) return (s.firstName + " " + s.lastName).trim();
  }
  if (entityType === "room" && id != null && st.rooms && st.rooms.length) {
    var r = st.rooms.find(function (x) { return x.id === id; });
    if (r) return r.name;
  }
  if (entityType === "package" && id != null && st.packages && st.packages.length) {
    var p = st.packages.find(function (x) { return x.id === id; });
    if (p) return p.name;
  }
  if (entityType === "member_package" && id != null && st.memberPackages && st.memberPackages.length) {
    var mp = st.memberPackages.find(function (x) { return x.id === id; });
    if (mp) {
      var mem = st.members && st.members.find(function (x) { return x.id === mp.memberId; });
      var memberName = mem ? (mem.name || mem.memberNo) : ("Üye #" + mp.memberId);
      var pkg = st.packages && st.packages.find(function (x) { return x.id === mp.packageId; });
      var pkgName = mp.packageName || (pkg && pkg.name) || ("Paket #" + mp.packageId);
      return memberName + " – " + pkgName;
    }
  }
  if (entityType === "session" && id != null && st.sessions && st.sessions.length) {
    var sess = st.sessions.find(function (x) { return x.id === id; });
    if (sess) {
      var mem2 = st.members && st.members.find(function (x) { return x.id === sess.memberId; });
      var memberName2 = mem2 ? (mem2.name || mem2.memberNo) : ("Üye #" + sess.memberId);
      var timeStr = sess.startTs ? new Date(sess.startTs).toLocaleString("tr-TR") : "";
      return timeStr ? memberName2 + " – " + timeStr : memberName2;
    }
  }
  return formatLogEntity(entityType, entityId);
}

function formatLogDetails(details) {
  if (!details || typeof details !== "object" || !Object.keys(details).length) return "";
  var st = typeof state !== "undefined" ? state : (window.__state || {});
  var parts = [];
  var keyLabels = {
    staffId: "Personel",
    memberId: "Üye",
    roomId: "Oda",
    startTs: "Seans saati",
    endTs: "Seans saati",
    member_no: "Üye no",
    name: "Ad",
    lesson_count: "Ders sayısı",
    devices: "Alet sayısı",
    deleteHistory: "Geçmiş silindi",
    softDelete: "Listeden kaldırıldı",
    deletedCount: "Silinen seans sayısı",
    start_date: "Başlangıç tarihi",
    end_date: "Bitiş tarihi",
    daysUpdated: "Güncellenen gün sayısı",
    reason: "Sebep",
    username: "Kullanıcı adı",
    role: "Rol",
    package_id: "Paket",
    member_id: "Üye ID",
    package_name: "Paket",
    skip_day_distribution: "Dağılım"
  };
  var reasonLabels = { user_not_found: "Kullanıcı bulunamadı", invalid_password: "Hatalı şifre" };
  var seenSessionTime = false;
  Object.keys(details).forEach(function (key) {
    var val = details[key];
    var label = keyLabels[key] || key;
    if (val === null || val === undefined) return;
    if (key === "member_no") return;
    if (key === "endTs") return;
    if (key === "startTs" || key === "endTs") {
      if (key === "endTs" || seenSessionTime) return;
      seenSessionTime = true;
      label = "Seans saati";
      val = new Date(Number(details.startTs || details.endTs || val)).toLocaleString("tr-TR");
    } else if (key === "staffId" && st.staff && st.staff.length) {
      var s = st.staff.find(function (x) { return x.id === val || x.id === parseInt(val, 10); });
      val = s ? (s.firstName + " " + s.lastName).trim() : "ID " + val;
    } else if (key === "memberId" && st.members && st.members.length) {
      var m = st.members.find(function (x) { return x.id === val || x.id === parseInt(val, 10); });
      val = m ? (m.name || m.memberNo || "ID " + val) : "ID " + val;
    } else if (key === "roomId" && st.rooms && st.rooms.length) {
      var r = st.rooms.find(function (x) { return x.id === val || x.id === parseInt(val, 10); });
      val = r ? r.name : "ID " + val;
    } else if (key === "package_id" && st.packages && st.packages.length) {
      var pkg = st.packages.find(function (x) { return x.id === val || x.id === parseInt(val, 10); });
      val = pkg ? pkg.name : "ID " + val;
    } else if (key === "reason") {
      val = reasonLabels[val] || val;
    } else if (key === "deleteHistory" || key === "softDelete") {
      val = val ? "Evet" : "Hayır";
    } else if (key === "skip_day_distribution") {
      val = val ? "yapılmadı" : "yapıldı";
    }
    parts.push(label + ": " + String(val));
  });
  return parts.join(" · ");
}

function openActivityLogsModal() {
  if (!els.activityLogsModal) return;
  els.activityLogsError.classList.add("hidden");
  els.activityLogsError.textContent = "";
  activityLogsCurrentPage = 1;
  if (els.activityLogsActionFilter) els.activityLogsActionFilter.value = "";
  if (els.activityLogsFrom) els.activityLogsFrom.value = "";
  if (els.activityLogsTo) els.activityLogsTo.value = "";
  loadActivityLogs(1);
  els.activityLogsModal.classList.remove("hidden");
}

function closeActivityLogsModal() {
  if (els.activityLogsModal) els.activityLogsModal.classList.add("hidden");
}

function loadActivityLogs(page) {
  if (!window.API || !window.API.getActivityLogs || !els.activityLogsTableBody) return;
  var params = { page: page || 1, limit: 50 };
  if (els.activityLogsActionFilter && els.activityLogsActionFilter.value) params.action = els.activityLogsActionFilter.value;
  if (els.activityLogsFrom && els.activityLogsFrom.value) params.from = els.activityLogsFrom.value;
  if (els.activityLogsTo && els.activityLogsTo.value) params.to = els.activityLogsTo.value;
  els.activityLogsTableBody.innerHTML = "<tr><td colspan=\"5\" style=\"text-align:center; padding:16px;\">Yükleniyor…</td></tr>";
  window.API.getActivityLogs(params).then(function (data) {
    var items = (data && data.items) || [];
    var pagination = (data && data.pagination) || {};
    activityLogsCurrentPage = pagination.page || 1;
    activityLogsTotalPages = pagination.totalPages || 1;
    activityLogsTotal = pagination.total || 0;
    els.activityLogsTableBody.innerHTML = "";
    if (items.length === 0) {
      els.activityLogsTableBody.innerHTML = "<tr><td colspan=\"5\" style=\"text-align:center; padding:16px;\">Kayıt yok.</td></tr>";
    } else {
      items.forEach(function (row) {
        var tr = document.createElement("tr");
        var created = row.created_at ? new Date(row.created_at).toLocaleString("tr-TR") : "—";
        var who = (row.actor_name || (row.actor_type === "user" ? "Kullanıcı #" + (row.actor_id || "?") : row.actor_type) || "—");
        var action = actionLabel(row.action);
        var entity = formatLogEntityDisplay(row.entity_type, row.entity_id);
        var detailsStr = "";
        if (row.details && typeof row.details === "object" && Object.keys(row.details).length) {
          detailsStr = formatLogDetails(row.details);
        } else if (row.details && typeof row.details === "string") {
          detailsStr = row.details;
        }
        var detailsEscaped = escapeHtml(detailsStr || "—");
        var detailsTitle = escapeHtml(detailsStr || "");
        if (detailsStr.length > 120) detailsEscaped = escapeHtml(detailsStr.substring(0, 117) + "...");
        tr.innerHTML = "<td>" + escapeHtml(created) + "</td><td>" + escapeHtml(who) + "</td><td>" + escapeHtml(action) + "</td><td>" + escapeHtml(entity) + "</td><td style=\"max-width:320px; font-size:12px; line-height:1.35;\" title=\"" + detailsTitle + "\">" + detailsEscaped + "</td>";
        els.activityLogsTableBody.appendChild(tr);
      });
    }
    var pagEl = els.activityLogsPagination;
    if (pagEl) {
      pagEl.innerHTML = "";
      pagEl.appendChild(document.createTextNode("Toplam " + activityLogsTotal + " kayıt. Sayfa " + activityLogsCurrentPage + " / " + (activityLogsTotalPages || 1) + " "));
      if (activityLogsCurrentPage > 1) {
        var prevBtn = document.createElement("button");
        prevBtn.className = "btn btn--ghost";
        prevBtn.type = "button";
        prevBtn.textContent = "Önceki";
        prevBtn.addEventListener("click", function () { loadActivityLogs(activityLogsCurrentPage - 1); });
        pagEl.appendChild(prevBtn);
      }
      if (activityLogsCurrentPage < activityLogsTotalPages) {
        var nextBtn = document.createElement("button");
        nextBtn.className = "btn btn--ghost";
        nextBtn.type = "button";
        nextBtn.textContent = "Sonraki";
        nextBtn.addEventListener("click", function () { loadActivityLogs(activityLogsCurrentPage + 1); });
        pagEl.appendChild(nextBtn);
      }
    }
  }).catch(function (err) {
    els.activityLogsTableBody.innerHTML = "";
    if (els.activityLogsError) {
      els.activityLogsError.textContent = err && (err.message || err.error) || "Loglar yüklenemedi.";
      els.activityLogsError.classList.remove("hidden");
    }
    if (els.activityLogsPagination) els.activityLogsPagination.innerHTML = "";
  });
}

function clearPackageForm() {
  if (!els.packageName) return;
  els.packageName.value = "";
  els.packageLessonCount.value = "1";
  els.packageMonthOverrun.value = "0";
  els.packageWeeklyLessonCount.value = "";
  els.packageType.value = "fixed";
  editingPackageId = null;
}

function editPackage(id) {
  const p = state.packages.find((x) => x.id === id);
  if (!p) return;
  editingPackageId = id;
  els.packageName.value = p.name || "";
  els.packageLessonCount.value = String(p.lessonCount ?? p.lesson_count ?? 1);
  els.packageMonthOverrun.value = String(p.monthOverrun ?? p.month_overrun ?? 0);
  els.packageWeeklyLessonCount.value = p.weeklyLessonCount ?? p.weekly_lesson_count ?? "";
  els.packageType.value = p.packageType ?? p.package_type ?? "fixed";
  if (els.packagesFormError) els.packagesFormError.classList.add("hidden");
}

async function savePackageFromForm() {
  const name = (els.packageName && els.packageName.value || "").trim();
  const lessonCount = Math.max(1, parseInt(els.packageLessonCount && els.packageLessonCount.value || "1", 10) || 1);
  const monthOverrun = Math.max(0, parseInt(els.packageMonthOverrun && els.packageMonthOverrun.value || "0", 10) || 0);
  const weeklyLessonCountRaw = els.packageWeeklyLessonCount && els.packageWeeklyLessonCount.value;
  const weeklyLessonCount = weeklyLessonCountRaw === "" ? null : (parseInt(weeklyLessonCountRaw, 10) || 0);
  const packageType = (els.packageType && els.packageType.value) || "fixed";

  if (!name) {
    if (els.packagesFormError) {
      els.packagesFormError.textContent = "Paket adı girin.";
      els.packagesFormError.classList.remove("hidden");
    }
    return;
  }

  const payload = { name, lessonCount, monthOverrun, weeklyLessonCount, packageType };

  if (window.API && window.API.getToken()) {
    try {
      if (editingPackageId) {
        const updated = await window.API.updatePackage(editingPackageId, payload);
        const idx = state.packages.findIndex((x) => x.id === editingPackageId);
        if (idx !== -1) state.packages[idx] = updated;
      } else {
        const created = await window.API.createPackage(payload);
        state.packages = state.packages || [];
        state.packages.push(created);
      }
    } catch (e) {
      if (els.packagesFormError) {
        els.packagesFormError.textContent = (e.data && (e.data.error || (e.data.errors && e.data.errors[0] && e.data.errors[0].msg))) || e.message || "Kayıt başarısız.";
        els.packagesFormError.classList.remove("hidden");
      }
      return;
    }
  } else {
    if (editingPackageId) {
      const idx = state.packages.findIndex((x) => x.id === editingPackageId);
      if (idx !== -1) {
        state.packages[idx] = { ...state.packages[idx], ...payload, lessonCount, monthOverrun, weeklyLessonCount, packageType };
      }
    } else {
      state.packages = state.packages || [];
      state.packages.push({
        id: uid("pkg"),
        ...payload,
        lessonCount,
        monthOverrun,
        weeklyLessonCount,
        packageType,
      });
    }
  }

  if (els.packagesFormError) els.packagesFormError.classList.add("hidden");
  clearPackageForm();
  saveState();
  updatePackagesSummary();
  renderPackages();
}

async function deletePackage(id) {
  const p = state.packages.find((x) => x.id === id);
  if (!p || !confirm(`"${p.name}" paketini silmek istediğinize emin misiniz?`)) return;

  if (window.API && window.API.getToken()) {
    try {
      await window.API.deletePackage(id);
    } catch (e) {
      alert((e.data && e.data.error) || e.message || "Paket silinemedi.");
      return;
    }
  }

  state.packages = (state.packages || []).filter((x) => x.id !== id);
  if (editingPackageId === id) clearPackageForm();
  saveState();
  updatePackagesSummary();
  renderPackages();
}

function updateStaffSummary() {
  if (!els.staffSummary) return;
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

/** Üye listesi artık sidebar'da değil, "Üyeleri Listele" modalında gösteriliyor; sidebar boş bırakılır */
function renderMembers() {
  const wrap = els.membersList;
  if (!wrap) return;
  wrap.innerHTML = "";
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
  if (els.memberPackageInfoBtn) els.memberPackageInfoBtn.style.display = m ? "inline-block" : "none";

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

let editingMemberPackageId = null;

/** Seçilen tarih aralığı ve slot'lara göre [startDate, endDate] içinde oluşturulabilecek randevu günü sayısı. */
function countPossibleSessionsInRange(startDate, endDate, slots) {
  if (!slots || slots.length === 0) return 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    for (const slot of slots) {
      if (Number(slot.dayOfWeek) === dayOfWeek) {
        count++;
        break;
      }
    }
  }
  return count;
}

/** Verilen tarih aralığı ve slot'lara göre oluşturulacak ilk N seansın son seansının tarihini (YYYY-MM-DD) döndürür. */
function getLastSessionDateInRange(startDate, endDate, slots, lessonCount) {
  if (!slots || slots.length === 0 || !lessonCount || lessonCount < 1) return null;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");
  let count = 0;
  let lastDateStr = null;
  for (let d = new Date(start); d <= end && count < lessonCount; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    for (const slot of slots) {
      if (Number(slot.dayOfWeek) === dayOfWeek) {
        count++;
        lastDateStr = d.toISOString().slice(0, 10);
        break;
      }
    }
  }
  return lastDateStr;
}

/** YYYY-MM-DD string'ine bir gün ekleyip aynı formatta döndürür. */
function nextDayStr(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getMemberPackageDaySlotsData() {
  if (!els.mpDaySlots) return [];
  const rows = els.mpDaySlots.querySelectorAll("[data-day]");
  const slots = [];
  rows.forEach((row) => {
    const day = parseInt(row.dataset.day, 10);
    const chk = row.querySelector('input[type="checkbox"]');
    const timeInput = row.querySelector('input[type="time"]');
    const staffSelect = row.querySelector("select");
    if (!chk || !chk.checked || !timeInput || !staffSelect) return;
    const startTime = timeInput.value;
    const staffId = staffSelect.value ? parseInt(staffSelect.value, 10) : null;
    if (startTime && staffId) slots.push({ dayOfWeek: day, startTime, staffId });
  });
  return slots;
}

/** "Gün dağılımı yapmak istemiyorum" seçiliyse gün/saat alanını gizler ve seçilemez yapar; değilse gösterir ve her satırda sadece o gün işaretliyse saat/personel etkin olur. */
function updateMemberPackageDaySlotsSelectable() {
  const skip = els.mpSkipDayDistribution && els.mpSkipDayDistribution.checked;
  if (els.mpDaySlotsWrap) {
    els.mpDaySlotsWrap.style.display = skip ? "none" : "";
    els.mpDaySlotsWrap.setAttribute("aria-hidden", skip ? "true" : "false");
  }
  if (!els.mpDaySlots) return;
  if (skip) {
    els.mpDaySlots.querySelectorAll("input, select").forEach((el) => { el.disabled = true; });
    return;
  }
  // skip false: gün checkbox'ları her zaman tıklanabilir; sadece o gün işaretliyse saat/personel seçilebilir
  els.mpDaySlots.querySelectorAll(".listItem").forEach((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    const timeInput = row.querySelector('input[type="time"]');
    const staffSelect = row.querySelector("select");
    if (cb) cb.disabled = false;
    const enabled = cb && cb.checked;
    if (timeInput) timeInput.disabled = !enabled;
    if (staffSelect) staffSelect.disabled = !enabled;
  });
}

function renderMemberPackageDaySlots(slots) {
  if (!els.mpDaySlots) return;
  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  els.mpDaySlots.innerHTML = "";
  for (let day = 0; day < 7; day++) {
    const slot = (slots || []).find((s) => Number(s.dayOfWeek) === day);
    const checked = !!slot;
    const item = document.createElement("div");
    item.className = "listItem";
    item.dataset.day = String(day);
    const staffOptions = state.staff.map((s) => `<option value="${s.id}">${getStaffFullName(s)}</option>`).join("");
    item.innerHTML = `
      <div class="listItem__left" style="flex:1; display:flex; flex-direction:row; align-items:center; gap:10px;">
        <input type="checkbox" data-day="${day}" ${checked ? "checked" : ""} style="cursor:pointer; flex-shrink:0;" />
        <label style="cursor:pointer; min-width:90px; margin:0;">${dayNames[day]}</label>
      </div>
      <div class="listItem__actions" style="display:flex; gap:8px; align-items:center;">
        <input class="input" type="time" data-day="${day}" value="${checked ? (slot.startTime || "18:00") : ""}" style="width:90px;" ${checked ? "" : "disabled"} />
        <select class="input" data-day="${day}" style="min-width:140px;" ${checked ? "" : "disabled"}><option value="">Seçiniz</option>${staffOptions}</select>
      </div>
    `;
    const checkbox = item.querySelector('input[type="checkbox"]');
    const timeInput = item.querySelector('input[type="time"]');
    const staffSelect = item.querySelector("select");
    if (staffSelect && slot && slot.staffId) staffSelect.value = String(slot.staffId);
    if (checkbox && timeInput && staffSelect) {
      checkbox.addEventListener("change", () => {
        const isChecked = checkbox.checked;
        timeInput.disabled = !isChecked;
        staffSelect.disabled = !isChecked;
        if (!isChecked) {
          timeInput.value = "";
          staffSelect.value = "";
        } else if (!timeInput.value) timeInput.value = "";
      });
    }
    els.mpDaySlots.appendChild(item);
  }
  // Modal açılırken / render bittikten hemen sonra gün seçili değilse saat ve personel kilitli olsun
  updateMemberPackageDaySlotsSelectable();
}

async function renderMemberPackageHistory(memberId) {
  if (!els.mpHistoryList || memberId == null) return;
  const list = (state.memberPackages || []).filter((mp) => normId(mp.memberId) === normId(memberId));
  els.mpHistoryList.innerHTML = "";
  for (const mp of list) {
    const card = document.createElement("div");
    const isCompleted = (mp.status || "").toLowerCase() === "completed" || (mp.status || "").toLowerCase() === "cancelled";
    card.className = "mp-history-item panel" + (isCompleted ? " mp-history-item--completed" : "");
    const startStr = (mp.startDate || "").toString().slice(0, 10);
    const endStr = (mp.endDate || "").toString().slice(0, 10);
    card.innerHTML = `
      <div class="mp-history-item__row">
        <span class="mp-history-item__text">
          <strong>${escapeHtml(mp.packageName || "Paket")}</strong>
          <span class="mp-history-item__dates">${escapeHtml(startStr)} – ${escapeHtml(endStr)}</span>
          <span class="mp-history-item__divider">/</span>
          <button type="button" class="btn btn--xs btn--ghost mp-history-item__btn" data-mp-id="${mp.id}" data-action="view-sessions">Seansları Gör</button>
          ${mp.status === "active" ? `<button type="button" class="btn btn--xs btn--ghost" data-mp-id="${mp.id}" data-action="edit">Düzenle</button>` : ""}
        </span>
      </div>
    `;
    const editBtn = card.querySelector("[data-action=edit]");
    if (editBtn) editBtn.addEventListener("click", () => openMemberPackageModal(memberId, mp.id));
    const btn = card.querySelector("[data-action=view-sessions]");
    if (btn) btn.addEventListener("click", () => openPackageSessionsModal(mp, memberId));
    els.mpHistoryList.appendChild(card);
  }
  if (list.length === 0) els.mpHistoryList.innerHTML = '<div class="hint">Bu üyeye ait paket kaydı yok.</div>';
}

let packageSessionsCurrent = null;

function openPackageSessionsModal(mp, memberId) {
  if (!els.packageSessionsModal) return;
  packageSessionsCurrent = { mp, sessions: [], memberName: "" };
  const m = memberId != null ? state.members.find((x) => normId(x.id) === normId(memberId)) : null;
  packageSessionsCurrent.memberName = m ? (m.memberNo || m.name || "Üye") : "Üye";
  els.packageSessionsTitle.textContent = (mp.packageName || "Paket") + " – Seanslar";
  els.packageSessionsSubtitle.textContent = packageSessionsCurrent.memberName + " • " + (mp.startDate || "") + " – " + (mp.endDate || "") + (mp.status === "active" ? " • Aktif" : " • Tamamlandı");
  els.packageSessionsTableBody.innerHTML = "";
  els.packageSessionsEmpty.classList.add("hidden");
  if (els.packageSessionsTable) els.packageSessionsTable.classList.remove("hidden");
  if (!window.API || !window.API.getMemberPackageSessions) {
    els.packageSessionsEmpty.textContent = "API kullanılamıyor.";
    els.packageSessionsEmpty.classList.remove("hidden");
    els.packageSessionsModal.classList.remove("hidden");
    return;
  }
  window.API.getMemberPackageSessions(mp.id).then(async (sessions) => {
    packageSessionsCurrent.sessions = sessions || [];
    renderPackageSessionsTable(packageSessionsCurrent.sessions);
    if (!packageSessionsCurrent.sessions.length) {
      els.packageSessionsEmpty.textContent = "Seans kaydı yok.";
      els.packageSessionsEmpty.classList.remove("hidden");
      if (els.packageSessionsTable) els.packageSessionsTable.classList.add("hidden");
    }
    // Takvim verisini de güncelle: veritabanından silinen seanslar takvimde hemen kaybolsun
    if (window.API.getSessions) {
      try {
        state.sessions = await window.API.getSessions();
        saveState();
        render();
      } catch (_) {}
    }
  }).catch((e) => {
    els.packageSessionsEmpty.textContent = (e.data && e.data.error) || e.message || "Seanslar yüklenemedi.";
    els.packageSessionsEmpty.classList.remove("hidden");
    if (els.packageSessionsTable) els.packageSessionsTable.classList.add("hidden");
  });
  els.packageSessionsModal.classList.remove("hidden");
}

function closePackageSessionsModal() {
  if (els.packageSessionsModal) els.packageSessionsModal.classList.add("hidden");
  packageSessionsCurrent = null;
}

function renderPackageSessionsTable(sessions) {
  if (!els.packageSessionsTableBody) return;
  els.packageSessionsTableBody.innerHTML = "";
  (sessions || []).forEach((s, i) => {
    const d = new Date(Number(s.start_ts));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid var(--border)";
    tr.style.cursor = "pointer";
    tr.title = "Gün, saat veya personel değiştirmek için tıklayın";
    tr.dataset.sessionId = s.id;
    tr.innerHTML = `
      <td style="padding:8px 10px;">${i + 1}</td>
      <td style="padding:8px 10px;">${escapeHtml(dateStr)}</td>
      <td style="padding:8px 10px;">${escapeHtml(timeStr)}</td>
      <td style="padding:8px 10px;">${escapeHtml(s.staff_name || "–")}</td>
      <td style="padding:8px 10px;">${escapeHtml(s.room_name || "–")}</td>
      <td style="padding:8px 10px;">${escapeHtml((s.note || "").toString())}</td>
    `;
    els.packageSessionsTableBody.appendChild(tr);
  });
}

function exportPackageSessionsExcel() {
  if (!packageSessionsCurrent || !packageSessionsCurrent.sessions.length) return;
  const headers = ["#", "Tarih", "Saat", "Personel", "Oda", "Not"];
  const rows = packageSessionsCurrent.sessions.map((s, i) => {
    const d = new Date(Number(s.start_ts));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return [i + 1, dateStr, timeStr, s.staff_name || "–", s.room_name || "–", (s.note || "").toString()];
  });
  if (typeof XLSX !== "undefined") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Paket Seansları");
    const base = "paket-seanslari-" + (packageSessionsCurrent.mp.packageName || "paket").replace(/\s+/g, "-") + "-" + (packageSessionsCurrent.mp.startDate || "").slice(0, 10);
    XLSX.writeFile(wb, base + ".xlsx");
  } else {
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "paket-seanslari-" + (packageSessionsCurrent.mp.packageName || "paket").replace(/\s+/g, "-") + "-" + (packageSessionsCurrent.mp.startDate || "").slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function exportPackageSessionsPdf() {
  if (!packageSessionsCurrent || !packageSessionsCurrent.sessions.length) return;
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    alert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = (packageSessionsCurrent.mp.packageName || "Paket") + " – Seanslar";
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(packageSessionsCurrent.memberName + " • " + (packageSessionsCurrent.mp.startDate || "") + " – " + (packageSessionsCurrent.mp.endDate || ""), 14, 22);
  const tableData = packageSessionsCurrent.sessions.map((s, i) => {
    const d = new Date(Number(s.start_ts));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return [i + 1, dateStr, timeStr, s.staff_name || "–", s.room_name || "–", (s.note || "").toString().slice(0, 30)];
  });
  doc.autoTable({
    head: [["#", "Tarih", "Saat", "Personel", "Oda", "Not"]],
    body: tableData,
    startY: 28,
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 9 },
  });
  doc.save("paket-seanslari-" + (packageSessionsCurrent.mp.packageName || "paket").replace(/\s+/g, "-") + ".pdf");
}

function openMemberPackageModal(memberId, memberPackageId) {
  editingMemberPackageId = memberPackageId || null;
  const memberIdNorm = memberId != null ? normId(memberId) : null;
  const pending = ui.pendingNewMember;
  const m = memberIdNorm ? state.members.find((x) => normId(x.id) === memberIdNorm) : (pending ? null : null);
  if (!m && !pending) return;

  ui.editingMemberId = memberIdNorm;

  if (els.mpFormError) els.mpFormError.classList.add("hidden");
  if (els.mpAvailabilityError) els.mpAvailabilityError.classList.add("hidden");

  // Yeni paket eklerken: üyenin zaten aktif paketi varsa uyarı (pending yeni üyede yok)
  const activePackage = !editingMemberPackageId && !pending && (state.memberPackages || []).find(
    (mp) => normId(mp.memberId) === memberIdNorm && (mp.status || "").toLowerCase() === "active"
  );
  if (activePackage && els.mpFormError) {
    els.mpFormError.textContent = "Bu üyenin zaten aktif bir paketi var. Yeni paket eklemek için önce mevcut paketi \"Sonlandır\" ile kapatın.";
    els.mpFormError.classList.remove("hidden");
  }

  if (els.mpMemberNo) els.mpMemberNo.value = pending ? "Yeni üye" : (m.memberNo || m.name || "");

  if (els.mpPackage) {
    els.mpPackage.innerHTML = '<option value="">Seçiniz</option>' + (state.packages || []).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    if (editingMemberPackageId) {
      const mp = state.memberPackages.find((x) => x.id === editingMemberPackageId);
      if (mp) els.mpPackage.value = String(mp.packageId);
    } else els.mpPackage.value = "";
  }

  if (els.mpStartDate) els.mpStartDate.value = "";
  if (els.mpEndDate) els.mpEndDate.value = "";
  if (els.mpSkipDayDistribution) els.mpSkipDayDistribution.checked = false;

  if (els.mpPackage) els.mpPackage.disabled = false;
  if (els.mpPackageFirstSessionHint) { els.mpPackageFirstSessionHint.classList.add("hidden"); els.mpPackageFirstSessionHint.style.display = "none"; }
  if (els.mpStartDate) els.mpStartDate.removeAttribute("max");

  if (editingMemberPackageId && window.API && window.API.getMemberPackage) {
    window.API.getMemberPackage(editingMemberPackageId).then((mp) => {
      if (els.mpStartDate) els.mpStartDate.value = (mp.startDate || "").toString().slice(0, 10);
      if (els.mpEndDate) els.mpEndDate.value = (mp.endDate || "").toString().slice(0, 10);
      if (els.mpSkipDayDistribution) els.mpSkipDayDistribution.checked = !!mp.skipDayDistribution;
      renderMemberPackageDaySlots(mp.slots || []);
      updateMemberPackageDaySlotsSelectable();
      if (window.API.getMemberPackageSessions) {
        window.API.getMemberPackageSessions(editingMemberPackageId).then((sessions) => {
          const list = Array.isArray(sessions) ? sessions : [];
          const now = Date.now();
          const withTs = list.filter((s) => s.start_ts != null).map((s) => Number(s.start_ts));
          const minTs = withTs.length > 0 ? Math.min(...withTs) : null;
          const firstSessionPassed = minTs != null && minTs < now;
          if (firstSessionPassed) {
            if (els.mpPackage) {
              els.mpPackage.disabled = true;
            }
            if (els.mpPackageFirstSessionHint) {
              els.mpPackageFirstSessionHint.classList.remove("hidden");
              els.mpPackageFirstSessionHint.style.display = "block";
            }
            if (els.mpStartDate && minTs != null) {
              const d = new Date(minTs);
              const firstSessionDateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
              els.mpStartDate.setAttribute("max", firstSessionDateStr);
            }
          } else if (els.mpStartDate) {
            els.mpStartDate.removeAttribute("max");
          }
        }).catch(() => {});
      }
    }).catch(() => { renderMemberPackageDaySlots([]); updateMemberPackageDaySlotsSelectable(); });
  } else {
    renderMemberPackageDaySlots([]);
  }

  updateMemberPackageDaySlotsSelectable();
  if (els.mpSkipDayDistribution) {
    els.mpSkipDayDistribution.onchange = () => updateMemberPackageDaySlotsSelectable();
  }

  if (!pending) renderMemberPackageHistory(memberIdNorm);
  else if (els.mpHistoryList) els.mpHistoryList.innerHTML = "";
  if (els.mpEndMembershipBtn) {
    els.mpEndMembershipBtn.style.display = pending ? "none" : (editingMemberPackageId ? "inline-block" : "none");
  }
  if (els.mpSaveBtn) els.mpSaveBtn.disabled = !!activePackage;
  if (els.memberPackageModal) els.memberPackageModal.classList.remove("hidden");
}

function closeMemberPackageModal() {
  if (els.memberPackageModal) els.memberPackageModal.classList.add("hidden");
  editingMemberPackageId = null;
  if (ui.pendingNewMember) {
    ui.pendingNewMember = null;
    ui.editingMemberId = null;
  }
}

async function saveMemberPackageFromForm() {
  // Yeni üye akışı: önce üyeyi kaydet (API veya yerel), sonra paketi ekle
  if (ui.pendingNewMember) {
    if (window.API && window.API.getToken()) {
      try {
        const created = await window.API.createMember(ui.pendingNewMember);
        state.members.push(created);
        ui.editingMemberId = created.id;
        ui.pendingNewMember = null;
        saveState();
      } catch (e) {
        if (els.mpFormError) {
          const msg = (e.data && e.data.error) || e.message || "Üye kaydedilemedi.";
          els.mpFormError.textContent = msg;
          els.mpFormError.classList.remove("hidden");
        }
        return;
      }
    } else {
      const p = ui.pendingNewMember;
      const newMember = { id: Date.now(), firstName: p.firstName, lastName: p.lastName, phone: p.phone, name: p.name || (p.firstName + " " + p.lastName), email: p.email || null, birthDate: p.birthDate || null, profession: p.profession || null, address: p.address || null, contactName: p.contactName || null, contactPhone: p.contactPhone || null };
      state.members.push(newMember);
      ui.editingMemberId = newMember.id;
      ui.pendingNewMember = null;
      saveState();
    }
  }

  const memberId = ui.editingMemberId ? normId(ui.editingMemberId) : null;
  const m = memberId ? state.members.find((x) => normId(x.id) === memberId) : null;
  if (!m) {
    if (els.mpFormError) { els.mpFormError.textContent = "Üye seçili değil."; els.mpFormError.classList.remove("hidden"); }
    return;
  }
  const memberIdNum = m.id && Number(m.id) ? Number(m.id) : null;
  if (memberIdNum == null) {
    if (els.mpFormError) { els.mpFormError.textContent = "Üye kaydedilmemiş; önce üye kartını kaydedin."; els.mpFormError.classList.remove("hidden"); return; }
    return;
  }

  const packageId = els.mpPackage && els.mpPackage.value ? parseInt(els.mpPackage.value, 10) : null;
  const startDate = els.mpStartDate && els.mpStartDate.value ? els.mpStartDate.value : "";
  const endDate = els.mpEndDate && els.mpEndDate.value ? els.mpEndDate.value : "";
  const skipDayDistribution = els.mpSkipDayDistribution && els.mpSkipDayDistribution.checked;

  if (els.mpFormError) els.mpFormError.classList.add("hidden");
  if (els.mpAvailabilityError) els.mpAvailabilityError.classList.add("hidden");

  if (!packageId) {
    if (els.mpFormError) { els.mpFormError.textContent = "Paket seçin."; els.mpFormError.classList.remove("hidden"); return; }
    return;
  }
  if (!startDate || !endDate) {
    if (els.mpFormError) { els.mpFormError.textContent = "Başlangıç ve bitiş tarihi girin."; els.mpFormError.classList.remove("hidden"); return; }
    return;
  }

  const slots = skipDayDistribution ? [] : getMemberPackageDaySlotsData();
  if (!skipDayDistribution && slots.length === 0) {
    if (els.mpFormError) { els.mpFormError.textContent = "En az bir gün için saat ve personel seçin."; els.mpFormError.classList.remove("hidden"); return; }
    return;
  }

  if (!skipDayDistribution && slots.length > 0) {
    const pkg = (state.packages || []).find((p) => p.id === packageId);
    const lessonCount = pkg ? Number(pkg.lessonCount ?? pkg.lesson_count ?? 0) : 0;
    if (lessonCount > 0) {
      const maxPossible = countPossibleSessionsInRange(startDate, endDate, slots);
      if (maxPossible < lessonCount) {
        if (els.mpFormError) {
          els.mpFormError.textContent = `Seçilen tarih aralığı ve haftalık günlere göre en fazla ${maxPossible} randevu oluşturulabilir. Bu paket ${lessonCount} ders içeriyor. Lütfen bitiş tarihini uzatın veya haftalık gün sayısını artırın.`;
          els.mpFormError.classList.remove("hidden");
        }
        return;
      }
    }
  }

  // Kayıttan önce check-availability çağrılmıyor; çakışmalar backend'den sessionConflicts olarak döner (rate limit tasarrufu).
  // Güncellemede effectiveDate = bugün: bu tarihten önceki seanslara dokunulmaz, sonrası yeni gün dağılımına göre oluşturulur.
  // "Gün dağılımı yapmak istemiyorum" seçildiğinde slots göndermiyoruz; backend sadece gelecek seansları siler, slot tanımları korunur (tekrar açınca aynı günler kullanılır).
  const todayStr = new Date().toISOString().slice(0, 10);
  const payload = { memberId: memberIdNum, packageId, startDate, endDate, skipDayDistribution, slots };
  let updatePayload;
  if (editingMemberPackageId) {
    if (skipDayDistribution) {
      updatePayload = { startDate, endDate, skipDayDistribution, packageId };
    } else if (slots.length > 0) {
      updatePayload = { startDate, endDate, skipDayDistribution, packageId, slots, effectiveDate: todayStr };
    } else {
      updatePayload = { startDate, endDate, skipDayDistribution, packageId, slots };
    }
  } else {
    updatePayload = { startDate, endDate, skipDayDistribution, slots };
  }

  // Tutarsızlık kontrolü: Seanslar paket bitişinden önce bitiyor ve bugün o tarihten sonra → kalan seans 0 ama üye aktif listede kalır.
  if (window.API && window.API.getToken() && !skipDayDistribution && slots.length > 0) {
    const pkg = (state.packages || []).find((p) => p.id === packageId);
    const lessonCount = pkg ? Number(pkg.lessonCount ?? pkg.lesson_count ?? 0) : 0;
    if (lessonCount > 0) {
      const lastSessionDate = getLastSessionDateInRange(startDate, endDate, slots, lessonCount);
      if (lastSessionDate && lastSessionDate < endDate && todayStr > lastSessionDate) {
        const lastFormatted = lastSessionDate.split("-").reverse().join(".");
        const endFormatted = endDate.split("-").reverse().join(".");
        if (els.packageInconsistencyMessage) {
          els.packageInconsistencyMessage.textContent =
            "Seanslar " + lastFormatted + " tarihinde bitiyor, paket bitişi ise " + endFormatted + ". " +
            "Bu durumda üye \"Aktif Üyeler\" listesinde kalacak ancak kalan seans 0 görünecektir.";
        }
        window._pendingMemberPackageSave = {
          payload,
          updatePayload,
          editingMemberPackageId: editingMemberPackageId || null,
          memberId,
          lastSessionDate,
        };
        if (els.packageInconsistencyModal) els.packageInconsistencyModal.classList.remove("hidden");
        return;
      }
    }
  }

  // Modal gösterilmediyse doğrudan kaydet (pending set edip tek fonksiyondan kaydetmek için)
  if (!window._pendingMemberPackageSave) {
    window._pendingMemberPackageSave = {
      payload,
      updatePayload,
      editingMemberPackageId: editingMemberPackageId || null,
      memberId,
      lastSessionDate: null,
    };
  }
  await doActualMemberPackageSave(null);
}

/** Gerçek paket kaydını yapar. endAfterSaveWithLastSessionDate: son seans tarihi (YYYY-MM-DD) ise kayıttan sonra üyeliği bu tarihin ertesi günü ile sonlandırır; null ise sadece kaydet. */
async function doActualMemberPackageSave(endAfterSaveWithLastSessionDate) {
  const pending = window._pendingMemberPackageSave;
  const payload = pending ? pending.payload : null;
  const updatePayload = pending ? pending.updatePayload : null;
  const editingId = pending ? pending.editingMemberPackageId : editingMemberPackageId;
  const memberId = pending ? pending.memberId : (ui.editingMemberId ? normId(ui.editingMemberId) : null);

  if (!payload && !editingId) {
    if (pending) window._pendingMemberPackageSave = null;
    if (els.packageInconsistencyModal) els.packageInconsistencyModal.classList.add("hidden");
    return;
  }

  if (els.mpFormError) els.mpFormError.classList.add("hidden");

  if (window.API && window.API.getToken()) {
    try {
      let createdOrUpdated = null;
      if (editingId) {
        createdOrUpdated = await window.API.updateMemberPackage(editingId, updatePayload);
        const idx = (state.memberPackages || []).findIndex((x) => x.id === editingId);
        if (idx !== -1) state.memberPackages[idx] = createdOrUpdated;
        if (createdOrUpdated.sessionConflicts && createdOrUpdated.sessionConflicts.length > 0) {
          const list = createdOrUpdated.sessionConflicts.map((c) => c.date + " " + c.day_name + " " + (c.start_time || "")).join("\n");
          alert("Paket güncellendi. Aşağıdaki günlerde yer olmadığı için seans eklenmedi:\n\n" + list);
        }
      } else {
        createdOrUpdated = await window.API.createMemberPackage(payload);
        state.memberPackages = state.memberPackages || [];
        state.memberPackages.push(createdOrUpdated);
        if (createdOrUpdated.sessionConflicts && createdOrUpdated.sessionConflicts.length > 0) {
          const list = createdOrUpdated.sessionConflicts.map((c) => c.date + " " + c.day_name + " " + (c.start_time || "")).join("\n");
          alert("Paket kaydedildi. Aşağıdaki günlerde yer olmadığı için seans eklenmedi:\n\n" + list);
        }
      }
      if (window.API.getSessions) state.sessions = await window.API.getSessions();

      if (endAfterSaveWithLastSessionDate && createdOrUpdated && createdOrUpdated.id) {
        const endDateStr = nextDayStr(endAfterSaveWithLastSessionDate);
        const ended = await window.API.endMemberPackage(createdOrUpdated.id, endDateStr);
        if (ended) {
          const idx = (state.memberPackages || []).findIndex((x) => x.id === createdOrUpdated.id);
          if (idx !== -1) state.memberPackages[idx] = ended;
        }
        if (window.API.getSessions) state.sessions = await window.API.getSessions();
      }
    } catch (e) {
      if (els.mpFormError) {
        els.mpFormError.textContent = (e.data && (e.data.error || (e.data.errors && e.data.errors[0] && e.data.errors[0].msg))) || e.message || "Kayıt başarısız.";
        els.mpFormError.classList.remove("hidden");
      }
      if (window._pendingMemberPackageSave) window._pendingMemberPackageSave = null;
      if (els.packageInconsistencyModal) els.packageInconsistencyModal.classList.add("hidden");
      return;
    }
  } else {
    state.memberPackages = state.memberPackages || [];
    if (editingId) {
      const idx = state.memberPackages.findIndex((x) => x.id === editingId);
      if (idx !== -1) state.memberPackages[idx] = { ...state.memberPackages[idx], ...payload, startDate: payload.startDate, endDate: payload.endDate, skipDayDistribution: payload.skipDayDistribution, slots: payload.slots };
    } else {
      state.memberPackages.push({ id: uid("mp"), ...payload, packageName: (state.packages.find((p) => p.id === payload.packageId) || {}).name, status: "active" });
    }
  }

  window._pendingMemberPackageSave = null;
  if (els.packageInconsistencyModal) els.packageInconsistencyModal.classList.add("hidden");
  closeMemberPackageModal();
  saveState();
  render();
  if (memberId) renderMemberPackageHistory(memberId);
}

async function endMemberPackageFromModal() {
  if (!editingMemberPackageId) return;
  if (!confirm("Bu üyeliği sonlandırmak istediğinize emin misiniz? O andan sonraki seanslar iptal edilecektir.")) return;
  const today = new Date();
  const endDateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  if (window.API && window.API.getToken()) {
    try {
      await window.API.endMemberPackage(editingMemberPackageId, endDateStr);
      if (window.API.getSessions) state.sessions = await window.API.getSessions();
    } catch (e) {
      alert((e.data && e.data.error) || e.message || "Sonlandırılamadı.");
      return;
    }
  }
  const idx = (state.memberPackages || []).findIndex((x) => x.id === editingMemberPackageId);
  if (idx !== -1) state.memberPackages[idx] = { ...state.memberPackages[idx], status: "completed", endDate: endDateStr };
  closeMemberPackageModal();
  saveState();
  render();
  if (ui.editingMemberId) renderMemberPackageHistory(normId(ui.editingMemberId));
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
        // Yeni üye: önce veritabanına yazma; paket modalını aç, paket kaydedilince üye+paket birlikte kaydedilir; Vazgeç = hiç kayıt yok
        ui.pendingNewMember = payload;
        ui.editingMemberId = null;
        closeMemberCardModal();
        render();
        openMemberPackageModal(null);
        if (els.mpFormError) {
          els.mpFormError.textContent = "Üye bilgileri hazır. Paket tanımlayıp kaydedin; vazgeçerseniz üye kaydedilmez.";
          els.mpFormError.classList.remove("hidden");
        }
        return;
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
      // Yeni üye (offline): paket kaydedilene kadar state'e ekleme; Vazgeç = iptal
      ui.pendingNewMember = { ...payload, name: payload.firstName + " " + payload.lastName };
      ui.editingMemberId = null;
      closeMemberCardModal();
      render();
      openMemberPackageModal(null);
      if (els.mpFormError) {
        els.mpFormError.textContent = "Üye bilgileri hazır. Paket tanımlayıp kaydedin; vazgeçerseniz üye kaydedilmez.";
        els.mpFormError.classList.remove("hidden");
      }
      return;
    }
  }
  saveState();
  closeMemberCardModal();
  render();
}

/** Üye silme modalını açar (admin şifresi + geçmiş silinsin mi?). API yoksa veya token yoksa eski onay ile yerel siler. */
function openDeleteMemberModal(memberId) {
  if (!memberId) return;
  ui.deleteMemberId = memberId;
  if (els.deleteMemberStep1) els.deleteMemberStep1.classList.remove("hidden");
  if (els.deleteMemberStep2) els.deleteMemberStep2.classList.add("hidden");
  if (els.deleteMemberNextBtn) { els.deleteMemberNextBtn.classList.remove("hidden"); els.deleteMemberNextBtn.disabled = false; }
  if (els.deleteMemberConfirmBtn) els.deleteMemberConfirmBtn.classList.add("hidden");
  if (els.deleteMemberPassword) els.deleteMemberPassword.value = "";
  if (els.deleteMemberHistoryNo) els.deleteMemberHistoryNo.checked = true;
  if (els.deleteMemberHistoryYes) els.deleteMemberHistoryYes.checked = false;
  if (els.deleteMemberError) { els.deleteMemberError.textContent = ""; els.deleteMemberError.classList.add("hidden"); }
  if (els.deleteMemberModal) els.deleteMemberModal.classList.remove("hidden");
  // Üyeleri Listele modalı açıksa kapat; sadece silme ekranı görünsün
  if (els.listMembersModal && !els.listMembersModal.classList.contains("hidden")) closeListMembersModal();
}

function closeDeleteMemberModal() {
  ui.deleteMemberId = null;
  if (els.deleteMemberModal) els.deleteMemberModal.classList.add("hidden");
}

async function confirmDeleteMember() {
  const id = ui.deleteMemberId;
  const password = els.deleteMemberPassword ? els.deleteMemberPassword.value.trim() : "";
  const deleteHistoryYes = els.deleteMemberHistoryYes && els.deleteMemberHistoryYes.checked;
  if (!id) return;
  if (!password) {
    if (els.deleteMemberError) {
      els.deleteMemberError.textContent = "Admin şifresi girin.";
      els.deleteMemberError.classList.remove("hidden");
    }
    return;
  }
  if (els.deleteMemberError) { els.deleteMemberError.textContent = ""; els.deleteMemberError.classList.add("hidden"); }
  try {
    await window.API.deleteMember(id, { adminPassword: password, deleteHistory: deleteHistoryYes });
  } catch (e) {
    if (els.deleteMemberError) {
      els.deleteMemberError.textContent = (e.data && e.data.error) || e.message || "Silinemedi.";
      els.deleteMemberError.classList.remove("hidden");
    }
    return;
  }
  state.members = state.members.filter((x) => x.id !== normId(id));
  if (state.memberPackages) state.memberPackages = state.memberPackages.filter((mp) => normId(mp.memberId) !== normId(id));
  if (state.sessions) state.sessions = state.sessions.filter((s) => normId(s.memberId) !== normId(id));
  saveState();
  closeDeleteMemberModal();
  if (els.memberCardModal && !els.memberCardModal.classList.contains("hidden")) closeMemberCardModal();
  if (els.listMembersModal && !els.listMembersModal.classList.contains("hidden")) closeListMembersModal();
  render();
}

function deleteMemberFromList(memberId) {
  if (window.API && window.API.getToken()) {
    openDeleteMemberModal(memberId);
    return;
  }
  if (!confirm("Bu üyeyi silmek istiyor musunuz?")) return;
  state.members = state.members.filter((x) => x.id !== normId(memberId));
  saveState();
  render();
  if (els.listMembersModal && !els.listMembersModal.classList.contains("hidden")) closeListMembersModal();
}

async function deleteMemberCardFromModal() {
  if (!ui.editingMemberId) return;
  if (window.API && window.API.getToken()) {
    openDeleteMemberModal(ui.editingMemberId);
    return;
  }
  if (!confirm("Bu üyeyi silmek istiyor musunuz?")) return;
  state.members = state.members.filter((x) => x.id !== normId(ui.editingMemberId));
  saveState();
  closeMemberCardModal();
  render();
}

/** Aktif paketi olan üye id'leri (grup/tek seans için sadece bunlara seans açılabilir) */
function getMemberIdsWithActivePackage() {
  return new Set(
    (state.memberPackages || [])
      .filter((mp) => (mp.status || "").toLowerCase() === "active")
      .map((mp) => normId(mp.memberId))
  );
}

function refreshSessionFormOptions({ dateStr = null, timeStr = null } = {}) {
  const memberIdsWithActivePackage = getMemberIdsWithActivePackage();
  let membersToShow = state.members.filter((m) => memberIdsWithActivePackage.has(normId(m.id)));
  if (ui.editingSessionId) {
    const s = state.sessions.find((x) => x.id === ui.editingSessionId);
    if (s) {
      const currentMemberId = normId(s.memberId);
      if (!membersToShow.some((m) => normId(m.id) === currentMemberId)) {
        const currentMember = state.members.find((m) => normId(m.id) === currentMemberId);
        if (currentMember) membersToShow = [currentMember, ...membersToShow];
      }
    }
  }
  els.sessionMember.innerHTML = "";
  for (const m of membersToShow) {
    const o = document.createElement("option");
    o.value = String(Number(m.id));
    o.textContent = getMemberDisplayName(m);
    els.sessionMember.appendChild(o);
  }
  // Düzenleme modunda üye seçimini düzenlenen seansa kilitle (liste yeniden oluşunca kaybolmasın)
  if (ui.editingSessionId) {
    const sess = state.sessions.find((x) => x.id === ui.editingSessionId);
    if (sess) {
      const memberVal = String(Number(sess.memberId));
      if (els.sessionMember.querySelector(`option[value="${memberVal}"]`)) els.sessionMember.value = memberVal;
    }
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

  updateSessionPackageHint();
}

function updateSessionPackageHint() {
  if (!els.sessionPackageHint) return;
  const memberId = els.sessionMember && els.sessionMember.value ? normId(els.sessionMember.value) : null;
  const dateStr = els.sessionDate && els.sessionDate.value ? els.sessionDate.value : null;
  if (!memberId || !dateStr) {
    els.sessionPackageHint.textContent = "";
    return;
  }
  const packages = (state.memberPackages || []).filter(
    (mp) => normId(mp.memberId) === memberId && mp.status === "active"
  );
  const usedByPackage = {};
  (state.sessions || []).forEach((s) => {
    if (s.memberPackageId) usedByPackage[s.memberPackageId] = (usedByPackage[s.memberPackageId] || 0) + 1;
  });
  const matching = packages.filter((mp) => {
    const start = (mp.startDate || "").toString().slice(0, 10);
    const end = (mp.endDate || "").toString().slice(0, 10);
    return start && end && dateStr >= start && dateStr <= end;
  });
  if (matching.length === 0) {
    els.sessionPackageHint.textContent = "Bu tarihte bu üyenin aktif paketi yok. Seans pakete işlenmeyecek.";
    return;
  }
  const lines = matching.map((mp) => {
    const used = usedByPackage[mp.id] || 0;
    const total = mp.lessonCount ?? mp.lesson_count ?? 0;
    const left = Math.max(0, total - used);
    return `${mp.packageName || "Paket"}: ${used}/${total} kullanıldı, ${left} kaldı`;
  });
  els.sessionPackageHint.textContent = "Aktif paket(ler) – takvimden eklenen seans otomatik pakete işlenir: " + lines.join("; ");
}

function openSessionModal({ mode, date, time, sessionId }) {
  refreshSessionFormOptions({ dateStr: date, timeStr: time });
  showError("");

  if (mode === "new") {
    ui.editingSessionId = null;
    if (els.sessionMember) els.sessionMember.disabled = false;
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
    const d = new Date(s.startTs);
    const dateStr = dateToInputValue(d);
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    // Önce form seçeneklerini doldur (düzenlenen üye listeye eklensin), sonra değerleri ata
    refreshSessionFormOptions({ dateStr, timeStr });
    els.sessionModalTitle.textContent = "Seansı Düzenle";
    els.deleteSessionBtn.classList.remove("hidden");

    els.sessionDate.value = dateStr;
    els.sessionTime.value = timeStr;
    // Üye alanı düzenlemede değiştirilemez; option value ile eşleşecek şekilde ata
    const memberVal = String(Number(s.memberId));
    if (els.sessionMember.querySelector(`option[value="${memberVal}"]`)) els.sessionMember.value = memberVal;
    els.sessionMember.disabled = true;
    els.sessionRoom.value = s.roomId || "AUTO";
    els.sessionNote.value = s.note || "";

    els.sessionStaff.value = String(Number(s.staffId)); // Seçili personeli koru (option ile eşleşsin)

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
  // Paket seansları modalı açıksa listeyi yenile (düzenleme sonrası güncel görünsün)
  if (packageSessionsCurrent && els.packageSessionsModal && !els.packageSessionsModal.classList.contains("hidden")) {
    window.API.getMemberPackageSessions(packageSessionsCurrent.mp.id).then((sessions) => {
      packageSessionsCurrent.sessions = sessions || [];
      renderPackageSessionsTable(packageSessionsCurrent.sessions);
      if (!packageSessionsCurrent.sessions.length) {
        els.packageSessionsEmpty.textContent = "Seans kaydı yok.";
        els.packageSessionsEmpty.classList.remove("hidden");
        if (els.packageSessionsTable) els.packageSessionsTable.classList.add("hidden");
      }
    }).catch(() => {});
  }
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

  els.groupSessionStaff.innerHTML = "";
  for (const s of state.staff) {
    const o = document.createElement("option");
    o.value = String(Number(s.id));
    o.textContent = getStaffFullName(s);
    els.groupSessionStaff.appendChild(o);
  }
  if (firstSession.staffId != null) els.groupSessionStaff.value = String(Number(firstSession.staffId));

  els.groupSessionRoom.innerHTML = "";
  const autoO = document.createElement("option");
  autoO.value = "AUTO";
  autoO.textContent = "AUTO (Uygun oda seç)";
  els.groupSessionRoom.appendChild(autoO);
  for (const r of state.rooms) {
    const o = document.createElement("option");
    o.value = String(Number(r.id));
    o.textContent = `${r.name} (${r.devices} alet)`;
    els.groupSessionRoom.appendChild(o);
  }
  if (firstSession.roomId != null) {
    const roomVal = String(Number(firstSession.roomId));
    if (els.groupSessionRoom.querySelector(`option[value="${roomVal}"]`)) els.groupSessionRoom.value = roomVal;
    else els.groupSessionRoom.value = "AUTO";
  } else els.groupSessionRoom.value = "AUTO";

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
  const memberIdsWithActivePackage = getMemberIdsWithActivePackage();
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Üye seçin...";
  select.appendChild(placeholder);
  for (const m of state.members) {
    if (usedMemberIds.has(normId(m.id))) continue;
    if (!memberIdsWithActivePackage.has(normId(m.id))) continue;
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
    const memberIdsWithActivePackage = getMemberIdsWithActivePackage();
    const currentMemberIdNorm = normId(session.memberId);
    const membersForRow = state.members.filter(
      (m) => memberIdsWithActivePackage.has(normId(m.id)) || normId(m.id) === currentMemberIdNorm
    );
    for (const m of membersForRow) {
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

  // Mevcut grup düzenleme: Tarih/Saat/Personel/Oda güncellemesi + üye listesi senkronu
  const dateStr = els.groupSessionDate && els.groupSessionDate.value ? els.groupSessionDate.value : null;
  const timeStr = els.groupSessionTime && els.groupSessionTime.value ? els.groupSessionTime.value : null;
  let newStaffId = els.groupSessionStaff && els.groupSessionStaff.value ? els.groupSessionStaff.value : null;
  const roomChoice = els.groupSessionRoom && els.groupSessionRoom.value ? els.groupSessionRoom.value : "AUTO";

  let newStartTs = firstSession.startTs;
  let newEndTs = firstSession.endTs;
  let newRoomId = firstSession.roomId;
  const durationMs = firstSession.endTs - firstSession.startTs;
  const ignoreGroupIds = new Set(currentGroupSessions.map((s) => normId(s.id)));

  if (dateStr && timeStr && newStaffId) {
    const start = makeLocalDate(dateStr, timeStr);
    newStartTs = start.getTime();
    newEndTs = newStartTs + durationMs;
    const startMinDay = start.getHours() * 60 + start.getMinutes();
    const endMinDay = startMinDay + Math.round(durationMs / 60000);
    const dayOfWeek = start.getDay();

    if (!isDayEnabled(dayOfWeek)) {
      els.groupSessionError.textContent = `${DAY_NAMES[dayOfWeek]} günü kapalı. Seans taşınamaz.`;
      els.groupSessionError.classList.remove("hidden");
      return;
    }
    const wh = getWorkingHoursForDay(dayOfWeek);
    if (!wh || startMinDay < wh.startMin || endMinDay > wh.endMin) {
      els.groupSessionError.textContent = `Seans saat aralığı çalışma saatleri dışında (${wh ? wh.start + "–" + wh.end : "tanımsız"}).`;
      els.groupSessionError.classList.remove("hidden");
      return;
    }
    const selectedStaff = getStaffById(newStaffId);
    if (selectedStaff) {
      const staffWh = getStaffWorkingHoursForDay(selectedStaff, dayOfWeek);
      if (!staffWh || startMinDay < staffWh.startMin || endMinDay > staffWh.endMin) {
        els.groupSessionError.textContent = `Seçilen personel (${getStaffFullName(selectedStaff)}) bu gün/saatte çalışmıyor.`;
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    }

    if (roomChoice === "AUTO") {
      const candidate = { staffId: newStaffId, memberId: firstSession.memberId, roomId: "", startTs: newStartTs, endTs: newEndTs };
      newRoomId = autoAssignRoom(candidate, { ignoreSessionIds: ignoreGroupIds });
      if (!newRoomId) {
        els.groupSessionError.textContent = "Bu saat aralığında uygun oda bulunamadı (kapasite veya personel çakışması).";
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    } else {
      newRoomId = roomChoice;
      const chosenRoom = getRoomById(newRoomId);
      if (chosenRoom && currentGroupSessions.length > (chosenRoom.devices || 1)) {
        els.groupSessionError.textContent = `"${chosenRoom.name}" bu saatte en fazla ${chosenRoom.devices} seans alabilir. Grup ${currentGroupSessions.length} üye.`;
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    }

    for (const session of currentGroupSessions) {
      const candidate = { memberId: session.memberId, staffId: newStaffId, roomId: newRoomId, startTs: newStartTs, endTs: newEndTs };
      const conflicts = checkConflicts(candidate, { ignoreSessionIds: ignoreGroupIds });
      if (conflicts.length > 0) {
        els.groupSessionError.textContent = conflicts[0];
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    }
  } else {
    newStaffId = newStaffId || String(Number(firstSession.staffId));
    newRoomId = roomChoice !== "AUTO" ? roomChoice : firstSession.roomId;
  }

  els.groupSessionError.classList.add("hidden");

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
    if (existingSessionIds.has(normId(session.id))) {
      if (window.API && window.API.getToken() && (newStartTs !== firstSession.startTs || normId(newStaffId) !== normId(firstSession.staffId) || normId(newRoomId) !== normId(firstSession.roomId))) {
        try {
          const updated = await window.API.updateSession(session.id, {
            staffId: newStaffId,
            roomId: newRoomId,
            startTs: newStartTs,
            endTs: newEndTs,
          });
          const idx = state.sessions.findIndex(x => normId(x.id) === normId(session.id));
          if (idx >= 0) state.sessions[idx] = updated;
        } catch (e) {
          els.groupSessionError.textContent = (e.data && e.data.error) || e.message || "Seans güncellenemedi.";
          els.groupSessionError.classList.remove("hidden");
          return;
        }
      }
    } else {
      const newSession = { ...session, staffId: newStaffId, roomId: newRoomId, startTs: newStartTs, endTs: newEndTs };
      state.sessions.push(newSession);
      if (window.API && window.API.getToken()) {
        try {
          const created = await window.API.createSession(newSession);
          const idx = state.sessions.findIndex(s => normId(s.id) === normId(session.id));
          if (idx >= 0) state.sessions[idx] = created;
        } catch (e) {
          els.groupSessionError.textContent = (e.data && e.data.error) || e.message || "Seans eklenemedi.";
          els.groupSessionError.classList.remove("hidden");
          return;
        }
      }
    }
  }

  if (window.API && window.API.getToken() && window.API.getSessions) {
    state.sessions = await window.API.getSessions();
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
  // Düzenlemede üye değiştirilemez; her zaman düzenlenen seansın üyesi kullanılır
  const memberId = ui.editingSessionId
    ? (state.sessions.find((x) => x.id === ui.editingSessionId) || {}).memberId
    : els.sessionMember.value;
  if (!memberId) {
    showError("Üye bilgisi alınamadı.");
    return;
  }
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
      } else {
        await window.API.createSession(candidate);
      }
      // Backend paket aşımında son seansı silebilir; listeyi mutlaka sunucudan yenile ki takvim güncel görünsün
      if (window.API.getSessions) {
        state.sessions = await window.API.getSessions();
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
  if (!confirm("Seansı silmek istiyor musunuz?")) return;
  if (window.API && window.API.getToken()) {
    try {
      await window.API.deleteSession(ui.editingSessionId);
      if (window.API.getSessions) state.sessions = await window.API.getSessions();
    } catch (e) {
      console.error("Seans silinemedi:", e);
      showError("Seans silinemedi: " + (e?.data?.error || e?.message || "Bilinmeyen hata"));
      if (window.API.getSessions) {
        try {
          state.sessions = await window.API.getSessions();
          saveState();
        } catch (_) {}
      }
      render();
      return;
    }
  } else {
    state.sessions = state.sessions.filter((s) => s.id !== ui.editingSessionId);
  }
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

/** Takvimde görünen seansları döndürür (günlük/haftalık görünüm + filtre uygulanmış). */
function getSessionsForExport() {
  let inWeek;
  if (ui.viewMode === "day") {
    const dayStartTs = startOfDay(ui.currentDay).getTime();
    const dayEndTs = addDays(ui.currentDay, 1).getTime();
    inWeek = state.sessions.filter((s) => s.startTs >= dayStartTs && s.startTs < dayEndTs);
  } else {
    const weekStartTs = ui.weekStart.getTime();
    const weekEndTs = addDays(ui.weekStart, 7).getTime();
    inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);
  }
  if ((ui.plannerFilter || "").trim()) inWeek = inWeek.filter(sessionMatchesPlannerFilter);
  return inWeek;
}

function exportSessionsExcel() {
  const sessions = getSessionsForExport();
  const headers = ["#", "Tarih", "Saat", "Üye", "Personel", "Oda", "Not"];
  const rows = sessions.map((s, i) => {
    const d = new Date(Number(s.startTs));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const member = getMemberById(s.memberId);
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const memberName = member ? (member.name || getMemberFullName(member)) : "–";
    const staffName = staff ? getStaffFullName(staff) : "–";
    const roomName = room ? room.name : "–";
    return [i + 1, dateStr, timeStr, memberName, staffName, roomName, (s.note || "").toString()];
  });
  if (typeof XLSX !== "undefined") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Seanslar");
    const filename = "seanslar-" + dateToInputValue(new Date()) + ".xlsx";
    XLSX.writeFile(wb, filename);
  } else {
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "seanslar-" + dateToInputValue(new Date()) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function exportSessionsPdf() {
  const sessions = getSessionsForExport();
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    alert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = ui.viewMode === "day"
    ? "Seanslar – " + dateToInputValue(ui.currentDay)
    : "Seanslar – " + dateToInputValue(ui.weekStart) + " / " + dateToInputValue(addDays(ui.weekStart, 6));
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  const tableData = sessions.map((s, i) => {
    const d = new Date(Number(s.startTs));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const member = getMemberById(s.memberId);
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const memberName = member ? (member.name || getMemberFullName(member)) : "–";
    const staffName = staff ? getStaffFullName(staff) : "–";
    const roomName = room ? room.name : "–";
    return [i + 1, dateStr, timeStr, memberName.slice(0, 20), staffName.slice(0, 18), roomName.slice(0, 12), (s.note || "").toString().slice(0, 25)];
  });
  doc.autoTable({
    head: [["#", "Tarih", "Saat", "Üye", "Personel", "Oda", "Not"]],
    body: tableData,
    startY: 18,
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 8 },
  });
  doc.save("seanslar-" + dateToInputValue(new Date()) + ".pdf");
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

  // Her odada en fazla 1 personel çalışabildiği için tam doluluk = oda sayısı kadar personel
  const targetStaffCount = state.rooms.length;
  if (targetStaffCount === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted);">
        <p>Oda tanımlı değil. Ayarlardan en az bir oda ekleyin.</p>
      </div>
    `;
    els.taskDistributionModal.classList.remove("hidden");
    return;
  }

  const weekStartTs = ui.weekStart.getTime();
  const weekEndTs = addDays(ui.weekStart, 7).getTime();
  const inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);

  // Her gün ve saat için (oda sayısı kadar) personel olan zamanları bul
  const fullCapacityTimes = [];
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
      if (staffAtTime.length === targetStaffCount) {
        const sessions = getSessionsAtTime(dateStr, timeStr);
        fullCapacityTimes.push({
          date: d,
          dateStr,
          timeStr,
          staff: staffAtTime,
          sessions,
        });
      }
    }
  }

  if (fullCapacityTimes.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted);">
        <p>Bu hafta tüm odalarda personel olduğu (${targetStaffCount} personel aynı anda merkezde) bir saat bulunamadı.</p>
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

    for (const item of fullCapacityTimes) {
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

/** Üyeliği bitmiş (bitiş tarihi geçmiş) paket listesi – modal açıldığında bir kez hesaplanır */
let expiredMembershipsBaseList = [];
/** Tıklanarak seçilen sıralama: { column: 'start'|'end', dir: 'asc'|'desc' } */
let expiredMembershipsSort = { column: "end", dir: "desc" };

/** Filtre ve sıralamaya göre tabloyu günceller (Üyeleri Listele ile aynı mantık: ad/soyad/telefon tek kutu) */
function renderExpiredMembershipsTable() {
  const content = els.expiredMembershipsContent;
  if (!content) return;

  const filterText = (els.expiredMembershipsFilter && els.expiredMembershipsFilter.value) ? els.expiredMembershipsFilter.value.trim() : "";
  let list = expiredMembershipsBaseList.slice();

  if (filterText) {
    list = list.filter((mp) => {
      const m = state.members.find((x) => normId(x.id) === normId(mp.memberId));
      if (!m) return false;
      return memberMatchesListFilter(m, filterText);
    });
  }

  const startStr = (mp) => (mp.startDate || "").toString().slice(0, 10);
  const endStr = (mp) => (mp.endDate || "").toString().slice(0, 10);
  if (expiredMembershipsSort.column === "start") {
    list.sort((a, b) => expiredMembershipsSort.dir === "asc" ? startStr(a).localeCompare(startStr(b)) : startStr(b).localeCompare(startStr(a)));
  } else {
    list.sort((a, b) => expiredMembershipsSort.dir === "asc" ? endStr(a).localeCompare(endStr(b)) : endStr(b).localeCompare(endStr(a)));
  }

  if (list.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted);">
        <p>${expiredMembershipsBaseList.length === 0 ? "Üyeliği bitmiş (bitiş tarihi geçmiş) paket kaydı yok." : "Filtreye uyan kayıt yok."}</p>
      </div>
    `;
    return;
  }

  const sort = expiredMembershipsSort;
  const startLabel = "Üyelik Başlangıç" + (sort.column === "start" ? (sort.dir === "asc" ? " ▲" : " ▼") : "");
  const endLabel = "Üyelik Bitiş" + (sort.column === "end" ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.marginTop = "10px";
  table.innerHTML = `
    <thead>
      <tr style="background:rgba(255,255,255,.05); border-bottom:1px solid var(--border);">
        <th style="padding:10px; text-align:left; font-weight:700;">Üye No</th>
        <th style="padding:10px; text-align:left; font-weight:700;">Adı Soyadı</th>
        <th style="padding:10px; text-align:left; font-weight:700;">Telefon</th>
        <th style="padding:10px; text-align:left; font-weight:700; cursor:pointer; user-select:none;" data-sort="start" title="Tıklayın: küçükten büyüğe / büyükten küçüğe">${startLabel}</th>
        <th style="padding:10px; text-align:left; font-weight:700; cursor:pointer; user-select:none;" data-sort="end" title="Tıklayın: küçükten büyüğe / büyükten küçüğe">${endLabel}</th>
        <th style="padding:10px; text-align:left; font-weight:700;">Paket</th>
        <th style="padding:10px; text-align:left; font-weight:700;"></th>
      </tr>
    </thead>
    <tbody>
  `;

  table.querySelector("th[data-sort='start']").addEventListener("click", () => {
    if (expiredMembershipsSort.column === "start") expiredMembershipsSort.dir = expiredMembershipsSort.dir === "asc" ? "desc" : "asc";
    else { expiredMembershipsSort.column = "start"; expiredMembershipsSort.dir = "asc"; }
    renderExpiredMembershipsTable();
  });
  table.querySelector("th[data-sort='end']").addEventListener("click", () => {
    if (expiredMembershipsSort.column === "end") expiredMembershipsSort.dir = expiredMembershipsSort.dir === "asc" ? "desc" : "asc";
    else { expiredMembershipsSort.column = "end"; expiredMembershipsSort.dir = "asc"; }
    renderExpiredMembershipsTable();
  });

  // Her üyenin son paketi (bitiş tarihi en geç olan) – Yeni Paket sadece üyenin aktif paketi yoksa ve son paket satırındaysa gösterilir
  const hasActivePackage = (memberId) => (state.memberPackages || []).some(
    (p) => normId(p.memberId) === normId(memberId) && (p.status || "").toLowerCase() === "active"
  );
  const endStrForCmp = (mp) => (mp.endDate || "").toString().slice(0, 10);
  const lastPackageByMember = {};
  for (const mp of list) {
    const mid = normId(mp.memberId);
    const end = endStrForCmp(mp);
    if (!(mid in lastPackageByMember) || end > endStrForCmp(lastPackageByMember[mid])) lastPackageByMember[mid] = mp;
  }

  for (const mp of list) {
    const m = state.members.find((x) => normId(x.id) === normId(mp.memberId));
    const memberNo = m ? (m.memberNo || "–") : "–";
    const memberName = getMemberDisplayName(m || {});
    const phone = m ? displayPhone(m.phone) || "–" : "–";
    const startStrVal = (mp.startDate || "").toString().slice(0, 10);
    const endStrVal = (mp.endDate || "").toString().slice(0, 10);
    const packageName = mp.packageName || "Paket";
    const isLastPackage = lastPackageByMember[normId(mp.memberId)] && lastPackageByMember[normId(mp.memberId)].id === mp.id;
    const showNewPackageBtn = isLastPackage && !hasActivePackage(mp.memberId);

    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid var(--border)";
    row.innerHTML = `
      <td style="padding:10px;">${escapeHtml(memberNo)}</td>
      <td style="padding:10px;">${escapeHtml(memberName)}</td>
      <td style="padding:10px;">${escapeHtml(phone)}</td>
      <td style="padding:10px;">${escapeHtml(startStrVal)}</td>
      <td style="padding:10px;">${escapeHtml(endStrVal)}</td>
      <td style="padding:10px;">${escapeHtml(packageName)}</td>
      <td style="padding:10px; white-space:nowrap;">
        <span style="display:inline-flex; align-items:center; gap:8px; flex-wrap:nowrap;">
          <button type="button" class="btn btn--xs btn--ghost" data-mp-id="${mp.id}" data-member-id="${mp.memberId || ""}">Seansları Gör</button>
          ${showNewPackageBtn ? `<button type="button" class="btn btn--xs btn--ghost" data-action="new-package" data-member-id="${mp.memberId || ""}">Yeni Paket</button>` : ""}
        </span>
      </td>
    `;
    const btn = row.querySelector("button[data-mp-id]");
    if (btn) btn.addEventListener("click", () => { closeExpiredMembershipsModal(); openPackageSessionsModal(mp, mp.memberId); });
    const newPkgBtn = row.querySelector("button[data-action='new-package']");
    if (newPkgBtn) newPkgBtn.addEventListener("click", () => {
      closeExpiredMembershipsModal();
      ui.editingMemberId = mp.memberId;
      openMemberPackageModal(mp.memberId);
    });
    table.querySelector("tbody").appendChild(row);
  }

  content.innerHTML = "";
  content.appendChild(table);
}

/** Üyeliği bitmiş (bitiş tarihi geçmiş) paketleri ve seansları ayrı listeler; filtre ve sıralama uygulanır */
function openExpiredMembershipsModal() {
  const content = els.expiredMembershipsContent;
  if (!content) return;
  content.innerHTML = "";

  const today = new Date();
  const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  // Bitiş tarihi bugün veya geçmiş paketleri listele; silinmiş üyelerin paketlerini gösterme (üye state.members'da olmalı)
  const memberIds = new Set((state.members || []).map((m) => normId(m.id)));
  expiredMembershipsBaseList = (state.memberPackages || []).filter((mp) => {
    const end = (mp.endDate || "").toString().slice(0, 10);
    if (!end || end > todayStr) return false;
    if (!memberIds.has(normId(mp.memberId))) return false; // Silinmiş üye (listede yok)
    return true;
  });

  if (els.expiredMembershipsFilter) els.expiredMembershipsFilter.value = "";

  renderExpiredMembershipsTable();

  const onFilterOrSort = () => renderExpiredMembershipsTable();
  if (els.expiredMembershipsFilter) {
    if (els.expiredMembershipsFilter._expiredFilterHandler) els.expiredMembershipsFilter.removeEventListener("input", els.expiredMembershipsFilter._expiredFilterHandler);
    els.expiredMembershipsFilter._expiredFilterHandler = onFilterOrSort;
    els.expiredMembershipsFilter.addEventListener("input", onFilterOrSort);
  }

  els.expiredMembershipsModal.classList.remove("hidden");
}

function closeExpiredMembershipsModal() {
  if (els.expiredMembershipsModal) els.expiredMembershipsModal.classList.add("hidden");
}

/** Üye listesi filtresi: ad/soyad veya telefon numarasına göre eşleşir (kısmi, büyük/küçük harf duyarsız) */
function memberMatchesListFilter(m, filterText) {
  const q = (filterText || "").trim();
  if (!q) return true;
  const qLower = q.toLowerCase();
  const name = getMemberDisplayName(m).toLowerCase();
  if (name.includes(qLower)) return true;
  const phoneDigits = (m.phone != null ? String(m.phone).replace(/\D/g, "") : "");
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length > 0 && phoneDigits.includes(qDigits)) return true;
  return false;
}

/** Sadece aktif paketi olan üyeleri listeler; filtre ad/soyad veya telefona göre uygulanır. Açılışta Adı Soyadı A-Z; sütun başlıklarına tıklanarak sıralanır. */
function openListMembersModal() {
  const content = els.listMembersContent;
  if (!content) return;
  content.innerHTML = "";

  const activePackages = (state.memberPackages || []).filter((mp) => (mp.status || "").toLowerCase() === "active");
  const memberIdsWithActive = new Set(activePackages.map((mp) => normId(mp.memberId)));
  const membersWithActive = state.members.filter((m) => memberIdsWithActive.has(normId(m.id)));

  if (membersWithActive.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--muted);">
        <p>Aktif paketi olan üye yok.</p>
      </div>
    `;
    if (els.listMembersFilter) els.listMembersFilter.value = "";
    if (els.listMembersModal) els.listMembersModal.classList.remove("hidden");
    return;
  }

  let sortColumn = "name";
  let sortDir = "asc";

  function getMp(m) {
    return activePackages.find((p) => normId(p.memberId) === normId(m.id));
  }
  function getStartStr(m) {
    const mp = getMp(m);
    return mp && (mp.startDate || mp.start_date) ? String(mp.startDate || mp.start_date).slice(0, 10) : "";
  }
  function getEndStr(m) {
    const mp = getMp(m);
    return mp && (mp.endDate || mp.end_date) ? String(mp.endDate || mp.end_date).slice(0, 10) : "";
  }
  function getRemaining(m) {
    const mp = getMp(m);
    if (!mp) return 0;
    const lessonCount = Number(mp.lessonCount ?? mp.lesson_count) || 0;
    const nowMs = Date.now();
    const doneCount = state.sessions ? state.sessions.filter((s) => normId(s.memberPackageId) === normId(mp.id) && Number(s.startTs) < nowMs).length : 0;
    return Math.max(0, lessonCount - doneCount);
  }
  function sortMembers(list) {
    const arr = list.slice();
    const mult = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let va; let vb;
      switch (sortColumn) {
        case "name":
          va = (getMemberDisplayName(a) || "").toLowerCase();
          vb = (getMemberDisplayName(b) || "").toLowerCase();
          return mult * (va < vb ? -1 : va > vb ? 1 : 0);
        case "start":
          va = getStartStr(a);
          vb = getStartStr(b);
          return mult * (va < vb ? -1 : va > vb ? 1 : 0);
        case "end":
          va = getEndStr(a);
          vb = getEndStr(b);
          return mult * (va < vb ? -1 : va > vb ? 1 : 0);
        case "remaining":
          va = getRemaining(a);
          vb = getRemaining(b);
          return mult * (va - vb);
        default:
          return 0;
      }
    });
    return arr;
  }

  const tableWrap = document.createElement("div");
  tableWrap.style.overflowX = "auto";
  tableWrap.style.marginTop = "10px";
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.minWidth = "1180px";
  table.style.borderCollapse = "collapse";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.style.background = "rgba(255,255,255,.05)";
  headerRow.style.borderBottom = "1px solid var(--border)";
  const thStyle = "padding:10px; text-align:left; font-weight:700; white-space:nowrap;";
  const sortableStyle = thStyle + " cursor:pointer; user-select:none;";

  function sortLabel(col, label) {
    const isActive = sortColumn === col;
    const arrow = isActive ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return label + arrow;
  }
  function makeSortableTh(col, label) {
    const th = document.createElement("th");
    th.setAttribute("data-sort", col);
    th.style.cssText = sortableStyle;
    th.textContent = sortLabel(col, label);
    th.title = "Sıralamak için tıklayın (küçükten büyüğe / büyükten küçüğe)";
    return th;
  }

  headerRow.innerHTML = `
    <th style="${thStyle}">Üye No</th>
    <th style="${thStyle}"></th>
    <th style="${thStyle}">Telefon</th>
    <th style="${thStyle}">Aktif Paket</th>
    <th style="${thStyle}"></th>
    <th style="${thStyle}"></th>
    <th style="${thStyle}"></th>
    <th style="${thStyle}"></th>
  `;
  const thName = makeSortableTh("name", "Adı Soyadı");
  const thStart = makeSortableTh("start", "Başlangıç");
  const thEnd = makeSortableTh("end", "Bitiş");
  const thRemaining = makeSortableTh("remaining", "Kalan Seans");
  headerRow.replaceChild(thName, headerRow.children[1]);
  headerRow.replaceChild(thStart, headerRow.children[4]);
  headerRow.replaceChild(thEnd, headerRow.children[5]);
  headerRow.replaceChild(thRemaining, headerRow.children[6]);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);

  function updateSortHeaders() {
    thName.textContent = sortLabel("name", "Adı Soyadı");
    thStart.textContent = sortLabel("start", "Başlangıç");
    thEnd.textContent = sortLabel("end", "Bitiş");
    thRemaining.textContent = sortLabel("remaining", "Kalan Seans");
  }
  function onSortClick(col) {
    if (sortColumn === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortColumn = col; sortDir = "asc"; }
    updateSortHeaders();
    applyAndRender();
  }
  thName.addEventListener("click", () => onSortClick("name"));
  thStart.addEventListener("click", () => onSortClick("start"));
  thEnd.addEventListener("click", () => onSortClick("end"));
  thRemaining.addEventListener("click", () => onSortClick("remaining"));

  function renderListMembersRows(members) {
    tbody.innerHTML = "";
    for (const m of members) {
      const mp = getMp(m);
      const packageName = mp ? (mp.packageName || "Paket") : "–";
      const startStr = getStartStr(m) || "–";
      const endStr = getEndStr(m) || "–";
      const remaining = getRemaining(m);
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--border)";
      row.style.cursor = "pointer";
      row.title = "Aktif paket seanslarını görmek için tıklayın";
      row.innerHTML = `
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(m.memberNo || "–")}</td>
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(getMemberDisplayName(m))}</td>
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(displayPhone(m.phone) || "–")}</td>
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(packageName)}</td>
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(startStr)}</td>
        <td style="padding:10px; white-space:nowrap;">${escapeHtml(endStr)}</td>
        <td style="padding:10px; white-space:nowrap;">${remaining}</td>
        <td style="padding:10px; white-space:nowrap;">
          <span style="display:inline-flex; flex-wrap:nowrap; gap:6px;">
            <button type="button" class="btn btn--xs btn--ghost" data-action="card">Kimlik Kartı</button>
            <button type="button" class="btn btn--xs btn--ghost" data-action="package">Paket</button>
            <button type="button" class="btn btn--xs btn--ghost" data-action="delete">Sil</button>
          </span>
        </td>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        closeListMembersModal();
        openPackageSessionsModal(mp, m.id);
      });
      row.querySelector('[data-action="card"]').addEventListener("click", (e) => { e.stopPropagation(); closeListMembersModal(); openMemberCard(m.id); });
      row.querySelector('[data-action="package"]').addEventListener("click", (e) => { e.stopPropagation(); closeListMembersModal(); openMemberPackageModal(m.id, mp.id); });
      row.querySelector('[data-action="delete"]').addEventListener("click", (e) => { e.stopPropagation(); deleteMemberFromList(m.id); });
      tbody.appendChild(row);
    }
  }

  function applyAndRender() {
    const q = (els.listMembersFilter && els.listMembersFilter.value || "").trim();
    const filtered = q ? membersWithActive.filter((m) => memberMatchesListFilter(m, q)) : membersWithActive;
    const sorted = sortMembers(filtered);
    renderListMembersRows(sorted);
  }

  const filterInput = els.listMembersFilter;
  if (filterInput) {
    filterInput.value = "";
    if (filterInput._listMembersFilterHandler) filterInput.removeEventListener("input", filterInput._listMembersFilterHandler);
    filterInput._listMembersFilterHandler = applyAndRender;
    filterInput.addEventListener("input", applyAndRender);
  }

  applyAndRender();
  tableWrap.appendChild(table);
  content.appendChild(tableWrap);

  if (els.listMembersModal) els.listMembersModal.classList.remove("hidden");
}

function closeListMembersModal() {
  if (els.listMembersModal) els.listMembersModal.classList.add("hidden");
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
  next.packages = Array.isArray(next.packages) ? next.packages : deepClone(DEFAULT_STATE.packages);
  next.memberPackages = Array.isArray(next.memberPackages) ? next.memberPackages : deepClone(DEFAULT_STATE.memberPackages);
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
  if (els.plannerFilterInput) {
    els.plannerFilterInput.addEventListener("input", () => {
      ui.plannerFilter = (els.plannerFilterInput.value || "").trim();
      render();
    });
    els.plannerFilterInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        els.plannerFilterInput.value = "";
        ui.plannerFilter = "";
        render();
      }
    });
  }

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
  if (els.openListMembersBtn) els.openListMembersBtn.addEventListener("click", openListMembersModal);
  if (els.openExpiredMembershipsBtn) els.openExpiredMembershipsBtn.addEventListener("click", openExpiredMembershipsModal);
  els.printBtn.addEventListener("click", printWeeklySchedule);
  els.exportBtn.addEventListener("click", function () {
    const dd = els.exportDropdown;
    if (dd) {
      dd.classList.toggle("hidden");
      els.exportBtn.setAttribute("aria-expanded", dd.classList.contains("hidden") ? "false" : "true");
    }
  });
  function closeExportDropdown() {
    if (els.exportDropdown) {
      els.exportDropdown.classList.add("hidden");
      if (els.exportBtn) els.exportBtn.setAttribute("aria-expanded", "false");
    }
  }
  document.addEventListener("click", function (e) {
    if (els.exportDropdown && !els.exportDropdown.classList.contains("hidden") &&
        e.target !== els.exportBtn && !els.exportBtn.contains(e.target) &&
        e.target !== els.exportDropdown && !els.exportDropdown.contains(e.target))
      closeExportDropdown();
  });
  if (els.exportSessionsExcelBtn) els.exportSessionsExcelBtn.addEventListener("click", function () { closeExportDropdown(); exportSessionsExcel(); });
  if (els.exportSessionsPdfBtn) els.exportSessionsPdfBtn.addEventListener("click", function () { closeExportDropdown(); exportSessionsPdf(); });
  if (els.exportJsonBtn) els.exportJsonBtn.addEventListener("click", function () { closeExportDropdown(); exportJson(); });
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
  if (els.openPackagesBtn) els.openPackagesBtn.addEventListener("click", openPackagesModal);
  els.openStaffBtn.addEventListener("click", openStaffModal);
  if (els.openActivityLogsBtn) els.openActivityLogsBtn.addEventListener("click", openActivityLogsModal);
  if (els.activityLogsApplyFilterBtn) els.activityLogsApplyFilterBtn.addEventListener("click", function () { loadActivityLogs(1); });
  if (els.activityLogsModal) {
    els.activityLogsModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "activityLogsModal") closeActivityLogsModal();
    });
  }

  // Sidebar: aç/kapa ve daralt/genişlet
  const SIDEBAR_CLOSED_KEY = "fp_sidebar_closed";
  const SIDEBAR_NARROW_KEY = "fp_sidebar_narrow";
  function applySidebarState() {
    if (!els.mainContent) return;
    const closed = localStorage.getItem(SIDEBAR_CLOSED_KEY) === "1";
    const narrow = localStorage.getItem(SIDEBAR_NARROW_KEY) === "1";
    els.mainContent.classList.toggle("sidebar-closed", closed);
    els.mainContent.classList.toggle("sidebar--narrow", narrow && !closed);
    if (els.sidebarOpenBtn) els.sidebarOpenBtn.classList.toggle("hidden", !closed);
    if (els.sidebarResizeBtn) els.sidebarResizeBtn.textContent = narrow && !closed ? "»" : "«";
  }
  applySidebarState();
  if (els.sidebarToggleBtn) {
    els.sidebarToggleBtn.addEventListener("click", () => {
      localStorage.setItem(SIDEBAR_CLOSED_KEY, "1");
      applySidebarState();
    });
  }
  if (els.sidebarOpenBtn) {
    els.sidebarOpenBtn.addEventListener("click", () => {
      localStorage.removeItem(SIDEBAR_CLOSED_KEY);
      applySidebarState();
    });
  }
  if (els.sidebarResizeBtn) {
    els.sidebarResizeBtn.addEventListener("click", () => {
      if (els.mainContent.classList.contains("sidebar-closed")) return;
      const narrow = els.mainContent.classList.toggle("sidebar--narrow");
      localStorage.setItem(SIDEBAR_NARROW_KEY, narrow ? "1" : "0");
      els.sidebarResizeBtn.textContent = narrow ? "»" : "«";
    });
  }

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
  // Üye silme modalı: İleri -> adım 2, Sil -> API çağrısı
  if (els.deleteMemberNextBtn) {
    els.deleteMemberNextBtn.addEventListener("click", () => {
      const pwd = els.deleteMemberPassword ? els.deleteMemberPassword.value.trim() : "";
      if (!pwd) {
        if (els.deleteMemberError) {
          els.deleteMemberError.textContent = "Admin şifresi girin.";
          els.deleteMemberError.classList.remove("hidden");
        }
        return;
      }
      if (els.deleteMemberError) { els.deleteMemberError.textContent = ""; els.deleteMemberError.classList.add("hidden"); }
      if (els.deleteMemberStep1) els.deleteMemberStep1.classList.add("hidden");
      if (els.deleteMemberStep2) els.deleteMemberStep2.classList.remove("hidden");
      if (els.deleteMemberNextBtn) els.deleteMemberNextBtn.classList.add("hidden");
      if (els.deleteMemberConfirmBtn) els.deleteMemberConfirmBtn.classList.remove("hidden");
    });
  }
  if (els.deleteMemberConfirmBtn) els.deleteMemberConfirmBtn.addEventListener("click", confirmDeleteMember);
  if (els.deleteMemberModal) {
    els.deleteMemberModal.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "deleteMemberModal") closeDeleteMemberModal();
    });
  }
  if (els.memberPackageInfoBtn) els.memberPackageInfoBtn.addEventListener("click", () => {
    if (ui.editingMemberId) openMemberPackageModal(ui.editingMemberId);
  });
  if (els.memberPackageModal) {
    els.memberPackageModal.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberPackageModal") closeMemberPackageModal();
    });
  }
  if (els.packageInconsistencyModal) {
    els.packageInconsistencyModal.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "packageInconsistencyModal") {
        window._pendingMemberPackageSave = null;
        els.packageInconsistencyModal.classList.add("hidden");
      }
    });
  }
  if (els.packageInconsistencySaveAsIsBtn) {
    els.packageInconsistencySaveAsIsBtn.addEventListener("click", () => doActualMemberPackageSave(null));
  }
  if (els.packageInconsistencySaveAndEndBtn) {
    els.packageInconsistencySaveAndEndBtn.addEventListener("click", () => {
      const p = window._pendingMemberPackageSave;
      doActualMemberPackageSave(p && p.lastSessionDate ? p.lastSessionDate : null);
    });
  }
  if (els.packageInconsistencyCancelBtn) {
    els.packageInconsistencyCancelBtn.addEventListener("click", () => { window._pendingMemberPackageSave = null; });
  }
  if (els.packageSessionsModal) {
    els.packageSessionsModal.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close === "packageSessionsModal") closePackageSessionsModal();
    });
  }
  if (els.packageSessionsTableBody) {
    els.packageSessionsTableBody.addEventListener("click", async (e) => {
      const tr = e.target.closest("tr[data-session-id]");
      if (!tr) return;
      const sessionId = tr.dataset.sessionId;
      if (!sessionId) return;
      let s = state.sessions.find((x) => normId(x.id) === normId(sessionId));
      if (!s && window.API && window.API.getSessions) {
        try {
          state.sessions = await window.API.getSessions();
          saveState();
          s = state.sessions.find((x) => normId(x.id) === normId(sessionId));
        } catch (_) {}
      }
      if (s) openSessionModal({ mode: "edit", sessionId: s.id });
    });
  }
  if (els.packageSessionsExportExcelBtn) els.packageSessionsExportExcelBtn.addEventListener("click", exportPackageSessionsExcel);
  if (els.packageSessionsExportPdfBtn) els.packageSessionsExportPdfBtn.addEventListener("click", exportPackageSessionsPdf);
  if (els.mpSaveBtn) els.mpSaveBtn.addEventListener("click", saveMemberPackageFromForm);
  if (els.mpEndMembershipBtn) els.mpEndMembershipBtn.addEventListener("click", endMemberPackageFromModal);
  if (els.mpPackage) {
    els.mpPackage.addEventListener("change", () => {
      const packageId = els.mpPackage.value ? parseInt(els.mpPackage.value, 10) : null;
      const pkg = packageId && state.packages ? state.packages.find((p) => p.id === packageId) : null;
      if (!pkg || !els.mpStartDate || !els.mpEndDate) return;
      const today = new Date();
      const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const months = Number(pkg.monthOverrun ?? pkg.month_overrun ?? 1) || 1;
      const endDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      els.mpStartDate.value = startStr;
      els.mpEndDate.value = endStr;
    });
  }
  // Başlangıç tarihi değişince bitişi paketin ay aşım süresi kadar yap (kullanıcı bitişi isterse sonradan manuel değiştirebilir)
  if (els.mpStartDate && els.mpEndDate) {
    els.mpStartDate.addEventListener("change", () => {
      const startStr = els.mpStartDate.value;
      if (!startStr) return;
      const packageId = els.mpPackage && els.mpPackage.value ? parseInt(els.mpPackage.value, 10) : null;
      const pkg = packageId && state.packages ? state.packages.find((p) => p.id === packageId) : null;
      const months = pkg ? (Number(pkg.monthOverrun ?? pkg.month_overrun ?? 1) || 1) : 1;
      const parts = startStr.split("-").map(Number);
      if (parts.length !== 3) return;
      const endDate = new Date(parts[0], parts[1] - 1 + months, parts[2]);
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      els.mpEndDate.value = endStr;
    });
  }

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
  if (els.sessionMember) els.sessionMember.addEventListener("change", updateSessionPackageHint);
  if (els.sessionDate) els.sessionDate.addEventListener("change", updateSessionPackageHint);

  // Çalışma saatleri modal
  els.workingHoursModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeWorkingHoursModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.workingHoursModal.classList.contains("hidden")) closeWorkingHoursModal();
      if (!els.roomsModal.classList.contains("hidden")) closeRoomsModal();
      if (els.packagesModal && !els.packagesModal.classList.contains("hidden")) closePackagesModal();
      if (els.memberPackageModal && !els.memberPackageModal.classList.contains("hidden")) closeMemberPackageModal();
      if (els.packageSessionsModal && !els.packageSessionsModal.classList.contains("hidden")) closePackageSessionsModal();
      if (!els.staffModal.classList.contains("hidden")) closeStaffModal();
    }
  });
  els.saveWorkingHoursBtn.addEventListener("click", saveWorkingHours);

  // Odalar modal
  els.roomsModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeRoomsModal();
  });

  // Paket tanımlama modal
  if (els.packagesModal) {
    els.packagesModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "packagesModal") closePackagesModal();
    });
  }
  if (els.packageSaveBtn) els.packageSaveBtn.addEventListener("click", savePackageFromForm);
  if (els.packageCancelBtn) els.packageCancelBtn.addEventListener("click", clearPackageForm);
  if (els.packagesExportExcelBtn) {
    els.packagesExportExcelBtn.addEventListener("click", async () => {
      if (window.API && window.API.exportPackagesCsv) {
        try {
          await window.API.exportPackagesCsv();
        } catch (err) {
          alert(err.message || "Excel'e aktarım başarısız.");
        }
      }
    });
  }

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

  // Üyeleri listele modal
  if (els.listMembersModal) {
    els.listMembersModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "listMembersModal") closeListMembersModal();
    });
  }
  // Üyeliği bitmiş üyeler modal
  if (els.expiredMembershipsModal) {
    els.expiredMembershipsModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "expiredMembershipsModal") closeExpiredMembershipsModal();
    });
  }

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
      if (els.packageSessionsModal && !els.packageSessionsModal.classList.contains("hidden")) closePackageSessionsModal();
      if (!els.staffModal.classList.contains("hidden")) closeStaffModal();
      if (!els.staffCardModal.classList.contains("hidden")) closeStaffCardModal();
      if (!els.taskDistributionModal.classList.contains("hidden")) closeTaskDistributionModal();
      if (els.listMembersModal && !els.listMembersModal.classList.contains("hidden")) closeListMembersModal();
      if (els.expiredMembershipsModal && !els.expiredMembershipsModal.classList.contains("hidden")) closeExpiredMembershipsModal();
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
    const enabled = wh.enabled !== false;
    const item = document.createElement("div");
    item.className = "listItem";
    item.dataset.day = String(day);
    item.innerHTML = `
      <div class="listItem__left" style="flex:1; display:flex; flex-direction:row; align-items:center; gap:10px;">
        <input type="checkbox" data-day="${day}" ${enabled ? "checked" : ""} style="cursor:pointer; flex-shrink:0;" />
        <label style="cursor:pointer; min-width:90px; margin:0;">${DAY_NAMES[day]}</label>
      </div>
      <div class="listItem__actions" style="display:flex; gap:8px; align-items:center;">
        <input class="input" type="time" data-day="${day}" data-type="start" value="${enabled ? (wh.start || "08:00") : ""}" style="width:90px;" ${enabled ? "" : "disabled"} />
        <span style="color:var(--muted);">–</span>
        <input class="input" type="time" data-day="${day}" data-type="end" value="${enabled ? (wh.end || "20:00") : ""}" style="width:90px;" ${enabled ? "" : "disabled"} />
      </div>
    `;
    const checkbox = item.querySelector('input[type="checkbox"]');
    const startInput = item.querySelector('input[data-type="start"]');
    const endInput = item.querySelector('input[data-type="end"]');

    checkbox.addEventListener("change", () => {
      const checked = checkbox.checked;
      startInput.disabled = !checked;
      endInput.disabled = !checked;
      if (!checked) {
        startInput.value = "";
        endInput.value = "";
      } else {
        if (!startInput.value) startInput.value = "08:00";
        if (!endInput.value) endInput.value = "20:00";
      }
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
  if (typeof updatePackagesSummary === "function") updatePackagesSummary();
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
    if (!Array.isArray(state.packages)) state.packages = [];
    if (!Array.isArray(state.memberPackages)) state.memberPackages = [];
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

