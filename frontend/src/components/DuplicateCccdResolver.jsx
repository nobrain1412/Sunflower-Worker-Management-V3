import { useMemo, useState } from 'react';

// Hộp xử lý khi trùng CCCD, dùng chung cho các cửa sổ thêm công nhân
// (Nhập thủ công, Quét CCCD, Quét VNeID). Cho người dùng chọn:
//   - Ghi đè: chọn từng trường muốn thay vào hồ sơ cũ (bảng đối chiếu cũ ↔ mới)
//   - Bổ sung: chỉ điền vào các ô đang trống của hồ sơ cũ
//   - Thêm mới: tạo hồ sơ riêng biệt (chờ duyệt)
//   - Thêm lại: kích hoạt lại hồ sơ cũ đã nghỉ việc (chỉ khi CN đã nghỉ)
//
// Props:
//   dup:        { message, ho_ten, da_nghi_viec, co_the_kich_hoat_lai, hien_tai }
//   nextData:   payload đang gửi (đặt tên theo field backend)
//   congTyList: [{ id, ten_cong_ty }] để hiển thị tên công ty
//   busy:       đang xử lý (khoá nút)
//   onGhiDe(fields[]), onBoSung(), onThemMoi(), onKichHoatLai(), onClose()

const FIELDS = [
  { key: 'ho_ten',           label: 'Họ tên',        type: 'text' },
  { key: 'ngay_sinh',        label: 'Ngày sinh',     type: 'date' },
  { key: 'gioi_tinh',        label: 'Giới tính',     type: 'text' },
  { key: 'so_dien_thoai',    label: 'SĐT',           type: 'text' },
  { key: 'que_quan',         label: 'Quê quán',      type: 'text' },
  { key: 'dia_chi_hien_tai', label: 'Địa chỉ',       type: 'text' },
  { key: 'ngay_cap_cccd',    label: 'Ngày cấp CCCD', type: 'date' },
  { key: 'cong_ty_id',       label: 'Công ty',       type: 'cong_ty' },
  { key: 'ngay_vao_lam',     label: 'Ngày vào làm',  type: 'date' },
  { key: 'ma_van_tay',       label: 'Mã vân tay',    type: 'text' },
  { key: 'bo_phan',          label: 'Bộ phận',       type: 'text' },
  { key: 'ghi_chu',          label: 'Ghi chú',       type: 'text' },
  { key: 'anh_cccd_truoc',   label: 'Ảnh CCCD trước',type: 'image' },
  { key: 'anh_cccd_sau',     label: 'Ảnh CCCD sau',  type: 'image' },
  { key: 'anh_vneid',        label: 'Ảnh VNeID',     type: 'image' },
];

