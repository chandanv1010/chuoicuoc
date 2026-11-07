import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Field, ImageField } from "@/components/admin/fields";
import { AdminForm, PageHeader, Section } from "@/components/admin/page";
import { RichTextEditor } from "@/components/admin/rich-text/editor";
import { Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/interactive";
import { image } from "@/lib/helpers";
import { getLanguages } from "@/lib/language";
import { cn } from "@/lib/utils";
import type { ConfigItem, ConfigSchema } from "./config";
import { decodeEntities } from "./decode";

/**
 * resources/views/backend/system/index.blade.php (introduce/index.blade.php giong het,
 * chi khac route) + cac ham renderSystem* trong app/Helpers/MyHelper.php.
 * Moi khoi cau hinh la 1 tab; cac tab deu duoc render (forceMount) de form gui du config[...].
 * Luu y: old($name) cua ban goc doc key '<khoi>_<key>' nen khong bao gio co gia tri cu —
 * o day lay thang gia tri trong DB.
 */
type Values = Record<string, string>;

function ConfigField({ item, name, value }: { item: ConfigItem; name: string; value: string | undefined }) {
  const field = `config[${name}]`;
  // input/textarea cua ban goc in thang noi dung -> trinh duyet giai ma entity; editor giu nguyen HTML
  const v = decodeEntities(value ?? "");
  switch (item.type) {
    case "text":
      return <Input name={field} defaultValue={v} autoComplete="off" />;
    case "images":
      return <ImageField name={field} defaultValue={v} aspect="aspect-[3/1]" className="max-w-md" />;
    case "textarea":
      return <Textarea name={field} defaultValue={v} className="min-h-28" />;
    case "editor":
      return <RichTextEditor name={field} defaultValue={value ?? ""} height={220} />;
    case "select": {
      // option co 'selected' khi $key == $systems[$name]; khong co thi trinh duyet chon option dau
      const opts = item.option ?? {};
      return (
        <NativeSelect name={field} defaultValue={value !== undefined && value in opts ? value : undefined}>
          {Object.entries(opts).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
      );
    }
  }
}

export async function ConfigForm({
  title,
  action,
  translateBase,
  indexHref,
  schema,
  values,
  languageId,
  translating = false,
}: {
  title: string;
  action: string;
  translateBase: string; // vd "/system" -> /system/{id}/translate
  indexHref: string;
  schema: ConfigSchema;
  values: Values;
  /** ngon ngu dang sua (de to dam co tuong ung) */
  languageId: bigint;
  translating?: boolean;
}) {
  const languages = await getLanguages();
  const blocks = Object.entries(schema);
  const current = languages.find((l) => l.id === languageId);
  return (
    <>
      <PageHeader
        title={title}
        description={translating ? `Bản dịch: ${current?.name ?? `ngôn ngữ #${languageId}`}` : "Cấu hình theo ngôn ngữ đang dùng. Bấm cờ để sửa bản dịch."}
        crumbs={translating ? [{ label: title, href: indexHref }, { label: "Bản dịch" }] : [{ label: title }]}
        actions={
          languages.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
              {languages.map((language) => (
                <Link
                  key={language.id.toString()}
                  href={`${translateBase}/${language.id}/translate`}
                  title={language.name}
                  className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent", language.id === languageId && "bg-accent font-medium")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image(language.image)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                  {language.name}
                </Link>
              ))}
            </div>
          )
        }
      />
      <AdminForm
        action={action}
        saveMode="single"
        main={
          <Tabs defaultValue={blocks[0]?.[0]} className="grid gap-4">
            <div className="overflow-x-auto">
              <TabsList className="h-auto flex-wrap">
                {blocks.map(([key, block]) => (
                  <TabsTrigger key={key} value={key} className="flex-none py-1.5">
                    {block.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {blocks.map(([key, block]) => (
              <TabsContent key={key} value={key} forceMount className="data-[state=inactive]:hidden">
                <Section title={block.label} description={block.description || undefined}>
                  {Object.entries(block.value).map(([keyVal, item]) => {
                    const name = `${key}_${keyVal}`;
                    return (
                      <Field
                        key={keyVal}
                        label={item.label}
                        hint={item.title}
                        aside={
                          item.link && (
                            <a href={item.link.href} target={item.link.target} rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              {item.link.text} <ExternalLinkIcon className="size-3" />
                            </a>
                          )
                        }
                      >
                        <ConfigField item={item} name={name} value={values[name]} />
                      </Field>
                    );
                  })}
                </Section>
              </TabsContent>
            ))}
          </Tabs>
        }
      />
    </>
  );
}
