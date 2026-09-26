import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeScope } from '../context/ThemeContext';
import Header from './TuyenDung/Header';
import Footer from './TuyenDung/Footer';

// Trang CHÍNH SÁCH công khai: Chính sách bảo mật + Điều khoản sử dụng + Hướng dẫn xóa dữ liệu.
// URL: /chinh-sach  (anchor: #bao-mat, #dieu-khoan, #xoa-du-lieu)
// Alias: /chinh-sach-bao-mat, /dieu-khoan-su-dung (khai báo trong App.jsx).
// ⚠️ Kiểm tra lại thông tin pháp nhân trong THONG_TIN trước khi công bố chính thức.

const THONG_TIN = {
  tenDonVi: 'Sunflower JSC',
  thuongHieu: 'Việc làm Sunflower',
  website: 'https://vieclamsunflower.vn',
  email: 'hotro@sunflower.vn',
  hotline: '1900 6868',
  ngayHieuLuc: '26/09/2026',
};

const MUC_LUC = [
  { id: 'bao-mat', label: 'Chính sách bảo mật' },
  { id: 'dieu-khoan', label: 'Điều khoản sử dụng' },
  { id: 'xoa-du-lieu', label: 'Yêu cầu xóa dữ liệu' },
  { id: 'lien-he', label: 'Liên hệ' },
];

