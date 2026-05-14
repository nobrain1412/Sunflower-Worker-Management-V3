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
- ở giao diện điện thoại, bỏ menu ngang nằm dưới, nó làm khuất mất các của sổ phụ của form
- thêm nút đăng xuất cho điện thoại
## Tính năng mới
- thêm tab cộng tác viên cho quản lý và admin. quản lý có thể thêm sửa xoá danh sách cộng tác viên của mình, đặt tiền thưởng/người với mỗi cộng tác viên, dự kiến số tiền cần thanh toán. có 2 hình thức thanh toán, lấy 1 lần, khi công nhân làm đủ 26 ngày công sẽ đủ điều kiện để thanh toán, 1 công nhân chỉ được nhận thưởng 1 lần . nhận hàng tháng, lấy base là tiền thưởng/người, tính ra đơn giá mỗi giờ bằng công thức (tiền thưởng/26/8) để tính ra tiền mỗi giờ, cuối tháng sẽ thanh toán theo số giờ công nhân làm được và được tính hàng tháng 
# Dashboard

# Công nhân
- thay ảnh đại diện ở trên danh sách công nhân thành ảnh chân dung của công nhân đó
- trong chi tiết công nhân, khi ấn vào ảnh cccd hoặc ảnh chân dung sẽ có thể xem chi tiết ảnh đó. thêm trạng thái mượn xe bao gồm xe máy, xe đạp, xe đạp điện và không mượn xe, đối với những người có mượn xe sẽ hiện ảnh của chiếc xe và ngày mượn, trạng thái đã trả xe chưa có thể toggle trong thông tin cá nhân luôn
# Ký túc xá
- chỗ xếp phòng hãy để thanh search kèm gợi ý theo input nhập vào. chỉ có thể xếp phòng cho các công nhân chưa có chỗ ở, công nhân sẽ có thêm trạng thái phòng gồm chưa có phòng, tự túc chỗ ở và danh sách các nhà trọ + ký túc xá mà user đó được phép truy cập
# công ty
- công ty sẽ có thêm định vị được nhúng google map vào
# tài chính

# nhân viên

# cộng tác viên
