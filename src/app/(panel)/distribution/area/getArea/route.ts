import { getAdmin } from "@/server/auth";
import { carbonJson, findAreaByParentId } from "@/modules/distribution/distribution";

/**
 * GET /distribution/area/getArea — DistributionAreaController@getArea (route name ajax.distribution.getArea).
 * Tra ve mang DistributionArea dang JSON (Eloquent collection).
 */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("parent_id") ?? "";
  const n = Number.parseInt(raw.trim(), 10);
  const areas = await findAreaByParentId(Number.isNaN(n) ? 0 : n);
  return Response.json(
    areas.map((a) => ({
      id: Number(a.id),
      name: a.name,
      parent_id: Number(a.parent_id),
      publish: a.publish,
      created_at: carbonJson(a.created_at),
      updated_at: carbonJson(a.updated_at),
    })),
  );
}
