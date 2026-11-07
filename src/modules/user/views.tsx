import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, DeleteConfirm, FormErrors, PageHeader, Section } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { s } from "@/modules/dashboard/ui";
import { LocationSelect } from "./location-select";
import type { findPermission, findUser, findUserCatalogue } from "./service";

/**
 * Form them/sua/xoa cua Thanh vien, Nhom thanh vien, Quyen
 * (user/user/*.blade.php, user/catalogue/*.blade.php, permission/*.blade.php).
 * Ten truong giu nguyen theo handler src/modules/user/routes.ts.
 */

type UserCatalogue = Awaited<ReturnType<typeof findUserCatalogue>>;
type User = Awaited<ReturnType<typeof findUser>>;
type Permission = Awaited<ReturnType<typeof findPermission>>;

const REQUIRED_NOTE = "Những trường đánh dấu * là bắt buộc";

/* ------------------------------------------------------------------ Nhom thanh vien */

/** user/catalogue/store.blade.php */
export async function UserCatalogueStore({ method, userCatalogue }: { method: "create" | "edit"; userCatalogue: UserCatalogue }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/user/catalogue/store" : `/user/catalogue/${userCatalogue?.id}/update`;
  const title = method === "create" ? "Thêm mới nhóm thành viên" : "Cập nhật nhóm thành viên";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Nhóm thành viên", href: "/user/catalogue/index" }, { label: title }]} />
      <FormErrors />
      <div className="mx-auto max-w-3xl">
        <AdminForm
          action={url}
          saveMode="single"
          cancelHref="/user/catalogue/index"
          main={
            <Section title="Thông tin chung" description={`Nhập thông tin chung của nhóm thành viên. ${REQUIRED_NOTE}.`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên nhóm" required error={errors.first("name")}>
                  <Input name="name" defaultValue={s(old("name", userCatalogue?.name))} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Ghi chú">
                  <Input name="description" defaultValue={s(old("description", userCatalogue?.description))} autoComplete="off" />
                </Field>
              </div>
            </Section>
          }
        />
      </div>
    </>
  );
}

