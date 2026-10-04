import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// fontkit's Indic shaper needs regeneratorRuntime in scope (UMD global) —
// missing in browsers AND node without this tiny side-effect polyfill.
import "regenerator-runtime/runtime.js";
import bidiFactory from "bidi-js";
import { bandFor, type Child, type Observation } from "./types";
import i18n, { intlLocale } from "./i18n";
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
  missing: Set<string>; // chars no embedded face can render
}

// Script coverage: pick the embedded face that can render each codepoint.
// If font assets fail to load, buildReport throws — no silent text stripping.
type FaceKey = "base" | "bold" | "arabic" | "deva" | "cjk";
interface Faces {
  base: PDFFont; bold: PDFFont; arabic: PDFFont; deva: PDFFont; cjk: PDFFont;
  // Covered codepoints per face (from the source fonts) — used to refuse
  // unrenderable characters instead of emitting .notdef boxes.
  glyphs: Record<FaceKey, Set<number>>;
}

// Thrown when report content contains characters no embedded face can
// render. The PDF is never produced; the journal and its data are untouched.
export class UnsupportedCharsError extends Error {
  readonly chars: string[];
  constructor(chars: string[]) {
    super(`Characters not coverable by the embedded fonts: ${chars.join(" ")}`);
    this.name = "UnsupportedCharsError";
    this.chars = chars;
  }
}

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

// Face actually able to draw a char.
// At RTL level we prefer the Arabic face first: spaces/digits/punctuation
// inside an RTL run must ride the script face or face-splitting reorders
// words. When the script face lacks the glyph (Noto Sans Arabic has no
// "—"/"·"/"…") the char falls back to a covering face — the visual-order
// piece split still keeps words correctly ordered. null = no face.
function charFace(faces: Faces, ch: string, rtl: boolean): FaceKey | null {
  const cp = ch.codePointAt(0)!;
  const want = faceOf(ch);
  const order: FaceKey[] = rtl
    ? ["arabic", want, "base", "deva", "cjk"]
    : [want, "base", "arabic", "deva", "cjk"];
  for (const f of order) {
    if (faces.glyphs[f].has(cp)) return f;
  }
  return null;
}

const bidi = bidiFactory();
interface Piece { text: string; face: FaceKey | null } // face null = unrenderable
// Lays a logical string out as drawable pieces in VISUAL order.
// - bidi.getReorderSegments gives [start,end] inclusive ranges to reverse
//   (UAX L2) — applied to an index permutation (code-unit indexed).
// - Pieces are maximal contiguous-logical same-face groups of the visual
//   sequence; each piece's slice stays LOGICAL text, fontkit shapes+orders
//   it. Splitting happens on the VISUAL sequence, so even a split (e.g. a
//   dash falling back to the base face inside an Arabic run) keeps pieces in
//   correct visual order — words are never reordered.
// - Chars no face can render are emitted face=null and reported via missing.
function layout(faces: Faces, s: string): { pieces: Piece[]; missing: Set<string>; rtl: boolean } {
  const clean = sanitize(s);
  const missing = new Set<string>();
  if (!clean) return { pieces: [], missing, rtl: false };

  // Visual order of code-unit indices + per-unit bidi level
  // (identity order, no levels, for pure-LTR text). `rtl` is the
  // paragraph embedding level — used to right-align RTL-anchored
  // paragraphs (UAX P2/P3 equivalent via bidi-js).
  let seq: number[];
  let lv: Uint8Array | null = null;
  let rtl = false;
  if (RE_RTL.test(clean)) {
    const levels = bidi.getEmbeddingLevels(clean);
    lv = levels.levels;
    rtl = (levels.paragraphs[0]?.level ?? 0) === 1;
    seq = Array.from({ length: clean.length }, (_, i) => i);
    for (const [a, e] of bidi.getReorderSegments(clean, levels) as [number, number][]) {
      for (let i = a, j = e; i < j; i++, j--) [seq[i], seq[j]] = [seq[j], seq[i]];
    }
  } else {
    seq = Array.from({ length: clean.length }, (_, i) => i);
  }

  // Per-code-unit face (surrogate pairs share one char's face).
  const perUnit: (FaceKey | null)[] = new Array(clean.length);
  for (let i = 0; i < clean.length; i++) {
    const cu = clean.charCodeAt(i);
    const ch = cu >= 0xd800 && cu <= 0xdbff && i + 1 < clean.length ? clean.slice(i, i + 2) : clean[i];
    const f = charFace(faces, ch, lv !== null && lv[i] % 2 === 1);
    perUnit[i] = f;
    if (f === null) missing.add(ch);
    if (ch.length === 2) { perUnit[i + 1] = f; i++; }
  }

  const pieces: Piece[] = [];
  let lo = seq[0], hi = seq[0], f = perUnit[seq[0]];
  for (let p = 1; p <= seq.length; p++) {
    const idx = seq[p];
    const same = p < seq.length && perUnit[idx] === f && (idx === lo - 1 || idx === hi + 1);
    if (same) {
      lo = Math.min(lo, idx); hi = Math.max(hi, idx);
    } else {
      pieces.push({ text: clean.slice(lo, hi + 1), face: f });
      lo = idx; hi = idx; f = perUnit[idx];
    }
  }
  return { pieces, missing, rtl };
}

