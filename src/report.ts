import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// fontkit's Indic shaper needs regeneratorRuntime in scope (UMD global) —
// missing in browsers AND node without this tiny side-effect polyfill.
import "regenerator-runtime/runtime.js";
import bidiFactory from "bidi-js";
import { bandFor, type Child, type Observation } from "./types";
import i18n from "./i18n";
import fontRegularUrl from "./assets/fonts/NotoSans-Regular.ttf?url";
import fontBoldUrl from "./assets/fonts/NotoSans-Bold.ttf?url";
import fontArabicUrl from "./assets/fonts/NotoSansArabic-Regular.ttf?url";
import fontDevaUrl from "./assets/fonts/NotoSansDevanagari-Regular.ttf?url";
import fontCjkUrl from "./assets/fonts/NotoSansSC-GB.otf?url";

const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52);
const ACCENT = rgb(0.05, 0.6, 0.55);
const LINE = rgb(0.85, 0.87, 0.9);

const PAGE_W = 595;
const PAGE_H = 842; // A4
const TOP_Y = 800;
// Reserve the strip below this for the fixed footer (drawn at y≈46/34).
const BOTTOM_Y = 64;

const zoneLabel = (z: string) => i18n.t(`zones.${z}`, { defaultValue: z });
const intervLabel = (id: string): string => i18n.t(`interventions.${id}`, { defaultValue: id });

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;   // regular face (= faces.base)
  bold: PDFFont;   // bold face (= faces.bold)
  faces: Faces;
  y: number;
  left: number;
  width: number;
}

// Script coverage: pick the embedded face that can render each codepoint.
// If font assets fail to load, buildReport throws — no silent text stripping.
type FaceKey = "base" | "bold" | "arabic" | "deva" | "cjk";
interface Faces { base: PDFFont; bold: PDFFont; arabic: PDFFont; deva: PDFFont; cjk: PDFFont }

const RE_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RE_DEVA = /[\u0900-\u097F]/;
const RE_CJK = /[\u2E80-\u2EFF\u3000-\u303F\u3040-\u30FF\u3100-\u312F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFF9F]/;
const RE_RTL = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function faceOf(ch: string): FaceKey {
  if (RE_ARABIC.test(ch)) return "arabic";
  if (RE_DEVA.test(ch)) return "deva";
  if (RE_CJK.test(ch)) return "cjk";
  return "base";
}

// Control/format chars are never drawable content — drop them only.
// ZWJ/ZWNJ are kept: they are REQUIRED for correct Indic/Arabic shaping.
// Newlines are kept: they are content (wrapText honours them).
function sanitize(s: string): string {
  return s
    // oxlint-disable-next-line no-control-regex — intentionally strips control/format chars
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/gu, "")
    .replace(/\t/g, " ");
}

