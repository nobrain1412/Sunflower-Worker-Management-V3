/**
 * Trang Chấm công — 2 chế độ:
 *   - "Điểm danh nhanh" (theo ngày): thao tác nhanh buổi sáng, nút Có mặt/Nghỉ + Lưu tất cả.
 *   - "Bảng tháng" (lưới): tổng quan + chỉnh sửa đầy đủ qua popup 4 loại giờ.
 *
 * State chỉnh sửa (edits) dùng chung cho cả 2 chế độ: edits[phan_cong_id][day] = cell.
 * Lưu theo lô: mỗi phan_cong 1 request batch.
 */
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChamCongThang, useUpsertChamCong } from '../../hooks/useChamCong';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';
import { useAuth } from '../../context/AuthContext';
import DiemDanhNgay from './DiemDanhNgay';
import BangThang from './BangThang';
import {
  MONTH_NAMES, daysInMonth, ymd, todayYMD,
  cellFromServer, emptyCell, equalCell, isEmptyCell, toEntry,
} from './chamCongShared';

export default function ChamCong() {
  const { isAdmin, isQuanLy } = useAuth();
  const navigate = useNavigate();
  const canImport = isAdmin || isQuanLy;

  const [mode, setMode]   = useState('ngay');         // 'ngay' | 'thang'
  const [ngay, setNgay]   = useState(todayYMD());     // cho chế độ ngày
  const now = new Date();
  const [thang, setThang] = useState(now.getMonth() + 1);
  const [nam, setNam]     = useState(now.getFullYear());
  const [congTyId, setCongTyId] = useState('');
  const [nguoiTuyenId, setNguoiTuyenId] = useState('');
  const [search, setSearch] = useState('');

  // Tháng/năm đang xem phụ thuộc chế độ
  const qThang = mode === 'ngay' ? Number(ngay.slice(5, 7)) : thang;
  const qNam   = mode === 'ngay' ? Number(ngay.slice(0, 4)) : nam;
  const day    = Number(ngay.slice(8, 10));

  const params = { thang: qThang, nam: qNam };
  if (congTyId) params.cong_ty_id = congTyId;
  if (nguoiTuyenId) params.nguoi_tuyen_id = nguoiTuyenId;

  const { data: res, isLoading } = useChamCongThang(params);
  const rows = res?.data ?? [];
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];

  // edits[phan_cong_id][day] = cell
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const upsert = useUpsertChamCong();

  // Đổi tháng/filter → bỏ edits chưa lưu
  useEffect(() => { setEdits({}); }, [qThang, qNam, congTyId, nguoiTuyenId]);

  const dayList = useMemo(
    () => Array.from({ length: daysInMonth(qThang, qNam) }, (_, i) => i + 1),
    [qThang, qNam],
  );

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.cong_nhan_ten || '').toLowerCase().includes(q)
      || (r.ten_cong_ty || '').toLowerCase().includes(q));
  }, [rows, search]);

  // pcId → day → server cc
  const ccMap = useMemo(() => {
    const out = {};
    for (const r of rows) {
      out[r.phan_cong_id] = {};
      for (const cc of (r.cham_cong || [])) {
        out[r.phan_cong_id][Number((cc.ngay || '').slice(-2))] = cc;
      }
    }
    return out;
  }, [rows]);

  function serverCell(pcId, d) {
    return cellFromServer(ccMap[pcId]?.[d]) || emptyCell();
  }
  function getCell(pcId, d) {
    const e = edits[pcId]?.[d];
    if (e !== undefined) return e;
    return serverCell(pcId, d);
  }
  function setCell(pcId, d, cell) {
    setEdits((prev) => {
      const next = { ...prev, [pcId]: { ...(prev[pcId] || {}) } };
      // Nếu trùng giá trị server → bỏ khỏi edits (không coi là thay đổi)
      if (equalCell(cell, serverCell(pcId, d))) {
        delete next[pcId][d];
        if (Object.keys(next[pcId]).length === 0) delete next[pcId];
      } else {
        next[pcId][d] = cell;
      }
      return next;
    });
  }
  function isDirtyCell(pcId, d) {
    return edits[pcId]?.[d] !== undefined;
  }

  const dirtyCount = useMemo(
    () => Object.values(edits).reduce((sum, days) => sum + Object.keys(days).length, 0),
    [edits],
  );

  async function handleSaveAll() {
    const pcIds = Object.keys(edits).filter((id) => Object.keys(edits[id]).length > 0);
    if (pcIds.length === 0) return;
    if (!window.confirm(`Lưu ${dirtyCount} thay đổi cho ${pcIds.length} công nhân?\n(Ngày nghỉ phép/việc sẽ thông báo cho người tuyển.)`)) return;

    setSaving(true);
    const results = await Promise.allSettled(pcIds.map((pcId) => {
      const entries = Object.entries(edits[pcId]).map(([d, cell]) => ({
        ngay: ymd(qThang, qNam, Number(d)),
        ...toEntry(cell),
      }));
      return upsert.mutateAsync({ phan_cong_id: Number(pcId), entries }).then(() => pcId);
    }));
    setSaving(false);

    const okIds = new Set(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));
    const failed = results.filter((r) => r.status === 'rejected');
    setEdits((prev) => {
      const next = { ...prev };
      okIds.forEach((id) => delete next[id]);
      return next;
    });
    if (failed.length) {
      alert(`${failed.length} công nhân lưu lỗi: ${failed[0].reason?.message ?? 'Lỗi không xác định'}`);
    }
  }

  function shiftDay(delta) {
    const d = new Date(`${ngay}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setNgay(ymd(d.getMonth() + 1, d.getFullYear(), d.getDate()));
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Chấm công</div>
          <div style={s.subtitle}>
            Nhập 4 loại giờ: HC ngày, TC ngày, HC đêm, TC đêm. Nghỉ phép = P, nghỉ việc = V.
          </div>
        </div>
        {canImport && (
          <button className="btn-primary" onClick={() => navigate('/cham-cong/import-excel')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            📊 Import vân tay
          </button>
        )}
      </div>

      {/* Chuyển chế độ */}
      <div style={s.segment}>
        {[['ngay', '⚡ Điểm danh nhanh'], ['thang', '📅 Bảng tháng']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)}
            style={{ ...s.segBtn, ...(mode === v ? s.segBtnActive : {}) }}>{l}</button>
        ))}
      </div>

      {/* Bộ lọc */}
      <div style={s.toolbar}>
        {mode === 'ngay' ? (
          <div style={s.dateNav}>
            <button className="btn-ghost" style={s.navBtn} onClick={() => shiftDay(-1)}>‹</button>
            <input type="date" className="form-input" style={{ ...s.select, minWidth: 150 }}
              value={ngay} onChange={(e) => e.target.value && setNgay(e.target.value)} />
            <button className="btn-ghost" style={s.navBtn} onClick={() => shiftDay(1)}>›</button>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setNgay(todayYMD())}>Hôm nay</button>
          </div>
        ) : (
          <>
            <select className="form-input" style={s.select} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
              {MONTH_NAMES.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
            </select>
            <select className="form-input" style={s.select} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
              {[nam - 1, nam, nam + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}
        <select className="form-input" style={s.select} value={congTyId} onChange={(e) => setCongTyId(e.target.value)}>
          <option value="">— Mọi công ty —</option>
          {congTyArr.map((c) => <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>)}
        </select>
        {isAdmin && (
          <select className="form-input" style={s.select} value={nguoiTuyenId} onChange={(e) => setNguoiTuyenId(e.target.value)}>
            <option value="">— Mọi người tuyển —</option>
            {venderArr.map((v) => <option key={v.id} value={v.id}>{v.ho_ten}</option>)}
          </select>
        )}
        <input className="form-input" style={{ ...s.select, minWidth: 200 }} placeholder="Tìm tên CN / công ty"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div style={s.card}><div style={s.empty}>Đang tải...</div></div>
      ) : mode === 'ngay' ? (
        <DiemDanhNgay rows={filtered} day={day} getCell={getCell} setCell={setCell} isDirtyCell={isDirtyCell} />
      ) : (
        <BangThang rows={filtered} dayList={dayList} thang={qThang} nam={qNam}
          getCell={getCell} setCell={setCell} isDirtyCell={isDirtyCell} />
      )}

      {/* Thanh lưu cố định dưới khi có thay đổi */}
      {dirtyCount > 0 && (
        <div style={s.saveBar}>
          <span style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>
            {dirtyCount} thay đổi chưa lưu
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={() => setEdits({})} disabled={saving}>Bỏ thay đổi</button>
          <button className="btn-primary" onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Đang lưu...' : '💾 Lưu tất cả'}
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  subtitle: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  segment: { display: 'inline-flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, gap: 3, alignSelf: 'flex-start' },
  segBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: 'var(--text2)', padding: '8px 16px', borderRadius: 7, fontFamily: "'Be Vietnam Pro', sans-serif" },
  segBtnActive: { background: 'var(--accent)', color: '#fff' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  dateNav: { display: 'flex', alignItems: 'center', gap: 6 },
  navBtn: { fontSize: 18, padding: '2px 12px', lineHeight: 1 },
  select: { padding: '6px 10px', fontSize: 12 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 60, textAlign: 'center', color: 'var(--text3)' },
  saveBar: {
    position: 'sticky', bottom: 12, zIndex: 50,
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
    padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
};
