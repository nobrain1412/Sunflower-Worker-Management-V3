import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN'); }

// Đơn giá thưởng theo từng công ty cho 1 vender hoặc CTV
export default function UserRatesPanel({ userId, vaiTro }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const isVender = vaiTro === 'vender';

  const ratesQ = useQuery({
    queryKey: ['user-rates', userId],
    queryFn:  () => api.get(`/users/${userId}/rates`).then((r) => r.data ?? []),
  });

  const ctysQ = useQuery({
    queryKey: ['cong-ty-list-min'],
    queryFn:  () => api.get('/cong-ty', { params: { limit: 100 } }).then((r) => r.data ?? []),
    enabled:  isAdmin,
  });

  const upsert = useMutation({
    mutationFn: ({ congTyId, body }) => api.put(`/users/${userId}/rates/${congTyId}`, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['user-rates', userId] }),
  });
  const remove = useMutation({
    mutationFn: (congTyId) => api.delete(`/users/${userId}/rates/${congTyId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['user-rates', userId] }),
  });

  const [editing, setEditing] = useState({});
  const [addId, setAddId] = useState('');

  useEffect(() => { setEditing({}); setAddId(''); }, [userId]);

  const rates = ratesQ.data ?? [];
  const existing = useMemo(() => new Set(rates.map((r) => r.cong_ty_id)), [rates]);
  const candidates = (ctysQ.data ?? []).filter((c) => !existing.has(c.id));

  function startEdit(r) {
    setEditing((s) => ({
      ...s,
      [r.cong_ty_id]: {
        don_gia_theo_gio:    r.don_gia_theo_gio    ?? 0,
        tien_cong_moi_nguoi: r.tien_cong_moi_nguoi ?? 0,
      },
    }));
  }
  function cancel(id) { setEditing((s) => { const n = { ...s }; delete n[id]; return n; }); }

  async function save(id) {
    await upsert.mutateAsync({
      congTyId: id,
      body: {
        don_gia_theo_gio:    Number(editing[id].don_gia_theo_gio    || 0),
        tien_cong_moi_nguoi: Number(editing[id].tien_cong_moi_nguoi || 0),
      },
    });
    cancel(id);
  }

  async function handleAdd() {
    if (!addId) return;
    const id = Number(addId);
    await upsert.mutateAsync({ congTyId: id, body: { don_gia_theo_gio: 0, tien_cong_moi_nguoi: 0 } });
    setAddId('');
    setTimeout(() => startEdit({ cong_ty_id: id, don_gia_theo_gio: 0, tien_cong_moi_nguoi: 0 }), 0);
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Đơn giá thưởng theo công ty {isVender ? '(đơn giá / giờ)' : '(tiền / người tuyển)'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        Mỗi công ty 1 mức khác nhau. {isAdmin ? '' : 'Liên hệ admin để thiết lập.'}
      </div>

      {ratesQ.isLoading && <div style={{ color: 'var(--text2)', fontSize: 13 }}>Đang tải...</div>}
      {!ratesQ.isLoading && rates.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa thiết lập đơn giá ở công ty nào.</div>
      )}

      {rates.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text3)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Công ty</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>
                {isVender ? 'Đơn giá / giờ' : 'Tiền / người'}
              </th>
              {isAdmin && <th style={{ padding: '6px 8px', width: 160 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const ed = editing[r.cong_ty_id];
              const key = isVender ? 'don_gia_theo_gio' : 'tien_cong_moi_nguoi';
              const display = isVender ? r.don_gia_theo_gio : r.tien_cong_moi_nguoi;
              return (
                <tr key={r.cong_ty_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px' }}>{r.ten_cong_ty}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                    {ed ? (
                      <input type="number" className="form-input" style={{ width: 130, textAlign: 'right' }}
                        value={ed[key]}
                        onChange={(e) => setEditing((s) => ({ ...s, [r.cong_ty_id]: { ...s[r.cong_ty_id], [key]: e.target.value } }))} />
                    ) : fmt(display) + 'đ'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {ed ? (
                        <>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => save(r.cong_ty_id)} disabled={upsert.isPending}>Lưu</button>
                          <button className="btn-ghost"   style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => cancel(r.cong_ty_id)}>Hủy</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }} onClick={() => startEdit(r)}>Sửa</button>
                          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }}
                            onClick={() => { if (window.confirm(`Xoá đơn giá ở "${r.ten_cong_ty}"?`)) remove.mutate(r.cong_ty_id); }}>Xoá</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isAdmin && candidates.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <select className="form-input" style={{ flex: 1 }} value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">— Chọn công ty để thêm —</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>)}
          </select>
          <button className="btn-primary" onClick={handleAdd} disabled={!addId || upsert.isPending}>+ Thêm</button>
        </div>
      )}
    </div>
  );
}
