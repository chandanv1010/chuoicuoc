import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseForm, str } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { getAdmin } from "@/server/auth";
import { getOrdersByDate } from "@/modules/order/order";
import { autoWidths, buildXlsx, type Cell, type Sheet } from "@/modules/order/xlsx";
import { getCustomersByDate } from "@/modules/customer/customer";

/**
 * POST ajax/excel/export — Ajax\ExcelController@export (app/Exports/OrderExport.php, CustomerExport.php).
 * Laravel ghi file vao public/temp/ roi tra file_url = url('temp/...'). O day file ghi vao
 * thu muc tam cua he dieu hanh va tai ve qua GET ajax/excel/export?file=<ten file>.
 */
const DIR = path.join(tmpdir(), "next-core-excel");
const FILES = { order: "Danh_sach_don_hang.xlsx", customer: "Danh_sach_khach_hang.xlsx" } as const;

const FONT = { name: "Times New Roman", size: 13 };
const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 19).replace("T", " ") : "");

function orderSheet(orders: Awaited<ReturnType<typeof getOrdersByDate>>): Sheet {
  const rows: Sheet["rows"] = { 1: { A: { v: "Danh sách đơn hàng", s: { bold: true, size: 16, align: "center" } } } };
  const headings = ["Mã đơn hàng", "Ngày tạo", "Khách hàng", "Số điện thoại", "Địa chỉ", "Tổng cuối", "Trạng thái", "Giao hàng", "Hình thức"];
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const lastRow = 3 + orders.length;
  // Style: header A3:G3 dam + can giua; vien + wrap A3:I{last}; can le cot A (giua), B/C/E (trai)
  const style = (col: string, r: number) => {
    const s: Cell["s"] = { border: true, wrap: true };
    if (r === 3 && "ABCDEFG".includes(col)) Object.assign(s, { bold: true, align: "center", vAlign: "center" });
    if (r <= lastRow && col === "A") s.align = "center";
    if (r <= lastRow && "BCE".includes(col)) s.align = "left";
    return s;
  };
  rows[3] = Object.fromEntries(headings.map((h, i) => [cols[i], { v: h, s: style(cols[i], 3) }]));
  orders.forEach((o, idx) => {
    const r = 4 + idx;
    // Tong cuoi: ban goc ghi cung "2300000đ" ($order->total khong ton tai); ban nay ghi tong that bang USD.
    // Trang thai / giao hang giu gia tri mac dinh nhu ban goc.
    const values = [o.code, fmt(o.created_at), o.fullname ?? "", o.phone ?? "", o.address ?? "", formatMoney(o.total), "Chờ thanh toán", "Chưa giao", o.method ?? ""];
    rows[r] = Object.fromEntries(values.map((v, i) => [cols[i], { v, s: style(cols[i], r) }]));
  });
  return { name: "Worksheet", font: FONT, rows, merges: ["A1:G1"], widths: autoWidths(rows, cols, [1]) };
}

function customerSheet(customers: Awaited<ReturnType<typeof getCustomersByDate>>): Sheet {
  const rows: Sheet["rows"] = { 1: { A: { v: "Danh sách khách hàng", s: { bold: true, size: 16, align: "center" } } } };
  const headings = ["STT", "Họ và tên", "Email", "Số điện thoại", "Địa chỉ", "Nhóm khách hàng", "Nguồn khách"];
  const cols = ["A", "B", "C", "D", "E", "F", "G"];
  const style = (col: string, r: number) => {
    const s: Cell["s"] = { border: true, wrap: true };
    if (r === 3) Object.assign(s, { bold: true, align: "center", vAlign: "center" });
    if (col === "A") s.align = "center";
    if ("BCE".includes(col)) s.align = "left";
    return s;
  };
  rows[3] = Object.fromEntries(headings.map((h, i) => [cols[i], { v: h, s: style(cols[i], 3) }]));
  customers.forEach((c, idx) => {
    const r = 4 + idx;
    // $customer->group / $customer->source khong phai relation cua model -> rong (giu nguyen)
    const values: (string | number)[] = [idx + 1, c.name ?? "", c.email ?? "", c.phone ?? "", c.address ?? "", "", ""];
    rows[r] = Object.fromEntries(values.map((v, i) => [cols[i], { v, s: style(cols[i], r) }]));
  });
  return { name: "Worksheet", font: FONT, rows, merges: ["A1:G1"], widths: autoWidths(rows, cols, [1]) };
}

export async function POST(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const input = parseForm(await req.formData());
  const model = str(input, "model");
  const startDate = str(input, "startDate");
  const endDate = str(input, "endDate");
  let file: string;
  let filename: string;
  let buffer: Buffer;
  if (model === "Customer") {
    buffer = buildXlsx(customerSheet(await getCustomersByDate(startDate, endDate)));
    file = FILES.customer;
    filename = "Danh_sach_khach_hang";
  } else if (model === "Order") {
    buffer = buildXlsx(orderSheet(await getOrdersByDate(startDate, endDate)));
    file = FILES.order;
    filename = "Danh_sach_don_hang";
  } else {
    // loadClass() tra null -> ban goc loi 500
    return Response.json({ message: "Server Error" }, { status: 500 });
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, file), buffer);
  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/?$/, "/");
  return Response.json({ status: "success", file_url: `${base}ajax/excel/export?file=${file}`, filename });
}

/** Tai file vua xuat (thay cho public/temp/*.xlsx cua Laravel). */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Unauthenticated." }, { status: 401 });
  const file = new URL(req.url).searchParams.get("file");
  if (file !== FILES.order && file !== FILES.customer) return new Response("404 | Not Found", { status: 404 });
  try {
    const data = await readFile(path.join(DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("404 | Not Found", { status: 404 });
  }
}
