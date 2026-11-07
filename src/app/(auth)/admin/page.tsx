import { LockKeyholeIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { errorBag, getFlash, oldInput } from "@/lib/flash";
import { getAdmin } from "@/server/auth";

/** GET /admin — AuthController@index (middleware 'login': da dang nhap thi vao dashboard). Form POST /login. */
export default async function LoginPage() {
  if (await getAdmin()) redirect("/dashboard/index");
  const [errors, old, flash] = await Promise.all([errorBag(), oldInput(), getFlash()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <LockKeyholeIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Đăng nhập quản trị</h1>
            <p className="text-sm text-muted-foreground">Nhập email và mật khẩu để tiếp tục</p>
          </div>
        </div>
        <Card>
          <CardContent className="grid gap-4 p-6">
            {flash.error && <Alert variant="destructive">{flash.error}</Alert>}
            <form method="post" action="/login" className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="text" name="email" autoComplete="username" defaultValue={old("email", "") ?? ""} aria-invalid={errors.has("email")} autoFocus />
                {errors.has("email") && <p className="text-xs text-destructive">{errors.first("email")}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" name="password" autoComplete="current-password" aria-invalid={errors.has("password")} />
                {errors.has("password") && <p className="text-xs text-destructive">{errors.first("password")}</p>}
              </div>
              <Button type="submit" className="w-full">
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
