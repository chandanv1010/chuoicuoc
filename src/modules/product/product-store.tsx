import { Field } from "@/components/admin/fields";
import { AdminForm, AlbumSection, ContentSection, FormErrors, PageHeader, PublishSection, Section, SeoSection } from "@/components/admin/page";
import { Combobox } from "@/components/ui/combobox";
import { Input, Textarea } from "@/components/ui/form-controls";
import { errorBag, oldInput } from "@/lib/flash";
import { formatMoneyInput } from "@/lib/money";
import { __ } from "@/lib/lang";
import { SocialHistorySection, SocialPublishSection } from "@/modules/social/social-block";
import { MarketplaceSection } from "@/modules/marketplace/product-block";
import type { getProductById } from "./product";
import { withRawQuery } from "./query-string";
import { CodeInput, PriceInput, ProductFormProvider, VariantBuilder } from "./variant-builder";
import { loadVariantState } from "./variant-state";

type Product = Awaited<ReturnType<typeof getProductById>>;
export type AttributeCatalogueOption = { id: bigint; name: string | null };
export type LecturerOption = { id: bigint; name: string };


/**
 * resources/views/backend/product/product/store.blade.php
 * (+ component/content, component/variant, component/aside). Dung bien the: variant-builder.tsx.
 */
export async function ProductStore({
  method,
  product,
  dropdown,
  attributeCatalogue,
  languageId,
  queryUrl = "",
}: {
  method: "create" | "edit";
  product: Product;
  dropdown: [string, string][];
  attributeCatalogue: AttributeCatalogueOption[];
  /** ngon ngu hien tai (ten gia tri thuoc tinh khi nap lai bien the) */
  languageId: bigint;
  /** lecturers: Blade co select Giang vien an (class hidden); handler khong doc nen bo */
  lecturers?: LecturerOption[];
  queryUrl?: string;
}) {
  const [old, errors] = await Promise.all([oldInput(), errorBag()]);
  const seo = __<Record<string, { title: string }>>("messages.product");
  const url = method === "create" ? "/product/store" : withRawQuery(`/product/${product?.id}/update`, queryUrl);
  const options = dropdown.map(([value, label]) => ({ value, label }));
  const mainCatalogue = String(old("product_catalogue_id", product?.product_catalogue_id ?? "") ?? "");
  // Danh muc phu: tru danh muc chinh (dieu kien trong aside.blade.php)
  const subCatalogues = (old<string[] | undefined>("catalogue", undefined) ?? product?.catalogueIds ?? [])
    .map(String)
    .filter((k) => !product || k !== String(product.product_catalogue_id));
  // Gia USD hien "1,234.50" (old() sau loi validate la chuoi tron "1234.50")
  const price = formatMoneyInput(old("price", product ? product.price : "") ?? "");
  // Ma san pham mac dinh: time() (giay Unix) nhu Blade goc
  const code = String(old("code", product?.code ?? String(Math.floor(Date.now() / 1000))) ?? "");
  const variantInit = await loadVariantState(product, old, languageId);
  const catalogues = attributeCatalogue.map((c) => ({ id: c.id.toString(), name: c.name ?? `#${c.id}` }));
  const str = (k: string, v: unknown) => String(old(k, v ?? "") ?? "");

  return (
    <>
      <PageHeader title={seo[method].title} crumbs={[{ label: seo.index.title, href: "/product/index" }, { label: seo[method].title }]} />
      <FormErrors />
      <ProductFormProvider initialPrice={price} initialCode={code}>
        <AdminForm
          action={url}
          cancelHref="/product/index"
          autoCanonical={!product?.name}
          main={
            <>
              <ContentSection model={product} />
              <AlbumSection album={product?.album} />
              <Section title="Phiên bản sản phẩm" description="Bán các phiên bản khác nhau (màu sắc, kích thước...) với SKU, giá và tồn kho riêng">
                <VariantBuilder catalogues={catalogues} init={variantInit} />
              </Section>
              <SeoSection model={product} />
              <SocialPublishSection sourceType="Product" item={product} />
            </>
          }
          aside={
            <>
              <Section title="Danh mục">
                <Field label="Danh mục chính" required error={errors.first("product_catalogue_id")}>
                  <Combobox name="product_catalogue_id" defaultValue={mainCatalogue} options={options} placeholder="Chọn danh mục" />
                </Field>
                <Field label="Danh mục phụ">
                  <Combobox name="catalogue[]" multiple defaultValue={subCatalogues} options={options.filter((o) => o.value !== "0")} placeholder="Chọn danh mục phụ" />
                </Field>
              </Section>
              {/* Da bo cac truong WACO website khong dung: xuat xu, bao hanh, uu dai rieng, ma QR, noi dung khoa hoc */}
              <Section title="Thông tin sản phẩm">
                <Field label="Mã sản phẩm" hint="Dùng làm tiền tố SKU của các phiên bản">
                  <CodeInput />
                </Field>
                <Field label="Giá bán" error={errors.first("price")}>
                  <PriceInput name="price" placeholder="0.00" />
                </Field>
                <Field label="Tồn kho" error={errors.first("stock")}>
                  {/* Da sua: ban goc luon hien 0 vi getProductById khong lay cot stock */}
                  <Input name="stock" type="number" min={0} defaultValue={str("stock", product?.stock ?? 0)} aria-invalid={errors.has("stock")} />
                </Field>
              </Section>
              <Section title="Video & thông số">
                <Field label="Video YouTube" hint="Dán link YouTube (https://www.youtube.com/watch?v=...) hoặc mã nhúng iframe. Video hiện thành một mục trong dải ảnh sản phẩm.">
                  <Textarea name="iframe" defaultValue={str("iframe", product?.iframe)} placeholder="https://www.youtube.com/watch?v=..." className="min-h-20 font-mono text-xs" />
                </Field>
                <Field label="Thông số kỹ thuật" hint='Mỗi dòng một thông số, dạng "Tên: Giá trị"'>
                  <Textarea
                    name="specification"
                    defaultValue={str("specification", product?.specification)}
                    placeholder={"Material: 100% cotton twill\nSize: Adjustable, fits 56–60 cm"}
                    className="min-h-40"
                  />
                </Field>
              </Section>
              <PublishSection model={product} />
            </>
          }
        />
      </ProductFormProvider>
      {product && <SocialHistorySection sourceType="Product" sourceId={product.id} />}
      {product && <MarketplaceSection productId={product.id} productName={product.name ?? ""} />}
    </>
  );
}
