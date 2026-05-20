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
- [x] thêm chức năng to do list — Dashboard widget + category mgmt + assign user/CN
# Dashboard

# Công nhân
- [x] quản lý chưa được gán công ty xem được CN chưa gán công ty — đã fix: filter strict theo cong_ty_ids; nếu rỗng → trả 0 dòng
- [x] thêm nút cho ứng trên trang chi tiết CN + đồng bộ với tài chính + phân quyền theo role
# Ký túc xá

# công ty
- [x] mọi role xem danh sách công ty; quản lý submit form đề xuất ngay trên trang công ty
- [x] mobile: collapse chi tiết công ty, click tên công ty mới mở
# tài chính

# nhân viên

# cộng tác viên
