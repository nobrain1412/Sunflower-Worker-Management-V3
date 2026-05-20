import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../hooks/useApi';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN'); }

const ROLE_LABEL = { vender: 'Vender', cong_tac_vien: 'CTV' };

// Đơn giá thưởng riêng cho từng vender/CTV ở 1 công ty.
// Vender: don_gia_theo_gio  | CTV: tien_cong_moi_nguoi
export default function RateCongTyPanel({ congTyId, canEdit }) {
  const qc = useQueryClient();

  const ratesQ = useQuery({
    queryKey: ['cong-ty-rates', congTyId],
    queryFn:  () => api.get(`/cong-ty/${congTyId}/rates`).then((r) => r.data ?? []),
    enabled:  !!congTyId,
  });

  // Lấy luôn full danh sách user để admin có thể thêm user chưa có rate
  const usersQ = useQuery({
    queryKey: ['users-vender-ctv'],
    queryFn:  async () => {
      const [v, c] = await Promise.all([
        api.get('/users', { params: { vai_tro: 'vender' } }).then((r) => r.data ?? []),
        api.get('/users', { params: { vai_tro: 'cong_tac_vien' } }).then((r) => r.data ?? []),
      ]);
      return [...v, ...c];
    },
    enabled: canEdit,
    staleTime: 30_000,
  });

  const upsert = useMutation({
    mutationFn: ({ userId, body }) => api.put(`/cong-ty/${congTyId}/rates/${userId}`, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-ty-rates', congTyId] }),
  });

  const remove = useMutation({
    mutationFn: (userId) => api.delete(`/cong-ty/${congTyId}/rates/${userId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-ty-rates', congTyId] }),
  });

  const [editing, setEditing] = useState({}); // { [userId]: { don_gia_theo_gio, tien_cong_moi_nguoi } }
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('vender');

  useEffect(() => { setEditing({}); setAddUserId(''); }, [congTyId]);

  const rates = ratesQ.data ?? [];
  const existingIds = useMemo(() => new Set(rates.map((r) => r.user_id)), [rates]);
  const candidateUsers = (usersQ.data ?? [])
    .filter((u) => !existingIds.has(u.id))
    .filter((u) => u.vai_tro === addRole);

  function startEdit(r) {
    setEditing((s) => ({
      ...s,
      [r.user_id]: {
        don_gia_theo_gio:    r.don_gia_theo_gio    ?? 0,
        tien_cong_moi_nguoi: r.tien_cong_moi_nguoi ?? 0,
      },
    }));
  }

  function cancelEdit(userId) {
    setEditing((s) => { const n = { ...s }; delete n[userId]; return n; });
  }

  async function save(userId) {
    const body = editing[userId];
    await upsert.mutateAsync({
      userId,
      body: {
        don_gia_theo_gio:    Number(body.don_gia_theo_gio    || 0),
        tien_cong_moi_nguoi: Number(body.tien_cong_moi_nguoi || 0),
      },
    });
    cancelEdit(userId);
  }

  async function handleAdd() {
    if (!addUserId) return;
    const userId = Number(addUserId);
    const body = addRole === 'vender'
      ? { don_gia_theo_gio: 0, tien_cong_moi_nguoi: 0 }
      : { don_gia_theo_gio: 0, tien_cong_moi_nguoi: 0 };
    await upsert.mutateAsync({ userId, body });
    setAddUserId('');
    setTimeout(() => startEdit({ user_id: userId, ...body }), 0);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Đơn giá thưởng (vender / CTV)</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mỗi người 1 mức riêng ở công ty này</div>
      </div>

      {ratesQ.isLoading && <div style={{ color: 'var(--text2)', fontSize: 13 }}>Đang tải...</div>}
      {!ratesQ.isLoading && rates.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
          Chưa có đơn giá nào — {canEdit ? 'thêm vender / CTV bên dưới' : 'liên hệ admin để thiết lập'}.
        </div>
      )}

      {rates.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text3)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Người</th>
                <th style={{ padding: '6px 8px' }}>Vai trò</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Đơn giá / giờ (vender)</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tiền / người (CTV)</th>
                {canEdit && <th style={{ padding: '6px 8px', width: 160 }}></th>}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const ed = editing[r.user_id];
                return (
                  <tr key={r.user_id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{r.ho_ten} <span style={{ color: 'var(--text3)', fontSize: 11 }}>({r.ten_dang_nhap})</span></td>
                    <td style={{ padding: '8px', color: 'var(--text2)' }}>{ROLE_LABEL[r.vai_tro] || r.vai_tro}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {ed ? (
                        <input
                          type="number" className="form-input" style={{ width: 110, textAlign: 'right' }}
                          value={ed.don_gia_theo_gio}
                          onChange={(e) => setEditing((s) => ({ ...s, [r.user_id]: { ...s[r.user_id], don_gia_theo_gio: e.target.value } }))}
                          disabled={r.vai_tro !== 'vender'}
                        />
                      ) : (r.vai_tro === 'vender' ? fmt(r.don_gia_theo_gio) + 'đ' : '—')}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {ed ? (
                        <input
                          type="number" className="form-input" style={{ width: 120, textAlign: 'right' }}
                          value={ed.tien_cong_moi_nguoi}
                          onChange={(e) => setEditing((s) => ({ ...s, [r.user_id]: { ...s[r.user_id], tien_cong_moi_nguoi: e.target.value } }))}
                          disabled={r.vai_tro !== 'cong_tac_vien'}
                        />
                      ) : (r.vai_tro === 'cong_tac_vien' ? fmt(r.tien_cong_moi_nguoi) + 'đ' : '—')}
                    </td>
                    {canEdit && (
                      <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {ed ? (
                          <>
                            <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => save(r.user_id)} disabled={upsert.isPending}>Lưu</button>
                            <button className="btn-ghost"   style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => cancelEdit(r.user_id)}>Hủy</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => startEdit(r)}>Sửa</button>
                            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }}
                              onClick={() => { if (window.confirm(`Xoá đơn giá của ${r.ho_ten}?`)) remove.mutate(r.user_id); }}>Xoá</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 120 }} value={addRole} onChange={(e) => { setAddRole(e.target.value); setAddUserId(''); }}>
            <option value="vender">Vender</option>
            <option value="cong_tac_vien">CTV</option>
          </select>
          <select className="form-input" style={{ flex: 1, minWidth: 180 }} value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
            <option value="">— Chọn người để thêm —</option>
            {candidateUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.ho_ten} ({u.ten_dang_nhap})</option>
            ))}
          </select>
          <button className="btn-primary" onClick={handleAdd} disabled={!addUserId || upsert.isPending}>+ Thêm</button>
        </div>
      )}
    </div>
  );
}