function measure(faces: Faces, s: string, size: number): number {
  // Unrenderable pieces still occupy width for layout (measured under base).
  return layout(faces, s).pieces
    .reduce((w, p) => w + faces[p.face ?? "base"].widthOfTextAtSize(p.text, size), 0);
}

// Draw one logical string as visual-order face pieces at advancing x.
// With `align: "auto"` + `avail` (paragraph width), an RTL-anchored
// paragraph is right-aligned inside that width — Arabic user content
// sits naturally against the right edge instead of floating left.
function drawRuns(ctx: Ctx, s: string, x: number, y: number, o: { size: number; bold?: boolean; color: typeof INK; align?: "auto"; avail?: number }) {
  const { pieces, missing, rtl } = layout(ctx.faces, s);
  let cx = x;
  if (o.align === "auto" && rtl && o.avail !== undefined) {
    const w = pieces.reduce((acc, p) => acc + ctx.faces[p.face ?? "base"].widthOfTextAtSize(p.text, o.size), 0);
    cx = x + Math.max(0, o.avail - w);
  }
  for (const ch of missing) ctx.missing.add(ch);
  for (const p of pieces) {
    const f = o.bold && p.face === "base" ? ctx.faces.bold : ctx.faces[p.face ?? "base"];
    if (p.face === null) {
      // Recorded in ctx.missing — buildReport throws before save. Skip the
      // draw so a discarded doc would still contain no .notdef boxes.
      cx += f.widthOfTextAtSize(p.text, o.size);
      continue;
    }
    ctx.page.drawText(p.text, { x: cx, y, size: o.size, font: f, color: o.color });
    cx += f.widthOfTextAtSize(p.text, o.size);
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
          const cut = fitCount(cps, "", width, maxWidth);
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

// Largest k in [1, cps.length] whose joined prefix + `extra` fits maxWidth.
// Measured width only grows as codepoints are appended, so a binary search
// finds the same cut a linear walk would — in O(log n) measures instead of
// O(n) full-string measures per line (a 2000-char unbroken token froze the
// PDF build for minutes). Always >=1 so callers keep making progress even
// when a single codepoint overflows.
function fitCount(cps: string[], extra: string, width: (s: string) => number, maxWidth: number): number {
  const fits = (k: number) => width(cps.slice(0, k).join("") + extra) <= maxWidth;
  if (fits(cps.length)) return cps.length;
  let lo = 1, hi = cps.length; // hi never fits here; lo==1 is the floor
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

function truncToWidth(ctx: Ctx, s: string, size: number, maxWidth: number): string {
  const cps = [...sanitize(s)]; // codepoints — never split a surrogate pair
  const width = (x: string) => measure(ctx.faces, x, size);
  if (width(cps.join("")) <= maxWidth) return cps.join("");
  const keep = fitCount(cps, "…", width, maxWidth);
  return cps.slice(0, keep).join("") + "…";
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
    drawRuns(ctx, l, ctx.left, ctx.y, { size, bold: opts.bold, color: opts.color ?? INK, align: "auto", avail: ctx.width });
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
  const loc = intlLocale();
  // Year included: a journal spanning >12 months must not collapse two
  // different years into the same label.
  return new Date(ms).toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" }) + " " +
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
// Exported for tests — internals only.
export function fontBytes(url: string): Promise<Uint8Array> {
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
    // Cache only successes — a rejected promise must not be replayed forever
    // (e.g. a transient network drop at first report generation).
    p.catch(() => bytesCache.delete(url));
  }
  return p;
}

async function loadFaces(doc: PDFDocument): Promise<Faces> {
  doc.registerFontkit(fontkit);
  const [r, b, a, d, c] = await Promise.all(
    [fontRegularUrl, fontBoldUrl, fontArabicUrl, fontDevaUrl, fontCjkUrl].map(fontBytes),
  );
  const subset = { subset: true } as const;
  const charset = (bytes: Uint8Array) => new Set<number>(fontkit.create(bytes).characterSet as number[]);
  return {
    base: await doc.embedFont(r, subset),
    bold: await doc.embedFont(b, subset),
    arabic: await doc.embedFont(a, subset),
    deva: await doc.embedFont(d, subset),
    // CFF-outline OTF: fontkit's CFF subsetter crashes — embed whole.
    cjk: await doc.embedFont(c),
    glyphs: {
      base: charset(r), bold: charset(b), arabic: charset(a), deva: charset(d), cjk: charset(c),
    },
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
  const ctx: Ctx = { doc, page: undefined as unknown as PDFPage, font: faces.base, bold: faces.bold, faces, y: TOP_Y, left: 48, width: PAGE_W - 96, missing: new Set() };
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
      // The date column wraps rather than clips (dates now carry the year).
      const dateLines = wrapText(ctx, fmtDate(o.startedAt), 7.6, COL_W[0]);
      const rows = Math.max(1, noteLines.length, areaLines.length, dateLines.length);
      if (ensureSpace(ctx, 12.5)) drawTableHeader(ctx, headerRow);
      const cells = [
        `${o.total}/10`,
        i18n.t(`band.${bandFor(o.total)}`),
        o.durationMinutes ? `${o.durationMinutes}m` : "—",
      ];
      cells.forEach((c, i) => {
        drawRuns(ctx, truncToWidth(ctx, c, 7.6, COL_W[i + 1]), ctx.left + COLS[i + 1], ctx.y, { size: 7.6, color: INK });
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
          drawRuns(ctx, truncToWidth(ctx, dateLines[0] ?? fmtDate(o.startedAt), 7.6, COL_W[0]), ctx.left + COLS[0], ctx.y, { size: 7.6, color: MUTED });
          drawRuns(ctx, `(${t("continued")})`, ctx.left + COLS[2], ctx.y, { size: 7.6, color: MUTED });
        }
        if (i < dateLines.length) {
          drawRuns(ctx, truncToWidth(ctx, dateLines[i], 7.6, COL_W[0]), ctx.left + COLS[0], ctx.y - chunk * 9, { size: 7.6, color: i === 0 ? INK : MUTED });
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

  // Any character no embedded face could render was collected while drawing.
  // Fail before saving rather than deliver a PDF with silent .notdef boxes.
  if (ctx.missing.size) throw new UnsupportedCharsError([...ctx.missing]);

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
