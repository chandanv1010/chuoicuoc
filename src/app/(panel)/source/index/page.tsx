import { CreateButton, EmptyRow, ListCard, ListToolbar, PageHeader, RowActions } from "@/components/admin/page";
import { AdminPagination, makePaginator } from "@/components/admin/pagination";
import { SelectableRow, SelectableTable, SelectAllCheckbox, SelectRowCheckbox, StatusSwitch } from "@/components/admin/fields";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/misc";
import { __ } from "@/lib/lang";
import { stripTags } from "@/lib/helpers";
import type { SearchParams } from "@/server/admin-list";
import { authorize } from "@/server/auth";
import { paginateSources } from "@/modules/customer/customer";

export const metadata = { title: "Nguồn khách" };

/** html_entity_decode() cho cac entity hay gap trong noi dung editor. */
function decodeEntities(s: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", agrave: "à", acirc: "â", atilde: "ã", eacute: "é", egrave: "è", ecirc: "ê", iacute: "í", igrave: "ì",
    oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", uacute: "ú", ugrave: "ù", yacute: "ý",
    Aacute: "Á", Agrave: "À", Acirc: "Â", Atilde: "Ã", Eacute: "É", Egrave: "È", Ecirc: "Ê", Iacute: "Í", Igrave: "Ì",
    Oacute: "Ó", Ograve: "Ò", Ocirc: "Ô", Otilde: "Õ", Uacute: "Ú", Ugrave: "Ù", Yacute: "Ý",
  };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return named[e] ?? m;
  });
}

/** GET /source/index — SourceController@index (source/index.blade.php) */
export default async function SourceIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await authorize("source.index");
  const sp = await searchParams;
  const { rows, total, perPage, page } = await paginateSources(sp);
  const seo = __<{ index: { title: string; table: string }; create: { title: string } }>("messages.source");
  const model = "Source";
  return (
    <>
      <PageHeader title={seo.index.title} crumbs={[{ label: seo.index.title }]} actions={<CreateButton href="/source/create" label={seo.create.title} />} />
      <ListCard title={seo.index.table}>
        <ListToolbar action="/source/index" searchParams={sp} />
        <SelectableTable model={model} ids={rows.map((r) => r.id.toString())}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllCheckbox />
                </TableHead>
                <TableHead>Tên nguồn</TableHead>
                <TableHead>Từ khóa</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="w-28 text-center">Tình trạng</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <EmptyRow colSpan={6} />}
              {rows.map((source) => {
                const id = source.id.toString();
                return (
                  <SelectableRow key={id} id={id}>
                    <TableCell>
                      <SelectRowCheckbox id={id} />
                    </TableCell>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {source.keyword}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">{stripTags(decodeEntities(source.description ?? ""))}</TableCell>
                    <TableCell className="text-center">
                      <StatusSwitch model={model} id={id} value={source.publish} />
                    </TableCell>
                    <TableCell>
                      <RowActions editHref={`/source/${id}/edit`} deleteHref={`/source/${id}/delete`} />
                    </TableCell>
                  </SelectableRow>
                );
              })}
            </TableBody>
          </Table>
        </SelectableTable>
        <AdminPagination paginator={makePaginator(total, perPage, page, "/source/index", sp)} />
      </ListCard>
    </>
  );
}
