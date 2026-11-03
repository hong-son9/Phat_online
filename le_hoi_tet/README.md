# 🌸 Hội Xuân Live

Bản Tết của **An Nhiên Live**: cùng server, giọng đọc, trang điều khiển, nhưng bối cảnh là **quảng trường làng ngày Tết Nguyên đán**. Cổng làng mái ngói đỏ treo băng rôn "Chúc mừng năm mới", cây nêu, hoa đào, hoa mai, chậu quất, dây đèn lồng và cờ đuôi nheo, hai dãy sạp chợ Tết, ông đồ cho chữ, đu tre, ném còn. Người xem hiện thành nhân vật **mặc áo dài Tết** (áo gấm, khăn vấn hoặc khăn đóng) đứng hai bên đường hội, có tên và avatar trên đầu.

> Đây là không gian vui Tết mang tính giải trí. Quà tặng chỉ để nhận lời chúc, không phải bốc thăm may mắn. Pháo hoa, pháo dây đều là hình 3D, không đốt pháo thật. Dòng lưu ý này chạy trên màn hình live (có thể tắt trong Cài đặt).

Chạy ở **cổng 3002**, nên bật song song được với bản chánh điện (cổng 3000) và bản Hoa Đăng (cổng 3001). Cài đặt và phiên lưu riêng trong `data/` của thư mục này.

## Cài và chạy (Windows)

