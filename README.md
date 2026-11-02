# 🪷 An Nhiên Live

Sân khấu 3D thư giãn, tương tác với người xem TikTok LIVE. Bối cảnh là một chánh điện ấm áp: người xem gõ `adidaphat` thì có nhân vật mang tên và avatar của họ đi lên thắp hương, lạy 3 lạy rồi về chỗ. Ai tặng quà thì máy quay áp sát, sen vàng nở, cánh sen rơi, giọng đọc gọi tên cảm ơn.

> Đây là không gian thư giãn mang tính giải trí, không đại diện cho tổ chức tôn giáo nào. Quà tặng chỉ để nhận lời chúc, không phải cúng dường. Dòng lưu ý này chạy trên màn hình live (có thể tắt trong Cài đặt).

## Cài và chạy (Windows)

1. Cài [Node.js](https://nodejs.org) bản LTS.
2. Bấm đúp **`CHAY-LIVE.bat`**. Lần đầu tự cài thư viện (1–2 phút), sau đó trang điều khiển tự mở ở `http://localhost:3000`.
3. Làm theo **trình hướng dẫn 4 bước** hiện ra lần đầu:
   - Đặt tên kênh (giọng đọc sẽ xưng bằng tên này).
   - Trong TikTok LIVE Studio thêm nguồn **Link**: `http://lvh.me:3000/?view=stage`, kích thước **1080 × 1920**. Trang điều khiển tự báo khi LIVE Studio đã nhận.
   - Bấm “Phát câu thử” để nghe giọng đọc qua đúng đường người xem nghe.
   - Nhập username TikTok và kết nối. Có thể kết nối **trước** khi bấm Phát trực tiếp, app sẽ tự vào phòng khi live bắt đầu.

Giữ cửa sổ `CHAY-LIVE.bat` mở suốt buổi live; đóng nó là tắt app.

## Tính năng

**Trên sân khấu**
- Hội trường 96 chỗ, chỗ trống có người ngồi sẵn, mỗi người tự lạy theo nhịp riêng. Người mới vào xem được xếp chỗ (hàng đầu trước, để không bị khung bình luận TikTok che), có avatar trên đầu và bong bóng chat khi họ bình luận.
- 10 đệm phía trước cho bảng **TOP THÀNH TÂM**; ai lên bảng sẽ tự đi từ chỗ ngồi lên đệm.
- Thắp hương: tối đa 5 người cùng lúc, người sau xếp hàng (hiện avatar hàng chờ), người tặng quà được ưu tiên.
- Quà: máy quay áp sát người tặng, thẻ “Xin cảm ơn”, sen vàng nở, tia sáng vàng; quà lớn có thêm **đèn trời** bay lên.
- Thanh tim dạng vòng sen: đủ số tim là **mưa cánh sen 3D**, có đồng hồ đếm ngược.
- **Phụ đề giọng đọc**: chữ của câu đang đọc hiện trên màn hình, sáng dần theo giọng.
- Hai không khí: Hoàng hôn ấm / Đêm tĩnh lặng. Bảng hoành phi trên điện hiện tên kênh của bạn.

**Khách quý** (Cài đặt → Khách quý)
- Chọn người xem theo username TikTok. Mỗi lần họ vào live: nhân vật mặc **áo màu riêng**, to hơn, có **hào quang vàng** trên đầu, vòng sáng dưới chân, đốm sáng lấp lánh, **bảng tên vàng có vương miện** và danh hiệu (Khách quý, Đạo hữu…), dùng **ảnh đại diện riêng** bạn tải lên.
- Vào live là chuông ngân, được đọc **lời chào riêng** ngay, ngồi hai hàng đầu, gõ từ khóa là được lên thắp hương trước.
- Đang live, rê chuột vào một người trong bảng Hoạt động hoặc TOP rồi bấm 👑 là đặt họ làm khách quý ngay.

**Giọng đọc** (giọng Hoài My hoặc Nam Minh của Microsoft, dự phòng Google)
- Cảm ơn người tặng quà (gộp combo thành 1 câu: “cảm ơn bạn X đã gửi 5 hoa hồng”), luôn đọc trước.
- Chào từng người mới vào, gộp 3 tên một câu; phòng quá đông thì ưu tiên người vào gần nhất.
- Nhận ra điều người xem cầu: thi cử, sức khỏe, tình duyên, gia đình, công việc, tài lộc, đi xa, bình an, và khi ai đó buồn. Chỉ đọc lời chúc, **không bao giờ đọc nguyên văn comment**.
- Cảm ơn theo dõi, chia sẻ; báo khi đủ tim; tự chúc khi live im lặng; định kỳ nhắc chia sẻ kèm tên người vừa trò chuyện.
- Đọc tên “đẹp”: chữ kiểu 𝑵𝒈𝒖𝒚𝒆̂̃𝒏 thành “Nguyễn”, bỏ emoji, tách “ThuTrang2005” thành “Thu Trang hai không không năm”.

**Trang điều khiển**
- Bảng **Hoạt động** realtime: lọc theo bình luận/quà/vào xem, tìm kiếm, nhãn “thắp hương” và loại lời cầu. Rê chuột vào một dòng để mời lên thắp hương, đọc lời chúc riêng, xếp chỗ, hoặc chặn.
- **Hàng đợi giọng đọc**: xem câu đang đọc (có thanh tiến độ), các câu sắp đọc; tạm dừng, bỏ qua, xóa từng câu.
- **Đọc lên sân khấu**: gõ câu bất kỳ, “Đọc ngay” chen vào sau câu hiện tại; có câu mẫu và lịch sử.
- **Xem trước** sân khấu ngay trong trang (không phát tiếng), bật được lớp **“Vùng TikTok che”** để biết phần nào bị giao diện TikTok che mất.
- **Thử nghiệm**: tạo người xem giả (vào xem, gõ adidaphat, cầu mong, quà nhỏ/lớn/combo, tim, 20 người vào, 30 giây live sôi động) để tập dượt trước khi lên live.
- Hiệu ứng nhanh và **phím tắt**: `B` chuông, `M` mõ, `R` mưa hoa, `S` bỏ qua câu, `P` tạm dừng giọng, `T` thử nghiệm, `?` xem tất cả.
- Cài đặt đầy đủ: từ khóa thắp hương, số tim, thời gian mưa hoa, cách tính điểm, giọng/tốc độ/cao độ/âm lượng, bật tắt từng loại câu đọc, nhạc nền, chất lượng đồ họa, từ cấm riêng, danh sách chặn.

## Khác gì so với “Đi Chùa Online”

| | Đi Chùa Online | An Nhiên Live |
|---|---|---|
| Tải lại trang stage | Mất hết hội trường, điểm, thanh tim | Mọi thứ nằm ở server và lưu ra file, tắt mở app trong 6 giờ vẫn giữ |
| Lỡ mở 2 trang stage | Đọc 2 giọng chồng nhau | Tự chọn 1 trang phát tiếng, trang kia im |
| TikTok rớt kết nối / hết live | Phải bấm kết nối lại | Tự nối lại; chờ live bắt đầu rồi tự vào |
| Theo dõi khi đang live | Không thấy comment, quà | Bảng hoạt động realtime + thao tác nhanh trên từng người |
| Giọng đọc | Không thấy đang/sắp đọc gì | Hàng đợi hiển thị, tạm dừng, bỏ qua, xóa; có phụ đề trên live |
| Tập dượt | Phải lên live thật | Chế độ Thử nghiệm |
| Lần đầu sử dụng | Đọc README | Trình hướng dẫn 4 bước, tự xác nhận từng bước |
| Bố cục | Không tính phần TikTok che | Đặt nội dung tránh vùng che, có lớp xem vùng che |
| Tài nguyên | Model 3D, ảnh nền, nhạc chưa rõ bản quyền | Cảnh 3D, nhân vật, âm thanh, 3 bản nhạc nền đều tạo bằng code |
| Hiệu năng | Mỗi nhân vật là một model riêng | Instancing: cả trăm người chỉ 6 lệnh vẽ; 3 mức đồ họa |

## Lưu ý

- Chỉ trang trong LIVE Studio (`?view=stage`) phát tiếng. Trang điều khiển và bản xem trước luôn im.
- Muốn dùng nhạc nền riêng: bỏ file `.mp3` vào thư mục `music/`, rồi chọn trong Cài đặt → Âm thanh. Chỉ dùng nhạc bạn có quyền phát.
- App chỉ nhận kết nối từ chính máy đang chạy (127.0.0.1). `lvh.me` là tên miền công khai trỏ về 127.0.0.1, dùng vì LIVE Studio không nhận `localhost`.
- Cài đặt và phiên được lưu trong thư mục `data/`.
- Sự kiện TikTok đọc bằng thư viện không chính thức [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector); giọng đọc dùng dịch vụ đọc của Microsoft Edge và Google Translate, không phải API chính thức. Tất cả có thể ngừng chạy nếu các bên thay đổi.
- Người dùng tự tìm hiểu và tuân thủ quy định của TikTok về live tự động, kêu gọi quà tặng, và pháp luật hiện hành.

## Cho người muốn sửa code

```
server/   Express + SSE. engine.ts = mọi luật chơi; voice.ts = hàng đợi + TTS; tiktok.ts = kết nối có tự nối lại; sim.ts = thử nghiệm
shared/   Kiểu dữ liệu, xử lý chữ (lọc từ, đọc tên, nhận lời cầu), toàn bộ câu thoại (lines.ts)
src/stage/      Trang sân khấu: scene/ (Three.js: temple, people, world), Overlay.tsx, audio.ts
src/dashboard/  Trang điều khiển
```

`npm run dev` để chạy có tự tải lại khi sửa code; `npm run lint` để kiểm tra kiểu.

Giấy phép: MIT.
