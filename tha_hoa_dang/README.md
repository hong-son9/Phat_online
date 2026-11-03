# 🪷 Hoa Đăng Live

Bản thử từ **An Nhiên Live**: cùng server, giọng đọc, trang điều khiển, nhưng bối cảnh là **một cây cầu gỗ trên sông đêm trăng**. Người xem đứng dọc hai bên lan can, có tên và avatar trên đầu. Gõ `hoadang` thì nhân vật của họ ra lầu giữa cầu, nâng hoa đăng lên cầu nguyện rồi thả xuống sông, hoa đăng trôi theo dòng. Gõ `phongsinh` thì họ thả một chú cá chép: cá rơi xuống, nhảy lên một lần rồi bơi đi. Ai tặng quà thì máy quay áp sát, hoa đăng của họ màu vàng và to hơn, trăng sáng rực.

> Đây là không gian thư giãn mang tính giải trí, không đại diện cho tổ chức tôn giáo nào. Quà tặng chỉ để nhận lời chúc, không phải cúng dường. Hoa đăng và cá đều là hình 3D, không thả vật thật. Dòng lưu ý này chạy trên màn hình live (có thể tắt trong Cài đặt).

Chạy ở **cổng 3001**, nên bật song song được với bản chánh điện (cổng 3000). Cài đặt và phiên lưu riêng trong `data/` của thư mục này.

## Cài và chạy (Windows)

