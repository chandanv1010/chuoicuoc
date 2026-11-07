import { authorize } from "@/server/auth";
import { VoucherStore } from "@/modules/voucher/voucher-store";

/** GET /voucher/create — VoucherController@create */
export default async function Page() {
  await authorize("voucher.create");
  return <VoucherStore method="create" voucher={null} conditions={null} object={null} />;
}
