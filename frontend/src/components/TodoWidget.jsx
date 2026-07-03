import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useTodoTasks, useTodoCategories,
  useCreateTodo, useToggleTodo, useDeleteTodo,
  useCreateTodoCategory, useUpdateTodoCategory, useDeleteTodoCategory,
} from '../hooks/useTodo';
import { useAssignableUsers } from '../hooks/useUsers';

const COLOR = {
  accent: 'var(--accent)', accent2: 'var(--accent2)',
  green: 'var(--green)', amber: 'var(--amber)',
  red: 'var(--red)', teal: 'var(--teal)',
  text2: 'var(--text2)', text3: 'var(--text3)',
};

function colorOf(c) { return COLOR[c] ?? 'var(--accent)'; }

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtHan(d) {
  if (!d) return null;
  const dt = new Date(d);
  const today = todayISO();
  if (d === today) return { label: 'Hôm nay', color: 'var(--amber)' };
  if (d < today)   return { label: `Quá hạn ${d}`, color: 'var(--red)' };
  return { label: dt.toLocaleDateString('vi-VN'), color: 'var(--text2)' };
}

export default function TodoWidget({ compact = false }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [scope, setScope] = useState('both'); // mine|given|both
  const [showAdd, setShowAdd] = useState(false);
  const [showCatMgmt, setShowCatMgmt] = useState(false);

  const tasksQ = useTodoTasks({ scope });
  const catsQ  = useTodoCategories({ activeOnly: true });
  const usersQ = useAssignableUsers();

  const tasks = tasksQ.data ?? [];
  const cats  = catsQ.data ?? [];
  const users = usersQ.data ?? [];

  const pending   = tasks.filter((t) => !t.hoan_thanh);
  const done      = tasks.filter((t) =>  t.hoan_thanh).slice(0, compact ? 3 : 10);

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.title}>
          📋 Việc cần làm
          <span style={s.count}>{pending.length}</span>
        </div>
        <div style={s.tabs}>
          <Tab active={scope === 'both'}  onClick={() => setScope('both')}>Tất cả</Tab>
          <Tab active={scope === 'mine'}  onClick={() => setScope('mine')}>Mình làm</Tab>
          <Tab active={scope === 'given'} onClick={() => setScope('given')}>Mình giao</Tab>
          {isAdmin && (
            <button onClick={() => setShowCatMgmt(true)} title="Quản lý loại"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text3)', fontSize: 14, padding: '2px 6px' }}>
              ⚙
            </button>
          )}
        </div>
      </div>

      {/* Quick add */}
      {!showAdd ? (
        <button style={s.quickAddBtn} onClick={() => setShowAdd(true)}>+ Thêm việc nhanh</button>
      ) : (
        <QuickAdd
          cats={cats} users={users} currentUserId={user?.id}
          onDone={() => setShowAdd(false)}
        />
      )}

      {tasksQ.isLoading && <div style={s.empty}>Đang tải...</div>}
      {!tasksQ.isLoading && tasks.length === 0 && (
        <div style={s.empty}>Chưa có việc nào — thêm việc đầu tiên ở trên ↑</div>
      )}

      <div style={s.list}>
        {pending.map((t) => (
          <TaskRow key={t.id} task={t} currentUserId={user?.id} onOpenCN={(id) => navigate(`/cong-nhan/${id}`)} />
        ))}
        {done.length > 0 && pending.length > 0 && <div style={s.divider}>Đã xong</div>}
        {done.map((t) => (
          <TaskRow key={t.id} task={t} currentUserId={user?.id} onOpenCN={(id) => navigate(`/cong-nhan/${id}`)} />
        ))}
      </div>

      {showCatMgmt && <CategoryManager onClose={() => setShowCatMgmt(false)} />}
    </div>
  );
}

function Tab({ active, children, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? 'var(--bg3)' : 'transparent',
        color: active ? 'var(--text1)' : 'var(--text3)',
        border: 'none', borderRadius: 6, padding: '4px 10px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}>
      {children}
    </button>
  );
}