export default function ChinhSach() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { isLoggedIn } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = `Chính sách & Điều khoản — ${THONG_TIN.thuongHieu}`;
  }, []);

  // Cuộn tới đúng mục khi mở bằng link có anchor (vd /chinh-sach#bao-mat).
  useEffect(() => {
    const id = (hash || '').replace('#', '');
    if (!id) { try { window.scrollTo(0, 0); } catch { /* ignore */ } return; }
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    return () => clearTimeout(t);
  }, [hash]);

  const goTo = (id) => (e) => {
    e.preventDefault();
    navigate({ pathname: '/chinh-sach', hash: '#' + id }, { replace: true });
  };

  return (
    <ThemeScope storageKey="theme_tuyen_dung" className="sf-home" style={s.root}>
      <Header
        isLoggedIn={isLoggedIn}
        onNav={navigate}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <div style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.kicker}>Pháp lý & quyền riêng tư</div>
          <h1 style={s.h1}>Chính sách & Điều khoản</h1>
          <p style={s.lead}>
            Trang này giải thích cách {THONG_TIN.thuongHieu} thu thập, sử dụng và bảo vệ dữ liệu
            cá nhân, cùng các điều khoản khi bạn sử dụng website {THONG_TIN.website.replace('https://', '')}.
          </p>
          <div style={s.meta}>Có hiệu lực từ ngày {THONG_TIN.ngayHieuLuc}</div>
        </div>
      </div>

      <div className="sf-policy-grid" style={s.grid}>
        <aside className="sf-policy-toc" style={s.toc}>
          <div style={s.tocTitle}>Mục lục</div>
          {MUC_LUC.map((m) => (
            <a key={m.id} href={'#' + m.id} onClick={goTo(m.id)} className="sf-footlink" style={s.tocLink}>
              {m.label}
            </a>
          ))}
        </aside>

        <main style={s.main}>
          {/* ───────────────── CHÍNH SÁCH BẢO MẬT ───────────────── */}
          <Section id="bao-mat" title="Chính sách bảo mật">
            <P>
              {THONG_TIN.tenDonVi} (“Sunflower”, “chúng tôi”) vận hành website tuyển dụng
              {' '}{THONG_TIN.thuongHieu} và hệ thống quản lý người lao động đi kèm. Chúng tôi xử lý
              dữ liệu cá nhân theo quy định của pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, bao gồm
              Nghị định 13/2023/NĐ-CP và các văn bản sửa đổi, thay thế.
            </P>

            <H3>1. Dữ liệu chúng tôi thu thập</H3>
            <Ul items={[
              <><b>Khách truy cập trang tuyển dụng:</b> bạn có thể xem tin tuyển dụng mà không cần đăng ký. Chúng tôi không yêu cầu bạn cung cấp thông tin cá nhân để xem tin.</>,
              <><b>Tra cứu ngày công:</b> mã chấm công bạn nhập để xem ngày công của chính mình.</>,
              <><b>Người lao động do Sunflower quản lý / giới thiệu việc làm:</b> họ tên, ngày sinh, số và ảnh CCCD/VNeID, số điện thoại, quê quán, địa chỉ, thông tin tài khoản ngân hàng nhận lương, nơi làm việc được phân công, dữ liệu chấm công (ngày công, ca, tăng ca), lương, tạm ứng, khấu trừ và thông tin chỗ ở ký túc xá (nếu có).</>,
              <><b>Tài khoản nội bộ (nhân viên, cộng tác viên, đối tác):</b> tên đăng nhập, họ tên, số điện thoại và mật khẩu (được lưu dưới dạng đã mã hóa, chúng tôi không đọc được).</>,
              <><b>Dữ liệu kỹ thuật:</b> cookie đăng nhập, lựa chọn giao diện sáng/tối lưu trên trình duyệt, nhật ký truy cập máy chủ (địa chỉ IP, thời gian, trình duyệt) phục vụ bảo mật.</>,
            ]} />

            <H3>2. Mục đích sử dụng</H3>
            <Ul items={[
              'Kết nối người lao động với doanh nghiệp đang tuyển dụng.',
              'Lập và quản lý hồ sơ lao động, phân công nơi làm việc, chấm công, tính và chi trả lương.',
              'Quản lý chỗ ở ký túc xá và các khoản thu chi liên quan.',
              'Liên hệ, hỗ trợ và thông báo thông tin liên quan đến công việc.',
              'Bảo đảm an toàn hệ thống, phòng chống gian lận và tuân thủ nghĩa vụ pháp lý.',
            ]} />
            <P>Chúng tôi không bán dữ liệu cá nhân của bạn và không dùng dữ liệu cho mục đích khác với mục đích đã nêu khi chưa có sự đồng ý của bạn.</P>

            <H3>3. Chia sẻ dữ liệu</H3>
            <P>Dữ liệu chỉ được chia sẻ trong phạm vi cần thiết với:</P>
            <Ul items={[
              'Doanh nghiệp nơi bạn được giới thiệu hoặc phân công làm việc — để tiếp nhận và quản lý công việc.',
              'Ngân hàng — để chi trả lương khi bạn chọn nhận lương qua tài khoản.',
              'Nhà cung cấp hạ tầng kỹ thuật (máy chủ, lưu trữ, dịch vụ nhận dạng ký tự từ ảnh giấy tờ) — chỉ xử lý dữ liệu theo chỉ dẫn của chúng tôi.',
              'Cơ quan nhà nước có thẩm quyền — khi pháp luật yêu cầu.',
            ]} />

            <H3>4. Bảo mật dữ liệu</H3>
            <Ul items={[
              'Kết nối được mã hóa (HTTPS); mật khẩu được băm, không lưu dạng đọc được.',
              'Phân quyền theo vai trò: mỗi tài khoản chỉ xem được phần dữ liệu cần cho công việc của mình.',
              'Phiên đăng nhập có thời hạn; hồ sơ bị xóa được đánh dấu và hạn chế truy cập.',
              'Sao lưu định kỳ để phòng mất mát dữ liệu.',
            ]} />
            <P>Không có hệ thống nào an toàn tuyệt đối. Nếu xảy ra sự cố lộ lọt dữ liệu, chúng tôi sẽ thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định.</P>

            <H3>5. Thời gian lưu trữ</H3>
            <P>
              Chúng tôi lưu dữ liệu trong thời gian bạn còn làm việc hoặc còn sử dụng dịch vụ, và sau
              đó trong thời hạn pháp luật yêu cầu (ví dụ chứng từ lương, kế toán). Hết thời hạn, dữ
              liệu được xóa hoặc ẩn danh hóa.
            </P>

            <H3>6. Quyền của bạn</H3>
            <P>Với tư cách chủ thể dữ liệu, bạn có quyền:</P>
            <Ul items={[
              'Được biết về việc xử lý dữ liệu của mình.',
              'Đồng ý hoặc rút lại sự đồng ý.',
              'Truy cập, xem và yêu cầu chỉnh sửa dữ liệu không chính xác.',
              'Yêu cầu xóa dữ liệu hoặc hạn chế xử lý dữ liệu (trừ trường hợp pháp luật yêu cầu lưu giữ).',
              'Phản đối việc xử lý dữ liệu; khiếu nại, tố cáo theo quy định pháp luật.',
            ]} />
            <P>Xem cách gửi yêu cầu tại mục <a href="#xoa-du-lieu" onClick={goTo('xoa-du-lieu')} style={s.a}>Yêu cầu xóa dữ liệu</a>.</P>

            <H3>7. Cookie và lưu trữ trên trình duyệt</H3>
            <P>
              Chúng tôi dùng cookie cần thiết để duy trì phiên đăng nhập an toàn và lưu lựa chọn
              giao diện của bạn trên trình duyệt. Bạn có thể xóa cookie trong cài đặt trình duyệt;
              khi đó bạn có thể phải đăng nhập lại.
            </P>

            <H3>8. Trẻ em</H3>
            <P>
              Website không hướng tới trẻ em. Chúng tôi không chủ động thu thập dữ liệu của người
              dưới 16 tuổi; nếu phát hiện, dữ liệu sẽ được xóa trừ khi có sự đồng ý hợp lệ của cha,
              mẹ hoặc người giám hộ theo quy định.
            </P>

            <H3>9. Thay đổi chính sách</H3>
            <P>Chính sách có thể được cập nhật. Phiên bản mới có hiệu lực từ ngày đăng trên trang này; các thay đổi quan trọng sẽ được thông báo rõ.</P>
          </Section>

          {/* ───────────────── ĐIỀU KHOẢN SỬ DỤNG ───────────────── */}
          <Section id="dieu-khoan" title="Điều khoản sử dụng">
            <H3>1. Chấp nhận điều khoản</H3>
            <P>Khi truy cập và sử dụng {THONG_TIN.thuongHieu}, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng website.</P>

            <H3>2. Thông tin tuyển dụng</H3>
            <Ul items={[
              'Tin tuyển dụng được tổng hợp từ các doanh nghiệp đối tác. Mức lương, phúc lợi hiển thị mang tính tham khảo và được xác nhận cụ thể khi phỏng vấn, ký hợp đồng.',
              'Sunflower cố gắng kiểm tra thông tin nhưng không bảo đảm mọi tin luôn đầy đủ, chính xác tại mọi thời điểm.',
              'Sunflower không yêu cầu người lao động chuyển tiền đặt cọc để được nhận việc qua website. Nếu có người nhân danh Sunflower yêu cầu điều này, vui lòng báo ngay cho chúng tôi.',
            ]} />

            <H3>3. Tài khoản</H3>
            <Ul items={[
              'Tài khoản nội bộ chỉ dành cho người được Sunflower cấp quyền.',
              'Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động dưới tài khoản của mình.',
              'Chúng tôi có thể khóa tài khoản vi phạm điều khoản hoặc có dấu hiệu bị chiếm quyền.',
            ]} />

            <H3>4. Hành vi không được phép</H3>
            <Ul items={[
              'Cung cấp thông tin giả mạo, mạo danh người khác hoặc doanh nghiệp khác.',
              'Truy cập trái phép, dò quét, làm gián đoạn hệ thống.',
              'Thu thập dữ liệu của người khác từ website khi chưa được phép.',
              'Đăng tải nội dung phân biệt đối xử, lừa đảo hoặc vi phạm pháp luật.',
            ]} />

            <H3>5. Sở hữu trí tuệ</H3>
            <P>Tên, logo và nội dung do Sunflower tạo ra thuộc quyền sở hữu của {THONG_TIN.tenDonVi}. Không sao chép, sử dụng cho mục đích thương mại khi chưa được chấp thuận bằng văn bản.</P>

            <H3>6. Giới hạn trách nhiệm</H3>
            <P>Sunflower là bên kết nối và hỗ trợ quản lý. Quan hệ lao động, điều kiện làm việc và nghĩa vụ trả lương được xác lập theo hợp đồng giữa người lao động và đơn vị sử dụng lao động, trừ khi có thỏa thuận khác bằng văn bản.</P>

            <H3>7. Luật áp dụng</H3>
            <P>Điều khoản được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp được ưu tiên giải quyết bằng thương lượng; nếu không thành, sẽ đưa ra cơ quan có thẩm quyền tại Việt Nam.</P>
          </Section>

          {/* ───────────────── XÓA DỮ LIỆU ───────────────── */}
          <Section id="xoa-du-lieu" title="Yêu cầu xóa dữ liệu">
            <P>Bạn có thể yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân của mình (kể cả dữ liệu phát sinh khi bạn tương tác với trang Facebook, TikTok của {THONG_TIN.thuongHieu}) theo các bước:</P>
            <ol style={s.ol}>
              <li>Gửi email tới <a href={'mailto:' + THONG_TIN.email} style={s.a}>{THONG_TIN.email}</a> với tiêu đề <b>“Yêu cầu xóa dữ liệu”</b>, hoặc gọi hotline {THONG_TIN.hotline}.</li>
              <li>Cung cấp họ tên và số điện thoại đã đăng ký để chúng tôi xác minh đúng người.</li>
              <li>Chúng tôi phản hồi trong vòng 72 giờ và hoàn tất yêu cầu trong thời hạn luật định, trừ dữ liệu bắt buộc phải lưu giữ (ví dụ chứng từ lương, kế toán).</li>
            </ol>
          </Section>

          {/* ───────────────── LIÊN HỆ ───────────────── */}
          <Section id="lien-he" title="Liên hệ">
            <div style={s.card}>
              <div><b>{THONG_TIN.tenDonVi}</b> — {THONG_TIN.thuongHieu}</div>
              <div>Website: <a href={THONG_TIN.website} style={s.a}>{THONG_TIN.website.replace('https://', '')}</a></div>
              <div>Email: <a href={'mailto:' + THONG_TIN.email} style={s.a}>{THONG_TIN.email}</a></div>
              <div>Hotline: {THONG_TIN.hotline}</div>
            </div>
          </Section>
        </main>
      </div>

      <Footer />
    </ThemeScope>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} style={s.section}>
      <h2 style={s.h2}>{title}</h2>
      {children}
    </section>
  );
}
const H3 = ({ children }) => <h3 style={s.h3}>{children}</h3>;
const P = ({ children }) => <p style={s.p}>{children}</p>;
const Ul = ({ items }) => (
  <ul style={s.ul}>{items.map((it, i) => <li key={i} style={s.li}>{it}</li>)}</ul>
);

