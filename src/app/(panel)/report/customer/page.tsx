import type { SearchParams } from "@/server/admin-list";
import { ReportPage } from "@/modules/report/report";

/** GET /report/customer — ReportController@customer (report/customer.blade.php) */
export default async function ReportCustomer({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ReportPage kind="customer" searchParams={await searchParams} />;
}