function QuickAdd({ cats, users, currentUserId, onDone }) {
  const titleRef = useRef(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(cats[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState(currentUserId ?? '');
  const [han, setHan] = useState('');
  const [gioLam, setGioLam] = useState('');
  const create = useCreateTodo();
  const [err, setErr] = useState('');

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => { if (!categoryId && cats[0]) setCategoryId(cats[0].id); }, [cats, categoryId]);
  useEffect(() => { if (!assigneeId && currentUserId) setAssigneeId(currentUserId); }, [currentUserId, assigneeId]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!title.trim()) { setErr('Nhập tiêu đề'); return; }
    if (!assigneeId)   { setErr('Chọn người làm'); return; }
    setErr('');
    try {
      await create.mutateAsync({
        tieu_de: title.trim(),
        category_id: categoryId ? Number(categoryId) : null,
        assignee_id: Number(assigneeId),
        han: han || null,
        gio_lam: gioLam || null,
      });
      setTitle(''); setHan(''); setGioLam('');
      titleRef.current?.focus();
    } catch (e2) {
      setErr(e2?.message ?? 'Lỗi');
    }
  }

  return (
    <form onSubmit={submit} style={s.addBox}>
      {/* Dòng 1: tiêu đề full width */}
      <input ref={titleRef} className="form-input" placeholder="Việc cần làm..."
        value={title} onChange={(e) => setTitle(e.target.value)} />
      {/* Dòng 2: loại / người làm / ngày / giờ */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select className="form-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
          style={{ flex: '1 1 140px', minWidth: 0 }}>
          <option value="">— Loại —</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.ten}</option>)}
        </select>
        <select className="form-input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
          style={{ flex: '1 1 140px', minWidth: 0 }}>
          <option value="">— Người làm —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === currentUserId ? '★ Mình' : u.ho_ten}
            </option>
          ))}
        </select>
        <input className="form-input" type="date" value={han}
          onChange={(e) => setHan(e.target.value)} title="Ngày (tuỳ chọn)"
          style={{ flex: '1 1 130px', minWidth: 0 }} />
        <input className="form-input" type="time" value={gioLam}
          onChange={(e) => setGioLam(e.target.value)} title="Giờ làm (tuỳ chọn)"
          style={{ flex: '1 1 110px', minWidth: 0 }} />
      </div>
      {/* Dòng 3: lỗi + nút */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {err ? <span style={{ color: 'var(--red)', fontSize: 12 }}>{err}</span> : <span />}
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn-ghost" onClick={onDone} style={{ fontSize: 12, padding: '6px 12px' }}>Đóng</button>
          <button type="submit" className="btn-primary" disabled={create.isPending} style={{ fontSize: 12, padding: '6px 14px' }}>
            {create.isPending ? 'Đang thêm...' : 'Thêm'}
          </button>
        </div>
      </div>
    </form>
  );
}

function TaskRow({ task, currentUserId, onOpenCN }) {
  const toggle = useToggleTodo();
  const del = useDeleteTodo();
  const han = fmtHan(task.han);
  const isMine = task.assignee_id === currentUserId;
  const isMineCreate = task.created_by === currentUserId && task.assignee_id !== currentUserId;

  return (
    <div style={{ ...s.row, opacity: task.hoan_thanh ? 0.55 : 1 }}>
      <input type="checkbox" checked={!!task.hoan_thanh}
        onChange={(e) => toggle.mutate({ id: task.id, hoan_thanh: e.target.checked })}
        style={s.check} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {task.category_icon && (
            <span title={task.category_ten}
              style={{ ...s.catChip, background: colorOf(task.category_mau_sac) + '24', color: colorOf(task.category_mau_sac) }}>
              {task.category_icon}
            </span>
          )}
          <span style={{ ...s.titleText, textDecoration: task.hoan_thanh ? 'line-through' : 'none' }}>
            {task.tieu_de}
          </span>
        </div>
        <div style={s.metaRow}>
          {isMine ? null : <span style={s.metaItem}>👤 {task.assignee_ho_ten}</span>}
          {isMineCreate && <span style={{ ...s.metaItem, color: 'var(--accent)' }}>↗ giao</span>}
          {task.cong_nhan_id && (
            <span style={{ ...s.metaItem, cursor: 'pointer', color: 'var(--teal)' }}
              onClick={() => onOpenCN(task.cong_nhan_id)}>
              👷 {task.cong_nhan_ho_ten}
            </span>
          )}
          {han && <span style={{ ...s.metaItem, color: han.color }}>⏰ {han.label}{task.gio_lam ? ` ${task.gio_lam}` : ''}</span>}
          {!han && task.gio_lam && <span style={{ ...s.metaItem, color: 'var(--text2)' }}>🕒 {task.gio_lam}</span>}
        </div>
      </div>
      <button onClick={() => { if (window.confirm('Xoá việc này?')) del.mutate(task.id); }}
        style={s.delBtn} title="Xoá">×</button>
    </div>
  );
}

