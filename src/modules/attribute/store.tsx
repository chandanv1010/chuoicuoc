import { Field } from "@/components/admin/fields";
import { AdminForm, AlbumSection, ContentSection, FormErrors, PageHeader, PublishSection, Section, SeoSection } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { errorBag, oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import { withRawQuery } from "@/modules/product/query-string";
import type { getAttributeById } from "./attribute";
import type { AttributeCatalogueDetail } from "./attribute-catalogue";

type Attribute = Awaited<ReturnType<typeof getAttributeById>>;

/**
 * resources/views/backend/attribute/catalogue/store.blade.php (+ component/aside.blade.php).
 * Handler chi co 1 nut luu (send=send), luu xong ve trang danh sach.
 */
export async function AttributeCatalogueStore({
  method,
  attributeCatalogue,
  dropdown,
}: {
  method: "create" | "edit";
  attributeCatalogue: AttributeCatalogueDetail | null;
  dropdown: [string, string][];
}) {
  const old = await oldInput();
  const seo = __<Record<string, { title: string }>>("messages.attributeCatalogue");
  // Blade goc dung bien $query (khong ton tai) -> action update khong mang query
  const url = method === "create" ? "/attribute/catalogue/store" : `/attribute/catalogue/${attributeCatalogue?.id}/update`;
  const parentId = String(old("parent_id", attributeCatalogue?.parent_id ?? "0") ?? "0");
  return (
    <>
      <PageHeader
        title={seo[method].title}
        description="Loại thuộc tính dùng để tạo phiên bản sản phẩm, ví dụ: Màu sắc, Kích thước"
        crumbs={[{ label: seo.index.title, href: "/attribute/catalogue/index" }, { label: seo[method].title }]}
      />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/attribute/catalogue/index"
        saveMode="single"
        autoCanonical={!attributeCatalogue?.name}
        main={
          <>
            <ContentSection model={attributeCatalogue} />
            <AlbumSection album={attributeCatalogue?.album} />
            <SeoSection model={attributeCatalogue} />
          </>
        }
        aside={
          <>
            <Section title="Loại cha" description={__("messages.parentNotice")}>
              <Field>
                <Combobox name="parent_id" defaultValue={parentId} options={dropdown.map(([value, label]) => ({ value, label }))} />
              </Field>
            </Section>
            <PublishSection model={attributeCatalogue} hideImage />
          </>
        }
      />
    </>
  );
}

/** resources/views/backend/attribute/attribute/store.blade.php (+ component/aside.blade.php) */
export async function AttributeStore({
  method,
  attribute,
  dropdown,
  queryUrl = "",
}: {
  method: "create" | "edit";
  attribute: Attribute;
  dropdown: [string, string][];
  queryUrl?: string;
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.attribute");
  const url = method === "create" ? "/attribute/store" : withRawQuery(`/attribute/${attribute?.id}/update`, queryUrl);
  const options = dropdown.map(([value, label]) => ({ value, label }));
  const mainCatalogue = String(old("attribute_catalogue_id", attribute?.attribute_catalogue_id ?? "0") ?? "0");
  // Loai phu: tru loai chinh (dieu kien trong aside.blade.php)
  const subCatalogues = (old<string[] | undefined>("catalogue", undefined) ?? attribute?.catalogueIds ?? [])
    .map(String)
    .filter((k) => !attribute || k !== String(attribute.attribute_catalogue_id));
  return (
    <>
      <PageHeader
        title={seo[method].title}
        description="Giá trị của một loại thuộc tính, ví dụ: Đỏ, Xanh (Màu sắc) hoặc S, M, L (Kích thước)"
        crumbs={[{ label: seo.index.title, href: "/attribute/index" }, { label: seo[method].title }]}
      />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/attribute/index"
        saveMode="single"
        autoCanonical={!attribute?.name}
        main={
          <>
            <ContentSection model={attribute} />
            {/* Blade goc @include album khong truyen model nen moi lan luu deu xoa album; da sua: hien album da luu */}
            <AlbumSection album={attribute?.album} />
            <SeoSection model={attribute} />
          </>
        }
        aside={
          <>
            <Section title="Loại thuộc tính">
              <Field label="Loại chính" error={errors.first("attribute_catalogue_id")}>
                <Combobox name="attribute_catalogue_id" defaultValue={mainCatalogue} options={options} />
              </Field>
              <Field label="Loại phụ">
                <Combobox name="catalogue[]" multiple defaultValue={subCatalogues} options={options.filter((o) => o.value !== "0")} placeholder="Chọn loại phụ" />
              </Field>
            </Section>
            <PublishSection model={attribute} hideImage />
          </>
        }
      />
    </>
  );
}
