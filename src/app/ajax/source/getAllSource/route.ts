import { db } from "@/lib/db";
import { getAdmin } from "@/server/auth";
import { laravelJsonDate } from "@/modules/order/order";

/** GET ajax/source/getAllSource — Ajax\SourceController@getAllSource (SourceRepository::all, bo ban ghi da xoa mem). */
export async function GET() {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  try {
    const sources = await db.sources.findMany({ where: { deleted_at: null }, orderBy: { id: "asc" } });
    return Response.json({
      data: sources.map((s) => ({
        id: Number(s.id),
        name: s.name,
        keyword: s.keyword,
        description: s.description,
        publish: s.publish,
        deleted_at: laravelJsonDate(s.deleted_at),
        created_at: laravelJsonDate(s.created_at),
        updated_at: laravelJsonDate(s.updated_at),
      })),
      error: false,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: true, messages: e instanceof Error ? e.message : String(e) });
  }
}
