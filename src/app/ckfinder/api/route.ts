import { getAdmin } from "@/server/auth";
import {
  MediaError,
  createFolder,
  deleteFiles,
  deleteFolder,
  listFiles,
  listFolders,
  renameEntry,
  resourceType,
  saveUpload,
} from "@/server/media";

/**
 * API cho trinh chon file MediaPicker (thay connector.php cua CKFinder 2).
 * GET  ?command=GetFolders|GetFiles&type=Images&currentFolder=/a/
 * POST command=FileUpload|CreateFolder|DeleteFiles|RenameFile|RenameFolder|DeleteFolder
 */
async function guard() {
  return (await getAdmin()) ? null : Response.json({ error: "Bạn phải đăng nhập" }, { status: 401 });
}

function fail(e: unknown) {
  if (e instanceof MediaError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Có lỗi xảy ra" }, { status: 500 });
}

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const sp = new URL(req.url).searchParams;
  const type = resourceType(sp.get("type"));
  const folder = sp.get("currentFolder") ?? "/";
  try {
    switch (sp.get("command")) {
      case "GetFolders":
        return Response.json({ folders: await listFolders(type, folder) });
      case "GetFiles":
        return Response.json({ files: await listFiles(type, folder) });
      default:
        return Response.json({ error: "Lệnh không hợp lệ" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const form = await req.formData();
  const type = resourceType(String(form.get("type") ?? ""));
  const folder = String(form.get("currentFolder") ?? "/");
  try {
    switch (form.get("command")) {
      case "FileUpload": {
        const uploaded = [];
        for (const f of form.getAll("upload")) if (f instanceof File && f.size > 0) uploaded.push(await saveUpload(type, folder, f));
        return Response.json({ uploaded });
      }
      case "CreateFolder":
        await createFolder(type, folder, String(form.get("name") ?? ""));
        return Response.json({ ok: true });
      case "DeleteFiles":
        await deleteFiles(type, folder, form.getAll("files").map(String));
        return Response.json({ ok: true });
      case "RenameFile":
        await renameEntry(type, folder, String(form.get("from")), String(form.get("to")), false);
        return Response.json({ ok: true });
      case "RenameFolder":
        await renameEntry(type, folder, String(form.get("from")), String(form.get("to")), true);
        return Response.json({ ok: true });
      case "DeleteFolder":
        await deleteFolder(type, folder);
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "Lệnh không hợp lệ" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}