const s = {
  root: {
    minHeight: '100vh',
    background: 'var(--sf-bg)',
    color: 'var(--sf-text)',
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
  },
  hero: { background: 'var(--sf-herobg)', borderBottom: '1px solid var(--sf-brd)' },
  heroInner: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(32px,6vw,64px) 20px' },
  kicker: { fontSize: 13, fontWeight: 700, color: 'var(--sf-navy)', textTransform: 'uppercase', letterSpacing: '.5px' },
  h1: { margin: '8px 0 12px', fontSize: 'clamp(28px,4.5vw,42px)', fontWeight: 800, letterSpacing: '-.5px', lineHeight: 1.15 },
  lead: { margin: 0, maxWidth: 680, fontSize: 16, lineHeight: 1.7, color: 'var(--sf-muted)' },
  meta: { marginTop: 14, fontSize: 13, color: 'var(--sf-muted)' },
  grid: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(24px,4vw,44px) 20px 0', display: 'grid', gap: 40 },
  toc: { alignSelf: 'start', position: 'sticky', top: 84, display: 'flex', flexDirection: 'column', gap: 4 },
  tocTitle: { fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 },
  tocLink: { fontSize: 14, color: 'var(--sf-muted)', textDecoration: 'none', padding: '6px 0' },
  main: { minWidth: 0, maxWidth: 760 },
  section: { scrollMarginTop: 84, paddingBottom: 28, marginBottom: 28, borderBottom: '1px solid var(--sf-brd)' },
  h2: { margin: '0 0 14px', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, color: 'var(--sf-navy)' },
  h3: { margin: '24px 0 8px', fontSize: 17, fontWeight: 700 },
  p: { margin: '0 0 12px', fontSize: 15, lineHeight: 1.75 },
  ul: { margin: '0 0 12px', paddingLeft: 22, listStyle: 'disc' },
  ol: { margin: '0 0 12px', paddingLeft: 22, listStyle: 'decimal', fontSize: 15, lineHeight: 1.75 },
  li: { fontSize: 15, lineHeight: 1.75, marginBottom: 6 },
  a: { color: 'var(--sf-navy)', fontWeight: 600 },
  card: {
    background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)', borderRadius: 12,
    padding: '16px 18px', fontSize: 15, lineHeight: 1.9,
  },
};
