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

## Tính năng mới

# Dashboard

# Công nhân
- kiểm tra lại phần thêm mỡi công nhân nếu có 2 vender tên gần giống nhau như hồng và hồng nguyễn thì nên xử lý thế nào
- kiểm tra lại khi admin xoá công nhân báo lỗi hệ thống và không thể xoá. lỗi "DELETE https://vieclamsunflower.vn/api/cong-nhan/1 500 (Internal Server Error)"
# Ký túc xá
- trong phần ký túc xá hãy thêm 1 ô để admin có thể phân công những ai có thể sử dụng chức năng ký túc xá
# công ty

# nhân viên
- hiển thị thông tin cá nhân trong chi tiết nhân viên
- cho phép sửa tên đăng nhập
- hãy đảm bảo khi user đổi tên đăng nhập hoặc mã vender không bị ảnh hưởng đến những công nhân được gán đến mã ven đấy
# cộng tác viên
