import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { isEmbeddableMapUrl, normalizeMapUrl } from '../../constants/mapUrl';
import MediaUploader from '../../components/MediaUploader';
import RateCongTyPanel from './RateCongTyPanel';
import DeXuatModal from './DeXuatModal';
import useIsMobile from '../../hooks/useIsMobile';

function toMediaArray(v) { return Array.isArray(v) ? v : []; }

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function useCongTyData() {
  return useQuery({
    queryKey: ['cong-ty'],
    queryFn:  () => api.get('/cong-ty', { params: { limit: 100 } }),
    staleTime: 30_000,
  });
}

function useCapNhat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/cong-ty/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-ty'] }),
  });
}

function useTaoMoi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/cong-ty', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-ty'] }),
  });
}

function useXoaCongTy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/cong-ty/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-ty'] }),
  });
}

// ─── Cấu hình lương — view mode ───────────────────────────
function LuongConfig({ ct }) {
  const bangLuong = [
    ['Lương cơ bản',          fmt(ct.luong_co_ban),    'var(--green)'],
    ['Lương theo giờ',        fmt(ct.luong_theo_gio),   'var(--teal)'],
    ['Ngày làm chuẩn',        `${ct.ngay_lam_chuan} ngày`, 'var(--text2)'],
  ];
  const bangTC = [
    ['Tăng ca ngày',          fmt(ct.luong_tc_ngay),   'var(--amber)'],
    ['Hành chính đêm',        fmt(ct.luong_hc_dem),    'var(--amber)'],
    ['Tăng ca đêm',           fmt(ct.luong_tc_dem),    'var(--red)'],
    ['Chủ nhật',              fmt(ct.luong_chu_nhat),  'var(--red)'],
    ['Ngày lễ',               fmt(ct.luong_ngay_le),   'var(--red)'],
  ];
  const bangKhauTru = [
    ['Tiền đồng phục',        fmt(ct.tien_dong_phuc ?? 0), 'var(--amber)'],
    ['Tiền phạt nghỉ',        fmt(ct.tien_phat_nghi ?? 0), 'var(--red)'],
  ];
  const bangVender = [
    ['Trợ cấp',                fmt(ct.tro_cap ?? 0),                 'var(--green)'],
    ['Chuyên cần',             fmt(ct.chuyen_can ?? 0),              'var(--teal)'],
    ['Tiền công quản lý / giờ', fmt(ct.tien_cong_quan_ly_theo_gio ?? 0), 'var(--accent2)'],
    ['Ngày chốt công',         `Ngày ${ct.ngay_chot_cong ?? 25}`,    'var(--text2)'],
  ];
  return (
    <>
      <div style={f.sectionLabel}>Lương cơ bản</div>
      <div style={f.grid}>
        {bangLuong.map(([label, value, color]) => (
          <div key={label} style={f.item}>
            <div style={f.label}>{label}</div>
            <div style={{ ...f.value, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...f.sectionLabel, marginTop: 14 }}>Tăng ca (VNĐ/giờ)</div>
      <div style={f.grid}>
        {bangTC.map(([label, value, color]) => (
          <div key={label} style={f.item}>
            <div style={f.label}>{label}</div>
            <div style={{ ...f.value, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...f.sectionLabel, marginTop: 14 }}>Khấu trừ mặc định</div>
      <div style={f.grid}>
        {bangKhauTru.map(([label, value, color]) => (
          <div key={label} style={f.item}>
            <div style={f.label}>{label}</div>
            <div style={{ ...f.value, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...f.sectionLabel, marginTop: 14 }}>Vender / Trợ cấp</div>
      <div style={f.grid}>
        {bangVender.map(([label, value, color]) => (
          <div key={label} style={f.item}>
            <div style={f.label}>{label}</div>
            <div style={{ ...f.value, color }}>{value}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Form chỉnh sửa ────────────────────────────────────────
const numberFields = [
  ['luong_co_ban',   'Lương cơ bản (VNĐ/tháng)'],
  ['luong_theo_gio', 'Lương theo giờ (VNĐ/giờ)'],
  ['ngay_lam_chuan', 'Ngày làm chuẩn'],
  ['luong_tc_ngay',  'Tăng ca ngày (VNĐ/giờ)'],
  ['luong_hc_dem',   'Hành chính đêm (VNĐ/giờ)'],
  ['luong_tc_dem',   'Tăng ca đêm (VNĐ/giờ)'],
  ['luong_chu_nhat', 'Chủ nhật (VNĐ/giờ)'],
  ['luong_ngay_le',  'Ngày lễ (VNĐ/giờ)'],
  ['tien_dong_phuc', 'Tiền khấu trừ đồng phục (VNĐ)'],
  ['tien_phat_nghi', 'Tiền phạt nghỉ không đơn (VNĐ)'],
  ['tien_cong_quan_ly_theo_gio', 'Tiền công quản lý (VNĐ/giờ)'],
  ['tro_cap',                 'Trợ cấp (VNĐ/tháng)'],
  ['chuyen_can',              'Chuyên cần (VNĐ/tháng)'],
  ['ngay_chot_cong',          'Ngày chốt công (1-31)'],
];

const EMPTY_FORM = {
  ten_cong_ty: '', dia_chi: '', map_url: '', mo_ta_cong_viec: '', media_urls: [],
  luong_co_ban: '', luong_theo_gio: '', ngay_lam_chuan: '26',
  luong_tc_ngay: '', luong_hc_dem: '', luong_tc_dem: '', luong_chu_nhat: '', luong_ngay_le: '',
  tien_dong_phuc: '0', tien_phat_nghi: '0',
  tro_cap: '0', chuyen_can: '0', ngay_chot_cong: '25',
  tien_cong_quan_ly_theo_gio: '0',
};

export default function CongTy() {
  const { user, isAdmin } = useAuth();
  const isQuanLy = user?.vai_tro === 'quan_ly';
  const isMobile = useIsMobile();
  const { data: res, isLoading } = useCongTyData();
  const capNhat = useCapNhat();
  const taoMoi  = useTaoMoi();
  const xoa     = useXoaCongTy();

  const list = res?.data ?? [];
  const [selectedId, setSelectedId] = useState(null);
  const [editing,    setEditing]    = useState(false);
  const [addModal,   setAddModal]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errMsg,     setErrMsg]     = useState('');
  const [deXuatMode, setDeXuatMode] = useState(null); // 'tao_moi' | 'sua_doi' | null

  // Desktop: auto-chọn cty đầu. Mobile: chỉ chọn khi user click → list-first UX.
  const selected = list.find((c) => c.id === selectedId)
    ?? (isMobile ? null : list[0])
    ?? null;
  // Mobile collapse: ẩn list khi đang xem chi tiết, ẩn detail khi đang xem list
  const showList   = !isMobile || !selected;
  const showDetail = !isMobile ||  selected;
  const selectedMapUrl = normalizeMapUrl(selected?.map_url ?? '');
  const canEmbedSelectedMap = isEmbeddableMapUrl(selected?.map_url ?? '');

  function openEdit() {
    if (!selected) return;
    setForm({
      ten_cong_ty:   selected.ten_cong_ty,
      dia_chi:       selected.dia_chi ?? '',
      map_url:       selected.map_url ?? '',
      mo_ta_cong_viec: selected.mo_ta_cong_viec ?? '',
      media_urls:    toMediaArray(selected.media_urls),
      luong_co_ban:  selected.luong_co_ban,
      luong_theo_gio: selected.luong_theo_gio,
      ngay_lam_chuan: selected.ngay_lam_chuan,
      luong_tc_ngay:  selected.luong_tc_ngay ?? 0,
      luong_hc_dem:   selected.luong_hc_dem  ?? 0,
      luong_tc_dem:   selected.luong_tc_dem  ?? 0,
      luong_chu_nhat: selected.luong_chu_nhat ?? 0,
      luong_ngay_le:  selected.luong_ngay_le  ?? 0,
      tien_dong_phuc: selected.tien_dong_phuc ?? 0,
      tien_phat_nghi: selected.tien_phat_nghi ?? 0,
      tien_cong_quan_ly_theo_gio: selected.tien_cong_quan_ly_theo_gio ?? 0,
      tro_cap:                 selected.tro_cap ?? 0,
      chuyen_can:              selected.chuyen_can ?? 0,
      ngay_chot_cong:          selected.ngay_chot_cong ?? 25,
    });
    setEditing(true);
    setErrMsg('');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function buildPayload() {
    const payload = { ...form };
    numberFields.forEach(([k]) => {
      if (payload[k] === '' || payload[k] == null) {
        delete payload[k];
      } else {
        payload[k] = parseFloat(payload[k]);
      }
    });
    payload.media_urls = toMediaArray(payload.media_urls);
    if (payload.media_urls.length === 0) delete payload.media_urls;
    if (!payload.map_url?.trim()) {
      delete payload.map_url;
    } else {
      payload.map_url = normalizeMapUrl(payload.map_url);
    }
    return payload;
  }

  // Interceptor trong useApi đã chuẩn hoá lỗi về { code, message, details }
  // → đọc thẳng e.message (kèm details nếu là lỗi validate) thay vì e.response.data...
  function getErrMsg(e) {
    const base = e?.message ?? 'Lỗi không xác định';
    if (Array.isArray(e?.details) && e.details.length) {
      const detail = e.details.map((d) => d.message).filter(Boolean).join('; ');
      if (detail) return `${base}: ${detail}`;
    }
    return base;
  }

  async function handleSave() {
    setErrMsg('');
    try {
      await capNhat.mutateAsync({ id: selected.id, ...buildPayload() });
      setEditing(false);
    } catch (e) {
      setErrMsg(getErrMsg(e));
    }
  }

  async function handleAdd() {
    setErrMsg('');
    try {
      const res2 = await taoMoi.mutateAsync(buildPayload());
      setAddModal(false);
      setSelectedId(res2?.data?.id ?? null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setErrMsg(getErrMsg(e));
    }
  }

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;

  return (
    <div style={s.root}>
      <div className="cong-ty-main">
        {/* Danh sách công ty */}
        {showList && (
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>Công ty</div>
            {isAdmin && (
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setForm(EMPTY_FORM); setAddModal(true); setErrMsg(''); }}>+ Thêm</button>
            )}
            {isQuanLy && (
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setDeXuatMode('tao_moi')}>+ Đề xuất tạo mới</button>
            )}
          </div>
          {list.map((ct) => (
            <div
              key={ct.id}
              style={{ ...s.ctItem, ...(selected?.id === ct.id ? s.ctItemActive : {}) }}
              onClick={() => { setSelectedId(ct.id); setEditing(false); }}
            >
              <div style={s.ctAvatar}>{ct.ten_cong_ty?.[0] ?? '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.ctName}>{ct.ten_cong_ty}</div>
                <div style={s.ctAddr}>{ct.dia_chi ?? '—'}</div>
                <div style={s.progressLabel}>{ct.so_luong_hien_tai ?? 0} công nhân</div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chưa có công ty nào</div>
          )}
        </div>
        )}

        {/* Chi tiết */}
        {showDetail && (selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isMobile && (
              <button className="btn-ghost" onClick={() => setSelectedId(null)}
                style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 10px' }}>
                ← Danh sách công ty
              </button>
            )}
            {/* Profile card */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <div style={s.cardTitle}>{selected.ten_cong_ty}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{selected.dia_chi ?? '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isAdmin && (
                    <button className="btn-ghost" onClick={editing ? () => setEditing(false) : openEdit}>
                      {editing ? 'Hủy' : '✏️ Chỉnh sửa'}
                    </button>
                  )}
                  {/* Chỉ cho đề xuất sửa công ty mình quản lý — nếu không, BE sẽ trả 403.
                      Ẩn nút ở công ty không thuộc quyền để tránh điền form rồi mới báo lỗi. */}
                  {isQuanLy && !editing && (user?.cong_ty_ids ?? []).includes(selected.id) && (
                    <button className="btn-ghost" onClick={() => setDeXuatMode('sua_doi')}>
                      ✏️ Đề xuất sửa
                    </button>
                  )}
                  {isAdmin && !editing && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`XOÁ VĨNH VIỄN công ty "${selected.ten_cong_ty}"?\n\nToàn bộ phân công, chấm công và phân quyền quản lý của công ty này sẽ bị xoá. Công nhân sẽ được gỡ khỏi công ty (không bị xoá). Hành động KHÔNG THỂ hoàn tác.`)) return;
                        try { await xoa.mutateAsync(selected.id); setSelectedId(null); }
                        catch (e) { alert(e?.message ?? 'Lỗi'); }
                      }}
                      style={{ background: 'transparent', border: '1px solid rgba(255,95,114,0.4)',
                        borderRadius: 8, padding: '7px 14px', fontSize: 12, color: 'var(--red)',
                        cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                      🗑 Xoá
                    </button>
                  )}
                </div>
              </div>
              <div style={s.occupancy}>
                <div>
                  <div style={s.occLabel}>Công nhân hiện tại</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                    {selected.so_luong_hien_tai ?? 0} <span style={{ fontSize: 14, color: 'var(--text3)' }}>người</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cấu hình lương */}
            <div style={s.card}>
              <div style={s.cardTitle}>Cấu hình bảng lương</div>
              {editing ? (
                <div>
                  <div style={{ ...f.grid, marginBottom: 10 }}>
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label className="form-label">Tên công ty</label>
                      <input className="form-input" name="ten_cong_ty" value={form.ten_cong_ty} onChange={handleChange} />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label className="form-label">Địa chỉ</label>
                      <input className="form-input" name="dia_chi" value={form.dia_chi} onChange={handleChange} />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label className="form-label">Google Maps URL (embed/share)</label>
                      <input className="form-input" name="map_url" value={form.map_url ?? ''} onChange={handleChange} placeholder="https://www.google.com/maps/embed?..." />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label className="form-label">Mô tả công việc</label>
                      <textarea className="form-input" name="mo_ta_cong_viec" rows={3} value={form.mo_ta_cong_viec ?? ''} onChange={handleChange} placeholder="Mô tả tính chất công việc, ca làm..." />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label className="form-label">Ảnh công ty</label>
                      <MediaUploader value={toMediaArray(form.media_urls)} onChange={(urls) => setForm((f) => ({ ...f, media_urls: urls }))} folder="cong-ty" />
                    </div>
                    {numberFields.map(([name, label]) => (
                      <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label className="form-label">{label}</label>
                        <input className="form-input" name={name} type="number" value={form[name]} onChange={handleChange} />
                      </div>
                    ))}
                  </div>
                  {errMsg && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{errMsg}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn-ghost" onClick={() => setEditing(false)}>Hủy</button>
                    <button className="btn-primary" onClick={handleSave} disabled={capNhat.isPending}>
                      {capNhat.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <LuongConfig ct={selected} />
                  {/* Công thức lương */}
                  <div style={f.formula}>
                    <div style={f.formulaTitle}>Công thức tính lương</div>
                    <div style={f.formulaCode}>
                      lương_thực_nhận = (lương_cơ_bản / {selected.ngay_lam_chuan} × ngày_công)<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; + lương_tăng_ca − tổng_khấu_trừ
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Đơn giá thưởng vender / CTV — chỉ admin xem & sửa */}
            {isAdmin && (
              <div style={s.card}>
                <RateCongTyPanel congTyId={selected.id} canEdit />
              </div>
            )}

            {selected.map_url && (
              <div style={s.card}>
                <div style={s.cardTitle}>Vị trí công ty</div>
                {canEmbedSelectedMap ? (
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <iframe
                      src={selectedMapUrl}
                      width="100%"
                      height="320"
                      style={{ border: 0 }}
                      loading="lazy"
                      title={`map-cong-ty-${selected.id}`}
                    />
                  </div>
                ) : (
                  <a href={selected.map_url} target="_blank" rel="noreferrer" className="btn-ghost">
                    Mở vị trí trên Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chọn một công ty để xem chi tiết</div>
          </div>
        ))}
      </div>

      {/* Modal thêm mới */}
      {addModal && (
        <div style={m.overlay} onClick={(e) => e.target === e.currentTarget && setAddModal(false)}>
          <div style={m.modal}>
            <div style={m.title}>Thêm công ty mới</div>
            <div style={{ ...f.grid, marginBottom: 12 }}>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Tên công ty <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" name="ten_cong_ty" value={form.ten_cong_ty} onChange={handleChange} placeholder="Công ty TNHH..." />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Địa chỉ</label>
                <input className="form-input" name="dia_chi" value={form.dia_chi} onChange={handleChange} placeholder="KCN Bình Dương..." />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Google Maps URL (embed/share)</label>
                <input className="form-input" name="map_url" value={form.map_url ?? ''} onChange={handleChange} placeholder="https://www.google.com/maps/embed?..." />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Mô tả công việc</label>
                <textarea className="form-input" name="mo_ta_cong_viec" rows={3} value={form.mo_ta_cong_viec ?? ''} onChange={handleChange} placeholder="Mô tả tính chất công việc, ca làm..." />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Ảnh công ty</label>
                <MediaUploader value={toMediaArray(form.media_urls)} onChange={(urls) => setForm((f) => ({ ...f, media_urls: urls }))} folder="cong-ty" />
              </div>
              {/* Form thêm mới: bỏ "Tiền công quản lý" (admin nhập sau khi chỉnh sửa) */}
              {numberFields
                .filter(([name]) => name !== 'tien_cong_quan_ly_theo_gio')
                .map(([name, label]) => (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" name={name} type="number" value={form[name]} onChange={handleChange} />
                </div>
              ))}
            </div>
            {errMsg && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{errMsg}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-ghost" onClick={() => setAddModal(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleAdd} disabled={taoMoi.isPending}>
                {taoMoi.isPending ? 'Đang lưu...' : 'Thêm công ty'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal đề xuất tạo mới / sửa cho quản lý */}
      {deXuatMode && (
        <DeXuatModal
          mode={deXuatMode}
          congTy={deXuatMode === 'sua_doi' ? selected : null}
          onClose={() => setDeXuatMode(null)}
        />
      )}
    </div>
  );
}

const s = {
  root:    { display: 'flex', flexDirection: 'column', gap: 14 },
  card:    { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  ctItem:  { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', borderRadius: 8, marginBottom: 2 },
  ctItemActive: { background: 'rgba(79,124,255,0.06)', padding: '12px 8px', marginLeft: -8, marginRight: -8 },
  ctAvatar:{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 },
  ctName:  { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  ctAddr:  { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  progressLabel: { fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", marginTop: 4 },
  occupancy:    { display: 'flex', gap: 20, alignItems: 'center', marginBottom: 4 },
  occLabel:     { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
};

const f = {
  sectionLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' },
  item:    { display: 'flex', flexDirection: 'column', gap: 4 },
  label:   { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  value:   { fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  formula: { marginTop: 16, padding: 14, background: 'var(--bg3)', borderRadius: 8 },
  formulaTitle:{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  formulaCode: { fontSize: 11, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 },
};

const m = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  title:   { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 18 },
};
