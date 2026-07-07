import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCongNhanList, useVenders, useCongTyList, useXoaCongNhan, useDuyetCongNhan } from '../../hooks/useCongNhan';
import { useTinhList } from '../../hooks/useProvinces';
import { useAuth } from '../../context/AuthContext';
import AddCongNhanModal from './AddModal';
import GanCongTyModal from './GanCongTyModal';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const TRANG_THAI_PILL = {
  cho_duyet: { cls: 'pill-amber', label: 'Chờ duyệt' },
  doi_viec:  { cls: 'pill-purple', label: 'Đợi việc' },
  dang_lam:  { cls: 'pill-green', label: 'Đang làm' },
  moi_vao:   { cls: 'pill-blue',  label: 'Mới vào'  },
  nghi_phep: { cls: 'pill-amber', label: 'Nghỉ phép' },
  nghi_viec: { cls: 'pill-red',   label: 'Nghỉ việc' },
};

// Sentinel gửi lên BE để lọc các bản ghi có giá trị trống (NULL/rỗng)
const EMPTY = '__empty__';

// Lưu bộ lọc theo session để khi mở chi tiết rồi quay lại không bị reset
const FILTER_KEY = 'cong_nhan_filters';
function loadSavedFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY)) || {}; }
  catch { return {}; }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'doi_viec',  label: 'Đợi việc' },
  { value: 'dang_lam',  label: 'Đang làm' },
  { value: 'moi_vao',   label: 'Mới vào'  },
  { value: 'nghi_phep', label: 'Nghỉ phép' },
  { value: 'nghi_viec', label: 'Nghỉ việc' },
];
const NOI_O_OPTIONS = [
  { value: '', label: 'Tất cả nơi ở' },
  { value: 'chua_co_phong', label: 'Chưa có phòng' },
  { value: 'tu_tuc', label: 'Tự túc chỗ ở' },
  { value: 'ktx', label: 'Ở KTX' },
  { value: 'phong_tro', label: 'Ở nhà trọ' },
];
const NOI_O_LABEL = {
  chua_co_phong: 'Chưa có phòng',
  tu_tuc: 'Tự túc',
  ktx: 'KTX',
  phong_tro: 'Nhà trọ',
};

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path;
}

function LoaiCNBadge({ loai }) {
  if (loai === 'chinh_thuc') {
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', whiteSpace: 'nowrap' }}>Chính thức</span>;
  }
  return null;
}

function MobileCongNhanCard({ cn, canDelete, onOpen, onDelete }) {
  const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;

  return (
    <div style={m.card} onClick={onOpen}>
      <div style={m.head}>
        <div style={m.avatar}>
          {cn.anh_chan_dung
            ? <img src={mediaUrl(cn.anh_chan_dung)} alt={cn.ho_ten} style={m.avatarImg} />
            : (cn.ho_ten?.[0] ?? '?')}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={m.name}>{cn.ho_ten}</div>
          <div style={m.company}>{cn.ten_cong_ty ?? 'Chưa phân công công ty'}</div>
        </div>
        <span className={`pill ${pill.cls}`}>{pill.label}</span>
      </div>

      <div style={m.grid}>
        <div style={m.item}><span style={m.label}>Vender</span><span style={m.value}>{cn.nguoi_tuyen_ho_ten ?? '—'}</span></div>
        <div style={m.item}><span style={m.label}>SĐT</span><span style={m.value}>{cn.so_dien_thoai ?? '—'}</span></div>
        <div style={m.item}><span style={m.label}>Ngày vào</span><span style={m.value}>{fmtDate(cn.ngay_vao_lam)}</span></div>
        <div style={m.item}><span style={m.label}>CCCD</span><span style={m.value}>{cn.cccd ?? '—'}</span></div>
        <div style={m.item}><span style={m.label}>Nơi ở</span><span style={m.value}>{NOI_O_LABEL[cn.trang_thai_noi_o] ?? '—'}</span></div>
      </div>

      {canDelete && (
        <div style={m.actions}>
          <button onClick={onDelete} style={m.deleteBtn}>🗑 Xoá</button>
        </div>
      )}
    </div>
  );
}

