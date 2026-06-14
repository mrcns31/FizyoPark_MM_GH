# Seans Akışları Tutarlılık Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No automated tests:** This project does not use automated test files for this change. Each task ends with `node --check app.js` (syntax) plus a "Manuel test" step describing exactly what to do in the running app to verify behavior. Do not create test files.

**Goal:** Strip all frontend-side room-capacity / "staff busy in another room" guessing logic out of the three session flows (`saveSessionFromModal`, `saveGroupSession`, `groupSessionAddMemberBtn`), leaving only the member-conflict check and working-hours checks on the frontend. Backend's existing `validateRoomForSession` + `rebalanceSlotRooms` + `placeSessionWithRebalance` (in `backend/utils/sessionSlot.js`) is the sole source of truth for capacity/room assignment, and a sync from server always runs after a successful save.

**Architecture:** `app.js` (~12,000 lines, vanilla JS, no build step, no test framework). Two shared helper functions (`checkConflicts`, `autoAssignRoom`) around line 711-791 get simplified first (Task 1), then each of the three save flows is updated to match the new common-step sequence from the spec (Tasks 2-4). `getStaffBusyRoomId` becomes unused and is deleted in Task 1.

**Tech Stack:** Vanilla JavaScript (browser, no bundler). Verify with `node --check app.js` after each edit (catches syntax errors only — this file isn't a Node module, but `--check` parses it fine). Manual verification is done by opening the served app in a browser (`npm run` dev server per `package.json`/`server.js` at repo root, or however the project is normally run) and exercising the session modals.

---

## File Structure

- **Modify:** `d:\26-01-2026-Cursor-Takip\FP_MM\app.js`
  - Lines ~711-791: `getStaffBusyRoomId` (delete), `checkConflicts` (simplify), `autoAssignRoom` (simplify).
  - Lines ~9212-9473: `saveGroupSession` — remove `groupOverCapacity` block, simplify slot-changed/slot-unchanged branches, unconditional sync.
  - Lines ~9475-9684: `saveSessionFromModal` — remove `needsServerRebalanceSingle` / busy-room logic, unconditional sync.
  - Lines ~11291-11403: `groupSessionAddMemberBtn` click handler — remove `overCapacity` branch, simplify AUTO room pick.

No new files, no backend changes, no DB changes.

---

### Task 1: Simplify shared helpers (`checkConflicts`, `autoAssignRoom`, remove `getStaffBusyRoomId`)

**Files:**
- Modify: `d:\26-01-2026-Cursor-Takip\FP_MM\app.js:711-791`

- [ ] **Step 1: Delete `getStaffBusyRoomId` and rewrite `checkConflicts` to only check member-conflict**

Current code (lines 711-772):

```js
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
```

Replace lines 711-772 with:

```js
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
```

- [ ] **Step 2: Simplify `autoAssignRoom`**

Current code (lines 774-791, now shifted up after Step 1's deletion — locate by function name, not line number):

```js
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
```

Replace with:

```js
function autoAssignRoom(candidate, opts = {}) {
  return state.rooms.length ? state.rooms[0].id : null;
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check app.js`
Expected: no output (success).

- [ ] **Step 4: Manuel test**

Open the app in a browser, open the developer console, and run:

```js
checkConflicts({ memberId: state.members[0]?.id, staffId: state.staff[0]?.id, roomId: state.rooms[0]?.id, startTs: Date.now(), endTs: Date.now() + 3600000 })
```

Expected: returns `[]` (empty array) unless that member already has a session at that exact time (in which case it returns `["Seçilen üye bu saat aralığında zaten planlı."]`).

Also run:

```js
autoAssignRoom({})
```

Expected: returns `state.rooms[0].id` (or `null` if there are zero rooms configured).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "Seans akislarinda checkConflicts ve autoAssignRoom kapasite mantigini sadelestir"
```

---

### Task 2: Simplify `saveSessionFromModal` (Tekli Seans Ekle/Düzenle)

**Files:**
- Modify: `d:\26-01-2026-Cursor-Takip\FP_MM\app.js:9475-9684` (line numbers shift down after Task 1's net removal of ~37 lines — locate by function name `async function saveSessionFromModal()`)

- [ ] **Step 1: Remove `needsServerRebalanceSingle` / busy-room AUTO logic**

Current code (the block right after `if (slotChanged && window.API && window.API.getToken()) { await ensureDaySessionsLoaded(dateStr); }`):

```js
  let roomId = roomChoice;
  let needsServerRebalanceSingle = false;
  if (slotChanged && roomChoice === "AUTO") {
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
        // Aynı oda doğrudan uymuyor; sunucu oda dengeleme ile yeniden dağıtmayı deneyecek.
        roomId = busyRoomId;
        needsServerRebalanceSingle = true;
      } else {
        roomId = busyRoomId;
      }
    } else {
      const picked = autoAssignRoom(candidateBase, { ignoreSessionId });
      if (!picked) {
        // Tek oda doğrudan uymuyor; sunucu oda dengeleme ile yeniden dağıtmayı deneyecek.
        roomId = (existingSession && existingSession.roomId != null) ? existingSession.roomId : (state.rooms[0] && state.rooms[0].id);
        needsServerRebalanceSingle = true;
      } else {
        roomId = picked;
      }
    }
  } else if (slotChanged && roomChoice !== "AUTO") {
    roomId = roomChoice;
  } else if (existingSession) {
    roomId = existingSession.roomId;
  }

  const candidate = { ...candidateBase, roomId };

  if (slotChanged && !needsServerRebalanceSingle) {
    const conflicts = checkConflicts(candidate, { ignoreSessionId });
    if (conflicts.length) {
      showError(conflicts.join(" "));
      return;
    }
  } else if (slotChanged && needsServerRebalanceSingle) {
    const memberConflict = state.sessions.some((s) =>
      normId(s.id) !== normId(ignoreSessionId) &&
      overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs) &&
      normId(s.memberId) === normId(candidate.memberId),
    );
    if (memberConflict) {
      showError("Seçilen üye bu saat aralığında zaten planlı.");
      return;
    }
  }