const bidi = bidiFactory();
// Returns the text's directional runs in VISUAL (left-to-right) order.
// Each returned slice is LOGICAL text — fontkit shapes RTL runs correctly
// on its own; we only fix the ORDER of runs, never chars inside a run.
// getReorderSegments gives [start,end] inclusive ranges to reverse (UAX L2).
function visualRuns(s: string): string[] {
  const clean = sanitize(s);
  if (!clean || !RE_RTL.test(clean)) return [clean];
  const levels = bidi.getEmbeddingLevels(clean);
  // bidi-js indexes by UTF-16 code unit (it pairs with string slicing).
  const perm: number[] = Array.from({ length: clean.length }, (_, i) => i);
  for (const [a, e] of bidi.getReorderSegments(clean, levels) as [number, number][]) {
    for (let i = a, j = e; i < j; i++, j--) [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const lv = levels.levels;
  const out: string[] = [];
  let lo = perm[0], hi = perm[0], dir = lv[perm[0]] % 2;
  for (let i = 1; i <= perm.length; i++) {
    const idx = perm[i];
    const d = i < perm.length ? lv[idx] % 2 : -1;
    // extend a run while same direction class AND contiguous in the source
    if (i < perm.length && d === dir && (idx === lo - 1 || idx === hi + 1)) {
      lo = Math.min(lo, idx); hi = Math.max(hi, idx);
    } else {
      out.push(clean.slice(lo, hi + 1));
      lo = idx; hi = idx; dir = d;
    }
  }
  return out;
}

function runs(s: string): { text: string; face: FaceKey }[] {
  const out: { text: string; face: FaceKey }[] = [];
  let cur = "";
  let face: FaceKey | null = null;
  const flush = () => { if (cur) { out.push({ text: cur, face: face! }); cur = ""; face = null; } };
  for (const seg of visualRuns(s)) {
    for (const ch of seg) {
      const f = faceOf(ch);
      if (f !== face) { flush(); face = f; }
      cur += ch;
    }
    flush(); // never merge across directional runs
  }
  return out;
}

function measure(faces: Faces, s: string, size: number): number {
  return runs(s).reduce((w, r) => w + faces[r.face].widthOfTextAtSize(r.text, size), 0);
}

// Draw one logical string as direction+face segmented runs at advancing x.
function drawRuns(ctx: Ctx, s: string, x: number, y: number, o: { size: number; bold?: boolean; color: typeof INK }) {
  let cx = x;
  for (const r of runs(s)) {
    const f = o.bold && r.face === "base" ? ctx.faces.bold : ctx.faces[r.face];
    ctx.page.drawText(r.text, { x: cx, y, size: o.size, font: f, color: o.color });
    cx += f.widthOfTextAtSize(r.text, o.size);
  }
}

// A horizontal rule needs its own reserved space: drawn at ctx.y it sits
// inside the next line's ascent zone. Clearance: 4pt below the previous
// baseline slot, and the next baseline is pushed 12pt below the rule so its
// ~10pt ascender can never touch it.
function rule(ctx: Ctx, color: typeof INK, thickness = 0.7) {
  ctx.y -= 4;
  ctx.page.drawLine({ start: { x: ctx.left, y: ctx.y }, end: { x: ctx.left + ctx.width, y: ctx.y }, thickness, color });
  ctx.y -= 12;
}

function t(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(`report.pdf.${key}`, opts);
}

function wrapText(ctx: Ctx, text: string, size: number, maxWidth: number): string[] {
  const width = (s: string) => measure(ctx.faces, s, size);
  const lines: string[] = [];
  // Split real line breaks first — user-typed newlines are preserved.
  for (const para of sanitize(text).split(/\n/)) {
    const words = para.split(/[ \r\f\v\u00A0]+/u).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (width(next) <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        // A single word wider than the column: cut at CODEPOINT boundaries
        // (CJK text has no spaces; hyphenless so we never inject latin chars;
        // codepoint slicing never splits a surrogate pair or ZWJ sequence's
        // base+modifier pair — a broken ZWJ just renders unjoined).
        let cps = [...w];
        while (width(cps.join("")) > maxWidth && cps.length > 1) {
          let cut = cps.length - 1;
          while (cut > 1 && width(cps.slice(0, cut).join("")) > maxWidth) cut--;
          lines.push(cps.slice(0, cut).join(""));
          cps = cps.slice(cut);
        }
        cur = cps.join("");
      }
    }
    if (cur || words.length === 0) lines.push(cur);
  }
  return lines;
}

function truncToWidth(ctx: Ctx, s: string, size: number, maxWidth: number): string {
  const cps = [...sanitize(s)]; // codepoints — never split a surrogate pair
  const width = (x: string) => measure(ctx.faces, x, size);
  if (width(cps.join("")) <= maxWidth) return cps.join("");
  while (cps.length > 1 && width(cps.join("") + "…") > maxWidth) cps.pop();
  return cps.join("") + "…";
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = TOP_Y;
}

// Content may never be drawn below the footer zone; overflow opens a page.
function ensureSpace(ctx: Ctx, needed: number): boolean {
  if (ctx.y - needed < BOTTOM_Y) {
    newPage(ctx);
    return true;
  }
  return false;
}

function line(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; color?: typeof INK; gap?: number } = {}) {
  const size = opts.size ?? 9.5;
  for (const l of wrapText(ctx, text, size, ctx.width)) {
    ensureSpace(ctx, size + 4.5);
    drawRuns(ctx, l, ctx.left, ctx.y, { size, bold: opts.bold, color: opts.color ?? INK });
    ctx.y -= size + 4.5;
  }
  ctx.y -= (opts.gap ?? size + 4.5) - (size + 4.5);
}

