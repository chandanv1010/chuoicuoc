import { notFound } from "next/navigation";
import { DeleteConfirm, PageHeader } from "@/components/admin/page";
import { __ } from "@/lib/lang";
import { authorize } from "@/server/auth";
import { findContact } from "@/modules/contact/contact";

/** GET /contact/{id}/delete — Backend ContactController@delete (contact/delete.blade.php) */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await authorize("contact.destroy");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const contact = await findContact(BigInt(id));
  if (!contact) notFound();
  const seo = __<Record<string, { title: string }>>("messages.contact");
  return (
    <>
      <PageHeader title={seo.delete.title} crumbs={[{ label: seo.index.title, href: "/contact/index" }, { label: "Xóa" }]} />
      <DeleteConfirm
        action={`/contact/${id}/destroy`}
        name={[contact.name, contact.phone].filter(Boolean).join(" — ") || `#${id}`}
        title="Xóa liên hệ"
        backHref="/contact/index"
      />
    </>
  );
}