```

Replace with:

```js
  let roomId = roomChoice;
  if (slotChanged && roomChoice === "AUTO") {
    roomId = autoAssignRoom(candidateBase, { ignoreSessionId });
  } else if (slotChanged && roomChoice !== "AUTO") {
    roomId = roomChoice;
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
```

- [ ] **Step 2: Make the post-save sync unconditional**

Current code (end of function):

```js
  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  if (needsServerRebalanceSingle && window.API && window.API.getToken()) {
    await syncSessionsFromServer({ silent: true });
  }
  closeSessionModal();
  render();
}
```

Replace with:

```js
  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  if (window.API && window.API.getToken()) {
    await syncSessionsFromServer({ silent: true });
  }
  closeSessionModal();
  render();
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check app.js`
Expected: no output (success).

- [ ] **Step 4: Manuel test — oda dolu, AUTO, tekli seans ekleme**

1. Start the dev server and open the app, logged in as admin.
2. Pick a date/time slot where total appointments across all rooms already equal total device capacity (or create that situation by adding sessions until full).
3. Click "Seans Ekle" (single session add), pick that date/time, a staff member, AUTO room, and save.
4. Expected: if the backend can rebalance (a different staff member has spare room capacity), the session saves successfully and the calendar refreshes to show the new session (possibly in a different room than what was sent). If total demand now exceeds total device capacity and rebalance is infeasible, the backend returns 409 and the modal shows "Bu saatte toplam oda kapasitesi yetersiz."

- [ ] **Step 5: Manuel test — aynı üye aynı saatte tekrar eklenmeye çalışılırsa**

1. Open "Seans Ekle" for a member who already has a session at a given date/time.
2. Try to create another session for the same member at the same date/time (any staff/room).
3. Expected: blocked with "Seçilen üye bu saat aralığında zaten planlı." (member-conflict check still works).

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "Tekli seans ekle/duzenle: kapasite tahminini kaldir, sync'i kosulsuz yap"
```

---

### Task 3: Simplify `saveGroupSession` (Grup Seansı Ekle/Düzenle)

**Files:**
- Modify: `d:\26-01-2026-Cursor-Takip\FP_MM\app.js:9212-9473` (locate by function name `async function saveGroupSession()` — line numbers shift after Tasks 1-2)

