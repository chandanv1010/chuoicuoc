import "server-only";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * Thay phpspreadsheet (app/Exports/*.php): tao file .xlsx that (Office Open XML)
 * khong can thu vien ngoai — tu dong goi zip bang node:zlib.
 * Ho tro: o chuoi/so, gop o, font dam/co chu, can le, vien mong, do rong cot.
 */
export type CellStyle = { bold?: boolean; size?: number; align?: "left" | "center" | "right"; vAlign?: "center"; border?: boolean; wrap?: boolean };
export type Cell = { v: string | number | null; s?: CellStyle };
export type Sheet = {
  name: string;
  font: { name: string; size: number };
  rows: Record<number, Record<string, Cell>>; // rows[1]["A"]
  merges?: string[];
  widths?: Record<string, number>;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function colIndex(col: string) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const deflated = deflateRawSync(f.data);
    const crc = crc32(f.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // utf8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, deflated);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + deflated.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function buildXlsx(sheet: Sheet): Buffer {
  // Font / xf duoc tao dong theo cac style dung trong sheet
  const fonts: string[] = [`<font><sz val="${sheet.font.size}"/><name val="${esc(sheet.font.name)}"/></font>`];
  const fontKey = new Map<string, number>([[`0|${sheet.font.size}`, 0]]);
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const xfKey = new Map<string, number>([["", 0]]);
  const styleId = (s?: CellStyle) => {
    if (!s) return 0;
    const key = JSON.stringify([s.bold ?? false, s.size ?? sheet.font.size, s.align ?? "", s.vAlign ?? "", s.border ?? false, s.wrap ?? false]);
    const hit = xfKey.get(key);
    if (hit !== undefined) return hit;
    const fk = `${s.bold ? 1 : 0}|${s.size ?? sheet.font.size}`;
    let fontId = fontKey.get(fk);
    if (fontId === undefined) {
      fontId = fonts.length;
      fonts.push(`<font>${s.bold ? "<b/>" : ""}<sz val="${s.size ?? sheet.font.size}"/><name val="${esc(sheet.font.name)}"/></font>`);
      fontKey.set(fk, fontId);
    }
    const align =
      s.align || s.vAlign || s.wrap
        ? `<alignment${s.align ? ` horizontal="${s.align}"` : ""}${s.vAlign ? ` vertical="${s.vAlign}"` : ""}${s.wrap ? ' wrapText="1"' : ""}/>`
        : "";
    const id = xfs.length;
    xfs.push(
      `<xf numFmtId="0" fontId="${fontId}" fillId="0" borderId="${s.border ? 1 : 0}" xfId="0" applyFont="1"${s.border ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`,
    );
    xfKey.set(key, id);
    return id;
  };

  const rowNums = Object.keys(sheet.rows)
    .map(Number)
    .sort((a, b) => a - b);
  const rowsXml = rowNums
    .map((r) => {
      const cells = Object.entries(sheet.rows[r])
        .sort(([a], [b]) => colIndex(a) - colIndex(b))
        .map(([col, cell]) => {
          const ref = `${col}${r}`;
          const s = styleId(cell.s);
          if (cell.v === null || cell.v === "") return `<c r="${ref}" s="${s}"/>`;
          if (typeof cell.v === "number") return `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>`;
          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  const cols = sheet.widths
    ? `<cols>${Object.entries(sheet.widths)
        .map(([c, w]) => `<col min="${colIndex(c)}" max="${colIndex(c)}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${cols}<sheetData>${rowsXml}</sheetData>${merges}</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const files = [
    {
      name: "[Content_Types].xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheet.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", xml: sheetXml },
    { name: "xl/styles.xml", xml: stylesXml },
  ];
  return zip(files.map((f) => ({ name: f.name, data: Buffer.from(f.xml, "utf8") })));
}

/** setAutoSize(true) xap xi: do dai chuoi dai nhat trong cot. */
export function autoWidths(rows: Sheet["rows"], cols: string[], skipRows: number[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cols) {
    let max = 8;
    for (const [r, row] of Object.entries(rows)) {
      if (skipRows.includes(Number(r))) continue;
      const v = row[c]?.v;
      if (v !== null && v !== undefined) max = Math.max(max, [...String(v)].length * 1.2 + 2);
    }
    out[c] = Math.min(Math.round(max), 80);
  }
  return out;
}
