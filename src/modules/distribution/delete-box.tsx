import { DeleteConfirm, PageHeader } from "@/components/admin/page";

/**
 * Khung chung cua distribution/delete.blade.php va distribution_area/delete.blade.php
 * (chi khac nhan va noi dung).
 */
export function DeleteBox({
  title,
  action,
  notice,
  name,
  index,
  indexLabel,
}: {
  title: string;
  action: string;
  notice: string;
  name: string;
  index: string;
  indexLabel: string;
}) {
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: indexLabel, href: index }, { label: "Xóa" }]} />
      <DeleteConfirm action={action} name={name} title={title} backHref={index}>
        <p className="text-muted-foreground">{notice}</p>
      </DeleteConfirm>
    </>
  );
}
