import db from '../config/database.js';

export async function fetchBootstrapMembers() {
  try {
    const result = await db.query(
      `SELECT * FROM members WHERE (deleted_at IS NULL) ORDER BY name`
    );
    return result.rows;
  } catch (colErr) {
    if (colErr.code === '42703') {
      const result = await db.query('SELECT * FROM members ORDER BY name');
      return result.rows;
    }
    throw colErr;
  }
}

export async function fetchBootstrapStaff() {
  const result = await db.query(
    `SELECT s.*, u.username AS login_username, u.email AS user_email
     FROM staff s
     LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.first_name, s.last_name`
  );
  return result.rows;
}

export async function fetchBootstrapRooms() {
  const result = await db.query('SELECT * FROM rooms ORDER BY name');
  return result.rows;
}

export async function fetchBootstrapPackages() {
  const result = await db.query('SELECT * FROM packages ORDER BY name');
  return result.rows;
}

export async function fetchBootstrapMemberPackages() {
  const result = await db.query(
    `SELECT mp.*, p.name as package_name, p.lesson_count, p.month_overrun,
            COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') as member_name, m.member_no
     FROM member_packages mp
     JOIN packages p ON p.id = mp.package_id
     JOIN members m ON m.id = mp.member_id AND (m.deleted_at IS NULL)
     ORDER BY mp.start_date DESC`
  );
  return result.rows;
}

export async function fetchBootstrapWorkingHours() {
  const result = await db.query(
    'SELECT * FROM working_hours ORDER BY day_of_week'
  );
  const workingHours = {};
  result.rows.forEach((row) => {
    workingHours[row.day_of_week] = {
      enabled: row.enabled,
      start: row.start_time,
      end: row.end_time,
    };
  });
  return workingHours;
}

export async function fetchBootstrapSessions({ startDate, endDate, user }) {
  let query = `
      SELECT s.*,
             st.first_name || ' ' || st.last_name as staff_name,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name,
             r.name as room_name,
             cs.first_name AS confirmer_first_name,
             cs.last_name AS confirmer_last_name,
             cu.role AS confirmer_role
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN users cu ON cu.id = s.attendance_confirmed_by
      LEFT JOIN staff cs ON cs.user_id = cu.id
      WHERE (s.deleted_at IS NULL)
    `;
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND s.start_ts >= $${paramIndex++}`;
    params.push(new Date(startDate).getTime());
  }
  if (endDate) {
    query += ` AND s.end_ts <= $${paramIndex++}`;
    params.push(new Date(endDate).getTime());
  }

  if (user?.role === 'staff') {
    const staffResult = await db.query(
      'SELECT id FROM staff WHERE user_id = $1',
      [user.userId]
    );
    if (staffResult.rows.length > 0) {
      query += ` AND s.staff_id = $${paramIndex++}`;
      params.push(staffResult.rows[0].id);
    }
  }

  query += ' ORDER BY s.start_ts ASC';

  try {
    const result = await db.query(query, params);
    return result.rows;
  } catch (colErr) {
    if (colErr.code === '42703') {
      const fallback = `
      SELECT s.*,
             st.first_name || ' ' || st.last_name as staff_name,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name,
             r.name as room_name
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE (s.deleted_at IS NULL)
    ` + query.split('WHERE (s.deleted_at IS NULL)')[1];
      const result = await db.query(fallback.replace('WHERE (s.deleted_at IS NULL)', 'WHERE 1=1'), params);
      return result.rows;
    }
    throw colErr;
  }
}

/** Admin açılış verisi — tek DB round-trip grubu (paralel sorgular) */
export async function loadAdminBootstrap({ startDate, endDate, user }) {
  const [
    members,
    staff,
    rooms,
    packages,
    memberPackages,
    workingHours,
    sessions,
  ] = await Promise.all([
    fetchBootstrapMembers(),
    fetchBootstrapStaff(),
    fetchBootstrapRooms(),
    fetchBootstrapPackages(),
    fetchBootstrapMemberPackages(),
    fetchBootstrapWorkingHours(),
    fetchBootstrapSessions({ startDate, endDate, user }),
  ]);

  return {
    members,
    staff,
    rooms,
    packages,
    memberPackages,
    workingHours,
    sessions,
  };
}
