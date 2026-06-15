/** Log listesi için okunabilir Kim / Varlık / Detay metinleri */

const ROLE_LABELS = {
  admin: 'Yönetici',
  manager: 'Yönetici',
  staff: 'Personel',
  member: 'Üye',
};

const LOGIN_FAIL_REASONS = {
  user_not_found: 'E-posta bulunamadı',
  invalid_password: 'Hatalı şifre',
  member_record_missing: 'Üyelik kaydı yok',
};

function parseDetails(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { _raw: raw };
    }
  }
  return {};
}

function fmtLogDateTime(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function personName(first, last, fallback) {
  const n = `${first || ''} ${last || ''}`.trim();
  return n || fallback || '';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '';
}

function memberLabel(map, id, fallbackName) {
  if (fallbackName) return String(fallbackName).trim();
  const m = map.get(Number(id));
  if (!m) return id != null ? `Üye #${id}` : '';
  return m.name || personName(m.first_name, m.last_name, `Üye #${m.id}`);
}

function staffLabel(map, id) {
  const s = map.get(Number(id));
  if (!s) return id != null ? `Personel #${id}` : '';
  return personName(s.first_name, s.last_name, `Personel #${s.id}`);
}

function isGenericActorName(name) {
  if (!name) return true;
  const s = String(name).trim();
  return /^Kullanıcı#\d+$/i.test(s) || /^Üye#\d+$/i.test(s) || s === 'Anonim';
}

function buildActorDisplay(row, actorMap) {
  const stored = row.actor_name && !isGenericActorName(row.actor_name) ? String(row.actor_name).trim() : '';
  if (stored.startsWith('Üye: ')) return stored.slice(5).trim();

  const user = row.actor_id != null ? actorMap.get(Number(row.actor_id)) : null;
  if (user) {
    let name = '';
    if (user.display_name && String(user.display_name).trim()) {
      name = String(user.display_name).trim();
    } else if (user.role === 'member') {
      name = user.member_name || personName(user.member_first_name, user.member_last_name);
    } else if (user.role === 'staff') {
      name = personName(user.staff_first_name, user.staff_last_name);
    } else if (user.role === 'admin') {
      name = 'Admin';
    } else if (user.role === 'manager') {
      name = user.username || 'Yönetici';
    } else {
      name = user.username || '';
    }
    const rl = roleLabel(user.role);
    if (name && rl) return `${name} (${rl})`;
    return name || stored || (row.actor_id != null ? `Kullanıcı #${row.actor_id}` : '—');
  }

  if (stored) return stored;
  if (row.actor_type === 'system') return 'Sistem';
  if (row.actor_type === 'anonymous') return 'Kapı okuyucu / Anonim';
  return row.actor_id != null ? `Kullanıcı #${row.actor_id}` : '—';
}

function buildEntityDisplay(row, ctx) {
  const type = row.entity_type;
  const id = row.entity_id != null ? Number(row.entity_id) : null;
  const d = parseDetails(row.details);

  if (!type) return '—';

  switch (type) {
    case 'session': {
      const sess = id != null ? ctx.sessionMap.get(id) : null;
      const member = sess?.member_name || memberLabel(ctx.memberMap, sess?.member_id ?? d.memberId ?? d.member_id);
      const when = sess?.start_ts != null ? fmtLogDateTime(sess.start_ts) : fmtLogDateTime(d.startTs);
      if (when && member) return `${when} · ${member}`;
      if (member) return member;
      if (when) return when;
      return id != null ? `Seans #${id}` : 'Seans';
    }
    case 'member': {
      const m = id != null ? ctx.memberMap.get(id) : null;
      return m?.name || personName(m?.first_name, m?.last_name, d.name) || memberLabel(ctx.memberMap, id, d.name) || (id != null ? `Üye #${id}` : 'Üye');
    }
    case 'staff': {
      return staffLabel(ctx.staffMap, id) || (id != null ? `Personel #${id}` : 'Personel');
    }
    case 'member_package': {
      const mp = id != null ? ctx.memberPackageMap.get(id) : null;
      const member = mp?.member_name || memberLabel(ctx.memberMap, mp?.member_id ?? d.member_id);
      const pkg = mp?.package_name || d.package_name || '';
      if (member && pkg) return `${member} · ${pkg}`;
      if (member) return member;
      if (pkg) return pkg;
      return id != null ? `Üye paketi #${id}` : 'Üye paketi';
    }
    case 'package': {
      const p = id != null ? ctx.packageMap.get(id) : null;
      return p?.name || d.name || (id != null ? `Paket #${id}` : 'Paket');
    }
    case 'room': {
      const r = id != null ? ctx.roomMap.get(id) : null;
      return r?.name || d.name || (id != null ? `Oda #${id}` : 'Oda');
    }
    case 'user': {
      const u = id != null ? ctx.actorMap.get(id) : null;
      if (u) {
        const name = buildActorDisplay({ actor_id: id, actor_name: null, actor_type: 'user' }, ctx.actorMap);
        return name.replace(/\s*\([^)]+\)\s*$/, '').trim() || `Kullanıcı #${id}`;
      }
      return id != null ? `Kullanıcı #${id}` : 'Kullanıcı';
    }
    case 'settings':
      return 'Sistem ayarları';
    case 'database':
      return 'Veritabanı';
    default:
      return id != null ? `${type} #${id}` : type;
  }
}