- [ ] **Step 1: Remove the initial `groupOverCapacity` blocking block and its later references**

Current code (start of function):

```js
async function saveGroupSession() {
  if (currentGroupSessions.length === 0) {
    els.groupSessionError.textContent = "En az bir üye ekleyin (+ Üye Ekle).";
    els.groupSessionError.classList.remove("hidden");
    return;
  }

  const firstSession = currentGroupSessions[0];
  const room = firstSession ? getRoomById(firstSession.roomId) : null;
  const groupOverCapacity = room && currentGroupSessions.length > room.devices;
  if (groupOverCapacity && !currentGroupSessions.some((s) => s.needsServerRebalance)) {
    els.groupSessionError.textContent = `"${room.name}" bu saatte en fazla ${room.devices} seans alabilir (alet sayısı). Şu an ${currentGroupSessions.length} seans var.`;
    els.groupSessionError.classList.remove("hidden");
    return;
  }

  els.groupSessionError.classList.add("hidden");
```

Replace with:

```js
async function saveGroupSession() {
  if (currentGroupSessions.length === 0) {
    els.groupSessionError.textContent = "En az bir üye ekleyin (+ Üye Ekle).";
    els.groupSessionError.classList.remove("hidden");
    return;
  }

  const firstSession = currentGroupSessions[0];
  els.groupSessionError.classList.add("hidden");
```

- [ ] **Step 2: Update the new-group branch to drop `needsServerRebalance` field stripping and the conditional sync**

