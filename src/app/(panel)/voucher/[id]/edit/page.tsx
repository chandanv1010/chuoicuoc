import { notFound } from "next/navigation";
import { authorize } from "@/server/auth";
import { findVoucher, voucherConditions, voucherObject } from "@/modules/voucher/voucher";
import { VoucherStore } from "@/modules/voucher/voucher-store";

/** GET /voucher/{id}/edit — VoucherController@edit */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("voucher.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const voucher = await findVoucher(BigInt(id));
  if (!voucher) notFound(); // findOrFail
  const [conditions, object] = await Promise.all([voucherConditions(voucher.id), voucherObject(voucher.id)]);
  return <VoucherStore method="edit" voucher={voucher} conditions={conditions} object={object} />;
}