function isoToDmy(v) {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}
function isEmpty(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

export default function DuplicateCccdResolver({
  dup, nextData = {}, congTyList = [], busy = false,
  onGhiDe, onBoSung, onThemMoi, onKichHoatLai, onClose,
}) {
  const hienTai = dup?.hien_tai ?? {};
  const congTyName = (id) => {
    if (isEmpty(id)) return '';
    const ct = congTyList.find((c) => String(c.id) === String(id));
    return ct ? ct.ten_cong_ty : `#${id}`;
  };

  const fmt = (val, type) => {
    if (isEmpty(val)) return '—';
    if (type === 'date') return isoToDmy(val);
    if (type === 'cong_ty') return congTyName(val) || '—';
    if (type === 'image') return 'Có ảnh';
    return String(val);
  };

  // Chuẩn hoá để so sánh cũ ↔ mới (công ty so theo id, ngày theo ISO/dmy)
  const norm = (val, type) => {
    if (isEmpty(val)) return '';
    if (type === 'cong_ty') return String(val);
    if (type === 'date') return isoToDmy(val);
    return String(val).trim();
  };

  // Các dòng có ý nghĩa để hiển thị: có giá trị mới HOẶC giá trị cũ
  const rows = useMemo(() => FIELDS.map((f) => {
    const oldV = hienTai[f.key];
    const newV = nextData[f.key];
    const hasNew = !isEmpty(newV);
    const hasOld = !isEmpty(oldV);
    const differs = norm(oldV, f.type) !== norm(newV, f.type);
    return { ...f, oldV, newV, hasNew, hasOld, differs };
  }).filter((r) => r.hasNew || r.hasOld), [dup, nextData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [mode, setMode] = useState(''); // '' | ghi_de | bo_sung | them_moi
  // Trường được chọn ghi đè: mặc định các trường có giá trị mới & khác giá trị cũ
  const [chon, setChon] = useState(() =>
    new Set(rows.filter((r) => r.hasNew && r.differs).map((r) => r.key)));

  const boSungRows = rows.filter((r) => r.hasNew && !r.hasOld); // ô trống được điền

  function toggle(key) {
    setChon((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div style={st.box}>
      <div style={st.title}>⚠️ CCCD đã tồn tại trong hệ thống</div>
      <div style={st.msg}>{dup?.message}</div>

      <div style={st.tabs}>
        <TabBtn active={mode === 'ghi_de'}  onClick={() => setMode('ghi_de')}>Ghi đè</TabBtn>
        <TabBtn active={mode === 'bo_sung'} onClick={() => setMode('bo_sung')}>Bổ sung thông tin</TabBtn>
        <TabBtn active={mode === 'them_moi'} onClick={() => setMode('them_moi')}>Thêm mới riêng</TabBtn>
        {dup?.co_the_kich_hoat_lai && (
          <TabBtn active={mode === 'kich_hoat'} onClick={() => setMode('kich_hoat')}>Thêm lại vào công ty</TabBtn>
        )}
      </div>

      {mode === 'ghi_de' && (
        <>
          <div style={st.hint}>
            Chọn những trường muốn <b>ghi đè</b> lên hồ sơ cũ. Ô không chọn sẽ giữ nguyên giá trị cũ.
          </div>
          <div style={st.tableWrap}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}></th>
                  <th style={st.th}>Trường</th>
                  <th style={st.th}>Hồ sơ cũ</th>
                  <th style={st.th}>Giá trị mới</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={r.differs ? st.trDiff : null}>
                    <td style={st.td}>
                      <input
                        type="checkbox"
                        disabled={!r.hasNew}
                        checked={chon.has(r.key)}
                        onChange={() => toggle(r.key)}
                        style={{ accentColor: 'var(--accent)', cursor: r.hasNew ? 'pointer' : 'not-allowed' }}
                      />
                    </td>
                    <td style={st.tdLabel}>{r.label}</td>
                    <td style={st.td}>{fmt(r.oldV, r.type)}</td>
                    <td style={{ ...st.td, color: r.hasNew ? 'var(--text1)' : 'var(--text3)', fontWeight: r.differs && r.hasNew ? 600 : 400 }}>
                      {fmt(r.newV, r.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={st.actions}>
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
            <button
              className="btn-primary"
              disabled={busy || chon.size === 0}
              onClick={() => onGhiDe([...chon])}
            >
              {busy ? 'Đang ghi đè...' : `Ghi đè ${chon.size} trường`}
            </button>
          </div>
        </>
      )}

      {mode === 'bo_sung' && (
        <>
          <div style={st.hint}>
            Chỉ điền vào các ô đang <b>trống</b> của hồ sơ cũ — không thay đổi dữ liệu đã có.
          </div>
          {boSungRows.length === 0 ? (
            <div style={st.empty}>Hồ sơ cũ đã có đủ các thông tin bạn nhập — không có gì để bổ sung.</div>
          ) : (
            <div style={st.tableWrap}>
              <table style={st.table}>
                <thead>
                  <tr><th style={st.th}>Trường</th><th style={st.th}>Sẽ điền vào</th></tr>
                </thead>
                <tbody>
                  {boSungRows.map((r) => (
                    <tr key={r.key}>
                      <td style={st.tdLabel}>{r.label}</td>
                      <td style={{ ...st.td, color: 'var(--green)', fontWeight: 600 }}>{fmt(r.newV, r.type)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={st.actions}>
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
            <button className="btn-primary" disabled={busy || boSungRows.length === 0} onClick={onBoSung}>
              {busy ? 'Đang bổ sung...' : `Bổ sung ${boSungRows.length} ô trống`}
            </button>
          </div>
        </>
      )}

      {mode === 'them_moi' && (
        <>
          <div style={st.hint}>
            Tạo một hồ sơ <b>riêng biệt</b> dù trùng CCCD. Hồ sơ mới ở trạng thái <b>chờ duyệt</b>,
            cần quản trị viên duyệt trước khi vào làm.
          </div>
          <div style={st.actions}>
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
            <button className="btn-primary" disabled={busy} onClick={onThemMoi}>
              {busy ? 'Đang thêm...' : '＋ Thêm mới riêng (chờ duyệt)'}
            </button>
          </div>
        </>
      )}

      {mode === 'kich_hoat' && (
        <>
          <div style={st.hint}>
            Hồ sơ cũ đã nghỉ việc. Thêm lại sẽ <b>tái sử dụng hồ sơ cũ</b>, cập nhật trạng thái
            và mở lại lịch sử vào làm (không tạo bản ghi trùng).
          </div>
          <div style={st.actions}>
            <button className="btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
            <button className="btn-primary" disabled={busy} onClick={onKichHoatLai}>
              {busy ? 'Đang xử lý...' : '↻ Thêm lại vào công ty'}
            </button>
          </div>
        </>
      )}

      {mode === '' && (
        <div style={st.pick}>Chọn một cách xử lý ở trên.</div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
        background: active ? 'rgba(79,124,255,0.14)' : 'var(--bg2)',
        color: active ? 'var(--accent)' : 'var(--text2)',
      }}
    >
      {children}
    </button>
  );
}

const st = {
  box:   { background: 'rgba(255,179,68,0.08)', border: '1px solid rgba(255,179,68,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--amber)' },
  msg:   { fontSize: 12.5, color: 'var(--text1)', marginTop: 6, lineHeight: 1.5 },
  tabs:  { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  hint:  { fontSize: 12, color: 'var(--text2)', marginTop: 12, lineHeight: 1.5 },
  tableWrap: { marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 320 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:    { position: 'sticky', top: 0, background: 'var(--bg2)', color: 'var(--text3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td:    { padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text2)', verticalAlign: 'top' },
  tdLabel: { padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text1)', fontWeight: 600, whiteSpace: 'nowrap' },
  trDiff: { background: 'rgba(79,124,255,0.05)' },
  empty: { fontSize: 12, color: 'var(--text2)', marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  pick:  { fontSize: 12, color: 'var(--text3)', marginTop: 12, fontStyle: 'italic' },
};
