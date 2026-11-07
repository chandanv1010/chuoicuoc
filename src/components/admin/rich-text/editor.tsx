"use client";

import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Youtube } from "@tiptap/extension-youtube";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CodeXmlIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ImagesIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";
import { MediaPicker } from "../media-picker";
import { Div, Figcaption, Figure, GlobalAttributes, Iframe } from "./extensions";

/**
 * Trinh soan thao (thay CKEditor 4). Gia tri HTML gui qua <textarea name hidden>
 * nen form POST thuong nhan duoc nhu cu (name="content", "description"...).
 */
type Props = {
  name: string;
  defaultValue?: string | null;
  /** chieu cao toi thieu vung soan thao (px), giong data-height cu */
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  /** an bot nut cho o mo ta ngan */
  compact?: boolean;
};

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
          active && "bg-accent text-foreground",
        )}
      >
        <Icon className="size-4" />
      </button>
    </Tooltip>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;

function Toolbar({
  editor,
  source,
  onToggleSource,
  onPickImages,
  compact,
}: {
  editor: Editor;
  source: boolean;
  onToggleSource: () => void;
  onPickImages: (multiple: boolean) => void;
  compact?: boolean;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const off = source;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Địa chỉ liên kết (để trống để bỏ liên kết):", prev ?? "https://");
    if (url === null) return;
    if (url === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b bg-card/95 px-1.5 py-1 backdrop-blur">
      <ToolButton icon={Undo2Icon} label="Hoàn tác" disabled={off || !s.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2Icon} label="Làm lại" disabled={off || !s.canRedo} onClick={() => chain().redo().run()} />
      <Sep />
      {!compact && (
        <>
          <ToolButton icon={PilcrowIcon} label="Đoạn văn" disabled={off} onClick={() => chain().setParagraph().run()} />
          <ToolButton icon={Heading2Icon} label="Tiêu đề 2" active={s.h2} disabled={off} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
          <ToolButton icon={Heading3Icon} label="Tiêu đề 3" active={s.h3} disabled={off} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
          <Sep />
        </>
      )}
      <ToolButton icon={BoldIcon} label="Đậm" active={s.bold} disabled={off} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={ItalicIcon} label="Nghiêng" active={s.italic} disabled={off} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={UnderlineIcon} label="Gạch chân" active={s.underline} disabled={off} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton icon={StrikethroughIcon} label="Gạch ngang" active={s.strike} disabled={off} onClick={() => chain().toggleStrike().run()} />
      <ToolButton icon={RemoveFormattingIcon} label="Xóa định dạng" disabled={off} onClick={() => chain().unsetAllMarks().clearNodes().run()} />
      <Sep />
      <ToolButton icon={ListIcon} label="Danh sách" active={s.bullet} disabled={off} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrderedIcon} label="Danh sách số" active={s.ordered} disabled={off} onClick={() => chain().toggleOrderedList().run()} />
      {!compact && <ToolButton icon={QuoteIcon} label="Trích dẫn" active={s.quote} disabled={off} onClick={() => chain().toggleBlockquote().run()} />}
      <Sep />
      <ToolButton icon={AlignLeftIcon} label="Căn trái" active={s.left} disabled={off} onClick={() => chain().setTextAlign("left").run()} />
      <ToolButton icon={AlignCenterIcon} label="Căn giữa" active={s.center} disabled={off} onClick={() => chain().setTextAlign("center").run()} />
      <ToolButton icon={AlignRightIcon} label="Căn phải" active={s.right} disabled={off} onClick={() => chain().setTextAlign("right").run()} />
      <ToolButton icon={AlignJustifyIcon} label="Căn đều" active={s.justify} disabled={off} onClick={() => chain().setTextAlign("justify").run()} />
      <Sep />
      <ToolButton icon={LinkIcon} label="Liên kết" active={s.link} disabled={off} onClick={setLink} />
      <ToolButton icon={ImageIcon} label="Chèn ảnh" disabled={off} onClick={() => onPickImages(false)} />
      {!compact && (
        <>
          <ToolButton icon={ImagesIcon} label="Chèn nhiều ảnh (có chú thích)" disabled={off} onClick={() => onPickImages(true)} />
          <ToolButton
            icon={TableIcon}
            label="Chèn bảng 3×3"
            disabled={off}
            onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          />
          <ToolButton
            icon={VideoIcon}
            label="Chèn video YouTube"
            disabled={off}
            onClick={() => {
              const url = window.prompt("Đường dẫn video YouTube:");
              if (url) chain().setYoutubeVideo({ src: url }).run();
            }}
          />
          <ToolButton icon={MinusIcon} label="Đường kẻ ngang" disabled={off} onClick={() => chain().setHorizontalRule().run()} />
        </>
      )}
      <div className="flex-1" />
      <ToolButton icon={CodeXmlIcon} label={source ? "Quay lại soạn thảo" : "Sửa mã HTML"} active={source} onClick={onToggleSource} />
    </div>
  );
}

export function RichTextEditor({ name, defaultValue, height = 300, placeholder, disabled, compact }: Props) {
  const [html, setHtml] = useState(defaultValue ?? "");
  const [source, setSource] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; multiple: boolean }>({ open: false, multiple: false });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: true, allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      GlobalAttributes,
      Div,
      Figure,
      Figcaption,
      Iframe,
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: { class: "rich-content ProseMirror px-4 py-3", "data-placeholder": placeholder ?? "" },
    },
    onUpdate: ({ editor: e }) => setHtml(e.isEmpty ? "" : e.getHTML()),
  });

  const toggleSource = () => {
    if (!editor) return;
    if (source) editor.commands.setContent(html, { emitUpdate: false });
    setSource((v) => !v);
  };

  const insertImages = (urls: string[]) => {
    if (!editor || !urls.length) return;
    if (picker.multiple) {
      // Giong nut "Upload nhieu hinh anh" cu: moi anh mot <figure> co chu thich
      const block = urls
        .map((u) => `<div class="image-content"><figure><img src="${u}" alt="${u}"><figcaption>Nhập vào mô tả cho ảnh</figcaption></figure></div>`)
        .join("");
      editor.chain().focus().insertContent(block).run();
    } else {
      editor.chain().focus().setImage({ src: urls[0], alt: urls[0] }).run();
    }
  };

  return (
    <div className={cn("min-w-0 rounded-md border border-input bg-card shadow-xs", disabled && "opacity-60")}>
      <textarea name={name} value={html} readOnly hidden />
      {editor && (
        <Toolbar
          editor={editor}
          source={source}
          onToggleSource={toggleSource}
          onPickImages={(multiple) => setPicker({ open: true, multiple })}
          compact={compact}
        />
      )}
      {source ? (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          className="block w-full resize-y rounded-b-md bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed outline-none"
          style={{ minHeight: height }}
        />
      ) : (
        <div style={{ minHeight: height }} className="cursor-text" onClick={() => editor?.commands.focus()}>
          {editor ? <EditorContent editor={editor} style={{ minHeight: height }} /> : <div className="rich-content px-4 py-3" style={{ minHeight: height }} dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      )}
      <MediaPicker open={picker.open} multiple={picker.multiple} onOpenChange={(open) => setPicker((p) => ({ ...p, open }))} onSelect={insertImages} />
    </div>
  );
}
