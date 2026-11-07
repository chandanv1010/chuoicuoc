import "server-only";
import type { Prisma } from "@prisma/client";
import { now as localNow } from "@/lib/helpers";
import { db } from "@/lib/db";

/** canonical da bi ban ghi khac chiem chua (bang routers dung chung moi module). */
export async function isCanonicalTaken(
  canonical: string,
  own?: { moduleId: bigint; controller: string },
) {
  const found = await db.routers.findUnique({ where: { canonical } });
  if (!found) return false;
  return !(own && found.module_id === own.moduleId && found.controllers === own.controller);
}

/** Giong BaseService::updateRouter: xoa dong cu cua module/ngon ngu roi tao lai. */
export async function saveRouter(
  tx: Prisma.TransactionClient,
  data: { canonical: string; moduleId: bigint; controller: string; languageId: bigint },
) {
  await tx.routers.deleteMany({
    where: { module_id: data.moduleId, controllers: data.controller, language_id: data.languageId },
  });
  const now = localNow();
  await tx.routers.create({
    data: {
      canonical: data.canonical,
      module_id: data.moduleId,
      controllers: data.controller,
      language_id: data.languageId,
      created_at: now,
      updated_at: now,
    },
  });
}
