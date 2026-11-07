import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { danhSachTinh, findDealer } from "@/modules/dealer/dealer";
import { DealerStore } from "@/modules/dealer/dealer-store";

/** GET /dealer/{id}/edit — DealerController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("dealer.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const dealer = await findDealer(BigInt(id));
  if (!dealer) notFound();
  return <DealerStore method="edit" dealer={dealer} provinces={await danhSachTinh()} />;
}