function DoiPhongVanSection() {
  const navigate = useNavigate();
  const { isAdmin, isQuanLy } = useAuth();
  const { data, isLoading } = useCongNhanList({
    trang_thai: 'doi_viec', limit: 100, sort: 'created_at', order: 'desc',
  });
  const xoaCN = useXoaCongNhan();
  const duyetCN = useDuyetCongNhan();
  const rows = (data?.data ?? []).filter((cn) => cn.cong_ty_id);

  if (!isAdmin && !isQuanLy) return null;

  async function handleXoa(cn, e) {
    e.stopPropagation();
    if (!window.confirm(`Xoá công nhân "${cn.ho_ten}"? Thao tác không thể hoàn tác.`)) return;
    try { await xoaCN.mutateAsync(cn.id); }
    catch (err) { alert(err?.message ?? 'Lỗi xoá'); }
  }

  async function handleDuyet(cn, e) {
    e.stopPropagation();
    if (!window.confirm(`Duyệt "${cn.ho_ten}" vào làm việc tại ${cn.ten_cong_ty}?`)) return;
    try { await duyetCN.mutateAsync(cn.id); }
    catch (err) { alert(err?.message ?? 'Lỗi duyệt'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>Đang đợi phỏng vấn</span>
        {rows.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'rgba(123,95,255,0.15)', color: 'var(--accent2)' }}>
            {rows.length}
          </span>
        )}
      </div>

      <div style={s.card}>
        {isLoading ? (
          <div style={s.center}>Đang tải...</div>
        ) : rows.length === 0 ? (
          <div style={{ ...s.center, fontSize: 12 }}>Không có công nhân nào đang đợi phỏng vấn</div>
        ) : (
          <div className="table-scroll">
          <table style={s.table}>
            <thead>
              <tr>
                {['Công nhân', 'Công ty phỏng vấn', 'Loại', 'Vender', 'SĐT', ''].map((label, i) => (
                  <th key={i} style={s.th}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cn) => (
                <tr key={cn.id} style={s.tr} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                  <td style={s.td}>
                    <div style={s.avatar}>{cn.anh_chan_dung
                      ? <img src={cn.anh_chan_dung} alt="" style={s.avatarImg} />
                      : (cn.ho_ten?.[0] ?? '?')}
                    </div>
                    <span style={s.name}>{cn.ho_ten}</span>
                  </td>
                  <td style={s.td}><span style={s.sub}>{cn.ten_cong_ty ?? '—'}</span></td>
                  <td style={s.td}><LoaiCNBadge loai={cn.loai_cong_nhan} /></td>
                  <td style={s.td}><span style={s.sub}>{cn.nguoi_tuyen_ho_ten ?? '—'}</span></td>
                  <td style={s.td}><span style={s.mono}>{cn.so_dien_thoai ?? '—'}</span></td>
                  <td style={s.tdAction} onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <button
                        title="Duyệt vào làm"
                        onClick={(e) => handleDuyet(cn, e)}
                        style={{ background: 'rgba(34,201,134,0.08)', border: '1px solid rgba(34,201,134,0.3)',
                          borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--green)',
                          cursor: 'pointer', marginRight: 6 }}
                      >✓ Duyệt</button>
                    )}
                    <button
                      title="Xoá công nhân"
                      onClick={(e) => handleXoa(cn, e)}
                      style={{ background: 'transparent', border: '1px solid rgba(255,95,114,0.4)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--red)',
                        cursor: 'pointer' }}
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CongNhan() {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const { isAdmin, isQuanLy } = useAuth();
  const canFilterAll = isAdmin || isQuanLy;
  const xoaCN = useXoaCongNhan();

  async function handleXoa(cn, e) {
    e.stopPropagation();
    if (!window.confirm(`Xoá công nhân "${cn.ho_ten}"? Hành động này không thể hoàn tác.`)) return;
    try { await xoaCN.mutateAsync(cn.id); }
    catch (err) { alert(err?.message ?? 'Lỗi xoá'); }
  }

  // Bộ lọc đã lưu ở session trước đó (đọc 1 lần khi mount)
  const saved = useRef(loadSavedFilters()).current;

  const [searchInput, setSearchInput] = useState(() => urlParams.get('q') ?? saved.search ?? '');
  const [search, setSearch]           = useState(() => urlParams.get('q') ?? saved.search ?? '');

  // Nhận query ?q=... từ Topbar global search (mỗi lần URL đổi)
  useEffect(() => {
    const q = urlParams.get('q');
    if (q != null) {
      setSearchInput(q);
      setSearch(q);
      setPage(1);
      // Bỏ ?q khỏi URL để lần sau user xoá ô search không bị "dính" lại
      urlParams.delete('q');
      setUrlParams(urlParams, { replace: true });
    }
  }, [urlParams, setUrlParams]);

  const [trangThai, setTrangThai]     = useState(saved.trangThai ?? '');
  const [trangThaiNoiO, setTrangThaiNoiO] = useState(saved.trangThaiNoiO ?? '');
  const [venderId, setVenderId]       = useState(saved.venderId ?? '');
  const [congTyId, setCongTyId]       = useState(saved.congTyId ?? '');
  const [tinh,     setTinh]           = useState(saved.tinh ?? '');
  const [ngay,     setNgay]           = useState(saved.ngay ?? '');
  const [sortBy,   setSortBy]         = useState(saved.sortBy ?? 'ho_ten');
  const [sortOrder,setSortOrder]      = useState(saved.sortOrder ?? 'asc');
  const [page, setPage]               = useState(saved.page ?? 1);
  const [showAdd, setShowAdd]         = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showGanCongTy, setShowGanCongTy] = useState(false);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  }
  const sortIcon = (field) => sortBy === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  // Debounce live search để giảm dồn request khi gõ nhanh
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Lưu bộ lọc vào session để giữ nguyên khi vào chi tiết rồi quay lại danh sách
  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({
      search: searchInput, trangThai, trangThaiNoiO, venderId, congTyId,
      tinh, ngay, sortBy, sortOrder, page,
    }));
  }, [searchInput, trangThai, trangThaiNoiO, venderId, congTyId, tinh, ngay, sortBy, sortOrder, page]);

  const { data, isLoading, isError } = useCongNhanList({
    page, limit: 20, search, trang_thai: trangThai,
    trang_thai_noi_o: trangThaiNoiO || undefined,
    vender_id: venderId || undefined,
    cong_ty_id: congTyId || undefined,
    tinh: tinh || undefined,
    ngay: ngay || undefined,
    sort: sortBy, order: sortOrder,
  });

  const venders   = useVenders().data?.data ?? [];
  const congTyArr = useCongTyList().data?.data ?? [];
  const { data: tinhList = [] } = useTinhList();

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, total_pages: 1 };
  const isMobile = useIsMobile();

  return (
    <div style={s.root}>
      {/* Toolbar */}
      <div className="cn-toolbar" style={s.toolbar}>
        <div className="cn-search-wrap" style={s.searchWrap}>
          <svg style={s.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            className="form-input cn-search-input"
            style={{ paddingLeft: 36 }}
            placeholder="Tìm tên, CCCD, SĐT..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div style={s.toolbarActions}>
          <button className="btn-ghost" style={s.filterBtn} onClick={() => setShowFilterSheet(true)}>
            <span>⚙</span>
            Bộ lọc
          </button>
          {canFilterAll && (
            <button className="btn-ghost" style={s.filterBtn} onClick={() => setShowGanCongTy(true)}>
              <span>🏢</span>
              Gán công ty
            </button>
          )}
          {(trangThai || trangThaiNoiO || venderId || congTyId || tinh || ngay) && (
            <button
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 10px' }}
              onClick={() => {
                setTrangThai('');
                setTrangThaiNoiO('');
                setVenderId('');
                setCongTyId('');
                setTinh('');
                setNgay('');
                setPage(1);
              }}
            >
              Xoá lọc
            </button>
          )}
        </div>

        <button className="btn-primary cn-add-button" style={{ marginLeft: 'auto' }} onClick={() => setShowAddSheet(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Thêm công nhân
        </button>
      </div>

      <div style={s.statsRow}>
        <span style={s.statText}>
          <b style={{ color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" }}>{meta.total}</b> công nhân
          {trangThai && ` · ${STATUS_OPTIONS.find(o => o.value === trangThai)?.label}`}
        </span>
        {(trangThaiNoiO || venderId || congTyId || tinh || ngay) && (
          <span style={s.filterHint}>Đang áp dụng bộ lọc nâng cao</span>
        )}
      </div>

      <div style={s.card}>
        {isLoading ? (
          <div style={s.center}>Đang tải...</div>
        ) : isError ? (
          <div style={{ ...s.center, color: 'var(--red)' }}>Lỗi tải dữ liệu</div>
        ) : rows.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>👤</div>
            <div style={s.emptyTitle}>Chưa có công nhân</div>
            <div style={s.emptySub}>Bắt đầu bằng cách thêm công nhân mới</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>+ Thêm công nhân</button>
          </div>
        ) : isMobile ? (
          <div style={m.list}>
            {rows.map((cn) => (
              <MobileCongNhanCard
                key={cn.id}
                cn={cn}
                canDelete={isAdmin || (isQuanLy && cn.trang_thai === 'doi_viec')}
                onOpen={() => navigate(`/cong-nhan/${cn.id}`)}
                onDelete={(e) => handleXoa(cn, e)}
              />
            ))}
          </div>
        ) : (
          <div className="table-scroll cn-table-scroll">
          <table className="cn-table" style={s.table}>
            <thead>
              <tr>
                {[
                  ['ho_ten',        'Họ tên'],
                  ['ten_cong_ty',   'Công ty'],
                  ['vender',        'Vender'],
                  ['so_dien_thoai', 'Số điện thoại'],
                  ['ngay_vao_lam',  'Ngày vào làm'],
                  ['trang_thai_noi_o', 'Nơi ở'],
                  ['trang_thai',    'Trạng thái'],
                ].map(([field, label]) => (
                  <th key={field} style={{ ...s.th, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => toggleSort(field)} title="Click để sắp xếp"
                  >
                    {label}{sortIcon(field)}
                  </th>
                ))}
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cn) => {
                const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                return (
                  <tr key={cn.id} style={s.tr} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                    <td className="cn-name-cell" style={s.td}>
                      <div style={s.avatar}>
                        {cn.anh_chan_dung
                          ? <img src={mediaUrl(cn.anh_chan_dung)} alt={cn.ho_ten} style={s.avatarImg} />
                          : (cn.ho_ten?.[0] ?? '?')}
                      </div>
                      <div className="cn-name-text" style={s.name}>{cn.ho_ten}</div>
                    </td>
                    <td style={s.td}><span style={s.sub}>{cn.ten_cong_ty ?? '—'}</span></td>
                    <td style={s.td}><span style={s.sub}>{cn.nguoi_tuyen_ho_ten ?? '—'}</span></td>
                    <td style={s.td}><span style={s.mono}>{cn.so_dien_thoai ?? '—'}</span></td>
                    <td style={s.td}><span style={s.mono}>{fmtDate(cn.ngay_vao_lam)}</span></td>
                    <td style={s.td}><span style={s.sub}>{NOI_O_LABEL[cn.trang_thai_noi_o] ?? '—'}</span></td>
                    <td style={s.td}>
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                      {cn.loai_cong_nhan === 'chinh_thuc' && <LoaiCNBadge loai={cn.loai_cong_nhan} />}
                    </td>
                    <td style={s.tdAction}>
                      {(isAdmin || (isQuanLy && cn.trang_thai === 'doi_viec')) && (
                        <button
                          title="Xoá công nhân"
                          onClick={(e) => handleXoa(cn, e)}
                          style={{ background: 'transparent', border: '1px solid rgba(255,95,114,0.4)',
                            borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--red)',
                            cursor: 'pointer', marginRight: 6 }}
                        >🗑</button>
                      )}
                      <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(`/cong-nhan/${cn.id}`); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {meta.total_pages > 1 && (
        <div style={s.pagination}>
          <button
            className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
            disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
          >← Trước</button>
          <span style={s.pageInfo}>
            Trang <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>{page}</b> / {meta.total_pages}
          </span>
          <button
            className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
            disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}
          >Sau →</button>
        </div>
      )}

      {(isAdmin || isQuanLy) && <DoiPhongVanSection />}

      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="Thêm công nhân">
        <div style={bs.list}>
          {[
            {
              icon: '✍️',
              label: 'Nhập thủ công',
              sub: 'Điền form thông tin cá nhân',
              action: () => {
                setShowAddSheet(false);
                setShowAdd(true);
              },
            },
            {
              icon: '🪪',
              label: 'Quét CCCD',
              sub: 'Đọc dữ liệu từ ảnh CCCD',
              action: () => {
                window.location.href = '/ocr/cccd';
              },
            },
            ...(canFilterAll ? [{
              icon: '📊',
              label: 'Import từ Excel',
              sub: 'Tải file .xlsx danh sách, nhiều CN cùng lúc',
              action: () => {
                navigate('/cong-nhan/import-excel');
              },
            }] : []),
            {
              icon: '📋',
              label: 'Quét danh sách viết tay',
              sub: 'Nhận diện nhiều công nhân cùng lúc',
              action: () => {
                window.location.href = '/ocr/danh-sach';
              },
            },
          ].map(({ icon, label, sub, action }) => (
            <button key={label} style={bs.item} onClick={action}>
              <div style={bs.itemIcon}>{icon}</div>
              <div>
                <div style={bs.itemLabel}>{label}</div>
                <div style={bs.itemSub}>{sub}</div>
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={showFilterSheet} onClose={() => setShowFilterSheet(false)} title="Bộ lọc công nhân">
        <div style={bs.filterGrid}>
          <div style={bs.field}>
            <label className="form-label">Trạng thái</label>
            <select className="form-input" value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {canFilterAll && (
            <>
              <div style={bs.field}>
                <label className="form-label">Trạng thái phòng</label>
                <select className="form-input" value={trangThaiNoiO} onChange={(e) => { setTrangThaiNoiO(e.target.value); setPage(1); }}>
                  {NOI_O_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={bs.field}>
                <label className="form-label">Công ty</label>
                <select className="form-input" value={congTyId} onChange={(e) => { setCongTyId(e.target.value); setPage(1); }}>
                  <option value="">Tất cả công ty</option>
                  <option value={EMPTY}>— Chưa phân công ty —</option>
                  {congTyArr.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>)}
                </select>
              </div>
              <div style={bs.field}>
                <label className="form-label">Vender</label>
                <select className="form-input" value={venderId} onChange={(e) => { setVenderId(e.target.value); setPage(1); }}>
                  <option value="">Tất cả vender</option>
                  <option value={EMPTY}>— Chưa có vender —</option>
                  {venders.map((v) => <option key={v.id} value={v.id}>{v.ho_ten}</option>)}
                </select>
              </div>
            </>
          )}

          <div style={bs.field}>
            <label className="form-label">Tỉnh</label>
            <select className="form-input" value={tinh} onChange={(e) => { setTinh(e.target.value); setPage(1); }}>
              <option value="">Tất cả tỉnh</option>
              <option value={EMPTY}>— Chưa có quê quán —</option>
              {tinhList.map((t) => <option key={t.code} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div style={bs.field}>
            <label className="form-label">Ngày vào làm</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                className="form-input"
                style={{ flex: 1 }}
                value={ngay === EMPTY ? '' : ngay}
                disabled={ngay === EMPTY}
                onChange={(e) => { setNgay(e.target.value); setPage(1); }}
                lang="vi-VN"
              />
              <button
                type="button"
                className={ngay === EMPTY ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }}
                onClick={() => { setNgay(ngay === EMPTY ? '' : EMPTY); setPage(1); }}
              >
                Chưa có ngày vào làm
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
            onClick={() => { setPage(1); setShowFilterSheet(false); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Tìm kiếm
          </button>
        </div>
      </BottomSheet>

      {showAdd && <AddCongNhanModal onClose={() => setShowAdd(false)} />}
      {showGanCongTy && <GanCongTyModal onClose={() => setShowGanCongTy(false)} />}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 11, color: 'var(--text3)', pointerEvents: 'none' },
  toolbarActions: { display: 'flex', alignItems: 'center', gap: 8 },
  filterBtn: { fontSize: 12, padding: '6px 10px' },
  statsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  statText: { fontSize: 12, color: 'var(--text2)' },
  filterHint: { fontSize: 11, color: 'var(--accent)' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg1)' },
  tr: { borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' },
  td: { padding: '12px 16px', verticalAlign: 'middle', display: 'table-cell' },
  tdAction: { padding: '12px 12px 12px 0', textAlign: 'right' },
  avatar: { width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', marginRight: 10, verticalAlign: 'middle' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 },
  name: { display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--text1)', verticalAlign: 'middle' },
  sub:  { fontSize: 12, color: 'var(--text2)' },
  mono: { fontSize: 12, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, borderRadius: 6, display: 'inline-flex' },
  center: { padding: 48, textAlign: 'center', color: 'var(--text2)', fontSize: 13 },
  empty: { padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  emptySub:   { fontSize: 13, color: 'var(--text2)', marginTop: 4 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 },
  pageInfo:   { fontSize: 12, color: 'var(--text2)' },
};

const bs = {
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
    width: '100%', textAlign: 'left',
  },
  itemIcon: { width: 36, height: 36, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  itemLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  itemSub: { fontSize: 11, color: 'var(--text2)', marginTop: 2 },
  filterGrid: { display: 'grid', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
};

const m = {
  list: { display: 'flex', flexDirection: 'column', gap: 10, padding: 10 },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  head: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  name: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  company: { fontSize: 11, color: 'var(--text2)', marginTop: 2 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  item: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  label: { fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontSize: 12, color: 'var(--text1)', overflowWrap: 'anywhere' },
  actions: { display: 'flex', justifyContent: 'flex-end' },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,95,114,0.4)',
    borderRadius: 8,
    padding: '4px 10px',
    fontSize: 11,
    color: 'var(--red)',
    cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
