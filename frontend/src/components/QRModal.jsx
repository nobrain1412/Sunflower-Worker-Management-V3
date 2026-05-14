import { useState } from 'react';
import { NGAN_HANG_LIST, findNganHang, buildQRUrl } from '../constants/nganHang';

// Modal QR đơn giản — dùng cho Vendor/CTV, không nhập số tiền, không ghi lịch sử
export default function QRModal({ nganHang, soTK, tenChuTK, tenNguoiNhan, onClose }) {
  const [showBankMenu, setShowBankMenu] = useState(false);
  const [toast, setToast]               = useState('');

  const bank = findNganHang(nganHang);
  const coNH = !!(nganHang && soTK);

  const qrUrl = coNH ? buildQRUrl({ nganHang, soTK, tenChuTK }) : '';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function copyText(text, label) {
    navigator.clipboard?.writeText(text).then(() => showToast(`Đã sao chép ${label}`));
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function openBankApp(nh) {
    setShowBankMenu(false);
    copyText(soTK, 'STK');
    setTimeout(() => {
      try { window.location.href = nh.scheme; } catch (_) {}
    }, 300);
  }

  return (
    <div style={ov} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={hd}>
          <div style={hdTitle}>QR nhận tiền{tenNguoiNhan ? ` — ${tenNguoiNhan}` : ''}</div>
          <button style={closeBtn} onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {coNH ? (
          <>
            <div style={qrWrap}>
              <img
                src={qrUrl}
                alt="QR ngân hàng"
                style={qrImg}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            <div style={bankBox}>
              <div style={bankName}>{bank?.ten ?? nganHang}</div>
              <div style={stkRow}>
                <span style={stk}>{soTK}</span>
                <button style={copyBtn} onClick={() => copyText(soTK, 'STK')}>Sao chép STK</button>
              </div>
              {tenChuTK && <div style={tenTK}>{tenChuTK}</div>}
            </div>

            <div style={{ position: 'relative', marginBottom: 20 }}>
              <button style={openAppBtn} onClick={() => setShowBankMenu((v) => !v)}>
                Mở app ngân hàng ▾
              </button>
              {showBankMenu && (
                <div style={bankMenu}>
                  {NGAN_HANG_LIST.map((nh) => (
                    <button
                      key={nh.ma}
                      style={bankMenuItem}
                      onClick={() => openBankApp(nh)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {nh.ten}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={noBank}>
            Chưa có thông tin ngân hàng<br />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Liên hệ quản trị để cập nhật</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Đóng</button>
        </div>

        {toast && <div style={toastStyle}>{toast}</div>}
      </div>
    </div>
  );
}

const ov      = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 };
const modal   = { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', position: 'relative' };
const hd      = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 };
const hdTitle = { fontSize: 15, fontWeight: 700, color: 'var(--text1)' };
const closeBtn = { background: 'none', border: 'none', color: 'var(--text2)', fontSize: 16, cursor: 'pointer', padding: '0 4px' };

const qrWrap  = { display: 'flex', justifyContent: 'center', marginBottom: 16 };
const qrImg   = { width: 210, height: 210, borderRadius: 12, border: '1px solid var(--border2)', background: '#fff' };

const bankBox  = { background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 };
const bankName = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
const stkRow   = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
const stk      = { fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 };
const tenTK    = { fontSize: 12, color: 'var(--text2)', marginTop: 4 };
const copyBtn  = { fontSize: 11, padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' };

const openAppBtn  = { width: '100%', padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 13, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 600 };
const bankMenu    = { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 10, zIndex: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 };
const bankMenuItem = { display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text1)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'background 0.1s' };

const noBank = { textAlign: 'center', padding: '32px 20px', color: 'var(--amber)', fontSize: 14, fontWeight: 600, background: 'rgba(255,179,68,0.08)', borderRadius: 12, marginBottom: 20, lineHeight: 1.6 };
const toastStyle = { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 18px', fontSize: 13, color: 'var(--text1)', zIndex: 300, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' };
