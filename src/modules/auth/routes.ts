import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { backWithErrors, redirectWith } from "@/lib/http";
import { loginAs } from "@/lib/session";
import { validate } from "@/lib/validator";
import type { FormRoute } from "@/server/routes";

/** Laravel luu bcrypt voi tien to $2y$, cung thuat toan voi $2b$. */
export function checkPassword(plain: string, hash: string | null | undefined) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash.replace(/^\$2y\$/, "$2b$"));
}

/** Hash::make(): giu tien to $2y$ de Laravel cung doc duoc. */
export async function hashPassword(plain: string) {
  return (await bcrypt.hash(plain, 10)).replace(/^\$2b\$/, "$2y$");
}

/** POST /login — Backend\V1\User\AuthController@login (AuthRequest). */
export const routes: FormRoute[] = [
  {
    method: "POST",
    path: "login",
    handler: async ({ req, input }) => {
      // Dan / go email hay dinh dau cach o dau, cuoi -> bo truoc khi kiem tra dinh dang
      input = { ...input, email: typeof input.email === "string" ? input.email.trim() : input.email };
      const errors = await validate(
        input,
        { email: "required|email", password: "required" },
        {
          "email.required": "Bạn chưa nhập vào Email.",
          "email.email": "Email chưa đúng định dạng. Ví dụ: abc@gmail.com",
          "password.required": "Bạn chưa nhập vào mật khẩu.",
        },
      );
      if (errors) return backWithErrors(req, errors, { email: input.email });

      // Tai khoan da xoa (xoa mem, deleted_at) khong dang nhap duoc nua
      const user = await db.users.findFirst({ where: { email: String(input.email), deleted_at: null } });
      if (user && (await checkPassword(String(input.password), user.password))) {
        await loginAs("admin", user.id);
        return redirectWith(req, "/dashboard/index", { success: "Đăng nhập thành công" });
      }
      return redirectWith(req, "/admin", { error: "Email hoặc Mật khẩu không chính xác" });
    },
  },
];