function heading(ctx: Ctx, text: string) {
  // Keep a heading attached to at least the first line of its section.
  ensureSpace(ctx, 50);
  ctx.y -= 6;
  line(ctx, text.toUpperCase(), { bold: true, size: 8.5, color: ACCENT, gap: 9 });
  rule(ctx, LINE);
}

function fmtDate(ms: number): string {
  const loc = i18n.language === "fr" ? "fr-FR" : "en-GB";
  return new Date(ms).toLocaleDateString(loc, { day: "2-digit", month: "short" }) + " " +
    new Date(ms).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
}

export interface ReportOptions {
  periodDays: number | null; // null = everything
  questions: string[];
}

const COLS = [0, 86, 126, 182, 226, 318]; // date, score, band, duration, areas, cause/note
const COL_W = [86, 40, 56, 44, 92, 181];

function drawTableHeader(ctx: Ctx, headerRow: string[]) {
  headerRow.forEach((h, i) => {
    drawRuns(ctx, h, ctx.left + COLS[i], ctx.y, { size: 7.5, bold: true, color: MUTED });
  });
  ctx.y -= 10;
}

// Font bytes come from vendored OFL-licensed assets. fetch works in the
// browser (precached by the service worker); fs is the node/vitest path.
// Bytes are cached module-wide: a repeated report build must not re-download.
const bytesCache = new Map<string, Promise<Uint8Array>>();
function fontBytes(url: string): Promise<Uint8Array> {
  let p = bytesCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return new Uint8Array(await r.arrayBuffer());
      } catch { /* node test env: no server for relative asset URLs */ }
      const { readFile } = await import(/* @vite-ignore */ "node:fs/promises");
      return new Uint8Array(await readFile(process.cwd() + url));
    })();
    bytesCache.set(url, p);
  }
  return p;
}

async function loadFaces(doc: PDFDocument): Promise<Faces> {
  doc.registerFontkit(fontkit);
  const [r, b, a, d, c] = await Promise.all(
    [fontRegularUrl, fontBoldUrl, fontArabicUrl, fontDevaUrl, fontCjkUrl].map(fontBytes),
  );
  const subset = { subset: true } as const;
  return {
    base: await doc.embedFont(r, subset),
    bold: await doc.embedFont(b, subset),
    arabic: await doc.embedFont(a, subset),
    deva: await doc.embedFont(d, subset),
    // CFF-outline OTF: fontkit's CFF subsetter crashes — embed whole.
    cjk: await doc.embedFont(c),
  };
  // Throws on failure — Report.tsx surfaces it; we never silently strip text.
}