// ─── CategoryManager modal (admin) ──────────────────────────
function CategoryManager({ onClose }) {
  const catsQ = useTodoCategories();
  const create = useCreateTodoCategory();
  const update = useUpdateTodoCategory();
  const del = useDeleteTodoCategory();
  const [draft, setDraft] = useState({ ten: '', icon: '', mau_sac: 'accent', thu_tu: 100 });
  const [err, setErr] = useState('');
  const cats = catsQ.data ?? [];

  async function add() {
    if (!draft.ten.trim()) { setErr('Nhập tên loại'); return; }
    setErr('');
    try {
      await create.mutateAsync({
        ten: draft.ten.trim(),
        icon: draft.icon || null,
        mau_sac: draft.mau_sac || null,
        thu_tu: Number(draft.thu_tu || 100),
      });
      setDraft({ ten: '', icon: '', mau_sac: 'accent', thu_tu: 100 });
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={m.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Quản lý loại đầu việc</div>
          <button onClick={onClose} style={m.close}>×</button>
        </div>

        <div style={m.list}>
          {cats.map((c) => (
            <CategoryRow key={c.id} cat={c}
              onUpdate={(body) => update.mutateAsync({ id: c.id, ...body })}
              onDelete={() => { if (window.confirm(`Xoá loại "${c.ten}"?`)) del.mutate(c.id); }}
            />
          ))}
        </div>

        <div style={m.addBox}>
          <input className="form-input" placeholder="Tên loại" value={draft.ten}
            onChange={(e) => setDraft((d) => ({ ...d, ten: e.target.value }))}
            style={{ flex: 2 }} />
          <input className="form-input" placeholder="Icon" value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
            style={{ width: 60 }} maxLength={4} />
          <select className="form-input" value={draft.mau_sac}
            onChange={(e) => setDraft((d) => ({ ...d, mau_sac: e.target.value }))}
            style={{ width: 110 }}>
            {Object.keys(COLOR).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="form-input" type="number" placeholder="STT" value={draft.thu_tu}
            onChange={(e) => setDraft((d) => ({ ...d, thu_tu: e.target.value }))}
            style={{ width: 70 }} />
          <button className="btn-primary" onClick={add} disabled={create.isPending} style={{ padding: '6px 14px', fontSize: 12 }}>+ Thêm</button>
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}

function CategoryRow({ cat, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ten: cat.ten, icon: cat.icon ?? '', mau_sac: cat.mau_sac ?? 'accent', thu_tu: cat.thu_tu, active: cat.active });

  async function save() {
    await onUpdate({
      ten: draft.ten.trim(),
      icon: draft.icon || null,
      mau_sac: draft.mau_sac || null,
      thu_tu: Number(draft.thu_tu || 100),
      active: !!draft.active,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={m.row}>
        <input className="form-input" value={draft.ten} onChange={(e) => setDraft((d) => ({ ...d, ten: e.target.value }))} style={{ flex: 2 }} />
        <input className="form-input" value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} style={{ width: 60 }} maxLength={4} />
        <select className="form-input" value={draft.mau_sac} onChange={(e) => setDraft((d) => ({ ...d, mau_sac: e.target.value }))} style={{ width: 110 }}>
          {Object.keys(COLOR).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input className="form-input" type="number" value={draft.thu_tu} onChange={(e) => setDraft((d) => ({ ...d, thu_tu: e.target.value }))} style={{ width: 70 }} />
        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />Active
        </label>
        <button className="btn-primary" onClick={save} style={{ padding: '4px 10px', fontSize: 12 }}>Lưu</button>
        <button className="btn-ghost"   onClick={() => setEditing(false)} style={{ padding: '4px 10px', fontSize: 12 }}>Hủy</button>
      </div>
    );
  }
  return (
    <div style={{ ...m.row, opacity: cat.active ? 1 : 0.5 }}>
      <span style={{ flex: 2, color: 'var(--text1)', fontSize: 13 }}>
        <span style={{ marginRight: 6 }}>{cat.icon}</span>{cat.ten}
      </span>
      <span style={{ width: 110, fontSize: 11, color: colorOf(cat.mau_sac) }}>{cat.mau_sac}</span>
      <span style={{ width: 50, fontSize: 11, color: 'var(--text3)' }}>#{cat.thu_tu}</span>
      <span style={{ width: 60, fontSize: 11 }}>{cat.active ? '✓' : '—'}</span>
      <button className="btn-ghost" onClick={() => setEditing(true)} style={{ padding: '4px 10px', fontSize: 12 }}>Sửa</button>
      <button className="btn-ghost" onClick={onDelete} style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }}>Xoá</button>
    </div>
  );
}

const m = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  modal: {
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12,
    padding: 20, width: 'min(720px, 92vw)', maxHeight: '85vh', overflow: 'auto',
  },
  close: { background: 'transparent', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg2)', padding: '8px 10px', borderRadius: 8,
  },
  addBox: {
    display: 'flex', gap: 6, alignItems: 'center',
    paddingTop: 12, borderTop: '1px solid var(--border)',
  },
};

const s = {
  root: { fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 8 },
  count: { background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600 },
  tabs: { display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 8, padding: 2 },

  quickAddBtn: {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    background: 'var(--bg2)', border: '1px dashed var(--border2)',
    color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: 8,
  },

  addBox: {
    display: 'flex', flexDirection: 'column', gap: 6,
    background: 'var(--bg2)', borderRadius: 10, padding: 10, marginBottom: 8,
  },

  list: { display: 'flex', flexDirection: 'column', gap: 4 },

  row: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '8px 8px', borderRadius: 8, background: 'var(--bg2)',
  },
  check: { marginTop: 3, cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--accent)' },
  titleText: { fontSize: 13, color: 'var(--text1)', wordBreak: 'break-word' },
  catChip: { fontSize: 12, borderRadius: 6, padding: '0 6px', lineHeight: '18px', flexShrink: 0 },
  metaRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 },
  metaItem: { fontSize: 11, color: 'var(--text3)' },
  delBtn: {
    background: 'transparent', border: 'none', color: 'var(--text3)',
    cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
  },
  divider: { fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '6px 0' },
  empty: { padding: '14px 8px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' },
};
