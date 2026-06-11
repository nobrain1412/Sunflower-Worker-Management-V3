/**
 * Page đề xuất chung gửi admin:
 *   - Mọi user (trừ admin): gửi đề xuất chung (nội dung tự do)
 *   - Quản lý: thêm option đề xuất tạo mới / sửa công ty
 *   - Admin: xem queue + duyệt/từ chối
 *   - (Không có entry cho admin submit — admin sửa trực tiếp ở /cong-ty)
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList } from '../../hooks/useCongNhan';
import DeXuatModal from './DeXuatModal';
import DeXuatChungModal from './DeXuatChungModal';
import DeXuatQueue from './DeXuatQueue';

export default function DeXuatPage() {
  const { user, isAdmin, isQuanLy } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showChung, setShowChung] = useState(false);
  const [editingCongTy, setEditingCongTy] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const allCongTy = useCongTyList().data?.data ?? [];

  // Quản lý chỉ sửa được công ty mình phụ trách → filter picker
  const congTyArr = isQuanLy
    ? allCongTy.filter((ct) => (user?.cong_ty_ids ?? []).includes(ct.id))
    : allCongTy;

  function openEditFor(congTy) {
    setEditingCongTy(congTy);
    setShowPicker(false);
  }

  return (
    <div>
      {!isAdmin && (
        <div style={s.actionBar}>
          <button onClick={() => setShowChung(true)} style={s.btnPrimary}>
            + Đề xuất chung
          </button>
          {isQuanLy && (
            <>
              <button onClick={() => setShowCreate(true)} style={s.btnSecondary}>
                + Đề xuất tạo công ty mới
              </button>
              <button onClick={() => setShowPicker(true)} style={s.btnSecondary}>
                ✎ Đề xuất sửa công ty
              </button>
            </>
          )}
        </div>
      )}

      <DeXuatQueue />

      {showChung && (
        <DeXuatChungModal onClose={() => setShowChung(false)} />
      )}
      {showCreate && (
        <DeXuatModal mode="tao_moi" onClose={() => setShowCreate(false)} />
      )}
      {editingCongTy && (
        <DeXuatModal
          mode="sua_doi"
          congTy={editingCongTy}
          onClose={() => setEditingCongTy(null)}
        />
      )}

      {showPicker && (
        <div style={s.backdrop} onClick={() => setShowPicker(false)}>
          <div style={s.pickerCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.pickerHeader}>
              <h3 style={s.pickerTitle}>Chọn công ty cần sửa</h3>
              <button style={s.closeBtn} onClick={() => setShowPicker(false)}>✕</button>
            </div>
            <div style={s.pickerList}>
              {congTyArr.length === 0 ? (
                <div style={{ padding: 20, color: 'var(--text3)' }}>
                  Bạn chưa quản lý công ty nào.
                </div>
              ) : congTyArr.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => openEditFor(ct)}
                  style={s.pickerItem}
                >
                  <div style={s.pickerName}>{ct.ten_cong_ty}</div>
                  <div style={s.pickerSub}>{ct.dia_chi || '—'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  actionBar: {
    display: 'flex', gap: 10, padding: '24px 24px 0',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnSecondary: {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    color: 'var(--text1)', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },

  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  pickerCard: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '80vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  pickerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderBottom: '1px solid var(--border)',
  },
  pickerTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, fontSize: 16,
  },
  pickerList: { overflowY: 'auto' },
  pickerItem: {
    display: 'block', width: '100%', textAlign: 'left',
    background: 'transparent', border: 'none',
    borderBottom: '1px solid var(--border)',
    padding: '12px 18px', cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  pickerName: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  pickerSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
};
