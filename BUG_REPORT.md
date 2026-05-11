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
- bỏ validate ở password, chỉ cần trên 6 ký tự
- lỗi giao diện bị vỡ khi dùng trên điện thoại
## Tính năng mới

# Dashboard
- khi ấn vào tên vender, tên công nhân, tên phòng sẽ redirect sang thông tin chi tiết của vender, công nhân hoặc phòng đó
# Công nhân
- thêm chức năng thêm mới công nhân bằng cách đọc dữ liệu từ cccd hoặc chụp danh sách viết tay
- tất cả các option lọc dữ liệu được thu vào trong 1 của sổ phụ, của sổ này sẽ hiện lên khi chọn nút lọc dữ liệu
# Ký túc xá
- cho phép vender sử dụng chức năng nhà trọ
- chức năng ký túc xá chỉ dành cho admin
# công ty

# tài chính
- cho phép vender sử dụng chức năng tài chính
# nhân viên

# cộng tác viên
