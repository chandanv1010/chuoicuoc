import { flash } from "@/lib/flash";
import { arr, back, int } from "@/lib/http";
import { authorizeHandler } from "@/server/auth";
import type { FormRoute } from "@/server/routes";
import { digitizeRequest, MACHINE_FORMATS } from "./machine";
import { getDesignRequest } from "./requests";

/** Form POST cua thiet ke khach gui (trang /design-request/<id>). */
export const routes: FormRoute[] = [
  {
    // Tao file may theu (DST/PES/EXP/JEF) + bang mau chi
    method: "POST",
    path: "design-request/{id:[a-z0-9]+}/digitize",
    handler: async ({ req, params, input }) => {
      const admin = await authorizeHandler(req, "order.index");
      if (admin instanceof Response) return admin;
      const r = await getDesignRequest(params.id);
      const fallback = `/design-request/${params.id}`;
      if (!r) {
        await flash({ error: "Không tìm thấy thiết kế" });
        return back(req, "/design-request/index");
      }
      const keys = MACHINE_FORMATS.map((f) => f.key as string);
      const formats = arr(input, "formats[]").concat(arr(input, "formats")).filter((f) => keys.includes(f));
      const maxColors = Math.max(1, Math.min(12, int(input, "max_colors", 8)));
      const out = await digitizeRequest(r, { maxColors, formats: formats.length ? formats : ["dst", "pes"] });
      await flash(
        out.ok
          ? { success: `Đã tạo file máy: ${out.report.stitches.toLocaleString("en-US")} mũi, ${out.report.stops.length} lần đổi chỉ, ~${out.report.est_minutes} phút.` }
          : { error: `Chưa tạo được file máy: ${out.error}` },
      );
      return back(req, fallback);
    },
  },
];
