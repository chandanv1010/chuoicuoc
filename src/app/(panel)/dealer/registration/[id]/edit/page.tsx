import { PhoneIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Field } from "@/components/admin/fields";
import { AdminForm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { e } from "@/modules/slide/php";
import { findRegistration, formatHiDmy, TRANG_THAI } from "@/modules/dealer/dealer";
import { StatusBadge } from "@/modules/dealer/status-badge";

/** GET /dealer/registration/{id}/edit — DealerRegistrationController@edit (view dealer_registration/store.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("dealer.registration.update");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const registration = await findRegistration(BigInt(id));
  if (!registration) notFound();
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.dealerRegistration");
  const status = e(old("status", registration.status));
  const info: [string, string][] = [
    ["Họ và tên", registration.name],
    ["Điện thoại", registration.phone],
    ["Công ty", e(registration.company) || "—"],
    ["Khu vực kinh doanh", e(registration.business_area) || "—"],
    ["Gửi từ", registration.source || "Không rõ"],
    ["Thời điểm gửi", formatHiDmy(registration.created_at)],
  ];

  return (
    <>
      <PageHeader
        title={seo.edit.title}
        description={<StatusBadge status={registration.status} />}
        crumbs={[{ label: seo.index.title, href: "/dealer/registration/index" }, { label: `Đơn #${id}` }]}
      />
      <FormErrors />
      <AdminForm
        action={`/dealer/registration/${registration.id}/update`}
        cancelHref="/dealer/registration/index"
        saveMode="single"
        main={
          <>
            <Section title="Thông tin khách gửi">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {info.map(([k, val]) => (
                  <div key={k} className="grid gap-0.5">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium break-words">{val}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section title="Ghi chú xử lý">
              <Field error={errors.first("note")}>
                <Textarea name="note" rows={6} placeholder="Ghi lại nội dung đã trao đổi với khách" defaultValue={e(old("note", registration.note))} aria-invalid={errors.has("note")} />
              </Field>
            </Section>
          </>
        }
        aside={
          <Section title="Xử lý">
            <Field label="Trạng thái xử lý" required error={errors.first("status")}>
              <NativeSelect name="status" defaultValue={status in TRANG_THAI ? status : "new"}>
                {Object.entries(TRANG_THAI).map(([ma, ten]) => (
                  <option key={ma} value={ma}>
                    {ten}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button asChild variant="outline">
              <a href={`tel:${registration.phone}`}>
                <PhoneIcon /> Gọi {registration.phone}
              </a>
            </Button>
          </Section>
        }
      />
    </>
  );
}
