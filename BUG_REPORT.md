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
- chữ ký túc xá ở side bar sửa thành Phòng trọ. những thứ bên trong không thay đổi
## Tính năng mới
- thêm cộng tác viên và kế toán
- thêm danh sách user cho admin để quản lý role của các user
- toàn bộ nhân viên, công nhân, chủ trọ đều sẽ thêm thông tin số tài khoản gồm ngân hàng, số tài khoản, tên chủ tài khoản
- cấp quyền thêm sửa xoá user, công nhân, ký túc, phòng trọ, công ty cho admin
# Dashboard
- khi ấn vào tên vender, tên công nhân, tên phòng sẽ redirect sang thông tin chi tiết của vender, công nhân hoặc phòng đó
# Công nhân
- thêm lọc theo tỉnh
- bỏ hệ thống lọc theo ngày hiện tại đi, chỉ lọc theo 1 ngày được chọn và định dạng là dd/mm/yyy
- thêm trạng thái cccd và trạng thái mượn xe trong thông tin công nhân đã trả hay chưa, ở mượn xe sẽ thêm loại phương tiện như xe đạp,xe điện, xe máy nếu trạng thái mượn xe là có mượn
# Ký túc xá
- ở phần hoá đơn giữ lại số điên nước cũ ở các phòng để nối tiếp cho tháng sau, người dùng chỉ nhập số nước tháng tới hệ thống sẽ tự tính ra
# công ty
- thêm đơn giá theo giờ ở từng công ty, đây là tiền công trả cho vender dựa trên số giờ công nhân của vender đó làm việc tại công ty
- thêm trợ cấp, chuyên cần, ngày chốt công
# tài chính
- xoá nút trạng thái hoàn ở các khoản tiêu
- thêm nút xoá cho từng giao dịch, confirm trước khi xoá
# nhân viên
- danh sách nhân viên sẽ bao gồm tên,role, tổng lượng người đang làm, công ty đang quản lý nếu người đó có role quản lý. admin sẽ có thể thêm sửa xoá nhân viên, set role và công ty quản lý cho nhân viên
# cộng tác viên
- bao gồm danh sách cộng tác viên của của admin, thông tin của cộng tác viên sẽ bao gồm tên,số điện thoại, số lượng người tuyển được, tiền công mỗi người, tổng tiền 