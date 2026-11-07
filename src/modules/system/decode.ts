/**
 * renderSystem* cua ban goc in thang noi dung (khong escape) vao value="" / <textarea>,
 * nen trinh duyet giai ma entity (&Ocirc; -> Ô) truoc khi thanh gia tri o nhap.
 * React luon escape, vi vay giai ma truoc de gia tri o nhap giong het Laravel.
 */
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(
    " ",
  );

const NAMED: Record<string, number> = {
  amp: 38,
  lt: 60,
  gt: 62,
  quot: 34,
  apos: 39,
  ndash: 8211,
  mdash: 8212,
  lsquo: 8216,
  rsquo: 8217,
  ldquo: 8220,
  rdquo: 8221,
  bull: 8226,
  hellip: 8230,
  euro: 8364,
  trade: 8482,
};
LATIN1.forEach((name, i) => (NAMED[name] = 160 + i));

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    const code = NAMED[e];
    return code ? String.fromCodePoint(code) : m;
  });
}