function buildDetailsDisplay(action, details, ctx) {
  const d = details || {};

  if (action === 'session.attendance_confirm') {
    const outcome = d.action === 'present' || d.outcome === 'geldi' ? 'Geldi' : d.action === 'no_show' || d.outcome === 'gelmedi' ? 'Gelmedi' : d.outcome || '—';
    const member = d.memberName || memberLabel(ctx.memberMap, d.memberId);
    const by = d.confirmedByAdmin ? 'Yönetici onayı' : d.role === 'staff' ? 'Personel onayı' : d.role === 'admin' || d.role === 'manager' ? 'Yönetici onayı' : '';
    const when = fmtLogDateTime(d.startTs);
    const parts = [outcome];
    if (member) parts.push(member);
    if (when) parts.push(when);
    if (by) parts.push(by);
    if (d.override) parts.push('önceki onay değiştirildi');
    return parts.join(' · ');
  }

  if (action === 'session.check_in_qr') {
    const member = d.memberName || memberLabel(ctx.memberMap, d.memberId);
    const when = fmtLogDateTime(d.startTs);
    return [member ? `Üye: ${member}` : null, when ? `Seans: ${when}` : null, 'QR ile kapı girişi'].filter(Boolean).join(' · ');
  }

  if (action === 'session.cancel_by_member') {
    const member = memberLabel(ctx.memberMap, d.memberId);
    const when = fmtLogDateTime(d.startTs);
    const parts = ['Üye kendi seansını iptal etti'];
    if (member) parts.push(member);
    if (when) parts.push(when);
    if (d.cancelReason) parts.push(`Neden: ${d.cancelReason}`);
    if (d.replenished) parts.push('Paket sonuna telafi seansı eklendi');
    return parts.join(' · ');
  }

  if (action === 'auth.login') {
    return `Rol: ${roleLabel(d.role) || d.role || '—'}`;
  }

  if (action === 'auth.login_failed') {
    const reason = LOGIN_FAIL_REASONS[d.reason] || d.reason || '—';
    return d.email ? `${d.email} · ${reason}` : reason;
  }

  if (action === 'auth.set_password') return 'İlk girişte şifre belirlendi';
  if (action === 'auth.change_password') return 'Şifre değiştirildi';

  if (action === 'member.create' || action === 'member.update') {
    const name = d.name || memberLabel(ctx.memberMap, null, null);
    const no = d.member_no ? `No: ${d.member_no}` : '';
    return [name, no].filter(Boolean).join(' · ') || '—';
  }

  if (action === 'member.delete' || action === 'member.delete_permanent') {
    return d.softDelete ? 'Kayıt arşivlendi (soft delete)' : 'Kayıt kalıcı silindi';
  }

  if (action === 'member.request_deletion') return 'Üyelik iptal talebi gönderildi';
  if (action === 'member.approve_deletion_request') return 'Üyelik iptali onaylandı';
  if (action === 'member.reject_deletion_request') return 'Üyelik iptal talebi reddedildi';
  if (action === 'member.reactivate') return 'Eski üye kaydı yeniden aktif edildi';

  if (action === 'package_request.create') {
    const member = d.member_name || memberLabel(ctx.memberMap, d.member_id);
    const pkg = d.package_name ? `«${d.package_name}»` : '';
    return [member, pkg ? `${pkg} paket talebi` : 'Paket talebi'].filter(Boolean).join(' · ');
  }
  if (action === 'package_request.dismiss') return 'Paket talebi kapatıldı (paket tanımlanmadı)';

  if (action === 'session.create' || action === 'session.update') {
    const member = memberLabel(ctx.memberMap, d.memberId ?? d.member_id);
    const staff = staffLabel(ctx.staffMap, d.staffId ?? d.staff_id);
    const when = fmtLogDateTime(d.startTs);
    return [when ? `Tarih: ${when}` : null, member ? `Üye: ${member}` : null, staff ? `Personel: ${staff}` : null].filter(Boolean).join(' · ') || '—';
  }

  if (action === 'session.delete' || action === 'session.delete_bulk') {
    const staff = staffLabel(ctx.staffMap, d.staffId);
    const when = fmtLogDateTime(d.startTs);
    const count = d.deletedCount != null ? `${d.deletedCount} seans silindi` : 'Seans silindi';
    return [count, when ? `Saat: ${when}` : null, staff ? `Personel: ${staff}` : null].filter(Boolean).join(' · ');
  }

  if (action === 'member_package.create') {
    const pkg = d.package_name || '';
    const member = memberLabel(ctx.memberMap, d.member_id);
    return [member ? `Üye: ${member}` : null, pkg ? `Paket: ${pkg}` : null, d.skip_day_distribution ? 'Gün dağılımı atlandı' : null].filter(Boolean).join(' · ') || '—';
  }

  if (action === 'member_package.update') {
    const member = memberLabel(ctx.memberMap, d.member_id);
    return member ? `Üye: ${member}` : 'Paket güncellendi';
  }

  if (action === 'member_package.end') {
    const member = memberLabel(ctx.memberMap, d.member_id);
    const end = d.end_date || '';
    return [member ? `Üye: ${member}` : null, end ? `Bitiş: ${end}` : 'Paket sonlandırıldı'].filter(Boolean).join(' · ');
  }

  if (action === 'room.create' || action === 'room.update' || action === 'room.delete') {
    return d.name ? `Oda: ${d.name}` : '—';
  }

  if (action === 'staff.create' || action === 'staff.update' || action === 'staff.delete') {
    return d.name ? `Personel: ${d.name}` : '—';
  }

  if (action === 'package.create' || action === 'package.update' || action === 'package.delete') {
    const parts = [];
    if (d.name) parts.push(d.name);
    if (d.lesson_count != null) parts.push(`${d.lesson_count} seans`);
    return parts.join(' · ') || '—';
  }

  if (action === 'settings.working_hours_update') {
    return d.daysUpdated != null ? `${d.daysUpdated} gün güncellendi` : 'Çalışma saatleri güncellendi';
  }

  if (action === 'dev_reset') return d.targets ? `Hedefler: ${Array.isArray(d.targets) ? d.targets.join(', ') : d.targets}` : 'Test veritabanı sıfırlandı';

  // Bilinen alanları okunaklı sırala
  const parts = [];
  if (d.name) parts.push(String(d.name));
  if (d.package_name) parts.push(`Paket: ${d.package_name}`);
  if (d.memberName) parts.push(`Üye: ${d.memberName}`);
  else if (d.memberId != null || d.member_id != null) {
    parts.push(`Üye: ${memberLabel(ctx.memberMap, d.memberId ?? d.member_id)}`);
  }
  if (d.email) parts.push(String(d.email));
  if (d.reason && !parts.length) parts.push(String(d.reason));
  if (parts.length) return parts.join(' · ');

  try {
    const text = JSON.stringify(d);
    return text.length > 200 ? `${text.slice(0, 197)}…` : text;
  } catch {
    return '—';
  }
}