export async function buildReport(child: Child, observations: Observation[], opts: ReportOptions): Promise<Uint8Array> {
  const episodes = observations
    .filter((o) => !o.baseline)
    .filter((o) => opts.periodDays == null || o.startedAt >= Date.now() - opts.periodDays * 864e5)
    .sort((a, b) => a.startedAt - b.startedAt);

  const doc = await PDFDocument.create();
  doc.setTitle(`Owly pain report — ${sanitize(child.name)}`);
  doc.setCreator("Owly (open-source pain observation journal)");
  const faces = await loadFaces(doc);
  const ctx: Ctx = { doc, page: undefined as unknown as PDFPage, font: faces.base, bold: faces.bold, faces, y: TOP_Y, left: 48, width: PAGE_W - 96 };
  newPage(ctx);

  // Header
  line(ctx, t("title"), { bold: true, size: 15, color: INK, gap: 19 });
  line(ctx, `${child.name}${child.isDemo ? ` (${t("demoTag")})` : ""}${child.birthYear ? ` · ${t("born")} ${child.birthYear}` : ""}${child.conditions ? ` · ${child.conditions}` : ""}`, { size: 10, color: MUTED, gap: 14 });
  line(ctx, t("prepared", { date: fmtDate(Date.now()), count: episodes.length }), { size: 8.5, color: MUTED, gap: 10 });
  rule(ctx, ACCENT, 1.4);
  ctx.y -= 6;

  // How the child communicates
  if (child.communicates) {
    heading(ctx, t("howTheySignal"));
    line(ctx, child.communicates);
  }
  const custom = Object.entries(child.customDescriptors).filter(([, v]) => v.trim());
  if (custom.length > 0) {
    line(ctx, `${t("individualBehaviours")}: ${custom.map(([k, v]) => `${k}: ${v}`).join(" · ")}`, { size: 8.5, color: MUTED, gap: 12 });
  }

  // Pattern summary
  if (episodes.length > 0) {
    heading(ctx, t("whatShows"));
    const avg = episodes.reduce((s, o) => s + o.total, 0) / episodes.length;
    const night = episodes.filter((o) => { const h = new Date(o.startedAt).getHours(); return h >= 22 || h < 6; }).length;
    const zoneCounts = new Map<string, number>();
    episodes.forEach((o) => o.bodyZones.forEach((z) => zoneCounts.set(z, (zoneCounts.get(z) ?? 0) + 1)));
    const topZones = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    line(ctx, `• ${t("episodesLine", { count: episodes.length, avg: avg.toFixed(1), max: Math.max(...episodes.map((o) => o.total)) })}`);
    if (night > 0) line(ctx, `• ${t("nightLine", { night, count: episodes.length })}`);
    if (topZones.length) line(ctx, `• ${t("areasLine")}: ${topZones.map(([z, n]) => `${zoneLabel(z)} (${n}×)`).join(", ")}`);
    const med = episodes.flatMap((o) => o.interventions).filter((i) => i.type === "medication" && i.label);
    if (med.length) line(ctx, `• ${t("medLine")}: ${[...new Set(med.map((m) => m.label))].join(", ")}`);
    const worked = new Map<string, { yes: number; n: number }>();
    episodes.forEach((o) => o.interventions.forEach((i) => {
      if (!i.helped) return;
      const e = worked.get(i.type) ?? { yes: 0, n: 0 };
      e.n++; if (i.helped === "yes") e.yes++;
      worked.set(i.type, e);
    }));
    const workedList = [...worked.entries()].map(([k, v]) => `${intervLabel(k)} ${v.yes}/${v.n} ${t("helped")}`).join(", ");
    if (workedList) line(ctx, `• ${t("intervLine")}: ${workedList}`, { color: MUTED });
  }

  // Episode log — fixed column x positions (proportional font can't padEnd).
  // Every episode is rendered; the table re-heads itself after a page break.
  if (episodes.length > 0) {
    heading(ctx, t("episodeLog"));
    const headerRow = [t("colDate"), t("colScore"), t("colBand"), t("colDuration"), t("colAreas"), t("colCause")];
    drawTableHeader(ctx, headerRow);
    for (const o of episodes) {
      const areas = o.bodyZones.map((z) => zoneLabel(z)).join(", ");
      const noteLines = wrapText(
        ctx,
        [o.suspectedCause, o.note].filter(Boolean).join(" — "),
        7.6, COL_W[5],
      );
      const areaLines = wrapText(ctx, areas, 7.6, COL_W[4]);
      const rows = Math.max(1, noteLines.length, areaLines.length);
      if (ensureSpace(ctx, 12.5)) drawTableHeader(ctx, headerRow);
      const cells = [
        fmtDate(o.startedAt),
        `${o.total}/10`,
        i18n.t(`band.${bandFor(o.total)}`),
        o.durationMinutes ? `${o.durationMinutes}m` : "—",
      ];
      cells.forEach((c, i) => {
        drawRuns(ctx, truncToWidth(ctx, c, 7.6, COL_W[i]), ctx.left + COLS[i], ctx.y, { size: 7.6, color: INK });
      });
      // Draw line-by-line so a row taller than a page splits across pages.
      // ctx.y is the baseline of the current chunk's first line; a break
      // re-heads the table and repeats the episode's date + "continued".
      let chunk = 0;
      for (let i = 0; i < rows; i++) {
        if (ctx.y - chunk * 9 - 10 < BOTTOM_Y) {
          newPage(ctx);
          drawTableHeader(ctx, headerRow);
          chunk = 0;
          // Repeat the episode's date plus "(continued)" — identity survives
          // the page break even in the columns that are empty on continuation.
          drawRuns(ctx, truncToWidth(ctx, fmtDate(o.startedAt), 7.6, COL_W[0]), ctx.left + COLS[0], ctx.y, { size: 7.6, color: MUTED });
          drawRuns(ctx, `(${t("continued")})`, ctx.left + COLS[2], ctx.y, { size: 7.6, color: MUTED });
        }
        if (i < areaLines.length) {
          drawRuns(ctx, truncToWidth(ctx, areaLines[i], 7.6, COL_W[4]), ctx.left + COLS[4], ctx.y - chunk * 9, { size: 7.6, color: INK });
        }
        if (i < noteLines.length) {
          drawRuns(ctx, truncToWidth(ctx, noteLines[i], 7.6, COL_W[5]), ctx.left + COLS[5], ctx.y - chunk * 9, { size: 7.6, color: INK });
        }
        chunk++;
      }
      ctx.y -= chunk * 9 + 1.5;
    }
  }

  // Baselines
  const baselines = observations.filter((o) => o.baseline)
    .filter((o) => opts.periodDays == null || o.startedAt >= Date.now() - opts.periodDays * 864e5);
  if (baselines.length > 0) {
    ctx.y -= 4;
    line(ctx, t("baselineLine", { count: baselines.length, scores: baselines.map((b) => b.total).join(", ") }), { size: 8, color: MUTED });
  }

  // Questions
  const qs = opts.questions.map((q) => q.trim()).filter(Boolean);
  if (qs.length > 0) {
    heading(ctx, t("questions"));
    qs.slice(0, 5).forEach((q, i) => line(ctx, `${i + 1}. ${q}`, { size: 9.5 }));
  }

  // Footer — fixed position on the last page, above the page's lower edge.
  const foot1 = wrapText(ctx, t("footer1"), 7, ctx.width);
  const foot2 = wrapText(ctx, t("footer2"), 7, ctx.width);
  let fy = 46;
  for (const l of [...foot1, ...foot2]) {
    drawRuns(ctx, l, ctx.left, fy, { size: 7, color: MUTED });
    fy -= 9;
  }

  // Every page (incl. continuation pages) gets a running stamp: child identity
  // + page number, plus a demo tag when the report was built from demo data.
  const pages = doc.getPages();
  const stamp = `${child.name}${child.isDemo ? ` (${t("demoTag")})` : ""} — p. `;
  pages.forEach((p, i) => {
    ctx.page = p;
    drawRuns(ctx, `${stamp}${i + 1}/${pages.length}`, ctx.left, 20, { size: 7, color: MUTED });
  });
  ctx.page = pages[pages.length - 1];

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  a.click();
  // Defer revocation: some browsers abort in-flight downloads if revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
