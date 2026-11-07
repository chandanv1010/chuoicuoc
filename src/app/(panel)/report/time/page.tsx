import type { SearchParams } from "@/server/admin-list";
import { ReportPage } from "@/modules/report/report";

/** GET /report/time — ReportController@time (report/time.blade.php) */
export default async function ReportTime({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ReportPage kind="time" searchParams={await searchParams} />;
}
