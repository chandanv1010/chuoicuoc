import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phpInt } from "@/modules/frontend/info/data";

/**
 * GET /ajax/distribution/getProvinces?parent_id= —
 * Frontend\DistributionController@getProvinces: response()->json($areas).
 * Model Eloquent -> JSON: du cot, timestamp dang ISO UTC co micro giay
 * ("2026-01-01T03:00:00.000000Z"). DB luu gio dia phuong (+07:00).
 */
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

function isoUtc(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d.getTime() - TZ_OFFSET_MS).toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

export async function GET(req: Request) {
  const parentId = phpInt(new URL(req.url).searchParams.get("parent_id") ?? "");
  // parent_id la cot unsigned: so am khong khop ban ghi nao
  const areas =
    parentId < 0
      ? []
      : await db.distribution_areas.findMany({
          where: { parent_id: BigInt(parentId), publish: 2 },
          orderBy: { name: "asc" },
        });
  return NextResponse.json(
    areas.map((a) => ({
      id: Number(a.id),
      name: a.name,
      parent_id: Number(a.parent_id),
      publish: a.publish,
      created_at: isoUtc(a.created_at),
      updated_at: isoUtc(a.updated_at),
    })),
  );
}
