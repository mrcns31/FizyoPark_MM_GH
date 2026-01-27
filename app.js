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

function getRoomById(roomId) {
  return state.rooms.find((r) => r.id === roomId) || null;
}
function getStaffById(staffId) {
  return state.staff.find((s) => s.id === staffId) || null;
}

function getStaffFullName(staff) {
  if (!staff) return "Personel";
  if (staff.name) return staff.name; // Eski format desteği
  return `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || "Personel";
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
  return state.members.find((m) => m.id === memberId) || null;
}

function getSessionsInRange(startTs, endTs) {
  return state.sessions.filter((s) => overlaps(s.startTs, s.endTs, startTs, endTs));
}

function getStaffBusyRoomId(candidate, { ignoreSessionId = null } = {}) {
  // Personelin aynı anda birden fazla seansı olabilir ama yalnızca TEK oda içinde.
  // return: null | roomId | "__MULTI__"
  const relevant = state.sessions.filter((s) => s.id !== ignoreSessionId);
  const overlap = relevant.filter(
    (s) => s.staffId === candidate.staffId && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
  );
  const roomIds = [...new Set(overlap.map((s) => s.roomId).filter(Boolean))];
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
  } else if (busyRoomId && candidate.roomId && candidate.roomId !== busyRoomId) {
    const busyRoom = getRoomById(busyRoomId);
    conflicts.push(
      `Seçilen personel bu saat aralığında ${busyRoom?.name ? `"${busyRoom.name}"` : "başka bir odada"} seanslı. Aynı anda farklı oda olmaz.`,
    );
  }

  for (const s of relevant) {
    if (!overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs)) continue;
    if (s.memberId === candidate.memberId) {
      conflicts.push("Seçilen üye bu saat aralığında zaten planlı.");
      break;
    }
  }

  const room = getRoomById(candidate.roomId);
  if (room) {
    const overlapInRoom = relevant.filter(
      (s) => s.roomId === candidate.roomId && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
    );
    const count = overlapInRoom.length;
    if (count >= room.devices) {
      conflicts.push(`"${room.name}" için bu saat aralığında kapasite dolu (alet: ${room.devices}).`);
    }

    // KURAL: Aynı anda aynı odada sadece 1 personel olabilir.
    // (Odada aynı anda birden fazla seans olabilir ama personeli aynı olmalı.)
    const otherStaff = overlapInRoom.find((s) => s.staffId && s.staffId !== candidate.staffId);
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
  const relevant = state.sessions.filter((s) => s.id !== ignoreSessionId);
  const rooms = [...state.rooms];
  for (const room of rooms) {
    const overlapInRoom = relevant.filter(
      (s) => s.roomId === room.id && overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs),
    );

    // Kapasite (alet) kontrolü
    if (overlapInRoom.length >= room.devices) continue;

    // KURAL: aynı anda aynı odada sadece 1 personel.
    // Eğer odada o anda seans(lar) varsa, personelleri candidate ile aynı olmalı.
    const hasOtherStaff = overlapInRoom.some((s) => s.staffId && s.staffId !== candidate.staffId);
    if (hasOtherStaff) continue;

    return room.id;
  }
  return null;
}

let state = loadState();
let ui = {
  weekStart: startOfWeekMonday(new Date()),
  currentDay: new Date(), // Günlük görünüm için seçili gün
  viewMode: "week", // "week" veya "day"
  editingSessionId: null,
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
    "resetBtn",
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
    "newMemberName",
    "addMemberBtn",
    "sessionModal",
    "sessionModalTitle",
    "sessionDate",
    "sessionTime",
    "sessionDuration",
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
    "groupSessionDate",
    "groupSessionTime",
    "groupSessionStaff",
    "groupSessionRoom",
    "groupSessionMembers",
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

    // Grid column sayısını dinamik yap
    header.style.gridTemplateColumns = `74px repeat(${enabledCount}, 1fr)`;

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
          openSessionModal({
            mode: "new",
            date: dStr,
            time: minutesToTime(minuteOfDay),
          });
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
    // Grid column sayısını dinamik yap (1 saat sütunu + açık gün sayısı)
    grid.style.gridTemplateColumns = `74px repeat(${enabledCount}, 1fr)`;

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
            openSessionModal({
              mode: "new",
              date: dStr,
              time: minutesToTime(minuteOfDay),
            });
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

    // Çakışan seanslar için kolon (yan yana) yerleşim
    const layout = overlapLayout.get(s.id) || { col: 0, cols: 1 };
    const cols = Math.max(1, Number(layout.cols || 1));
    const col = Math.max(0, Number(layout.col || 0));

    const sidePad = 6;
    let gap = cols > 1 ? 6 : 0;
    const available = Math.max(0, cell.clientWidth - sidePad * 2);
    let width = cols > 0 ? (available - gap * (cols - 1)) / cols : available;
    if (width < 110 && cols > 1) {
      gap = 3;
      width = (available - gap * (cols - 1)) / cols;
    }

    const left = sidePad + col * (width + gap);
    ev.style.left = `${left}px`;
    ev.style.width = `${Math.max(10, width)}px`;
    ev.style.right = "auto";

    const staff = getStaffById(group.staffId);
    const room = getRoomById(group.roomId);
    const color = staffColor(group.staffId);
    const memberNames = group.sessions
      .map((sess) => {
        const m = getMemberById(sess.memberId);
        return m?.name || "Üye";
      })
      .filter((n, i, arr) => arr.indexOf(n) === i); // benzersiz

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;

    ev.innerHTML = `
      <div class="event__row">
        <div class="event__title"><span class="event__muted">(${group.sessions.length})</span> ${escapeHtml(room?.name || "Oda")}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="event__badge" style="border-color:${color.border}; background:${color.badge}">${escapeHtml(getStaffFullName(staff))}</div>
          <button class="event__deleteBtn" title="Tüm seansları iptal et" data-staff-id="${group.staffId}" data-start-ts="${group.startTs}" data-end-ts="${group.endTs}" data-room-id="${group.roomId}">🗑️</button>
        </div>
      </div>
      <div class="event__members">${memberNames.map(name => escapeHtml(name)).join('<br>')}</div>
    `;
    
    // Silme butonu event listener
    const deleteBtn = ev.querySelector(".event__deleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const staffId = deleteBtn.dataset.staffId;
        const startTs = parseInt(deleteBtn.dataset.startTs);
        const endTs = parseInt(deleteBtn.dataset.endTs);
        const roomId = deleteBtn.dataset.roomId;
        
        const staff = getStaffById(staffId);
        const staffName = getStaffFullName(staff);
        const sessionCount = group.sessions.length;
        
        if (confirm(`${staffName} personelinin bu saatteki ${sessionCount} seansını iptal etmek istediğinize emin misiniz?`)) {
          // O personelin, o saatteki, o odadaki tüm seanslarını sil
          state.sessions = state.sessions.filter(s => {
            return !(s.staffId === staffId && 
                     s.startTs === startTs && 
                     s.endTs === endTs && 
                     s.roomId === roomId);
          });
          
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

  // Tüm event'ler render edildikten sonra yükseklikleri ölç ve satır yüksekliklerini ayarla
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

    // Çakışan seanslar için kolon (yan yana) yerleşim
    const layout = overlapLayout.get(s.id) || { col: 0, cols: 1 };
    const cols = Math.max(1, Number(layout.cols || 1));
    const col = Math.max(0, Number(layout.col || 0));

    const sidePad = 6;
    let gap = cols > 1 ? 6 : 0;
    const available = Math.max(0, cell.clientWidth - sidePad * 2);
    let width = cols > 0 ? (available - gap * (cols - 1)) / cols : available;
    if (width < 110 && cols > 1) {
      gap = 3;
      width = (available - gap * (cols - 1)) / cols;
    }

    const left = sidePad + col * (width + gap);
    ev.style.left = `${left}px`;
    ev.style.width = `${Math.max(10, width)}px`;
    ev.style.right = "auto";

    const member = getMemberById(s.memberId);
    const staff = getStaffById(s.staffId);
    const room = getRoomById(s.roomId);
    const color = staffColor(s.staffId);

    const startTime = minutesToTime(startMinOfDay);
    const endTime = minutesToTime(endMinOfDay);

    ev.style.borderColor = color.border;
    ev.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.04))`;

    ev.innerHTML = `
      <div class="event__row">
        <div class="event__title">${escapeHtml(member?.name || "Üye")} • ${escapeHtml(room?.name || "Oda")}</div>
        <div class="event__badge" style="border-color:${color.border}; background:${color.badge}">${escapeHtml(getStaffFullName(staff))}</div>
      </div>
    `;

    ev.addEventListener("click", (e) => {
      e.stopPropagation();
      openSessionModal({ mode: "edit", sessionId: s.id });
    });

    cell.appendChild(ev);
  }

  // Tüm event'ler render edildikten sonra yükseklikleri ölç ve satır yüksekliklerini ayarla
  setTimeout(() => {
    measureAndUpdateRowHeights(rowHeights);
  }, 0);
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

