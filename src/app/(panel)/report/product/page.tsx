import type { SearchParams } from "@/server/admin-list";
import { ReportPage } from "@/modules/report/report";

/** GET /report/product — ReportController@product (report/product.blade.php) */
export default async function ReportProduct({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ReportPage kind="product" searchParams={await searchParams} />;
}
