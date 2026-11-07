import { db } from "@/lib/db";

/**
 * GET ajax/location/getLocation?target=districts|wards&data[location_id]=...
 * Ajax\LocationController@getLocation (dung chung cho admin va frontend).
 */
function renderHtml(items: { code: string; name: string }[], root = "[Chọn Quận/Huyện]") {
  // Blade goc noi chuoi khong escape -> giu nguyen
  let html = `<option value="0">${root}</option>`;
  for (const item of items) html += `<option value="${item.code}">${item.name}</option>`;
  return html;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const target = sp.get("target");
  const locationId = sp.get("data[location_id]") ?? "";
  let html = "";
  if (target === "districts") {
    // findById -> findOrFail: khong co thi 404
    const province = await db.provinces.findUnique({ where: { code: locationId } });
    if (!province) return Response.json({ message: "No query results for model [App\\Models\\Province] " + locationId }, { status: 404 });
    const districts = await db.districts.findMany({ where: { province_code: province.code }, select: { code: true, name: true } });
    html = renderHtml(districts);
  } else if (target === "wards") {
    const district = await db.districts.findUnique({ where: { code: locationId } });
    if (!district) return Response.json({ message: "No query results for model [App\\Models\\District] " + locationId }, { status: 404 });
    const wards = await db.wards.findMany({ where: { district_code: district.code }, select: { code: true, name: true } });
    html = renderHtml(wards, "[Chọn Phường/Xã]");
  }
  return Response.json({ html });
}
