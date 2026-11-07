/**
 * GET /crawler — CrawlerController@crawl (route crawl.index).
 *
 * Ban goc la cong cu cao du lieu dung mot lan cua website truoc: doc JSON tu
 * http://duchanhhandicraft.com/homepage/home/getData, dung mang payload
 * products/product_language/routers... nhung toan bo doan ghi DB DA BI COMMENT,
 * nen ham khong ghi gi va tra ve rong (HTTP 200, than rong). Hien tai tren
 * Laravel no con loi 500 vi file_get_contents() gap loi chung chi SSL.
 *
 * Khong port phan goi trang ngoai (khong co tac dung gi ma lai tao request toi
 * may chu ben thu ba moi lan co nguoi mo URL): tra ve dung ket qua "thanh cong"
 * cua ban goc — response rong.
 */
export function GET() {
  return new Response("", { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
}
