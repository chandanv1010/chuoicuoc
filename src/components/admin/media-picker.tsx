"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * Trinh quan ly file (thay CKFinder 2) dang hop thoai React.
 * API: /ckfinder/api (src/app/ckfinder/api/route.ts), anh xem truoc: /ckfinder/thumb.
 *
 *   <MediaPicker open={open} onOpenChange={setOpen} multiple onSelect={(urls) => ...} />
 */
export type MediaType = "Images" | "Files" | "Flash";
type FileItem = { name: string; size: number; date: string; url: string };
type FolderItem = { name: string; hasChildren: boolean };

const isImage = (name: string) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

async function api<T>(command: string, type: MediaType, folder: string, body?: Record<string, string | string[] | File[]>): Promise<T> {
  let res: Response;
  if (!body) {
    res = await fetch(`/ckfinder/api?command=${command}&type=${type}&currentFolder=${encodeURIComponent(folder)}`);
  } else {
    const fd = new FormData();
    fd.append("command", command);
    fd.append("type", type);
    fd.append("currentFolder", folder);
    for (const [k, v] of Object.entries(body)) {
      if (Array.isArray(v)) for (const x of v) fd.append(k, x);
      else fd.append(k, v);
    }
    res = await fetch("/ckfinder/api", { method: "POST", body: fd });
  }
  const json = await res.json().catch(() => ({ error: `Lỗi ${res.status}` }));
  if (!res.ok || json.error) throw new Error(json.error ?? `Lỗi ${res.status}`);
  return json as T;
}

