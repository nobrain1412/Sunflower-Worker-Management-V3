# Bug Report — WorkerOS Test

> Ghi lại lỗi phát hiện trong quá trình test. Chưa fix cho đến khi có yêu cầu.

---

## Cách ghi lỗi

```
### [BUG-XXX] Tên lỗi ngắn gọn
- **Role:**        (admin / tuan_ql / hoa_vender / ...)
- **Trang:**       (Dashboard / Công nhân / Đăng nhập / ...)
- **Mô tả:**       Điều gì xảy ra
- **Kỳ vọng:**     Điều gì nên xảy ra
- **Bước tái hiện:** (nếu cần)
- **Ảnh chụp:**    (nếu có)
```

---

## Danh sách lỗi
- [x] todolist: cho chọn giờ làm — thêm input time
- [x] form đề xuất công ty: bỏ field hệ số OT thừa
## Tính năng mới

# Dashboard

# Công nhân
- [x] quản lý không xem được mượn xe/nơi ở/số tiền ứng của CN trong cty mình — fix: cho admin/QL xem all giao dịch của CN; vender/CTV chỉ thấy CN mình tuyển
- [x] nút Nghỉ việc cạnh thông tin công ty CN → chuyển trang_thai='nghi_viec', xoá cong_ty_id, ghi ngay_nghi_viec
- [x] sửa công ty CN: kết thúc phan_cong cũ + tạo phan_cong mới + confirm + log
# Ký túc xá

# công ty
- [x] thêm cột tiền công cho quản lý (VNĐ/h)
- [x] verify trang công ty hoạt động cho role khác admin (vender/CTV/kế toán/QL)
# tài chính
- [x] click giao dịch → modal chi tiết (loại, số tiền, ngày, ghi chú, người tạo, trạng thái hoàn)
# nhân viên

# cộng tác viên
