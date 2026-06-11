/**
 * Trang quản lý đề xuất công ty.
 *   - Admin: xem TẤT CẢ, có nút Duyệt / Từ chối
 *   - Quản lý: xem CỦA MÌNH (tự động filter ở backend)
 */
import { useState } from 'react';
import { useDeXuatList, useDuyetDeXuat, useTuChoiDeXuat } from '../../hooks/useCongTyDeXuat';
import { useAuth } from '../../context/AuthContext';

const TRANG_THAI_PILL = {
  cho_duyet: { label: 'Chờ duyệt',  color: 'var(--amber)', bg: 'rgba(255,179,68,0.1)' },
  da_duyet:  { label: 'Đã duyệt',   color: 'var(--green)', bg: 'rgba(34,201,134,0.1)' },
  tu_choi:   { label: 'Từ chối',    color: 'var(--red)',   bg: 'rgba(255,95,114,0.1)' },
};

const LOAI_LABEL = {
  tao_moi: 'Tạo công ty',
  sua_doi: 'Sửa công ty',
  khac:    'Đề xuất chung',
};

const FIELD_LABEL = {
  tieu_de:        'Tiêu đề',
  noi_dung:       'Nội dung',
  ten_cong_ty:    'Tên công ty',
  dia_chi:        'Địa chỉ',
  map_url:        'Link Maps',
  so_dien_thoai:  'SĐT',
  email:          'Email',
  luong_co_ban:   'Lương cơ bản',
  luong_theo_gio: 'Lương theo giờ',
  he_so_ot:       'Hệ số OT',
  ngay_lam_chuan: 'Ngày làm chuẩn',
  ngay_chot_cong: 'Ngày chốt công',
  luong_tc_ngay:  'Lương TC ngày',
  luong_hc_dem:   'Lương HC đêm',
  luong_tc_dem:   'Lương TC đêm',
  luong_chu_nhat: 'Lương CN',
  luong_ngay_le:  'Lương ngày lễ',
  tien_dong_phuc: 'Tiền đồng phục',
  tien_phat_nghi: 'Tiền phạt nghỉ',
  tro_cap:        'Trợ cấp',
  chuyen_can:     'Chuyên cần',
  tien_cong_quan_ly_theo_gio: 'Tiền công QL/giờ',
  mo_ta_cong_viec: 'Mô tả công việc',
  ghi_chu:        'Ghi chú',
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtVal(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('vi-VN');
  if (Array.isArray(v)) return `[${v.length} mục]`;
  return String(v);
}

export default function DeXuatQueue() {
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState({ trang_thai: 'cho_duyet' });
  const { data, isLoading } = useDeXuatList(filter);
  const rows = data?.data ?? [];

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Đề xuất</h1>
          <p style={s.subtitle}>
            {isAdmin
              ? 'Duyệt hoặc từ chối đề xuất từ thành viên'
              : 'Theo dõi trạng thái các đề xuất của bạn'}
          </p>
        </div>
        <div style={s.tabs}>
          {Object.entries(TRANG_THAI_PILL).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setFilter({ trang_thai: key })}
              style={{
                ...s.tab,
                background: filter.trang_thai === key ? p.bg : 'transparent',
                color: filter.trang_thai === key ? p.color : 'var(--text2)',
                borderColor: filter.trang_thai === key ? p.color : 'var(--border2)',
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setFilter({})}
            style={{
              ...s.tab,
              background: !filter.trang_thai ? 'var(--bg3)' : 'transparent',
              color: !filter.trang_thai ? 'var(--text1)' : 'var(--text2)',
            }}
          >
            Tất cả
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={s.empty}>Đang tải...</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Không có đề xuất nào.</div>
      ) : (
        <div style={s.list}>
          {rows.map((dx) => (
            <DeXuatCard key={dx.id} dx={dx} canApprove={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeXuatCard({ dx, canApprove }) {
  const [expanded, setExpanded] = useState(dx.trang_thai === 'cho_duyet');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const duyet = useDuyetDeXuat();
  const tuChoi = useTuChoiDeXuat();

  const pill = TRANG_THAI_PILL[dx.trang_thai];
  const duLieu = dx.du_lieu ?? {};
  const fields = Object.entries(duLieu);

  async function handleDuyet() {
    const confirmMsg = dx.loai === 'tao_moi'
      ? `Duyệt sẽ TẠO công ty "${duLieu.ten_cong_ty}" vào DB. Tiếp tục?`
      : dx.loai === 'sua_doi'
        ? `Duyệt sẽ CẬP NHẬT công ty "${dx.cong_ty_ten_hien_tai}". Tiếp tục?`
        : 'Duyệt đề xuất này? (chỉ đánh dấu đã duyệt, không thay đổi dữ liệu)';
    if (!window.confirm(confirmMsg)) return;
    try {
      await duyet.mutateAsync({ id: dx.id });
    } catch (err) {
      alert(err?.message || 'Duyệt thất bại');
    }
  }

  async function handleTuChoi() {
    if (!rejectReason.trim()) { alert('Vui lòng nêu lý do từ chối'); return; }
    try {
      await tuChoi.mutateAsync({ id: dx.id, ghi_chu_admin: rejectReason });
      setShowReject(false);
      setRejectReason('');
    } catch (err) {
      alert(err?.message || 'Từ chối thất bại');
    }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader} onClick={() => setExpanded((v) => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTitle}>
            <span style={{ ...s.pill, color: pill.color, background: pill.bg, borderColor: pill.color }}>
              {pill.label}
            </span>
            <span style={s.loaiTag}>{LOAI_LABEL[dx.loai]}</span>
            <span style={s.congTyTen}>
              {dx.loai === 'tao_moi' ? duLieu.ten_cong_ty
                : dx.loai === 'sua_doi' ? dx.cong_ty_ten_hien_tai
                : (duLieu.tieu_de || 'Đề xuất chung')}
            </span>
          </div>
          <div style={s.cardMeta}>
            <span>👤 {dx.nguoi_de_xuat_ho_ten}</span>
            <span>· {fmtTime(dx.created_at)}</span>
            {dx.duyet_luc && <span>· Xử lý: {fmtTime(dx.duyet_luc)} bởi {dx.nguoi_duyet_ho_ten}</span>}
          </div>
        </div>
        <button style={s.expandBtn}>{expanded ? '▲' : '▼'}</button>
      </div>

      {expanded && (
        <div style={s.cardBody}>
          {dx.ghi_chu && (
            <div style={s.noteBox}>
              <div style={s.noteLabel}>📝 Ghi chú người đề xuất</div>
              <div style={s.noteText}>{dx.ghi_chu}</div>
            </div>
          )}

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Field</th>
                  <th style={s.th}>{dx.loai === 'sua_doi' ? 'Giá trị mới' : 'Giá trị đề xuất'}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(([key, val]) => (
                  <tr key={key}>
                    <td style={s.tdLabel}>{FIELD_LABEL[key] || key}</td>
                    <td style={s.tdValue}>{fmtVal(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dx.ghi_chu_admin && (
            <div style={{ ...s.noteBox, borderColor: pill.color, background: pill.bg }}>
              <div style={s.noteLabel}>💬 Ghi chú admin</div>
              <div style={s.noteText}>{dx.ghi_chu_admin}</div>
            </div>
          )}

          {canApprove && dx.trang_thai === 'cho_duyet' && (
            <>
              {showReject ? (
                <div style={s.rejectForm}>
                  <label style={s.label}>Lý do từ chối *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Vd: Cấu hình lương không đúng, vui lòng sửa và submit lại"
                  />
                  <div style={s.actions}>
                    <button onClick={() => setShowReject(false)} style={s.btnGhost} disabled={tuChoi.isPending}>
                      Quay lại
                    </button>
                    <button onClick={handleTuChoi} style={s.btnReject} disabled={tuChoi.isPending}>
                      {tuChoi.isPending ? 'Đang gửi...' : 'Xác nhận từ chối'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={s.actions}>
                  <button onClick={() => setShowReject(true)} style={s.btnReject} disabled={duyet.isPending}>
                    ✕ Từ chối
                  </button>
                  <button onClick={handleDuyet} style={s.btnApprove} disabled={duyet.isPending}>
                    {duyet.isPending ? 'Đang duyệt...' : '✓ Duyệt'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  root: { padding: 24, maxWidth: 1100, fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    background: 'transparent', border: '1px solid var(--border2)',
    borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },

  empty: {
    padding: 60, textAlign: 'center', color: 'var(--text3)',
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12,
  },

  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 16, cursor: 'pointer',
  },
  cardTitle: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    marginBottom: 6,
  },
  pill: {
    display: 'inline-block', padding: '3px 10px',
    border: '1px solid', borderRadius: 12,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
  },
  loaiTag: {
    fontSize: 10, fontWeight: 700, color: 'var(--text2)',
    padding: '3px 8px', background: 'var(--bg3)', borderRadius: 6,
  },
  congTyTen: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  cardMeta: {
    fontSize: 11, color: 'var(--text3)',
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  expandBtn: {
    background: 'transparent', border: 'none', color: 'var(--text3)',
    cursor: 'pointer', fontSize: 10, padding: 4,
  },

  cardBody: {
    padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12,
    borderTop: '1px solid var(--border)',
  },

  noteBox: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px', marginTop: 12,
  },
  noteLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 },
  noteText: { fontSize: 13, color: 'var(--text1)', whiteSpace: 'pre-wrap' },

  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    background: 'var(--bg2)', color: 'var(--text2)',
    fontWeight: 600, fontSize: 10, letterSpacing: '0.05em',
    textTransform: 'uppercase', textAlign: 'left',
    padding: '8px 12px', borderBottom: '1px solid var(--border)',
  },
  tdLabel: {
    padding: '7px 12px', borderBottom: '1px solid var(--border)',
    color: 'var(--text2)', width: '40%', fontSize: 12,
  },
  tdValue: {
    padding: '7px 12px', borderBottom: '1px solid var(--border)',
    color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
  },

  label: { fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.05em' },
  rejectForm: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 8,
    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnApprove: {
    background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnReject: {
    background: 'transparent', border: '1px solid var(--red)',
    color: 'var(--red)', borderRadius: 8,
    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