function FolderNode({
  path,
  label,
  hasChildren,
  current,
  type,
  version,
  onOpen,
}: {
  path: string;
  label: string;
  hasChildren: boolean;
  current: string;
  type: MediaType;
  version: number;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(path === "/" || current.startsWith(path));
  const [children, setChildren] = useState<FolderItem[] | null>(null);

  useEffect(() => {
    if (!expanded || !hasChildren) return;
    api<{ folders: FolderItem[] }>("GetFolders", type, path)
      .then((r) => setChildren(r.folders))
      .catch(() => setChildren([]));
  }, [expanded, hasChildren, path, type, version]);

  const active = current === path;
  return (
    <li>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm select-none",
          active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
        )}
        onClick={() => {
          onOpen(path);
          setExpanded(true);
        }}
      >
        <button
          type="button"
          className={cn("flex size-4 items-center justify-center", !hasChildren && "invisible")}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => !x);
          }}
        >
          <ChevronRightIcon className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        {active ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0 text-amber-500" />}
        <span className="truncate">{label}</span>
      </div>
      {expanded && children && children.length > 0 && (
        <ul className="ml-3 border-l pl-1">
          {children.map((c) => (
            <FolderNode key={c.name} path={`${path}${c.name}/`} label={c.name} hasChildren={c.hasChildren} current={current} type={type} version={version} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  type = "Images",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
  type?: MediaType;
}) {
  const storageKey = `media-folder-${type}`;
  const [folder, setFolder] = useState("/");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [query, setQuery] = useState("");
  const [treeVersion, setTreeVersion] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      try {
        const r = await api<{ files: FileItem[] }>("GetFiles", type, path);
        setFiles(r.files);
      } catch (e) {
        if (path !== "/") {
          setFolder("/");
          return;
        }
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    if (!open) return;
    let start = "/";
    try {
      start = localStorage.getItem(storageKey) ?? "/";
    } catch {}
    setFolder(start);
    setSelected([]);
    setQuery("");
  }, [open, storageKey]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(storageKey, folder);
    } catch {}
    void load(folder);
  }, [open, folder, load, storageKey]);

  const visible = useMemo(() => files.filter((f) => !query || f.name.toLowerCase().includes(query.toLowerCase())), [files, query]);

  const toggle = (f: FileItem) => {
    setSelected((prev) => (prev.includes(f.name) ? prev.filter((x) => x !== f.name) : multiple ? [...prev, f.name] : [f.name]));
  };

  const confirm = (names = selected) => {
    const urls = names.map((n) => files.find((f) => f.name === n)?.url).filter(Boolean) as string[];
    if (!urls.length) return;
    onSelect(urls);
    onOpenChange(false);
  };

  const upload = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading(arr.length);
    try {
      const r = await api<{ uploaded: { name: string }[] }>("FileUpload", type, folder, { upload: arr });
      toast.success(`Đã tải lên ${r.uploaded.length} file`);
      await load(folder);
      setSelected(multiple ? r.uploaded.map((u) => u.name) : r.uploaded.slice(0, 1).map((u) => u.name));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(0);
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const parentOf = (p: string) => {
    const parts = p.split("/").filter(Boolean);
    parts.pop();
    return `/${parts.length ? `${parts.join("/")}/` : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,760px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3.5">
          <DialogTitle className="text-base">Thư viện {type === "Images" ? "ảnh" : type === "Flash" ? "video" : "file"}</DialogTitle>
          <DialogDescription className="text-xs">
            {multiple ? "Chọn một hoặc nhiều file (bấm để chọn, bấm đúp để chọn ngay)" : "Bấm để chọn, bấm đúp để chọn ngay"}. Kéo thả file vào để tải lên.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Tải lên
          </Button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).then(() => (e.target.value = ""))} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const name = prompt("Tên thư mục mới:");
              if (name) void run(() => api("CreateFolder", type, folder, { name }).then(() => setTreeVersion((v) => v + 1)), `Đã tạo thư mục ${name}`);
            }}
          >
            <FolderPlusIcon /> Thư mục mới
          </Button>
          {folder !== "/" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const old = folder.split("/").filter(Boolean).pop() ?? "";
                  const name = prompt("Tên mới cho thư mục:", old);
                  if (!name || name === old) return;
                  const parent = parentOf(folder);
                  void run(
                    () =>
                      api("RenameFolder", type, parent, { from: old, to: name }).then(() => {
                        setTreeVersion((v) => v + 1);
                        setFolder(`${parent}${name}/`);
                      }),
                    "Đã đổi tên thư mục",
                  );
                }}
              >
                <PencilIcon /> Đổi tên thư mục
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (!confirm2(`Xóa thư mục "${folder}" và toàn bộ file bên trong?`)) return;
                  const parent = parentOf(folder);
                  void run(
                    () =>
                      api("DeleteFolder", type, folder, {}).then(() => {
                        setTreeVersion((v) => v + 1);
                        setFolder(parent);
                      }),
                    "Đã xóa thư mục",
                  );
                }}
              >
                <Trash2Icon /> Xóa thư mục
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => void load(folder)} aria-label="Làm mới">
            <RefreshCwIcon />
          </Button>
          <div className="relative ml-auto w-full sm:w-56">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lọc theo tên..." className="h-8 pl-8" />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <ul className="hidden w-56 shrink-0 overflow-y-auto border-r bg-muted/30 p-2 md:block">
            <FolderNode key={treeVersion} path="/" label={type} hasChildren current={folder} type={type} version={treeVersion} onOpen={setFolder} />
          </ul>
          <div
            className={cn("relative min-w-0 flex-1 overflow-y-auto p-4", dragOver && "bg-primary/5 outline-2 -outline-offset-8 outline-primary outline-dashed")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void upload(e.dataTransfer.files);
            }}
          >
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <UploadIcon className="size-8" />
                Thư mục trống — kéo thả file vào đây hoặc bấm “Tải lên”.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {visible.map((f) => {
                  const on = selected.includes(f.name);
                  return (
                    <button
                      type="button"
                      key={f.name}
                      title={f.name}
                      onClick={() => toggle(f)}
                      onDoubleClick={() => confirm([f.name])}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-md",
                        on && "border-primary ring-2 ring-primary/40",
                      )}
                    >
                      <span className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                        {isImage(f.name) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/ckfinder/thumb?url=${encodeURIComponent(f.url)}`} alt={f.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-muted-foreground">
                            <FileIcon className="size-8" />
                            <span className="text-xs font-semibold uppercase">{f.name.split(".").pop()}</span>
                          </span>
                        )}
                      </span>
                      <span className="truncate px-2 pt-1.5 text-xs">{f.name}</span>
                      <span className="px-2 pb-1.5 text-[11px] text-muted-foreground">{fmtSize(f.size)}</span>
                      {on && (
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="size-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {visible.length} file{selected.length ? ` · đã chọn ${selected.length}` : ""}
          </span>
          {selected.length > 0 && (
            <>
              {selected.length === 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const old = selected[0];
                    const name = prompt("Tên mới:", old);
                    if (!name || name === old) return;
                    void run(
                      () =>
                        api("RenameFile", type, folder, { from: old, to: name }).then(async () => {
                          await load(folder);
                          setSelected([name]);
                        }),
                      "Đã đổi tên",
                    );
                  }}
                >
                  <PencilIcon /> Đổi tên
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (!confirm2(`Xóa ${selected.length} file đã chọn?`)) return;
                  void run(
                    () =>
                      api("DeleteFiles", type, folder, { files: selected }).then(async () => {
                        setSelected([]);
                        await load(folder);
                      }),
                    "Đã xóa file",
                  );
                }}
              >
                <Trash2Icon /> Xóa
              </Button>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={() => confirm()} disabled={!selected.length}>
              <CheckIcon /> Chọn{selected.length > 1 ? ` (${selected.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function confirm2(message: string) {
  return window.confirm(message);
}