/** user/catalogue/delete.blade.php */
export async function UserCatalogueDelete({ userCatalogue }: { userCatalogue: NonNullable<UserCatalogue> }) {
  return (
    <>
      <PageHeader title="Xóa nhóm thành viên" crumbs={[{ label: "Nhóm thành viên", href: "/user/catalogue/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/user/catalogue/${userCatalogue.id}/destroy`} name={userCatalogue.name} title="Xóa nhóm thành viên" backHref="/user/catalogue/index" />
    </>
  );
}

/* ------------------------------------------------------------------ Thanh vien */

/** Ngay sinh: date('Y-m-d', strtotime($user->birthday)) */
function ymd(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** user/user/store.blade.php */
export async function UserStore({
  method,
  user,
  provinces,
  catalogues,
}: {
  method: "create" | "edit";
  user: User;
  provinces: { code: string; name: string }[];
  catalogues: { id: bigint; name: string }[];
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/user/store" : `/user/${user?.id}/update`;
  const title = method === "create" ? "Thêm mới thành viên" : "Cập nhật thành viên";
  const catalogueId = s(old("user_catalogue_id", user ? user.user_catalogue_id : "0")) || "0";
  const catalogueOptions = [{ value: "0", label: "[Chọn nhóm thành viên]" }, ...catalogues.map((c) => ({ value: c.id.toString(), label: c.name }))];
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Thành viên", href: "/user/index" }, { label: title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        saveMode="single"
        cancelHref="/user/index"
        main={
          <>
            <Section title="Thông tin chung" description={`Nhập thông tin chung của người sử dụng. ${REQUIRED_NOTE}.`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" required error={errors.first("email")}>
                  <Input name="email" type="email" defaultValue={s(old("email", user?.email))} autoComplete="off" aria-invalid={errors.has("email")} />
                </Field>
                <Field label="Họ tên" required error={errors.first("name")}>
                  <Input name="name" defaultValue={s(old("name", user?.name))} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Nhóm thành viên" required error={errors.first("user_catalogue_id")}>
                  <Combobox name="user_catalogue_id" defaultValue={catalogueId} options={catalogueOptions} />
                </Field>
                <Field label="Ngày sinh">
                  <Input name="birthday" type="date" defaultValue={s(old("birthday", ymd(user?.birthday)))} />
                </Field>
                {method === "create" && (
                  <>
                    <Field label="Mật khẩu" required error={errors.first("password")} hint="Tối thiểu 6 ký tự">
                      <Input name="password" type="password" autoComplete="new-password" aria-invalid={errors.has("password")} />
                    </Field>
                    <Field label="Nhập lại mật khẩu" required error={errors.first("re_password")}>
                      <Input name="re_password" type="password" autoComplete="new-password" aria-invalid={errors.has("re_password")} />
                    </Field>
                  </>
                )}
              </div>
            </Section>
            <Section title="Thông tin liên hệ" description="Nhập thông tin liên hệ của người sử dụng">
              <div className="grid gap-4 sm:grid-cols-2">
                <LocationSelect
                  provinces={provinces}
                  defaults={{
                    province_id: s(old("province_id", user?.province_id)),
                    district_id: s(old("district_id", user?.district_id)),
                    ward_id: s(old("ward_id", user?.ward_id)),
                  }}
                />
                <Field label="Địa chỉ">
                  <Input name="address" defaultValue={s(old("address", user?.address))} autoComplete="off" />
                </Field>
                <Field label="Số điện thoại">
                  <Input name="phone" defaultValue={s(old("phone", user?.phone))} autoComplete="off" />
                </Field>
                <Field label="Ghi chú">
                  <Input name="description" defaultValue={s(old("description", user?.description))} autoComplete="off" />
                </Field>
              </div>
            </Section>
          </>
        }
        aside={
          <Section title="Ảnh đại diện">
            <ImageField name="image" defaultValue={s(old("image", user?.image))} aspect="aspect-square" />
          </Section>
        }
      />
    </>
  );
}

/** user/user/delete.blade.php */
export async function UserDelete({ user }: { user: NonNullable<User> }) {
  return (
    <>
      <PageHeader title="Xóa thành viên" crumbs={[{ label: "Thành viên", href: "/user/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/user/${user.id}/destroy`} name={`${user.name} (${user.email})`} title="Xóa thành viên" backHref="/user/index" />
    </>
  );
}

/* ------------------------------------------------------------------ Quyen */

/** permission/store.blade.php */
export async function PermissionStore({ method, permission }: { method: "create" | "edit"; permission: Permission }) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const url = method === "create" ? "/permission/store" : `/permission/${permission?.id}/update`;
  const title = method === "create" ? "Thêm mới quyền" : "Cập nhật quyền";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Quyền", href: "/permission/index" }, { label: title }]} />
      <FormErrors />
      <div className="mx-auto max-w-3xl">
        <AdminForm
          action={url}
          saveMode="single"
          cancelHref="/permission/index"
          main={
            <Section title="Thông tin chung" description={`Nhập thông tin chung của quyền. ${REQUIRED_NOTE}.`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tiêu đề" required error={errors.first("name")}>
                  <Input name="name" defaultValue={s(old("name", permission?.name))} autoComplete="off" aria-invalid={errors.has("name")} />
                </Field>
                <Field label="Canonical" required error={errors.first("canonical")} hint="Ví dụ: post.catalogue.index">
                  <Input name="canonical" defaultValue={s(old("canonical", permission?.canonical))} autoComplete="off" className="font-mono" aria-invalid={errors.has("canonical")} />
                </Field>
              </div>
            </Section>
          }
        />
      </div>
    </>
  );
}

/** permission/delete.blade.php (PermissionService::destroy de trong — handler luon bao loi) */
export async function PermissionDelete({ permission }: { permission: NonNullable<Permission> }) {
  return (
    <>
      <PageHeader title="Xóa quyền" crumbs={[{ label: "Quyền", href: "/permission/index" }, { label: "Xóa" }]} />
      <DeleteConfirm action={`/permission/${permission.id}/destroy`} name={`${permission.name} (${permission.canonical})`} title="Xóa quyền" backHref="/permission/index" />
    </>
  );
}
