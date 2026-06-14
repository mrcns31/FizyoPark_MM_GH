/* Seans Planlayıcı - kurulum gerektirmeyen statik uygulama */

const STORAGE_UI_KEY = "seans_planner_ui";
// Saat satırı yüksekliği (px) - görünüm ferahlığı
const CELL_HEIGHT_PX = 64;

var xlsxLibPromise = null;
var pdfLibsPromise = null;

function loadExportScript(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("Script yüklenemedi: " + src)); };
    document.head.appendChild(s);
  });
}

function ensureXlsxLib() {
  if (typeof XLSX !== "undefined") return Promise.resolve();
  if (!xlsxLibPromise) {
    xlsxLibPromise = loadExportScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  }
  return xlsxLibPromise;
}

function ensurePdfLibs() {
  if (typeof window.jspdf !== "undefined" && window.jspdf.jsPDF) return Promise.resolve();
  if (!pdfLibsPromise) {
    pdfLibsPromise = loadExportScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
      .then(function () {
        return loadExportScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");
      });
  }
  return pdfLibsPromise;
}

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

/** API'den gelen veriyi state'e yazar */
function applyStateFromApi(loaded, sessionRange) {
  state = { ...deepClone(DEFAULT_STATE), ...(loaded || {}) };
  if (!Array.isArray(state.packages)) state.packages = [];
  if (!Array.isArray(state.memberPackages)) state.memberPackages = [];
  if (sessionRange && sessionRange.startDate && sessionRange.endDate) {
    resetSessionsLoadedRange();
    setSessionsLoadedRange(sessionRange.startDate, sessionRange.endDate);
  }
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

function fmtPlannerDayNavLabel(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const dayName = new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(d);
  return day + "." + month + "." + year + " " + dayName;
}

function fmtAdminMobileDayLabel(d) {
  return fmtPlannerDayNavLabel(d);
}

function fmtWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const f = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  return `${f.format(weekStart)} – ${f.format(weekEnd)}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, months) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function fmtMonthLabel(d) {
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(d);
}

function isSameCalendarDay(a, b) {
  return dateToInputValue(startOfDay(a)) === dateToInputValue(startOfDay(b));
}

/** Takvimde “seçili tarih” – görünüm moduna göre ui alanı */
function getCalendarAnchorDate() {
  if (ui.viewMode === "day") return startOfDay(ui.currentDay);
  if (ui.viewMode === "week") return startOfDay(ui.weekStart);
  return startOfMonth(ui.currentMonth || ui.currentDay);
}

/** Seçili takvim aralığı bugünü içeriyor mu? (Bugün/Liste buton mantığı) */
function isViewingToday() {
  const today = startOfDay(new Date());
  if (ui.viewMode === "day") {
    return isSameCalendarDay(ui.currentDay, today);
  }
  if (ui.viewMode === "week") {
    const weekStart = startOfDay(ui.weekStart);
    const weekEnd = startOfDay(addDays(ui.weekStart, 6));
    const t = today.getTime();
    return t >= weekStart.getTime() && t <= weekEnd.getTime();
  }
  if (ui.viewMode === "month") {
    const m = startOfMonth(ui.currentMonth || ui.currentDay);
    return m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
  }
  return false;
}

/** PERF-23: Takvimde görünen aralık (Date) */
function getPlannerVisibleRange() {
  if (ui.viewMode === "day") {
    const d = startOfDay(ui.currentDay);
    return { start: d, end: d };
  }
  if (ui.viewMode === "week") {
    return { start: startOfDay(ui.weekStart), end: startOfDay(addDays(ui.weekStart, 6)) };
  }
  const monthStart = startOfMonth(ui.currentMonth || ui.currentDay);
  const monthEnd = addDays(addMonths(monthStart, 1), -1);
  return { start: monthStart, end: monthEnd };
}

var PLANNER_SESSION_BUFFER_DAYS = 14;

/** API'ye gönderilecek seans aralığı (görünür ± buffer) */
function getPlannerFetchRange() {
  const visible = getPlannerVisibleRange();
  const start = addDays(visible.start, -PLANNER_SESSION_BUFFER_DAYS);
  const end = addDays(visible.end, PLANNER_SESSION_BUFFER_DAYS);
  return { startDate: dateToInputValue(start), endDate: dateToInputValue(end) };
}

var sessionsLoadedRange = { startDate: null, endDate: null };
var plannerSessionsLoadInFlight = null;

function resetSessionsLoadedRange() {
  sessionsLoadedRange = { startDate: null, endDate: null };
}

function setSessionsLoadedRange(startDate, endDate) {
  if (!startDate || !endDate) return;
  if (!sessionsLoadedRange.startDate || startDate < sessionsLoadedRange.startDate) {
    sessionsLoadedRange.startDate = startDate;
  }
  if (!sessionsLoadedRange.endDate || endDate > sessionsLoadedRange.endDate) {
    sessionsLoadedRange.endDate = endDate;
  }
}

function isRangeWithinLoaded(startDate, endDate) {
  if (!sessionsLoadedRange.startDate || !sessionsLoadedRange.endDate) return false;
  return startDate >= sessionsLoadedRange.startDate && endDate <= sessionsLoadedRange.endDate;
}

function sessionRangeBounds(startDate, endDate) {
  return {
    startTs: makeLocalDate(String(startDate).slice(0, 10), "00:00").getTime(),
    endTs: makeLocalDate(String(endDate).slice(0, 10), "23:59").getTime(),
  };
}

function replaceSessionsInDateRange(startDate, endDate, incoming) {
  var bounds = sessionRangeBounds(startDate, endDate);
  var kept = state.sessions.filter(function (s) {
    return s.startTs < bounds.startTs || s.startTs > bounds.endTs;
  });
  var map = new Map(kept.map(function (s) { return [normId(s.id), s]; }));
  (incoming || []).forEach(function (s) { map.set(normId(s.id), s); });
  state.sessions = Array.from(map.values()).sort(function (a, b) { return a.startTs - b.startTs; });
}

async function fetchAndMergeSessions(startDate, endDate) {
  if (!window.API || !window.API.getSessions || !startDate || !endDate) return false;
  var rows = await window.API.getSessions(startDate, endDate);
  replaceSessionsInDateRange(startDate, endDate, rows || []);
  setSessionsLoadedRange(startDate, endDate);
  return true;
}

async function ensurePlannerSessionsLoaded() {
  if (isMemberUser()) return false;
  var range = getPlannerFetchRange();
  if (isRangeWithinLoaded(range.startDate, range.endDate)) return false;
  if (plannerSessionsLoadInFlight) return plannerSessionsLoadInFlight;
  plannerSessionsLoadInFlight = (async function () {
    try {
      await fetchAndMergeSessions(range.startDate, range.endDate);
      return true;
    } finally {
      plannerSessionsLoadInFlight = null;
    }
  })();
  return plannerSessionsLoadInFlight;
}

async function refreshSessionsInLoadedRange() {
  if (!sessionsLoadedRange.startDate || !sessionsLoadedRange.endDate) {
    return ensurePlannerSessionsLoaded();
  }
  await fetchAndMergeSessions(sessionsLoadedRange.startDate, sessionsLoadedRange.endDate);
}

function localTodayDateStr(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function memberPackageEndDateStr(mp) {
  return String((mp && (mp.endDate || mp.end_date)) || "").slice(0, 10);
}

/** MP-04: status completed/cancelled veya endDate <= bugün */
function isMemberPackageExpired(mp, todayStr) {
  todayStr = todayStr || localTodayDateStr();
  if (!mp) return false;
  var status = (mp.status || "active").toLowerCase();
  if (status === "completed" || status === "cancelled") return true;
  var end = memberPackageEndDateStr(mp);
  return !!(end && end <= todayStr);
}

function isMemberPackageActive(mp, todayStr) {
  if (!mp) return false;
  if (isMemberPackageExpired(mp, todayStr)) return false;
  return (mp.status || "active").toLowerCase() === "active";
}

async function ensureActivePackageSessionsForList() {
  var todayStr = localTodayDateStr();
  var activePackages = (state.memberPackages || []).filter(function (mp) {
    return isMemberPackageActive(mp, todayStr);
  });
  if (!activePackages.length) return;
  var starts = activePackages.map(function (mp) { return String(mp.startDate || mp.start_date || "").slice(0, 10); }).filter(Boolean);
  var ends = activePackages.map(function (mp) { return String(mp.endDate || mp.end_date || "").slice(0, 10); }).filter(Boolean);
  if (!starts.length || !ends.length) return;
  starts.sort();
  ends.sort();
  var startDate = starts[0];
  var endDate = ends[ends.length - 1];
  if (isRangeWithinLoaded(startDate, endDate)) return;
  await fetchAndMergeSessions(startDate, endDate);
}

function removeSessionFromState(sessionId) {
  state.sessions = state.sessions.filter(function (s) { return normId(s.id) !== normId(sessionId); });
}

function removeSessionsFromState(sessionIds) {
  var ids = new Set(sessionIds.map(function (id) { return normId(id); }));
  state.sessions = state.sessions.filter(function (s) { return !ids.has(normId(s.id)); });
}

async function goToToday() {
  const now = new Date();
  ui.currentDay = startOfDay(now);
  ui.currentMonth = startOfMonth(now);
  ui.weekStart = startOfWeekMonday(now);
  saveUi();
  render();
  if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
  render();
  }
  if (isAdminMainViewActive("entry-list")) {
    await refreshEntryListModal();
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function normId(id) {
  const n = Number(id);
  return Number.isNaN(n) ? id : n;
}
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
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

/** Ad + soyadın ilk harfi (örn. Arzum Ç.) */
function fmtPersonShortName(fullName) {
  const full = String(fullName || "").trim();
  if (!full) return "—";
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1].charAt(0).toLocaleUpperCase("tr-TR")}.`;
  }
  return parts[0];
}

/** Personel kısa: Ad + Soyadın ilk harfi. (örn: Arzum Ç.) */
function getStaffShortName(staff) {
  if (!staff) return "—";
  return fmtPersonShortName(getStaffFullName(staff));
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

/** Tam ad stringinden: ad + soyadın ilk 3 harfi (giriş listesi mobil) */
function fmtEntryListMemberNameMobile(fullName) {
  const name = String(fullName || "").trim();
  if (!name) return "—";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const soyad3 = parts[1].slice(0, 3);
    return `${parts[0]} ${soyad3}${soyad3.length >= 3 ? "." : ""}`;
  }
  return parts[0];
}

/** Tam ad stringinden yalnızca ad (giriş listesi mobil personel sütunu) */
function fmtEntryListStaffFirstName(fullName) {
  const name = String(fullName || "").trim();
  if (!name) return "—";
  return name.split(/\s+/)[0];
}

function fmtEntryListMemberCell(r) {
  if (!isAdminMobilePanel()) return r.memberName || "—";
  const member = getMemberById(r.memberId);
  if (member) return getMemberShortName(member);
  return fmtEntryListMemberNameMobile(r.memberName);
}

function fmtEntryListStaffCell(r) {
  if (!isAdminMobilePanel()) return r.staffName || "—";
  const staff = getStaffById(r.staffId);
  if (staff) return getStaffFirstName(staff);
  return fmtEntryListStaffFirstName(r.staffName);
}

/** Mobil durum: «PersonelAdı - Geldi/Gelmedi» (onaylayan adı, yalnızca ad) */
function fmtEntryListStatusLabelMobile(r) {
  const label = String(r.attendanceLabel || "").trim();
  if (label.startsWith("QR")) return label;
  if (label.startsWith("Yönetici")) return label;
  if (label === "Planlandı" || label === "Onaylanmadı" || label === "—") return label;
  const m = label.match(/^(.+?)\s*-\s*(Geldi|Gelmedi|Katılındı)$/);
  if (m) {
    return fmtEntryListStaffFirstName(m[1].trim()) + " - " + m[2];
  }
  if (r.statusKind === "scheduled") return "Planlandı";
  if (r.statusKind === "pending") return "Onaylanmadı";
  if (r.statusKind === "qr") return label || "QR - Geldi";
  if (r.statusKind === "no_show") {
    const staff = getStaffById(r.staffId);
    const who = staff ? getStaffFirstName(staff) : fmtEntryListStaffFirstName(r.staffName);
    return who !== "—" ? who + " - Gelmedi" : "Gelmedi";
  }
  if (r.statusKind === "admin_present") return label || "Yönetici - Geldi";
  if (r.statusKind === "staff_present") {
    const staff = getStaffById(r.staffId);
    const who = staff ? getStaffFirstName(staff) : fmtEntryListStaffFirstName(r.staffName);
    return who !== "—" ? who + " - Geldi" : "Geldi";
  }
  return label || "Onaylanmadı";
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
  if (memberId == null) return null;
  const id = normId(memberId);
  return state.members.find((m) => normId(m.id) === id) || null;
}

/** Üyenin tam adı (filtre eşleştirmesi için). */
function getMemberFullName(member) {
  if (!member) return "";
  const ad = member.firstName ?? member.first_name ?? "";
  const soyad = member.lastName ?? member.last_name ?? "";
  return (member.name || `${ad} ${soyad}`.trim()) || "";
}

function getSessionMemberId(s) {
  if (!s) return null;
  if (s.memberId != null) return s.memberId;
  if (s.member_id != null) return s.member_id;
  return null;
}

function getSessionMemberNameFromRow(s) {
  if (!s) return "";
  return String(s.memberName || s.member_name || "").trim();
}

/** Seans satırı için üye adı: state.members → seans API alanı → yedek */
function getSessionMemberDisplayName(s) {
  const m = getMemberById(getSessionMemberId(s));
  const fromMember = getMemberFullName(m);
  if (fromMember) return fromMember;
  const fromSession = getSessionMemberNameFromRow(s);
  if (fromSession) return fromSession;
  return "Üye";
}

function getSessionMemberShortName(s) {
  const m = getMemberById(getSessionMemberId(s));
  if (m) return getMemberShortName(m);
  const fromSession = getSessionMemberNameFromRow(s);
  if (fromSession) return getMemberShortName({ name: fromSession });
  return "Üye";
}

/** Ad/soyad araması: tam ad, tek kelime veya «ad soyad» (her parça eşleşmeli). */
function nameTokensMatchFilter(firstName, lastName, fullName, filterText) {
  var q = String(filterText || "").trim().toLowerCase();
  if (!q) return true;
  var fn = String(firstName || "").trim().toLowerCase();
  var ln = String(lastName || "").trim().toLowerCase();
  var full = String(fullName || "").trim().toLowerCase();
  if (!full && (fn || ln)) full = (fn + " " + ln).trim();
  if (full.includes(q)) return true;
  var parts = q.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return fn.includes(q) || ln.includes(q) || full.includes(q);
  }
  return parts.every(function (p) {
    return fn.includes(p) || ln.includes(p) || full.includes(p);
  });
}

function personNameStringMatchesFilter(fullNameStr, filterText) {
  var name = String(fullNameStr || "").trim();
  if (!name) return false;
  var tokens = name.split(/\s+/).filter(Boolean);
  var fn = tokens[0] || "";
  var ln = tokens.slice(1).join(" ");
  return nameTokensMatchFilter(fn, ln, name, filterText);
}

function staffMatchesFilter(staff, filterText) {
  if (!staff) return false;
  var first = staff.firstName ?? staff.first_name ?? "";
  var last = staff.lastName ?? staff.last_name ?? "";
  return nameTokensMatchFilter(first, last, getStaffFullName(staff), filterText);
}

/** Takvim filtre metni doluysa, seansın üyesi veya personeli bu metinle eşleşiyor mu? (büyük/küçük harf duyarsız, kısmi eşleşme) */
function sessionMatchesPlannerFilter(s) {
  const q = (ui.plannerFilter || "").trim();
  if (!q) return true;
  const member = getMemberById(getSessionMemberId(s));
  if (member && memberMatchesListFilter(member, q)) return true;
  const memberName = getSessionMemberDisplayName(s);
  if (memberName && memberName !== "Üye" && personNameStringMatchesFilter(memberName, q)) return true;
  const staff = getStaffById(s.staffId);
  if (staffMatchesFilter(staff, q)) return true;
  const staffName = staff ? getStaffFullName(staff) : "";
  return staffName && personNameStringMatchesFilter(staffName, q);
}

function sessionMatchesToolbarFilters(s) {
  if (!sessionMatchesPlannerFilter(s)) return false;
  if (ui.filterStaffId && normId(s.staffId) !== normId(ui.filterStaffId)) return false;
  if (ui.filterRoomId && normId(s.roomId) !== normId(ui.filterRoomId)) return false;
  return true;
}

function getSessionsInRange(startTs, endTs) {
  return state.sessions.filter((s) => overlaps(s.startTs, s.endTs, startTs, endTs));
}

function checkConflicts(candidate, { ignoreSessionId = null, ignoreSessionIds = null } = {}) {
  const conflicts = [];
  const ignoreSet = ignoreSessionIds && ignoreSessionIds.size ? ignoreSessionIds : (ignoreSessionId != null ? new Set([normId(ignoreSessionId)]) : null);
  const relevant = ignoreSet
    ? state.sessions.filter((s) => !ignoreSet.has(normId(s.id)))
    : state.sessions;

  for (const s of relevant) {
    if (!overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs)) continue;
    if (normId(s.memberId) === normId(candidate.memberId)) {
      conflicts.push("Seçilen üye bu saat aralığında zaten planlı.");
      break;
    }
  }

  return conflicts;
}

function autoAssignRoom(candidate, opts = {}) {
  return state.rooms.length ? state.rooms[0].id : null;
}

let state = deepClone(DEFAULT_STATE);

function loadUi() {
  try {
    const raw = localStorage.getItem(STORAGE_UI_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const weekStart = p.weekStart ? startOfWeekMonday(new Date(p.weekStart)) : null;
    const currentDay = p.currentDay ? new Date(p.currentDay) : null;
    const viewMode = ["week", "month", "day"].includes(p.viewMode) ? p.viewMode : "day";
    if (weekStart && currentDay) {
      return {
        weekStart,
        currentDay,
        viewMode,
        currentMonth: p.currentMonth ? startOfMonth(new Date(p.currentMonth)) : startOfMonth(currentDay),
        dayDisplayMode: p.dayDisplayMode === "list" ? "list" : "grid",
        filterStaffId: p.filterStaffId || "",
        filterRoomId: p.filterRoomId || "",
      };
    }
  } catch (_) {}
  return null;
}
function saveUi() {
  try {
    localStorage.setItem(STORAGE_UI_KEY, JSON.stringify({
      weekStart: dateToInputValue(ui.weekStart),
      currentDay: dateToInputValue(ui.currentDay),
      currentMonth: dateToInputValue(ui.currentMonth || startOfMonth(ui.currentDay)),
      viewMode: ui.viewMode,
      dayDisplayMode: ui.dayDisplayMode,
      filterStaffId: ui.filterStaffId || "",
      filterRoomId: ui.filterRoomId || "",
    }));
  } catch (_) {}
}

// Her açılışta/sayfa yenilenmesinde takvim günlük görünüm ve bugünün tarihi ile açılsın (kayıtlı görünüm kullanılmaz).
const now = new Date();
let ui = {
  weekStart: startOfWeekMonday(now),
  currentDay: startOfDay(now),
  currentMonth: startOfMonth(now),
  viewMode: "day",
  dayDisplayMode: "grid",
  filterStaffId: "",
  filterRoomId: "",
  plannerFilter: "",
  editingSessionId: null,
  editingMemberId: null, // Üye Kimlik Kartı düzenleme
  deleteMemberId: null,  // Üye silme modalında silinecek üye id
  pendingNewMember: null, // Yeni üye: paket kaydedilene kadar DB'ye yazılmaz; Vazgeç = iptal
  currentUser: null, // { role, username, ... } – giriş yapan kullanıcı
  legalLinks: null, // KVKK / yasal sayfa URL'leri (GET /auth/legal-links sonucu)
  adminAccountLegalLinksLoaded: false, // hesap ekranı: yasal link alanları başarıyla yüklendi mi (kaydetmede kullanılır)
  memberPortal: null, // üye girişi: dashboard verisi
  packageRequests: [], // admin: bekleyen paket talepleri
  deletionRequests: [], // admin: bekleyen üyelik iptal talepleri
  sidebarPackageRequestsOpen: false,
  sidebarCancellationRequestsOpen: false,
  adminHubSection: "working-hours",
  memberProfileSection: "account", // past | account
  memberCalendarPackageId: null, // aktif paket seansları takvim listesinde
  memberTab: "home", // home | packages | profile
  memberSessionsView: "upcoming", // upcoming | past
  memberPortalSessionsModalSuspended: false,
  adminMainView: "calendar", // calendar | members-list (admin ana alan)
  sidebarOpen: false, // mobil drawer (MF-10)
  sidebarDesktopExpanded: false, // geniş ekran rail (< / >)
};

const SIDEBAR_DESKTOP_EXPANDED_KEY = "sidebarDesktopExpanded";

const SIDEBAR_DRAWER_MQ = window.matchMedia("(max-width: 980px)");
const TOPBAR_STACK_MQ = window.matchMedia("(max-width: 1100px)");
const MOBILE_PLANNER_MQ = window.matchMedia("(max-width: 767px)");

function isMobilePlanner() {
  return MOBILE_PLANNER_MQ.matches;
}

function isAdminMobilePanel() {
  return SIDEBAR_DRAWER_MQ.matches;
}

function isMobileViewport() {
  return MOBILE_PLANNER_MQ.matches;
}

function getEffectiveDayDisplayMode() {
  if (isMobilePlanner()) return "list";
  return ui.dayDisplayMode;
}

function applyPlannerLayoutForViewport() {
  if (!isMobilePlanner()) return false;
  let changed = false;
  if (ui.dayDisplayMode !== "list") {
    ui.dayDisplayMode = "list";
    changed = true;
  }
  if (ui.viewMode === "week" && !ui.weekStart) {
    ui.weekStart = startOfWeekMonday(ui.currentDay || new Date());
    changed = true;
  }
  if (ui.viewMode === "month" && !ui.currentMonth) {
    ui.currentMonth = startOfMonth(ui.currentDay || new Date());
    changed = true;
  }
  if (changed) saveUi();
  return changed;
}

function getAdminListFilterText() {
  return (ui.plannerFilter || "").trim();
}

function refreshAdminListPanels() {
  if (!isAdminUser() || !isAdminPanelViewActive()) return;
  var view = ui.adminMainView;
  if (view === "members-list") {
    var content = els.listMembersContent;
    if (content && typeof content._listMembersApplyAndRender === "function") {
      content._listMembersApplyAndRender();
    }
  } else if (view === "expired-memberships") {
    renderExpiredMembershipsTable();
  } else if (view === "former-members") {
    renderFormerMembersTable();
  } else if (view === "entry-list") {
    renderEntryListFromCache();
  }
}

function updateTopbarFilterPlaceholder() {
  var onMemberList =
    isAdminPanelViewActive() &&
    (ui.adminMainView === "members-list" ||
      ui.adminMainView === "expired-memberships" ||
      ui.adminMainView === "former-members");
  var onEntryList = isAdminMainViewActive("entry-list");
  var placeholder = onMemberList
    ? "Ad, soyad, telefon veya üye no ara..."
    : onEntryList
      ? "Ad, soyad veya personel ara..."
      : "Üye veya personel ara...";
  if (els.topbarMobileFilterInput) els.topbarMobileFilterInput.placeholder = placeholder;
  if (els.plannerFilterInput) {
    els.plannerFilterInput.placeholder = placeholder;
    els.plannerFilterInput.title = onMemberList
      ? "Ad, soyad, telefon veya üye no ile filtrele"
      : onEntryList
        ? "Ad, soyad veya personel adı ile filtrele"
        : "Üye veya personel adı ile filtrele";
  }
}

function syncPlannerFilterInputs() {
  const val = ui.plannerFilter || "";
  const active = document.activeElement;
  if (els.plannerFilterInput && els.plannerFilterInput !== active && els.plannerFilterInput.value !== val) {
    els.plannerFilterInput.value = val;
  }
  if (els.topbarMobileFilterInput && els.topbarMobileFilterInput !== active && els.topbarMobileFilterInput.value !== val) {
    els.topbarMobileFilterInput.value = val;
  }
}

function initMobilePlannerDefaults() {
  if (isMobilePlanner()) {
    ui.dayDisplayMode = "list";
  }
}

function onMobilePlannerMediaChange() {
  if (applyPlannerLayoutForViewport()) {
    render();
    return;
  }
  if (!isMemberUser()) updateTopbarForViewMode();
}

function onTopbarLayoutChange() {
  if (!TOPBAR_STACK_MQ.matches) closePlannerFiltersPanel();
}

function isSidebarDrawerMode() {
  return SIDEBAR_DRAWER_MQ.matches;
}

function isSidebarDesktopRailMode() {
  return !isSidebarDrawerMode() && !isMemberUser();
}

function loadSidebarDesktopExpandedPref() {
  try {
    return localStorage.getItem(SIDEBAR_DESKTOP_EXPANDED_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function saveSidebarDesktopExpandedPref(expanded) {
  try {
    localStorage.setItem(SIDEBAR_DESKTOP_EXPANDED_KEY, expanded ? "1" : "0");
  } catch (_) {}
}

function applySidebarDesktopExpanded() {
  if (!els.sidebarShell) return;
  var rail = isSidebarDesktopRailMode();
  if (els.sidebarDesktopToggleBtn) {
    els.sidebarDesktopToggleBtn.classList.toggle("hidden", !rail);
  }
  if (!rail) {
    els.sidebarShell.classList.remove("sidebar-shell--expanded");
    return;
  }
  var expanded = !!ui.sidebarDesktopExpanded;
  els.sidebarShell.classList.toggle("sidebar-shell--expanded", expanded);
  if (els.sidebarDesktopToggleBtn) {
    var chev = els.sidebarDesktopToggleBtn.querySelector(".sidebar-desktop-toggle__chev");
    if (chev) chev.textContent = expanded ? "<" : ">";
    els.sidebarDesktopToggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    els.sidebarDesktopToggleBtn.setAttribute(
      "aria-label",
      expanded ? "Kenar çubuğunu daralt" : "Kenar çubuğunu genişlet"
    );
  }
  saveSidebarDesktopExpandedPref(expanded);
  window.requestAnimationFrame(function () {
    if (typeof repositionOverlappingEvents === "function") repositionOverlappingEvents();
  });
}

function toggleSidebarDesktopExpanded() {
  ui.sidebarDesktopExpanded = !ui.sidebarDesktopExpanded;
  applySidebarDesktopExpanded();
}

function initSidebarDesktopExpanded() {
  if (!ui._sidebarDesktopPrefLoaded) {
    ui.sidebarDesktopExpanded = loadSidebarDesktopExpandedPref();
    ui._sidebarDesktopPrefLoaded = true;
  }
  applySidebarDesktopExpanded();
}

function setSidebarOpen(open) {
  if (isMemberUser()) {
    ui.sidebarOpen = false;
    return;
  }
  const next = !!open;
  ui.sidebarOpen = next;

  if (els.sidebarShell) {
    els.sidebarShell.classList.toggle("sidebar-shell--open", next);
  }
  if (els.sidebarBackdrop) {
    els.sidebarBackdrop.classList.toggle("hidden", !next);
    els.sidebarBackdrop.setAttribute("aria-hidden", next ? "false" : "true");
  }
  if (els.sidebarMenuBtn) {
    els.sidebarMenuBtn.setAttribute("aria-expanded", next ? "true" : "false");
    els.sidebarMenuBtn.setAttribute("aria-label", next ? "Menüyü kapat" : "Menüyü aç");
  }
  if (els.adminMobileSidebarBtn) {
    els.adminMobileSidebarBtn.setAttribute("aria-expanded", next ? "true" : "false");
  }
  if (els.staffMobileSidebarBtn) {
    els.staffMobileSidebarBtn.setAttribute("aria-expanded", next ? "true" : "false");
    els.staffMobileSidebarBtn.setAttribute("aria-label", next ? "Menüyü kapat" : "Menüyü aç");
  }
  updateAdminMobileMenuBadge();
  document.body.classList.toggle("body--sidebar-open", next && isSidebarDrawerMode());
  window.requestAnimationFrame(function () {
    if (typeof repositionOverlappingEvents === "function") repositionOverlappingEvents();
  });
}

function toggleSidebar() {
  setSidebarOpen(!ui.sidebarOpen);
}

function closeSidebar() {
  if (!ui.sidebarOpen) return;
  setSidebarOpen(false);
}

function onSidebarDrawerMediaChange() {
  if (!isSidebarDrawerMode()) {
    setSidebarOpen(false);
    document.body.classList.remove("body--sidebar-open");
  }
  updateAdminMobileTopbarClass();
  updateSidebarForRole();
  updateAdminHubNavVisibility();
  updateTopbarFilterPlaceholder();
  if (isAdminMainViewActive("entry-list")) {
    refreshEntryListModal().catch(function () {});
  }
  refreshAdminListPanels();
  if (!isMemberUser()) updateTopbarForViewMode();
}

const els = {};
function cacheEls() {
  const ids = [
    "topbarBrand",
    "prevBtn",
    "nextBtn",
    "todayBtn",
    "viewWeekBtn",
    "viewDayBtn",
    "viewMonthBtn",
    "viewDayListBtn",
    "plannerFiltersWrap",
    "plannerFiltersToggle",
    "plannerFilterInput",
    "topbarMobileFilterWrap",
    "topbarMobileFilterInput",
    "plannerJumpDate",
    "weekLabelPickWrap",
    "memberSessionsBtn",
    "memberProfileBtn",
    "memberProfileModal",
    "memberProfileName",
    "memberProfileEmail",
    "memberProfilePhone",
    "memberProfileNotifications",
    "memberProfilePastPackages",
    "memberProfileChangePasswordBtn",
    "memberProfileLogoutBtn",
    "memberProfileSidebarName",
    "memberProfileNavPast",
    "memberProfileNavAccount",
    "memberProfilePanelPast",
    "memberProfilePanelAccount",
    "weekLabel",
    "plannerGridWrap",
    "plannerDayList",
    "plannerMonth",
    "addSessionBtn",
    "exportBtn",
    "exportDropdown",
    "exportSessionsExcelBtn",
    "exportSessionsPdfBtn",
    "exportJsonBtn",
    "importFile",
    "topbarActionsMenuWrap",
    "topbarActionsMenuBtn",
    "topbarActionsMenu",
    "logoutBtn",
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
    "resetMemberPasswordBtn",
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
    "adminPasswordModal",
    "adminPasswordModalTitle",
    "adminPasswordModalMessage",
    "adminPasswordInput",
    "adminPasswordError",
    "adminPasswordCancelBtn",
    "adminPasswordConfirmBtn",
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
    "packageSessionsPackagePicker",
    "packageSessionsPackagePickerList",
    "packageSessionsCards",
    "packageSessionsTableWrap",
    "packageSessionsTable",
    "packageSessionsTableBody",
    "packageSessionsEmpty",
    "sessionModal",
    "sessionModalTitle",
    "sessionDate",
    "sessionTime",
    "sessionMember",
    "sessionStaff",
    "sessionNote",
    "sessionPackageHint",
    "sessionError",
    "saveSessionBtn",
    "deleteSessionBtn",
    "openWorkingHoursBtn",
    "workingHoursList",
    "workingHoursError",
    "saveWorkingHoursBtn",
    "workingHoursSummary",
    "openRoomsBtn",
    "roomsError",
    "newRoomName",
    "newRoomDevices",
    "addRoomBtn",
    "roomsSummary",
    "openPackagesBtn",
    "packagesSummary",
    "openActivityLogsBtn",
    "openDevResetBtn",
    "devResetCheckboxes",
    "devResetWarnings",
    "devResetAdminPassword",
    "devResetError",
    "devResetConfirmBtn",
    "openDevSeedBtn",
    "adminHubDevSeedNav",
    "devSeedStatus",
    "devSeedCount",
    "devSeedAdminPassword",
    "devSeedError",
    "devSeedSuccess",
    "devSeedConfirmBtn",
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
    "staffList",
    "staffError",
    "staffSummary",
    "newStaffFirstName",
    "newStaffLastName",
    "newStaffPhone",
    "newStaffEmail",
    "staffEditModal",
    "staffEditTitle",
    "editStaffFirstName",
    "editStaffLastName",
    "editStaffPhone",
    "editStaffEmail",
    "staffEditError",
    "saveStaffEditBtn",
    "deleteStaffEditBtn",
    "resetStaffPasswordBtn",
    "staffHoursModal",
    "staffHoursTitle",
    "staffHoursWorkingHours",
    "staffHoursError",
    "saveStaffHoursBtn",
    "taskDistributionBtn",
    "taskDistributionModal",
    "taskDistributionContent",
    "openListMembersBtn",
    "openCalendarBtn",
    "adminMembersListView",
    "listMembersContent",
    "openExpiredMembershipsBtn",
    "adminExpiredMembershipsView",
    "expiredMembershipsContent",
    "openFormerMembersBtn",
    "adminFormerMembersView",
    "formerMembersContent",
    "printBtn",
    "groupSessionModal",
    "groupSessionModalTitle",
    "groupSessionCreateFields",
    "groupSessionDisplayFields",
    "groupSessionNewDate",
    "groupSessionNewTime",
    "groupSessionNewStaff",
    "groupSessionDate",
    "groupSessionTime",
    "groupSessionStaff",
    "groupSessionMembers",
    "groupSessionNewMemberSelect",
    "groupSessionAddMemberBtn",
    "groupSessionError",
    "saveGroupSessionBtn",
    "mainContent",
    "sidebarMenuBtn",
    "sidebarBackdrop",
    "sidebarCloseBtn",
    "sidebarDesktopToggleBtn",
    "sidebarShell",
    "sidebarStaffSettings",
    "sidebarMembersPanel",
    "sidebarRequestsPanel",
    "sidebarPackageRequestsPanel",
    "sidebarCancellationRequestsPanel",
    "openPackageRequestsBtn",
    "openCancellationRequestsBtn",
    "closePackageRequestsBtn",
    "closeCancellationRequestsBtn",
    "packageRequestsList",
    "packageRequestsEmpty",
    "packageRequestsNavBadge",
    "cancellationRequestsList",
    "cancellationRequestsEmpty",
    "cancellationRequestsNavBadge",
    "memberPackageRequestCta",
    "memberOpenPackageRequestBtn",
    "memberPackageRequestPending",
    "memberPackageRequestPendingText",
    "memberPackageRequestModal",
    "memberPackageRequestSelect",
    "memberPackageRequestSubmitBtn",
    "memberPackageRequestError",
    "sidebarMemberPanel",
    "memberNotifications",
    "memberActivePackageCard",
    "memberPastPackagesList",
    "memberPortalSessionsModal",
    "memberPortalSessionsTitle",
    "memberPortalSessionsSubtitle",
    "memberPortalSessionsTableWrap",
    "memberPortalSessionsTable",
    "memberPortalSessionsTableBody",
    "memberPortalSessionsEmpty",
    "memberPortalSessionsError",
    "memberPortalSessionsCards",
    "memberTabBar",
    "adminMobileBar",
    "adminMobileSidebarBtn",
    "adminMobileMenuBadge",
    "adminMobileAddSessionBtn",
    "staffMobileBar",
    "staffMobileSidebarBtn",
    "memberHomeHeader",
    "memberHomeName",
    "memberHomeSettingsBtn",
    "memberHomeView",
    "memberPastSessionsList",
    "memberUpcomingSessionsList",
    "memberPastSessionsEmpty",
    "memberUpcomingSessionsEmpty",
    "memberUpcomingSessionsFooter",
    "memberPastSessionsFooter",
    "memberPastSessionsStats",
    "memberSessionsTabUpcoming",
    "memberSessionsTabPast",
    "memberUpcomingSessionsPanel",
    "memberPastSessionsPanel",
    "memberHomePackageInfo",
    "memberHomePackageName",
    "memberHomePackageRemaining",
    "memberHomePackageEnd",
    "memberQrFabBtn",
    "memberQrModal",
    "memberQrImage",
    "memberQrCountdown",
    "memberQrError",
    "sidebarAdminEntryPanel",
    "openEntryListBtn",
    "adminEntryListView",
    "entryListTabSessions",
    "entryListTabWalkIns",
    "entryListRefreshBtn",
    "entryListEmpty",
    "entryListTableWrap",
    "appDialogModal",
    "appDialogBackdrop",
    "appDialogModalTitle",
    "appDialogModalMessage",
    "appDialogCancelBtn",
    "appDialogOkBtn",
    "memberSessionCancelModal",
    "memberSessionCancelInfo",
    "memberSessionCancelReason",
    "memberSessionCancelReasonCount",
    "memberSessionCancelReschedule",
    "memberSessionCancelConfirmBtn",
    "memberSessionCancelError",
    "memberProfileBackBtn",
    "memberPackagesBackBtn",
    "memberInlinePackagesBtn",
    "memberPlanner",
    "memberPortalView",
    "memberPanelPackages",
    "memberPanelProfile",
    "memberPastPackagesPanel",
    "memberNotificationsBanner",
    "memberInlineProfileName",
    "memberInlineProfileEmail",
    "memberInlineProfilePhone",
    "memberInlineUpdateInfoBtn",
    "memberInlineDeleteAccountBtn",
    "memberInlineLogoutBtn",
    "memberDeletionRequestNotice",
    "memberDeletionRequestBanner",
    "approveMemberDeletionBtn",
    "rejectMemberDeletionBtn",
    "sidebarAdminFooter",
    "openAdminHubBtn",
    "adminHubModal",
    "adminHubNav",
    "openStaffAddBtn",
    "staffAddModal",
    "adminHubTitle",
    "adminHubDevResetNav",
    "passwordChangeScreen",
    "passwordChangeBackBtn",
    "passwordChangeForm",
    "passwordChangeError",
    "passwordChangeSubmitBtn",
    "adminProfileName",
    "adminProfileEmail",
    "adminProfilePhone",
    "adminProfileWhatsapp",
    "adminProfileWhatsappRow",
    "adminProfileUpdateBtn",
    "adminProfileLogoutBtn",
    "passwordChangeCurrentWrap",
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

async function setWeekStart(d) {
  ui.weekStart = startOfWeekMonday(d);
  saveUi();
  render();
  if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
  render();
  }
  await refreshEntryListIfActive();
}

async function setCurrentDay(d) {
  ui.currentDay = startOfDay(d);
  ui.currentMonth = startOfMonth(ui.currentDay);
  saveUi();
  render();
  if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
  render();
  }
  await refreshEntryListIfActive();
}

async function setViewMode(mode) {
  const prevMode = ui.viewMode;
  if (isMemberUser()) clearMemberCalendarPackageFilter();
  if (mode === "day") {
    if (prevMode === "week") {
      ui.currentDay = startOfDay(ui.weekStart);
      ui.currentMonth = startOfMonth(ui.currentDay);
    } else if (prevMode === "month") {
      ui.currentDay = startOfMonth(ui.currentMonth || ui.currentDay);
      ui.currentMonth = startOfMonth(ui.currentDay);
    } else if (!ui.currentDay) {
      ui.currentDay = startOfDay(new Date());
      ui.currentMonth = startOfMonth(ui.currentDay);
    }
  }
  if (isMobilePlanner()) {
    ui.dayDisplayMode = "list";
  }
  ui.viewMode = mode;
  if (mode === "week") {
    ui.weekStart = startOfWeekMonday(ui.currentDay || new Date());
  }
  if (mode === "month") {
    ui.currentMonth = startOfMonth(ui.currentDay || new Date());
  }
  saveUi();
  render();
  if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
  render();
  }
  await refreshEntryListIfActive();
}

function setDayDisplayMode(mode) {
  if (isMemberUser() && mode !== "list") clearMemberCalendarPackageFilter();
  if (isMobilePlanner()) mode = "list";
  ui.dayDisplayMode = mode === "list" ? "list" : "grid";
  saveUi();
  render();
}

function handleMobileEventTap(ev, onOpen) {
  if (!isMobilePlanner()) {
    if (onOpen) onOpen();
    return;
  }
  if (ev.classList.contains("event--expanded")) {
    ev.classList.remove("event--expanded");
    if (onOpen) onOpen();
    return;
  }
  document.querySelectorAll(".event.event--expanded").forEach(function (el) {
    el.classList.remove("event--expanded");
  });
  ev.classList.add("event--expanded");
}

function isPlannerDatePickEnabled() {
  return !isMemberUser() && isAdminMobilePanel();
}

function syncPlannerJumpDateInput() {
  if (!els.plannerJumpDate || !isPlannerDatePickEnabled()) return;
  els.plannerJumpDate.value = dateToInputValue(startOfDay(ui.currentDay || new Date()));
}

function openPlannerJumpDatePicker() {
  if (!els.plannerJumpDate || !isPlannerDatePickEnabled()) return;
  syncPlannerJumpDateInput();
  try {
    if (typeof els.plannerJumpDate.showPicker === "function") {
      els.plannerJumpDate.showPicker();
      return;
    }
  } catch (_) {}
  els.plannerJumpDate.click();
}

function onPlannerJumpDateSelected() {
  const v = els.plannerJumpDate && els.plannerJumpDate.value;
  if (!v || !isPlannerDatePickEnabled()) return;
  if (ui.viewMode !== "day") {
    ui.viewMode = "day";
    saveUi();
  }
  setCurrentDay(startOfDay(makeLocalDate(v, "00:00")));
}

function updatePlannerDatePickUi() {
  const enabled = isPlannerDatePickEnabled();
  if (els.weekLabelPickWrap) {
    els.weekLabelPickWrap.classList.toggle("weeknav__datePick--enabled", enabled);
  }
  if (els.plannerJumpDate) {
    els.plannerJumpDate.disabled = !enabled;
    if (enabled) syncPlannerJumpDateInput();
  }
}

function updateDateNavLabel() {
  if (!els.weekLabel) return;
  if (isMemberUser() && ui.memberCalendarPackageId != null) {
    var pkg = getMemberCalendarPackage();
    var name = (pkg && pkg.packageName) || "Paket";
    var count = state.sessions.filter(function (s) {
      return normId(s.memberPackageId) === normId(ui.memberCalendarPackageId);
    }).length;
    els.weekLabel.textContent = name + " — " + count + " seans (liste)";
    return;
  }
  if (ui.viewMode === "day") {
    const d = ui.currentDay;
    const dayOfWeek = d.getDay();
    let label = fmtPlannerDayNavLabel(d);
    if (!isDayEnabled(dayOfWeek)) {
      label += " · Kapalı";
    }
    els.weekLabel.textContent = label;
      syncPlannerJumpDateInput();
      return;
  } else if (ui.viewMode === "week") {
    els.weekLabel.textContent = fmtWeekLabel(ui.weekStart);
  } else if (ui.viewMode === "month") {
    els.weekLabel.textContent = fmtMonthLabel(ui.currentMonth || startOfMonth(ui.currentDay));
  }
  syncPlannerJumpDateInput();
}

function closePlannerFiltersPanel() {
  if (els.plannerFiltersWrap) els.plannerFiltersWrap.classList.remove("topbar__filters--open");
  if (els.plannerFiltersToggle) {
    els.plannerFiltersToggle.setAttribute("aria-expanded", "false");
  }
  updatePlannerFiltersToggleState();
}

function togglePlannerFiltersPanel() {
  if (!els.plannerFiltersWrap || !els.plannerFiltersToggle) return;
  const open = !els.plannerFiltersWrap.classList.contains("topbar__filters--open");
  els.plannerFiltersWrap.classList.toggle("topbar__filters--open", open);
  els.plannerFiltersToggle.setAttribute("aria-expanded", open ? "true" : "false");
  updatePlannerFiltersToggleState();
}

function updatePlannerFiltersToggleState() {
  if (!els.plannerFiltersToggle) return;
  const hasFilter = !!(ui.plannerFilter || "").trim();
  const isOpen = els.plannerFiltersWrap && els.plannerFiltersWrap.classList.contains("topbar__filters--open");
  els.plannerFiltersToggle.classList.toggle("topbar__filtersToggle--active", hasFilter || isOpen);
}

function isAdminHubProfileOnlyOnMobile() {
  return isAdminMobilePanel() && isAdminUser();
}

function isAdminHubSectionHiddenOnMobile(section) {
  return isAdminHubProfileOnlyOnMobile() && section !== "profile";
}

function getAdminHubDefaultSection() {
  if (!isAdminUser()) return "profile";
  if (isAdminMobilePanel()) return "profile";
  return "working-hours";
}

function normalizeAdminHubSection(section) {
  if (!section || isAdminHubSectionHiddenOnMobile(section)) return getAdminHubDefaultSection();
  return section;
}

function updateAdminMobileTopbarClass() {
  const adminMobile = !isMemberUser() && isAdminMobilePanel();
  const showAdminBar = adminMobile && isAdminUser();
  const showStaffBar = adminMobile && isStaffUser();
  const topbarEl = document.querySelector(".topbar");
  if (topbarEl) {
    topbarEl.classList.toggle("topbar--admin-mobile", adminMobile);
    topbarEl.classList.toggle("topbar--entry-list-panel", isAdminMainViewActive("entry-list"));
  }
  const mainApp = document.getElementById("mainApp");
  if (mainApp) {
    mainApp.classList.toggle("app--admin-mobile", showAdminBar);
    mainApp.classList.toggle("app--staff-mobile", showStaffBar);
  }
  if (els.adminMobileBar) els.adminMobileBar.classList.toggle("hidden", !showAdminBar);
  if (els.staffMobileBar) els.staffMobileBar.classList.toggle("hidden", !showStaffBar);
  if (els.topbarActionsMenuWrap && isAdminUser()) {
    els.topbarActionsMenuWrap.classList.toggle("hidden", adminMobile);
  }
  if (els.addSessionBtn && isAdminUser()) {
    els.addSessionBtn.classList.toggle("hidden", showAdminBar);
  }
  if (els.sidebarMenuBtn) {
    els.sidebarMenuBtn.classList.toggle("hidden", isMemberUser() || showAdminBar || showStaffBar);
  }
  updateUserBranding();
  updatePlannerDatePickUi();
}

function updateTopbarForViewMode() {
  const isStaff = isStaffUser();
  const viewingToday = isViewingToday();
  const mobilePlanner = isMobilePlanner();
  const adminMobile = isAdminMobilePanel();
  updateAdminMobileTopbarClass();
  if (els.todayBtn) {
    els.todayBtn.classList.toggle("hidden", adminMobile || viewingToday);
  }
  if (els.viewDayListBtn) {
    els.viewDayListBtn.classList.toggle("btn--primary", getEffectiveDayDisplayMode() === "list");
  }
  if (els.plannerFiltersWrap) {
    els.plannerFiltersWrap.classList.toggle("hidden", isMemberUser() || adminMobile);
  }
  if (els.plannerFiltersToggle) {
    els.plannerFiltersToggle.classList.toggle("hidden", adminMobile || isMemberUser());
  }
  if (els.topbarMobileFilterWrap) {
    els.topbarMobileFilterWrap.classList.toggle("hidden", isMemberUser() || !adminMobile);
  }
  if (adminMobile && !isMemberUser()) syncPlannerFilterInputs();
  updateTopbarFilterPlaceholder();
  const viewGroup = document.querySelector(".topbar__viewGroup");
  const showTopbarViewModes = !adminMobile || isAdminMainViewActive("entry-list");
  if (viewGroup) viewGroup.classList.toggle("hidden", !showTopbarViewModes);
  if (!isMemberUser() && els.addMemberBtn) {
    els.addMemberBtn.classList.toggle("hidden", adminMobile);
  }
  if (isMemberUser()) {
    if (els.viewWeekBtn) els.viewWeekBtn.classList.add("hidden");
    if (els.viewMonthBtn) els.viewMonthBtn.classList.add("hidden");
    if (els.viewDayListBtn) els.viewDayListBtn.classList.add("hidden");
    if (ui.viewMode !== "day") {
      ui.viewMode = "day";
      saveUi();
    }
  } else {
    if (els.viewDayBtn) els.viewDayBtn.classList.toggle("hidden", !showTopbarViewModes);
    if (els.viewWeekBtn) els.viewWeekBtn.classList.toggle("hidden", !showTopbarViewModes);
    if (els.viewMonthBtn) els.viewMonthBtn.classList.toggle("hidden", !showTopbarViewModes);
    if (els.viewDayListBtn) {
      els.viewDayListBtn.classList.toggle("hidden", adminMobile || mobilePlanner);
    }
  }
  updatePlannerFiltersToggleState();
  ["day", "week", "month"].forEach(function (mode) {
    const btn = mode === "day" ? els.viewDayBtn : mode === "week" ? els.viewWeekBtn : els.viewMonthBtn;
    if (!btn) return;
    if (mode === "day") {
      btn.classList.toggle(
        "btn--primary",
        ui.viewMode === "day" && (mobilePlanner || getEffectiveDayDisplayMode() !== "list")
      );
    } else {
      btn.classList.toggle("btn--primary", ui.viewMode === mode);
    }
  });
  updateDateNavLabel();
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
      header.style.gridTemplateColumns = "74px 1fr";
      const blank = document.createElement("div");
      blank.className = "headCell";
      blank.textContent = "Saat";
      header.appendChild(blank);
      const cell = document.createElement("div");
      cell.className = "headCell headCell--day";
      cell.innerHTML = calendarHeadCellHtml(d, { closed: true });
      header.appendChild(cell);
      return;
    }

    header.style.gridTemplateColumns = "74px 1fr";
    const blank = document.createElement("div");
    blank.className = "headCell";
    blank.textContent = "Saat";
    header.appendChild(blank);

    const cell = document.createElement("div");
    cell.className = "headCell headCell--day";
    cell.innerHTML = calendarHeadCellHtml(d);
    header.appendChild(cell);
  } else if (ui.viewMode === "week") {
    // Haftalık görünüm

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

      const cell = document.createElement("div");
      cell.className = "headCell headCell--day";
      cell.innerHTML = calendarHeadCellHtml(d);
      header.appendChild(cell);
    }
  }
}

function getViewRangeTs() {
  if (ui.viewMode === "week") {
    const weekStartTs = startOfDay(ui.weekStart).getTime();
    return { startTs: weekStartTs, endTs: addDays(ui.weekStart, 7).getTime() };
  }
  if (ui.viewMode === "month") {
    const monthStart = startOfMonth(ui.currentMonth || ui.currentDay);
    return { startTs: monthStart.getTime(), endTs: addMonths(monthStart, 1).getTime() };
  }
  const dayStartTs = startOfDay(ui.currentDay).getTime();
  return { startTs: dayStartTs, endTs: addDays(ui.currentDay, 1).getTime() };
}

function getSessionsFilteredForView() {
  if (isMemberUser() && ui.memberCalendarPackageId != null) {
    return state.sessions
      .filter((s) => normId(s.memberPackageId) === normId(ui.memberCalendarPackageId))
      .filter(sessionMatchesToolbarFilters)
      .sort((a, b) => a.startTs - b.startTs);
  }
  const { startTs, endTs } = getViewRangeTs();
  return state.sessions
    .filter((s) => s.startTs >= startTs && s.startTs < endTs)
    .filter(sessionMatchesToolbarFilters)
    .sort((a, b) => a.startTs - b.startTs);
}

function getListEmptyMessage() {
  if (isMemberUser() && ui.memberCalendarPackageId != null) {
    return "Bu pakette seans bulunamadı.";
  }
  if (ui.viewMode === "week") return "Bu hafta için seans bulunamadı.";
  if (ui.viewMode === "month") return "Bu ay için seans bulunamadı.";
  return "Bu gün için seans bulunamadı.";
}

function getMemberCalendarPackage() {
  if (!ui.memberCalendarPackageId || !ui.memberPortal) return null;
  var id = normId(ui.memberCalendarPackageId);
  var ap = ui.memberPortal.activePackage;
  if (ap && normId(ap.id) === id) return ap;
  return (ui.memberPortal.pastPackages || []).find(function (p) { return normId(p.id) === id; }) || null;
}

function showMemberPackageSessionsOnCalendar(pkg) {
  if (!pkg || !isMemberUser()) return;
  ui.memberCalendarPackageId = pkg.id;
  ui.dayDisplayMode = "list";
  closeMemberProfileModal();
  saveUi();
  updateMemberSessionsBtn();
  render();
}

function clearMemberCalendarPackageFilter() {
  if (ui.memberCalendarPackageId == null) return;
  ui.memberCalendarPackageId = null;
  saveUi();
  updateMemberSessionsBtn();
}

function fmtCalendarHeaderDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmtCalendarHeaderDayName(d) {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(d);
}

function calendarHeadCellHtml(d, options) {
  const closed = options && options.closed;
  let html = `${fmtCalendarHeaderDate(d)}<br><span class="headCell__dayName">${fmtCalendarHeaderDayName(d)}</span>`;
  if (closed) {
    html += `<br><small class="headCell__closed">Kapalı</small>`;
  }
  return html;
}

/** Paket seans listesi — ortak tarih/saat formatı (MP-05) */
function fmtPackageSessionDate(d) {
  return `${fmtCalendarHeaderDate(d)} ${fmtCalendarHeaderDayName(d)}`;
}

function fmtMemberPackagePeriodDate(val) {
  if (val == null || val === "") return "–";
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return fmtCalendarHeaderDate(val);
  }
  var s = String(val).trim();
  var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    var d = new Date(iso[1] + "T12:00:00");
    if (!Number.isNaN(d.getTime())) return fmtCalendarHeaderDate(d);
  }
  return s.slice(0, 10) || "–";
}

function fmtMemberPackagePeriodRange(start, end) {
  return fmtMemberPackagePeriodDate(start) + " – " + fmtMemberPackagePeriodDate(end);
}

var MSG_NO_ACTIVE_PACKAGE = "Aktif paket bulunmuyor.";

function normalizePackageSummary(pkg) {
  if (!pkg) return null;
  return {
    id: pkg.id,
    packageName: pkg.packageName || pkg.package_name || "Paket",
    packageType: pkg.packageType || pkg.package_type || "fixed",
    startDate: pkg.startDate || pkg.start_date,
    endDate: pkg.endDate || pkg.end_date,
    lessonCount: pkg.lessonCount != null ? pkg.lessonCount : pkg.lesson_count,
    remainingSessions: pkg.remainingSessions != null ? pkg.remainingSessions : null,
    usedSessions: pkg.usedSessions != null ? pkg.usedSessions : null,
  };
}

function fmtPackageTypeLabel(packageType) {
  return packageType === "flexible" ? "Esnek" : "Sabit";
}

function fmtPackageSessionsRemainingSummary(pkg) {
  var p = normalizePackageSummary(pkg);
  if (!p) return "—";
  var total = p.lessonCount;
  var rem = p.remainingSessions;
  if (rem == null && total != null && p.usedSessions != null) {
    rem = Math.max(0, Number(total) - Number(p.usedSessions));
  }
  if (rem != null && total != null) {
    return "Kalan: " + rem + " / " + total;
  }
  if (p.usedSessions != null) return p.usedSessions + " seans";
  return "—";
}

/** MP-10: admin geçmiş satırı + üye bitmiş paket kartı ortak meta */
function fmtPastPackageSummaryMeta(pkg) {
  var p = normalizePackageSummary(pkg);
  if (!p) return "—";
  var parts = [
    fmtPackageTypeLabel(p.packageType),
    fmtMemberPackagePeriodRange(p.startDate, p.endDate),
  ];
  if (p.usedSessions != null) parts.push(p.usedSessions + " seans");
  return parts.join(" • ");
}

function fmtActivePackageSummaryMetaLine(pkg) {
  var p = normalizePackageSummary(pkg);
  if (!p) return "—";
  return fmtPackageTypeLabel(p.packageType) + " • " + fmtMemberPackagePeriodRange(p.startDate, p.endDate);
}

function fmtPackageModalSubtitle(pkg, isActive) {
  return fmtActivePackageSummaryMetaLine(pkg) + " • " + (isActive ? "Aktif" : "Tamamlandı");
}

/** MP-09: aktif paket özet HTML */
function buildActivePackageSummaryHtml(pkg) {
  var p = normalizePackageSummary(pkg);
  if (!p) return '<p class="hint">' + escapeHtml(MSG_NO_ACTIVE_PACKAGE) + "</p>";
  return (
    '<strong class="member-package-card__title">' + escapeHtml(p.packageName) + "</strong>" +
    '<div class="member-package-card__meta">' + escapeHtml(fmtActivePackageSummaryMetaLine(p)) + "</div>" +
    '<div class="member-package-card__meta">' + escapeHtml(fmtPackageSessionsRemainingSummary(p)) + "</div>"
  );
}

function buildPastPackageCardInnerHtml(pkg) {
  var p = normalizePackageSummary(pkg);
  if (!p) return "";
  return (
    "<strong>" + escapeHtml(p.packageName) + "</strong>" +
    '<span class="hint">' + escapeHtml(fmtPastPackageSummaryMeta(p)) + "</span>"
  );
}

function renderMemberActivePackageInto(container, ap, options) {
  options = options || {};
  if (!container) return;
  container.classList.remove("member-package-card--clickable");
  container.removeAttribute("role");
  container.tabIndex = -1;
  container.onclick = null;
  container.onkeydown = null;
  if (!ap) {
    container.innerHTML = '<p class="hint">' + escapeHtml(MSG_NO_ACTIVE_PACKAGE) + "</p>";
    return;
  }
  container.innerHTML = buildActivePackageSummaryHtml(ap);
  if (options.clickable) {
    container.classList.add("member-package-card--clickable");
    container.setAttribute("role", "button");
    container.tabIndex = 0;
    var handler = function () {
      openMemberPortalSessionsModal(ap, true);
    };
    container.onclick = handler;
    container.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    };
  }
}

function renderMemberPastPackagesContainer(container, packages, options) {
  options = options || {};
  var emptyText = options.emptyText || "Eski paket yok.";
  var itemClass = options.itemClass || "member-past-package-btn";
  if (!container) return;
  if (!packages || !packages.length) {
    container.innerHTML = '<p class="hint">' + escapeHtml(emptyText) + "</p>";
    return;
  }
  container.innerHTML = "";
  packages.forEach(function (pkg) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = itemClass;
    btn.innerHTML = buildPastPackageCardInnerHtml(pkg);
    btn.addEventListener("click", function () {
      openMemberPortalSessionsModal(pkg, false);
    });
    container.appendChild(btn);
  });
}

function renderMemberPortalPackageSummaries() {
  if (!isMemberUser() || !ui.memberPortal) return;
  var portal = ui.memberPortal;
  renderMemberActivePackageInto(els.memberActivePackageCard, portal.activePackage, { clickable: true });
  renderMemberPastPackagesContainer(els.memberPastPackagesList, portal.pastPackages || [], {
    emptyText: "Bitmiş paket yok.",
    itemClass: "member-past-package-btn",
  });
}

function fmtPackageSessionTime(d) {
  return `${d.getHours()}:${pad2(d.getMinutes())}`;
}

function fmtSessionListDate(d) {
  return fmtPackageSessionDate(d);
}

function fmtSessionListTime(d) {
  return fmtPackageSessionTime(d);
}

function buildClientAttendanceLabel(s) {
  if (!s) return "";
  var method = s.checkInMethod;
  if (s.checkedInAt && method === "qr") return "QR - Geldi";
  if (s.checkedInAt && (method === "admin" || method === "manual_admin")) return "Yönetici - Geldi";
  if (s.checkedInAt && method === "manual") {
    return (s.confirmerStaffName || "Personel") + " - Geldi";
  }
  if (s.attendanceOutcome === "no_show") return "Gelmedi";
  if (Number(s.startTs) > Date.now()) return "Planlandı";
  if (!s.checkedInAt && !s.attendanceConfirmedAt && Number(s.startTs) <= Date.now()) return "Onaylanmadı";
  return "";
}

/** Giriş/onay kaydı olan seans (gelecek randevular hariç). */
function isSessionAttendanceConfirmed(s, now) {
  if (!s) return false;
  now = now || Date.now();
  if (Number(s.startTs) > now) return false;
  if (s.checkedInAt || s.checked_in_at) return true;
  if (s.attendanceConfirmedAt || s.attendance_confirmed_at) return true;
  return false;
}

var adminPasswordPromptState = { resolve: null };

function closeAdminPasswordModal(result) {
  if (els.adminPasswordModal) els.adminPasswordModal.classList.add("hidden");
  var r = adminPasswordPromptState.resolve;
  adminPasswordPromptState.resolve = null;
  if (r) r(result);
}

function promptAdminPassword(message, options) {
  options = options || {};
  if (!els.adminPasswordModal || !els.adminPasswordInput) {
    return Promise.resolve(null);
  }
  if (els.adminPasswordModalMessage) {
    els.adminPasswordModalMessage.textContent =
      message || "Girişi onaylanmış seans üzerinde işlem yapmak için admin şifrenizi girin.";
  }
  if (els.adminPasswordModalTitle) {
    els.adminPasswordModalTitle.textContent = options.title || "Admin şifresi gerekli";
  }
  els.adminPasswordInput.value = "";
  if (els.adminPasswordError) {
    els.adminPasswordError.textContent = "";
    els.adminPasswordError.classList.add("hidden");
  }
  els.adminPasswordModal.classList.remove("hidden");
  els.adminPasswordInput.focus();
  return new Promise(function (resolve) {
    adminPasswordPromptState.resolve = resolve;
  });
}

async function resolveAdminPasswordForSessions(sessions, message) {
  var list = (sessions || []).filter(Boolean);
  if (!list.some(isSessionAttendanceConfirmed)) return {};
  var pwd = await promptAdminPassword(
    message || "Girişi onaylanmış seans üzerinde işlem yapmak için admin şifrenizi girin."
  );
  if (!pwd) return { cancelled: true };
  return { adminPassword: pwd };
}

function bindAdminPasswordModal() {
  if (!els.adminPasswordModal || els.adminPasswordModal.dataset.bound === "1") return;
  els.adminPasswordModal.dataset.bound = "1";
  function submitAdminPassword() {
    var pwd = els.adminPasswordInput ? els.adminPasswordInput.value.trim() : "";
    if (!pwd) {
      if (els.adminPasswordError) {
        els.adminPasswordError.textContent = "Admin şifresi girin.";
        els.adminPasswordError.classList.remove("hidden");
      }
      return;
    }
    closeAdminPasswordModal(pwd);
  }
  if (els.adminPasswordConfirmBtn) {
    els.adminPasswordConfirmBtn.addEventListener("click", submitAdminPassword);
  }
  if (els.adminPasswordCancelBtn) {
    els.adminPasswordCancelBtn.addEventListener("click", function () {
      closeAdminPasswordModal(null);
    });
  }
  if (els.adminPasswordInput) {
    els.adminPasswordInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitAdminPassword();
      }
    });
  }
  els.adminPasswordModal.addEventListener("click", function (e) {
    if (e.target && e.target.dataset && e.target.dataset.close === "adminPasswordModal") {
      closeAdminPasswordModal(null);
    }
  });
}

function renderStaffAttendanceControlsHtml(s) {
  if (!s) return "";
  if (s.checkInMethod === "qr" && s.checkedInAt) {
    return '<span class="staff-attendance-mark staff-attendance-mark--ok" title="QR ile geldi" aria-label="Geldi">✓</span>';
  }
  if (s.checkedInAt) {
    return '<span class="staff-attendance-mark staff-attendance-mark--ok" aria-label="Geldi">✓</span>';
  }
  if (s.attendanceOutcome === "no_show" || (s.attendanceConfirmedAt && !s.checkedInAt)) {
    return '<span class="staff-attendance-mark staff-attendance-mark--no" aria-label="Gelmedi">✕</span>';
  }
  if (Number(s.startTs) > Date.now()) {
    return '<span class="staff-attendance-mark staff-attendance-mark--wait" aria-hidden="true">—</span>';
  }
  return (
    '<span class="staff-attendance-actions">' +
    '<button type="button" class="staff-attendance-btn staff-attendance-btn--ok" data-attendance-action="present" data-session-id="' +
    escapeHtml(String(s.id)) +
    '" title="Geldi" aria-label="Geldi">✓</button>' +
    '<button type="button" class="staff-attendance-btn staff-attendance-btn--no" data-attendance-action="no_show" data-session-id="' +
    escapeHtml(String(s.id)) +
    '" title="Gelmedi" aria-label="Gelmedi">✕</button>' +
    "</span>"
  );
}

function renderStaffMemberAttendanceRowHtml(sess) {
  var note = (sess.note || "").trim();
  return (
    '<div class="staff-attendance-row">' +
    '<span class="staff-attendance-row__name">' +
    escapeHtml(getSessionMemberDisplayName(sess)) +
    (note ? ' <span class="planner-session-card__note">· ' + escapeHtml(note) + "</span>" : "") +
    "</span>" +
    renderStaffAttendanceControlsHtml(sess) +
    "</div>"
  );
}

function bindStaffCalendarAttendanceHandlers(root) {
  if (!root || root.dataset.staffAttendanceBound === "1") return;
  root.dataset.staffAttendanceBound = "1";
  root.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-attendance-action]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var sid = btn.dataset.sessionId;
    var action = btn.dataset.attendanceAction;
    if (sid && action) submitCalendarAttendanceAction(sid, action, isAdminUser());
  });
}

function renderStaffEventAttendanceBlockHtml(sessions) {
  return (
    '<div class="event__attendance">' +
    (sessions || [])
      .map(function (sess) {
        return renderStaffMemberAttendanceRowHtml(sess);
      })
      .join("") +
    "</div>"
  );
}

function appendStaffEventAttendance(ev, sessions) {
  if (!ev) return;
  ev.classList.add("event--staff-attendance");
  ev.insertAdjacentHTML("beforeend", renderStaffEventAttendanceBlockHtml(sessions));
  bindStaffCalendarAttendanceHandlers(ev);
}

var appDialogState = { resolve: null, mode: "alert" };

function isCompactAppDialog(options) {
  return !!(options && (options.compactDialog || options.attendanceConfirm));
}

function closeAppDialog(result) {
  if (els.appDialogModal) {
    els.appDialogModal.classList.add("hidden");
    els.appDialogModal.classList.remove("modal--compact");
  }
  var resolve = appDialogState.resolve;
  appDialogState.resolve = null;
  if (typeof resolve === "function") resolve(result);
}

function openAppDialog(options) {
  options = options || {};
  if (!els.appDialogModal || !els.appDialogModalMessage) {
    return Promise.resolve(null);
  }
  var mode = options.mode === "confirm" ? "confirm" : "alert";
  appDialogState.mode = mode;
  if (els.appDialogModalTitle) {
    els.appDialogModalTitle.textContent = options.title || (mode === "confirm" ? "Emin misiniz?" : "Bilgi");
  }
  els.appDialogModalMessage.textContent = options.message || "";
  if (els.appDialogCancelBtn) {
    els.appDialogCancelBtn.classList.toggle("hidden", mode !== "confirm");
    els.appDialogCancelBtn.textContent = options.cancelLabel || "Vazgeç";
  }
  if (els.appDialogOkBtn) {
    els.appDialogOkBtn.textContent = options.okLabel || (mode === "confirm" ? "Onayla" : "Tamam");
    els.appDialogOkBtn.className = "btn " + (options.okClass || "btn--primary");
  }
  els.appDialogModal.classList.toggle("modal--compact", isCompactAppDialog(options));
  els.appDialogModal.classList.remove("hidden");
  window.requestAnimationFrame(function () {
    if (mode === "confirm" && els.appDialogOkBtn) els.appDialogOkBtn.focus();
    else if (els.appDialogOkBtn) els.appDialogOkBtn.focus();
  });
  return new Promise(function (resolve) {
    appDialogState.resolve = resolve;
  });
}

function showAppConfirm(message, options) {
  options = options || {};
  if (!els.appDialogModal) {
    return Promise.resolve(false);
  }
  return openAppDialog({
    mode: "confirm",
    title: options.title || "Emin misiniz?",
    message: message,
    okLabel: options.okLabel || "Onayla",
    cancelLabel: options.cancelLabel || "Vazgeç",
    okClass: options.okClass || "btn--primary",
    compactDialog: !!options.compactDialog,
    attendanceConfirm: !!options.attendanceConfirm,
  });
}

function showAppAlert(message, options) {
  options = options || {};
  if (!els.appDialogModal) {
    return Promise.resolve();
  }
  return openAppDialog({
    mode: "alert",
    title: options.title || "Bilgi",
    message: message,
    okLabel: options.okLabel || "Tamam",
    okClass: options.okClass || "btn--primary",
    compactDialog: !!options.compactDialog,
  }).then(function () {});
}

function bindAppDialogModal() {
  if (!els.appDialogModal || els.appDialogModal.dataset.bound === "1") return;
  els.appDialogModal.dataset.bound = "1";
  if (els.appDialogOkBtn) {
    els.appDialogOkBtn.addEventListener("click", function () {
      closeAppDialog(appDialogState.mode === "confirm" ? true : undefined);
    });
  }
  if (els.appDialogCancelBtn) {
    els.appDialogCancelBtn.addEventListener("click", function () {
      closeAppDialog(false);
    });
  }
  if (els.appDialogBackdrop) {
    els.appDialogBackdrop.addEventListener("click", function () {
      closeAppDialog(appDialogState.mode === "confirm" ? false : undefined);
    });
  }
  els.appDialogModal.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    closeAppDialog(appDialogState.mode === "confirm" ? false : undefined);
  });
}

async function submitCalendarAttendanceAction(sessionId, action, asAdmin) {
  if (!window.API || !window.API.confirmSessionAttendance) return;
  var label = action === "present" ? "Geldi" : "Gelmedi";
  var prefix = asAdmin ? "Yönetici olarak" : "Personel olarak";
  var confirmed = await showAppConfirm(prefix + ' "' + label + '" onayı verilsin mi?', {
    title: "Giriş onayı",
    okLabel: "Onayla",
    okClass: action === "present" ? "btn--primary" : "btn--danger",
    compactDialog: true,
    attendanceConfirm: true,
  });
  if (!confirmed) return;
  try {
    var res = await window.API.confirmSessionAttendance(sessionId, action);
    var skipSuccessAlert =
      isStaffUser() ||
      isAdminMainViewActive("entry-list");
    if (!skipSuccessAlert) {
    await showAppAlert(res.message || "Onay kaydedildi.", { title: "Onay kaydedildi" });
    }
    entryListEditSessionId = null;
    if (window.API.getSessions) await syncSessionsFromServer({ silent: true });
    if (isAdminMainViewActive("entry-list")) {
      await refreshEntryListModal();
    }
    render();
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Onay kaydedilemedi.", {
      title: "Onay kaydedilemedi",
      okClass: "btn--danger",
    });
  }
}

function sortPackageSessions(sessions) {
  return (sessions || []).slice().sort(function (a, b) {
    var aTs = Number(a.startTs != null ? a.startTs : a.start_ts);
    var bTs = Number(b.startTs != null ? b.startTs : b.start_ts);
    return aTs - bTs;
  });
}

/** Aktif paket seans listesinde iptal edilmiş slotları gizle (telafi zaten listede). */
function filterMemberPortalSessionsForDisplay(sessions, isActive) {
  if (!isActive) return sessions || [];
  return (sessions || []).filter(function (s) {
    return !isPackageSessionCancelled(s);
  });
}

function suspendMemberPortalSessionsModal() {
  if (!els.memberPortalSessionsModal || els.memberPortalSessionsModal.classList.contains("hidden")) return false;
  ui.memberPortalSessionsModalSuspended = true;
  els.memberPortalSessionsModal.classList.add("hidden");
  return true;
}

function restoreMemberPortalSessionsModalIfSuspended() {
  if (!ui.memberPortalSessionsModalSuspended || !memberPortalSessionsCurrent) {
    ui.memberPortalSessionsModalSuspended = false;
    return;
  }
  ui.memberPortalSessionsModalSuspended = false;
  var ap = ui.memberPortal && ui.memberPortal.activePackage;
  var pkg =
    memberPortalSessionsCurrent.isActive && ap
      ? ap
      : (ui.memberPortal.pastPackages || []).find(function (p) {
          return p.id === memberPortalSessionsCurrent.pkg.id;
        });
  if (!pkg) return;
  memberPortalSessionsCurrent.pkg = pkg;
  renderMemberPortalSessionsTable(pkg.sessions || [], memberPortalSessionsCurrent.isActive);
  els.memberPortalSessionsModal.classList.remove("hidden");
}

function fmtPackageSessionCheckInTime(s) {
  var checkedInAt = s.checkedInAt || s.checked_in_at || null;
  var method = s.checkInMethod || s.check_in_method || null;
  var startTs = Number(s.startTs != null ? s.startTs : s.start_ts);
  var lessonTimeStr = fmtPackageSessionTime(new Date(startTs));

  if (method === "qr" && checkedInAt) {
    var qrAt = new Date(checkedInAt);
    if (!isNaN(qrAt.getTime())) return fmtPackageSessionTime(qrAt);
    return "—";
  }

  if (
    checkedInAt &&
    (method === "manual" || method === "admin" || method === "manual_admin")
  ) {
    return lessonTimeStr;
  }

  if (checkedInAt && method !== "qr") {
    return lessonTimeStr;
  }

  return "—";
}

function normalizePackageSessionRow(s) {
  var startTs = Number(s.startTs != null ? s.startTs : s.start_ts);
  var endTs = Number(s.endTs != null ? s.endTs : s.end_ts);
  var d = new Date(startTs);
  var checkedInAt = s.checkedInAt || s.checked_in_at || null;
  return {
    id: s.id,
    startTs: startTs,
    endTs: endTs,
    staffName: String(s.staffName || s.staff_name || "").trim() || "–",
    roomName: String(s.roomName || s.room_name || "").trim() || "–",
    note: String(s.note || ""),
    isPast: !!s.isPast,
    isCancelled: !!(s.isCancelled || s.is_cancelled),
    isConsumed: !!(s.isConsumed || s.is_consumed),
    checkedIn: !!(s.checkedIn || s.checked_in),
    canCancel: !!s.canCancel,
    cancelReason: s.cancelReason || null,
    cancelReasonDetail: s.cancelReasonDetail || null,
    status: s.status || null,
    statusLabel: s.statusLabel || s.status_label || null,
    checkedInAt: checkedInAt,
    checkInMethod: s.checkInMethod || s.check_in_method || null,
    approvalLabel: s.approvalLabel || s.approval_label || null,
    approvalKind: s.approvalKind || s.approval_kind || null,
    dateStr: fmtPackageSessionDate(d),
    timeStr: fmtPackageSessionTime(d),
    checkInTimeStr: fmtPackageSessionCheckInTime(s),
  };
}

var PACKAGE_SESSIONS_TD = ' class="package-sessions-table__cell"';

/** Ortak paket seans tablosu (MP-06): role admin | member */
function renderPackageSessionsTableRows(container, sessions, options) {
  options = options || {};
  var role = options.role || "admin";
  var isActive = !!options.isActive;
  var emptyEl = options.emptyEl;
  var tableEl = options.tableEl;
  var onCancel = options.onCancel;
  var compact = !!options.compact;

  if (!container) return false;
  container.innerHTML = "";
  var list = sortPackageSessions(sessions);

  if (!list.length) {
    if (emptyEl) {
      emptyEl.textContent = "Seans kaydı yok.";
      emptyEl.classList.remove("hidden");
    }
    if (tableEl) tableEl.classList.add("hidden");
    return false;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  if (tableEl) tableEl.classList.remove("hidden");

  list.forEach(function (raw, i) {
    var s = normalizePackageSessionRow(raw);
    var dateStr = s.dateStr;
    var staffStr = compact ? fmtPersonShortName(s.staffName) : s.staffName;
    var tr = document.createElement("tr");
    tr.className = "package-sessions-table__row";
    if (role === "admin") {
      tr.style.cursor = "pointer";
      tr.title = "Gün, saat veya personel değiştirmek için tıklayın";
      tr.dataset.sessionId = String(s.id);
    }

    var html = "";
    if (role === "admin" && compact) {
      var approvalLabel = s.approvalLabel || "—";
      var approvalKind = s.approvalKind || "unknown";
      html =
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Sıra No">' + (i + 1) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Tarih">' + escapeHtml(dateStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Personel">' + escapeHtml(staffStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Ders Saati">' + escapeHtml(s.timeStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Giriş Saati">' + escapeHtml(s.checkInTimeStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Onay">' +
        '<span class="package-session-approval package-session-approval--' + escapeHtml(approvalKind) + '">' +
        escapeHtml(approvalLabel) +
        "</span></td>";
    } else {
      html =
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Sıra No">' + (i + 1) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Tarih">' + escapeHtml(dateStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Saat">' + escapeHtml(s.timeStr) + "</td>" +
        '<td' + PACKAGE_SESSIONS_TD + ' data-label="Personel">' + escapeHtml(staffStr) + "</td>";

      if (role === "member") {
        var st = memberSessionStatusLabel(s, { packageInactive: !!options.packageInactive });
        html +=
          '<td' + PACKAGE_SESSIONS_TD + ' data-label="Durum"><span class="member-session-status ' + st.cls + '">' + escapeHtml(st.text) + "</span></td>";
        var actionCell = "";
        if (isActive && s.canCancel) {
          actionCell =
            '<button type="button" class="btn btn--ghost btn--danger member-cancel-session-btn" data-session-id="' +
            s.id +
            '">İptal</button>';
        }
        html += '<td' + PACKAGE_SESSIONS_TD + ' data-label="İşlem">' + actionCell + "</td>";
      } else if (!compact) {
        html += "<td" + PACKAGE_SESSIONS_TD + ">" + escapeHtml(s.roomName) + "</td>";
        html += "<td" + PACKAGE_SESSIONS_TD + ">" + escapeHtml(s.note || "—") + "</td>";
      }
    }

    tr.innerHTML = html;

    if (role === "member") {
      var cancelBtn = tr.querySelector(".member-cancel-session-btn");
      if (cancelBtn && onCancel) {
        cancelBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          onCancel(Number(cancelBtn.dataset.sessionId));
        });
      }
    }

    container.appendChild(tr);
  });
  return true;
}

function renderPackageSessionsCards(container, sessions, options) {
  options = options || {};
  var role = options.role || "admin";
  var isActive = !!options.isActive;
  var emptyEl = options.emptyEl;
  var onCancel = options.onCancel;
  var compact = !!options.compact;

  if (!container) return false;
  var list = sortPackageSessions(sessions);

  if (!list.length) {
    container.innerHTML = "";
    container.classList.add("hidden");
    if (emptyEl) {
      emptyEl.textContent = options.emptyText || "Seans kaydı yok.";
      emptyEl.classList.remove("hidden");
    }
    return false;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  container.classList.remove("hidden");

  container.innerHTML = list
    .map(function (raw, i) {
      var s = normalizePackageSessionRow(raw);
      var staffStr = compact ? fmtPersonShortName(s.staffName) : s.staffName;

      if (role === "admin" && compact) {
        var approvalLabel = s.approvalLabel || "—";
        var approvalKind = s.approvalKind || "unknown";
        var checkInLine =
          s.checkInTimeStr && s.checkInTimeStr !== "—"
            ? '<div class="package-session-card__meta">Giriş: ' + escapeHtml(s.checkInTimeStr) + "</div>"
            : "";
        return (
          '<article class="package-session-card package-session-card--clickable" data-session-id="' +
          s.id +
          '" tabindex="0" role="button" title="Gün, saat veya personel değiştirmek için dokunun">' +
          '<div class="package-session-card__head">' +
          "<div><div class=\"package-session-card__datetime\">" +
          '<span class="package-session-card__index">' +
          (i + 1) +
          ".</span> " +
          escapeHtml(s.dateStr) +
          " · " +
          escapeHtml(s.timeStr) +
          "</div>" +
          '<div class="package-session-card__staff">' +
          escapeHtml(staffStr) +
          "</div></div>" +
          '<span class="package-session-approval package-session-approval--' +
          escapeHtml(approvalKind) +
          '">' +
          escapeHtml(approvalLabel) +
          "</span></div>" +
          checkInLine +
          '<div class="package-session-card__hint hint">Düzenlemek için dokunun</div></article>'
        );
      }

      var st = memberSessionStatusLabel(s, { packageInactive: !!options.packageInactive });
      var cancelBtn =
        isActive && raw.canCancel
          ? '<div class="package-session-card__actions"><button type="button" class="btn btn--ghost btn--danger member-cancel-session-btn" data-session-id="' +
            s.id +
            '">Seansı İptal Et</button></div>'
          : "";
      return (
        '<article class="package-session-card">' +
        '<div class="package-session-card__head">' +
        "<div><div class=\"package-session-card__datetime\">" +
        '<span class="package-session-card__index">' +
        (i + 1) +
        ".</span> " +
        escapeHtml(s.dateStr) +
        " · " +
        escapeHtml(s.timeStr) +
        "</div>" +
        '<div class="package-session-card__staff">' +
        escapeHtml(staffStr) +
        "</div></div>" +
        '<span class="member-session-status ' +
        st.cls +
        '">' +
        escapeHtml(st.text) +
        "</span></div>" +
        memberSessionStatusDetailHtml(st.detail) +
        cancelBtn +
        "</article>"
      );
    })
    .join("");

  container.querySelectorAll(".member-cancel-session-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (onCancel) onCancel(Number(btn.dataset.sessionId));
    });
  });
  return true;
}

function renderPackageSessionsList(sessions, options) {
  options = options || {};
  var useCards = isMobilePlanner();
  if (options.cardsEl) options.cardsEl.classList.toggle("hidden", !useCards);
  if (options.tableWrapEl) options.tableWrapEl.classList.toggle("hidden", useCards);
  if (useCards) {
    renderPackageSessionsCards(options.cardsEl, sessions, options);
    return;
  }
  if (options.tableEl && sessions && sessions.length) options.tableEl.classList.remove("hidden");
  renderPackageSessionsTableRows(options.tableBodyEl, sessions, options);
}

function packageSessionsToExportRows(sessions) {
  return sortPackageSessions(sessions).map(function (raw) {
    var s = normalizePackageSessionRow(raw);
    return [s.dateStr, s.staffName, s.timeStr, s.checkInTimeStr, s.approvalLabel || "—"];
  });
}

function groupSessionsByDateKey(sessions) {
  const groups = [];
  const map = new Map();
  sessions.forEach(function (s) {
    const key = dateToInputValue(new Date(s.startTs));
    if (!map.has(key)) {
      const entry = { dateKey: key, date: startOfDay(new Date(s.startTs)), sessions: [] };
      map.set(key, entry);
      groups.push(entry);
    }
    map.get(key).sessions.push(s);
  });
  return groups;
}

function buildAdminPlannerListEntries(daySessions) {
  const staffGroups = groupSessionsByStaffAndTime(daySessions);
  const renderedSessionIds = new Set();
  const entries = [];

  for (const [, group] of staffGroups.entries()) {
    if (group.sessions.length > 1) {
      entries.push({ kind: "group", startTs: group.startTs, group: group });
      group.sessions.forEach(function (sess) {
        renderedSessionIds.add(sess.id);
      });
    }
  }
  daySessions.forEach(function (s) {
    if (!renderedSessionIds.has(s.id)) {
      entries.push({ kind: "single", startTs: s.startTs, session: s });
    }
  });
  entries.sort(function (a, b) {
    return a.startTs - b.startTs;
  });
  return entries;
}

function buildAdminPlannerStaffGroups(sessions) {
  const byStaff = new Map();
  sessions.forEach(function (s) {
    const sk = String(normId(s.staffId));
    if (!byStaff.has(sk)) {
      byStaff.set(sk, {
        sessions: [],
        staffId: s.staffId,
        roomId: s.roomId,
        startTs: s.startTs,
        endTs: s.endTs,
      });
    }
    const g = byStaff.get(sk);
    g.sessions.push(s);
    g.startTs = Math.min(g.startTs, s.startTs);
    g.endTs = Math.max(g.endTs, s.endTs);
  });
  return Array.from(byStaff.values()).sort(function (a, b) {
    const na = (getStaffFullName(getStaffById(a.staffId)) || "").toLowerCase();
    const nb = (getStaffFullName(getStaffById(b.staffId)) || "").toLowerCase();
    return na.localeCompare(nb, "tr");
  });
}

function getSessionPlannerSlotMinute(session, slotStartMin, slotMin) {
  const d = new Date(session.startTs);
  const dayStartTs = startOfDay(d).getTime();
  const startMinOfDay = Math.floor((session.startTs - dayStartTs) / 60000);
  const row = Math.floor((startMinOfDay - slotStartMin) / slotMin);
  return slotStartMin + row * slotMin;
}

function shouldAdminMobileShowAllWorkingHours(dayDate) {
  return (
    canManageSessions() &&
    ui.viewMode === "day" &&
    isAdminMobilePanel() &&
    isDayEnabled(startOfDay(dayDate || ui.currentDay).getDay())
  );
}

/** Mobil admin: aynı saatteki seansları personel bazında gruplar. */
function buildAdminPlannerTimeRows(daySessions, options) {
  options = options || {};
  const dayDate = options.dayDate ? startOfDay(options.dayDate) : null;
  const includeAllWorkingHours =
    options.includeAllWorkingHours != null
      ? !!options.includeAllWorkingHours
      : !!(dayDate && shouldAdminMobileShowAllWorkingHours(dayDate));

  if (includeAllWorkingHours && dayDate) {
    const dayOfWeek = dayDate.getDay();
    const { startMin, slotMin, slots } = buildTimeSlotsForDay(dayOfWeek);
    const sessionsBySlot = new Map();
    slots.forEach(function (minuteOfDay) {
      sessionsBySlot.set(minuteOfDay, []);
    });
    daySessions.forEach(function (s) {
      const slotKey = getSessionPlannerSlotMinute(s, startMin, slotMin);
      if (!sessionsBySlot.has(slotKey)) return;
      sessionsBySlot.get(slotKey).push(s);
    });
    const dateStr = dateToInputValue(dayDate);
    return slots.map(function (minuteOfDay) {
      const slotSessions = sessionsBySlot.get(minuteOfDay) || [];
      return {
        startTs: makeLocalDate(dateStr, minutesToTime(minuteOfDay)).getTime(),
        timeLabel: minutesToTime(minuteOfDay),
        staffGroups: buildAdminPlannerStaffGroups(slotSessions),
      };
    });
  }

  const byTime = new Map();
  daySessions.forEach(function (s) {
    const key = String(s.startTs);
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key).push(s);
  });
  const rows = [];
  byTime.forEach(function (sessions, startTsKey) {
    rows.push({
      startTs: Number(startTsKey),
      staffGroups: buildAdminPlannerStaffGroups(sessions),
    });
  });
  rows.sort(function (a, b) { return a.startTs - b.startTs; });
  return rows;
}

function getStaffFirstName(staff) {
  if (!staff) return "—";
  const fn = (staff.firstName ?? staff.first_name ?? "").trim();
  if (fn) return fn;
  const full = getStaffFullName(staff);
  return full.split(/\s+/)[0] || "—";
}

/** Aynı oda + çakışan saat aralığında kalan alet/kapasite (0 = dolu). */
function getRoomRemainingCapacityAt(roomId, startTs, endTs) {
  if (roomId == null) return null;
  const room = getRoomById(roomId);
  if (!room) return null;
  const capacity = Number(room.devices);
  if (!Number.isFinite(capacity) || capacity < 1) return null;
  const count = state.sessions.filter(function (s) {
    return normId(s.roomId) === normId(roomId) && overlaps(s.startTs, s.endTs, startTs, endTs);
  }).length;
  return Math.max(0, capacity - count);
}

function fmtStaffLabelWithRoomRemaining(staff, roomId, startTs, endTs, opts) {
  opts = opts || {};
  var name = opts.firstNameOnly ? getStaffFirstName(staff) : getStaffShortName(staff);
  if (!canManageSessions()) return name;
  var rem = getRoomRemainingCapacityAt(roomId, startTs, endTs);
  if (rem == null) return name;
  return name + " (" + rem + ")";
}

function renderAdminStaffSlotCardHtml(group, entryIdx) {
  const staff = getStaffById(group.staffId);
  const color = staffColor(group.staffId);
  const memberLines = group.sessions
    .map(function (sess) {
      return escapeHtml(getSessionMemberShortName(sess));
    })
    .join("<br>");
  const cardStyle =
    "--staff-card-border:" + color.border + ";--staff-card-bg:" + color.bg + ";";
  const deleteBtnHtml = canManageSessions()
    ? '<button type="button" class="event__deleteBtn planner-staff-slot-card__deleteBtn" title="Seansları sil" aria-label="Seansları sil">🗑️</button>'
    : "";
  return (
    '<article class="planner-staff-slot-card planner-session-card--admin" tabindex="0" data-entry-idx="' +
    entryIdx +
    '" style="' +
    cardStyle +
    '">' +
    '<div class="planner-staff-slot-card__head">' +
    '<div class="planner-staff-slot-card__titleRow">' +
    '<div class="planner-staff-slot-card__staff">' +
    escapeHtml(fmtStaffLabelWithRoomRemaining(staff, group.roomId, group.startTs, group.endTs, { firstNameOnly: true })) +
    "</div>" +
    deleteBtnHtml +
    "</div>" +
    "</div>" +
    '<div class="planner-staff-slot-card__members">' +
    memberLines +
    "</div>" +
    "</article>"
  );
}

function renderAdminPlannerTimeRowHtml(timeRow, adminListEntries) {
  const timeLabel = escapeHtml(timeRow.timeLabel || fmtSessionListTime(new Date(timeRow.startTs)));
  const staffCount = timeRow.staffGroups.length;
  const gridCols = staffCount > 0 ? Math.min(3, staffCount) : 1;
  let cardsHtml = "";
  timeRow.staffGroups.forEach(function (group) {
    const entryIdx = adminListEntries.length;
    adminListEntries.push({ kind: "group", startTs: group.startTs, group: group });
    cardsHtml += renderAdminStaffSlotCardHtml(group, entryIdx);
  });
  return (
    '<div class="planner-time-row">' +
    '<div class="planner-time-row__time" aria-hidden="true"><span>' +
    timeLabel +
    "</span></div>" +
    '<div class="planner-time-row__cards" style="grid-template-columns:repeat(' +
    gridCols +
    ',minmax(0,1fr))">' +
    cardsHtml +
    "</div></div>"
  );
}

function renderAdminPlannerListCardHtml(entry, entryIdx) {
  if (entry.kind === "group") {
    const group = entry.group;
    const start = new Date(group.startTs);
    const staff = getStaffById(group.staffId);
    const memberLines = group.sessions
      .map(function (sess) {
        return escapeHtml(getSessionMemberShortName(sess));
      })
      .join("<br>");
    return (
      '<article class="planner-session-card planner-session-card--admin" tabindex="0" data-entry-idx="' +
      entryIdx +
      '">' +
      '<div class="planner-session-card__time">' +
      escapeHtml(fmtSessionListTime(start)) +
      "</div>" +
      '<div class="planner-session-card__body">' +
      '<div class="planner-session-card__title">' +
      escapeHtml(fmtStaffLabelWithRoomRemaining(staff, group.roomId, group.startTs, group.endTs)) +
      "</div>" +
      '<div class="planner-session-card__members">' +
      memberLines +
      "</div>" +
      "</div></article>"
    );
  }

  const s = entry.session;
  const start = new Date(s.startTs);
  const staff = getStaffById(s.staffId);
  const note = (s.note || "").trim();
  return (
    '<article class="planner-session-card planner-session-card--admin" tabindex="0" data-entry-idx="' +
    entryIdx +
    '">' +
    '<div class="planner-session-card__time">' +
    escapeHtml(fmtSessionListTime(start)) +
    "</div>" +
    '<div class="planner-session-card__body">' +
    '<div class="planner-session-card__title">' +
    escapeHtml(fmtStaffLabelWithRoomRemaining(staff, s.roomId, s.startTs, s.endTs)) +
    "</div>" +
    '<div class="planner-session-card__members">' +
    escapeHtml(getSessionMemberShortName(s)) +
    "</div>" +
    (note ? '<div class="planner-session-card__detail">' + escapeHtml(note) + "</div>" : "") +
    "</div></article>"
  );
}

function renderStaffPlannerListCardHtml(entry) {
  var sessions = entry.kind === "group" ? entry.group.sessions : [entry.session];
  var startTs = entry.kind === "group" ? entry.group.startTs : entry.session.startTs;
  var start = new Date(startTs);
  var attendanceRows = sessions
    .map(function (sess) {
      return renderStaffMemberAttendanceRowHtml(sess);
    })
    .join("");
  return (
    '<article class="planner-session-card planner-session-card--staff-group">' +
    '<div class="planner-session-card__time">' +
    escapeHtml(fmtSessionListTime(start)) +
    "</div>" +
    '<div class="planner-session-card__body planner-session-card__body--staff-attendance">' +
    '<div class="staff-group-attendance">' +
    attendanceRows +
    "</div>" +
    "</div></article>"
  );
}

function renderSessionsListCards(sessions, options) {
  const showDateHeaders = options.showDateHeaders;
  const memberPkgList = options.memberPkgList;
  const adminGrouped = !memberPkgList && canManageSessions();
  const staffGrouped = !memberPkgList && isStaffUser();
  const dateGroups = showDateHeaders ? groupSessionsByDateKey(sessions) : [{ dateKey: "", date: null, sessions: sessions }];
  const adminListEntries = [];
  let html = '<div class="planner-session-cards">';

  dateGroups.forEach(function (group) {
    if (showDateHeaders && group.date) {
      html += `<div class="planner-session-cards__date">${escapeHtml(fmtSessionListDate(group.date))}</div>`;
    }
    if (adminGrouped) {
      const dayDate = group.date || ui.currentDay;
      buildAdminPlannerTimeRows(group.sessions, {
        dayDate: dayDate,
        includeAllWorkingHours: shouldAdminMobileShowAllWorkingHours(dayDate),
      }).forEach(function (timeRow) {
        html += renderAdminPlannerTimeRowHtml(timeRow, adminListEntries);
      });
      return;
    }
    if (staffGrouped) {
      buildAdminPlannerListEntries(group.sessions).forEach(function (entry) {
        html += renderStaffPlannerListCardHtml(entry);
      });
      return;
    }
    group.sessions.forEach(function (s) {
      const start = new Date(s.startTs);
      const staff = getStaffById(s.staffId);
      const room = getRoomById(s.roomId);
      const title = memberPkgList
        ? escapeHtml(getStaffFullName(staff))
        : escapeHtml(getSessionMemberDisplayName(s));
      const meta = memberPkgList
        ? escapeHtml(fmtSessionListDate(start)) + " · " + escapeHtml(fmtSessionListTime(start))
        : escapeHtml(getStaffFullName(staff)) + (isStaffUser() ? "" : " · " + escapeHtml(room?.name || "—"));
      const note = (s.note || "").trim();
      let actionHtml = "";
      if (memberPkgList && memberCanCancelSession(s)) {
        actionHtml =
          '<button type="button" class="btn btn--ghost btn--danger btn--xs member-calendar-cancel-btn" data-session-id="' +
          s.id +
          '">İptal</button>';
      }
      html +=
        '<article class="planner-session-card" tabindex="0" data-session-id="' + escapeHtml(String(s.id)) + '">' +
        '<div class="planner-session-card__time">' + escapeHtml(fmtSessionListTime(start)) + "</div>" +
        '<div class="planner-session-card__body">' +
        '<div class="planner-session-card__title">' + title + "</div>" +
        '<div class="planner-session-card__meta">' + meta + "</div>" +
        (note ? '<div class="planner-session-card__detail">' + escapeHtml(note) + "</div>" : "") +
        (actionHtml ? '<div class="planner-session-card__actions">' + actionHtml + "</div>" : "") +
        "</div></article>";
    });
  });

  html += "</div>";
  els.plannerDayList.innerHTML = html;

  if (staffGrouped) {
    bindStaffCalendarAttendanceHandlers(els.plannerDayList);
    return;
  }

  if (adminGrouped) {
    els.plannerDayList.querySelectorAll(".planner-staff-slot-card__deleteBtn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const card = btn.closest(".planner-session-card--admin");
        const entry = adminListEntries[Number(card && card.dataset.entryIdx)];
        if (!entry || entry.kind !== "group") return;
        confirmAndDeleteStaffSessionGroup(entry.group);
      });
    });
    els.plannerDayList.querySelectorAll(".planner-session-card--admin").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".planner-staff-slot-card__deleteBtn")) return;
        const entry = adminListEntries[Number(card.dataset.entryIdx)];
        if (!entry) return;
        if (entry.kind === "group") openGroupSessionModal(entry.group);
        else openGroupSessionModal(getGroupForSession(entry.session));
      });
    });
    return;
  }

  els.plannerDayList.querySelectorAll(".planner-session-card").forEach(function (card) {
    card.addEventListener("click", function (e) {
      if (e.target.closest(".member-calendar-cancel-btn")) return;
      const wasExpanded = card.classList.contains("planner-session-card--expanded");
      els.plannerDayList.querySelectorAll(".planner-session-card--expanded").forEach(function (el) {
        el.classList.remove("planner-session-card--expanded");
      });
      if (!wasExpanded) card.classList.add("planner-session-card--expanded");
    });
  });
  els.plannerDayList.querySelectorAll(".member-calendar-cancel-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      cancelMemberSessionFromPortal(Number(btn.dataset.sessionId));
    });
  });
}

function renderSessionsListView() {
  if (!els.plannerDayList) return;
  if (els.plannerGridWrap) els.plannerGridWrap.classList.add("hidden");
  if (els.plannerHeader) els.plannerHeader.classList.add("hidden");
  if (els.plannerMonth) els.plannerMonth.classList.add("hidden");
  els.plannerDayList.classList.remove("hidden");

  const memberPkgList = isMemberUser() && ui.memberCalendarPackageId != null;
  const showDateCol = memberPkgList || ui.viewMode !== "day";
  const showDateHeaders = showDateCol;
  const sessions = getSessionsFilteredForView();
  const adminMobileDaySchedule = shouldAdminMobileShowAllWorkingHours(ui.currentDay);
  if (sessions.length === 0 && !adminMobileDaySchedule) {
    els.plannerDayList.innerHTML = `<div class="planner-day-empty">${escapeHtml(getListEmptyMessage())}</div>`;
    return;
  }

  if (isMobilePlanner()) {
    renderSessionsListCards(sessions, { showDateHeaders: showDateHeaders, memberPkgList: memberPkgList });
    return;
  }

  if (memberPkgList) {
    const rows = sessions.map(function (s, i) {
      const start = new Date(s.startTs);
      const staff = getStaffById(s.staffId);
      const st = memberSessionStatusLabel(s);
      var actionCell = "";
      if (memberCanCancelSession(s)) {
        actionCell =
          '<button type="button" class="btn btn--ghost btn--danger btn--xs member-calendar-cancel-btn" data-session-id="' +
          s.id +
          '">İptal</button>';
      }
      return (
        "<tr>" +
        '<td data-label="#">' + (i + 1) + "</td>" +
        '<td data-label="Tarih">' + escapeHtml(fmtSessionListDate(start)) + "</td>" +
        '<td data-label="Saat">' + escapeHtml(fmtSessionListTime(start)) + "</td>" +
        '<td data-label="Personel">' + escapeHtml(getStaffFullName(staff)) + "</td>" +
        '<td data-label="Durum"><span class="member-session-status ' + st.cls + '">' + escapeHtml(st.text) + "</span></td>" +
        '<td data-label="İşlem">' + actionCell + "</td>" +
        "</tr>"
      );
    }).join("");
    els.plannerDayList.innerHTML =
      '<table class="planner-day-table">' +
      "<thead><tr><th>#</th><th>Tarih</th><th>Saat</th><th>Personel</th><th>Durum</th><th>İşlem</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>";
    els.plannerDayList.querySelectorAll(".member-calendar-cancel-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        cancelMemberSessionFromPortal(Number(btn.dataset.sessionId));
      });
    });
    return;
  }

  const rows = sessions.map(function (s) {
    const start = new Date(s.startTs);
    const timeStr = fmtSessionListTime(start);
    const staff = getStaffById(s.staffId);
    const dateCell = showDateCol
      ? `<td data-label="Tarih">${escapeHtml(fmtSessionListDate(start))}</td>`
      : "";
    const roomCell = "";
    return `<tr>
      ${dateCell}
      <td data-label="Saat">${escapeHtml(timeStr)}</td>
      <td data-label="Üye">${escapeHtml(getSessionMemberDisplayName(s))}</td>
      <td data-label="Personel">${escapeHtml(getStaffFullName(staff))}</td>
      ${roomCell}
      <td data-label="Not">${escapeHtml(s.note || "—")}</td>
    </tr>`;
  }).join("");

  const dateHeader = showDateCol ? "<th>Tarih</th>" : "";
  const roomHeader = "";
  els.plannerDayList.innerHTML = `
    <table class="planner-day-table">
      <thead>
        <tr>
          ${dateHeader}
          <th>Saat</th>
          <th>Üye</th>
          <th>Personel</th>
          ${roomHeader}
          <th>Not</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderMonthView() {
  if (!els.plannerMonth) return;
  if (els.plannerGridWrap) els.plannerGridWrap.classList.add("hidden");
  if (els.plannerHeader) els.plannerHeader.classList.add("hidden");
  if (els.plannerDayList) els.plannerDayList.classList.add("hidden");
  els.plannerMonth.classList.remove("hidden");

  const monthStart = startOfMonth(ui.currentMonth || ui.currentDay);
  const monthEnd = addMonths(monthStart, 1);
  const monthStartTs = monthStart.getTime();
  const monthEndTs = monthEnd.getTime();
  const monthSessions = state.sessions
    .filter((s) => s.startTs >= monthStartTs && s.startTs < monthEndTs)
    .filter(sessionMatchesToolbarFilters);

  const sessionsByDay = new Map();
  monthSessions.forEach(function (s) {
    const key = dateToInputValue(new Date(s.startTs));
    if (!sessionsByDay.has(key)) sessionsByDay.set(key, []);
    sessionsByDay.get(key).push(s);
  });

  const gridStart = startOfWeekMonday(monthStart);
  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const todayStr = dateToInputValue(new Date());
  let html = `<div class="planner-month__title">${escapeHtml(fmtMonthLabel(monthStart))}</div>`;
  html += '<div class="planner-month__grid">';
  dayNames.forEach(function (n) {
    html += `<div class="planner-month__head">${n}</div>`;
  });

  for (let i = 0; i < 42; i++) {
    const dayDate = addDays(gridStart, i);
    const key = dateToInputValue(dayDate);
    const inMonth = dayDate.getMonth() === monthStart.getMonth();
    const daySessions = (sessionsByDay.get(key) || []).sort((a, b) => a.startTs - b.startTs);
    const classes = ["planner-month__cell"];
    if (!inMonth) classes.push("planner-month__cell--muted");
    if (key === todayStr) classes.push("planner-month__cell--today");
    let body = `<div class="planner-month__dayNum">${dayDate.getDate()}</div>`;
    daySessions.slice(0, 3).forEach(function (s) {
      const t = new Date(s.startTs);
      body += `<div class="planner-month__session">${escapeHtml(pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + " " + getSessionMemberShortName(s))}</div>`;
    });
    if (daySessions.length > 3) {
      body += `<div class="planner-month__more">+${daySessions.length - 3} seans</div>`;
    }
    html += `<div class="${classes.join(" ")}" data-date="${key}" role="button" tabindex="0">${body}</div>`;
  }
  html += "</div>";
  els.plannerMonth.innerHTML = html;

  function drillDownToDay(dateStr) {
    if (!dateStr) return;
    ui.currentDay = makeLocalDate(dateStr, "00:00");
    ui.currentMonth = startOfMonth(ui.currentDay);
    ui.viewMode = "day";
    if (isMobilePlanner()) ui.dayDisplayMode = "list";
    saveUi();
    render();
  }

  els.plannerMonth.querySelectorAll(".planner-month__cell[data-date]").forEach(function (cell) {
    cell.addEventListener("click", function () {
      drillDownToDay(cell.dataset.date);
    });
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        drillDownToDay(cell.dataset.date);
      }
    });
  });
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
      if (canManageSessions()) {
        cell.addEventListener("click", () => {
          if (wh && minuteOfDay >= wh.startMin && minuteOfDay < wh.endMin) {
            openGroupSessionModal(null, { date: dStr, time: minutesToTime(minuteOfDay) });
          }
        });
      } else {
        cell.style.cursor = "default";
      }
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
        if (canManageSessions()) {
          cell.addEventListener("click", () => {
            if (wh && minuteOfDay >= wh.startMin && minuteOfDay < wh.endMin) {
              openGroupSessionModal(null, { date: dStr, time: minutesToTime(minuteOfDay) });
            }
          });
        } else {
          cell.style.cursor = "default";
        }
        grid.appendChild(cell);
      }
    }

    // events
    renderEvents({ startMin, slotMin, slotsCount: slots.length });
  }
}

function buildCellColumnLayout({ inWeek, staffGroups, startMin, slotMin }) {
  const sessionInMultiGroup = new Set();
  const cellItems = new Map();

  function addCellItem(cellKey, item) {
    if (!cellItems.has(cellKey)) cellItems.set(cellKey, []);
    cellItems.get(cellKey).push(item);
  }

  for (const [, group] of staffGroups.entries()) {
    if (group.sessions.length <= 1) continue;
    for (const sess of group.sessions) sessionInMultiGroup.add(sess.id);
    const d = new Date(group.startTs);
    const dayIdx = group.dayIdx;
    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((group.startTs - dayStartTs) / 60000);
    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    const cellKey = `${dayIdx}_${row}`;
    addCellItem(cellKey, {
      layoutKey: `g_${cellKey}_${normId(group.staffId)}`,
      staffId: group.staffId,
    });
  }

  for (const s of inWeek) {
    if (sessionInMultiGroup.has(s.id)) continue;
    const d = new Date(s.startTs);
    let dayIdx;
    if (ui.viewMode === "day") dayIdx = 0;
    else {
      dayIdx = Math.floor(
        (startOfDay(d).getTime() - startOfDay(ui.weekStart).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (dayIdx < 0 || dayIdx > 6) continue;
    }
    const dayStartTs = startOfDay(d).getTime();
    const startMinOfDay = Math.floor((s.startTs - dayStartTs) / 60000);
    const row = Math.floor((startMinOfDay - startMin) / slotMin);
    const cellKey = `${dayIdx}_${row}`;
    addCellItem(cellKey, {
      layoutKey: `s_${s.id}`,
      staffId: s.staffId,
    });
  }

  const layout = new Map();
  for (const [, items] of cellItems.entries()) {
    items.sort(function (a, b) {
      const na = (getStaffFullName(getStaffById(a.staffId)) || "").toLowerCase();
      const nb = (getStaffFullName(getStaffById(b.staffId)) || "").toLowerCase();
      return na.localeCompare(nb, "tr");
    });
    const cols = items.length;
    items.forEach(function (item, idx) {
      layout.set(item.layoutKey, { col: idx, cols: cols });
    });
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

  const readonly = !canManageSessions();
  const memberView = isMemberUser();

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
  if ((ui.plannerFilter || "").trim() || ui.filterStaffId || ui.filterRoomId) {
    inWeek = inWeek.filter(sessionMatchesToolbarFilters);
  }

  // Üye: aynı saatte mükerrer DB kaydı varsa tek kart göster
  if (isMemberUser()) {
    var slotMap = new Map();
    inWeek.forEach(function (s) {
      var key = String(s.startTs);
      var prev = slotMap.get(key);
      if (!prev || Number(s.id) > Number(prev.id)) slotMap.set(key, s);
    });
    inWeek = Array.from(slotMap.values());
  }

  const staffGroups = isMemberUser() ? new Map() : groupSessionsByStaffAndTime(inWeek);
  const cellColumnLayout = buildCellColumnLayout({ inWeek, staffGroups, startMin, slotMin });

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
    const layoutKey = `g_${cellKey}_${normId(group.staffId)}`;
    const layout = cellColumnLayout.get(layoutKey) || { col: 0, cols: 1 };
    const cols = layout.cols;
    const col = layout.col;

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
    const color = staffColor(group.staffId);
    const memberShortNames = group.sessions.map((sess) => getSessionMemberShortName(sess));

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);
    const fullTitle = canManageSessions()
      ? `${group.sessions.length} seans • ${getStaffFullName(staff)} • ${startTime}-${endTime}`
      : `${group.sessions.length} seans • ${getRoomById(group.roomId)?.name || "Oda"} • ${getStaffFullName(staff)} • ${startTime}-${endTime}`;
    const staffShort = fmtStaffLabelWithRoomRemaining(staff, group.roomId, group.startTs, group.endTs);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;
    if (readonly) ev.classList.add("event--readonly");

    const groupDeleteBtn = readonly
      ? ""
      : `<button class="event__deleteBtn" title="Tüm seansları iptal et" data-staff-id="${group.staffId}" data-start-ts="${group.startTs}" data-end-ts="${group.endTs}" data-room-id="${group.roomId}">🗑️</button>`;

    if (isCompact) {
      ev.innerHTML = `
        <div class="event__row event__row--single">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          ${groupDeleteBtn}
        </div>
        <div class="event__members">${memberShortNames.map((n) => escapeHtml(n)).join("<br>")}</div>
      `;
    } else {
      ev.innerHTML = `
        <div class="event__row event__row--head">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          ${groupDeleteBtn}
        </div>
        <div class="event__members">${memberShortNames.map((n) => escapeHtml(n)).join("<br>")}</div>
      `;
    }

    if (isStaffUser()) {
      appendStaffEventAttendance(ev, group.sessions);
      cell.appendChild(ev);
      for (const sess of group.sessions) {
        renderedSessionIds.add(sess.id);
      }
      continue;
    }
    
    const deleteBtn = ev.querySelector(".event__deleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await confirmAndDeleteStaffSessionGroup(group);
      });
    }

    if (!readonly) {
      ev.addEventListener("click", (e) => {
        if (e.target.closest(".event__deleteBtn")) return;
        e.stopPropagation();
        handleMobileEventTap(ev, function () { openGroupSessionModal(group); });
      });
    } else if (isMobilePlanner()) {
      ev.addEventListener("click", function (e) {
        if (e.target.closest(".event__deleteBtn")) return;
        e.stopPropagation();
        handleMobileEventTap(ev, null);
      });
    }

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
    const layoutKeySingle = `s_${s.id}`;
    const layout = cellColumnLayout.get(layoutKeySingle) || { col: 0, cols: 1 };
    const cols = layout.cols;
    const col = layout.col;

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

    const member = getMemberById(getSessionMemberId(s));
    const staff = getStaffById(s.staffId);
    const color = staffColor(s.staffId);

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);
    const fullTitle = canManageSessions()
      ? `${getSessionMemberDisplayName(s)} • ${getStaffFullName(staff)} • ${startTime}-${endTime}`
      : `${getSessionMemberDisplayName(s)} • ${getRoomById(s.roomId)?.name || "Oda"} • ${getStaffFullName(staff)} • ${startTime}-${endTime}`;
    const staffShort = fmtStaffLabelWithRoomRemaining(staff, s.roomId, s.startTs, s.endTs);
    const memberShort = getSessionMemberShortName(s);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;
    if (readonly || memberView) ev.classList.add("event--readonly");

    const singleDeleteBtnHtml = showSessionDeleteBtn(s)
      ? `<button class="event__deleteBtn" title="Seansı iptal et" data-session-id="${s.id}" type="button">🗑️</button>`
      : "";

    if (isCompact) {
      ev.innerHTML = `
        <div class="event__row event__row--single">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          ${singleDeleteBtnHtml}
        </div>
        <div class="event__members">${escapeHtml(memberShort)}</div>
      `;
    } else {
      ev.innerHTML = `
        <div class="event__row event__row--head">
          <div class="event__title" title="${escapeHtml(fullTitle)}">${escapeHtml(staffShort)}</div>
          ${singleDeleteBtnHtml}
        </div>
        <div class="event__members">${escapeHtml(memberShort)}</div>
      `;
    }

    const singleDeleteBtn = ev.querySelector(".event__deleteBtn");
    if (singleDeleteBtn) {
      singleDeleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!(await showAppConfirm("Bu seansı iptal etmek istediğinize emin misiniz?"))) return;
        const id = singleDeleteBtn.dataset.sessionId;
        if (isMemberUser()) {
          try {
            await cancelMemberSessionById(Number(id));
          } catch (err) {
            await showAppAlert((err.data && err.data.error) || err.message || "Seans iptal edilemedi.");
          }
          return;
        }
        if (window.API && window.API.getToken()) {
          try {
            var delPwd = await resolveAdminPasswordForSessions(
              [state.sessions.find(function (x) { return normId(x.id) === normId(id); })],
              "Girişi onaylanmış seansı silmek için admin şifrenizi girin."
            );
            if (delPwd.cancelled) return;
            await window.API.deleteSession(id, delPwd.adminPassword ? { adminPassword: delPwd.adminPassword } : undefined);
            removeSessionFromState(id);
          } catch (err) {
            console.error("Seans silinemedi:", err);
            await showAppAlert("Seans silinemedi: " + (err?.data?.error || err?.message || "Bilinmeyen hata"));
            if (window.API.getSessions) {
              try {
                await refreshSessionsInLoadedRange();
              } catch (_) {}
            }
            render();
            return;
          }
        } else {
          state.sessions = state.sessions.filter(x => normId(x.id) !== normId(id));
        }
        render();
      });
    }

    if (isStaffUser()) {
      appendStaffEventAttendance(ev, [s]);
      cell.appendChild(ev);
      continue;
    }

    if (!readonly && !memberView) {
      ev.addEventListener("click", (e) => {
        if (e.target.closest(".event__deleteBtn")) return;
        e.stopPropagation();
        const group = getGroupForSession(s);
        handleMobileEventTap(ev, function () { openGroupSessionModal(group); });
      });
    } else if (isMobilePlanner()) {
      ev.addEventListener("click", function (e) {
        if (e.target.closest(".event__deleteBtn")) return;
        e.stopPropagation();
        handleMobileEventTap(ev, null);
      });
    }

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
      <div class="listItem__left">
        <div class="listItem__title">${escapeHtml(r.name)}</div>
        <div class="listItem__meta">Alet sayısı</div>
      </div>
      <div class="listItem__actions">
        <input class="input" type="number" min="1" step="1" value="${r.devices}" aria-label="Alet sayısı" data-room-id="${r.id}" />
        <button class="btn btn--xs btn--ghost" type="button" data-room-id="${r.id}">Sil</button>
      </div>
    `;
    const input = item.querySelector("input");
    const deleteBtn = item.querySelector("button");

    input.addEventListener("change", () => {
      const v = clamp(Number(input.value || 1), 1, 999);
      r.devices = v;
      updateRoomsSummary();
      render(); // kapasite değişti
    });

    deleteBtn.addEventListener("click", async () => {
      // Bu odaya bağlı seanslar var mı kontrol et
      const hasSessions = state.sessions.some((s) => s.roomId === r.id);
      if (hasSessions) {
        if (!(await showAppConfirm(`"${r.name}" odasına bağlı seanslar var. Yine de silmek istiyor musunuz?`))) return;
      }
      state.rooms = state.rooms.filter((x) => x.id !== r.id);
      updateRoomsSummary();
      renderRooms(); // Modal içindeki listeyi yenile
      render(); // Ana görünümü yenile
    });

    wrap.appendChild(item);
  }
}

function prepareRoomsPanel() {
  if (!els.roomsError) return;
  els.roomsError.classList.add("hidden");
  renderRooms();
  if (els.newRoomName) els.newRoomName.value = "";
  if (els.newRoomDevices) els.newRoomDevices.value = "1";
}

function openRoomsModal() {
  openAdminHubModal("rooms");
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
      <td class="packagesTable__name">${escapeHtml(p.name)}</td>
      <td class="packagesTable__stat" data-label="Ders adet">${Number(p.lessonCount ?? p.lesson_count ?? 0)}</td>
      <td class="packagesTable__stat" data-label="Ay aşım süresi">${Number(p.monthOverrun ?? p.month_overrun ?? 0)}</td>
      <td class="packagesTable__actions" colspan="2">
        <button class="btn btn--xs btn--ghost" type="button" data-package-edit="${p.id}" title="Düzelt">✎</button>
        <button class="btn btn--xs btn--ghost" type="button" data-package-delete="${p.id}" title="Sil">✕</button>
      </td>
    `;
    tr.querySelector("[data-package-edit]").addEventListener("click", () => editPackage(p.id));
    tr.querySelector("[data-package-delete]").addEventListener("click", () => deletePackage(p.id));
    els.packagesList.appendChild(tr);
  }
}

function preparePackagesPanel() {
  editingPackageId = null;
  clearPackageForm();
  if (els.packagesFormError) els.packagesFormError.classList.add("hidden");
  renderPackages();
}

function openPackagesModal() {
  openAdminHubModal("packages");
}

var devResetMeta = null;
var devResetPreviewTimer = null;

function openActivityLogsPage() {
  window.open("./activity-logs.html", "_blank", "noopener,noreferrer");
}

function openActivityLogsModal() {
  openActivityLogsPage();
}

function updateDevResetVisibility() {
  var isAdmin = isAdminUser();
  if (els.openDevResetBtn) {
    els.openDevResetBtn.classList.toggle("hidden", !isAdmin);
  }
  if (els.openDevSeedBtn) {
    els.openDevSeedBtn.classList.toggle("hidden", !isAdmin);
  }
  if (els.adminHubDevResetNav) {
    els.adminHubDevResetNav.classList.toggle("hidden", !isAdmin);
  }
  if (els.adminHubDevSeedNav) {
    els.adminHubDevSeedNav.classList.toggle("hidden", !isAdmin);
  }
}

function isAdminUser() {
  return !!(ui.currentUser && ui.currentUser.role === "admin");
}

function isStaffUser() {
  return !!(ui.currentUser && ui.currentUser.role === "staff");
}

function isMemberUser() {
  return !!(ui.currentUser && ui.currentUser.role === "member");
}

function canManageSessions() {
  return isAdminUser();
}


/** Üye iptal uygunluğu — backend sessionToDto.canCancel esas (MP-12). */
function memberCanCancelSession(session) {
  if (!isMemberUser() || !session) return false;
  if (typeof session.canCancel === "boolean") return session.canCancel;
  var ap = ui.memberPortal && ui.memberPortal.activePackage;
  if (ap && ap.sessions) {
    var hit = ap.sessions.find(function (s) {
      return normId(s.id) === normId(session.id);
    });
    if (hit && typeof hit.canCancel === "boolean") return hit.canCancel;
  }
  return false;
}

function showSessionDeleteBtn(session) {
  if (canManageSessions()) return true;
  return memberCanCancelSession(session);
}

async function confirmAndDeleteStaffSessionGroup(group) {
  if (!group || !canManageSessions()) return false;
  const staff = getStaffById(group.staffId);
  const staffName = getStaffFullName(staff);
  const sessionCount = (group.sessions || []).length;
  if (
    !(await showAppConfirm(
      staffName +
        " personelinin bu saatteki " +
        sessionCount +
        " seansını iptal etmek istediğinize emin misiniz?"
    ))
  ) {
    return false;
  }
  const toRemove = state.sessions.filter(function (s) {
    return (
      normId(s.staffId) === normId(group.staffId) &&
      overlaps(s.startTs, s.endTs, group.startTs, group.endTs)
    );
  });
  if (window.API && window.API.getToken()) {
    try {
      var bulkPwd = await resolveAdminPasswordForSessions(
        toRemove,
        "Girişi onaylanmış seans(lar)ı silmek için admin şifrenizi girin."
      );
      if (bulkPwd.cancelled) return false;
      for (const sess of toRemove) {
        await window.API.deleteSession(
          sess.id,
          bulkPwd.adminPassword ? { adminPassword: bulkPwd.adminPassword } : undefined
        );
      }
      removeSessionsFromState(toRemove.map(function (s) { return s.id; }));
    } catch (err) {
      console.error("Seanslar silinemedi:", err);
      await showAppAlert("Seanslar silinemedi: " + (err?.data?.error || err?.message || "Bilinmeyen hata"));
      if (window.API.getSessions) {
        try {
          await refreshSessionsInLoadedRange();
        } catch (_) {}
      }
      render();
      return false;
    }
  } else {
    const idsToRemove = new Set(toRemove.map(function (s) { return normId(s.id); }));
    state.sessions = state.sessions.filter(function (x) { return !idsToRemove.has(normId(x.id)); });
  }
  render();
  return true;
}

function resolveUserProfile(u) {
  if (!u || !u.id) {
    return { name: "Seans Planlayıcı", email: "—", phone: "—" };
  }
  var name = (u.fullName || "").trim();
  var phone = u.phone || "";
  if (u.staffId && state.staff && state.staff.length) {
    var s = getStaffById(u.staffId);
    if (s) {
      var staffName = getStaffFullName(s);
      if (!name || name === u.username || name === u.email || name.indexOf("@") >= 0) {
        name = staffName;
      }
      if (!phone && s.phone) phone = s.phone;
    }
  }
  if (u.role === "admin" && (!name || name === u.username || name === "Admin")) {
    name = (u.fullName || "").trim() || "Admin";
  }
  if (u.memberId && ui.memberPortal && ui.memberPortal.profile) {
    var mp = ui.memberPortal.profile;
    if (!name || name === u.username || name.indexOf("@") >= 0) {
      name = mp.fullName || ((mp.firstName || "") + " " + (mp.lastName || "")).trim() || name;
    }
    if (!phone && mp.phone) phone = mp.phone;
  }
  if (!name) name = u.username || "—";
  return {
    name: name,
    email: u.email || "—",
    phone: phone || "—",
  };
}

function syncCurrentUserProfile() {
  if (!ui.currentUser) return;
  var profile = resolveUserProfile(ui.currentUser);
  ui.currentUser.fullName = profile.name;
  if (profile.phone !== "—") ui.currentUser.phone = profile.phone;
}

function updateUserBranding() {
  syncCurrentUserProfile();
  var profile = resolveUserProfile(ui.currentUser || {});
  if (els.topbarBrand) {
    if (isMemberUser()) {
      els.topbarBrand.textContent = "Seans Planlayıcı";
      els.topbarBrand.title = "";
    } else if (ui.currentUser && isAdminMobilePanel()) {
      var shortName = ui.currentUser.staffId
        ? getStaffShortName(getStaffById(ui.currentUser.staffId))
        : fmtPersonShortName(profile.name);
      els.topbarBrand.textContent = shortName;
      els.topbarBrand.title = profile.name;
    } else {
      els.topbarBrand.textContent = ui.currentUser ? profile.name : "Seans Planlayıcı";
      els.topbarBrand.title = "";
    }
  }
  if (els.memberHomeName) {
    var mp = ui.memberPortal && ui.memberPortal.profile;
    els.memberHomeName.textContent = (mp && mp.fullName) || profile.name || "Üye";
  }
  if (els.memberProfileBtn && isMemberUser()) {
    var mp = ui.memberPortal && ui.memberPortal.profile;
    var label = (mp && mp.fullName) || profile.name || "Profil";
    var short = label.trim().split(/\s+/)[0] || "Profil";
    els.memberProfileBtn.textContent = short;
    els.memberProfileBtn.title = label + " — Profilim";
  }
  updateMemberSessionsBtn();
}

function updateMemberSessionsBtn() {
  if (!els.memberSessionsBtn) return;
  if (!isMemberUser()) {
    els.memberSessionsBtn.classList.add("hidden");
    return;
  }
  var ap = ui.memberPortal && ui.memberPortal.activePackage;
  if (!ap) {
    els.memberSessionsBtn.classList.add("hidden");
    return;
  }
  els.memberSessionsBtn.classList.remove("hidden");
  var pkgName = ap.packageName || "Paket";
  els.memberSessionsBtn.title = pkgName + " — tüm seansları listele";
  els.memberSessionsBtn.classList.toggle(
    "topbar__sessionsBtn--active",
    ui.memberCalendarPackageId != null && normId(ui.memberCalendarPackageId) === normId(ap.id)
  );
}

function openMemberActivePackageSessions() {
  if (!isMemberUser() || !ui.memberPortal || !ui.memberPortal.activePackage) return;
  showMemberPackageSessionsOnCalendar(ui.memberPortal.activePackage);
}

var sessionSyncTimer = null;
var sessionSyncBound = false;
var sessionsSyncInFlight = null;
var SESSION_SYNC_INTERVAL_MS = 60000;
var STALE_SESSION_MSG = "Bu seans artık geçerli değil (üye iptal etmiş veya silinmiş olabilir). Takvim güncellendi.";

function mergeSessionsIntoState(incoming) {
  if (!incoming || !incoming.length) return false;
  var map = new Map(state.sessions.map(function (s) { return [normId(s.id), s]; }));
  var changed = false;
  incoming.forEach(function (s) {
    var id = normId(s.id);
    var prev = map.get(id);
    if (!prev || prev.startTs !== s.startTs || normId(prev.staffId) !== normId(s.staffId) || normId(prev.memberId) !== normId(s.memberId) || normId(prev.roomId) !== normId(s.roomId)) {
      changed = true;
    }
    map.set(id, s);
  });
  state.sessions = Array.from(map.values()).sort(function (a, b) { return a.startTs - b.startTs; });
  return changed;
}

async function ensureDaySessionsLoaded(dateStr) {
  if (!dateStr || !window.API || !window.API.getToken() || !window.API.getSessions) return;
  if (isRangeWithinLoaded(dateStr, dateStr)) return;
  await fetchAndMergeSessions(dateStr, dateStr);
}

/** Sunucudan seans listesini çeker; başka kullanıcı/üye değişikliklerinde takvimi günceller. */
async function syncSessionsFromServer(opts) {
  opts = opts || {};
  if (!window.API || !window.API.getToken() || !window.API.getSessions) return false;
  if (!ui.currentUser) return false;
  if (isMemberUser()) return false;
  var mainApp = document.getElementById("mainApp");
  if (mainApp && mainApp.classList.contains("app--booting")) return false;
  if (sessionsSyncInFlight) return sessionsSyncInFlight;
  sessionsSyncInFlight = (async function () {
    try {
      if (!sessionsLoadedRange.startDate) await ensurePlannerSessionsLoaded();
      var syncRange = sessionsLoadedRange.startDate
        ? { startDate: sessionsLoadedRange.startDate, endDate: sessionsLoadedRange.endDate }
        : getPlannerFetchRange();
      var bounds = sessionRangeBounds(syncRange.startDate, syncRange.endDate);
      var prevInRange = state.sessions.filter(function (s) {
        return s.startTs >= bounds.startTs && s.startTs <= bounds.endTs;
      });
      var prevIds = new Set(prevInRange.map(function (s) { return normId(s.id); }));
      var fresh = await window.API.getSessions(syncRange.startDate, syncRange.endDate);
      var changed = fresh.length !== prevInRange.length;
      if (!changed) {
        for (var i = 0; i < fresh.length; i++) {
          var f = fresh[i];
          var old = prevInRange.find(function (s) { return normId(s.id) === normId(f.id); });
          if (!old || old.startTs !== f.startTs || normId(old.staffId) !== normId(f.staffId) || normId(old.memberId) !== normId(f.memberId)) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) {
        for (var j = 0; j < prevInRange.length; j++) {
          if (!fresh.some(function (f) { return normId(f.id) === normId(prevInRange[j].id); })) {
            changed = true;
            break;
          }
        }
      }
      replaceSessionsInDateRange(syncRange.startDate, syncRange.endDate, fresh);
      if (changed) {
        render();
      }
      if (!opts.silent && changed && prevIds.size > 0) {
        var hadRemoval = false;
        prevIds.forEach(function (id) {
          if (!fresh.some(function (f) { return normId(f.id) === id; })) hadRemoval = true;
        });
        if (hadRemoval && els.weekLabel) {
          var hint = document.getElementById("sessionSyncHint");
          if (!hint) {
            hint = document.createElement("div");
            hint.id = "sessionSyncHint";
            hint.className = "session-sync-hint";
            hint.textContent = "Takvim güncellendi (başka bir kullanıcı değişiklik yaptı).";
            if (els.plannerHeader && els.plannerHeader.parentNode) {
              els.plannerHeader.parentNode.insertBefore(hint, els.plannerHeader.nextSibling);
            }
          }
          hint.classList.remove("hidden");
          clearTimeout(hint._hideTimer);
          hint._hideTimer = setTimeout(function () { hint.classList.add("hidden"); }, 6000);
        }
      }
      return true;
    } catch (e) {
      return false;
    } finally {
      sessionsSyncInFlight = null;
    }
  })();
  return sessionsSyncInFlight;
}

function onSessionSyncVisibility() {
  if (document.visibilityState !== "visible") return;
  if (isMemberUser()) {
    refreshMemberPortal();
    return;
  }
  syncSessionsFromServer({ silent: true });
}

function startSessionAutoSync() {
  stopSessionAutoSync();
  if (!ui.currentUser || !window.API) return;
  if (!sessionSyncBound) {
    document.addEventListener("visibilitychange", onSessionSyncVisibility);
    window.addEventListener("focus", onSessionSyncVisibility);
    sessionSyncBound = true;
  }
  sessionSyncTimer = setInterval(function () {
    if (document.visibilityState !== "visible") return;
    if (isMemberUser()) {
      refreshMemberPortal();
      return;
    }
    if (isStaffUser()) {
      refreshStaffShiftReminder();
    }
    if (window.API.getSessions) syncSessionsFromServer({ silent: true });
  }, SESSION_SYNC_INTERVAL_MS);
}

function stopSessionAutoSync() {
  if (sessionSyncTimer) {
    clearInterval(sessionSyncTimer);
    sessionSyncTimer = null;
  }
}

function updateSidebarForRole() {
  var isAdmin = isAdminUser();
  var isStaff = isStaffUser();
  var isMember = isMemberUser();
  updateDevResetVisibility();
  if (els.sidebarStaffSettings) {
    els.sidebarStaffSettings.classList.add("hidden");
  }
  if (els.sidebarMembersPanel) {
    els.sidebarMembersPanel.classList.toggle("hidden", isStaff || isMember);
  }
  if (els.sidebarRequestsPanel) {
    els.sidebarRequestsPanel.classList.toggle("hidden", isStaff || isMember || !isAdmin);
  }
  if (els.sidebarMemberPanel) {
    els.sidebarMemberPanel.classList.add("hidden");
  }
  if (els.sidebarAdminFooter) {
    els.sidebarAdminFooter.classList.toggle("hidden", !isAdmin && !isStaff);
  }
  if (els.openAdminHubBtn) {
    els.openAdminHubBtn.classList.toggle("hidden", !isAdmin && !isStaff);
  }
  if (els.logoutBtn) {
    els.logoutBtn.classList.toggle("hidden", isAdmin || isStaff || isMember);
  }
  var staffHiddenTopbar = [els.addSessionBtn, els.printBtn];
  staffHiddenTopbar.forEach(function (el) {
    if (el) el.classList.toggle("hidden", isStaff || isMember);
  });
  if (els.topbarActionsMenuWrap) {
    els.topbarActionsMenuWrap.classList.toggle("hidden", isStaff || isMember || (isAdmin && isAdminMobilePanel()));
  }
  var topbarEl = document.querySelector(".topbar");
  if (topbarEl) {
    topbarEl.classList.toggle("topbar--has-actions", isAdmin && !isStaff && !isMember);
  }
  if (els.exportDropdown && (isStaff || isMember)) els.exportDropdown.classList.add("hidden");
  if (els.plannerFiltersWrap) {
    els.plannerFiltersWrap.classList.toggle("hidden", isMember || isAdminMobilePanel());
  }
  if (els.memberProfileBtn) {
    els.memberProfileBtn.classList.toggle("hidden", true);
  }
  if (els.memberSessionsBtn && !isMember) {
    els.memberSessionsBtn.classList.add("hidden");
  }
  if (els.sidebarAdminEntryPanel) {
    els.sidebarAdminEntryPanel.classList.toggle("hidden", !isAdminUser());
  }
  if (isStaff) startStaffAttendancePoll();
  else stopStaffAttendancePoll();
  if (els.sidebarMenuBtn) {
    els.sidebarMenuBtn.classList.toggle("hidden", isMember || (isAdminMobilePanel() && (isAdminUser() || isStaffUser())));
  }
  if (els.sidebarShell) {
    els.sidebarShell.classList.toggle("hidden", isMember);
    els.sidebarShell.removeAttribute("title");
    if (isMember) {
    els.sidebarShell.classList.remove("sidebar-shell--expanded");
    } else if (isSidebarDesktopRailMode()) {
      initSidebarDesktopExpanded();
    } else {
      els.sidebarShell.classList.remove("sidebar-shell--expanded");
      if (els.sidebarDesktopToggleBtn) els.sidebarDesktopToggleBtn.classList.add("hidden");
    }
  }
  if (isMember) closeSidebar();
  if (els.mainContent) {
    els.mainContent.classList.toggle("content--member-full", isMember);
  }
  if (topbarEl) {
    topbarEl.classList.toggle("topbar--member", isMember);
  }
  var mainApp = document.getElementById("mainApp");
  if (mainApp) {
    mainApp.classList.toggle("app--member-portal", isMember);
  }
  updateAdminMobileTopbarClass();
  if (isMember) {
    if (!ui.memberTab || ui.memberTab === "calendar") ui.memberTab = "home";
    ui.viewMode = "day";
    renderMemberProfileContent();
    updateMemberTabUI();
  } else {
    ui.memberTab = "home";
    updateMemberTabUI();
  }
  updateUserBranding();
  updateAdminHubNavVisibility();
}

function applyMemberPortalState(loaded) {
  if (!loaded) return;
  ui.memberPortal = loaded.dashboard || null;
  state.settings = loaded.settings || state.settings;
  state.workingHours = loaded.workingHours || state.workingHours;
  state.rooms = loaded.rooms || [];
  state.staff = loaded.staff || [];
  state.members = loaded.members || [];
  state.sessions = loaded.sessions || [];
  state.packages = [];
  state.memberPackages = [];
  if (isMemberUser()) renderMemberPortalPackageSummaries();
}

function renderMemberPackagesInto(pastEl, notifEl) {
  if (!isMemberUser() || !ui.memberPortal) return;
  var portal = ui.memberPortal;
  if (notifEl) {
    notifEl.innerHTML = "";
    (portal.notifications || []).forEach(function (n) {
      var div = document.createElement("div");
      div.className = "member-notification";
      div.textContent = n.message || "";
      notifEl.appendChild(div);
    });
    notifEl.classList.toggle("hidden", !(portal.notifications || []).length);
  }
  if (pastEl) {
    renderMemberPastPackagesContainer(pastEl, portal.pastPackages || [], {
      emptyText: "Eski paket yok.",
      itemClass: "member-past-package-btn",
    });
  }
}

function setMemberProfileSection(section) {
  var allowed = { past: true, account: true };
  ui.memberProfileSection = allowed[section] ? section : "account";
  document.querySelectorAll("[data-member-profile-panel]").forEach(function (panel) {
    var show = panel.getAttribute("data-member-profile-panel") === ui.memberProfileSection;
    panel.classList.toggle("hidden", !show);
  });
  document.querySelectorAll("[data-member-profile-section]").forEach(function (btn) {
    var on = btn.getAttribute("data-member-profile-section") === ui.memberProfileSection;
    btn.classList.toggle("member-profile-nav__btn--active", on);
  });
}

function fillMemberProfileModal() {
  if (!ui.memberPortal) return;
  var p = ui.memberPortal.profile || {};
  if (els.memberProfileSidebarName) els.memberProfileSidebarName.textContent = p.fullName || "—";
  if (els.memberProfileName) els.memberProfileName.textContent = p.fullName || "—";
  if (els.memberProfileEmail) els.memberProfileEmail.textContent = p.email || "—";
  if (els.memberProfilePhone) els.memberProfilePhone.textContent = p.phone || "—";
  if (els.memberInlineProfileName) els.memberInlineProfileName.textContent = p.fullName || "—";
  if (els.memberInlineProfileEmail) els.memberInlineProfileEmail.textContent = p.email || "—";
  if (els.memberInlineProfilePhone) els.memberInlineProfilePhone.textContent = p.phone || "—";
  updateMemberDeletionRequestUI();
  renderMemberPackagesInto(els.memberProfilePastPackages, els.memberProfileNotifications);
  updateMemberSessionsBtn();
  setMemberProfileSection(ui.memberProfileSection);
}

function updateMemberDeletionRequestUI() {
  var p = ui.memberPortal && ui.memberPortal.profile ? ui.memberPortal.profile : {};
  var pending = !!p.deletionRequestedAt;
  if (els.memberDeletionRequestNotice) {
    if (pending) {
      els.memberDeletionRequestNotice.textContent =
        "Üyelik iptal talebiliniz iletilmiştir. Onaylandıktan sonra bilgilendirileceksiniz.";
      els.memberDeletionRequestNotice.classList.remove("hidden");
    } else {
      els.memberDeletionRequestNotice.textContent = "";
      els.memberDeletionRequestNotice.classList.add("hidden");
    }
  }
  if (els.memberInlineDeleteAccountBtn) {
    els.memberInlineDeleteAccountBtn.disabled = pending;
    var descEl = els.memberInlineDeleteAccountBtn.querySelector(".member-settings-row__desc");
    if (descEl) {
      descEl.textContent = pending ? "Talebiniz inceleniyor" : "Hesabımı kalıcı olacak silin";
    }
  }
}

async function requestMemberAccountDeletion() {
  if (!window.API || !window.API.requestMemberAccountDeletion) {
    await showAppAlert("Bu işlem yalnızca sunucu bağlantısı ile çalışır.");
    return;
  }
  var p = ui.memberPortal && ui.memberPortal.profile;
  if (p && p.deletionRequestedAt) {
    updateMemberDeletionRequestUI();
    return;
  }
  if (
    !(await showAppConfirm(
      "Üyeliğinizi iptal etmek istediğinize emin misiniz?\n\nTalebiniz yönetici onayına iletilecektir.",
      {
        title: "Hesabımı sil",
        okLabel: "Talep Gönder",
        okClass: "btn--danger",
        compactDialog: true,
      }
    ))
  ) {
    return;
  }
  try {
    var result = await window.API.requestMemberAccountDeletion();
    if (ui.memberPortal && ui.memberPortal.profile) {
      ui.memberPortal.profile.deletionRequestedAt =
        (result && result.deletionRequestedAt) || new Date().toISOString();
    }
    updateMemberDeletionRequestUI();
    renderMemberNotificationsBanner();
    if (els.memberDeletionRequestNotice) {
      els.memberDeletionRequestNotice.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Talep iletilemedi.");
  }
}

function updateMemberDeletionRequestBanner(m) {
  if (!els.memberDeletionRequestBanner) return;
  var pending = !!(m && m.deletionRequestedAt);
  var show = pending && isAdminUser();
  els.memberDeletionRequestBanner.classList.toggle("hidden", !show);
}

async function approveMemberDeletionRequest(memberId) {
  if (!memberId || !window.API || !window.API.approveMemberDeletionRequest) return;
  if (!(await showAppConfirm("Üyelik iptal talebini onaylayıp üyeyi listeden kaldırmak istiyor musunuz?"))) return;
  try {
    await window.API.approveMemberDeletionRequest(memberId);
    var fetchRange = getPlannerFetchRange();
    var loaded = await window.API.loadFullState(fetchRange);
    applyStateFromApi(loaded, fetchRange);
    closeMemberCardModal();
    closeRequestsSubPanel();
    if (isAdminMembersListViewActive()) await openListMembersModal();
    else render();
    await refreshAdminDeletionRequests();
    await showAppAlert("Üyelik iptali onaylandı.");
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Onaylama başarısız.");
  }
}

async function rejectMemberDeletionRequest(memberId) {
  if (!memberId || !window.API || !window.API.rejectMemberDeletionRequest) return;
  if (!(await showAppConfirm("Üyelik iptal talebini reddetmek istiyor musunuz?"))) return;
  try {
    await window.API.rejectMemberDeletionRequest(memberId);
    var fetchRange = getPlannerFetchRange();
    var loaded = await window.API.loadFullState(fetchRange);
    applyStateFromApi(loaded, fetchRange);
    var cardOpenForMember = els.memberCardModal &&
      !els.memberCardModal.classList.contains("hidden") &&
      normId(ui.editingMemberId) === normId(memberId);
    if (cardOpenForMember) {
      openMemberCard(memberId);
    } else {
      closeRequestsSubPanel();
      if (isAdminMembersListViewActive()) await openListMembersModal();
    }
    render();
    await refreshAdminDeletionRequests();
    await showAppAlert("Üyelik iptal talebi reddedildi.");
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Reddetme başarısız.");
  }
}

function memberDeletionBadgeHtml(m) {
  if (!m || !m.deletionRequestedAt) return "";
  return '<span class="list-members-table__deletion-badge">İptal talebi</span>';
}

function renderMemberNotificationsBanner() {
  if (!els.memberNotificationsBanner || !isMemberUser() || !ui.memberPortal) {
    if (els.memberNotificationsBanner) {
      els.memberNotificationsBanner.classList.add("hidden");
      els.memberNotificationsBanner.innerHTML = "";
    }
    return;
  }
  var notes = (ui.memberPortal.notifications || []).filter(function (n) {
    return n.type !== "package_request_pending";
  });
  if (!notes.length) {
    els.memberNotificationsBanner.classList.add("hidden");
    els.memberNotificationsBanner.innerHTML = "";
    return;
  }
  els.memberNotificationsBanner.innerHTML = "";
  notes.forEach(function (n) {
    var div = document.createElement("div");
    div.className = "member-notification";
    div.textContent = n.message || "";
    els.memberNotificationsBanner.appendChild(div);
  });
  els.memberNotificationsBanner.classList.remove("hidden");
}

function renderMemberPackageRequestEmptyState(ap) {
  var pending = ui.memberPortal && ui.memberPortal.pendingPackageRequest;
  var noActive = !ap;
  var showCta = noActive && !pending;
  var showPending = noActive && !!pending;
  var showPlainEmpty = !!ap;

  if (els.memberUpcomingSessionsEmpty) {
    els.memberUpcomingSessionsEmpty.classList.toggle("hidden", !showPlainEmpty);
  }
  if (els.memberPackageRequestCta) {
    els.memberPackageRequestCta.classList.toggle("hidden", !showCta);
  }
  if (els.memberPackageRequestPending) {
    els.memberPackageRequestPending.classList.toggle("hidden", !showPending);
  }
  if (showPending && els.memberPackageRequestPendingText) {
    var pkgName = pending.packageName || "Seçilen paket";
    els.memberPackageRequestPendingText.textContent =
      "«" + pkgName + "» paket talebiniz alındı. Yönetici onayından sonra bilgilendirileceksiniz.";
  }
}

function openMemberPackageRequestModal() {
  if (!ui.memberPortal) return;
  var catalog = ui.memberPortal.catalogPackages || [];
  if (els.memberPackageRequestSelect) {
    els.memberPackageRequestSelect.innerHTML =
      '<option value="">Seçiniz</option>' +
      catalog.map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.name || "") + "</option>";
      }).join("");
  }
  if (els.memberPackageRequestError) {
    els.memberPackageRequestError.classList.add("hidden");
    els.memberPackageRequestError.textContent = "";
  }
  if (els.memberPackageRequestModal) els.memberPackageRequestModal.classList.remove("hidden");
}

async function submitMemberPackageRequestFromModal() {
  if (!window.API || !window.API.createMemberPackageRequest) return;
  var packageId = els.memberPackageRequestSelect && els.memberPackageRequestSelect.value
    ? parseInt(els.memberPackageRequestSelect.value, 10)
    : null;
  if (!packageId) {
    if (els.memberPackageRequestError) {
      els.memberPackageRequestError.textContent = "Lütfen bir paket seçin.";
      els.memberPackageRequestError.classList.remove("hidden");
    }
    return;
  }
  try {
    var result = await window.API.createMemberPackageRequest(packageId);
    if (els.memberPackageRequestModal) els.memberPackageRequestModal.classList.add("hidden");
    var loaded = await window.API.loadMemberPortalState();
    applyMemberPortalState(loaded);
    if (ui.memberPortal) {
      ui.memberPortal.pendingPackageRequest = {
        id: result.id,
        packageId: result.packageId || packageId,
        packageName: result.packageName,
        requestedAt: result.requestedAt,
      };
    }
    renderMemberHome();
    updateMemberTabUI();
    await showAppAlert(result.message || "Paket talebiniz iletildi.");
  } catch (e) {
    if (els.memberPackageRequestError) {
      els.memberPackageRequestError.textContent = (e.data && e.data.error) || e.message || "Talep iletilemedi.";
      els.memberPackageRequestError.classList.remove("hidden");
    }
  }
}

function fmtPackageRequestWhen(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function refreshAdminPackageRequests(markSeen) {
  if (!isAdminUser() || !window.API || !window.API.getPackageRequests) return;
  try {
    var rows = await window.API.getPackageRequests("pending");
    ui.packageRequests = Array.isArray(rows) ? rows : [];
    if (markSeen && ui.packageRequests.length && window.API.markPackageRequestsSeen) {
      await window.API.markPackageRequestsSeen(ui.packageRequests.map(function (r) { return r.id; }));
    }
    renderPackageRequestsSidebar();
    updateAdminRequestsNavBadges();
  } catch (e) {
    console.warn("Paket talepleri yüklenemedi:", e);
  }
}

function updateAdminRequestsNavBadges() {
  updatePackageRequestsNavBadge();
  updateCancellationRequestsNavBadge();
  updateAdminMobileMenuBadge();
}

function updatePackageRequestsNavBadge() {
  if (!els.packageRequestsNavBadge) return;
  var pending = (ui.packageRequests || []).length;
  if (pending > 0) {
    els.packageRequestsNavBadge.textContent = String(pending);
    els.packageRequestsNavBadge.classList.remove("hidden");
  } else {
    els.packageRequestsNavBadge.textContent = "";
    els.packageRequestsNavBadge.classList.add("hidden");
  }
}

function updateAdminMobileMenuBadge() {
  if (!els.adminMobileMenuBadge && !els.adminMobileSidebarBtn) return;
  var pending =
    (ui.packageRequests || []).length +
    (ui.deletionRequests || []).length;
  if (els.adminMobileMenuBadge) {
    els.adminMobileMenuBadge.classList.toggle("hidden", pending <= 0);
  }
  if (els.adminMobileSidebarBtn) {
    var label = ui.sidebarOpen ? "Menüyü kapat" : "Menüyü aç";
    if (pending > 0) {
      label += ", " + pending + " bekleyen talep";
    }
    els.adminMobileSidebarBtn.setAttribute("aria-label", label);
  }
}

function renderPackageRequestsSidebar() {
  if (!els.packageRequestsList) return;
  var rows = ui.packageRequests || [];
  if (els.packageRequestsEmpty) {
    els.packageRequestsEmpty.classList.toggle("hidden", rows.length > 0);
  }
  if (!rows.length) {
    els.packageRequestsList.innerHTML = "";
    return;
  }
  els.packageRequestsList.innerHTML = rows.map(function (r) {
    var member = escapeHtml(r.memberName || "Üye");
    var memberNo = r.memberNo ? " (" + escapeHtml(r.memberNo) + ")" : "";
    var pkg = escapeHtml(r.packageName || "Paket");
    var when = fmtPackageRequestWhen(r.requestedAt);
    return (
      '<div class="package-request-card" data-package-request-id="' + r.id + '">' +
      '<p class="package-request-card__member">' + member + memberNo + "</p>" +
      '<p class="package-request-card__pkg">«' + pkg + "»</p>" +
      (when ? '<p class="package-request-card__meta">' + when + "</p>" : "") +
      '<div class="package-request-card__actions">' +
      '<button type="button" class="btn btn--primary btn--xs" data-package-request-assign="' + r.id + '">Paket Tanımla</button>' +
      '<button type="button" class="btn btn--ghost btn--xs" data-package-request-dismiss="' + r.id + '">Kapat</button>' +
      "</div></div>"
    );
  }).join("");
  els.packageRequestsList.querySelectorAll("[data-package-request-assign]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      assignPackageFromRequest(parseInt(btn.getAttribute("data-package-request-assign"), 10));
    });
  });
  els.packageRequestsList.querySelectorAll("[data-package-request-dismiss]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      dismissPackageRequestById(parseInt(btn.getAttribute("data-package-request-dismiss"), 10));
    });
  });
}

function showPackageRequestsPanel() {
  if (els.sidebarRequestsPanel) els.sidebarRequestsPanel.classList.add("hidden");
  if (els.sidebarCancellationRequestsPanel) els.sidebarCancellationRequestsPanel.classList.add("hidden");
  if (els.sidebarPackageRequestsPanel) els.sidebarPackageRequestsPanel.classList.remove("hidden");
  ui.sidebarPackageRequestsOpen = true;
  ui.sidebarCancellationRequestsOpen = false;
  refreshAdminPackageRequests(true);
  if (SIDEBAR_DRAWER_MQ.matches) setSidebarOpen(true);
}

function showCancellationRequestsPanel() {
  if (els.sidebarRequestsPanel) els.sidebarRequestsPanel.classList.add("hidden");
  if (els.sidebarPackageRequestsPanel) els.sidebarPackageRequestsPanel.classList.add("hidden");
  if (els.sidebarCancellationRequestsPanel) els.sidebarCancellationRequestsPanel.classList.remove("hidden");
  ui.sidebarCancellationRequestsOpen = true;
  ui.sidebarPackageRequestsOpen = false;
  refreshAdminDeletionRequests();
  if (SIDEBAR_DRAWER_MQ.matches) setSidebarOpen(true);
}

function closeRequestsSubPanel() {
  if (els.sidebarPackageRequestsPanel) els.sidebarPackageRequestsPanel.classList.add("hidden");
  if (els.sidebarCancellationRequestsPanel) els.sidebarCancellationRequestsPanel.classList.add("hidden");
  if (els.sidebarRequestsPanel && isAdminUser() && !isStaffUser()) {
    els.sidebarRequestsPanel.classList.remove("hidden");
  }
  ui.sidebarPackageRequestsOpen = false;
  ui.sidebarCancellationRequestsOpen = false;
}

function closePackageRequestsPanel() {
  closeRequestsSubPanel();
}

async function refreshAdminDeletionRequests() {
  if (!isAdminUser() || !window.API || !window.API.getDeletionRequests) return;
  try {
    var rows = await window.API.getDeletionRequests();
    ui.deletionRequests = Array.isArray(rows) ? rows : [];
    renderCancellationRequestsSidebar();
    updateAdminRequestsNavBadges();
  } catch (e) {
    console.warn("İptal talepleri yüklenemedi:", e);
  }
}

function updateCancellationRequestsNavBadge() {
  if (!els.cancellationRequestsNavBadge) return;
  var count = (ui.deletionRequests || []).length;
  if (count > 0) {
    els.cancellationRequestsNavBadge.textContent = String(count);
    els.cancellationRequestsNavBadge.classList.remove("hidden");
  } else {
    els.cancellationRequestsNavBadge.textContent = "";
    els.cancellationRequestsNavBadge.classList.add("hidden");
  }
}

function renderCancellationRequestsSidebar() {
  if (!els.cancellationRequestsList) return;
  var rows = ui.deletionRequests || [];
  if (els.cancellationRequestsEmpty) {
    els.cancellationRequestsEmpty.classList.toggle("hidden", rows.length > 0);
  }
  if (!rows.length) {
    els.cancellationRequestsList.innerHTML = "";
    return;
  }
  els.cancellationRequestsList.innerHTML = rows.map(function (r) {
    var member = escapeHtml(r.memberName || "Üye");
    var memberNo = r.memberNo ? " (" + escapeHtml(r.memberNo) + ")" : "";
    var when = fmtPackageRequestWhen(r.deletionRequestedAt);
    var phone = r.phone ? escapeHtml(r.phone) : "";
    return (
      '<div class="package-request-card cancellation-request-card" data-deletion-request-member="' + r.id + '">' +
      '<p class="package-request-card__member">' + member + memberNo + "</p>" +
      (phone ? '<p class="package-request-card__pkg">' + phone + "</p>" : "") +
      (when ? '<p class="package-request-card__meta">Talep: ' + when + "</p>" : "") +
      '<div class="package-request-card__actions">' +
      '<button type="button" class="btn btn--danger btn--xs" data-deletion-request-approve="' + r.id + '">Onayla</button>' +
      '<button type="button" class="btn btn--ghost btn--xs" data-deletion-request-reject="' + r.id + '">Reddet</button>' +
      '<button type="button" class="btn btn--ghost btn--xs" data-deletion-request-card="' + r.id + '">Üye Kartı</button>' +
      "</div></div>"
    );
  }).join("");
  els.cancellationRequestsList.querySelectorAll("[data-deletion-request-approve]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      approveMemberDeletionRequest(parseInt(btn.getAttribute("data-deletion-request-approve"), 10));
    });
  });
  els.cancellationRequestsList.querySelectorAll("[data-deletion-request-reject]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      rejectMemberDeletionRequest(parseInt(btn.getAttribute("data-deletion-request-reject"), 10));
    });
  });
  els.cancellationRequestsList.querySelectorAll("[data-deletion-request-card]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var memberId = parseInt(btn.getAttribute("data-deletion-request-card"), 10);
      closeRequestsSubPanel();
      if (SIDEBAR_DRAWER_MQ.matches) setSidebarOpen(false);
      openMemberCard(memberId);
    });
  });
}

async function assignPackageFromRequest(requestId) {
  var req = (ui.packageRequests || []).find(function (r) { return Number(r.id) === Number(requestId); });
  if (!req) return;
  if (window.API && window.API.markPackageRequestsSeen) {
    await window.API.markPackageRequestsSeen([req.id]).catch(function () {});
  }
  closeRequestsSubPanel();
  if (SIDEBAR_DRAWER_MQ.matches) setSidebarOpen(false);
  openMemberPackageModal(req.memberId, null, { preselectPackageId: req.packageId });
  await refreshAdminPackageRequests(false);
}

async function dismissPackageRequestById(requestId) {
  if (!window.API || !window.API.dismissPackageRequest) return;
  if (!(await showAppConfirm("Bu paket talebini kapatmak istiyor musunuz? Paket tanımlanmadan talep listeden kaldırılır."))) return;
  try {
    await window.API.dismissPackageRequest(requestId);
    await refreshAdminPackageRequests(false);
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Talep kapatılamadı.");
  }
}

function renderMemberPackagesPanel() {
  if (!els.memberPastPackagesPanel || !ui.memberPortal) return;
  var portal = ui.memberPortal;
  els.memberPastPackagesPanel.innerHTML = "";

  var activeEl = document.createElement("div");
  activeEl.className = "member-package-card member-package-card--portal";
  renderMemberActivePackageInto(activeEl, portal.activePackage, { clickable: true });
  els.memberPastPackagesPanel.appendChild(activeEl);

  var past = portal.pastPackages || [];
  if (past.length) {
    var subTitle = document.createElement("h3");
    subTitle.className = "member-portal-panel__title member-portal-panel__title--sub";
    subTitle.textContent = "Bitmiş Paketler";
    els.memberPastPackagesPanel.appendChild(subTitle);
  }

  var pastWrap = document.createElement("div");
  pastWrap.className = "member-packages-stack";
  renderMemberPastPackagesContainer(pastWrap, past, {
    emptyText: "Bitmiş paket yok.",
    itemClass: "member-past-package-card",
  });
  els.memberPastPackagesPanel.appendChild(pastWrap);
}

var PACKAGE_SESSION_CANCEL_LOCK_MS = 2 * 60 * 60 * 1000;

function isPackageSessionCancelled(s) {
  return !!(s.isCancelled || s.status === "cancelled" || s.deletedAt || s.deleted_at);
}

function isPackageSessionConsumed(s, now) {
  now = now || Date.now();
  if (isPackageSessionCancelled(s)) return false;
  if (s.isConsumed === true) return true;
  if (s.checkedIn || s.checkedInAt) return true;
  if (s.attendanceOutcome === "no_show") return true;
  var startTs = Number(s.startTs);
  var endTs = Number(s.endTs);
  if (now > endTs && now >= startTs - PACKAGE_SESSION_CANCEL_LOCK_MS) return true;
  return false;
}

function computePackageSessionCountsFromSessions(sessions, lessonCount, now) {
  now = now || Date.now();
  var active = (sessions || []).filter(function (s) {
    return !isPackageSessionCancelled(s);
  });
  var consumed = active.filter(function (s) {
    return isPackageSessionConsumed(s, now);
  }).length;
  return {
    consumed: consumed,
    remaining: Math.max(0, Number(lessonCount || 0) - consumed),
  };
}

function fmtMemberCardDate(d) {
  return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
}

function memberSessionIsElapsed(s) {
  return Number(s.startTs) < Date.now();
}

function computeMemberPackageSessionStats(sessions) {
  var cancelled = 0;
  var attended = 0;
  var now = Date.now();
  (sessions || []).forEach(function (s) {
    if (isPackageSessionCancelled(s)) cancelled += 1;
    else if (isPackageSessionConsumed(s, now)) attended += 1;
  });
  return { cancelled: cancelled, attended: attended };
}

function renderMemberPastSessionsStats(ap) {
  if (!els.memberPastSessionsStats) return;
  if (!ap) {
    els.memberPastSessionsStats.classList.add("hidden");
    els.memberPastSessionsStats.innerHTML = "";
    return;
  }
  var stats = computeMemberPackageSessionStats(ap.sessions);
  els.memberPastSessionsStats.classList.remove("hidden");
  els.memberPastSessionsStats.innerHTML =
    '<div class="member-home__stats-row"><span class="member-home__stats-label">Katılınan seans</span><span class="member-home__stats-value">' +
    stats.attended +
    "</span></div>" +
    '<div class="member-home__stats-row"><span class="member-home__stats-label">İptal edilen seans</span><span class="member-home__stats-value">' +
    stats.cancelled +
    "</span></div>";
}

function splitMemberPackageSessions(sessions) {
  var past = [];
  var upcoming = [];
  var todayStart = startOfDay(new Date()).getTime();
  var now = Date.now();
  (sessions || []).forEach(function (s) {
    var ts = Number(s.startTs);
    if (isPackageSessionCancelled(s)) {
      past.push(s);
    } else if (isPackageSessionConsumed(s, now) || s.isPast || ts < todayStart || ts < now) {
      past.push(s);
    } else {
      upcoming.push(s);
    }
  });
  past.sort(function (a, b) {
    return Number(b.startTs) - Number(a.startTs);
  });
  upcoming.sort(function (a, b) {
    return Number(a.startTs) - Number(b.startTs);
  });
  return { past: past, upcoming: upcoming };
}

var MEMBER_PACKAGE_CANCELLED_LABEL = "Paket iptal edildi";

function memberSessionStatusLabel(s, options) {
  options = options || {};
  var pkgInactive = !!options.packageInactive;
  if (isPackageSessionCancelled(s)) {
    return {
      text: pkgInactive ? MEMBER_PACKAGE_CANCELLED_LABEL : "İptal edildi",
      cls: "member-session-status--cancelled",
    };
  }
  if (s.isConsumed === true || isPackageSessionConsumed(s)) {
    if (s.checkedIn) {
      return { text: "Katılındı", cls: "member-session-status--done" };
    }
    return { text: "Yapıldı", cls: "member-session-status--done" };
  }
  if (pkgInactive) {
    return { text: s.statusLabel || MEMBER_PACKAGE_CANCELLED_LABEL, cls: "member-session-status--cancelled" };
  }
  if (memberSessionIsElapsed(s) || s.isPast) {
    return { text: s.statusLabel || "Yapıldı", cls: "member-session-status--done" };
  }
  if (s.canCancel) return { text: s.statusLabel || "Planlandı", cls: "member-session-status--ok" };
  return {
    text: s.statusLabel || s.cancelReason || "İptal edilemez",
    cls: s.cancelReasonDetail ? "member-session-status--expired" : "member-session-status--locked",
    detail: s.cancelReasonDetail || null,
  };
}

function memberSessionStatusDetailHtml(detail) {
  if (!detail) return "";
  return '<p class="member-session-box__status-detail hint">' + escapeHtml(detail) + "</p>";
}

function renderMemberSessionBoxHtml(s, options) {
  options = options || {};
  var d = new Date(Number(s.startTs));
  var st = memberSessionStatusLabel(s);
  var cancelAside =
    options.showCancel && memberCanCancelSession(s)
      ? '<div class="member-session-box__aside"><button type="button" class="member-session-box__cancel member-cancel-session-btn" data-session-id="' +
        escapeHtml(String(s.id)) +
        '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> İptal Et</button></div>'
      : "";
  return (
    '<article class="member-session-box">' +
    '<div class="member-session-box__main">' +
    '<div class="member-session-box__datetime">' +
    '<span class="member-session-box__cal-icon" aria-hidden="true">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
    "</span>" +
    '<span class="member-session-box__date-time">' +
    escapeHtml(fmtMemberCardDate(d) + " " + fmtSessionListTime(d)) +
    "</span>" +
    "</div>" +
    '<div class="member-session-box__day">' +
    escapeHtml(fmtCalendarHeaderDayName(d)) +
    "</div>" +
    '<div class="member-session-box__status"><span class="member-session-status ' +
    st.cls +
    '">' +
    escapeHtml(st.text) +
    "</span>" +
    memberSessionStatusDetailHtml(st.detail) +
    "</div>" +
    "</div>" +
    cancelAside +
    "</article>"
  );
}

function bindMemberHomeSessionActions(root) {
  if (!root) return;
  root.querySelectorAll(".member-cancel-session-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      cancelMemberSessionFromPortal(Number(btn.dataset.sessionId));
    });
  });
}

function setMemberSessionsView(view) {
  ui.memberSessionsView = view === "past" ? "past" : "upcoming";
  updateMemberHomeTabsUI();
}

function updateMemberHomeTabsUI() {
  var view = ui.memberSessionsView === "past" ? "past" : "upcoming";
  var onUpcoming = view === "upcoming";
  if (els.memberSessionsTabUpcoming) {
    els.memberSessionsTabUpcoming.classList.toggle("is-active", onUpcoming);
    els.memberSessionsTabUpcoming.setAttribute("aria-selected", onUpcoming ? "true" : "false");
  }
  if (els.memberSessionsTabPast) {
    els.memberSessionsTabPast.classList.toggle("is-active", !onUpcoming);
    els.memberSessionsTabPast.setAttribute("aria-selected", !onUpcoming ? "true" : "false");
  }
  if (els.memberUpcomingSessionsPanel) els.memberUpcomingSessionsPanel.classList.toggle("hidden", !onUpcoming);
  if (els.memberPastSessionsPanel) els.memberPastSessionsPanel.classList.toggle("hidden", onUpcoming);
}

function bindMemberHomePackageInfoActions(ap) {
  if (!els.memberHomePackageInfo) return;
  els.memberHomePackageInfo.classList.remove("member-tab-bar__package--clickable");
  els.memberHomePackageInfo.removeAttribute("role");
  els.memberHomePackageInfo.tabIndex = -1;
  els.memberHomePackageInfo.onclick = null;
  els.memberHomePackageInfo.onkeydown = null;
  if (!ap) return;
  els.memberHomePackageInfo.classList.add("member-tab-bar__package--clickable");
  els.memberHomePackageInfo.setAttribute("role", "button");
  els.memberHomePackageInfo.tabIndex = 0;
  els.memberHomePackageInfo.setAttribute("aria-label", (ap.packageName || "Paket") + " seanslarını görüntüle");
  var handler = function () {
    openMemberPortalSessionsModal(ap, true);
  };
  els.memberHomePackageInfo.onclick = handler;
  els.memberHomePackageInfo.onkeydown = function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}

function renderMemberHomePackageInfo(ap) {
  if (!els.memberHomePackageInfo) return;
  var onHome = (ui.memberTab || "home") === "home";
  var show = !!(ap && onHome);
  if (els.memberTabBar) {
    els.memberTabBar.classList.toggle("member-tab-bar--fab-only", !show);
  }
  if (!show) {
    els.memberHomePackageInfo.classList.add("hidden");
    bindMemberHomePackageInfoActions(null);
    return;
  }
  els.memberHomePackageInfo.classList.remove("hidden");
  if (els.memberHomePackageName) {
    els.memberHomePackageName.textContent = ap.packageName || "Paket";
  }
  if (els.memberHomePackageRemaining) {
    els.memberHomePackageRemaining.textContent = fmtPackageSessionsRemainingSummary(ap);
  }
  if (els.memberHomePackageEnd) {
    els.memberHomePackageEnd.textContent = fmtActivePackageSummaryMetaLine(ap);
  }
  bindMemberHomePackageInfoActions(ap);
}

function renderMemberHome() {
  if (!isMemberUser() || !els.memberHomeView) return;
  updateUserBranding();
  updateMemberHomeTabsUI();
  var ap = ui.memberPortal && ui.memberPortal.activePackage;
  renderMemberHomePackageInfo(ap);
  var split = splitMemberPackageSessions(ap ? ap.sessions : []);
  renderMemberPastSessionsStats(ap);
  if (els.memberPastSessionsList) {
    if (!ap || !split.past.length) {
      els.memberPastSessionsList.innerHTML = "";
      if (els.memberPastSessionsEmpty) els.memberPastSessionsEmpty.classList.toggle("hidden", !!(ap && split.past.length));
      if (els.memberPastSessionsFooter) els.memberPastSessionsFooter.classList.add("hidden");
    } else {
      if (els.memberPastSessionsEmpty) els.memberPastSessionsEmpty.classList.add("hidden");
      els.memberPastSessionsList.innerHTML = split.past
        .map(function (s) {
          return renderMemberSessionBoxHtml(s, { showCancel: false });
        })
        .join("");
      if (els.memberPastSessionsFooter) els.memberPastSessionsFooter.classList.remove("hidden");
    }
  }
  if (els.memberUpcomingSessionsList) {
    if (!ap || !split.upcoming.length) {
      els.memberUpcomingSessionsList.innerHTML = "";
      renderMemberPackageRequestEmptyState(ap);
      if (els.memberUpcomingSessionsFooter) els.memberUpcomingSessionsFooter.classList.add("hidden");
    } else {
      if (els.memberUpcomingSessionsEmpty) els.memberUpcomingSessionsEmpty.classList.add("hidden");
      if (els.memberPackageRequestCta) els.memberPackageRequestCta.classList.add("hidden");
      if (els.memberPackageRequestPending) els.memberPackageRequestPending.classList.add("hidden");
      els.memberUpcomingSessionsList.innerHTML = split.upcoming
        .map(function (s) {
          return renderMemberSessionBoxHtml(s, { showCancel: true });
        })
        .join("");
      bindMemberHomeSessionActions(els.memberUpcomingSessionsList);
      if (els.memberUpcomingSessionsFooter) els.memberUpcomingSessionsFooter.classList.remove("hidden");
    }
  }
  renderMemberNotificationsBanner();
}

var memberQrRefreshTimer = null;
var memberQrCountdownTimer = null;
var memberQrExpiresAt = 0;

function stopMemberQrTimers() {
  if (memberQrRefreshTimer) {
    clearTimeout(memberQrRefreshTimer);
    memberQrRefreshTimer = null;
  }
  if (memberQrCountdownTimer) {
    clearInterval(memberQrCountdownTimer);
    memberQrCountdownTimer = null;
  }
}

function updateMemberQrCountdownLabel() {
  if (!els.memberQrCountdown) return;
  var left = Math.max(0, Math.ceil((memberQrExpiresAt - Date.now()) / 1000));
  els.memberQrCountdown.textContent = left > 0 ? "Yenilenmesine " + left + " sn" : "Yenileniyor…";
}

async function refreshMemberQrCode() {
  if (!window.API || !window.API.getMemberAccessQr) return;
  if (els.memberQrError) {
    els.memberQrError.classList.add("hidden");
    els.memberQrError.textContent = "";
  }
  try {
    var data = await window.API.getMemberAccessQr();
    if (els.memberQrImage && data.qrDataUrl) els.memberQrImage.src = data.qrDataUrl;
    var expiresIn = Math.max(5, Number(data.expiresIn) || 45);
    memberQrExpiresAt = Date.now() + expiresIn * 1000;
    updateMemberQrCountdownLabel();
    stopMemberQrTimers();
    memberQrCountdownTimer = setInterval(updateMemberQrCountdownLabel, 1000);
    memberQrRefreshTimer = setTimeout(function () {
      if (els.memberQrModal && !els.memberQrModal.classList.contains("hidden")) {
        refreshMemberQrCode();
      }
    }, Math.max(5000, (expiresIn - 2) * 1000));
  } catch (e) {
    if (els.memberQrError) {
      els.memberQrError.textContent = (e.data && e.data.error) || e.message || "QR yüklenemedi.";
      els.memberQrError.classList.remove("hidden");
    }
  }
}

function openMemberQrModal() {
  if (!els.memberQrModal) return;
  els.memberQrModal.classList.remove("hidden");
  refreshMemberQrCode();
}

function closeMemberQrModal() {
  stopMemberQrTimers();
  if (els.memberQrModal) els.memberQrModal.classList.add("hidden");
}

var staffAttendancePollTimer = null;
var STAFF_ATTENDANCE_POLL_MS = 60 * 1000;

function stopStaffAttendancePoll() {
  if (staffAttendancePollTimer) {
    clearInterval(staffAttendancePollTimer);
    staffAttendancePollTimer = null;
  }
}

async function refreshStaffShiftReminder() {
  if (!isStaffUser() || !window.API || !window.API.checkStaffShiftReminder) return;
  try {
    await window.API.checkStaffShiftReminder();
  } catch (_) {}
}

function startStaffAttendancePoll() {
  stopStaffAttendancePoll();
  if (!isStaffUser() || !window.API) return;
  refreshStaffShiftReminder();
  staffAttendancePollTimer = setInterval(function () {
    if (document.visibilityState !== "visible") return;
    refreshStaffShiftReminder();
  }, STAFF_ATTENDANCE_POLL_MS);
}

function localTodayInputValue() {
  var d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

var entryListEditSessionId = null;
var entryListRowsCache = [];
var entryListWalkInCache = [];
var entryListViewMode = "sessions";

function getTopbarPlannerDateRange() {
  if (ui.viewMode === "week") {
    var weekStart = startOfWeekMonday(ui.weekStart || ui.currentDay || new Date());
    var weekEnd = addDays(weekStart, 6);
    return { startDate: dateToInputValue(weekStart), endDate: dateToInputValue(weekEnd) };
  }
  if (ui.viewMode === "month") {
    var monthStart = startOfMonth(ui.currentMonth || ui.currentDay || new Date());
    var monthEnd = addDays(addMonths(monthStart, 1), -1);
    return { startDate: dateToInputValue(monthStart), endDate: dateToInputValue(monthEnd) };
  }
  var dayStr = dateToInputValue(startOfDay(ui.currentDay || new Date()));
  return { startDate: dayStr, endDate: dayStr };
}

async function refreshEntryListIfActive() {
  if (isAdminMainViewActive("entry-list")) {
    await refreshEntryListModal();
  }
}

function getEntryListDateRange() {
  return getTopbarPlannerDateRange();
}

function entryListShowsDateColumn() {
  return ui.viewMode !== "day";
}

function getEntryListEmptyMessage(filteredEmpty) {
  if (filteredEmpty && getAdminListFilterText()) return "Filtreye uyan kayıt yok.";
  if (entryListViewMode === "walk_ins") {
    if (ui.viewMode === "week") return "Bu hafta randevusuz QR girişi yok.";
    if (ui.viewMode === "month") return "Bu ay randevusuz QR girişi yok.";
    return "Bu tarihte randevusuz QR girişi yok.";
  }
  if (ui.viewMode === "week") return "Bu hafta üye seansı yok.";
  if (ui.viewMode === "month") return "Bu ay üye seansı yok.";
  return "Bu tarihte üye seansı yok.";
}

function setEntryListViewMode(mode) {
  entryListViewMode = mode === "walk_ins" ? "walk_ins" : "sessions";
  if (entryListViewMode === "sessions") entryListEditSessionId = null;
  if (els.entryListTabSessions) {
    els.entryListTabSessions.classList.toggle("is-active", entryListViewMode === "sessions");
    els.entryListTabSessions.setAttribute("aria-selected", entryListViewMode === "sessions" ? "true" : "false");
  }
  if (els.entryListTabWalkIns) {
    els.entryListTabWalkIns.classList.toggle("is-active", entryListViewMode === "walk_ins");
    els.entryListTabWalkIns.setAttribute("aria-selected", entryListViewMode === "walk_ins" ? "true" : "false");
  }
}

async function openEntryListModal() {
  if (!isAdminUser()) return;
  entryListEditSessionId = null;
  setEntryListViewMode("sessions");
  updateTopbarForViewMode();
  showAdminMainView("entry-list");
  await refreshEntryListModal();
}

function closeEntryListModal() {
  entryListEditSessionId = null;
  showAdminCalendarView();
}

function renderEntryListStatusCell(r) {
  var statusText = isAdminMobilePanel() ? fmtEntryListStatusLabelMobile(r) : (r.attendanceLabel || "").trim();
  if (r.statusKind === "qr") {
    return (
      '<span class="entry-status entry-status--ok">' +
      '<span class="entry-status__icon" aria-hidden="true">✓</span> ' +
      escapeHtml(statusText || "QR - Geldi") +
      "</span>"
    );
  }
  if (r.statusKind === "admin_present" || r.statusKind === "staff_present") {
    return (
      '<span class="entry-status entry-status--ok">' +
      '<span class="entry-status__icon" aria-hidden="true">✓</span> ' +
      escapeHtml(statusText || "Geldi") +
      "</span>"
    );
  }
  if (r.statusKind === "no_show") {
    return (
      '<span class="entry-status entry-status--no">' +
      '<span class="entry-status__icon" aria-hidden="true">✕</span> ' +
      escapeHtml(statusText || "Gelmedi") +
      "</span>"
    );
  }
  if (r.statusKind === "scheduled") {
    return (
      '<span class="entry-status entry-status--muted">' +
      escapeHtml(statusText || "Planlandı") +
      "</span>"
    );
  }
  return (
    '<span class="entry-status entry-status--pending">' +
    '<span class="entry-status__icon" aria-hidden="true">O</span> ' +
    escapeHtml(statusText || "Onaylanmadı") +
    "</span>"
  );
}

function renderEntryListActionsCell(r) {
  var showActions =
    r.canAdminApprove || (r.canAdminEdit && entryListEditSessionId === r.id);
  if (!showActions) return "";
  return (
    '<div class="entry-list-actions">' +
    '<button type="button" class="entry-list-action entry-list-action--ok" data-entry-action="present" data-session-id="' +
    escapeHtml(String(r.id)) +
    '" title="Geldi" aria-label="Geldi">✓</button>' +
    '<button type="button" class="entry-list-action entry-list-action--no" data-entry-action="no_show" data-session-id="' +
    escapeHtml(String(r.id)) +
    '" title="Gelmedi" aria-label="Gelmedi">✕</button>' +
    "</div>"
  );
}

function renderEntryListTableBody(rows, showDateCol) {
  if (showDateCol == null) showDateCol = entryListShowsDateColumn();
  return rows
    .map(function (r) {
      var start = new Date(Number(r.startTs));
      var rowClasses = ["entry-list-row"];
      if (r.canAdminEdit) rowClasses.push("entry-list-row--editable");
      if (entryListEditSessionId === r.id) rowClasses.push("entry-list-row--editing");
      var dateCell = showDateCol
        ? '<td data-label="Tarih">' + escapeHtml(fmtSessionListDate(start)) + "</td>"
        : "";
      return (
        "<tr" +
        ' class="' +
        rowClasses.join(" ") +
        '"' +
        ' data-session-id="' +
        escapeHtml(String(r.id)) +
        '"' +
        (r.canAdminEdit ? ' title="Düzenlemek için tıklayın"' : "") +
        ">" +
        dateCell +
        '<td data-label="Saat">' +
        escapeHtml(fmtSessionListTime(start)) +
        "</td>" +
        '<td data-label="Üye">' +
        escapeHtml(fmtEntryListMemberCell(r)) +
        "</td>" +
        '<td data-label="Personel">' +
        escapeHtml(fmtEntryListStaffCell(r)) +
        "</td>" +
        '<td data-label="Durum">' +
        renderEntryListStatusCell(r) +
        "</td>" +
        '<td class="entry-list-table__actions">' +
        renderEntryListActionsCell(r) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderWalkInEntryListTableBody(rows, showDateCol) {
  if (showDateCol == null) showDateCol = entryListShowsDateColumn();
  return rows
    .map(function (r) {
      var at = new Date(Number(r.accessedAt));
      var memberLabel = r.memberName || "—";
      if (isAdminMobilePanel()) memberLabel = fmtEntryListMemberNameMobile(memberLabel);
      if (r.memberNo) memberLabel += " (" + r.memberNo + ")";
      var dateCell = showDateCol
        ? '<td data-label="Tarih">' + escapeHtml(fmtSessionListDate(at)) + "</td>"
        : "";
      return (
        "<tr class=\"entry-list-row entry-list-row--walk-in\">" +
        dateCell +
        '<td data-label="Saat">' +
        escapeHtml(fmtSessionListTime(at)) +
        "</td>" +
        '<td data-label="Üye">' +
        escapeHtml(memberLabel) +
        "</td>" +
        '<td data-label="Tür">' +
        '<span class="entry-status entry-status--walk-in">' +
        escapeHtml(r.label || "Randevusuz QR") +
        "</span></td>" +
        "</tr>"
      );
    })
    .join("");
}

function bindEntryListTableInteractions() {
  if (!els.entryListTableWrap || els.entryListTableWrap.dataset.entryBound === "1") return;
  els.entryListTableWrap.dataset.entryBound = "1";
  els.entryListTableWrap.addEventListener("click", function (e) {
    if (e.target.closest("[data-entry-action]")) return;
    var row = e.target.closest(".entry-list-row--editable");
    if (!row) return;
    var sid = Number(row.dataset.sessionId);
    var rec = entryListRowsCache.find(function (r) {
      return Number(r.id) === sid;
    });
    if (!rec || !rec.canAdminEdit) return;
    entryListEditSessionId = entryListEditSessionId === sid ? null : sid;
    renderEntryListFromCache();
  });
}

function entryListSessionRowMatchesFilter(r, filterText) {
  var q = (filterText || "").trim();
  if (!q) return true;
  var member = getMemberById(r.memberId);
  if (member && memberMatchesListFilter(member, q)) return true;
  if (personNameStringMatchesFilter(r.memberName || r.member_name, q)) return true;
  var staff = getStaffById(r.staffId);
  if (staffMatchesFilter(staff, q)) return true;
  return personNameStringMatchesFilter(r.staffName || r.staff_name, q);
}

function entryListWalkInRowMatchesFilter(r, filterText) {
  var q = (filterText || "").trim();
  if (!q) return true;
  if (personNameStringMatchesFilter(r.memberName || r.member_name, q)) return true;
  var memberNo = r.memberNo != null ? String(r.memberNo) : r.member_no != null ? String(r.member_no) : "";
  if (memberNo && memberNo.toLowerCase().includes(q.toLowerCase())) return true;
  return memberMatchesListFilter(
    { name: r.memberName, memberNo: memberNo, phone: r.memberPhone || r.phone },
    q
  );
}

function renderEntryListFromCache() {
  if (!isAdminMainViewActive("entry-list")) return;
  var filterText = getAdminListFilterText();
  var showDateCol = entryListShowsDateColumn();
  var dateHeader = showDateCol ? "<th>Tarih</th>" : "";
  if (entryListViewMode === "walk_ins") {
    var walkRows = (entryListWalkInCache || []).filter(function (r) {
      return entryListWalkInRowMatchesFilter(r, filterText);
    });
    if (els.entryListEmpty) {
      els.entryListEmpty.textContent = getEntryListEmptyMessage(
        entryListWalkInCache.length > 0 && walkRows.length === 0
      );
      els.entryListEmpty.classList.toggle("hidden", walkRows.length > 0);
    }
    if (!els.entryListTableWrap) return;
    if (!walkRows.length) {
      els.entryListTableWrap.innerHTML = "";
      return;
    }
    els.entryListTableWrap.innerHTML =
      '<table class="entry-list-table entry-list-table--walk-ins">' +
      "<thead><tr>" + dateHeader + "<th>Saat</th><th>Üye</th><th>Tür</th></tr></thead>" +
      "<tbody>" +
      renderWalkInEntryListTableBody(walkRows, showDateCol) +
      "</tbody></table>";
    return;
  }
  var rows = (entryListRowsCache || []).filter(function (r) {
    return entryListSessionRowMatchesFilter(r, filterText);
  });
  if (entryListEditSessionId != null) {
    var stillThere = rows.some(function (r) {
      return Number(r.id) === Number(entryListEditSessionId) && r.canAdminEdit;
    });
    if (!stillThere) entryListEditSessionId = null;
  }
  if (els.entryListEmpty) {
    els.entryListEmpty.textContent = getEntryListEmptyMessage(
      entryListRowsCache.length > 0 && rows.length === 0
    );
    els.entryListEmpty.classList.toggle("hidden", rows.length > 0);
  }
  if (!els.entryListTableWrap) return;
  if (!rows.length) {
    els.entryListTableWrap.innerHTML = "";
    return;
  }
  els.entryListTableWrap.innerHTML =
    '<table class="entry-list-table entry-list-table--sessions">' +
    "<thead><tr>" + dateHeader + "<th>Saat</th><th>Üye</th><th>Personel</th><th>Durum</th><th class=\"entry-list-table__actions-head\" aria-label=\"İşlem\"></th></tr></thead>" +
    "<tbody>" +
    renderEntryListTableBody(rows, showDateCol) +
    "</tbody></table>";
  bindEntryListTableInteractions();
}

async function refreshEntryListModal() {
  if (!window.API) return;
  var range = getEntryListDateRange();
  try {
    if (entryListViewMode === "walk_ins") {
      if (!window.API.getWalkInAccessList) return;
      var walkData = await window.API.getWalkInAccessList(range);
      entryListWalkInCache = walkData.entries || [];
      renderEntryListFromCache();
      return;
    }

    if (!window.API.getAttendanceEntryList) return;
    var data = await window.API.getAttendanceEntryList(range);
    entryListRowsCache = data.sessions || [];
    renderEntryListFromCache();
  } catch (e) {
    await showAppAlert(
      (e.data && e.data.error) ||
        e.message ||
        (entryListViewMode === "walk_ins" ? "Randevusuz giriş listesi yüklenemedi." : "Giriş listesi yüklenemedi.")
    );
  }
}

function openMemberSettings() {
  setMemberTab("profile");
}

function renderMemberPortalProfilePanel() {
  fillMemberProfileModal();
}

function isAdminMainViewActive(view) {
  return isAdminUser() && ui.adminMainView === view;
}

function isAdminMembersListViewActive() {
  return isAdminMainViewActive("members-list");
}

function isAdminPanelViewActive() {
  return isAdminUser() && ui.adminMainView !== "calendar";
}

function updateAdminMainViewUI() {
  if (isMemberUser()) return;
  if (!isAdminUser()) {
    if (els.adminMembersListView) els.adminMembersListView.classList.add("hidden");
    if (els.adminExpiredMembershipsView) els.adminExpiredMembershipsView.classList.add("hidden");
    if (els.adminFormerMembersView) els.adminFormerMembersView.classList.add("hidden");
    if (els.adminEntryListView) els.adminEntryListView.classList.add("hidden");
    if (els.memberPlanner) els.memberPlanner.classList.remove("hidden");
    return;
  }
  var view = ui.adminMainView || "calendar";
  var isCalendar = view === "calendar";
  if (els.memberPlanner) els.memberPlanner.classList.toggle("hidden", !isCalendar);
  if (els.adminMembersListView) els.adminMembersListView.classList.toggle("hidden", view !== "members-list");
  if (els.adminExpiredMembershipsView) els.adminExpiredMembershipsView.classList.toggle("hidden", view !== "expired-memberships");
  if (els.adminFormerMembersView) els.adminFormerMembersView.classList.toggle("hidden", view !== "former-members");
  if (els.adminEntryListView) els.adminEntryListView.classList.toggle("hidden", view !== "entry-list");
  if (els.openCalendarBtn) els.openCalendarBtn.classList.toggle("sidebar-nav__btn--active", isCalendar);
  if (els.openListMembersBtn) els.openListMembersBtn.classList.toggle("sidebar-nav__btn--active", view === "members-list");
  if (els.openExpiredMembershipsBtn) els.openExpiredMembershipsBtn.classList.toggle("sidebar-nav__btn--active", view === "expired-memberships");
  if (els.openFormerMembersBtn) els.openFormerMembersBtn.classList.toggle("sidebar-nav__btn--active", view === "former-members");
  if (els.openEntryListBtn) els.openEntryListBtn.classList.toggle("sidebar-nav__btn--active", view === "entry-list");
  updateTopbarFilterPlaceholder();
  refreshAdminListPanels();
}

function showAdminCalendarView() {
  if (!isAdminUser()) return;
  ui.adminMainView = "calendar";
  updateAdminMainViewUI();
}

function clearPlannerFilters() {
  ui.plannerFilter = "";
  ui.filterStaffId = "";
  ui.filterRoomId = "";
  if (els.plannerFilterInput) els.plannerFilterInput.value = "";
  if (els.topbarMobileFilterInput) els.topbarMobileFilterInput.value = "";
  updatePlannerFiltersToggleState();
  saveUi();
}

function showAdminMainView(view) {
  if (!isAdminUser()) return;
  ui.adminMainView = view;
  updateAdminMainViewUI();
  if (isSidebarDrawerMode()) closeSidebar();
}

var adminPanelSwipeStart = null;

function bindAdminPanelSwipeBack() {
  var root = document.getElementById("mainContent");
  if (!root || root.dataset.adminSwipeBound === "1") return;
  root.dataset.adminSwipeBound = "1";
  root.addEventListener(
    "touchstart",
    function (e) {
      if (!isAdminUser() || !isAdminPanelViewActive() || !isAdminMobilePanel()) return;
      if (e.touches.length !== 1) return;
      if (!e.target.closest(".admin-main-panel:not(.hidden)")) return;
      var touch = e.touches[0];
      adminPanelSwipeStart = { x: touch.clientX, y: touch.clientY };
    },
    { passive: true }
  );
  root.addEventListener(
    "touchend",
    function (e) {
      if (!adminPanelSwipeStart) return;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - adminPanelSwipeStart.x;
      var dy = touch.clientY - adminPanelSwipeStart.y;
      adminPanelSwipeStart = null;
      if (dx >= 72 && Math.abs(dx) > Math.abs(dy) * 1.2) showAdminCalendarView();
    },
    { passive: true }
  );
  root.addEventListener(
    "touchcancel",
    function () {
      adminPanelSwipeStart = null;
    },
    { passive: true }
  );
}

function showAdminMembersListView() {
  showAdminMainView("members-list");
}

function updateMemberTabUI() {
  var isMember = isMemberUser();
  var mainApp = document.getElementById("mainApp");
  if (!isMember) {
    if (els.memberTabBar) els.memberTabBar.classList.add("hidden");
    if (els.memberPortalView) els.memberPortalView.classList.add("hidden");
    if (els.memberHomeView) els.memberHomeView.classList.add("hidden");
    if (els.memberHomeHeader) els.memberHomeHeader.classList.add("hidden");
    updateAdminMainViewUI();
    if (els.memberNotificationsBanner) els.memberNotificationsBanner.classList.add("hidden");
    if (mainApp) mainApp.classList.remove("app--member-portal");
    return;
  }
  var tab = ui.memberTab || "home";
  if (tab === "calendar") tab = "home";
  ui.memberTab = tab;
  if (mainApp) mainApp.classList.add("app--member-portal");
  if (els.memberTabBar) els.memberTabBar.classList.remove("hidden");
  if (els.memberSessionsBtn) els.memberSessionsBtn.classList.add("hidden");
  if (els.memberProfileBtn) els.memberProfileBtn.classList.add("hidden");
  if (els.memberPlanner) els.memberPlanner.classList.add("hidden");
  var onHome = tab === "home";
  if (els.memberHomeHeader) els.memberHomeHeader.classList.toggle("hidden", !onHome);
  if (els.memberHomeView) els.memberHomeView.classList.toggle("hidden", !onHome);
  if (els.memberPortalView) els.memberPortalView.classList.toggle("hidden", onHome);
  document.querySelectorAll("[data-member-tab-panel]").forEach(function (panel) {
    var panelTab = panel.getAttribute("data-member-tab-panel");
    panel.classList.toggle("hidden", onHome || panelTab !== tab);
  });
  if (onHome) renderMemberHome();
  renderMemberHomePackageInfo(ui.memberPortal && ui.memberPortal.activePackage);
}

function setMemberTab(tab) {
  var allowed = { home: true, packages: true, profile: true, calendar: true };
  ui.memberTab = allowed[tab] ? (tab === "calendar" ? "home" : tab) : "home";
  updateMemberTabUI();
  if (ui.memberTab !== "home") renderMemberTabContent();
}

function renderMemberTabContent() {
  if (ui.memberTab === "packages") {
    renderMemberPackagesPanel();
  } else if (ui.memberTab === "profile") {
    renderMemberPortalProfilePanel();
  }
}

function renderMemberProfileContent() {
  fillMemberProfileModal();
  renderMemberPackagesPanel();
  renderMemberNotificationsBanner();
}

function openMemberProfileModal() {
  if (!els.memberProfileModal) return;
  ui.memberProfileSection = "account";
  fillMemberProfileModal();
  els.memberProfileModal.classList.remove("hidden");
}

function closeMemberProfileModal() {
  if (els.memberProfileModal) els.memberProfileModal.classList.add("hidden");
}

var memberPortalSessionsCurrent = null;

function openMemberPortalSessionsModal(pkg, isActive) {
  if (!els.memberPortalSessionsModal || !pkg) return;
  memberPortalSessionsCurrent = { pkg: pkg, isActive: !!isActive };
  if (els.memberPortalSessionsTitle) {
    els.memberPortalSessionsTitle.textContent = (pkg.packageName || "Paket") + " – Seanslar";
  }
  if (els.memberPortalSessionsSubtitle) {
    els.memberPortalSessionsSubtitle.textContent =
      fmtPackageModalSubtitle(pkg, isActive);
  }
  if (els.memberPortalSessionsError) {
    els.memberPortalSessionsError.classList.add("hidden");
    els.memberPortalSessionsError.textContent = "";
  }
  renderMemberPortalSessionsTable(pkg.sessions || [], isActive);
  els.memberPortalSessionsModal.classList.remove("hidden");
}

function closeMemberPortalSessionsModal() {
  ui.memberPortalSessionsModalSuspended = false;
  memberSessionCancelPending = null;
  if (els.memberSessionCancelModal) els.memberSessionCancelModal.classList.add("hidden");
  if (els.memberPortalSessionsModal) els.memberPortalSessionsModal.classList.add("hidden");
  memberPortalSessionsCurrent = null;
}

async function openPackageSessionEditorFromPackageList(sessionId) {
  if (!sessionId) return;
  var s = state.sessions.find(function (x) {
    return normId(x.id) === normId(sessionId);
  });
  if (!s && window.API && window.API.getSessions && packageSessionsCurrent && packageSessionsCurrent.sessions.length) {
    try {
      var firstTs = packageSessionsCurrent.sessions[0].start_ts || packageSessionsCurrent.sessions[0].startTs;
      var lastTs =
        packageSessionsCurrent.sessions[packageSessionsCurrent.sessions.length - 1].start_ts ||
        packageSessionsCurrent.sessions[packageSessionsCurrent.sessions.length - 1].startTs;
      if (firstTs && lastTs) {
        var startD = new Date(Number(firstTs)).toISOString().slice(0, 10);
        var endD = new Date(Number(lastTs)).toISOString().slice(0, 10);
        await fetchAndMergeSessions(startD, endD);
        s = state.sessions.find(function (x) {
          return normId(x.id) === normId(sessionId);
        });
      }
    } catch (_) {}
  }
  if (s) openSessionModal({ mode: "edit", sessionId: s.id });
}

function renderMemberPortalSessionsTable(sessions, isActive) {
  renderPackageSessionsList(filterMemberPortalSessionsForDisplay(sessions, isActive), {
    role: "member",
    isActive: isActive,
    packageInactive: !isActive,
    cardsEl: els.memberPortalSessionsCards,
    tableWrapEl: els.memberPortalSessionsTableWrap,
    tableBodyEl: els.memberPortalSessionsTableBody,
    tableEl: els.memberPortalSessionsTable,
    emptyEl: els.memberPortalSessionsEmpty,
    onCancel: cancelMemberSessionFromPortal,
  });
}

async function refreshMemberPortal() {
  if (!window.API || !window.API.loadMemberPortalState) return;
  var loaded = await window.API.loadMemberPortalState();
  applyMemberPortalState(loaded);
  if (els.memberProfileModal && !els.memberProfileModal.classList.contains("hidden")) {
    fillMemberProfileModal();
  }
  render();
  if (isMemberUser() && ui.memberTab && ui.memberTab !== "home") {
    renderMemberTabContent();
  }
}

async function cancelMemberSessionById(sessionId, options) {
  if (!sessionId || !window.API || !window.API.cancelMemberSession) return false;
  options = options || {};
  var result = await window.API.cancelMemberSession(sessionId, {
    reason: options.reason || "",
    requestNewAppointment: !!options.requestNewAppointment,
  });
  if (isMemberUser()) {
    await refreshMemberPortal();
  } else {
    await syncSessionsFromServer({ silent: true });
  }
  if (isMemberUser() && ui.memberCalendarPackageId != null) {
    ui.dayDisplayMode = "list";
  }
  render();
  if (result && result.replenished) {
    // sessiz başarı
  } else if (result && result.replenished === false && result.replenishedReason === "no_available_slot") {
    await showAppAlert("Seans iptal edildi ancak paket bitiş tarihine kadar uygun yeni seans bulunamadı.");
  }
  return true;
}

var memberSessionCancelPending = null;

function findMemberPortalSessionById(sessionId) {
  if (!ui.memberPortal) return null;
  var ap = ui.memberPortal.activePackage;
  if (ap && ap.sessions) {
    var hit = ap.sessions.find(function (s) {
      return Number(s.id) === Number(sessionId);
    });
    if (hit) return { session: hit, package: ap, isActive: true };
  }
  var past = ui.memberPortal.pastPackages || [];
  for (var i = 0; i < past.length; i++) {
    var pkg = past[i];
    if (!pkg.sessions) continue;
    var s = pkg.sessions.find(function (row) {
      return Number(row.id) === Number(sessionId);
    });
    if (s) return { session: s, package: pkg, isActive: false };
  }
  return null;
}

function updateMemberSessionCancelReasonCount() {
  if (!els.memberSessionCancelReason || !els.memberSessionCancelReasonCount) return;
  var len = (els.memberSessionCancelReason.value || "").length;
  els.memberSessionCancelReasonCount.textContent = len + "/300";
}

async function openInstitutionWhatsAppForReschedule(session, reason) {
  var phone = ui.memberPortal && ui.memberPortal.contactWhatsApp;
  if (!phone) {
    await showAppAlert("Kurum WhatsApp numarası tanımlı değil. Lütfen kurumunuzla doğrudan iletişime geçin.");
    return;
  }
  var digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) digits = "90" + digits;
  if (digits.length === 11 && digits.charAt(0) === "0") digits = "9" + digits;
  var profile = ui.memberPortal && ui.memberPortal.profile;
  var memberName = (profile && profile.fullName) || "Üye";
  var when = "";
  if (session && session.startTs) {
    var d = new Date(Number(session.startTs));
    when = fmtMemberCardDate(d) + " " + fmtSessionListTime(d);
  }
  var lines = [
    "Merhaba, seans iptal ettim ve yeni randevu talep etmek istiyorum.",
    "",
    "Üye: " + memberName,
  ];
  if (when) lines.push("İptal edilen seans: " + when);
  if (reason) lines.push("İptal nedeni: " + reason);
  var url = "https://wa.me/" + digits + "?text=" + encodeURIComponent(lines.join("\n"));
  window.open(url, "_blank", "noopener,noreferrer");
}

function openMemberSessionCancelModal(sessionId) {
  if (!els.memberSessionCancelModal) return;
  var ctx = findMemberPortalSessionById(sessionId);
  if (!ctx || !ctx.session) return;
  memberSessionCancelPending = { sessionId: Number(sessionId), session: ctx.session, package: ctx.package };
  if (els.memberSessionCancelReason) els.memberSessionCancelReason.value = "";
  if (els.memberSessionCancelReschedule) els.memberSessionCancelReschedule.checked = false;
  if (els.memberSessionCancelError) {
    els.memberSessionCancelError.classList.add("hidden");
    els.memberSessionCancelError.textContent = "";
  }
  if (els.memberSessionCancelInfo) {
    var isFlexible = ctx.package && ctx.package.packageType === "flexible";
    els.memberSessionCancelInfo.classList.toggle("hidden", !isFlexible);
  }
  updateMemberSessionCancelReasonCount();
  suspendMemberPortalSessionsModal();
  els.memberSessionCancelModal.classList.remove("hidden");
}

function closeMemberSessionCancelModal() {
  memberSessionCancelPending = null;
  if (els.memberSessionCancelModal) els.memberSessionCancelModal.classList.add("hidden");
  restoreMemberPortalSessionsModalIfSuspended();
}

async function submitMemberSessionCancel() {
  if (!memberSessionCancelPending) return;
  var sessionId = memberSessionCancelPending.sessionId;
  var session = memberSessionCancelPending.session;
  var reason = els.memberSessionCancelReason ? els.memberSessionCancelReason.value.trim() : "";
  var requestNew = els.memberSessionCancelReschedule && els.memberSessionCancelReschedule.checked;
  if (els.memberSessionCancelError) {
    els.memberSessionCancelError.classList.add("hidden");
    els.memberSessionCancelError.textContent = "";
  }
  if (els.memberPortalSessionsError) {
    els.memberPortalSessionsError.classList.add("hidden");
    els.memberPortalSessionsError.textContent = "";
  }
  if (els.memberSessionCancelConfirmBtn) els.memberSessionCancelConfirmBtn.disabled = true;
  try {
    await cancelMemberSessionById(sessionId, { reason: reason, requestNewAppointment: requestNew });
    closeMemberSessionCancelModal();
    if (requestNew) openInstitutionWhatsAppForReschedule(session, reason);
  } catch (e) {
    var msg = (e.data && e.data.error) || e.message || "İptal başarısız";
    if (els.memberSessionCancelError) {
      els.memberSessionCancelError.textContent = msg;
      els.memberSessionCancelError.classList.remove("hidden");
    }
    if (els.memberPortalSessionsError) {
      els.memberPortalSessionsError.textContent = msg;
      els.memberPortalSessionsError.classList.remove("hidden");
    }
  } finally {
    if (els.memberSessionCancelConfirmBtn) els.memberSessionCancelConfirmBtn.disabled = false;
  }
}

async function cancelMemberSessionFromPortal(sessionId) {
  if (!sessionId || !window.API || !window.API.cancelMemberSession) return;
  openMemberSessionCancelModal(sessionId);
}

function fillAdminProfileModal() {
  var profile = resolveUserProfile(ui.currentUser || {});
  if (els.adminProfileName) {
    els.adminProfileName.textContent = profile.name;
  }
  if (els.adminProfileEmail) {
    els.adminProfileEmail.textContent = profile.email;
  }
  if (els.adminProfilePhone) {
    els.adminProfilePhone.textContent = profile.phone;
  }
  loadAdminProfileWhatsappDisplay();
}

function canManageInstitutionWhatsapp() {
  var role = ui.currentUser && ui.currentUser.role;
  return role === "admin" || role === "manager";
}

async function loadAdminProfileWhatsappDisplay() {
  if (!els.adminProfileWhatsappRow || !els.adminProfileWhatsapp) return;
  var show = canManageInstitutionWhatsapp();
  els.adminProfileWhatsappRow.classList.toggle("hidden", !show);
  if (!show) return;
  if (!window.API || !window.API.getInstitutionWhatsapp) {
    els.adminProfileWhatsapp.textContent = "—";
    return;
  }
  try {
    var data = await window.API.getInstitutionWhatsapp();
    els.adminProfileWhatsapp.textContent = (data && data.whatsapp) || "—";
  } catch (e) {
    els.adminProfileWhatsapp.textContent = "—";
  }
}

function resetAdminAccountPasswordToggles() {
  ["adminAccountCurrentPassword", "adminAccountNewPassword", "adminAccountConfirmPassword"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) input.type = "password";
  });
  document.querySelectorAll("#adminAccountScreen .pw-change__toggle").forEach(function (btn) {
    btn.classList.remove("pw-change__toggle--visible");
    btn.setAttribute("aria-label", "Şifreyi göster");
  });
}

async function openAdminAccountScreen() {
  var screen = document.getElementById("adminAccountScreen");
  if (!screen || !ui.currentUser) return;
  closeAdminHubModal();

  var profile = resolveUserProfile(ui.currentUser);
  var fullNameEl = document.getElementById("adminAccountFullName");
  var emailEl = document.getElementById("adminAccountEmail");
  var phoneEl = document.getElementById("adminAccountPhone");
  var whatsappWrap = document.getElementById("adminAccountWhatsappWrap");
  var whatsappEl = document.getElementById("adminAccountWhatsapp");
  var errEl = document.getElementById("adminAccountError");
  var form = document.getElementById("adminAccountForm");

  if (form) form.reset();
  resetAdminAccountPasswordToggles();
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  if (fullNameEl) fullNameEl.value = profile.name === "—" ? "" : profile.name;
  if (emailEl) emailEl.value = profile.email === "—" ? "" : profile.email;
  if (phoneEl) phoneEl.value = profile.phone === "—" ? "" : profile.phone;

  var showWa = canManageInstitutionWhatsapp();
  if (whatsappWrap) whatsappWrap.classList.toggle("hidden", !showWa);
  if (showWa && whatsappEl && window.API && window.API.getInstitutionWhatsapp) {
    try {
      var data = await window.API.getInstitutionWhatsapp();
      whatsappEl.value = (data && data.whatsapp) || "";
    } catch (e) {
      whatsappEl.value = "";
    }
  }

  var legalLinksWrap = document.getElementById("adminAccountLegalLinksWrap");
  var showLegalLinks = canManageInstitutionWhatsapp();
  if (legalLinksWrap) legalLinksWrap.classList.toggle("hidden", !showLegalLinks);
  ui.adminAccountLegalLinksLoaded = false;
  if (showLegalLinks && window.API && window.API.getLegalLinks) {
    try {
      var legalLinks = await window.API.getLegalLinks();
      var legalFieldMap = {
        adminAccountPrivacyPolicyUrl: "privacyPolicyUrl",
        adminAccountExplicitConsentUrl: "explicitConsentUrl",
        adminAccountTermsUrl: "termsOfUseUrl",
        adminAccountCookiePolicyUrl: "cookiePolicyUrl",
      };
      Object.keys(legalFieldMap).forEach(function (inputId) {
        var input = document.getElementById(inputId);
        if (input) input.value = (legalLinks && legalLinks[legalFieldMap[inputId]]) || "";
      });
      ui.adminAccountLegalLinksLoaded = true;
    } catch (e) {
      /* yüklenemezse alanlar boş kalır; kaydetmede legalLinks gönderilmez, mevcut değerler korunur */
    }
  }

  screen.classList.remove("hidden");
  screen.setAttribute("aria-hidden", "false");
  bindPasswordVisibilityToggles(screen);
}

function closeAdminAccountScreen() {
  var screen = document.getElementById("adminAccountScreen");
  if (screen) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
}

function bindAdminAccountScreen() {
  var form = document.getElementById("adminAccountForm");
  var backBtn = document.getElementById("adminAccountBackBtn");
  var cancelBtn = document.getElementById("adminAccountCancelBtn");
  var errEl = document.getElementById("adminAccountError");
  var submitBtn = document.getElementById("adminAccountSubmitBtn");
  if (!form || !window.API || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  if (backBtn) {
    backBtn.addEventListener("click", closeAdminAccountScreen);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeAdminAccountScreen);
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var fullName = (document.getElementById("adminAccountFullName") || {}).value || "";
    var email = (document.getElementById("adminAccountEmail") || {}).value || "";
    var phone = (document.getElementById("adminAccountPhone") || {}).value || "";
    var whatsappEl = document.getElementById("adminAccountWhatsapp");
    var current = (document.getElementById("adminAccountCurrentPassword") || {}).value || "";
    var newPw = (document.getElementById("adminAccountNewPassword") || {}).value || "";
    var confirmPw = (document.getElementById("adminAccountConfirmPassword") || {}).value || "";

    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (!fullName.trim()) {
      if (errEl) {
        errEl.textContent = "Ad soyad gerekli.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (!email.trim()) {
      if (errEl) {
        errEl.textContent = "E-posta gerekli.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (newPw || confirmPw) {
      if (newPw.length < 6) {
        if (errEl) {
          errEl.textContent = "Yeni şifre en az 6 karakter olmalı.";
          errEl.classList.remove("hidden");
        }
        return;
      }
      if (newPw !== confirmPw) {
        if (errEl) {
          errEl.textContent = "Şifreler eşleşmiyor.";
          errEl.classList.remove("hidden");
        }
        return;
      }
      if (!current) {
        if (errEl) {
          errEl.textContent = "Şifre değiştirmek için mevcut şifrenizi girin.";
          errEl.classList.remove("hidden");
        }
        return;
      }
    }

    var payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    if (canManageInstitutionWhatsapp() && whatsappEl) {
      payload.whatsapp = whatsappEl.value.trim();
    }
    if (canManageInstitutionWhatsapp() && ui.adminAccountLegalLinksLoaded) {
      payload.legalLinks = {
        privacyPolicyUrl: (document.getElementById("adminAccountPrivacyPolicyUrl") || {}).value || "",
        explicitConsentUrl: (document.getElementById("adminAccountExplicitConsentUrl") || {}).value || "",
        termsOfUseUrl: (document.getElementById("adminAccountTermsUrl") || {}).value || "",
        cookiePolicyUrl: (document.getElementById("adminAccountCookiePolicyUrl") || {}).value || "",
      };
    }
    if (newPw) {
      payload.currentPassword = current;
      payload.newPassword = newPw;
      payload.confirmPassword = confirmPw;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      var result = await window.API.updateAccountProfile(payload);
      if (result && result.user) {
        ui.currentUser = result.user;
        syncCurrentUserProfile();
      }
      if (result && result.legalLinks) {
        ui.legalLinks = result.legalLinks;
        applyLegalLinksToDom();
      }
      if (isMemberUser() && ui.memberPortal && result && result.user) {
        ui.memberPortal.profile = ui.memberPortal.profile || {};
        ui.memberPortal.profile.fullName = result.user.fullName;
        ui.memberPortal.profile.email = result.user.email;
        ui.memberPortal.profile.phone = result.user.phone;
        fillMemberProfileModal();
      }
      closeAdminAccountScreen();
      fillAdminProfileModal();
      await showAppAlert((result && result.message) || "Bilgileriniz güncellendi.");
    } catch (e) {
      if (errEl) {
        errEl.textContent = (e.data && e.data.error) || e.message || "Kaydedilemedi.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function updateAdminHubNavVisibility() {
  var isAdmin = isAdminUser();
  var profileOnlyMobile = isAdminHubProfileOnlyOnMobile();
  document.querySelectorAll("[data-admin-hub-admin-only]").forEach(function (el) {
    el.classList.toggle("hidden", !isAdmin || profileOnlyMobile);
  });
  if (els.adminHubNav) {
    els.adminHubNav.classList.toggle("admin-hub-nav--profile-only", profileOnlyMobile);
  }
  if (els.adminHubModal) {
    els.adminHubModal.classList.toggle("admin-hub-modal--profile-only", profileOnlyMobile);
  }
  updateDevResetVisibility();
}

function refreshAdminHubSection(section) {
  if (section === "working-hours") prepareWorkingHoursPanel();
  else if (section === "rooms") prepareRoomsPanel();
  else if (section === "packages") preparePackagesPanel();
  else if (section === "staff-list") prepareStaffListPanel();
  else if (section === "dev-reset") prepareDevResetPanel();
  else if (section === "dev-seed") prepareDevSeedPanel();
  else if (section === "profile") fillAdminProfileModal();
}

function setAdminHubSection(section) {
  section = normalizeAdminHubSection(section);
  ui.adminHubSection = section;
  document.querySelectorAll("[data-admin-hub-panel]").forEach(function (panel) {
    var show = panel.getAttribute("data-admin-hub-panel") === section;
    panel.classList.toggle("hidden", !show);
  });
  document.querySelectorAll("[data-admin-hub-section]").forEach(function (btn) {
    var on = btn.getAttribute("data-admin-hub-section") === section;
    btn.classList.toggle("member-profile-nav__btn--active", on);
  });
  refreshAdminHubSection(section);
}

function openAdminHubModal(section) {
  if (!els.adminHubModal) return;
  updateAdminHubNavVisibility();
  setAdminHubSection(section || getAdminHubDefaultSection());
  if (els.adminHubTitle) {
    els.adminHubTitle.textContent = isAdminUser()
      ? (isAdminHubProfileOnlyOnMobile() ? "Hesap İşlemleri" : "Ayarlar")
      : "Profilim";
  }
  els.adminHubModal.classList.remove("hidden");
}

function closeAdminHubModal() {
  if (els.adminHubModal) els.adminHubModal.classList.add("hidden");
  if (devResetPreviewTimer) {
    clearTimeout(devResetPreviewTimer);
    devResetPreviewTimer = null;
  }
}


function openAdminChangePasswordModal() {
  openPasswordChangeScreen("change");
}

function closeAdminChangePasswordModal() {
  closePasswordChangeScreen();
}

var passwordChangeMode = "change";

function bindPasswordVisibilityToggles(root) {
  if (!root) return;
  root.querySelectorAll("[data-pw-toggle]").forEach(function (btn) {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-pw-toggle"));
      if (!input) return;
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("pw-change__toggle--visible", show);
      btn.setAttribute("aria-label", show ? "Şifreyi gizle" : "Şifreyi göster");
    });
  });
}

function resetPasswordChangeToggles() {
  document.querySelectorAll(".pw-change__toggle").forEach(function (btn) {
    btn.classList.remove("pw-change__toggle--visible");
    btn.setAttribute("aria-label", "Şifreyi göster");
  });
  ["passwordChangeCurrent", "passwordChangeNew", "passwordChangeConfirm"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) input.type = "password";
  });
}

function openPasswordChangeScreen(mode) {
  mode = mode === "initial" ? "initial" : "change";
  passwordChangeMode = mode;
  var screen = document.getElementById("passwordChangeScreen");
  if (!screen) return;

  bindPasswordChangeScreen();
  closeAdminHubModal();
  closeMemberProfileModal();

  var backBtn = document.getElementById("passwordChangeBackBtn");
  var currentWrap = document.getElementById("passwordChangeCurrentWrap");
  var heroTitle = document.getElementById("passwordChangeHeroTitle");
  var headerTitle = document.getElementById("passwordChangeHeaderTitle");
  var infoEl = document.getElementById("passwordChangeInfo");
  var submitLabel = document.getElementById("passwordChangeSubmitLabel");
  var form = document.getElementById("passwordChangeForm");
  var errEl = document.getElementById("passwordChangeError");
  var currentInput = document.getElementById("passwordChangeCurrent");

  if (form) form.reset();
  resetPasswordChangeToggles();
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }

  var isInitial = mode === "initial";
  if (backBtn) backBtn.classList.toggle("hidden", isInitial);
  if (currentWrap) currentWrap.classList.toggle("hidden", isInitial);
  if (currentInput) currentInput.required = !isInitial;
  if (headerTitle) headerTitle.textContent = isInitial ? "Şifrenizi Belirleyin" : "Şifre Değiştir";
  if (heroTitle) heroTitle.textContent = isInitial ? "İlk Şifre Belirleme" : "Şifre Değiştirme";
  if (infoEl) {
    infoEl.textContent = isInitial
      ? "İlk girişiniz. Lütfen yeni şifrenizi tanımlayın; sonraki girişlerde bu şifreyi kullanacaksınız."
      : "Güvenliğiniz için şifrenizi düzenli olarak değiştirmenizi öneririz.";
  }
  if (submitLabel) submitLabel.textContent = isInitial ? "Kaydet ve Devam Et" : "Şifreyi Değiştir";

  screen.classList.remove("hidden");
  screen.setAttribute("aria-hidden", "false");

  var main = document.getElementById("mainApp");
  if (isInitial) {
    if (main) main.style.visibility = "hidden";
  } else if (isMemberUser() && els.memberTabBar) {
    els.memberTabBar.classList.add("hidden");
  }

  bindPasswordVisibilityToggles(screen);
}

function closePasswordChangeScreen() {
  var screen = document.getElementById("passwordChangeScreen");
  if (screen) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
  var main = document.getElementById("mainApp");
  if (main) main.style.visibility = "";
  if (isMemberUser()) updateMemberTabUI();
}

function bindPasswordChangeScreen() {
  var form = document.getElementById("passwordChangeForm");
  var errEl = document.getElementById("passwordChangeError");
  var btn = document.getElementById("passwordChangeSubmitBtn");
  var backBtn = document.getElementById("passwordChangeBackBtn");
  if (!form || !window.API || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (passwordChangeMode === "initial") return;
      closePasswordChangeScreen();
    });
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var current = (document.getElementById("passwordChangeCurrent") || {}).value || "";
    var newPw = (document.getElementById("passwordChangeNew") || {}).value || "";
    var confirmPw = (document.getElementById("passwordChangeConfirm") || {}).value || "";
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (!newPw || newPw.length < 6) {
      if (errEl) {
        errEl.textContent = "Yeni şifre en az 6 karakter olmalı.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (newPw !== confirmPw) {
      if (errEl) {
        errEl.textContent = "Şifreler eşleşmiyor.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (passwordChangeMode === "change" && !current) {
      if (errEl) {
        errEl.textContent = "Mevcut şifrenizi girin.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (btn) btn.disabled = true;
    try {
      if (passwordChangeMode === "initial") {
        await window.API.setPassword(newPw, confirmPw);
        closePasswordChangeScreen();
        location.reload();
        return;
      }
      await window.API.changePassword(current, newPw, confirmPw);
      closePasswordChangeScreen();
      await showAppAlert("Şifreniz güncellendi.");
    } catch (e) {
      if (errEl) {
        errEl.textContent =
          (e.data && e.data.error) || e.message || (passwordChangeMode === "initial" ? "Şifre kaydedilemedi." : "Şifre güncellenemedi.");
        errEl.classList.remove("hidden");
      }
      if (btn) btn.disabled = false;
    }
  });
}

function openLegalConsentScreen(onAccepted) {
  var screen = document.getElementById("legalConsentScreen");
  if (!screen) {
    if (typeof onAccepted === "function") onAccepted();
    return;
  }

  bindLegalConsentScreen(onAccepted);
  applyLegalLinksToDom();

  var form = document.getElementById("legalConsentForm");
  var errEl = document.getElementById("legalConsentError");
  if (form) form.reset();
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }

  screen.classList.remove("hidden");
  screen.setAttribute("aria-hidden", "false");

  var main = document.getElementById("mainApp");
  if (main) main.style.visibility = "hidden";
}

function closeLegalConsentScreen() {
  var screen = document.getElementById("legalConsentScreen");
  if (screen) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
  var main = document.getElementById("mainApp");
  if (main) main.style.visibility = "";
}

function bindLegalConsentScreen(onAccepted) {
  var form = document.getElementById("legalConsentForm");
  var errEl = document.getElementById("legalConsentError");
  var checkboxIds = [
    "legalConsentCheckboxPrivacy",
    "legalConsentCheckboxTerms",
    "legalConsentCheckboxExplicitConsent",
    "legalConsentCheckboxCookie",
  ];
  var submitBtn = document.getElementById("legalConsentSubmitBtn");
  if (!form || !window.API) return;

  form.onsubmit = async function (ev) {
    ev.preventDefault();
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    var allChecked = checkboxIds.every(function (id) {
      var el = document.getElementById(id);
      return el && el.checked;
    });
    if (!allChecked) {
      if (errEl) {
        errEl.textContent = "Devam etmek için tüm onay kutularını işaretleyin.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    try {
      await window.API.acceptConsent();
      closeLegalConsentScreen();
      if (typeof onAccepted === "function") onAccepted();
    } catch (e) {
      if (errEl) {
        errEl.textContent = "Onayınız kaydedilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

function applyLegalLinksToDom() {
  var links = ui.legalLinks || {};
  var map = {
    legalConsentLinkPrivacy: links.privacyPolicyUrl,
    legalConsentLinkExplicitConsent: links.explicitConsentUrl,
    legalConsentLinkTerms: links.termsOfUseUrl,
    legalConsentLinkCookie: links.cookiePolicyUrl,
    loginFooterLinkPrivacy: links.privacyPolicyUrl,
    loginFooterLinkExplicitConsent: links.explicitConsentUrl,
    loginFooterLinkTerms: links.termsOfUseUrl,
    loginFooterLinkCookie: links.cookiePolicyUrl,
  };
  Object.keys(map).forEach(function (id) {
    var url = map[id];
    if (!url) return;
    var el = document.getElementById(id);
    if (el) el.setAttribute("href", url);
  });
}

async function loadLegalLinks() {
  if (!window.API || !window.API.getLegalLinks) return;
  try {
    var links = await window.API.getLegalLinks();
    if (links) {
      ui.legalLinks = links;
      applyLegalLinksToDom();
    }
  } catch (e) {
    /* ağ hatası: varsayılan href'ler (HTML'deki) kullanılır */
  }
}

async function performLogout() {
  if (isMemberUser() || isStaffUser()) {
    var ok = await showAppConfirm("Oturumunuz kapatılsın mı?", {
      title: "Çıkış yap",
      okLabel: "Çıkış Yap",
      okClass: "btn--danger",
      compactDialog: true,
    });
    if (!ok) return;
  }
  if (window.API && window.API.logout) {
    await window.API.logout();
  } else if (window.API) {
    window.API.removeToken();
  }
  try { localStorage.removeItem("seans_planner_v1"); } catch (_) {}
  location.reload();
}

function bindAdminHubNav() {
  document.querySelectorAll("[data-admin-hub-open-logs]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openActivityLogsPage();
    });
  });
  document.querySelectorAll("[data-admin-hub-section]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setAdminHubSection(btn.getAttribute("data-admin-hub-section"));
    });
  });
}

function bindMemberProfileActions() {
  if (els.memberHomeSettingsBtn) {
    els.memberHomeSettingsBtn.addEventListener("click", openMemberSettings);
  }
  if (els.memberSessionsTabUpcoming) {
    els.memberSessionsTabUpcoming.addEventListener("click", function () {
      setMemberSessionsView("upcoming");
    });
  }
  if (els.memberSessionsTabPast) {
    els.memberSessionsTabPast.addEventListener("click", function () {
      setMemberSessionsView("past");
    });
  }
  if (els.memberProfileBackBtn) {
    els.memberProfileBackBtn.addEventListener("click", function () {
      setMemberTab("home");
    });
  }
  if (els.memberPackagesBackBtn) {
    els.memberPackagesBackBtn.addEventListener("click", function () {
      setMemberTab("home");
    });
  }
  if (els.memberInlinePackagesBtn) {
    els.memberInlinePackagesBtn.addEventListener("click", function () {
      setMemberTab("packages");
    });
  }
  if (els.memberQrFabBtn) {
    els.memberQrFabBtn.addEventListener("click", openMemberQrModal);
  }
  if (els.memberQrModal) {
    els.memberQrModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberQrModal") closeMemberQrModal();
    });
  }
  if (els.openEntryListBtn) {
    els.openEntryListBtn.addEventListener("click", function () {
      openEntryListModal();
    });
  }
  if (els.adminEntryListView) {
    els.adminEntryListView.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-entry-action]");
      if (btn) {
        var sid = btn.dataset.sessionId;
        var action = btn.dataset.entryAction;
        if (sid && action) submitCalendarAttendanceAction(sid, action, true);
      }
    });
  }
  if (els.entryListRefreshBtn) {
    els.entryListRefreshBtn.addEventListener("click", refreshEntryListModal);
  }
  if (els.entryListTabSessions) {
    els.entryListTabSessions.addEventListener("click", function () {
      if (entryListViewMode === "sessions") return;
      setEntryListViewMode("sessions");
      refreshEntryListModal();
    });
  }
  if (els.entryListTabWalkIns) {
    els.entryListTabWalkIns.addEventListener("click", function () {
      if (entryListViewMode === "walk_ins") return;
      setEntryListViewMode("walk_ins");
      refreshEntryListModal();
    });
  }
  if (els.memberSessionCancelModal) {
    els.memberSessionCancelModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberSessionCancelModal") {
        closeMemberSessionCancelModal();
      }
    });
  }
  if (els.memberSessionCancelReason) {
    els.memberSessionCancelReason.addEventListener("input", updateMemberSessionCancelReasonCount);
  }
  if (els.memberSessionCancelConfirmBtn) {
    els.memberSessionCancelConfirmBtn.addEventListener("click", submitMemberSessionCancel);
  }
  if (els.memberInlineUpdateInfoBtn) {
    els.memberInlineUpdateInfoBtn.addEventListener("click", function () {
      openAdminAccountScreen();
    });
  }
  if (els.memberInlineDeleteAccountBtn) {
    els.memberInlineDeleteAccountBtn.addEventListener("click", requestMemberAccountDeletion);
  }
  if (els.memberInlineLogoutBtn) {
    els.memberInlineLogoutBtn.addEventListener("click", performLogout);
  }
  if (els.memberSessionsBtn) {
    els.memberSessionsBtn.addEventListener("click", openMemberActivePackageSessions);
  }
  if (els.memberProfileBtn) {
    els.memberProfileBtn.addEventListener("click", function () {
      openMemberSettings();
    });
  }
  document.querySelectorAll("[data-member-profile-section]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setMemberProfileSection(btn.getAttribute("data-member-profile-section"));
    });
  });
  if (els.memberProfileChangePasswordBtn) {
    els.memberProfileChangePasswordBtn.addEventListener("click", function () {
      closeMemberProfileModal();
      openAdminChangePasswordModal();
    });
  }
  if (els.memberProfileLogoutBtn) {
    els.memberProfileLogoutBtn.addEventListener("click", performLogout);
  }
  if (els.memberProfileModal) {
    els.memberProfileModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberProfileModal") closeMemberProfileModal();
    });
  }
}

function bindAdminProfileActions() {
  if (els.openAdminHubBtn) {
    els.openAdminHubBtn.addEventListener("click", function () {
      closeSidebar();
      openAdminHubModal(getAdminHubDefaultSection());
    });
  }
  if (els.adminMobileAddSessionBtn) {
    els.adminMobileAddSessionBtn.addEventListener("click", function () {
      openGroupSessionModal(null);
    });
  }
  if (els.adminMobileSidebarBtn) {
    els.adminMobileSidebarBtn.addEventListener("click", toggleSidebar);
  }
  if (els.staffMobileSidebarBtn) {
    els.staffMobileSidebarBtn.addEventListener("click", toggleSidebar);
  }
  bindAdminHubNav();
  if (els.openStaffAddBtn) {
    els.openStaffAddBtn.addEventListener("click", openStaffAddModal);
  }
  if (els.staffAddModal) {
    els.staffAddModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "staffAddModal") closeStaffAddModal();
    });
  }
  if (els.adminProfileUpdateBtn) {
    els.adminProfileUpdateBtn.addEventListener("click", openAdminAccountScreen);
  }
  if (els.adminProfileLogoutBtn) {
    els.adminProfileLogoutBtn.addEventListener("click", performLogout);
  }
  bindPasswordChangeScreen();
  bindAdminAccountScreen();
  if (els.adminHubModal) {
    els.adminHubModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "adminHubModal") closeAdminHubModal();
    });
  }
}

function getSelectedDevResetTargets() {
  if (!els.devResetCheckboxes) return [];
  var checked = els.devResetCheckboxes.querySelectorAll('input[type="checkbox"][data-target]:checked');
  var targets = [];
  checked.forEach(function (cb) {
    if (cb.dataset.target) targets.push(cb.dataset.target);
  });
  return targets;
}

function renderDevResetWarnings(preview) {
  if (!els.devResetWarnings) return;
  var parts = [];
  if (preview && preview.autoAdded && preview.autoAdded.length) {
    var labels = (devResetMeta && devResetMeta.groups || []).reduce(function (acc, g) {
      acc[g.id] = g.label;
      return acc;
    }, {});
    var autoLabels = preview.autoAdded.map(function (id) { return labels[id] || id; });
    parts.push("<strong>Otomatik eklenecek:</strong> " + escapeHtml(autoLabels.join(", ")));
  }
  if (preview && preview.warnings && preview.warnings.length) {
    preview.warnings.forEach(function (w) {
      var msgs = (w.messages || []).map(function (m) { return escapeHtml(m); }).join("<br>");
      parts.push("<strong>" + escapeHtml(w.label || w.group) + ":</strong><br>" + msgs);
    });
  }
  if (parts.length === 0) {
    els.devResetWarnings.style.display = "none";
    els.devResetWarnings.innerHTML = "";
    return;
  }
  els.devResetWarnings.style.display = "block";
  els.devResetWarnings.innerHTML = "<div style=\"font-size:13px; line-height:1.45;\">⚠ " + parts.join("<br><br>") + "</div>";
}

function refreshDevResetPreview() {
  if (devResetPreviewTimer) clearTimeout(devResetPreviewTimer);
  devResetPreviewTimer = setTimeout(function () {
    devResetPreviewTimer = null;
    var targets = getSelectedDevResetTargets();
    if (!targets.length) {
      renderDevResetWarnings(null);
      return;
    }
    if (!window.API || !window.API.previewDevReset) return;
    window.API.previewDevReset(targets).then(function (preview) {
      renderDevResetWarnings(preview);
    }).catch(function () {
      renderDevResetWarnings(null);
    });
  }, 200);
}

function renderDevResetCheckboxes() {
  if (!els.devResetCheckboxes || !devResetMeta) return;
  els.devResetCheckboxes.innerHTML = "";
  var groups = devResetMeta.groups || [];
  var counts = devResetMeta.counts || {};
  groups.forEach(function (g) {
    var cnt = counts[g.id];
    var cntStr;
    if (cnt == null) cntStr = " (sayı alınamadı)";
    else cntStr = " (" + cnt + " kayıt)";
    var row = document.createElement("label");
    row.className = "checkboxRow";
    row.style.cssText = "display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.06); cursor:pointer;";
    row.innerHTML =
      '<input type="checkbox" data-target="' + escapeHtml(g.id) + '" style="margin-top:3px;" />' +
      '<span><strong>' + escapeHtml(g.label) + '</strong>' + escapeHtml(cntStr) +
      '<br><span class="hint" style="font-size:12px;">' + escapeHtml(g.description || "") + '</span></span>';
    var cb = row.querySelector("input");
    cb.addEventListener("change", refreshDevResetPreview);
    els.devResetCheckboxes.appendChild(row);
  });
}

function prepareDevResetPanel() {
  if (!window.API || !window.API.getDevResetMeta) return;
  if (els.devResetError) {
    els.devResetError.classList.add("hidden");
    els.devResetError.textContent = "";
  }
  if (els.devResetAdminPassword) els.devResetAdminPassword.value = "";
  if (els.devResetCheckboxes) {
    els.devResetCheckboxes.innerHTML = "<div class=\"hint\" style=\"padding:12px 0;\">Yükleniyor…</div>";
  }
  renderDevResetWarnings(null);
  window.API.getDevResetMeta().then(function (meta) {
    devResetMeta = meta;
    renderDevResetCheckboxes();
  }).catch(function (err) {
    if (els.devResetError) {
      els.devResetError.textContent = (err && (err.message || err.error)) || "Sıfırlama bilgisi alınamadı.";
      els.devResetError.classList.remove("hidden");
    }
    if (els.devResetCheckboxes) els.devResetCheckboxes.innerHTML = "";
  });
}

function openDevResetModal() {
  openAdminHubModal("dev-reset");
}

function renderDevSeedStatus(meta) {
  if (!els.devSeedStatus) return;
  if (!meta) {
    els.devSeedStatus.textContent = "Durum yüklenemedi.";
    return;
  }
  var parts = [
    "Mevcut test üyesi: " + (meta.seedMemberCount != null ? meta.seedMemberCount : "—"),
    "Personel: " + (meta.staffCount != null ? meta.staffCount : "—"),
    "Slot (personel×gün×saat): " + (meta.slotCount != null ? meta.slotCount : "—"),
    "Paket: " + (meta.packageCount != null ? meta.packageCount : "—"),
    "Oda: " + (meta.roomCount != null ? meta.roomCount : "—"),
  ];
  if (meta.staffWithSlots != null && meta.staffCount != null) {
    parts.push("Çalışma saati tanımlı personel: " + meta.staffWithSlots + "/" + meta.staffCount);
  }
  if (!meta.ready && meta.missing && meta.missing.length) {
    parts.push("Eksik: " + meta.missing.join(", "));
  }
  els.devSeedStatus.textContent = parts.join(" · ");
  if (els.devSeedConfirmBtn) {
    els.devSeedConfirmBtn.disabled = !meta.ready;
  }
  if (els.devSeedCount && meta.defaultCount && !els.devSeedCount.dataset.userEdited) {
    els.devSeedCount.value = String(meta.defaultCount);
  }
}

function prepareDevSeedPanel() {
  if (els.devSeedError) {
    els.devSeedError.classList.add("hidden");
    els.devSeedError.textContent = "";
  }
  if (els.devSeedSuccess) {
    els.devSeedSuccess.classList.add("hidden");
    els.devSeedSuccess.textContent = "";
  }
  if (els.devSeedAdminPassword) els.devSeedAdminPassword.value = "";
  if (els.devSeedCount) {
    if (!els.devSeedCount.dataset.userEdited) els.devSeedCount.value = "110";
  }
  if (els.devSeedStatus) els.devSeedStatus.textContent = "Yükleniyor…";
  if (!window.API || !window.API.getDevSeedMeta) return;
  window.API.getDevSeedMeta().then(function (meta) {
    renderDevSeedStatus(meta);
  }).catch(function (err) {
    if (els.devSeedError) {
      els.devSeedError.textContent = (err && (err.message || err.error)) || "Test üye bilgisi alınamadı.";
      els.devSeedError.classList.remove("hidden");
    }
    renderDevSeedStatus(null);
  });
}

function openDevSeedModal() {
  openAdminHubModal("dev-seed");
}

async function confirmDevSeed() {
  if (!window.API || !window.API.seedTestMembers) return;
  if (els.devSeedError) {
    els.devSeedError.classList.add("hidden");
    els.devSeedError.textContent = "";
  }
  if (els.devSeedSuccess) {
    els.devSeedSuccess.classList.add("hidden");
    els.devSeedSuccess.textContent = "";
  }
  var count = parseInt((els.devSeedCount && els.devSeedCount.value) || "110", 10);
  if (!count || count < 1) count = 110;
  if (count > 200) count = 200;
  var password = (els.devSeedAdminPassword && els.devSeedAdminPassword.value) || "";
  if (!password) {
    if (els.devSeedError) {
      els.devSeedError.textContent = "Onay için admin şifrenizi girin.";
      els.devSeedError.classList.remove("hidden");
    }
    return;
  }
  if (!(await showAppConfirm(count + " test üyesi oluşturulsun mu?\n\nHer üyeye farklı gün/saat/personel/paket atanır. Mevcut @seed.local üyeler atlanır."))) {
    return;
  }
  if (els.devSeedConfirmBtn) els.devSeedConfirmBtn.disabled = true;
  try {
    var result = await window.API.seedTestMembers(count, password);
    if (els.devSeedSuccess) {
      var msg = (result && result.message) || "Test üyeleri oluşturuldu.";
      if (result && result.staffAssigned != null) {
        msg += " (" + result.staffAssigned + " personele atama yapıldı.)";
      }
      if (result && result.sessionConflicts > 0) {
        msg += " (" + result.sessionConflicts + " seans günü oda dolu olduğu için atlanamadı.)";
      }
      els.devSeedSuccess.textContent = msg;
      els.devSeedSuccess.classList.remove("hidden");
    }
    if (els.devSeedAdminPassword) els.devSeedAdminPassword.value = "";
    if (window.API.loadFullState) {
      var fetchRange = getPlannerFetchRange();
      var loaded = await window.API.loadFullState(fetchRange);
      applyStateFromApi(loaded, fetchRange);
      render();
    }
    if (window.API.getDevSeedMeta) {
      var meta = await window.API.getDevSeedMeta();
      renderDevSeedStatus(meta);
    }
  } catch (err) {
    if (els.devSeedError) {
      els.devSeedError.textContent = (err && (err.data && err.data.error) || err.message || err.error) || "Test üyeleri oluşturulamadı.";
      els.devSeedError.classList.remove("hidden");
    }
  } finally {
    if (window.API && window.API.getDevSeedMeta) {
      window.API.getDevSeedMeta().then(renderDevSeedStatus).catch(function () {
        if (els.devSeedConfirmBtn) els.devSeedConfirmBtn.disabled = false;
      });
    } else if (els.devSeedConfirmBtn) {
      els.devSeedConfirmBtn.disabled = false;
    }
  }
}

async function confirmDevReset() {
  if (!window.API || !window.API.executeDevReset) return;
  var targets = getSelectedDevResetTargets();
  if (els.devResetError) {
    els.devResetError.classList.add("hidden");
    els.devResetError.textContent = "";
  }
  if (!targets.length) {
    if (els.devResetError) {
      els.devResetError.textContent = "En az bir veri grubu seçin.";
      els.devResetError.classList.remove("hidden");
    }
    return;
  }
  var password = (els.devResetAdminPassword && els.devResetAdminPassword.value) || "";
  if (!password) {
    if (els.devResetError) {
      els.devResetError.textContent = "Onay için admin şifrenizi girin.";
      els.devResetError.classList.remove("hidden");
    }
    return;
  }
  var labels = (devResetMeta && devResetMeta.groups || []).reduce(function (acc, g) {
    acc[g.id] = g.label;
    return acc;
  }, {});
  var labelList = targets.map(function (id) { return labels[id] || id; }).join(", ");
  if (!(await showAppConfirm(
    "Seçilen veriler kalıcı olarak silinecek:\n\n" + labelList +
    "\n\nBu işlem geri alınamaz. Devam edilsin mi?"
  ))) return;

  if (els.devResetConfirmBtn) els.devResetConfirmBtn.disabled = true;
  try {
    await window.API.executeDevReset(targets, password);
    closeAdminHubModal();
    closeListMembersModal();
    var fetchRange = getPlannerFetchRange();
    var loaded = await window.API.loadFullState(fetchRange);
    applyStateFromApi(loaded, fetchRange);
    render();
    await showAppAlert("Seçilen veriler sıfırlandı.");
  } catch (err) {
    if (els.devResetError) {
      els.devResetError.textContent = (err && (err.data && err.data.error) || err.message || err.error) || "Sıfırlama başarısız.";
      els.devResetError.classList.remove("hidden");
    }
  } finally {
    if (els.devResetConfirmBtn) els.devResetConfirmBtn.disabled = false;
  }
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
  updatePackagesSummary();
  renderPackages();
}

async function deletePackage(id) {
  const p = state.packages.find((x) => x.id === id);
  if (!p || !(await showAppConfirm(`"${p.name}" paketini silmek istediğinize emin misiniz?`))) return;

  if (window.API && window.API.getToken()) {
    try {
      await window.API.deletePackage(id);
    } catch (e) {
      await showAppAlert((e.data && e.data.error) || e.message || "Paket silinemedi.");
      return;
    }
  }

  state.packages = (state.packages || []).filter((x) => x.id !== id);
  if (editingPackageId === id) clearPackageForm();
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
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const s of state.staff) {
    const fullName = getStaffFullName(s);
    const card = document.createElement("div");
    card.className = "panel staff-card";
    card.innerHTML = `
      <div class="staff-card__head">
        <div class="staff-card__info">
          <div class="staff-card__name">${escapeHtml(fullName)}</div>
          <div class="staff-card__meta">${escapeHtml(displayPhone(s.phone) || "Telefon yok")}</div>
          ${s.email ? `<div class="staff-card__meta">${escapeHtml(s.email)}</div>` : ""}
        </div>
        <div class="staff-card__actions">
          <button class="btn btn--xs btn--ghost" type="button" data-action="edit">Düzenle</button>
          <button class="btn btn--xs btn--ghost" type="button" data-action="hours">Çalışma Saatleri</button>
        </div>
      </div>
      <div class="staff-card__hours-summary">
        Çalışma saatleri: ${escapeHtml(getStaffWorkingHoursSummary(s))}
      </div>
    `;
    card.querySelector("button[data-action='edit']").addEventListener("click", () => openStaffEditModal(s.id));
    card.querySelector("button[data-action='hours']").addEventListener("click", () => openStaffHoursModal(s.id));
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

function prepareStaffListPanel() {
  if (els.staffError) els.staffError.classList.add("hidden");
  renderStaff();
}

function openStaffAddModal() {
  if (!els.staffAddModal) return;
  if (els.staffError) els.staffError.classList.add("hidden");
  if (els.newStaffFirstName) els.newStaffFirstName.value = "";
  if (els.newStaffLastName) els.newStaffLastName.value = "";
  if (els.newStaffPhone) {
    els.newStaffPhone.value = "";
    els.newStaffPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.newStaffPhone.addEventListener("blur", formatPhoneOnBlur);
  }
  if (els.newStaffEmail) els.newStaffEmail.value = "";
  els.staffAddModal.classList.remove("hidden");
}

function closeStaffAddModal() {
  if (els.staffAddModal) els.staffAddModal.classList.add("hidden");
}

function openStaffModal() {
  openAdminHubModal("staff-list");
}

function renderStaffWorkingHoursList(container, workingHours, idPrefix) {
  if (!container) return;
  container.innerHTML = "";
  for (let day = 0; day < 7; day++) {
    const wh = workingHours?.[day] || { start: "08:00", end: "20:00", enabled: false };
    const enabled = wh.enabled !== false;
    const checkboxId = `${idPrefix}_wh_enabled_${day}`;
    const item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML = `
      <div class="listItem__left">
        <input type="checkbox" id="${checkboxId}" data-day="${day}" ${enabled ? "checked" : ""} />
        <label for="${checkboxId}">
          <div class="listItem__title">${DAY_NAMES[day]}</div>
        </label>
      </div>
      <div class="listItem__actions">
        <input class="input" type="time" data-day="${day}" data-type="start" value="${wh.start || "08:00"}" ${!enabled ? "disabled" : ""} />
        <span class="listItem__sep">–</span>
        <input class="input" type="time" data-day="${day}" data-type="end" value="${wh.end || "20:00"}" ${!enabled ? "disabled" : ""} />
      </div>
    `;
    const checkbox = item.querySelector(`#${checkboxId}`);
    const startInput = item.querySelector(`input[data-type="start"][data-day="${day}"]`);
    const endInput = item.querySelector(`input[data-type="end"][data-day="${day}"]`);
    checkbox.addEventListener("change", (e) => {
      const checked = e.target.checked;
      startInput.disabled = !checked;
      endInput.disabled = !checked;
    });
    container.appendChild(item);
  }
}

function collectWorkingHoursFromList(container) {
  const newWorkingHours = {};
  if (!container) return newWorkingHours;

  const checkboxes = container.querySelectorAll("input[type='checkbox']");
  const timeInputs = container.querySelectorAll("input[type='time']");

  for (const checkbox of checkboxes) {
    const day = Number(checkbox.dataset.day);
    newWorkingHours[day] = { enabled: checkbox.checked };
  }

  for (const input of timeInputs) {
    if (input.disabled) continue;
    const day = Number(input.dataset.day);
    const type = input.dataset.type;
    if (!newWorkingHours[day]) newWorkingHours[day] = { enabled: false };
    newWorkingHours[day][type] = input.value;
  }

  return newWorkingHours;
}

function validateWorkingHours(newWorkingHours, errorEl) {
  if (!errorEl) return true;
  for (const day in newWorkingHours) {
    const wh = newWorkingHours[day];
    if (!wh.enabled) continue;
    if (!wh.start || !wh.end) {
      errorEl.textContent = `${DAY_NAMES[Number(day)]} için başlangıç ve bitiş saati girin.`;
      errorEl.classList.remove("hidden");
      return false;
    }
    const startMin = timeToMinutes(wh.start);
    const endMin = timeToMinutes(wh.end);
    if (endMin <= startMin) {
      errorEl.textContent = `${DAY_NAMES[Number(day)]} için bitiş saati, başlangıçtan sonra olmalı.`;
      errorEl.classList.remove("hidden");
      return false;
    }
  }
  return true;
}

function openStaffEditModal(staffId) {
  const staff = getStaffById(staffId);
  if (!staff || !els.staffEditModal) return;

  els.staffEditError.classList.add("hidden");
  els.staffEditTitle.textContent = `Personel Düzenle: ${getStaffFullName(staff)}`;
  els.editStaffFirstName.value = staff.firstName || "";
  els.editStaffLastName.value = staff.lastName || "";
  els.editStaffPhone.value = displayPhone(staff.phone) || "";
  if (els.editStaffEmail) els.editStaffEmail.value = staff.email || "";

  if (els.editStaffPhone) {
    els.editStaffPhone.removeEventListener("blur", formatPhoneOnBlur);
    els.editStaffPhone.addEventListener("blur", formatPhoneOnBlur);
  }

  els.saveStaffEditBtn.onclick = () => saveStaffEdit(staffId);
  els.deleteStaffEditBtn.onclick = () => deleteStaff(staffId);
  if (els.resetStaffPasswordBtn) {
    const isAdmin = isAdminUser();
    els.resetStaffPasswordBtn.classList.toggle("hidden", !isAdmin);
    els.resetStaffPasswordBtn.onclick = () => resetStaffPasswordForCard(staffId);
  }

  els.staffEditModal.classList.remove("hidden");
}

function closeStaffEditModal() {
  if (els.staffEditModal) els.staffEditModal.classList.add("hidden");
}

function openStaffHoursModal(staffId) {
  const staff = getStaffById(staffId);
  if (!staff || !els.staffHoursModal) return;

  els.staffHoursError.classList.add("hidden");
  els.staffHoursTitle.textContent = `Çalışma Saatleri: ${getStaffFullName(staff)}`;
  renderStaffWorkingHoursList(els.staffHoursWorkingHours, staff.workingHours, "staff_hours");
  els.saveStaffHoursBtn.onclick = () => saveStaffHours(staffId);
  els.staffHoursModal.classList.remove("hidden");
}

function closeStaffHoursModal() {
  if (els.staffHoursModal) els.staffHoursModal.classList.add("hidden");
}

async function resetMemberPasswordForCard(memberId) {
  if (!memberId || !isAdminUser()) return;
  if (!(await showAppConfirm("Üye giriş şifresi telefonun son 4 hanesine sıfırlanacak. Devam edilsin mi?"))) return;
  if (window.API && window.API.getToken() && window.API.resetMemberPassword) {
    try {
      const result = await window.API.resetMemberPassword(memberId);
      const loginUser = result.loginUsername || "";
      await showAppAlert(
        "Şifre sıfırlandı.\n" +
        "E-posta: " + loginUser + "\n" +
        "Geçici şifre: telefonun son 4 hanesi\n" +
        "Üye ilk girişte yeni şifre belirleyecek."
      );
    } catch (e) {
      await showAppAlert((e.data && e.data.error) || e.message || "Şifre sıfırlanamadı.");
    }
  }
}

async function resetStaffPasswordForCard(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;
  const name = getStaffFullName(staff);
  if (!(await showAppConfirm(
    name + " personelinin şifresini sıfırlamak istiyor musunuz?\n\n" +
    "Geçici şifre telefon numarasının son 4 hanesi olacak.\n" +
    "Personel bir sonraki girişte yeni şifresini belirleyecek."
  ))) return;

  if (els.staffEditError) els.staffEditError.classList.add("hidden");
  if (window.API && window.API.getToken() && window.API.resetStaffPassword) {
    try {
      const result = await window.API.resetStaffPassword(staffId);
      const loginUser = result.loginUsername || staff.loginUsername || "";
      const tempPw = result.temporaryPassword || "";
      await showAppAlert(
        "Şifre sıfırlandı.\n\n" +
        "E-posta: " + loginUser + "\n" +
        "Geçici şifre: " + tempPw + "\n\n" +
        "Personeli bu bilgilerle giriş yapmaya yönlendirin."
      );
    } catch (e) {
      if (els.staffEditError) {
        els.staffEditError.textContent = (e.data && e.data.error) || e.message || "Şifre sıfırlanamadı.";
        els.staffEditError.classList.remove("hidden");
      }
    }
    return;
  }
  if (els.staffEditError) {
    els.staffEditError.textContent = "Şifre sıfırlama yalnızca backend bağlantısı ile çalışır.";
    els.staffEditError.classList.remove("hidden");
  }
}

function saveStaffEdit(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  els.staffEditError.classList.add("hidden");

  const firstName = (els.editStaffFirstName.value || "").trim();
  const lastName = (els.editStaffLastName.value || "").trim();
  const phoneRaw = (els.editStaffPhone.value || "").trim();
  const phone = phoneRaw ? toPhoneFormat(phoneRaw) : "";
  const email = (els.editStaffEmail && els.editStaffEmail.value || "").trim();

  if (!firstName || !lastName) {
    els.staffEditError.textContent = "Ad ve soyad girin.";
    els.staffEditError.classList.remove("hidden");
    return;
  }
  if (phoneRaw && !phone) {
    els.staffEditError.textContent = "Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.";
    els.staffEditError.classList.remove("hidden");
    return;
  }
  if (email && !isValidEmail(email)) {
    els.staffEditError.textContent = "Geçerli bir e-posta girin.";
    els.staffEditError.classList.remove("hidden");
    return;
  }

  const applyUpdate = function (updated) {
    staff.firstName = updated.firstName ?? firstName;
    staff.lastName = updated.lastName ?? lastName;
    staff.phone = updated.phone ?? (phone || "");
    staff.email = updated.email ?? email;
    closeStaffEditModal();
    updateStaffSummary();
    renderStaff();
    render();
  };

  if (window.API && window.API.getToken() && window.API.updateStaff) {
    window.API.updateStaff(staffId, {
      firstName,
      lastName,
      phone,
      email: email || undefined,
    }).then(applyUpdate).catch(function (e) {
      els.staffEditError.textContent = (e.data && e.data.error) || e.message || "Personel güncellenemedi.";
      els.staffEditError.classList.remove("hidden");
    });
    return;
  }

  applyUpdate({
    firstName,
    lastName,
    phone: phone || "",
    email,
  });
}

function saveStaffHours(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  els.staffHoursError.classList.add("hidden");
  const newWorkingHours = collectWorkingHoursFromList(els.staffHoursWorkingHours);
  if (!validateWorkingHours(newWorkingHours, els.staffHoursError)) return;

  const applyUpdate = function (updated) {
    staff.workingHours = updated.workingHours ?? newWorkingHours;
    closeStaffHoursModal();
    updateStaffSummary();
    renderStaff();
    render();
  };

  if (window.API && window.API.getToken() && window.API.updateStaff) {
    window.API.updateStaff(staffId, { workingHours: newWorkingHours })
      .then(applyUpdate)
      .catch(function (e) {
        els.staffHoursError.textContent = (e.data && e.data.error) || e.message || "Çalışma saatleri kaydedilemedi.";
        els.staffHoursError.classList.remove("hidden");
      });
    return;
  }

  applyUpdate({ workingHours: newWorkingHours });
}

async function deleteStaff(staffId) {
  const staff = getStaffById(staffId);
  if (!staff) return;

  const fullName = getStaffFullName(staff);
  const hasSessions = state.sessions.some((sess) => sess.staffId === staffId);
  if (hasSessions) {
    if (!(await showAppConfirm(`"${fullName}" personeline bağlı seanslar var. Yine de silmek istiyor musunuz?`))) return;
  } else if (!(await showAppConfirm(`"${fullName}" personelini silmek istiyor musunuz?`))) {
    return;
  }

  state.staff = state.staff.filter((x) => x.id !== staffId);
  closeStaffEditModal();
  updateStaffSummary();
  renderStaff();
  render();
}

function getMemberDisplayName(m) {
  if (!m) return "Üye";
  return getMemberFullName(m) || "Üye";
}

/** Üye listesi artık sidebar'da değil, "Üyeleri Listele" modalında gösteriliyor; sidebar boş bırakılır */
function renderMembers() {
  const wrap = els.membersList;
  if (!wrap) return;
  wrap.innerHTML = "";
}

function openMemberCard(memberId) {
  if (memberId == null && isMobilePlanner()) return;
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
  if (els.resetMemberPasswordBtn) {
    els.resetMemberPasswordBtn.classList.toggle("hidden", !isAdminUser() || !m || !m.email);
    els.resetMemberPasswordBtn.onclick = m ? function () { resetMemberPasswordForCard(m.id); } : null;
  }
  updateMemberDeletionRequestBanner(m);
  if (els.approveMemberDeletionBtn) {
    els.approveMemberDeletionBtn.onclick =
      m && m.deletionRequestedAt && isAdminUser()
        ? function () { approveMemberDeletionRequest(m.id); }
        : null;
  }
  if (els.rejectMemberDeletionBtn) {
    els.rejectMemberDeletionBtn.onclick =
      m && m.deletionRequestedAt && isAdminUser()
        ? function () { rejectMemberDeletionRequest(m.id); }
        : null;
  }

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

function getMemberPackageDaySlotsValidation() {
  if (!els.mpDaySlots) {
    return { ok: false, error: "Seçili günler için saat ve personel seçiniz.", slots: [] };
  }
  const rows = els.mpDaySlots.querySelectorAll(".mp-day-slot-row[data-day]");
  const slots = [];
  let checkedCount = 0;

  for (const row of rows) {
    const day = parseInt(row.dataset.day, 10);
    const chk = row.querySelector('input[type="checkbox"]');
    const timeInput = row.querySelector('input[type="time"]');
    const staffSelect = row.querySelector("select");
    if (!chk || !chk.checked) continue;
    checkedCount++;
    const startTime = timeInput ? String(timeInput.value || "").trim() : "";
    const staffId = staffSelect && staffSelect.value ? parseInt(staffSelect.value, 10) : null;
    if (!startTime || !staffId) {
      return { ok: false, error: "Seçili günler için saat ve personel seçiniz.", slots: [] };
    }
    slots.push({ dayOfWeek: day, startTime, staffId });
  }

  if (checkedCount === 0) {
    return { ok: false, error: "En az bir gün seçin.", slots: [] };
  }
  return { ok: true, slots };
}

/** Tamamlanmış slot listesi (tüm işaretli günlerde saat + personel dolu olmalı). */
function getMemberPackageDaySlotsData() {
  const result = getMemberPackageDaySlotsValidation();
  return result.ok ? result.slots : [];
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

function getMemberPackageSlotDaysOrder() {
  return [1, 2, 3, 4, 5, 6, 0].filter((day) => isDayEnabled(day));
}

function renderMemberPackageDaySlots(slots) {
  if (!els.mpDaySlots) return;
  const dayNames = DAY_NAMES;
  const dayNamesShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  els.mpDaySlots.innerHTML = "";
  const days = getMemberPackageSlotDaysOrder();
  for (const day of days) {
    const slot = (slots || []).find((s) => Number(s.dayOfWeek) === day);
    const checked = !!slot;
    const item = document.createElement("div");
    item.className = "listItem mp-day-slot-row";
    item.dataset.day = String(day);
    const staffOptions = state.staff.map((s) => `<option value="${s.id}">${getStaffFullName(s)}</option>`).join("");
    item.innerHTML = `
      <div class="mp-day-slot-row__day">
        <label class="mp-day-slot-row__day-label" title="${dayNames[day]}">
          <input type="checkbox" data-day="${day}" ${checked ? "checked" : ""} />
          <span class="mp-day-slot-row__day-long">${dayNames[day]}</span>
          <span class="mp-day-slot-row__day-short">${dayNamesShort[day]}</span>
        </label>
      </div>
      <div class="mp-day-slot-row__time">
        <input class="input" type="time" data-day="${day}" value="${checked ? (slot.startTime || "18:00") : ""}" ${checked ? "" : "disabled"} />
      </div>
      <div class="mp-day-slot-row__staff">
        <select class="input" data-day="${day}" ${checked ? "" : "disabled"}><option value="">Seçiniz</option>${staffOptions}</select>
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
    const isCompleted = !isMemberPackageActive(mp);
    card.className = "mp-history-item panel" + (isCompleted ? " mp-history-item--completed" : "");
    card.innerHTML = `
      <div class="mp-history-item__row">
        <span class="mp-history-item__text">
          <strong>${escapeHtml(mp.packageName || "Paket")}</strong>
          <span class="mp-history-item__dates">${escapeHtml(fmtPastPackageSummaryMeta(mp))}</span>
          <span class="mp-history-item__divider">/</span>
          <button type="button" class="btn btn--xs btn--ghost mp-history-item__btn" data-mp-id="${mp.id}" data-action="view-sessions">Seansları Gör</button>
          ${isMemberPackageActive(mp) ? `<button type="button" class="btn btn--xs btn--ghost" data-mp-id="${mp.id}" data-action="edit">Düzenle</button>` : ""}
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

function hidePackageSessionsPackagePicker() {
  if (els.packageSessionsPackagePicker) {
    els.packageSessionsPackagePicker.classList.add("hidden");
  }
  if (els.packageSessionsPackagePickerList) {
    els.packageSessionsPackagePickerList.innerHTML = "";
  }
}

function renderPackageSessionsPackagePicker(packages, selectedMpId) {
  var picker = els.packageSessionsPackagePicker;
  var list = els.packageSessionsPackagePickerList;
  if (!picker || !list) return;
  if (!packages || packages.length <= 1) {
    hidePackageSessionsPackagePicker();
    return;
  }
  picker.classList.remove("hidden");
  list.innerHTML = "";
  packages.forEach(function (mp) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "package-sessions-picker__chip" +
      (Number(mp.id) === Number(selectedMpId) ? " package-sessions-picker__chip--active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", Number(mp.id) === Number(selectedMpId) ? "true" : "false");
    var start = String(mp.startDate || mp.start_date || "").slice(0, 10);
    var end = String(mp.endDate || mp.end_date || "").slice(0, 10);
    var range = start && end ? start + " – " + end : start || end || "";
    btn.innerHTML =
      '<span class="package-sessions-picker__chip-name">' +
      escapeHtml(mp.packageName || mp.package_name || "Paket") +
      "</span>" +
      (range ? '<span class="package-sessions-picker__chip-dates">' + escapeHtml(range) + "</span>" : "");
    btn.addEventListener("click", function () {
      if (!packageSessionsCurrent || Number(packageSessionsCurrent.mp.id) === Number(mp.id)) return;
      selectPackageSessionsModalPackage(mp);
    });
    list.appendChild(btn);
  });
}

function updatePackageSessionsModalHeader(mp) {
  if (!packageSessionsCurrent || !mp) return;
  packageSessionsCurrent.mp = mp;
  if (els.packageSessionsTitle) {
    els.packageSessionsTitle.textContent =
      packageSessionsCurrent.memberDisplayName + " – " + (mp.packageName || mp.package_name || "Paket");
  }
  if (els.packageSessionsSubtitle) {
    els.packageSessionsSubtitle.textContent = fmtPackageModalSubtitle(mp, isMemberPackageActive(mp));
  }
  renderPackageSessionsPackagePicker(packageSessionsCurrent.allPackages, mp.id);
}

function loadPackageSessionsForModal(mp) {
  if (!els.packageSessionsModal || !mp) return;
  els.packageSessionsTableBody.innerHTML = "";
  els.packageSessionsEmpty.classList.add("hidden");
  if (els.packageSessionsCards) els.packageSessionsCards.classList.add("hidden");
  if (els.packageSessionsTableWrap) els.packageSessionsTableWrap.classList.remove("hidden");
  if (els.packageSessionsTable) els.packageSessionsTable.classList.remove("hidden");
  if (!window.API || !window.API.getMemberPackageSessions) {
    els.packageSessionsEmpty.textContent = "API kullanılamıyor.";
    els.packageSessionsEmpty.classList.remove("hidden");
    return;
  }
  window.API.getMemberPackageSessions(mp.id).then(async function (sessions) {
    if (!packageSessionsCurrent || Number(packageSessionsCurrent.mp.id) !== Number(mp.id)) return;
    packageSessionsCurrent.sessions = sessions || [];
    renderPackageSessionsTable(packageSessionsCurrent.sessions);
    if (!packageSessionsCurrent.sessions.length) {
      els.packageSessionsEmpty.textContent = "Seans kaydı yok.";
      els.packageSessionsEmpty.classList.remove("hidden");
      if (els.packageSessionsTable) els.packageSessionsTable.classList.add("hidden");
      if (els.packageSessionsCards) els.packageSessionsCards.classList.add("hidden");
      if (els.packageSessionsTableWrap) els.packageSessionsTableWrap.classList.add("hidden");
    }
    if (window.API.getSessions && packageSessionsCurrent && packageSessionsCurrent.sessions.length) {
      try {
        var firstTs =
          packageSessionsCurrent.sessions[0].start_ts || packageSessionsCurrent.sessions[0].startTs;
        var lastTs =
          packageSessionsCurrent.sessions[packageSessionsCurrent.sessions.length - 1].start_ts ||
          packageSessionsCurrent.sessions[packageSessionsCurrent.sessions.length - 1].startTs;
        if (firstTs && lastTs) {
          var startD = new Date(Number(firstTs)).toISOString().slice(0, 10);
          var endD = new Date(Number(lastTs)).toISOString().slice(0, 10);
          await fetchAndMergeSessions(startD, endD);
          render();
        }
      } catch (_) {}
    }
  }).catch(function (e) {
    if (!packageSessionsCurrent || Number(packageSessionsCurrent.mp.id) !== Number(mp.id)) return;
    els.packageSessionsEmpty.textContent = (e.data && e.data.error) || e.message || "Seanslar yüklenemedi.";
    els.packageSessionsEmpty.classList.remove("hidden");
    if (els.packageSessionsTable) els.packageSessionsTable.classList.add("hidden");
    if (els.packageSessionsCards) els.packageSessionsCards.classList.add("hidden");
    if (els.packageSessionsTableWrap) els.packageSessionsTableWrap.classList.add("hidden");
  });
}

function selectPackageSessionsModalPackage(mp) {
  if (!packageSessionsCurrent || !mp) return;
  updatePackageSessionsModalHeader(mp);
  loadPackageSessionsForModal(mp);
}

function openPackageSessionsModal(mp, memberId, memberOverride, options) {
  if (!els.packageSessionsModal) return;
  var opts = options || {};
  var allPackages = Array.isArray(opts.allPackages) ? opts.allPackages.slice() : null;
  packageSessionsCurrent = {
    mp: mp,
    sessions: [],
    memberName: "",
    memberDisplayName: "",
    memberId: memberId,
    memberOverride: memberOverride || null,
    allPackages: allPackages && allPackages.length > 1 ? allPackages : null,
  };
  var m =
    memberOverride ||
    (memberId != null ? state.members.find(function (x) { return normId(x.id) === normId(memberId); }) : null);
  packageSessionsCurrent.memberDisplayName = m ? getMemberDisplayName(m) : "Üye";
  packageSessionsCurrent.memberName = m ? (m.memberNo || packageSessionsCurrent.memberDisplayName) : "Üye";
  updatePackageSessionsModalHeader(mp);
  loadPackageSessionsForModal(mp);
  els.packageSessionsModal.classList.remove("hidden");
}

function closePackageSessionsModal() {
  if (els.packageSessionsModal) els.packageSessionsModal.classList.add("hidden");
  hidePackageSessionsPackagePicker();
  packageSessionsCurrent = null;
}

function renderPackageSessionsTable(sessions) {
  renderPackageSessionsList(sessions, {
    role: "admin",
    compact: true,
    cardsEl: els.packageSessionsCards,
    tableWrapEl: els.packageSessionsTableWrap,
    tableBodyEl: els.packageSessionsTableBody,
    tableEl: els.packageSessionsTable,
    emptyEl: els.packageSessionsEmpty,
  });
}

async function exportPackageSessionsExcel() {
  if (!packageSessionsCurrent || !packageSessionsCurrent.sessions.length) return;
  const headers = ["Tarih", "Personel", "Ders Saati", "Giriş Saati", "Onay"];
  const rows = packageSessionsToExportRows(packageSessionsCurrent.sessions);
  try {
    await ensureXlsxLib();
  } catch (_) {
    /* CSV yedeğine düş */
  }
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

async function exportPackageSessionsPdf() {
  if (!packageSessionsCurrent || !packageSessionsCurrent.sessions.length) return;
  try {
    await ensurePdfLibs();
  } catch (_) {
    await showAppAlert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    await showAppAlert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = (packageSessionsCurrent.mp.packageName || "Paket") + " – Seanslar";
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(packageSessionsCurrent.memberName + " • " + (packageSessionsCurrent.mp.startDate || "") + " – " + (packageSessionsCurrent.mp.endDate || ""), 14, 22);
  const tableData = packageSessionsToExportRows(packageSessionsCurrent.sessions);
  doc.autoTable({
    head: [["Tarih", "Personel", "Ders Saati", "Giriş Saati", "Onay"]],
    body: tableData,
    startY: 28,
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 9 },
  });
  doc.save("paket-seanslari-" + (packageSessionsCurrent.mp.packageName || "paket").replace(/\s+/g, "-") + ".pdf");
}

function openMemberPackageModal(memberId, memberPackageId, options) {
  editingMemberPackageId = memberPackageId || null;
  const preselectPackageId = options && options.preselectPackageId != null ? options.preselectPackageId : null;
  const memberIdNorm = memberId != null ? normId(memberId) : null;
  const pending = ui.pendingNewMember;
  const m = memberIdNorm ? state.members.find((x) => normId(x.id) === memberIdNorm) : (pending ? null : null);
  if (!m && !pending) return;

  ui.editingMemberId = memberIdNorm;

  if (els.mpFormError) els.mpFormError.classList.add("hidden");
  if (els.mpAvailabilityError) els.mpAvailabilityError.classList.add("hidden");

  // Yeni paket eklerken: üyenin zaten aktif paketi varsa uyarı (pending yeni üyede yok)
  const activePackage = !editingMemberPackageId && !pending && (state.memberPackages || []).find(
    (mp) => normId(mp.memberId) === memberIdNorm && isMemberPackageActive(mp)
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
    if (preselectPackageId != null && els.mpPackage) {
      els.mpPackage.value = String(preselectPackageId);
    }
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
        const created = await createMemberOrReactivateFormer(ui.pendingNewMember);
        state.members.push(created);
        ui.editingMemberId = created.id;
        ui.pendingNewMember = null;
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

  const slots = skipDayDistribution ? [] : (() => {
    const slotValidation = getMemberPackageDaySlotsValidation();
    if (!slotValidation.ok) {
      if (els.mpFormError) {
        els.mpFormError.textContent = slotValidation.error;
        els.mpFormError.classList.remove("hidden");
      }
      return null;
    }
    return slotValidation.slots;
  })();
  if (slots === null) return;

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

  // Çakışma varsa backend 409 döner; paket/seans kaydedilmez, form açık kalır (MP-26).
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
function formatMemberPackageSessionConflicts(conflicts) {
  const staffList = state.staff || [];
  return (conflicts || []).map((c) => {
    const staffFromState = staffList.find((s) => Number(s.id) === Number(c.staff_id));
    const staffName = c.staff_name || (staffFromState && (staffFromState.name || ((staffFromState.firstName || "") + " " + (staffFromState.lastName || "")).trim())) || "Personel";
    const dateFmt = c.date ? c.date.split("-").reverse().join(".") : "";
    const time = c.start_time || "";
    const detail = c.message ? " — " + c.message : "";
    return (dateFmt ? dateFmt + " " : "") + (c.day_name || "") + (time ? " " + time : "") + " · " + staffName + detail;
  }).join("\n");
}

function showMemberPackageAvailabilityConflicts(errorMessage, conflicts) {
  const list = formatMemberPackageSessionConflicts(conflicts);
  if (els.mpAvailabilityError) {
    els.mpAvailabilityError.textContent = "";
    els.mpAvailabilityError.innerHTML =
      "<strong>Randevu çakışması</strong><br>" +
      (errorMessage || "Seçilen gün/saat/personel için yer yok. Lütfen ilgili satırları düzenleyip tekrar kaydedin.") +
      (list ? "<br><br>" + list.replace(/\n/g, "<br>") : "");
    els.mpAvailabilityError.classList.remove("hidden");
  }
  if (els.mpFormError) {
    els.mpFormError.textContent = errorMessage || "Randevu çakışması var. Gün, saat veya personeli düzenleyin.";
    els.mpFormError.classList.remove("hidden");
  }
}

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
        if (
          !updatePayload.skipDayDistribution &&
          Array.isArray(updatePayload.slots) &&
          updatePayload.slots.length > 0 &&
          createdOrUpdated.sessionsCreated === 0
        ) {
          await showAppAlert("Paket güncellendi ancak hiç seans oluşturulamadı. Çalışma saatlerini, personel müsaitliğini ve oda kapasitesini kontrol edin.");
        }
      } else {
        createdOrUpdated = await window.API.createMemberPackage(payload);
        state.memberPackages = state.memberPackages || [];
        state.memberPackages.push(createdOrUpdated);
        if (
          !payload.skipDayDistribution &&
          Array.isArray(payload.slots) &&
          payload.slots.length > 0 &&
          createdOrUpdated.sessionsCreated === 0
        ) {
          await showAppAlert("Paket kaydedildi ancak hiç seans oluşturulamadı. Çalışma saatlerini, personel müsaitliğini ve oda kapasitesini kontrol edin.");
        }
      }
      if (window.API.getSessions && payload.startDate && payload.endDate) {
        await fetchAndMergeSessions(payload.startDate, payload.endDate);
      }

      if (endAfterSaveWithLastSessionDate && createdOrUpdated && createdOrUpdated.id) {
        const endDateStr = nextDayStr(endAfterSaveWithLastSessionDate);
        const ended = await window.API.endMemberPackage(createdOrUpdated.id, endDateStr);
        if (ended) {
          const idx = (state.memberPackages || []).findIndex((x) => x.id === createdOrUpdated.id);
          if (idx !== -1) state.memberPackages[idx] = ended;
        }
        if (window.API.getSessions && payload.startDate) {
          await fetchAndMergeSessions(payload.startDate, endDateStr);
        }
      }
    } catch (e) {
      if (e.status === 409 && e.data && Array.isArray(e.data.conflicts) && e.data.conflicts.length > 0) {
        showMemberPackageAvailabilityConflicts(e.data.error, e.data.conflicts);
      } else if (els.mpFormError) {
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
  render();
  if (isAdminUser() && window.API && window.API.getPackageRequests) {
    refreshAdminPackageRequests(false);
  }
  if (memberId) renderMemberPackageHistory(memberId);
}

async function endMemberPackageFromModal() {
  if (!editingMemberPackageId) return;
  if (!(await showAppConfirm("Bu üyeliği sonlandırmak istediğinize emin misiniz? O andan sonraki seanslar iptal edilecektir."))) return;
  const today = new Date();
  const endDateStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  if (window.API && window.API.getToken()) {
    try {
      await window.API.endMemberPackage(editingMemberPackageId, endDateStr);
      var mpRow = (state.memberPackages || []).find(function (x) { return x.id === editingMemberPackageId; });
      var mpStart = mpRow && (mpRow.startDate || mpRow.start_date);
      if (window.API.getSessions && mpStart) {
        await fetchAndMergeSessions(String(mpStart).slice(0, 10), endDateStr);
      }
    } catch (e) {
      await showAppAlert((e.data && e.data.error) || e.message || "Sonlandırılamadı.");
      return;
    }
  }
  const idx = (state.memberPackages || []).findIndex((x) => x.id === editingMemberPackageId);
  if (idx !== -1) state.memberPackages[idx] = { ...state.memberPackages[idx], status: "completed", endDate: endDateStr };
  closeMemberPackageModal();
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
  closeDeleteMemberModal();
  if (els.memberCardModal && !els.memberCardModal.classList.contains("hidden")) closeMemberCardModal();
  render();
  if (isAdminMembersListViewActive()) openListMembersModal();
}

async function deleteMemberFromList(memberId) {
  if (window.API && window.API.getToken()) {
    openDeleteMemberModal(memberId);
    return;
  }
  if (!(await showAppConfirm("Bu üyeyi silmek istiyor musunuz?"))) return;
  state.members = state.members.filter((x) => x.id !== normId(memberId));
  render();
  if (isAdminMembersListViewActive()) openListMembersModal();
}

async function deleteMemberCardFromModal() {
  if (!ui.editingMemberId) return;
  if (window.API && window.API.getToken()) {
    openDeleteMemberModal(ui.editingMemberId);
    return;
  }
  if (!(await showAppConfirm("Bu üyeyi silmek istiyor musunuz?"))) return;
  state.members = state.members.filter((x) => x.id !== normId(ui.editingMemberId));
  closeMemberCardModal();
  render();
}

/** Aktif paketi olan üye id'leri (grup/tek seans için sadece bunlara seans açılabilir) */
function getMemberIdsWithActivePackage() {
  var todayStr = localTodayDateStr();
  return new Set(
    (state.memberPackages || [])
      .filter(function (mp) { return isMemberPackageActive(mp, todayStr); })
      .map(function (mp) { return normId(mp.memberId); })
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
    (mp) => normId(mp.memberId) === memberId && isMemberPackageActive(mp)
  );
  const usedByPackage = {};
  (state.sessions || []).forEach((s) => {
    if (!s.memberPackageId) return;
    const key = s.memberPackageId;
    if (!usedByPackage[key]) usedByPackage[key] = [];
    usedByPackage[key].push(s);
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
    const total = mp.lessonCount ?? mp.lesson_count ?? 0;
    const counts = computePackageSessionCountsFromSessions(usedByPackage[mp.id] || [], total);
    return `${mp.packageName || "Paket"}: ${counts.consumed}/${total} kullanıldı, ${counts.remaining} kaldı`;
  });
  els.sessionPackageHint.textContent = "Aktif paket(ler) – takvimden eklenen seans otomatik pakete işlenir: " + lines.join("; ");
}

function onSessionFormSlotChange() {
  const dateVal = els.sessionDate && els.sessionDate.value;
  const timeVal = els.sessionTime && els.sessionTime.value;
  if (dateVal && timeVal) {
    const currentStaffId = els.sessionStaff && els.sessionStaff.value;
    refreshSessionFormOptions({ dateStr: dateVal, timeStr: timeVal });
    if (els.sessionStaff) {
      if (els.sessionStaff.querySelector(`option[value="${currentStaffId}"]`)) {
        els.sessionStaff.value = currentStaffId;
      } else if (els.sessionStaff.options.length > 0) {
        els.sessionStaff.value = els.sessionStaff.options[0].value;
      }
    }
  }
}

function bindSessionFormSlotListeners() {
  if (!els.sessionDate || !els.sessionTime) return;
  els.sessionDate.removeEventListener("change", onSessionFormSlotChange);
  els.sessionTime.removeEventListener("change", onSessionFormSlotChange);
  els.sessionDate.removeEventListener("input", onSessionFormSlotChange);
  els.sessionTime.removeEventListener("input", onSessionFormSlotChange);
  els.sessionDate.addEventListener("change", onSessionFormSlotChange);
  els.sessionTime.addEventListener("change", onSessionFormSlotChange);
  els.sessionDate.addEventListener("input", onSessionFormSlotChange);
  els.sessionTime.addEventListener("input", onSessionFormSlotChange);
}

async function openSessionModal({ mode, date, time, sessionId }) {
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
  } else {
    const s = state.sessions.find((x) => normId(x.id) === normId(sessionId));
    if (!s) {
      await showAppAlert(STALE_SESSION_MSG);
      render();
      return;
    }
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
    els.sessionNote.value = s.note || "";

    els.sessionStaff.value = String(Number(s.staffId)); // Seçili personeli koru (option ile eşleşsin)
  }

  bindSessionFormSlotListeners();
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
        if (els.packageSessionsCards) els.packageSessionsCards.classList.add("hidden");
        if (els.packageSessionsTableWrap) els.packageSessionsTableWrap.classList.add("hidden");
      }
    }).catch(() => {});
  }
}

let currentGroupSessions = [];
let isNewGroupSession = false;
let groupSessionEditOriginal = null;

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

async function openGroupSessionModal(group, options = {}) {
  els.groupSessionError.classList.add("hidden");
  groupSessionEditOriginal = null;

  if (group && group.sessions && group.sessions.length) {
    var anchor = group.sessions[0];
    var freshAnchor = state.sessions.find(function (x) { return normId(x.id) === normId(anchor.id); });
    if (!freshAnchor) {
      await showAppAlert(STALE_SESSION_MSG);
      render();
      return;
    }
    group = getGroupForSession(freshAnchor);
    if (!group || !group.sessions.length) {
      await showAppAlert(STALE_SESSION_MSG);
      render();
      return;
    }
  }

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

  groupSessionEditOriginal = {
    dateStr: dateStr,
    timeStr: timeStr,
    staffId: firstSession.staffId != null ? String(Number(firstSession.staffId)) : "",
    startTs: firstSession.startTs,
    endTs: firstSession.endTs,
  };

  renderGroupSessionMembers();
  els.groupSessionModal.classList.remove("hidden");
}

function closeGroupSessionModal() {
  els.groupSessionModal.classList.add("hidden");
  currentGroupSessions = [];
  isNewGroupSession = false;
  groupSessionEditOriginal = null;
}

// Yeni grup seansı oluşturulurken tarih/saat/personel alanları değiştiğinde,
// zaten listeye eklenmiş üyelerin seans bilgilerini de güncelle.
function syncNewGroupSessionFieldsChange() {
  if (!isNewGroupSession || currentGroupSessions.length === 0) return;

  const dateStr = els.groupSessionNewDate?.value;
  const timeStr = els.groupSessionNewTime?.value;
  const staffId = els.groupSessionNewStaff?.value;
  if (!dateStr || !timeStr || !staffId) return;

  const start = makeLocalDate(dateStr, timeStr);
  const durationMs = currentGroupSessions[0].endTs - currentGroupSessions[0].startTs;
  const startTs = start.getTime();
  const endTs = startTs + durationMs;

  const ignoreSessionIds = new Set(currentGroupSessions.map((s) => normId(s.id)));
  for (const session of currentGroupSessions) {
    session.startTs = startTs;
    session.endTs = endTs;
    session.staffId = staffId;
  }

  const candidate = { staffId, memberId: currentGroupSessions[0].memberId, roomId: "", startTs, endTs };
  const roomId = autoAssignRoom(candidate, { ignoreSessionIds });
  for (const session of currentGroupSessions) {
    session.roomId = roomId;
  }

  els.groupSessionError.classList.add("hidden");
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
    memberRow.className = "group-session-member-row";

    const select = document.createElement("select");
    select.className = "input";
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
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn--danger group-session-member-row__remove";
    deleteBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
    deleteBtn.title = "Kaldır";
    deleteBtn.setAttribute("aria-label", "Üyeyi kaldır");
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
  els.groupSessionError.classList.add("hidden");

  if (isNewGroupSession) {
    const newDateStr = els.groupSessionNewDate && els.groupSessionNewDate.value ? els.groupSessionNewDate.value : null;
    if (newDateStr && window.API && window.API.getToken()) {
      await ensureDaySessionsLoaded(newDateStr);
    }
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
    if (window.API && window.API.getToken()) {
      await syncSessionsFromServer({ silent: true });
    }
    render();
    closeGroupSessionModal();
    return;
  }

  // Mevcut grup düzenleme: Tarih/Saat/Personel güncellemesi + üye listesi senkronu
  const dateStr = els.groupSessionDate && els.groupSessionDate.value ? els.groupSessionDate.value : null;
  const timeStr = els.groupSessionTime && els.groupSessionTime.value ? els.groupSessionTime.value : null;
  let newStaffId = els.groupSessionStaff && els.groupSessionStaff.value ? els.groupSessionStaff.value : null;

  let newStartTs = firstSession.startTs;
  let newEndTs = firstSession.endTs;
  let newRoomId = firstSession.roomId;
  const durationMs = firstSession.endTs - firstSession.startTs;
  const ignoreGroupIds = new Set(currentGroupSessions.map((s) => normId(s.id)));

  if (dateStr && timeStr && newStaffId) {
    const start = makeLocalDate(dateStr, timeStr);
    newStartTs = start.getTime();
    newEndTs = newStartTs + durationMs;
    const slotChanged = !groupSessionEditOriginal ||
      dateStr !== groupSessionEditOriginal.dateStr ||
      timeStr !== groupSessionEditOriginal.timeStr ||
      normId(newStaffId) !== normId(groupSessionEditOriginal.staffId);

    if (slotChanged) {
      if (window.API && window.API.getToken()) {
        await ensureDaySessionsLoaded(dateStr);
      }
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

      const candidate = { staffId: newStaffId, memberId: firstSession.memberId, roomId: "", startTs: newStartTs, endTs: newEndTs };
      newRoomId = autoAssignRoom(candidate, { ignoreSessionIds: ignoreGroupIds });

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
      newRoomId = firstSession.roomId;
      newStartTs = firstSession.startTs;
      newEndTs = firstSession.endTs;
    }
  } else {
    newStaffId = newStaffId || String(Number(firstSession.staffId));
    newRoomId = firstSession.roomId;
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

  var groupSlotChanged =
    newStartTs !== firstSession.startTs ||
    normId(newStaffId) !== normId(firstSession.staffId) ||
    normId(newRoomId) !== normId(firstSession.roomId);

  var groupPwdSessions = [];
  for (const s of sameGroupSessions) {
    if (!groupSessionIds.has(normId(s.id))) groupPwdSessions.push(s);
  }
  if (groupSlotChanged) {
    for (const session of currentGroupSessions) {
      var ex = state.sessions.find(function (x) {
        return normId(x.id) === normId(session.id);
      });
      if (ex) groupPwdSessions.push(ex);
    }
  }
  var groupPwd = await resolveAdminPasswordForSessions(
    groupPwdSessions,
    "Girişi onaylanmış seans(lar) üzerinde değişiklik yapmak için admin şifrenizi girin."
  );
  if (groupPwd.cancelled) return;

  for (const s of sameGroupSessions) {
    if (!groupSessionIds.has(normId(s.id))) {
      const index = state.sessions.findIndex(x => normId(x.id) === normId(s.id));
      if (index >= 0) state.sessions.splice(index, 1);
      if (window.API && window.API.getToken()) {
        try {
          await window.API.deleteSession(
            s.id,
            groupPwd.adminPassword ? { adminPassword: groupPwd.adminPassword } : undefined
          );
        } catch (_) {}
      }
    }
  }

  for (const session of currentGroupSessions) {
    if (existingSessionIds.has(normId(session.id))) {
      if (window.API && window.API.getToken() && (newStartTs !== firstSession.startTs || normId(newStaffId) !== normId(firstSession.staffId) || normId(newRoomId) !== normId(firstSession.roomId))) {
        try {
          var groupUpdatePayload = {
            staffId: newStaffId,
            roomId: newRoomId,
            startTs: newStartTs,
            endTs: newEndTs,
          };
          if (groupPwd.adminPassword) groupUpdatePayload.adminPassword = groupPwd.adminPassword;
          const updated = await window.API.updateSession(session.id, groupUpdatePayload);
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

  state.sessions.sort((a, b) => a.startTs - b.startTs);
  if (window.API && window.API.getToken()) {
    await syncSessionsFromServer({ silent: true });
  }
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
  const existingSession = ui.editingSessionId
    ? state.sessions.find(function (x) { return normId(x.id) === normId(ui.editingSessionId); })
    : null;
  const slotChanged = !existingSession ||
    candidateBase.startTs !== existingSession.startTs ||
    normId(staffId) !== normId(existingSession.staffId);

  if (slotChanged && window.API && window.API.getToken()) {
    await ensureDaySessionsLoaded(dateStr);
  }

  let roomId;
  if (slotChanged) {
    roomId = autoAssignRoom(candidateBase, { ignoreSessionId });
  } else if (existingSession) {
    roomId = existingSession.roomId;
  }

  const candidate = { ...candidateBase, roomId };

  if (slotChanged) {
    const conflicts = checkConflicts(candidate, { ignoreSessionId });
    if (conflicts.length) {
      showError(conflicts.join(" "));
      return;
    }
  }

  if (window.API && window.API.getToken()) {
    try {
      var editPwd = {};
      if (ui.editingSessionId && existingSession && isSessionAttendanceConfirmed(existingSession)) {
        editPwd = await resolveAdminPasswordForSessions(
          [existingSession],
          "Girişi onaylanmış seansı düzenlemek için admin şifrenizi girin."
        );
        if (editPwd.cancelled) return;
      }
      if (ui.editingSessionId) {
        var updatePayload = {
          staffId: candidate.staffId,
          memberId: candidate.memberId,
          roomId: candidate.roomId,
          startTs: candidate.startTs,
          endTs: candidate.endTs,
          note: candidate.note || null,
        };
        if (editPwd.adminPassword) updatePayload.adminPassword = editPwd.adminPassword;
        const updated = await window.API.updateSession(ui.editingSessionId, updatePayload);
        mergeSessionsIntoState([updated]);
      } else {
        const created = await window.API.createSession(candidate);
        mergeSessionsIntoState([created]);
      }
    } catch (e) {
      if (e.status === 404) {
        await syncSessionsFromServer({ silent: true });
        showError(STALE_SESSION_MSG);
        closeSessionModal();
        render();
        return;
      }
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
  if (window.API && window.API.getToken()) {
    await syncSessionsFromServer({ silent: true });
  }
  closeSessionModal();
  render();
}

async function deleteSessionFromModal() {
  if (!ui.editingSessionId) return;
  if (!(await showAppConfirm("Seansı silmek istiyor musunuz?"))) return;
  const existingSession = state.sessions.find(function (x) {
    return normId(x.id) === normId(ui.editingSessionId);
  });
  if (window.API && window.API.getToken()) {
    try {
      var delModalPwd = await resolveAdminPasswordForSessions(
        [existingSession],
        "Girişi onaylanmış seansı silmek için admin şifrenizi girin."
      );
      if (delModalPwd.cancelled) return;
      await window.API.deleteSession(
        ui.editingSessionId,
        delModalPwd.adminPassword ? { adminPassword: delModalPwd.adminPassword } : undefined
      );
      removeSessionFromState(ui.editingSessionId);
    } catch (e) {
      console.error("Seans silinemedi:", e);
      if (e.status === 404) {
        await syncSessionsFromServer({ silent: true });
        closeSessionModal();
        render();
        await showAppAlert(STALE_SESSION_MSG);
        return;
      }
      showError("Seans silinemedi: " + (e?.data?.error || e?.message || "Bilinmeyen hata"));
      if (window.API.getSessions) {
        try {
          await refreshSessionsInLoadedRange();
        } catch (_) {}
      }
      render();
      return;
    }
  } else {
    state.sessions = state.sessions.filter((s) => s.id !== ui.editingSessionId);
  }
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
  } else if (ui.viewMode === "month") {
    const monthStart = startOfMonth(ui.currentMonth || ui.currentDay);
    const monthEnd = addMonths(monthStart, 1);
    inWeek = state.sessions.filter((s) => s.startTs >= monthStart.getTime() && s.startTs < monthEnd.getTime());
  } else {
    const weekStartTs = ui.weekStart.getTime();
    const weekEndTs = addDays(ui.weekStart, 7).getTime();
    inWeek = state.sessions.filter((s) => s.startTs >= weekStartTs && s.startTs < weekEndTs);
  }
  if ((ui.plannerFilter || "").trim() || ui.filterStaffId || ui.filterRoomId) {
    inWeek = inWeek.filter(sessionMatchesToolbarFilters);
  }
  return inWeek;
}

async function exportSessionsExcel() {
  const sessions = getSessionsForExport();
  const headers = ["#", "Tarih", "Saat", "Üye", "Personel", "Oda", "Not"];
  const rows = sessions.map((s, i) => {
    const d = new Date(Number(s.startTs));
    const dateStr = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const memberName = getSessionMemberDisplayName(s);
    const staffName = staff ? getStaffFullName(staff) : "–";
    const roomName = room ? room.name : "–";
    return [i + 1, dateStr, timeStr, memberName, staffName, roomName, (s.note || "").toString()];
  });
  try {
    await ensureXlsxLib();
  } catch (_) {
    /* CSV yedeğine düş */
  }
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

async function exportSessionsPdf() {
  const sessions = getSessionsForExport();
  try {
    await ensurePdfLibs();
  } catch (_) {
    await showAppAlert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
    await showAppAlert("PDF oluşturmak için jsPDF yüklenemedi. İnternet bağlantınızı kontrol edin.");
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
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const memberName = getSessionMemberDisplayName(s);
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
    content.innerHTML =
      '<div class="admin-panel-empty"><p>Oda tanımlı değil. Ayarlardan en az bir oda ekleyin.</p></div>';
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
    content.innerHTML =
      '<div class="admin-panel-empty"><p>Bu hafta tüm odalarda personel olduğu (' +
      targetStaffCount +
      " personel aynı anda merkezde) bir saat bulunamadı.</p></div>";
  } else {
    const table = document.createElement("table");
    table.className = "task-distribution-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Saat</th>
          <th>Personeller</th>
          <th>Seanslar</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const item of fullCapacityTimes) {
      const { dayName, dt } = fmtDayHeader(item.date);
      const staffNames = item.staff.map((s) => getStaffFullName(s)).join(", ");
      const sessionDetails = item.sessions.map((s) => {
        const room = getRoomById(s.roomId);
        return `${getSessionMemberDisplayName(s)} (${room?.name || "Oda"})`;
      }).join(", ");

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${dayName} ${dt}</td>
        <td>${item.timeStr}</td>
        <td>${escapeHtml(staffNames)}</td>
        <td class="task-distribution-table__sessions">${escapeHtml(sessionDetails)}</td>
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

  const filterText = getAdminListFilterText();
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
    content.innerHTML =
      '<div class="admin-panel-empty"><p>' +
      (expiredMembershipsBaseList.length === 0
        ? "Paketi bitmiş (bitiş tarihi geçmiş) kayıt yok."
        : "Filtreye uyan kayıt yok.") +
      "</p></div>";
    return;
  }

  const sort = expiredMembershipsSort;
  const startLabel = "Baş.Tar." + (sort.column === "start" ? (sort.dir === "asc" ? " ▲" : " ▼") : "");
  const endLabel = "Bit.Tar." + (sort.column === "end" ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const wrap = document.createElement("div");
  wrap.className = "expired-memberships-table-wrap";
  const table = document.createElement("table");
  table.className = "expired-memberships-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>ÜyeNo</th>
        <th>Ad Soy.</th>
        <th>Tel</th>
        <th data-sort="start" title="Tıklayın: küçükten büyüğe / büyükten küçüğe">${startLabel}</th>
        <th data-sort="end" title="Tıklayın: küçükten büyüğe / büyükten küçüğe">${endLabel}</th>
        <th>Paket</th>
        <th></th>
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
    (p) => normId(p.memberId) === normId(memberId) && isMemberPackageActive(p)
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
    row.className = "expired-memberships-table__row";
    row.title = "Seansları görmek için satıra dokunun";
    row.innerHTML = `
      <td>${escapeHtml(memberNo)}</td>
      <td class="expired-memberships-table__name">${escapeHtml(memberName)}</td>
      <td>${escapeHtml(phone)}</td>
      <td>${escapeHtml(startStrVal)}</td>
      <td>${escapeHtml(endStrVal)}</td>
      <td class="expired-memberships-table__package">${escapeHtml(packageName)}</td>
      <td>
        <span class="expired-memberships-table__actions">
          ${showNewPackageBtn ? `<button type="button" class="btn btn--xs btn--ghost" data-action="new-package" data-member-id="${mp.memberId || ""}">Yeni Paket</button>` : ""}
        </span>
      </td>
    `;
    row.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      openPackageSessionsModal(mp, mp.memberId);
    });
    const newPkgBtn = row.querySelector("button[data-action='new-package']");
    if (newPkgBtn) {
      newPkgBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        ui.editingMemberId = mp.memberId;
        openMemberPackageModal(mp.memberId);
      });
    }
    table.querySelector("tbody").appendChild(row);
  }

  content.innerHTML = "";
  wrap.appendChild(table);
  content.appendChild(wrap);
}

/** Üyeliği bitmiş (bitiş tarihi geçmiş) paketleri ve seansları ayrı listeler; filtre ve sıralama uygulanır */
function openExpiredMembershipsModal() {
  const content = els.expiredMembershipsContent;
  if (!content) return;
  showAdminMainView("expired-memberships");
  content.innerHTML = "";

  const todayStr = localTodayDateStr();

  // MP-04: bitiş bugün/geçmiş veya status completed/cancelled
  const memberIds = new Set((state.members || []).map((m) => normId(m.id)));
  expiredMembershipsBaseList = (state.memberPackages || []).filter((mp) => {
    if (!memberIds.has(normId(mp.memberId))) return false;
    return isMemberPackageExpired(mp, todayStr);
  });

  renderExpiredMembershipsTable();
}

function closeExpiredMembershipsModal() {
  showAdminCalendarView();
}

let formerMembersBaseList = [];

function fmtFormerMemberDeletedAt(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

function formerMemberPackageFromRow(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    packageId: row.package_id,
    packageName: row.package_name || row.packageName || "Paket",
    startDate: row.start_date || row.startDate,
    endDate: row.end_date || row.endDate,
    status: row.status || "completed",
    packageType: row.package_type || row.packageType,
  };
}

async function openFormerMemberSessions(memberId) {
  if (!window.API || !window.API.getFormerMemberPackages) return;
  var member = formerMembersBaseList.find(function (x) {
    return Number(x.id) === Number(memberId);
  });
  try {
    var data = await window.API.getFormerMemberPackages(memberId);
    var pkgs = (data.packages || []).map(formerMemberPackageFromRow);
    if (!pkgs.length) {
      await showAppAlert("Bu eski üyeye ait paket kaydı yok.");
      return;
    }
    openPackageSessionsModal(pkgs[0], memberId, member || data.member, { allPackages: pkgs });
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Seanslar yüklenemedi.");
  }
}

function renderFormerMembersTable() {
  var content = els.formerMembersContent;
  if (!content) return;
  var filterText = getAdminListFilterText();
  var list = formerMembersBaseList.slice();
  if (filterText) {
    list = list.filter(function (m) { return memberMatchesListFilter(m, filterText); });
  }
  if (!list.length) {
    content.innerHTML = '<div class="admin-panel-empty admin-panel-empty--compact"><p>' +
      (formerMembersBaseList.length === 0 ? "Eski üye kaydı yok." : "Filtreye uyan kayıt yok.") +
      "</p></div>";
    return;
  }

  var wrap = document.createElement("div");
  wrap.className = "expired-memberships-table-wrap former-members-table-wrap";
  var table = document.createElement("table");
  table.className = "expired-memberships-table former-members-table";
  table.innerHTML =
    "<thead><tr>" +
    "<th>ÜyeNo</th><th>Ad Soy.</th><th>Tel</th><th>İpt.Tar.</th><th>Paket</th><th></th>" +
    "</tr></thead><tbody></tbody>";
  var tbody = table.querySelector("tbody");

  list.forEach(function (m) {
    var pkgCount = m.packageCount != null ? m.packageCount : (m.package_count != null ? m.package_count : "—");
    var row = document.createElement("tr");
    row.className = "expired-memberships-table__row former-members-table__row";
    row.title = "Seansları görmek için satıra dokunun";
    row.innerHTML =
      "<td>" + escapeHtml(m.memberNo || m.member_no || "–") + "</td>" +
      '<td class="expired-memberships-table__name">' + escapeHtml(getMemberDisplayName(m)) + "</td>" +
      "<td>" + escapeHtml(displayPhone(m.phone) || "–") + "</td>" +
      "<td>" + escapeHtml(fmtFormerMemberDeletedAt(m.deletedAt || m.deleted_at)) + "</td>" +
      '<td class="expired-memberships-table__package">' + escapeHtml(String(pkgCount)) + "</td>" +
      '<td><span class="expired-memberships-table__actions">' +
      '<button type="button" class="btn btn--xs btn--primary" data-former-reactivate="' + m.id + '">Tekrar Aktif Et</button>' +
      "</span></td>";
    row.addEventListener("click", function (e) {
      if (e.target.closest("button")) return;
      openFormerMemberSessions(m.id);
    });
    var reactivateBtn = row.querySelector("[data-former-reactivate]");
    if (reactivateBtn) {
      reactivateBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        reactivateFormerMemberById(parseInt(reactivateBtn.getAttribute("data-former-reactivate"), 10));
      });
    }
    tbody.appendChild(row);
  });

  content.innerHTML = "";
  wrap.appendChild(table);
  content.appendChild(wrap);
}

async function openFormerMembersModal() {
  if (!window.API || !window.API.getFormerMembers) {
    await showAppAlert("Bu özellik sunucu bağlantısı gerektirir.");
    return;
  }
  showAdminMainView("former-members");
  try {
    var rows = await window.API.getFormerMembers();
    formerMembersBaseList = (rows || []).map(function (row) {
      return Object.assign({}, row, {
        packageCount: row.packageCount != null ? row.packageCount : row.package_count,
        sessionCount: row.sessionCount != null ? row.sessionCount : row.session_count,
      });
    });
    renderFormerMembersTable();
  } catch (e) {
    showAdminCalendarView();
    await showAppAlert((e.data && e.data.error) || e.message || "Eski üyeler yüklenemedi.");
  }
}

function closeFormerMembersModal() {
  showAdminCalendarView();
}

async function reactivateFormerMemberById(memberId, profileUpdates) {
  if (!memberId || !window.API || !window.API.reactivateMember) return null;
  var m = formerMembersBaseList.find(function (x) { return Number(x.id) === Number(memberId); });
  var label = m ? getMemberDisplayName(m) : ("Üye #" + memberId);
  if (!(await showAppConfirm(label + " tekrar aktif edilsin mi?\n\nAynı üye numarası ve paket/seans geçmişi korunur; aktif paketler sonlandırılır."))) {
    return null;
  }
  try {
    var restored = await window.API.reactivateMember(memberId, profileUpdates || null);
    var fetchRange = getPlannerFetchRange();
    var loaded = await window.API.loadFullState(fetchRange);
    applyStateFromApi(loaded, fetchRange);
    render();
    formerMembersBaseList = formerMembersBaseList.filter(function (x) {
      return Number(x.id) !== Number(restored.id);
    });
    renderFormerMembersTable();
    openExpiredMembershipsModal();
    var memberNo = restored.memberNo || restored.member_no || label;
    await showAppAlert(
      memberNo +
        " yeniden aktif edildi. Aktif paketler sonlandırıldı; kayıt «Paketi Bitmiş Üyeler» listesinde. Giriş şifresi telefon son 4 hane olarak sıfırlandı."
    );
    return restored;
  } catch (e) {
    await showAppAlert((e.data && e.data.error) || e.message || "Yeniden aktif edilemedi.");
    return null;
  }
}

async function createMemberOrReactivateFormer(pendingPayload) {
  try {
    return await window.API.createMember(pendingPayload);
  } catch (e) {
    if (e.status === 409 && e.data && e.data.code === "FORMER_MEMBER" && e.data.formerMember) {
      var fm = e.data.formerMember;
      var label = (fm.name || "Üye") + (fm.memberNo ? " (" + fm.memberNo + ")" : "");
      if (!(await showAppConfirm(
        "Bu telefon eski üyeye ait: " + label + ".\n\nEski kayıt geri açılır; geçmiş korunur, aktif paketler sonlandırılır. Devam edilsin mi?"
      ))) {
        throw e;
      }
      var restored = await window.API.reactivateMember(fm.id, pendingPayload);
      var fetchRange = getPlannerFetchRange();
      var loaded = await window.API.loadFullState(fetchRange);
      applyStateFromApi(loaded, fetchRange);
      render();
      return restored;
    }
    throw e;
  }
}

/** Üye listesi filtresi: ad/soyad (ayrı veya birlikte), telefon, üye no. */
function memberMatchesListFilter(m, filterText) {
  const q = (filterText || "").trim();
  if (!q) return true;
  const ad = m.firstName ?? m.first_name ?? "";
  const soyad = m.lastName ?? m.last_name ?? "";
  const fullName = getMemberFullName(m);
  if (nameTokensMatchFilter(ad, soyad, fullName, q)) return true;
  const memberNo = m.memberNo != null ? String(m.memberNo) : m.member_no != null ? String(m.member_no) : "";
  if (memberNo && memberNo.toLowerCase().includes(q.toLowerCase())) return true;
  const phoneDigits = (m.phone != null ? String(m.phone).replace(/\D/g, "") : "");
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length > 0 && phoneDigits.includes(qDigits)) return true;
  return false;
}

/** Sadece aktif paketi olan üyeleri listeler; takvim alanında tam genişlik panel. */
async function openListMembersModal() {
  const content = els.listMembersContent;
  if (!content) return;
  showAdminMembersListView();
  content.innerHTML = '<p class="hint admin-panel-loading">Yükleniyor…</p>';

  try {
    await ensureActivePackageSessionsForList();
  } catch (_) {}

  content.innerHTML = "";

  const activePackages = (state.memberPackages || []).filter((mp) => isMemberPackageActive(mp));
  const memberIdsWithActive = new Set(activePackages.map((mp) => normId(mp.memberId)));
  const membersWithActive = state.members.filter((m) => memberIdsWithActive.has(normId(m.id)));

  if (membersWithActive.length === 0) {
    content.innerHTML = '<div class="admin-panel-empty"><p>Aktif paketi olan üye yok.</p></div>';
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
    if (mp.remainingSessions != null) return Math.max(0, Number(mp.remainingSessions));
    if (!state.sessions) return Math.max(0, Number(mp.lessonCount ?? mp.lesson_count ?? 0));
    const pkgSessions = state.sessions.filter(
      (s) => normId(s.memberPackageId) === normId(mp.id)
    );
    return computePackageSessionCountsFromSessions(
      pkgSessions,
      mp.lessonCount ?? mp.lesson_count ?? 0
    ).remaining;
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

  const mobileToolbar = document.createElement("div");
  mobileToolbar.className = "list-members-toolbar hidden";
  mobileToolbar.innerHTML =
    '<label class="label" for="listMembersSortSelect">Sırala</label>' +
    '<select id="listMembersSortSelect" class="input list-members-sort-select"></select>';

  const cardsEl = document.createElement("div");
  cardsEl.className = "list-members-cards hidden";

  const tableWrap = document.createElement("div");
  tableWrap.className = "list-members-table-wrap";
  const table = document.createElement("table");
  table.className = "list-members-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  function sortLabel(col, label) {
    const isActive = sortColumn === col;
    const arrow = isActive ? (sortDir === "asc" ? " ▲" : " ▼") : "";
    return label + arrow;
  }
  function makeSortableTh(col, label) {
    const th = document.createElement("th");
    th.setAttribute("data-sort", col);
    th.textContent = sortLabel(col, label);
    th.title = "Sıralamak için tıklayın (küçükten büyüğe / büyükten küçüğe)";
    return th;
  }

  headerRow.innerHTML = `
    <th>Üye No</th>
    <th></th>
    <th>Telefon</th>
    <th>Aktif Paket</th>
    <th></th>
    <th></th>
    <th></th>
    <th></th>
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

  function bindListMemberActions(el, m, mp) {
    el.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openPackageSessionsModal(mp, m.id);
    });
    el.querySelector('[data-action="card"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openMemberCard(m.id);
    });
    el.querySelector('[data-action="package"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openMemberPackageModal(m.id, mp.id);
    });
    el.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
      e.stopPropagation();
      deleteMemberFromList(m.id);
    });
  }

  function memberListActionButtonsHtml() {
    return (
      '<button type="button" class="btn btn--xs btn--ghost" data-action="card">Kimlik Kartı</button>' +
      '<button type="button" class="btn btn--xs btn--ghost" data-action="package">Paket</button>' +
      '<button type="button" class="btn btn--xs btn--ghost" data-action="delete">Sil</button>'
    );
  }

  function renderListMembersRows(members) {
    tbody.innerHTML = "";
    for (const m of members) {
      const mp = getMp(m);
      const packageName = mp ? (mp.packageName || "Paket") : "–";
      const startStr = getStartStr(m) || "–";
      const endStr = getEndStr(m) || "–";
      const remaining = getRemaining(m);
      const row = document.createElement("tr");
      row.className = "list-members-table__row";
      row.title = "Aktif paket seanslarını görmek için tıklayın";
      row.innerHTML = `
        <td>${escapeHtml(m.memberNo || "–")}</td>
        <td>${escapeHtml(getMemberDisplayName(m))}${memberDeletionBadgeHtml(m)}</td>
        <td>${escapeHtml(displayPhone(m.phone) || "–")}</td>
        <td>${escapeHtml(packageName)}</td>
        <td>${escapeHtml(startStr)}</td>
        <td>${escapeHtml(endStr)}</td>
        <td>${remaining}</td>
        <td><span class="list-members-table__actions">${memberListActionButtonsHtml()}</span></td>
      `;
      bindListMemberActions(row, m, mp);
      tbody.appendChild(row);
    }
  }

  function renderListMembersCards(members) {
    cardsEl.innerHTML = "";
    for (const m of members) {
      const mp = getMp(m);
      const packageName = mp ? (mp.packageName || "Paket") : "–";
      const startStr = getStartStr(m) || "–";
      const endStr = getEndStr(m) || "–";
      const remaining = getRemaining(m);
      const card = document.createElement("article");
      card.className = "list-members-card";
      card.title = "Aktif paket seanslarını görmek için tıklayın";
      card.innerHTML =
        '<div class="list-members-card__head">' +
        '<div class="list-members-card__name">' + escapeHtml(getMemberDisplayName(m)) + memberDeletionBadgeHtml(m) + "</div>" +
        '<div class="list-members-card__no">' + escapeHtml(m.memberNo || "–") + "</div>" +
        "</div>" +
        '<div class="list-members-card__meta">' +
        '<span class="list-members-card__phone">' + escapeHtml(displayPhone(m.phone) || "–") + "</span>" +
        '<span class="list-members-card__package">' + escapeHtml(packageName) + "</span>" +
        "</div>" +
        '<div class="list-members-card__dates">' +
        '<span>' + escapeHtml(startStr) + " – " + escapeHtml(endStr) + "</span>" +
        '<span class="list-members-card__remaining">Kalan: ' + remaining + "</span>" +
        "</div>" +
        '<div class="list-members-card__actions">' + memberListActionButtonsHtml() + "</div>";
      bindListMemberActions(card, m, mp);
      cardsEl.appendChild(card);
    }
  }

  const sortSelect = mobileToolbar.querySelector("#listMembersSortSelect");
  const sortOptions = [
    { col: "name", asc: "Ad (A–Z)", desc: "Ad (Z–A)" },
    { col: "start", asc: "Başlangıç (eskiden yeniye)", desc: "Başlangıç (yeniden eskiye)" },
    { col: "end", asc: "Bitiş (eskiden yeniye)", desc: "Bitiş (yeniden eskiye)" },
    { col: "remaining", asc: "Kalan seans (az–çok)", desc: "Kalan seans (çok–az)" },
  ];
  function updateSortSelect() {
    if (!sortSelect) return;
    sortSelect.innerHTML = "";
    sortOptions.forEach(function (opt) {
      ["asc", "desc"].forEach(function (dir) {
        const option = document.createElement("option");
        option.value = opt.col + ":" + dir;
        option.textContent = dir === "asc" ? opt.asc : opt.desc;
        if (sortColumn === opt.col && sortDir === dir) option.selected = true;
        sortSelect.appendChild(option);
      });
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      const parts = sortSelect.value.split(":");
      sortColumn = parts[0] || "name";
      sortDir = parts[1] === "desc" ? "desc" : "asc";
      updateSortHeaders();
      applyAndRender();
    });
  }

  function updateListMembersLayout() {
    const mobile = isMobileViewport();
    mobileToolbar.classList.toggle("hidden", !mobile);
    cardsEl.classList.toggle("hidden", !mobile);
    tableWrap.classList.toggle("hidden", mobile);
    if (mobile) updateSortSelect();
    else updateSortHeaders();
  }

  function applyAndRender() {
    const q = getAdminListFilterText();
    const filtered = q ? membersWithActive.filter((m) => memberMatchesListFilter(m, q)) : membersWithActive;
    const sorted = sortMembers(filtered);
    updateListMembersLayout();
    if (isMobileViewport()) renderListMembersCards(sorted);
    else renderListMembersRows(sorted);
  }

  content._listMembersApplyAndRender = applyAndRender;

  if (content._listMembersResizeHandler) {
    MOBILE_PLANNER_MQ.removeEventListener("change", content._listMembersResizeHandler);
  }
  content._listMembersResizeHandler = function () {
    if (isAdminMembersListViewActive()) applyAndRender();
  };
  MOBILE_PLANNER_MQ.addEventListener("change", content._listMembersResizeHandler);

  applyAndRender();
  tableWrap.appendChild(table);
  content.appendChild(mobileToolbar);
  content.appendChild(cardsEl);
  content.appendChild(tableWrap);
}

function closeListMembersModal() {
  showAdminCalendarView();
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
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);

    html += `
      <tr>
        <td>${dateStr}</td>
        <td>${dayName}</td>
        <td>${startTime}–${endTime}</td>
        <td>${escapeHtml(getSessionMemberDisplayName(s))}</td>
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
    await showAppAlert("Geçersiz dosya.");
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
  render();
}

async function resetAll() {
  const ok = await showAppConfirm("Tüm veriler silinecek. Emin misiniz?");
  if (!ok) return;
  state = deepClone(DEFAULT_STATE);
  setWeekStart(new Date());
  render();
}

function bindEvents() {
  bindAppDialogModal();
  bindAdminPasswordModal();
  if (els.viewWeekBtn) {
    els.viewWeekBtn.addEventListener("click", function () {
      setViewMode("week");
    });
  }
  if (els.viewDayBtn) {
    els.viewDayBtn.addEventListener("click", function () {
      setViewMode("day");
    });
  }
  if (els.viewMonthBtn) {
    els.viewMonthBtn.addEventListener("click", function () {
      setViewMode("month");
    });
  }
  if (els.viewDayListBtn) {
    els.viewDayListBtn.addEventListener("click", function () {
      setDayDisplayMode(ui.dayDisplayMode === "list" ? "grid" : "list");
    });
  }
  if (els.plannerFiltersToggle) {
    els.plannerFiltersToggle.addEventListener("click", togglePlannerFiltersPanel);
  }
  var plannerFilterDebounceTimer = null;
  function applyPlannerFilterNow(extra) {
    clearTimeout(plannerFilterDebounceTimer);
    plannerFilterDebounceTimer = null;
    if (extra) extra();
    refreshAdminListPanels();
    render();
  }
  function applyPlannerFilterDebounced() {
    clearTimeout(plannerFilterDebounceTimer);
    plannerFilterDebounceTimer = setTimeout(function () {
      plannerFilterDebounceTimer = null;
      refreshAdminListPanels();
      render();
    }, 200);
  }
  if (els.plannerFilterInput) {
    els.plannerFilterInput.addEventListener("input", () => {
      ui.plannerFilter = els.plannerFilterInput.value || "";
      syncPlannerFilterInputs();
      updatePlannerFiltersToggleState();
      applyPlannerFilterDebounced();
    });
    els.plannerFilterInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ui.plannerFilter = "";
        syncPlannerFilterInputs();
        updatePlannerFiltersToggleState();
        applyPlannerFilterNow();
      }
    });
  }
  if (els.topbarMobileFilterInput) {
    els.topbarMobileFilterInput.addEventListener("input", () => {
      ui.plannerFilter = els.topbarMobileFilterInput.value || "";
      syncPlannerFilterInputs();
      updatePlannerFiltersToggleState();
      saveUi();
      applyPlannerFilterDebounced();
    });
    els.topbarMobileFilterInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ui.plannerFilter = "";
        syncPlannerFilterInputs();
        updatePlannerFiltersToggleState();
        applyPlannerFilterNow(saveUi);
      }
    });
  }
  if (els.plannerJumpDate) {
    els.plannerJumpDate.addEventListener("change", onPlannerJumpDateSelected);
    els.plannerJumpDate.addEventListener("input", onPlannerJumpDateSelected);
    els.plannerJumpDate.addEventListener("click", function () {
      syncPlannerJumpDateInput();
    });
  }
  if (els.weekLabelPickWrap) {
    els.weekLabelPickWrap.addEventListener("click", function (e) {
      if (!isPlannerDatePickEnabled()) return;
      if (e.target === els.plannerJumpDate) return;
      openPlannerJumpDatePicker();
    });
  }

  // Navigasyon butonları
  els.prevBtn.addEventListener("click", async () => {
    if (ui.viewMode === "day") {
      await setCurrentDay(addDays(ui.currentDay, -1));
    } else if (ui.viewMode === "month") {
      ui.currentMonth = addMonths(ui.currentMonth || startOfMonth(ui.currentDay), -1);
      saveUi();
      render();
      if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
        render();
      }
      await refreshEntryListIfActive();
    } else {
      await setWeekStart(addDays(ui.weekStart, -7));
    }
  });
  els.nextBtn.addEventListener("click", async () => {
    if (ui.viewMode === "day") {
      await setCurrentDay(addDays(ui.currentDay, 1));
    } else if (ui.viewMode === "month") {
      ui.currentMonth = addMonths(ui.currentMonth || startOfMonth(ui.currentDay), 1);
      saveUi();
      render();
      if (!isMemberUser() && await ensurePlannerSessionsLoaded()) {
        render();
      }
      await refreshEntryListIfActive();
    } else {
      await setWeekStart(addDays(ui.weekStart, 7));
    }
  });
  els.todayBtn.addEventListener("click", goToToday);

  function closeTopbarActionsMenu() {
    if (els.topbarActionsMenu) els.topbarActionsMenu.classList.add("hidden");
    if (els.topbarActionsMenuBtn) els.topbarActionsMenuBtn.setAttribute("aria-expanded", "false");
  }
  function openTopbarActionsMenu() {
    if (els.topbarActionsMenu) els.topbarActionsMenu.classList.remove("hidden");
    if (els.topbarActionsMenuBtn) els.topbarActionsMenuBtn.setAttribute("aria-expanded", "true");
  }
  if (els.topbarActionsMenuBtn) {
    els.topbarActionsMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (els.topbarActionsMenu && els.topbarActionsMenu.classList.contains("hidden")) {
        openTopbarActionsMenu();
      } else {
        closeTopbarActionsMenu();
      }
    });
  }
  if (els.topbarActionsMenu) {
    els.topbarActionsMenu.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-topbar-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-topbar-action");
      closeTopbarActionsMenu();
      if (action === "print") printWeeklySchedule();
    });
  }
  document.addEventListener("click", function (e) {
    if (!els.topbarActionsMenu || els.topbarActionsMenu.classList.contains("hidden")) return;
    if (e.target === els.topbarActionsMenuBtn || (els.topbarActionsMenuBtn && els.topbarActionsMenuBtn.contains(e.target))) return;
    if (e.target === els.topbarActionsMenu || els.topbarActionsMenu.contains(e.target)) return;
    closeTopbarActionsMenu();
  });

  els.addSessionBtn.addEventListener("click", () => openGroupSessionModal(null));
  if (els.openListMembersBtn) els.openListMembersBtn.addEventListener("click", openListMembersModal);
  if (els.openCalendarBtn) els.openCalendarBtn.addEventListener("click", showAdminCalendarView);
  bindAdminPanelSwipeBack();
  if (els.openExpiredMembershipsBtn) els.openExpiredMembershipsBtn.addEventListener("click", openExpiredMembershipsModal);
  if (els.openFormerMembersBtn) els.openFormerMembersBtn.addEventListener("click", openFormerMembersModal);
  if (els.closePackageRequestsBtn) els.closePackageRequestsBtn.addEventListener("click", closeRequestsSubPanel);
  if (els.closeCancellationRequestsBtn) els.closeCancellationRequestsBtn.addEventListener("click", closeRequestsSubPanel);
  if (els.openPackageRequestsBtn) els.openPackageRequestsBtn.addEventListener("click", showPackageRequestsPanel);
  if (els.openCancellationRequestsBtn) els.openCancellationRequestsBtn.addEventListener("click", showCancellationRequestsPanel);
  if (els.memberOpenPackageRequestBtn) els.memberOpenPackageRequestBtn.addEventListener("click", openMemberPackageRequestModal);
  if (els.memberPackageRequestSubmitBtn) {
    els.memberPackageRequestSubmitBtn.addEventListener("click", submitMemberPackageRequestFromModal);
  }
  if (els.memberPackageRequestModal) {
    els.memberPackageRequestModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberPackageRequestModal") {
        els.memberPackageRequestModal.classList.add("hidden");
      }
    });
  }
  els.printBtn.addEventListener("click", printWeeklySchedule);
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener("click", performLogout);
  }
  bindAdminProfileActions();
  bindMemberProfileActions();
  if (els.openWorkingHoursBtn) els.openWorkingHoursBtn.addEventListener("click", openWorkingHoursModal);
  if (els.openRoomsBtn) els.openRoomsBtn.addEventListener("click", openRoomsModal);
  if (els.openPackagesBtn) els.openPackagesBtn.addEventListener("click", openPackagesModal);
  if (els.openStaffBtn) els.openStaffBtn.addEventListener("click", openStaffModal);
  if (els.openActivityLogsBtn) els.openActivityLogsBtn.addEventListener("click", openActivityLogsPage);
  if (els.openDevResetBtn) els.openDevResetBtn.addEventListener("click", openDevResetModal);
  if (els.openDevSeedBtn) els.openDevSeedBtn.addEventListener("click", openDevSeedModal);
  if (els.devResetConfirmBtn) els.devResetConfirmBtn.addEventListener("click", confirmDevReset);
  if (els.devSeedConfirmBtn) els.devSeedConfirmBtn.addEventListener("click", confirmDevSeed);

  // Sidebar: mobil drawer + geniş ekranda < / > rail
  if (els.sidebarMenuBtn) {
    els.sidebarMenuBtn.addEventListener("click", toggleSidebar);
  }
  if (els.sidebarCloseBtn) {
    els.sidebarCloseBtn.addEventListener("click", closeSidebar);
  }
  if (els.sidebarDesktopToggleBtn) {
    els.sidebarDesktopToggleBtn.addEventListener("click", toggleSidebarDesktopExpanded);
  }
  if (els.sidebarBackdrop) {
    els.sidebarBackdrop.addEventListener("click", closeSidebar);
  }
  if (els.sidebarShell) {
    var sidebarReflow = function () {
      window.requestAnimationFrame(function () {
        if (typeof repositionOverlappingEvents === "function") repositionOverlappingEvents();
      });
    };
    els.sidebarShell.addEventListener("transitionend", function (e) {
      if (e.propertyName === "width" || e.propertyName === "flex-basis" || e.propertyName === "transform") {
        sidebarReflow();
      }
    });
    els.sidebarShell.addEventListener("click", function (e) {
      if (!isSidebarDrawerMode() || !ui.sidebarOpen) return;
      if (e.target.closest("#openPackageRequestsBtn, #openCancellationRequestsBtn, #closePackageRequestsBtn, #closeCancellationRequestsBtn")) {
        return;
      }
      if (e.target.closest(".sidebar-nav__btn, #openAdminHubBtn, #addMemberBtn, #openCalendarBtn, #openListMembersBtn, #openExpiredMembershipsBtn, #openFormerMembersBtn, #openEntryListBtn")) {
        closeSidebar();
      }
    });
  }
  if (typeof SIDEBAR_DRAWER_MQ.addEventListener === "function") {
    SIDEBAR_DRAWER_MQ.addEventListener("change", onSidebarDrawerMediaChange);
  } else if (typeof SIDEBAR_DRAWER_MQ.addListener === "function") {
    SIDEBAR_DRAWER_MQ.addListener(onSidebarDrawerMediaChange);
  }
  if (typeof TOPBAR_STACK_MQ.addEventListener === "function") {
    TOPBAR_STACK_MQ.addEventListener("change", onTopbarLayoutChange);
  } else if (typeof TOPBAR_STACK_MQ.addListener === "function") {
    TOPBAR_STACK_MQ.addListener(onTopbarLayoutChange);
  }
  if (typeof MOBILE_PLANNER_MQ.addEventListener === "function") {
    MOBILE_PLANNER_MQ.addEventListener("change", onMobilePlannerMediaChange);
  } else if (typeof MOBILE_PLANNER_MQ.addListener === "function") {
    MOBILE_PLANNER_MQ.addListener(onMobilePlannerMediaChange);
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
    updateRoomsSummary();
    renderRooms();
    render();
  });

  els.addStaffBtn.addEventListener("click", async () => {
    const firstName = (els.newStaffFirstName.value || "").trim();
    const lastName = (els.newStaffLastName.value || "").trim();
    const phoneRaw = (els.newStaffPhone.value || "").trim();
    const phone = phoneRaw ? toPhoneFormat(phoneRaw) : "";
    const email = (els.newStaffEmail && els.newStaffEmail.value || "").trim();

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
    if (!phone) {
      els.staffError.textContent = "Telefon zorunludur (personel giriş hesabı için).";
      els.staffError.classList.remove("hidden");
      return;
    }
    if (!email) {
      els.staffError.textContent = "E-posta zorunludur.";
      els.staffError.classList.remove("hidden");
      return;
    }
    if (!isValidEmail(email)) {
      els.staffError.textContent = "Geçerli bir e-posta girin.";
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
        const s = await window.API.createStaff({ firstName, lastName, phone, email, workingHours: defaultWorkingHours });
        state.staff.push(s);
        const loginUser = s.loginUsername || s.email || email;
        const last4 = phone.replace(/\D/g, "").slice(-4);
        await showAppAlert(
          "Personel eklendi.\n\nGiriş bilgileri:\n" +
          "E-posta: " + loginUser + "\n" +
          "Geçici şifre: " + last4 + " (telefon son 4 hane)\n\n" +
          "Personel ilk girişte kendi şifresini belirleyecektir."
        );
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
        email,
        workingHours: defaultWorkingHours,
      });
    }

    els.newStaffFirstName.value = "";
    els.newStaffLastName.value = "";
    els.newStaffPhone.value = "";
    if (els.newStaffEmail) els.newStaffEmail.value = "";
    els.staffError.classList.add("hidden");
    updateStaffSummary();
    renderStaff();
    render();
    closeStaffAddModal();
    if (els.adminHubModal && !els.adminHubModal.classList.contains("hidden")) {
      setAdminHubSection("staff-list");
    }
  });

  els.addMemberBtn.addEventListener("click", () => {
    if (isMobilePlanner()) return;
    openMemberCard(null);
  });

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
  if (els.packageSessionsCards) {
    els.packageSessionsCards.addEventListener("click", async function (e) {
      var card = e.target.closest(".package-session-card--clickable");
      if (!card || e.target.closest("button")) return;
      await openPackageSessionEditorFromPackageList(Number(card.dataset.sessionId));
    });
    els.packageSessionsCards.addEventListener("keydown", async function (e) {
      var card = e.target.closest(".package-session-card--clickable");
      if (!card || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      await openPackageSessionEditorFromPackageList(Number(card.dataset.sessionId));
    });
  }
  if (els.memberPortalSessionsModal) {
    els.memberPortalSessionsModal.addEventListener("click", function (e) {
      if (e.target && e.target.dataset && e.target.dataset.close === "memberPortalSessionsModal") closeMemberPortalSessionsModal();
    });
  }
  if (els.packageSessionsTableBody) {
    els.packageSessionsTableBody.addEventListener("click", async (e) => {
      const tr = e.target.closest("tr[data-session-id]");
      if (!tr) return;
      await openPackageSessionEditorFromPackageList(Number(tr.dataset.sessionId));
    });
  }
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

  els.saveWorkingHoursBtn.addEventListener("click", saveWorkingHours);

  // Paket tanımlama (admin hub içinde)
  if (els.packageSaveBtn) els.packageSaveBtn.addEventListener("click", savePackageFromForm);
  if (els.packageCancelBtn) els.packageCancelBtn.addEventListener("click", clearPackageForm);
  if (els.packagesExportExcelBtn) {
    els.packagesExportExcelBtn.addEventListener("click", async () => {
      if (window.API && window.API.exportPackagesCsv) {
        try {
          await window.API.exportPackagesCsv();
        } catch (err) {
          await showAppAlert(err.message || "Excel'e aktarım başarısız.");
        }
      }
    });
  }

  if (els.staffEditModal) {
    els.staffEditModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "staffEditModal") closeStaffEditModal();
    });
  }
  if (els.staffHoursModal) {
    els.staffHoursModal.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.dataset && target.dataset.close === "staffHoursModal") closeStaffHoursModal();
    });
  }

  // Görev dağıtım modal
  els.taskDistributionModal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close) closeTaskDistributionModal();
  });

  // Üyeliği bitmiş üyeler modal
  // Üyeliği bitmiş üyeler — ana panel (modal kaldırıldı)
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
      const candidateBase = { startTs, endTs, staffId, memberId: availableMember.id, roomId: "", note: "" };
      roomId = autoAssignRoom(candidateBase, { ignoreSessionId: null });
    } else {
      const firstSession = currentGroupSessions[0];
      if (!firstSession) return;
      startTs = firstSession.startTs;
      endTs = firstSession.endTs;
      staffId = firstSession.staffId;
      roomId = firstSession.roomId;
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
  if (els.groupSessionNewDate) els.groupSessionNewDate.addEventListener("change", syncNewGroupSessionFieldsChange);
  if (els.groupSessionNewTime) els.groupSessionNewTime.addEventListener("change", syncNewGroupSessionFieldsChange);
  if (els.groupSessionNewStaff) els.groupSessionNewStaff.addEventListener("change", syncNewGroupSessionFieldsChange);

  els.saveGroupSessionBtn.addEventListener("click", saveGroupSession);
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (els.staffAddModal && !els.staffAddModal.classList.contains("hidden")) closeStaffAddModal();
      if (els.adminHubModal && !els.adminHubModal.classList.contains("hidden")) closeAdminHubModal();
      if (els.packageSessionsModal && !els.packageSessionsModal.classList.contains("hidden")) closePackageSessionsModal();
      if (els.staffEditModal && !els.staffEditModal.classList.contains("hidden")) closeStaffEditModal();
      if (els.staffHoursModal && !els.staffHoursModal.classList.contains("hidden")) closeStaffHoursModal();
      if (!els.taskDistributionModal.classList.contains("hidden")) closeTaskDistributionModal();
      if (isAdminPanelViewActive()) {
        clearPlannerFilters();
        showAdminCalendarView();
        render();
      }
      if (!els.groupSessionModal.classList.contains("hidden")) closeGroupSessionModal();
      if (els.memberPortalSessionsModal && !els.memberPortalSessionsModal.classList.contains("hidden")) closeMemberPortalSessionsModal();
      if (els.memberSessionCancelModal && !els.memberSessionCancelModal.classList.contains("hidden")) closeMemberSessionCancelModal();
      if (els.memberQrModal && !els.memberQrModal.classList.contains("hidden")) closeMemberQrModal();
      var adminAccountScreen = document.getElementById("adminAccountScreen");
      if (adminAccountScreen && !adminAccountScreen.classList.contains("hidden")) closeAdminAccountScreen();
      var passwordChangeScreen = document.getElementById("passwordChangeScreen");
      if (passwordChangeScreen && !passwordChangeScreen.classList.contains("hidden")) closePasswordChangeScreen();
      if (els.memberProfileModal && !els.memberProfileModal.classList.contains("hidden")) closeMemberProfileModal();
      if (ui.sidebarOpen && isSidebarDrawerMode()) closeSidebar();
      if (els.plannerFiltersWrap && els.plannerFiltersWrap.classList.contains("topbar__filters--open")) {
        closePlannerFiltersPanel();
      }
      closeTopbarActionsMenu();
    }
  });

  // Ekran boyutu değişince event genişlikleri tekrar hesaplanmalı
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (applyPlannerLayoutForViewport()) {
        if (
          memberPortalSessionsCurrent &&
          els.memberPortalSessionsModal &&
          !els.memberPortalSessionsModal.classList.contains("hidden")
        ) {
          renderMemberPortalSessionsTable(
            memberPortalSessionsCurrent.pkg.sessions || [],
            memberPortalSessionsCurrent.isActive
          );
        }
        if (packageSessionsCurrent && els.packageSessionsModal && !els.packageSessionsModal.classList.contains("hidden")) {
          renderPackageSessionsTable(packageSessionsCurrent.sessions);
        }
        render();
        return;
      }
      const { startMin, slotMin, slots } = buildTimeSlots();
      renderEvents({ startMin, slotMin, slotsCount: slots.length });
    }, 80);
  });
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function prepareWorkingHoursPanel() {
  if (!els.workingHoursList) return;
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
      <div class="listItem__left">
        <input type="checkbox" data-day="${day}" ${enabled ? "checked" : ""} />
        <label>${DAY_NAMES[day]}</label>
      </div>
      <div class="listItem__actions">
        <input class="input" type="time" data-day="${day}" data-type="start" value="${enabled ? (wh.start || "08:00") : ""}" ${enabled ? "" : "disabled"} />
        <span class="listItem__sep">–</span>
        <input class="input" type="time" data-day="${day}" data-type="end" value="${enabled ? (wh.end || "20:00") : ""}" ${enabled ? "" : "disabled"} />
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
}

function openWorkingHoursModal() {
  openAdminHubModal("working-hours");
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
  updateWorkingHoursSummary();
  render();
}

function render() {
  if (isMemberUser()) {
    updateMemberTabUI();
    return;
  }

  updateWorkingHoursSummary();
  updateRoomsSummary();
  if (typeof updatePackagesSummary === "function") updatePackagesSummary();
  updateStaffSummary();
  updateTopbarForViewMode();
  updateMemberTabUI();
  refreshAdminListPanels();

  if (els.mainContent) {
    els.mainContent.classList.toggle("view-day", ui.viewMode === "day");
    els.mainContent.classList.toggle("view-week", ui.viewMode === "week");
    els.mainContent.classList.toggle("view-month", ui.viewMode === "month");
  }

  renderMembers();

  if (isAdminUser() && !isStaffUser()) {
    refreshAdminPackageRequests(false);
    refreshAdminDeletionRequests();
  }

  if (getEffectiveDayDisplayMode() === "list") {
    renderSessionsListView();
    return;
  }

  if (ui.viewMode === "month") {
    renderMonthView();
    return;
  }

  if (els.plannerGridWrap) els.plannerGridWrap.classList.remove("hidden");
  if (els.plannerHeader) els.plannerHeader.classList.remove("hidden");
  if (els.plannerDayList) els.plannerDayList.classList.add("hidden");
  if (els.plannerMonth) els.plannerMonth.classList.add("hidden");

  renderHeader();
  renderGrid();
}

function showLoginOverlay() {
  const ov = document.getElementById("loginOverlay");
  const main = document.getElementById("mainApp");
  if (ov) {
    ov.classList.remove("hidden");
    ov.setAttribute("aria-hidden", "false");
  }
  if (main) main.classList.add("app--behind-login");
  document.body.classList.add("login-screen-open");
  setAppBooting(false);
  bindLoginForm();
}

function hideLoginOverlay() {
  const ov = document.getElementById("loginOverlay");
  const main = document.getElementById("mainApp");
  if (ov) {
    ov.classList.add("hidden");
    ov.setAttribute("aria-hidden", "true");
  }
  if (main) main.classList.remove("app--behind-login");
  document.body.classList.remove("login-screen-open");
}

function bindLoginForm() {
  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  if (!form || !window.API || form.dataset.bound === "1") return;
  form.dataset.bound = "1";
  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const email = (document.getElementById("loginEmail") || {}).value.trim();
    const p = (document.getElementById("loginPassword") || {}).value;
    if (!email || !p) return;
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (btn) btn.disabled = true;
    try {
      const data = await window.API.login(email, p);
      if (data.user && data.user.role) {
        try {
          sessionStorage.setItem(LAST_ROLE_KEY, data.user.role);
        } catch (_) {}
        ui.currentUser = { role: data.user.role };
      }
      hideLoginOverlay();
      const proceedAfterConsent = function () {
        if (data.user && data.user.mustChangePassword) {
          showChangePasswordOverlay();
        } else {
          location.reload();
        }
      };
      if (data.user && data.user.consentRequired) {
        await loadLegalLinks();
        openLegalConsentScreen(proceedAfterConsent);
      } else {
        proceedAfterConsent();
      }
    } catch (e) {
      if (errEl) {
        errEl.textContent = (e.data && e.data.error) || e.message || "Giriş başarısız";
        errEl.classList.remove("hidden");
      }
      if (btn) btn.disabled = false;
    }
  });
}

function showChangePasswordOverlay() {
  openPasswordChangeScreen("initial");
}

function hideChangePasswordOverlay() {
  closePasswordChangeScreen();
}

function bindChangePasswordForm() {
  bindPasswordChangeScreen();
}

var appDidInit = false;
var LAST_ROLE_KEY = "planner_last_role";

var SPLASH_MIN_MS = 2400;
var splashStartedAt = (typeof window !== "undefined" && typeof window.__splashStartedAt === "number")
  ? window.__splashStartedAt
  : (typeof performance !== "undefined" ? performance.now() : Date.now());
var splashAppReady = false;
var splashDismissed = false;
var splashOnDismiss = null;
var splashHideTimer = null;

function showSplashScreen() {
  var el = document.getElementById("appSplash");
  if (!el) return;
  if (el.classList.contains("app-splash--instant") && !el.classList.contains("hidden") && !el.classList.contains("app-splash--out")) {
    return;
  }
  el.classList.remove("hidden", "app-splash--out");
  el.setAttribute("aria-hidden", "false");
  document.body.classList.add("splash-screen-open");
}

function hideSplashScreen() {
  if (splashDismissed) return;
  splashDismissed = true;
  var el = document.getElementById("appSplash");
  if (!el) {
    if (typeof splashOnDismiss === "function") splashOnDismiss();
    splashOnDismiss = null;
    return;
  }
  el.classList.add("app-splash--out");
  el.setAttribute("aria-hidden", "true");
  window.setTimeout(function () {
    el.classList.add("hidden");
    document.body.classList.remove("splash-screen-open");
    if (typeof splashOnDismiss === "function") splashOnDismiss();
    splashOnDismiss = null;
  }, 480);
}

function markSplashAppReady() {
  if (splashDismissed) return;
  splashAppReady = true;
  if (splashHideTimer != null) return;
  var elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - splashStartedAt;
  var waitMs = Math.max(0, SPLASH_MIN_MS - elapsed);
  splashHideTimer = window.setTimeout(function () {
    splashHideTimer = null;
    hideSplashScreen();
  }, waitMs);
}

function queueAfterSplash(fn) {
  if (splashDismissed) {
    fn();
    return;
  }
  splashOnDismiss = fn;
  markSplashAppReady();
}

function setAppBooting(on) {
  var main = document.getElementById("mainApp");
  if (main) main.classList.toggle("app--booting", !!on);
}

function ensureAppInit() {
  if (appDidInit) return;
  init();
  appDidInit = true;
}

function prefetchStateForRole(role) {
  if (!window.API) return null;
  if (role === "member" && window.API.loadMemberPortalState) {
    return window.API.loadMemberPortalState();
  }
  if (role === "admin" || role === "staff") {
    return window.API.loadFullState(getPlannerFetchRange());
  }
  return null;
}

function init() {
  initMobilePlannerDefaults();
  applyPlannerLayoutForViewport();
  updateAdminMobileTopbarClass();
  updateSidebarForRole();
  // Telefon alanları: sadece rakam, en fazla 10 hane
  [els.mcPhone, els.mcContactPhone, els.newStaffPhone, els.editStaffPhone].forEach((el) => {
    if (el) el.addEventListener("input", function () { restrictPhoneInput(this); });
  });
  bindEvents();
  render();
  startStaffAttendancePoll();
  // Pencere/alan boyutu değişince kartları yeniden konumla (günlük + haftalık)
  if (els.plannerGrid && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      repositionOverlappingEvents();
    });
    ro.observe(els.plannerGrid);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  cacheEls();
  try { localStorage.removeItem("seans_planner_v1"); } catch (_) {}

  if (!window.API || !window.API.getToken()) {
    loadLegalLinks();
    queueAfterSplash(showLoginOverlay);
    return;
  }

  setAppBooting(true);

  try {
    var lastRole = sessionStorage.getItem(LAST_ROLE_KEY);
    var meP = window.API.getMe();
    var loadP = prefetchStateForRole(lastRole);
    var me = await meP;
    ui.currentUser = me || null;
    updateSidebarForRole();

    if (me && me.consentRequired) {
      setAppBooting(false);
      await loadLegalLinks();
      queueAfterSplash(function () {
        openLegalConsentScreen(function () {
          if (me.mustChangePassword) {
            showChangePasswordOverlay();
          } else {
            location.reload();
          }
        });
      });
      return;
    }

    if (me && me.mustChangePassword) {
      setAppBooting(false);
      queueAfterSplash(showChangePasswordOverlay);
      return;
    }

    var loaded;
    var fetchRange = getPlannerFetchRange();
    if (loadP) {
      loaded = await loadP;
    } else if (me && me.role === "member" && window.API.loadMemberPortalState) {
      loaded = await window.API.loadMemberPortalState();
    } else {
      loaded = await window.API.loadFullState(fetchRange);
    }

    if (me && me.role) {
      try { sessionStorage.setItem(LAST_ROLE_KEY, me.role); } catch (_) {}
    }

    if (me && me.role === "member") {
      applyMemberPortalState(loaded);
    } else {
      applyStateFromApi(loaded, fetchRange);
    }
    updateSidebarForRole();
    ensureAppInit();
    render();
  } catch (e) {
    console.error("API load hatası:", e);
    if (e.status === 401) {
      if (window.API) window.API.removeToken();
      try { sessionStorage.removeItem(LAST_ROLE_KEY); } catch (_) {}
      queueAfterSplash(showLoginOverlay);
      return;
    }
    if (!appDidInit) {
      ensureAppInit();
    }
    updateSidebarForRole();
    showAppAlert("Veriler yüklenemedi. Lütfen sayfayı yenileyin.");
  }
  setAppBooting(false);
  markSplashAppReady();
  if (ui.currentUser && window.API) startSessionAutoSync();
});

/** PERF-01: Konsolda perfBaseline() — render süreleri ve boot süresi */
(function perfBaselineSetup() {
  if (typeof window === "undefined" || typeof performance === "undefined") return;
  var bootT = performance.now();
  var renderTimes = [];
  var origRender = render;
  render = function () {
    var t0 = performance.now();
    origRender();
    var ms = Math.round((performance.now() - t0) * 10) / 10;
    renderTimes.push({
      n: renderTimes.length + 1,
      ms: ms,
      member: typeof isMemberUser === "function" ? isMemberUser() : false,
      view: ui && ui.viewMode,
      list: ui && ui.dayDisplayMode,
    });
    if (ms > 32 || renderTimes.length <= 2) {
      console.debug("[perf] render #" + renderTimes.length + ": " + ms + " ms");
    }
  };
  window.perfBaseline = function () {
    var sum = renderTimes.reduce(function (s, r) { return s + r.ms; }, 0);
    return {
      measuredAt: new Date().toISOString(),
      sinceBootMs: Math.round(performance.now() - bootT),
      renderCount: renderTimes.length,
      avgRenderMs: renderTimes.length ? Math.round((sum / renderTimes.length) * 10) / 10 : null,
      lastRenderMs: renderTimes.length ? renderTimes[renderTimes.length - 1].ms : null,
      recentRenders: renderTimes.slice(-10),
      hint: "Takvim prev/next sonrası tekrar perfBaseline() çağırın.",
    };
  };
})();

