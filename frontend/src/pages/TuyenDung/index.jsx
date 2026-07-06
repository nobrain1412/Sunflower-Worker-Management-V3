import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { ThemeScope } from '../../context/ThemeContext';
import {
  CATEGORIES, MOCK_JOBS, MOCK_COMPANIES,
  companyToJob, companyToBrand, salaryText, mono, pickColor, toArr,
} from './tuyenDungData';
import Header from './Header';
import Hero from './Hero';
import Carousel from './Carousel';
import { CategoriesSection, JobsSection, CompaniesSection, EmployerCta } from './Sections';
import Detail from './Detail';
import Footer from './Footer';

// Trang tuyển dụng CÔNG KHAI (homepage) — dựng theo thiết kế Sunflower.
// Marketing chrome (banner, ngành nghề, thống kê) dùng dữ liệu mẫu; phần việc làm /
// công ty lấy từ /api/tuyen-dung khi có, tự rơi về dữ liệu mẫu để trang luôn đầy đủ.

// Dữ liệu mẫu cho phần việc làm ở trang chi tiết ngành nghề / công ty (không có data thật).
function genMockJobs(item, isCo, viewType) {
  const locs = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Bình Dương', 'Cần Thơ', 'Làm từ xa'];
  const sals = ['10 – 15 triệu', '15 – 22 triệu', '20 – 30 triệu', 'Thỏa thuận', '12 – 18 triệu', '8 – 12 triệu'];
  const tags = ['Toàn thời gian', 'Hybrid', 'Remote', 'Đi làm ngay', 'Ca xoay', 'Có thưởng KPI'];
  const roles = ['Nhân viên', 'Chuyên viên', 'Trưởng nhóm', 'Quản lý', 'Thực tập sinh', 'Giám sát'];
  const fields = ['Kinh doanh', 'Marketing', 'Kế toán', 'Nhân sự', 'Kỹ thuật', 'CSKH'];
  return Array.from({ length: 6 }, (_, i) => {
    const company = isCo ? item.name : MOCK_COMPANIES[i % MOCK_COMPANIES.length].name;
    const title = isCo
      ? roles[i % roles.length] + ' ' + fields[i % fields.length]
      : roles[i % roles.length] + ' ' + item.name.split(/[/-]/)[0].trim();
    return {
      id: viewType + '-' + (item.key || item.name) + '-' + i,
      title, company,
      salary: sals[i % sals.length],
      location: locs[i % locs.length],
      tag: tags[i % tags.length],
      mono: isCo ? item.mono : mono(company),
      color: isCo ? item.color : pickColor(i + 1),
    };
  });
}

// Dựng object chi tiết (thật hoặc mẫu) từ view đang chọn.
function buildDetail(view) {
  if (!view || view.type === 'home') return null;
  const { item, type } = view;
  const isCo = type === 'company';

  if (item.real && item.congTy) {
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

  return {
    kindLabel: isCo ? 'Nhà tuyển dụng' : 'Ngành nghề',
    title: item.name,
    mono: item.mono,
    bg: `linear-gradient(120deg, ${item.color} 0%, #2c4a8a 115%)`,
    meta: isCo ? (item.subtitle || 'Uy tín') : (item.count + ' việc làm đang mở'),
    desc: isCo
      ? `${item.name} là một trong những doanh nghiệp tuyển dụng năng động trên Sunflower, mang đến môi trường làm việc chuyên nghiệp và lộ trình phát triển rõ ràng.`
      : `Khám phá các cơ hội việc làm ngành ${item.name} từ hàng trăm doanh nghiệp uy tín, cập nhật mỗi ngày trên Sunflower.`,
    tags: isCo
      ? ['Quy mô lớn', 'Thưởng hấp dẫn', 'Bảo hiểm đầy đủ', 'Đào tạo bài bản']
      : ['Lương cạnh tranh', 'Nhiều cấp bậc', 'Tuyển gấp', 'Toàn quốc'],
    phone: null,
    listTitle: isCo ? 'Vị trí đang tuyển tại ' + item.name : 'Việc làm ngành ' + item.name,
    jobs: genMockJobs(item, isCo, type),
  };
}

export default function TuyenDung() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState({});
  const [view, setView] = useState({ type: 'home' });

  const { data } = useQuery({
    queryKey: ['tuyen-dung'],
    queryFn: () => api.get('/tuyen-dung'),
    staleTime: 5 * 60 * 1000,
  });

  const congTyList = toArr(data?.data);
  // Có công ty thật đang tuyển → dùng data thật, ngược lại rơi về mẫu cho đủ trang.
  const jobs = congTyList.length ? congTyList.map(companyToJob) : MOCK_JOBS;
  const companies = congTyList.length ? congTyList.map(companyToBrand) : MOCK_COMPANIES;

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
          <Hero />
          <Carousel />
          <CategoriesSection categories={CATEGORIES} onOpen={(ct) => openView('category', ct)} />
          <JobsSection jobs={jobs} saved={saved} onSave={toggleSave} onOpen={(jb) => openView('company', jb)} />
          <CompaniesSection companies={companies} onOpen={(co) => openView('company', co)} />
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
