/**
 * ProvinceSelect — chọn tỉnh/huyện/xã cascading
 * Props:
 *   value: string (tên ghép: "Tên Xã, Tên Huyện, Tên Tỉnh")
 *   onChange: (fullText: string) => void
 */
import { useState, useEffect } from 'react';
import { useTinhList, useHuyenList, useXaList } from '../hooks/useProvinces';

export default function ProvinceSelect({ onChange, placeholder = 'Chọn tỉnh/huyện/xã' }) {
  const [tinhCode,  setTinhCode]  = useState('');
  const [huyenCode, setHuyenCode] = useState('');
  const [xaCode,    setXaCode]    = useState('');

  const { data: tinhList = [], isLoading: loadingTinh } = useTinhList();
  const { data: huyenList = [] } = useHuyenList(tinhCode);
  const { data: xaList = [] }    = useXaList(huyenCode);

  // Khi thay đổi bất kỳ cấp nào → build lại chuỗi và callback
  useEffect(() => {
    const tinh  = tinhList.find((t) => String(t.code) === tinhCode);
    const huyen = huyenList.find((h) => String(h.code) === huyenCode);
    const xa    = xaList.find((x)   => String(x.code) === xaCode);

    const parts = [];
    if (xa)    parts.push(xa.name);
    if (huyen) parts.push(huyen.name);
    if (tinh)  parts.push(tinh.name);
    onChange(parts.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tinhCode, huyenCode, xaCode]);

  function handleTinhChange(e) {
    setTinhCode(e.target.value);
    setHuyenCode('');
    setXaCode('');
  }

  function handleHuyenChange(e) {
    setHuyenCode(e.target.value);
    setXaCode('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        className="form-input"
        value={tinhCode}
        onChange={handleTinhChange}
        disabled={loadingTinh}
      >
        <option value="">{loadingTinh ? 'Đang tải...' : '— Chọn tỉnh/thành —'}</option>
        {tinhList.map((t) => (
          <option key={t.code} value={t.code}>{t.name}</option>
        ))}
      </select>

      {tinhCode && (
        <select className="form-input" value={huyenCode} onChange={handleHuyenChange}>
          <option value="">— Chọn quận/huyện —</option>
          {huyenList.map((h) => (
            <option key={h.code} value={h.code}>{h.name}</option>
          ))}
        </select>
      )}

      {huyenCode && (
        <select className="form-input" value={xaCode} onChange={(e) => setXaCode(e.target.value)}>
          <option value="">— Chọn xã/phường —</option>
          {xaList.map((x) => (
            <option key={x.code} value={x.code}>{x.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