function staffColor(staffId) {
  // Stabil renk (personel bazlı) - HSL
  const s = String(staffId || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const hue = h;
  const border = `hsla(${hue}, 90%, 65%, .75)`;
  const bg = `hsla(${hue}, 90%, 60%, .22)`;
  const badge = `hsla(${hue}, 90%, 72%, .18)`;
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
            ${escapeHtml(s.phone || "Telefon yok")}
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
  els.editStaffPhone.value = staff.phone || "";

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
  const phone = (els.editStaffPhone.value || "").trim();

  if (!firstName || !lastName) {
    els.staffCardError.textContent = "Ad ve soyad girin.";
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
  staff.phone = phone;
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

function renderMembers() {
  const wrap = els.membersList;
  wrap.innerHTML = "";
  for (const m of state.members) {
    const item = document.createElement("div");
    item.className = "listItem";
    item.innerHTML = `
      <div class="listItem__left">
        <div class="listItem__title">${escapeHtml(m.name)}</div>
        <div class="listItem__meta">Üye</div>
      </div>
      <div class="listItem__actions">
        <button class="btn btn--xs btn--ghost" type="button">Sil</button>
      </div>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.members = state.members.filter((x) => x.id !== m.id);
      saveState();
      render();
    });
    wrap.appendChild(item);
  }
}

function refreshSessionFormOptions({ dateStr = null, timeStr = null } = {}) {
  // Members
  els.sessionMember.innerHTML = "";
  for (const m of state.members) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
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
    o.value = s.id;
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
    o.value = r.id;
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
    els.sessionDuration.value = "60";
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
    const durMin = Math.round((s.endTs - s.startTs) / 60000);

    els.sessionDate.value = dateStr;
    els.sessionTime.value = timeStr;
    els.sessionDuration.value = String(durMin);
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

function openGroupSessionModal(group) {
  currentGroupSessions = [...group.sessions];
  
  if (currentGroupSessions.length === 0) return;
  
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
  els.groupSessionError.classList.add("hidden");
  
  renderGroupSessionMembers();
  
  els.groupSessionModal.classList.remove("hidden");
}

function closeGroupSessionModal() {
  els.groupSessionModal.classList.add("hidden");
  currentGroupSessions = [];
}

function renderGroupSessionMembers() {
  const container = els.groupSessionMembers;
  container.innerHTML = "";
  
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
    
    // Tüm üyeleri ekle
    for (const m of state.members) {
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = m.name;
      if (m.id === session.memberId) {
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

function saveGroupSession() {
  if (currentGroupSessions.length === 0) {
    els.groupSessionError.textContent = "En az bir üye olmalı.";
    els.groupSessionError.classList.remove("hidden");
    return;
  }
  
  els.groupSessionError.classList.add("hidden");
  
  // Mevcut grup seanslarının ID'lerini al
  const existingSessionIds = new Set();
  for (const session of currentGroupSessions) {
    const existingSession = state.sessions.find(s => s.id === session.id);
    if (existingSession) {
      existingSessionIds.add(session.id);
      // Üye değişikliğini kaydet
      existingSession.memberId = session.memberId;
    }
  }
  
  // Silinen seansları kaldır (currentGroupSessions'ta olmayan ama aynı grup seanslarından olanları)
  const firstSession = currentGroupSessions[0];
  if (firstSession) {
    const groupSessionIds = new Set(currentGroupSessions.map(s => s.id));
    
    // Aynı personel, oda ve saatteki tüm seansları bul
    const sameGroupSessions = state.sessions.filter(s => 
      s.staffId === firstSession.staffId &&
      s.roomId === firstSession.roomId &&
      s.startTs === firstSession.startTs &&
      s.endTs === firstSession.endTs
    );
    
    // Grup seanslarından olup da currentGroupSessions'ta olmayanları sil
    for (const s of sameGroupSessions) {
      if (!groupSessionIds.has(s.id)) {
        const index = state.sessions.findIndex(x => x.id === s.id);
        if (index >= 0) {
          state.sessions.splice(index, 1);
        }
      }
    }
    
    // Yeni eklenen seansları state'e ekle
    for (const session of currentGroupSessions) {
      if (!existingSessionIds.has(session.id)) {
        // Yeni seans, state'e ekle
        state.sessions.push(session);
      }
    }
  }
  
  saveState();
  render();
  closeGroupSessionModal();
}

function saveSessionFromModal() {
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
  const durationMin = Number(els.sessionDuration.value || 60);
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

  if (ui.editingSessionId) {
    state.sessions = state.sessions.map((s) => (s.id === ui.editingSessionId ? candidate : s));
  } else {
    state.sessions.push(candidate);
  }

  // startTs'e göre sırala (görsel düzen)
  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  closeSessionModal();
  render();
}

function deleteSessionFromModal() {
  if (!ui.editingSessionId) return;
  const ok = confirm("Seansı silmek istiyor musunuz?");
  if (!ok) return;
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

  els.addSessionBtn.addEventListener("click", () => openSessionModal({ mode: "new" }));
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
  els.resetBtn.addEventListener("click", resetAll);

  els.openWorkingHoursBtn.addEventListener("click", openWorkingHoursModal);
  els.openRoomsBtn.addEventListener("click", openRoomsModal);
  els.openStaffBtn.addEventListener("click", openStaffModal);

  els.addRoomBtn.addEventListener("click", () => {
    const name = (els.newRoomName.value || "").trim();
    const devices = clamp(Number(els.newRoomDevices.value || 1), 1, 999);
    if (!name) {
      els.roomsError.textContent = "Oda adı girin.";
      els.roomsError.classList.remove("hidden");
      return;
    }
    // Aynı isimde oda var mı kontrol et
    if (state.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      els.roomsError.textContent = "Bu isimde bir oda zaten var.";
      els.roomsError.classList.remove("hidden");
      return;
    }
    state.rooms.push({ id: uid("room"), name, devices });
    els.newRoomName.value = "";
    els.newRoomDevices.value = "1";
    els.roomsError.classList.add("hidden");
    saveState();
    updateRoomsSummary();
    renderRooms(); // Modal içindeki listeyi yenile
    render(); // Ana görünümü yenile
  });

  els.addStaffBtn.addEventListener("click", () => {
    const firstName = (els.newStaffFirstName.value || "").trim();
    const lastName = (els.newStaffLastName.value || "").trim();
    const phone = (els.newStaffPhone.value || "").trim();

    if (!firstName || !lastName) {
      els.staffError.textContent = "Ad ve soyad girin.";
      els.staffError.classList.remove("hidden");
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();
    // Aynı isimde personel var mı kontrol et
    if (state.staff.some((s) => {
      const sFullName = getStaffFullName(s);
      return sFullName.toLowerCase() === fullName.toLowerCase();
    })) {
      els.staffError.textContent = "Bu isimde bir personel zaten var.";
      els.staffError.classList.remove("hidden");
      return;
    }

    // Varsayılan çalışma saatleri (genel varsayılan)
    const defaultWorkingHours = {};
    for (let day = 0; day < 7; day++) {
      defaultWorkingHours[day] = {
        start: "08:00",
        end: "20:00",
        enabled: day !== 0, // Pazar kapalı
      };
    }

    state.staff.push({
      id: uid("staff"),
      firstName,
      lastName,
      phone,
      workingHours: defaultWorkingHours,
    });

    els.newStaffFirstName.value = "";
    els.newStaffLastName.value = "";
    els.newStaffPhone.value = "";
    els.staffError.classList.add("hidden");
    saveState();
    updateStaffSummary();
    renderStaff(); // Modal içindeki listeyi yenile
    render(); // Ana görünümü yenile
  });

  els.addMemberBtn.addEventListener("click", () => {
    const name = (els.newMemberName.value || "").trim();
    if (!name) return;
    state.members.push({ id: uid("mem"), name });
    els.newMemberName.value = "";
    saveState();
    render();
  });

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
    if (currentGroupSessions.length === 0) return;
    
    const firstSession = currentGroupSessions[0];
    const usedMemberIds = new Set(currentGroupSessions.map(s => s.memberId));
    const availableMember = state.members.find(m => !usedMemberIds.has(m.id));
    
    if (!availableMember) {
      els.groupSessionError.textContent = "Tüm üyeler zaten eklenmiş.";
      els.groupSessionError.classList.remove("hidden");
      return;
    }
    
    const durMin = Math.round((firstSession.endTs - firstSession.startTs) / 60000);
    const newSession = {
      id: uid("sess"),
      startTs: firstSession.startTs,
      endTs: firstSession.endTs,
      memberId: availableMember.id,
      staffId: firstSession.staffId,
      roomId: firstSession.roomId,
      note: firstSession.note || "",
    };
    
    // Çakışma kontrolü
    const conflicts = checkConflicts(newSession, { ignoreSessionId: null });
    if (conflicts.length > 0) {
      els.groupSessionError.textContent = "Yeni üye eklenemiyor: çakışma var.";
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

function saveWorkingHours() {
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

function init() {
  cacheEls();
  bindEvents();
  // Varsayılan görünüm: haftalık
  if (ui.viewMode === "week") {
    els.viewWeekBtn.classList.add("btn--primary");
  } else {
    els.viewDayBtn.classList.add("btn--primary");
  }
  render();
}

document.addEventListener("DOMContentLoaded", init);

