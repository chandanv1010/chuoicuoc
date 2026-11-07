import { authorize } from "@/server/auth";
import { danhSachTinh } from "@/modules/dealer/dealer";
import { DealerStore } from "@/modules/dealer/dealer-store";

/** GET /dealer/create — DealerController@create */
export default async function Page() {
  await authorize("dealer.create");
  return <DealerStore method="create" dealer={null} provinces={await danhSachTinh()} />;
}