Current code (new-group branch, immediately after Step 1's replaced block):

```js
  if (isNewGroupSession) {
    const newDateStr = els.groupSessionNewDate && els.groupSessionNewDate.value ? els.groupSessionNewDate.value : null;
    if (newDateStr && window.API && window.API.getToken()) {
      await ensureDaySessionsLoaded(newDateStr);
    }
    // Yeni grup: tüm seansları state'e ekle ve API'ye gönder
    for (const session of currentGroupSessions) {
      const { needsServerRebalance: _unused, ...sessionToSend } = session;
      state.sessions.push(sessionToSend);
      if (window.API && window.API.getToken()) {
        try {
          const created = await window.API.createSession(sessionToSend);
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
    if (groupOverCapacity && window.API && window.API.getToken()) {
      await syncSessionsFromServer({ silent: true });
    }
    render();
    closeGroupSessionModal();
    return;
  }
```

Replace with:

```js
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
    saveState();
    if (window.API && window.API.getToken()) {
      await syncSessionsFromServer({ silent: true });
    }
    render();
    closeGroupSessionModal();
    return;
  }
```

- [ ] **Step 3: Remove `needsServerRebalance` variable and simplify the "slot değişti" branch**

Current code (existing-group edit setup + slot-changed branch start):

```js
  let newStartTs = firstSession.startTs;
  let newEndTs = firstSession.endTs;
  let newRoomId = firstSession.roomId;
  const durationMs = firstSession.endTs - firstSession.startTs;
  const ignoreGroupIds = new Set(currentGroupSessions.map((s) => normId(s.id)));
  let needsServerRebalance = groupOverCapacity;

  if (dateStr && timeStr && newStaffId) {
```

Replace with:

```js
  let newStartTs = firstSession.startTs;
  let newEndTs = firstSession.endTs;
  let newRoomId = firstSession.roomId;
  const durationMs = firstSession.endTs - firstSession.startTs;
  const ignoreGroupIds = new Set(currentGroupSessions.map((s) => normId(s.id)));

  if (dateStr && timeStr && newStaffId) {
```

- [ ] **Step 4: Simplify the AUTO/manual room selection and per-session conflict check inside "slot değişti"**

Current code (inside `if (slotChanged) { ... }`, after the working-hours checks):

```js
      if (roomChoice === "AUTO") {
        const candidate = { staffId: newStaffId, memberId: firstSession.memberId, roomId: "", startTs: newStartTs, endTs: newEndTs };
        newRoomId = autoAssignRoom(candidate, { ignoreSessionIds: ignoreGroupIds });
        if (!newRoomId) {
          // Tek oda doğrudan uymuyor; sunucu oda dengeleme ile yeniden dağıtmayı deneyecek.
          newRoomId = firstSession.roomId;
          needsServerRebalance = true;
        }
      } else {
        newRoomId = roomChoice;
        const chosenRoom = getRoomById(newRoomId);
        if (chosenRoom && currentGroupSessions.length > (chosenRoom.devices || 1)) {
          // Oda dolu; sunucu kaydederken oda dengeleme ile yeniden dağıtmayı deneyecek.
          needsServerRebalance = true;
        }
      }

      for (const session of currentGroupSessions) {
        const candidate = { memberId: session.memberId, staffId: newStaffId, roomId: newRoomId, startTs: newStartTs, endTs: newEndTs };
        if (needsServerRebalance) {
          // Oda/kapasite kontrolleri sunucuda dengeleme ile yapılacak; sadece üye çakışmasını kontrol et.
          const memberConflict = state.sessions.some((s) =>
            !ignoreGroupIds.has(normId(s.id)) &&
            overlaps(s.startTs, s.endTs, candidate.startTs, candidate.endTs) &&
            normId(s.memberId) === normId(candidate.memberId),
          );
          if (memberConflict) {
            els.groupSessionError.textContent = "Seçilen üye bu saat aralığında zaten planlı.";
            els.groupSessionError.classList.remove("hidden");
            return;
          }
          continue;
        }
        const conflicts = checkConflicts(candidate, { ignoreSessionIds: ignoreGroupIds });
        if (conflicts.length > 0) {
          els.groupSessionError.textContent = conflicts[0];
          els.groupSessionError.classList.remove("hidden");
          return;
        }
      }
    } else {
```

Replace with:

```js
      if (roomChoice === "AUTO") {
        const candidate = { staffId: newStaffId, memberId: firstSession.memberId, roomId: "", startTs: newStartTs, endTs: newEndTs };
        newRoomId = autoAssignRoom(candidate, { ignoreSessionIds: ignoreGroupIds });
      } else {
        newRoomId = roomChoice;
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
```

- [ ] **Step 5: Simplify the "slot değişmedi" branch to just the variable assignments**

Current code (the `else` branch from Step 4, i.e. "slot değişmedi"):

```js
    } else {
      newStaffId = newStaffId || String(Number(firstSession.staffId));
      newRoomId = roomChoice !== "AUTO" ? roomChoice : firstSession.roomId;
      newStartTs = firstSession.startTs;
      newEndTs = firstSession.endTs;
      const roomForCapacity = getRoomById(newRoomId);
      if (roomForCapacity && currentGroupSessions.length > (roomForCapacity.devices || 1)) {
        // Oda dolu; sunucu kaydederken oda dengeleme ile yeniden dağıtmayı deneyecek.
        needsServerRebalance = true;
      }
    }
```

Replace with:

```js
    } else {
      newStaffId = newStaffId || String(Number(firstSession.staffId));
      newRoomId = roomChoice !== "AUTO" ? roomChoice : firstSession.roomId;
      newStartTs = firstSession.startTs;
      newEndTs = firstSession.endTs;
    }
```

- [ ] **Step 6: Remove the `needsServerRebalance` field stripping in the existing-session-create branch**

Current code (inside the final `for (const session of currentGroupSessions)` loop, `else` branch for new sessions within an existing group):

```js
    } else {
      const { needsServerRebalance: sessionNeedsRebalance, ...sessionRest } = session;
      if (sessionNeedsRebalance) needsServerRebalance = true;
      const newSession = { ...sessionRest, staffId: newStaffId, roomId: newRoomId, startTs: newStartTs, endTs: newEndTs };
      state.sessions.push(newSession);
```

Replace with:

```js
    } else {
      const newSession = { ...session, staffId: newStaffId, roomId: newRoomId, startTs: newStartTs, endTs: newEndTs };
      state.sessions.push(newSession);
```

- [ ] **Step 7: Make the final sync unconditional**

Current code (end of function):

```js
  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  if (needsServerRebalance) {
    await syncSessionsFromServer({ silent: true });
  }
  render();
  closeGroupSessionModal();
}
```

Replace with:

```js
  state.sessions.sort((a, b) => a.startTs - b.startTs);
  saveState();
  if (window.API && window.API.getToken()) {
    await syncSessionsFromServer({ silent: true });
  }
  render();
  closeGroupSessionModal();
}
```

- [ ] **Step 8: Verify syntax**

Run: `node --check app.js`
Expected: no output (success).

- [ ] **Step 9: Manuel test — grup seansına 2. üye eklerken oda dolu (orijinal bug senaryosu)**

1. Open the app as admin, go to a date/time slot where one staff member already has a session that fills their assigned room's capacity (or close to it), but another room/staff has spare capacity.
2. Open that group session (or create a new group session) and click "+ Üye Ekle" to add another member at the same slot.
3. Save the group session.
4. Expected: the save succeeds (no "kapasite dolu" frontend block); backend rebalances room assignments as needed; after save, the calendar reflects the updated room assignments via the unconditional `syncSessionsFromServer`.

- [ ] **Step 10: Manuel test — toplam talep > toplam alet sayısı**

1. Set up a slot where the total number of appointments across all members/staff would exceed the sum of all rooms' `devices` if this new group session were added.
2. Try to save the group session.
3. Expected: backend returns 409 with "Bu saatte toplam oda kapasitesi yetersiz."; the modal shows this message via `els.groupSessionError`.

- [ ] **Step 11: Manuel test — grup düzenleme, slot değişmedi, oda artık dolu**

1. Edit an existing group session without changing date/time/staff/room (so `slotChanged` is false), in a situation where the room is now at or over capacity due to other changes made elsewhere.
2. Save.
3. Expected: the request is sent to the backend; backend either rebalances successfully (session saves, sync reflects new room) or returns 409 with the capacity message (shown in `els.groupSessionError`).

- [ ] **Step 12: Commit**

```bash
git add app.js
git commit -m "Grup seansi ekle/duzenle: kapasite tahminini ve needsServerRebalance bayragini kaldir"
```

---

### Task 4: Simplify `groupSessionAddMemberBtn` handler (Grup Seansına Üye Ekle)

**Files:**
- Modify: `d:\26-01-2026-Cursor-Takip\FP_MM\app.js:11291-11403` (locate by `els.groupSessionAddMemberBtn.addEventListener("click", ...)` — line numbers shift after Tasks 1-3)

- [ ] **Step 1: Simplify the AUTO room pick (remove the `picked || state.rooms[0]` fallback)**

Current code (inside the `if (isNewGroupSession && currentGroupSessions.length === 0) { ... }` block, near the end):

```js
      if (roomChoice === "AUTO") {
        const candidateBase = { startTs, endTs, staffId, memberId: availableMember.id, roomId: "", note: "" };
        const picked = autoAssignRoom(candidateBase, { ignoreSessionId: null });
        // Hiçbir oda doğrudan uymuyorsa sunucu oda dengeleme ile yeniden dağıtmayı deneyecek.
        roomId = picked || (state.rooms[0] && state.rooms[0].id);
      } else {
        roomId = roomChoice;
      }
```

Replace with:

```js
      if (roomChoice === "AUTO") {
        const candidateBase = { startTs, endTs, staffId, memberId: availableMember.id, roomId: "", note: "" };
        roomId = autoAssignRoom(candidateBase, { ignoreSessionId: null });
      } else {
        roomId = roomChoice;
      }
```

- [ ] **Step 2: Remove `overCapacity` calculation and the branching structure; call `checkConflicts` directly**

Current code (after the `if/else` block that sets `startTs`/`endTs`/`staffId`/`roomId`):

```js
    const room = getRoomById(roomId);
    const maxInSlot = room ? room.devices : 1;
    const overCapacity = currentGroupSessions.length + 1 > maxInSlot;

    const newSession = {
      id: uid("sess"),
      startTs,
      endTs,
      memberId: availableMember.id,
      staffId,
      roomId,
      note: "",
      needsServerRebalance: overCapacity,
    };

    if (overCapacity) {
      // Oda bu saatte dolu; sunucu kaydederken oda dengeleme ile yeniden dağıtmayı deneyecek.
      const memberConflict = state.sessions.some((s) =>
        overlaps(s.startTs, s.endTs, newSession.startTs, newSession.endTs) &&
        normId(s.memberId) === normId(newSession.memberId),
      );
      if (memberConflict) {
        els.groupSessionError.textContent = "Seçilen üye bu saat aralığında zaten planlı.";
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    } else {
      const conflicts = checkConflicts(newSession, { ignoreSessionId: null });
      if (conflicts.length > 0) {
        els.groupSessionError.textContent = conflicts.join(" ");
        els.groupSessionError.classList.remove("hidden");
        return;
      }
    }

    currentGroupSessions.push(newSession);
    renderGroupSessionMembers();
    els.groupSessionError.classList.add("hidden");
  });
```

Replace with:

```js
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
```

- [ ] **Step 3: Verify syntax**

Run: `node --check app.js`
Expected: no output (success).

- [ ] **Step 4: Manuel test — yeni grup seansına oda dolu durumda üye ekleme**

1. Open the app as admin, click "Seans Ekle" → switch to/open the group session creation flow ("Grup Seansı Ekle").
2. Fill in date, time, staff, AUTO room.
3. Click "+ Üye Ekle" and add members one by one until the count would exceed the assigned room's `devices` (e.g. add a 4th member to a 3-device room).
4. Expected: adding the member to `currentGroupSessions` succeeds locally (no "kapasite dolu" block) as long as there's no member-conflict; the real capacity check happens server-side when "Kaydet" is clicked (Task 3, Step 9/10 scenarios apply).

- [ ] **Step 5: Manuel test — aynı üyeyi grup seansına iki kez eklemeye çalışma**

1. In the same "Grup Seansı Ekle" flow, add a member, then try to add the same member again (or a member who already has another session at that exact time elsewhere).
2. Expected: blocked with "Seçilen üye bu saat aralığında zaten planlı." via `checkConflicts`.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "Grup seansina uye ekleme: overCapacity hesaplamasini kaldir, dogrudan checkConflicts kullan"
```

---

## Self-Review Notes

**Spec coverage:**
- "Asıl İş Kuralı" / backend unchanged — no backend tasks included. ✅
- `checkConflicts` sadeleştirmesi (capacity, other-staff-in-room, `__MULTI__` removed; member-conflict kept) — Task 1, Step 1. ✅
- `autoAssignRoom` sadeleştirmesi (`state.rooms[0]?.id` or `null`) — Task 1, Step 2. ✅
- `getStaffBusyRoomId` removed — Task 1, Step 1 (deleted; no remaining callers after Tasks 2 & 4 also remove their call sites). ✅
- Common steps 1-6 (form validation, working hours, room selection, checkConflicts, API call, unconditional sync) — reflected across Tasks 2-4. ✅
- `needsServerRebalance` / `needsServerRebalanceSingle` removed — Task 2 Step 2, Task 3 Steps 3/6/7. ✅
- `groupOverCapacity` block removed — Task 3 Step 1. ✅
- `currentGroupSessions` items' `needsServerRebalance` field removed — Task 3 Steps 2 & 6, Task 4 Step 2. ✅
- Group add-member handler's `overCapacity` calc + branching removed, direct `checkConflicts` — Task 4 Step 2. ✅
- `picked || state.rooms[0]` fallback removed — Task 4 Step 1. ✅
- All 6 test scenarios from spec — covered by manual test steps in Tasks 2-4. ✅

**Placeholder scan:** No TBD/TODO; every step has full before/after code blocks and exact commands.

**Type/naming consistency:** `autoAssignRoom(candidate, opts)` signature used consistently (Task 1 Step 2 simplifies the destructured-default-args signature to `opts = {}` since the options are no longer read — call sites in Tasks 2-4 still pass `{ ignoreSessionId }` / `{ ignoreSessionIds }` objects, which is harmless as they're now ignored). `checkConflicts(candidate, { ignoreSessionId, ignoreSessionIds })` signature unchanged. `getRoomById` remains used elsewhere in the file (rendering, etc.) — only its use inside `checkConflicts`/`saveGroupSession`'s capacity logic is removed, not the function itself.
