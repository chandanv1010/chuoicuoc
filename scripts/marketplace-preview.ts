// Xem du lieu se gui len tung san (khong goi API): npx tsx --conditions=react-server --env-file=.env scripts/marketplace-preview.ts <productId>
import { adapterOf } from "../src/modules/marketplace/platforms";
import { loadProduct } from "../src/modules/marketplace/product-source";
import { DEFAULT_SETTINGS, type ListingSettings, type Marketplace } from "../src/modules/marketplace/types";

async function main() {
  const p = await loadProduct(BigInt(process.argv[2] ?? "159"));
  if (!p) throw new Error("no product");
  const vn: ListingSettings = { ...DEFAULT_SETTINGS, category_id: "100017", fx_rate: 26000, weight_kg: 0.2, length_cm: 20, width_cm: 15, height_cm: 3, attributes: "Chất liệu = Cotton" };
  const account = { currency: "VND", meta: { shipping_profiles: [{ id: "1", name: "kho" }] } } as never;
  for (const m of ["shopee", "lazada", "tiktok_shop", "amazon"] as Marketplace[]) {
    const a = adapterOf(m)!;
    const s = m === "amazon" ? { ...DEFAULT_SETTINGS, category_id: "HAT", tags: ["custom hat"], materials: ["Cotton"] } : vn;
    console.log(`\n===== ${m} =====`);
    console.log("validate:", a.validate(p, s, account));
    console.log(JSON.stringify(a.preview!(p, s), null, 1).slice(0, 1800));
  }
  process.exit(0);
}
void main();
