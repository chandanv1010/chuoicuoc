import { EmptyRow, ListCard, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox } from "@/components/admin/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { convertDateTime } from "@/lib/helpers";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateContacts } from "@/modules/contact/contact";

export const metadata = { title: "Liên hệ" };

/**
 * GET /contact/index — Backend ContactController@index (contact/index.blade.php).
 * Bo loc (component/filter) nam trong comment HTML o ban goc -> khong hien thi.
 */
export default async function ContactIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("contact.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateContacts(sp);
  const seo = __<{ index: { title: string; table: string } }>("messages.contact");
  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} />
      <ListCard title={seo.index.table}>
        <SelectableTable model="Contact" ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead className="min-w-64">Lời nhắn</TableHead>
                <TableHead className="w-16 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={7} text="Chưa có liên hệ nào." />}
              {rows.map((contact) => {
                const id = contact.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{convertDateTime(contact.created_at, "d/m/Y")}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell className="max-w-xs truncate">{contact.address}</TableCell>
                    {/* {!! $contact->message !!} */}
                    <TableCell className="text-sm whitespace-normal" dangerouslySetInnerHTML={{ __html: contact.message ?? "" }} />
                    <TableCell>
                      <RowActions deleteHref={`/contact/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/contact/index", sp)} />
      </ListCard>
    </>
  );
}
