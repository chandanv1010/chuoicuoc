import fs from 'fs';
const MEDIA = 'C:/Users/DOBA/Desktop/sanbox/choicuoc-docx-extract/word/media';
const IMGDIR = 'C:/Users/DOBA/Desktop/sanbox/choicuoc/storage/userfiles/image/choicuoc';
const q = s => String(s).replace(/'/g, "''");
const CTRL_P = 'App\\\\Http\\\\Controllers\\\\Frontend\\\\ProductController';
const CTRL_C = 'App\\\\Http\\\\Controllers\\\\Frontend\\\\ProductCatalogueController';

const cats = [
  { id: 1001, slug: 'san-pham', name: 'Sản phẩm', parent: 0, level: 1, lft: 1, rgt: 10, ord: 0 },
  { id: 1002, slug: 'thanh-choi-cuoc-chan-cua', name: 'Thanh chổi cước chặn cửa', parent: 1001, level: 2, lft: 2, rgt: 3, ord: 1 },
  { id: 1003, slug: 'con-lan-cuoc', name: 'Con lăn cước', parent: 1001, level: 2, lft: 4, rgt: 5, ord: 2 },
  { id: 1004, slug: 'choi-cuoc-danh-ri', name: 'Chổi cước đánh rỉ', parent: 1001, level: 2, lft: 6, rgt: 7, ord: 3 },
  { id: 1005, slug: 'cac-loai-choi-cuoc-khac', name: 'Các loại chổi cước khác', parent: 1001, level: 2, lft: 8, rgt: 9, ord: 4 },
];

const P = [
  [18, 1002, 'thanh-choi-cuoc-gan-de', 'Thanh chổi cước gắn đế', 260000, 'Thanh chổi cước gắn trên đế nhựa/gỗ, dùng làm gioăng chặn bụi, chặn khe hở cho máy móc và cửa công nghiệp.'],
  [19, 1002, 'thanh-choi-cuoc-long-mem', 'Thanh chổi cước lông mềm', 240000, 'Thanh chổi cước lông mềm, quét sạch bề mặt, chống trầy xước, lắp cho băng tải và cửa.'],
  [20, 1002, 'thanh-choi-cuoc-chu-v', 'Thanh chổi cước chữ V', 320000, 'Thanh chổi cước dạng chữ V, tăng độ kín khít, dùng chắn bụi và ngăn côn trùng.'],
  [21, 1002, 'thanh-choi-cuoc-chan-cua-nhom', 'Thanh chổi cước chặn cửa khung nhôm', 350000, 'Thanh chổi cước gắn khung nhôm, lắp dưới chân cửa để chặn gió, bụi và nước.'],
  [22, 1002, 'thanh-choi-cuoc-inox-khung-nhom', 'Thanh chổi cước inox khung nhôm', 480000, 'Thanh chổi cước sợi inox trên khung nhôm, chịu nhiệt và mài mòn, dùng trong dây chuyền công nghiệp.'],
  [23, 1002, 'thanh-choi-cuoc-gat-nuoc', 'Thanh chổi cước gạt nước khung nhôm', 360000, 'Thanh chổi cước khung nhôm dùng gạt nước, chắn khe, dễ lắp đặt cho cửa và thiết bị.'],
  [24, 1002, 'thanh-choi-cuoc-gam-cua', 'Thanh chổi cước gầm cửa', 230000, 'Thanh chổi cước lắp gầm cửa, chặn khe hở phía dưới, giữ kín phòng và chống bụi.'],
  [2, 1003, 'con-lan-cuoc-nylon-truc-thep', 'Con lăn cước nylon trục thép', 1250000, 'Con lăn cước sợi nylon lắp trục thép, dùng trong máy rửa, máy đánh bóng và băng chuyền.'],
  [3, 1003, 'con-lan-cuoc-soi-mem', 'Con lăn cước sợi mềm trục dài', 1450000, 'Con lăn cước sợi mềm trục dài, làm sạch nhẹ nhàng bề mặt nhạy cảm, không gây xước.'],
  [5, 1003, 'con-lan-cuoc-mini', 'Con lăn cước mini đa dạng', 680000, 'Các loại con lăn cước cỡ nhỏ, nhiều kiểu trục, dùng cho thiết bị và máy chuyên dụng.'],
  [7, 1003, 'con-lan-cuoc-xoan-oc', 'Con lăn cước xoắn ốc nylon', 1350000, 'Con lăn cước quấn xoắn ốc sợi nylon, phủ đều bề mặt, dùng làm sạch và đánh bóng.'],
  [9, 1003, 'con-lan-cuoc-cong-nghiep', 'Con lăn cước công nghiệp nhiều loại', 1550000, 'Nhiều loại con lăn cước công nghiệp theo yêu cầu: sợi nylon, PP, inox, trục thép hoặc nhựa.'],
  [10, 1003, 'con-lan-cuoc-xoan-danh-bong', 'Con lăn cước xoắn đánh bóng', 1400000, 'Con lăn cước xoắn dùng đánh bóng, làm mịn bề mặt kim loại, gỗ và kính.'],
  [11, 1003, 'con-lan-cuoc-xoan-den', 'Con lăn cước xoắn đen', 1300000, 'Con lăn cước sợi đen quấn xoắn, bền chắc, dùng cho máy công nghiệp tải nặng.'],
  [12, 1003, 'con-lan-cuoc-nylon-trang', 'Con lăn cước nylon trắng', 1200000, 'Con lăn cước sợi nylon trắng, sạch an toàn, phù hợp ngành thực phẩm và in ấn.'],
  [13, 1003, 'con-lan-cuoc-gai-cung', 'Con lăn cước gai cứng', 1500000, 'Con lăn cước gai cứng, chà mạnh để bóc tách cặn bẩn, rỉ sét trên bề mặt kim loại.'],
  [14, 1003, 'con-lan-cuoc-truc-inox', 'Con lăn cước trục inox', 1650000, 'Con lăn cước lắp trục inox chống gỉ, dùng trong môi trường ẩm và dây chuyền rửa.'],
  [15, 1003, 'con-lan-cuoc-theo-ban-ve', 'Con lăn cước gia công theo bản vẽ', 0, 'Nhận gia công con lăn cước theo bản vẽ kỹ thuật: đường kính, chiều dài, loại sợi và trục theo yêu cầu.'],
  [25, 1003, 'con-lan-cuoc-soi-pp', 'Con lăn cước sợi PP trắng', 1180000, 'Con lăn cước sợi PP trắng, nhẹ và bền, dùng trong máy rửa rau củ, trái cây.'],
  [4, 1004, 'choi-cuoc-dia-soi-thep', 'Chổi cước đĩa đánh rỉ sợi thép', 380000, 'Chổi cước đĩa sợi thép, đánh sạch rỉ sét, ba via và sơn cũ trên bề mặt kim loại.'],
  [16, 1004, 'choi-cuoc-banh-xe-ren-trong', 'Chổi cước bánh xe ren trong', 320000, 'Chổi cước bánh xe lỗ ren trong, lắp nhanh lên máy mài, dùng đánh rỉ và làm sạch.'],
  [17, 1004, 'choi-cuoc-dia-nylon', 'Chổi cước đĩa nylon đánh bóng', 300000, 'Chổi cước đĩa sợi nylon, đánh bóng và làm mịn bề mặt mà không làm xước sâu.'],
  [26, 1004, 'choi-cuoc-banh-lon', 'Chổi cước bánh lớn đánh rỉ', 520000, 'Chổi cước bánh lớn cho máy công suất cao, đánh rỉ diện rộng, năng suất cao.'],
  [27, 1004, 'choi-cuoc-dia-175mm', 'Chổi cước đĩa Ø175mm lỗ 25.4mm', 360000, 'Chổi cước đĩa đường kính 175mm, cao 50mm, lỗ trong 25.4mm, dùng đánh bóng và làm sạch.'],
  [1, 1005, 'choi-cuoc-dat-theo-yeu-cau', 'Chổi cước đặt theo yêu cầu', 0, 'Nhận đặt chổi cước theo thông số: kích thước, loại sợi, màu và kiểu trục. Vui lòng liên hệ để báo giá.'],
  [6, 1005, 'mau-choi-cuoc-tong-hop', 'Mẫu chổi cước tổng hợp', 0, 'Bộ mẫu chổi cước tổng hợp nhiều loại sợi và kiểu dáng để khách tham khảo lựa chọn.'],
  [8, 1005, 'choi-cuoc-dinh-hinh', 'Chổi cước định hình & bánh răng', 0, 'Chổi cước định hình, dạng bánh răng và các chi tiết chổi cước đặc biệt theo yêu cầu máy móc.'],
];

fs.mkdirSync(IMGDIR, { recursive: true });
function findImg(n) {
  for (const e of ['png', 'jpeg', 'jpg']) {
    const p = `${MEDIA}/image${n}.${e}`;
    if (fs.existsSync(p)) return { p, e };
  }
  throw new Error('no img ' + n);
}

let sql = 'SET FOREIGN_KEY_CHECKS=0;\n';
sql += 'DELETE FROM product_catalogue_product;\n';
sql += 'DELETE FROM product_language;\n';
sql += 'DELETE FROM products;\n';
sql += 'DELETE FROM product_catalogue_language;\n';
sql += 'DELETE FROM product_catalogues;\n';
sql += "DELETE FROM routers WHERE controllers LIKE '%ProductController' OR controllers LIKE '%ProductCatalogueController';\n";
sql += "UPDATE languages SET name='Tiếng Việt', canonical='vi' WHERE id=1;\n";

let rid = 5000;
for (const c of cats) {
  sql += `INSERT INTO product_catalogues (id,parent_id,lft,rgt,level,image,publish,follow,\`order\`,user_id,\`check\`,\`sort\`,created_at,updated_at) VALUES (${c.id},${c.parent},${c.lft},${c.rgt},${c.level},'',2,2,${c.ord},1,0,0,NOW(),NOW());\n`;
  sql += `INSERT INTO product_catalogue_language (product_catalogue_id,language_id,url,name,canonical,created_at,updated_at) VALUES (${c.id},1,'','${q(c.name)}','${c.slug}',NOW(),NOW());\n`;
  sql += `INSERT INTO routers (id,canonical,module_id,controllers,language_id,created_at,updated_at) VALUES (${++rid},'${c.slug}',${c.id},'${CTRL_C}',1,NOW(),NOW());\n`;
}

let pid = 2000, ord = 0;
for (const [n, cat, slug, name, price, desc] of P) {
  pid++; ord++;
  const { p, e } = findImg(n);
  const destDir = `${IMGDIR}/${slug}`;
  fs.mkdirSync(destDir, { recursive: true });
  const ext = e === 'jpeg' ? 'jpg' : e;
  fs.copyFileSync(p, `${destDir}/01.${ext}`);
  const imgUrl = `/userfiles/image/choicuoc/${slug}/01.${ext}`;
  const album = JSON.stringify([imgUrl]);
  const content = `<p>${q(desc)}</p>`;
  sql += `INSERT INTO products (id,product_catalogue_id,image,album,publish,follow,\`order\`,user_id,price,stock,\`check\`,duration,total_lesson,code,created_at,updated_at) VALUES (${pid},${cat},'${imgUrl}','${q(album)}',2,2,${ord},1,${price},100,0,'',0,'CC${pid}',NOW(),NOW());\n`;
  sql += `INSERT INTO product_language (product_id,language_id,url,name,description,content,canonical,created_at,updated_at) VALUES (${pid},1,'','${q(name)}','${q(desc)}','${q(content)}','${slug}',NOW(),NOW());\n`;
  sql += `INSERT INTO product_catalogue_product (product_catalogue_id,product_id) VALUES (${cat},${pid});\n`;
  sql += `INSERT INTO routers (id,canonical,module_id,controllers,language_id,created_at,updated_at) VALUES (${++rid},'${slug}',${pid},'${CTRL_P}',1,NOW(),NOW());\n`;
}
sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync('_seed-choicuoc.sql', sql);
console.log('wrote _seed-choicuoc.sql | products:', P.length, '| cats:', cats.length);
