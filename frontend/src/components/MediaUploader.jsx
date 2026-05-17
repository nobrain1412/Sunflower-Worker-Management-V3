import { useState, useRef } from 'react';
import api from '../hooks/useApi';

/**
 * MediaUploader — quản lý mảng URL ảnh: hiển thị thumbnail + nút thêm + nút xoá.
 * Upload qua endpoint POST /api/upload/image (multipart, field "file").
 *
 * Props:
 *   value:    string[]  — mảng URL ảnh hiện tại
 *   onChange: (urls)=>void
 *   folder:   'ktx' | 'phong-tro' | 'cong-ty'
 *   max:      số ảnh tối đa (default 20)
 */
export default function MediaUploader({ value = [], onChange, folder = 'misc', max = 20 }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const urls = Array.isArray(value) ? value : [];

  async function handleFiles(files) {
    if (!files?.length) return;
    if (urls.length + files.length > max) {
      setErr(`Tối đa ${max} ảnh`);
      return;
    }
    setErr('');
    setUploading(true);
    try {
      const newUrls = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await api.post(`/upload/image?folder=${encodeURIComponent(folder)}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res?.data?.url;
        if (url) newUrls.push(url);
      }
      onChange([...urls, ...newUrls]);
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Upload thất bại');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(idx) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <div style={s.root}>
      <div style={s.grid}>
        {urls.map((u, i) => (
          <div key={`${u}-${i}`} style={s.thumb}>
            <img src={u} alt="" style={s.img} />
            <button type="button" onClick={() => removeAt(i)} style={s.removeBtn} title="Xoá ảnh">×</button>
          </div>
        ))}
        {urls.length < max && (
          <label style={{ ...s.thumb, ...s.addBtn, opacity: uploading ? 0.5 : 1, cursor: uploading ? 'wait' : 'pointer' }}>
            <div style={{ fontSize: 22, color: 'var(--text2)' }}>＋</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{uploading ? 'Đang upload...' : 'Thêm ảnh'}</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            />
          </label>
        )}
      </div>
      {err && <div style={s.err}>{err}</div>}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 },
  thumb: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg3)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    background: 'transparent',
    border: '1.5px dashed var(--border2)',
    flexDirection: 'column',
  },
  err: { fontSize: 11, color: 'var(--red)' },
};
