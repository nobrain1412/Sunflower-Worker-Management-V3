import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { ThemeScope } from '../../context/ThemeContext';
import {
  companyToJob, companyToBrand, salaryText, toArr,
  phanTichDiaDiem, boDau,
} from './tuyenDungData';
import Header from './Header';
import Hero from './Hero';
import { JobsSection, CompaniesSection, EmployerCta } from './Sections';
import Detail from './Detail';
import Footer from './Footer';

// Trang tuyển dụng CÔNG KHAI (homepage) — dựng theo thiết kế Sunflower.
// Toàn bộ số liệu lấy từ dữ liệu thật: /api/tuyen-dung (công ty đang tuyển) và
// /api/tuyen-dung/thong-ke (thống kê). Không còn dữ liệu mẫu.

// Dựng object chi tiết từ công ty thật đang chọn.
function buildDetail(view) {
  if (!view || view.type === 'home' || !view.item?.congTy) return null;
  const { item } = view;
  const ct = item.congTy;
  return {
    kindLabel: 'Nhà tuyển dụng',
    title: ct.ten_cong_ty,
    mono: item.mono,
    bg: `linear-gradient(120deg, ${item.color} 0%, #2c4a8a 115%)`,
    meta: ct.dia_chi || 'Đang tuyển dụng công nhân',
    desc: ct.mo_ta_cong_viec
      || `${ct.ten_cong_ty} đang tuyển dụng công nhân với môi trường làm việc ổn định, thu nhập hấp dẫn.`,
    tags: ['Lương ' + salaryText(ct), 'Tuyển gấp', 'Đi làm ngay'],
    phone: ct.so_dien_thoai || null,
    listTitle: 'Vị trí đang tuyển tại ' + ct.ten_cong_ty,
    jobs: [{ ...companyToJob(ct, 0), id: 'detail-' + ct.id }],
  };
}

export default function TuyenDung() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState({});
  const [view, setView] = useState({ type: 'home' });
  // Bộ lọc địa điểm: từ khoá tìm kiếm + tỉnh/thành + khu công nghiệp.
  const [filters, setFilters] = useState({ q: '', tinh: '', kcn: '' });

  const { data } = useQuery({
    queryKey: ['tuyen-dung'],
    queryFn: () => api.get('/tuyen-dung'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: thongKeRes } = useQuery({
    queryKey: ['tuyen-dung-thong-ke'],
    queryFn: () => api.get('/tuyen-dung/thong-ke'),
    staleTime: 5 * 60 * 1000,
  });

  const congTyList = toArr(data?.data);
  const thongKe = thongKeRes?.data ?? null;

  // Suy ra tỉnh/thành & KCN từ địa chỉ thật; danh sách option chỉ gồm nơi có công ty.
  const { items, tinhOptions, kcnOptions } = useMemo(
    () => phanTichDiaDiem(congTyList),
    [congTyList],
  );

  // Lọc client theo từ khoá (tên/địa chỉ) + tỉnh + KCN đã chọn.
  const congTyLoc = useMemo(() => {
    const q = boDau(filters.q);
    const tinhKey = boDau(filters.tinh);
    const kcnKey = boDau(filters.kcn);
    return items.filter((ct) => {
      if (tinhKey && boDau(ct._tinh) !== tinhKey) return false;
      if (kcnKey && boDau(ct._kcn) !== kcnKey) return false;
      if (q && !boDau(ct.ten_cong_ty).includes(q) && !boDau(ct.dia_chi).includes(q)) return false;
      return true;
    });
  }, [items, filters]);

  const coFilter = !!(filters.q || filters.tinh || filters.kcn);
  // Chỉ hiển thị công ty thật đang tuyển (đã lọc); không còn fallback dữ liệu mẫu.
  const jobs = congTyLoc.map(companyToJob);
  const companies = congTyLoc.map(companyToBrand);

  const toggleSave = (id) => setSaved((s) => ({ ...s, [id]: !s[id] }));

  const openView = (type, item) => {
    setView({ type, item });
    setMenuOpen(false);
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
  };
  const goHome = () => openView('home', null);

  const detail = buildDetail(view);
  const isHome = view.type === 'home';

  return (
    <ThemeScope storageKey="theme_tuyen_dung" className="sf-home" style={root}>
      <Header
        isLoggedIn={isLoggedIn}
        onNav={navigate}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      {isHome ? (
        <>
          <Hero
            thongKe={thongKe}
            filters={filters}
            onFilters={setFilters}
            tinhOptions={tinhOptions}
            kcnOptions={kcnOptions}
          />
          <JobsSection
            jobs={jobs}
            saved={saved}
            onSave={toggleSave}
            onOpen={(jb) => openView('company', jb)}
            emptyText={coFilter ? 'Không có công ty nào khớp bộ lọc.' : 'Hiện chưa có công ty nào đang tuyển dụng.'}
          />
          <CompaniesSection
            companies={companies}
            onOpen={(co) => openView('company', co)}
            emptyText={coFilter ? 'Không có doanh nghiệp nào khớp bộ lọc.' : 'Chưa có doanh nghiệp nào đang tuyển dụng.'}
          />
          <EmployerCta onCta={() => navigate(isLoggedIn ? '/quan-ly' : '/login')} />
        </>
      ) : (
        <Detail detail={detail} saved={saved} onSave={toggleSave} onBack={goHome} />
      )}

      <Footer />
    </ThemeScope>
  );
}

const root = {
  minHeight: '100vh',
  background: 'var(--sf-bg)',
  color: 'var(--sf-text)',
  fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
};