1. Cài [Node.js](https://nodejs.org) bản LTS.
2. Bấm đúp **`CHAY-LIVE.bat`** trong thư mục `le_hoi_tet`. Lần đầu tự cài thư viện (1–2 phút), sau đó trang điều khiển tự mở ở `http://localhost:3002`.
3. Làm theo **trình hướng dẫn 4 bước** hiện ra lần đầu:
   - Đặt tên kênh (giọng đọc xưng bằng tên này, tên cũng hiện trên biển cổng làng).
   - Trong TikTok LIVE Studio thêm nguồn **Link**: `http://lvh.me:3002/?view=stage`, kích thước **1080 × 1920**.
   - Bấm "Phát câu thử" để nghe giọng đọc qua đúng đường người xem nghe.
   - Nhập username TikTok và kết nối.

Giữ cửa sổ `CHAY-LIVE.bat` mở suốt buổi live; đóng nó là tắt app.

## Người xem làm gì, sân khấu ra sao

| Người xem | Trên sân khấu |
|---|---|
| Vào xem | Nhân vật áo dài đi từ đầu đường vào chỗ, giọng đọc chúc mừng năm mới |
| Gõ `xinchu` | Ra bàn ông đồ, chắp tay vái, nhận một tờ chữ đỏ (Phúc, Lộc, Thọ, An, Tâm, Nhẫn, Phát, Hỷ…), quay lại giơ cao cho mọi người xem, rồi cầm chữ về chỗ. Giọng đọc chúc theo đúng ý nghĩa chữ đó |
| Gõ `phaohoa` (hoặc "chúc mừng năm mới") | Ra bệ pháo, cúi châm ngòi, lùi lại, một loạt pháo hoa bay lên nổ trên mái cổng làng (hoa cúc, liễu vàng, vòng tròn, trái tim), rồi giơ tay reo hò |
| Tặng quà (ví dụ hoa hồng) | Ra bệ bắn **4 quả pháo hoa**; máy quay áp sát, cổng làng rực sáng, pháo dây nổ tách tách, hoa mai vàng nở |
| Quà từ 20 xu | Bắn **5 quả pháo hoa lớn** |
| Quà từ 99 xu | Bắn **8 quả pháo hoa**, kết bằng trái tim, và **lân ra múa** cùng **Ông Địa** cầm quạt mo dẫn đường: chạy lên từ đầu đường, lượn vòng, ngẩng đầu, lắc đầu, vái chào người xem 3 lần rồi lui ra. Máy quay bám theo lân. Đầu lân có mắt chớp, tai vẫy, hàm há ngậm theo trống, gương trên trán, râu và lông trắng; thân vải vảy đỏ viền vàng, đuôi bông |
| Thả đủ tim | Pháo hoa bắn liên tục và mưa hoa đào |
| Comment điều mong ước | Giọng đọc chúc Tết đúng điều đó (thi cử, sức khỏe, tình duyên, gia đình, công việc, tài lộc, về quê, bình an, đang buồn) |

Bên trái sân khấu là bảng **Cách chơi** (thay cho bảng xếp hạng): liệt kê từng món quà, từ khóa và hiệu ứng tương ứng, lần lượt sáng lên từng dòng. Khi pháo hoa nổ hoặc lân đi ngang, người xem gần đó giơ tay reo hò; ban đêm bầu trời lóe sáng theo màu pháo. Lân nhảy bật, đứng cao, tung kim tuyến sau mỗi lần vái.

Lúc nào cũng có: cánh đào rơi nhẹ, đèn lồng đung đưa, cô gái áo dài đánh đu, người ném còn lên vòng (trúng thì tóe sáng), người bán hàng mời khách, ông đồ cặm cụi viết. Thỉnh thoảng có pháo hoa xa trên làng.

**Ngày và đêm** (Cài đặt → Hiển thị → Ngày và đêm): ☀️ **Sáng mùng Một** (trời xanh, nắng xuân) và 🎆 **Đêm Giao thừa** (trời sao, đèn lồng sáng rực, pháo hoa nhiều hơn). Mặc định là **⏰ Theo giờ**: tự chuyển theo đồng hồ của máy đang live (mặc định đêm từ 18:00, ngày từ 06:00, chỉnh được); lúc chuyển, sân khấu tối dần rồi sáng lại trong 3 giây. Có thể chọn cố định Ngày hoặc Đêm.

**Pháo hoa** có 8 kiểu nổ: hoa cúc kéo vệt, mẫu đơn hai màu, liễu vàng rủ, vòng đôi, trái tim, cây dừa, chữ thập (mỗi hạt tách làm bốn), lấp lánh (chớp trắng lách tách). Hạt đổi màu khi tàn, mỗi quả nổ chiếu ánh sáng đúng màu xuống quảng trường và để lại làn khói. Mỗi lượt `phaohoa` bắn 3 quả khác kiểu, người tặng quà 5 quả; đủ tim là màn tổng kết bắn hình quạt.

**Nhạc Tết** (Cài đặt → Âm thanh), giai điệu sáng tác riêng theo âm giai ngũ cung dân gian, phát bằng code nên không lo bản quyền khi live:
- 🌸 **Mùa xuân**: sáo trúc dẫn giai điệu, đàn tranh rải hợp âm và vuốt dây, trống nhẹ, phách (mặc định).
- 🥁 **Hội xuân**: đàn tranh, trống lân "tùng tùng cắc tùng", thanh la, xập xõa, rộn ràng.
- 🏮 **Tết quê**: sáo ngân dài, đàn tranh chậm, ấm áp.

Cùng tiếng pháo hoa bay và nổ, pháo dây, trống lân. Muốn dùng bài hát Tết riêng: bỏ file `.mp3` vào thư mục `music/` (chỉ dùng nhạc bạn có quyền phát; bài hát Tết phổ biến đều có bản quyền và dễ bị TikTok tắt tiếng).

Tất cả tính năng của An Nhiên Live vẫn có: khách quý, thử nghiệm, hàng đợi giọng đọc, đọc ngay, lọc từ, chặn, phím tắt, bật/tắt từng hiệu ứng (`X` tắt hết, `R` bật/dừng pháo hoa).

## Cho người muốn sửa code

```
src/stage/scene/festival.ts  quảng trường: cổng làng, cây nêu, đào/mai, sạp chợ, ông đồ, đu, cây còn, đèn lồng
src/stage/scene/people.ts    nhân vật áo dài (instancing): vạt áo, tay áo, khăn vấn/khăn đóng
src/stage/scene/props.ts     pháo hoa, tờ chữ ông đồ, múa lân
src/stage/scene/world.ts     bố cục, hành trình xin chữ / bắn pháo, máy quay, hiệu ứng
src/stage/scene/textures.ts  mọi texture vẽ bằng canvas (gạch, băng rôn, câu đối, chữ, gấm, trời...)
shared/lines.ts              câu chúc Tết, bộ chữ ông đồ và ý nghĩa
```

Giấy phép: MIT.