1. Cài [Node.js](https://nodejs.org) bản LTS.
2. Bấm đúp **`CHAY-LIVE.bat`**. Lần đầu tự cài thư viện (1–2 phút), sau đó trang điều khiển tự mở ở `http://localhost:3001`.
3. Làm theo **trình hướng dẫn 4 bước** hiện ra lần đầu:
   - Đặt tên kênh (giọng đọc xưng bằng tên này, tên cũng hiện trên bảng cổng bên kia sông).
   - Trong TikTok LIVE Studio thêm nguồn **Link**: `http://lvh.me:3001/?view=stage`, kích thước **1080 × 1920**.
   - Bấm “Phát câu thử” để nghe giọng đọc qua đúng đường người xem nghe.
   - Nhập username TikTok và kết nối.

Giữ cửa sổ `CHAY-LIVE.bat` mở suốt buổi live; đóng nó là tắt app.

## Tính năng

**Trên sân khấu**
- Cây cầu 50 chỗ dọc hai lan can, chỗ trống có người qua đường đứng ngắm sông (vài người đội nón lá). Người mới vào xem được xếp chỗ gần lầu trước, để không bị khung bình luận TikTok che.
- Lầu giữa cầu: 10 chỗ cho bảng **TOP THÀNH TÂM**, và 5 chỗ ở lan can để thả. Tối đa 5 người cùng lúc, người sau xếp hàng (hiện avatar và loại đang thả), người tặng quà được ưu tiên.
- **Thả hoa đăng**: đi ra lan can, nâng đèn lên cầu nguyện, vươn tay thả, đèn rơi xuống tạo gợn nước rồi trôi theo dòng (trôi cả dưới gầm cầu), khoảng 3 phút mới tắt.
- **Thả cá (phóng sinh)**: cá chép nhiều màu, rơi xuống nước bắn tung bọt, nhảy lên một lần rồi lặn mất.
- Sông lúc nào cũng có vài ngọn hoa đăng trôi từ thượng nguồn; trăng, sao, đom đóm, đèn lồng đỏ trên cầu có bóng phản chiếu dưới nước.
- Quà: máy quay áp sát người tặng, thẻ “Xin cảm ơn”, sen vàng nở; quà lớn có thêm **đèn trời** bay lên từ lầu.
- Thanh tim: đủ số tim là **sông đầy hoa đăng** (thả hàng loạt, có cánh hoa rơi), có đồng hồ đếm ngược.
- Hai không khí: Đêm trăng / Hoàng hôn trên sông.
**Khách quý** (Cài đặt → Khách quý)
- Chọn người xem theo username TikTok. Mỗi lần họ vào live: nhân vật mặc **áo màu riêng**, to hơn, có **hào quang vàng** trên đầu, vòng sáng dưới chân, đốm sáng lấp lánh, **bảng tên vàng có vương miện** và danh hiệu (Khách quý, Đạo hữu…), dùng **ảnh đại diện riêng** bạn tải lên.
- Vào live là chuông ngân, được đọc **lời chào riêng** ngay, đứng ngay cạnh lầu, gõ từ khóa là được ra thả trước.
- Đang live, rê chuột vào một người trong bảng Hoạt động hoặc TOP rồi bấm 👑 là đặt họ làm khách quý ngay.

**Giọng đọc** (giọng Hoài My hoặc Nam Minh của Microsoft, dự phòng Google)
- Cảm ơn người tặng quà (gộp combo thành 1 câu: “cảm ơn bạn X đã gửi 5 hoa hồng”), luôn đọc trước.
- Chào từng người mới vào, gộp 3 tên một câu; phòng quá đông thì ưu tiên người vào gần nhất.
- Nhận ra điều người xem cầu: thi cử, sức khỏe, tình duyên, gia đình, công việc, tài lộc, đi xa, bình an, và khi ai đó buồn. Chỉ đọc lời chúc, **không bao giờ đọc nguyên văn comment**.
- Cảm ơn theo dõi, chia sẻ; báo khi đủ tim; tự chúc khi live im lặng; định kỳ nhắc chia sẻ kèm tên người vừa trò chuyện.
- Đọc tên “đẹp”: chữ kiểu 𝑵𝒈𝒖𝒚𝒆̂̃𝒏 thành “Nguyễn”, bỏ emoji, tách “ThuTrang2005” thành “Thu Trang hai không không năm”.

**Trang điều khiển**
- Bảng **Hoạt động** realtime: lọc theo bình luận/quà/vào xem, tìm kiếm, nhãn “hoa đăng / thả cá” và loại lời cầu. Rê chuột vào một dòng để mời thả hoa đăng hoặc thả cá, đọc lời chúc riêng, xếp chỗ, hoặc chặn.
- **Hàng đợi giọng đọc**: xem câu đang đọc (có thanh tiến độ), các câu sắp đọc; tạm dừng, bỏ qua, xóa từng câu.
- **Đọc lên sân khấu**: gõ câu bất kỳ, “Đọc ngay” chen vào sau câu hiện tại; có câu mẫu và lịch sử.
- **Xem trước** sân khấu ngay trong trang (không phát tiếng), bật được lớp **“Vùng TikTok che”** để biết phần nào bị giao diện TikTok che mất.
- **Thử nghiệm**: tạo người xem giả (vào xem, gõ hoadang, gõ phongsinh, cầu mong, quà nhỏ/lớn/combo, tim, 20 người vào, 30 giây live sôi động) để tập dượt trước khi lên live.
- Hiệu ứng nhanh và **phím tắt**: `B` chuông, `M` mõ, `R` mưa hoa, `S` bỏ qua câu, `P` tạm dừng giọng, `T` thử nghiệm, `?` xem tất cả.
- Cài đặt đầy đủ: từ khóa thả hoa đăng và thả cá, số tim, thời gian sông đầy hoa đăng, cách tính điểm, giọng/tốc độ/cao độ/âm lượng, bật tắt từng loại câu đọc, nhạc nền, chất lượng đồ họa, từ cấm riêng, danh sách chặn.

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
src/stage/      Trang sân khấu: scene/ (Three.js: river = sông + cầu, floaters = hoa đăng + cá + gợn nước, people, world), Overlay.tsx, audio.ts
src/dashboard/  Trang điều khiển
```

`npm run dev` để chạy có tự tải lại khi sửa code; `npm run lint` để kiểm tra kiểu.

Giấy phép: MIT.
