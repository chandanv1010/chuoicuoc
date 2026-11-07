import { Field, FileUrlInput } from "@/components/admin/fields";
import { SeoScorePanel } from "@/components/admin/seo-score";
import { AdminForm, AlbumSection, ContentSection, FormErrors, PageHeader, PublishSection, Section, SeoSection } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { oldInput } from "@/lib/flash";
import { __ } from "@/lib/lang";
import type { ProductCatalogueDetail } from "./product-catalogue";
import { withRawQuery } from "./query-string";

/** resources/views/backend/product/catalogue/store.blade.php (+ component/aside.blade.php) */
export async function ProductCatalogueStore({
  method,
  productCatalogue,
  dropdown,
  queryUrl = "",
}: {
  method: "create" | "edit";
  productCatalogue: ProductCatalogueDetail | null;
  dropdown: [string, string][];
  queryUrl?: string;
}) {
  const old = await oldInput();
  const seo = __<Record<string, { title: string }>>("messages.productCatalogue");
  const url = method === "create" ? "/product/catalogue/store" : withRawQuery(`/product/catalogue/${productCatalogue?.id}/update`, queryUrl);
  const parentId = String(old("parent_id", productCatalogue?.parent_id ?? "0") ?? "0");

  return (
    <>
      <PageHeader title={seo[method].title} crumbs={[{ label: seo.index.title, href: "/product/catalogue/index" }, { label: seo[method].title }]} />
      <FormErrors />
      <AdminForm
        action={url}
        cancelHref="/product/catalogue/index"
        autoCanonical={!productCatalogue?.name}
        main={
          <>
            <ContentSection model={productCatalogue} />
            <AlbumSection album={productCatalogue?.album} />
            <SeoSection model={productCatalogue} />
          </>
        }
        aside={
          <>
            <SeoScorePanel />
            <Section title="Danh mục cha" description={__("messages.parentNotice")}>
              <Field>
                <Combobox name="parent_id" defaultValue={parentId} options={dropdown.map(([value, label]) => ({ value, label }))} />
              </Field>
            </Section>
            <PublishSection model={productCatalogue}>
              <Field label="Icon danh mục" hint="Ảnh nhỏ hiển thị cạnh tên danh mục">
                <FileUrlInput name="icon" defaultValue={old<string>("icon", productCatalogue?.icon ?? "") ?? ""} placeholder="Đường dẫn icon" />
              </Field>
            </PublishSection>
          </>
        }
      />
    </>
  );
}