async function loadActorMap(db, actorIds) {
  const map = new Map();
  if (!actorIds.length) return map;
  const res = await db.query(
    `SELECT u.id, u.username, u.role, u.display_name,
            s.first_name AS staff_first_name, s.last_name AS staff_last_name,
            m.name AS member_name, m.first_name AS member_first_name, m.last_name AS member_last_name
     FROM users u
     LEFT JOIN staff s ON s.user_id = u.id
     LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
     WHERE u.id = ANY($1::int[])`,
    [actorIds]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadMemberMap(db, memberIds) {
  const map = new Map();
  if (!memberIds.length) return map;
  const res = await db.query(
    'SELECT id, name, first_name, last_name FROM members WHERE id = ANY($1::int[])',
    [memberIds]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadStaffMap(db, staffIds) {
  const map = new Map();
  if (!staffIds.length) return map;
  const res = await db.query(
    'SELECT id, first_name, last_name FROM staff WHERE id = ANY($1::int[])',
    [staffIds]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadSessionMap(db, sessionIds) {
  const map = new Map();
  if (!sessionIds.length) return map;
  const res = await db.query(
    `SELECT s.id, s.start_ts, s.member_id, s.staff_id,
            m.name AS member_name
     FROM sessions s
     LEFT JOIN members m ON m.id = s.member_id
     WHERE s.id = ANY($1::int[])`,
    [sessionIds]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadMemberPackageMap(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const res = await db.query(
    `SELECT mp.id, mp.member_id, m.name AS member_name, p.name AS package_name
     FROM member_packages mp
     LEFT JOIN members m ON m.id = mp.member_id
     LEFT JOIN packages p ON p.id = mp.package_id
     WHERE mp.id = ANY($1::int[])`,
    [ids]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadPackageMap(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const res = await db.query(
    'SELECT id, name FROM packages WHERE id = ANY($1::int[])',
    [ids]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

async function loadRoomMap(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const res = await db.query(
    'SELECT id, name FROM rooms WHERE id = ANY($1::int[])',
    [ids]
  );
  res.rows.forEach((r) => map.set(Number(r.id), r));
  return map;
}

function collectIds(rows) {
  const actorIds = new Set();
  const memberIds = new Set();
  const staffIds = new Set();
  const sessionIds = new Set();
  const memberPackageIds = new Set();
  const packageIds = new Set();
  const roomIds = new Set();
  const userEntityIds = new Set();

  for (const row of rows) {
    if (row.actor_id != null) actorIds.add(Number(row.actor_id));

    const eid = row.entity_id != null ? Number(row.entity_id) : null;
    if (eid != null) {
      switch (row.entity_type) {
        case 'session':
          sessionIds.add(eid);
          break;
        case 'member':
          memberIds.add(eid);
          break;
        case 'staff':
          staffIds.add(eid);
          break;
        case 'member_package':
          memberPackageIds.add(eid);
          break;
        case 'package':
          packageIds.add(eid);
          break;
        case 'room':
          roomIds.add(eid);
          break;
        case 'user':
          userEntityIds.add(eid);
          actorIds.add(eid);
          break;
        default:
          break;
      }
    }

    const d = parseDetails(row.details);
    if (d.memberId != null) memberIds.add(Number(d.memberId));
    if (d.member_id != null) memberIds.add(Number(d.member_id));
    if (d.staffId != null) staffIds.add(Number(d.staffId));
    if (d.staff_id != null) staffIds.add(Number(d.staff_id));
    if (d.package_id != null) packageIds.add(Number(d.package_id));
  }

  return {
    actorIds: [...actorIds],
    memberIds: [...memberIds],
    staffIds: [...staffIds],
    sessionIds: [...sessionIds],
    memberPackageIds: [...memberPackageIds],
    packageIds: [...packageIds],
    roomIds: [...roomIds],
  };
}

/** Log satırlarına actor_display, entity_display, details_display ekler */
export async function enrichActivityLogRows(db, rows) {
  if (!rows?.length) return [];

  const ids = collectIds(rows);
  const [actorMap, memberMap, staffMap, sessionMap, memberPackageMap, packageMap, roomMap] =
    await Promise.all([
      loadActorMap(db, ids.actorIds),
      loadMemberMap(db, ids.memberIds),
      loadStaffMap(db, ids.staffIds),
      loadSessionMap(db, ids.sessionIds),
      loadMemberPackageMap(db, ids.memberPackageIds),
      loadPackageMap(db, ids.packageIds),
      loadRoomMap(db, ids.roomIds),
    ]);

  const ctx = { actorMap, memberMap, staffMap, sessionMap, memberPackageMap, packageMap, roomMap };

  return rows.map((row) => {
    const details = parseDetails(row.details);
    return {
      ...row,
      details,
      actor_display: buildActorDisplay(row, actorMap),
      entity_display: buildEntityDisplay(row, ctx),
      details_display: buildDetailsDisplay(row.action, details, ctx),
    };
  });
}

export default { enrichActivityLogRows };
