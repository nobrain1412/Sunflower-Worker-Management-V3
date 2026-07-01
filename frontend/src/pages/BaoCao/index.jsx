import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList } from '../../hooks/useCongNhan';
import api from '../../hooks/useApi';

// Các báo cáo còn lại (chưa nối backend) — giữ nguyên bản mock cũ.
const REPORTS = [
  { id: 'cham-cong',  icon: '📅', title: 'Bảng chấm công tháng', desc: 'Ngày công, OT, nghỉ phép theo từng công nhân', format: '.xlsx', color: 'var(--accent)' },
  { id: 'bang-luong', icon: '💰', title: 'Bảng lương tổng hợp',  desc: 'Lương thực nhận, khấu trừ, tạm ứng',          format: '.xlsx', color: 'var(--green)'  },
  { id: 'thu-chi',    icon: '📊', title: 'Thu/Chi theo kỳ',      desc: 'Tổng hợp giao dịch thu chi theo tháng',        format: '.xlsx', color: 'var(--teal)'  },
];

const THANG_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));

export default function BaoCao() {
  const { user, isAdmin, isQuanLy } = useAuth();
  const canKtx = isAdmin || !!user?.quyen_ktx; // hóa đơn KTX theo quyền KTX
  const [thang, setThang] = useState(5);
  const [nam,   setNam]   = useState(2026);
  const [loading, setLoading] = useState(null);
  const [ktxErr, setKtxErr] = useState('');

  // ── Bộ lọc riêng cho báo cáo "Danh sách công nhân" ──────────────
  const congTyArr = useCongTyList().data?.data ?? [];
  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  const [dsCty, setDsCty]           = useState('all');   // 'all' | id
  const [dsChuaNghi, setDsChuaNghi] = useState(true);    // true = chỉ CN chưa nghỉ việc
  const [dsLoai, setDsLoai]         = useState('ca_hai'); // 'ca_hai' | 'chinh_thuc' | 'thoi_vu'
  const [dsErr, setDsErr]           = useState('');

  function handleExport(id) {
    setLoading(id);
    setTimeout(() => setLoading(null), 2000);
  }

  async function exportDanhSachCongNhan() {
    setDsErr('');
    setLoading('ds-cn');
    try {
      const res = await api.get('/bao-cao/danh-sach-cong-nhan', {
        params: {
          cong_ty_id: dsCty,
          chua_nghi:  dsChuaNghi ? 'true' : 'false',
          loai:       dsLoai,
        },
        responseType: 'blob',
      });
      // api interceptor unwrap res.data → với blob trả thẳng Blob
      const blob = res instanceof Blob ? res : new Blob([res]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danh-sach-cong-nhan_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDsErr(err?.message || 'Không xuất được file. Vui lòng thử lại.');
    } finally {
      setLoading(null);
    }
  }

  async function exportHoaDonKtx() {
    setKtxErr('');
    setLoading('hoa-don-ktx');
    try {
      const res = await api.get('/bao-cao/hoa-don-ktx', {
        params: { thang, nam },
        responseType: 'blob',
      });
      const blob = res instanceof Blob ? res : new Blob([res]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoa-don-ktx_T${thang}-${nam}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setKtxErr(err?.message || 'Không xuất được file. Vui lòng thử lại.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={s.root}>
      {/* Bộ lọc kỳ (dùng cho các báo cáo theo tháng) */}
      <div style={s.filterCard}>
        <div style={s.filterTitle}>Chọn kỳ báo cáo</div>
        <div style={s.filterRow}>
          <div style={s.filterField}>
            <label className="form-label">Tháng</label>
            <select className="form-input" style={{ width: 160 }} value={thang} onChange={(e) => setThang(+e.target.value)}>
              {THANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={s.filterField}>
            <label className="form-label">Năm</label>
            <select className="form-input" style={{ width: 120 }} value={nam} onChange={(e) => setNam(+e.target.value)}>
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', padding: '8px 0' }}>
              Kỳ: Tháng <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>{thang}/{nam}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Danh sách công nhân — báo cáo có bộ lọc riêng ────────────── */}
      <div style={s.dsCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ ...s.reportIcon, background: 'var(--accent2)1a', color: 'var(--accent2)' }}>👥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.reportTitle}>Danh sách công nhân</div>
            <div style={s.reportDesc}>Hồ sơ công nhân theo công ty — lọc theo trạng thái nghỉ việc & loại hợp đồng</div>
          </div>
          <span style={{ ...s.formatBadge, background: 'var(--accent2)15', color: 'var(--accent2)' }}>.xlsx</span>
        </div>

        <div style={s.dsFilterRow}>
          <div style={s.filterField}>
            <label className="form-label">Công ty</label>
            <select className="form-input" style={{ width: 240 }} value={dsCty} onChange={(e) => setDsCty(e.target.value)}>
              <option value="all">{isQuanLy ? 'Tất cả công ty tôi quản lý' : 'Tất cả công ty'}</option>
              {congTyOptions.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>)}
            </select>
          </div>
          <div style={s.filterField}>
            <label className="form-label">Trạng thái nghỉ việc</label>
            <select className="form-input" style={{ width: 220 }} value={dsChuaNghi ? '1' : '0'} onChange={(e) => setDsChuaNghi(e.target.value === '1')}>
              <option value="1">Chỉ người chưa nghỉ việc</option>
              <option value="0">Tất cả (gồm đã nghỉ)</option>
            </select>
          </div>
          <div style={s.filterField}>
            <label className="form-label">Loại công nhân</label>
            <select className="form-input" style={{ width: 180 }} value={dsLoai} onChange={(e) => setDsLoai(e.target.value)}>
              <option value="ca_hai">Chính thức + Thời vụ</option>
              <option value="chinh_thuc">Chỉ chính thức</option>
              <option value="thoi_vu">Chỉ thời vụ</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-primary"
              style={{ padding: '9px 16px', fontSize: 12 }}
              onClick={exportDanhSachCongNhan}
              disabled={loading === 'ds-cn'}
            >
              {loading === 'ds-cn' ? (
                <><span style={s.spinner} />Đang xuất...</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Xuất .xlsx
                </>
              )}
            </button>
          </div>
        </div>
        {dsErr && <div style={s.errBox}>⚠ {dsErr}</div>}
      </div>

      {/* ── Hóa đơn KTX — tính từ ngày đầu tháng, chốt ngày cuối tháng ── */}
      {canKtx && (
        <div style={s.dsCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...s.reportIcon, background: 'var(--amber)1a', color: 'var(--amber)' }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.reportTitle}>Hóa đơn KTX</div>
              <div style={s.reportDesc}>
                Điện, nước, tiền phòng tháng <b>{thang}/{nam}</b> — chia cho từng công nhân theo số ngày ở
                (tính từ ngày đầu tháng, chốt ngày cuối tháng)
              </div>
            </div>
            <span style={{ ...s.formatBadge, background: 'var(--amber)15', color: 'var(--amber)' }}>.xlsx</span>
            <button
              className="btn-primary"
              style={{ padding: '9px 16px', fontSize: 12, flexShrink: 0 }}
              onClick={exportHoaDonKtx}
              disabled={loading === 'hoa-don-ktx'}
            >
              {loading === 'hoa-don-ktx' ? (
                <><span style={s.spinner} />Đang xuất...</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Xuất .xlsx
                </>
              )}
            </button>
          </div>
          {ktxErr && <div style={s.errBox}>⚠ {ktxErr}</div>}
        </div>
      )}

      {/* Các báo cáo còn lại */}
      <div style={s.reportGrid}>
        {REPORTS.map((r) => (
          <div key={r.id} style={s.reportCard}>
            <div style={{ ...s.reportIcon, background: r.color + '1a', color: r.color }}>{r.icon}</div>
            <div style={s.reportInfo}>
              <div style={s.reportTitle}>{r.title}</div>
              <div style={s.reportDesc}>{r.desc}</div>
              <div style={s.reportMeta}>
                <span style={{ ...s.formatBadge, background: r.color + '15', color: r.color }}>{r.format}</span>
                <span style={s.periodBadge}>T{thang}/{nam}</span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12 }}
              onClick={() => handleExport(r.id)}
              disabled={loading === r.id}
            >
              {loading === r.id ? (
                <><span style={s.spinner} />Đang xuất...</>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                  Xuất {r.format}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Hướng dẫn */}
      <div style={s.helpCard}>
        <div style={s.helpTitle}>💡 Hướng dẫn xuất báo cáo</div>
        <ul style={s.helpList}>
          <li><b>Danh sách công nhân</b>: chọn công ty (hoặc tất cả), lọc chỉ người chưa nghỉ việc và loại hợp đồng, rồi bấm Xuất .xlsx</li>
          <li>Quản lý chỉ xuất được công nhân thuộc công ty mình quản lý</li>
          <li><b>Hóa đơn KTX</b>: chọn tháng/năm ở bộ lọc trên; tiền được tính từ ngày đầu tháng và chốt tới ngày cuối tháng, chia theo số ngày mỗi công nhân ở</li>
          <li>Chọn tháng và năm cần xuất cho các báo cáo theo kỳ ở bộ lọc phía trên</li>
          <li>File Excel (.xlsx) được tạo bằng ExcelJS, file PDF bằng PDFKit</li>
        </ul>
      </div>
    </div>
  );
}

const s = {
  root:        { display: 'flex', flexDirection: 'column', gap: 16 },
  filterCard:  { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  filterTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 14 },
  filterRow:   { display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 6 },
  dsCard:      { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  dsFilterRow: { display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' },
  reportGrid:  { display: 'flex', flexDirection: 'column', gap: 10 },
  reportCard:  { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 },
  reportIcon:  { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  reportInfo:  { flex: 1, minWidth: 0 },
  reportTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  reportDesc:  { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  reportMeta:  { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' },
  formatBadge: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" },
  periodBadge: { fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: 6 },
  spinner:     { width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block', marginRight: 6 },
  errBox:      { padding: '9px 13px', background: 'rgba(255,95,114,0.08)', border: '1px solid rgba(255,95,114,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)' },
  helpCard:    { background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 14, padding: '16px 20px' },
  helpTitle:   { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 10 },
  helpList:    { paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 },
  code:        { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent)' },
};
