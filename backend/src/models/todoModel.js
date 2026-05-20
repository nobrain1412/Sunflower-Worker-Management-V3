const db = require('../utils/db');

// ─── Category ────────────────────────────────────────────────
async function findAllCategories({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = TRUE' : '';
  const r = await db.query(
    `SELECT id, ten, icon, mau_sac, thu_tu, active, created_at, updated_at
       FROM todo_category ${where}
       ORDER BY thu_tu ASC, id ASC`,
  );
  return r.rows;
}

async function createCategory({ ten, icon, mau_sac, thu_tu }) {
  const r = await db.query(
    `INSERT INTO todo_category (ten, icon, mau_sac, thu_tu)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ten, icon ?? null, mau_sac ?? null, thu_tu ?? 100],
  );
  return r.rows[0];
}

async function updateCategory(id, data) {
  const allowed = ['ten', 'icon', 'mau_sac', 'thu_tu', 'active'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return null;
  params.push(id);
  const r = await db.query(
    `UPDATE todo_category SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return r.rows[0] || null;
}

async function deleteCategory(id) {
  const r = await db.query(`DELETE FROM todo_category WHERE id = $1 RETURNING id`, [id]);
  return r.rows[0] || null;
}

// ─── Task ────────────────────────────────────────────────────
// scope = 'mine'  → assignee_id = userId
// scope = 'given' → created_by  = userId AND assignee_id <> userId
// scope = 'both'  → assignee_id = userId OR created_by = userId
function buildScopeClause(scope, userId, paramsArr) {
  if (scope === 'mine')   { paramsArr.push(userId); return `t.assignee_id = $${paramsArr.length}`; }
  if (scope === 'given')  {
    paramsArr.push(userId); const i = paramsArr.length;
    paramsArr.push(userId); const j = paramsArr.length;
    return `(t.created_by = $${i} AND t.assignee_id <> $${j})`;
  }
  paramsArr.push(userId); const i = paramsArr.length;
  paramsArr.push(userId); const j = paramsArr.length;
  return `(t.assignee_id = $${i} OR t.created_by = $${j})`;
}

async function findTasks({ userId, scope = 'both', includeDone = true, limit = 200 }) {
  const params = [];
  const scopeSql = buildScopeClause(scope, userId, params);
  const doneSql = includeDone ? '' : 'AND t.hoan_thanh = FALSE';
  params.push(limit);
  const r = await db.query(
    `SELECT t.id, t.tieu_de, t.mo_ta, t.category_id, t.assignee_id, t.created_by,
            t.cong_nhan_id, t.han, t.gio_lam,
            t.hoan_thanh, t.hoan_thanh_at, t.hoan_thanh_by,
            t.created_at, t.updated_at,
            c.ten   AS category_ten,
            c.icon  AS category_icon,
            c.mau_sac AS category_mau_sac,
            ua.ho_ten AS assignee_ho_ten,
            uc.ho_ten AS created_by_ho_ten,
            cn.ho_ten AS cong_nhan_ho_ten
       FROM todo_task t
       LEFT JOIN todo_category c ON c.id = t.category_id
       LEFT JOIN users         ua ON ua.id = t.assignee_id
       LEFT JOIN users         uc ON uc.id = t.created_by
       LEFT JOIN cong_nhan     cn ON cn.id = t.cong_nhan_id
      WHERE ${scopeSql} ${doneSql}
      ORDER BY t.hoan_thanh ASC,
               CASE WHEN t.han IS NULL THEN 1 ELSE 0 END,
               t.han ASC,
               t.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return r.rows;
}

async function findTaskById(id) {
  const r = await db.query(`SELECT * FROM todo_task WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

async function createTask({
  tieu_de, mo_ta, category_id, assignee_id, created_by,
  cong_nhan_id, han, gio_lam,
}) {
  const r = await db.query(
    `INSERT INTO todo_task
       (tieu_de, mo_ta, category_id, assignee_id, created_by, cong_nhan_id, han, gio_lam)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [tieu_de, mo_ta ?? null, category_id ?? null,
     assignee_id, created_by, cong_nhan_id ?? null, han ?? null, gio_lam ?? null],
  );
  return r.rows[0];
}

async function updateTask(id, data) {
  const allowed = ['tieu_de', 'mo_ta', 'category_id', 'assignee_id', 'cong_nhan_id', 'han', 'gio_lam'];
  const fields = [], params = [];
  for (const f of allowed) {
    if (f in data) { params.push(data[f]); fields.push(`${f} = $${params.length}`); }
  }
  if (!fields.length) return findTaskById(id);
  params.push(id);
  const r = await db.query(
    `UPDATE todo_task SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return r.rows[0] || null;
}

async function toggleTask(id, hoanThanh, byUserId) {
  const r = await db.query(
    `UPDATE todo_task
        SET hoan_thanh    = $2,
            hoan_thanh_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
            hoan_thanh_by = CASE WHEN $2 THEN $3 ELSE NULL END
      WHERE id = $1
      RETURNING *`,
    [id, !!hoanThanh, byUserId],
  );
  return r.rows[0] || null;
}

async function deleteTask(id) {
  const r = await db.query(`DELETE FROM todo_task WHERE id = $1 RETURNING id`, [id]);
  return r.rows[0] || null;
}

module.exports = {
  findAllCategories, createCategory, updateCategory, deleteCategory,
  findTasks, findTaskById, createTask, updateTask, toggleTask, deleteTask,
};
