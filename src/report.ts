import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { bandFor, type Child, type Observation } from "./types";
import i18n from "./i18n";

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
  font: PDFFont;
  bold: PDFFont;
  y: number;
  left: number;
  width: number;
}

// StandardFonts (Helvetica) only encode WinAnsi — emoji, CJK, etc. throw
// inside drawText. Strip them so an unusual name/note can never crash the PDF.
// TODO(i18n): embed a Unicode font so non-Latin scripts render instead of
// being stripped. Tracked as a known limitation — see NOTICE.
function safe(s: string): string {
  return s.replace(/[^\u0020-\u00FF\u0152\u0153\u0178\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "");
}

function t(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(`report.pdf.${key}`, opts);
}

function wrapText(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      // A single word wider than the column: hard-cut it.
      let piece = w;
      while (font.widthOfTextAtSize(piece, size) > maxWidth && piece.length > 1) {
        let cut = piece.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut) + "-", size) > maxWidth) cut--;
        lines.push(piece.slice(0, cut) + "-");
        piece = piece.slice(cut);
      }
      cur = piece;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function truncToWidth(font: PDFFont, s: string, size: number, maxWidth: number): string {
  const t2 = safe(s);
  if (font.widthOfTextAtSize(t2, size) <= maxWidth) return t2;
  let out = t2;
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxWidth) out = out.slice(0, -1);
  return out + "…";
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

function line(ctx: Ctx, text: string, opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number } = {}) {
  const size = opts.size ?? 9.5;
  const font = opts.font ?? ctx.font;
  for (const l of wrapText(text, size, font, ctx.width)) {
    ensureSpace(ctx, size + 4.5);
    ctx.page.drawText(safe(l), {
      x: ctx.left,
      y: ctx.y,
      size,
      font,
      color: opts.color ?? INK,
    });
    ctx.y -= size + 4.5;
  }
  ctx.y -= (opts.gap ?? size + 4.5) - (size + 4.5);
}

function heading(ctx: Ctx, text: string) {
  // Keep a heading attached to at least the first line of its section.
  ensureSpace(ctx, 46);
  ctx.y -= 6;
  line(ctx, text.toUpperCase(), { font: ctx.bold, size: 8.5, color: ACCENT, gap: 11 });
  ctx.page.drawLine({ start: { x: ctx.left, y: ctx.y + 4 }, end: { x: ctx.left + ctx.width, y: ctx.y + 4 }, thickness: 0.7, color: LINE });
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
    ctx.page.drawText(safe(h), { x: ctx.left + COLS[i], y: ctx.y, size: 7.5, font: ctx.bold, color: MUTED });
  });
  ctx.y -= 10;
}

export async function buildReport(child: Child, observations: Observation[], opts: ReportOptions): Promise<Uint8Array> {
  const episodes = observations
    .filter((o) => !o.baseline)
    .filter((o) => opts.periodDays == null || o.startedAt >= Date.now() - opts.periodDays * 864e5)
    .sort((a, b) => a.startedAt - b.startedAt);

  const doc = await PDFDocument.create();
  doc.setTitle(`Owly pain report — ${safe(child.name)}`);
  doc.setCreator("Owly (open-source pain observation journal)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: undefined as unknown as PDFPage, font, bold, y: TOP_Y, left: 48, width: PAGE_W - 96 };
  newPage(ctx);

  // Header
  line(ctx, t("title"), { font: bold, size: 15, color: INK, gap: 19 });
  line(ctx, `${child.name}${child.isDemo ? ` (${t("demoTag")})` : ""}${child.birthYear ? ` · ${t("born")} ${child.birthYear}` : ""}${child.conditions ? ` · ${child.conditions}` : ""}`, { size: 10, color: MUTED, gap: 14 });
  line(ctx, t("prepared", { date: fmtDate(Date.now()), count: episodes.length }), { size: 8.5, color: MUTED, gap: 10 });
  ctx.page.drawLine({ start: { x: ctx.left, y: ctx.y }, end: { x: ctx.left + ctx.width, y: ctx.y }, thickness: 1.4, color: ACCENT });
  ctx.y -= 12;

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
        [o.suspectedCause, o.note].filter(Boolean).join(" — "),
        7.6, font, COL_W[5],
      );
      const areaLines = wrapText(areas, 7.6, font, COL_W[4]);
      const rows = Math.max(1, noteLines.length, areaLines.length);
      if (ensureSpace(ctx, 12.5)) drawTableHeader(ctx, headerRow);
      const cells = [
        fmtDate(o.startedAt),
        `${o.total}/10`,
        i18n.t(`band.${bandFor(o.total)}`),
        o.durationMinutes ? `${o.durationMinutes}m` : "—",
      ];
      cells.forEach((c, i) => {
        ctx.page.drawText(truncToWidth(font, c, 7.6, COL_W[i]), { x: ctx.left + COLS[i], y: ctx.y, size: 7.6, font, color: INK });
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
          ctx.page.drawText(
            truncToWidth(font, fmtDate(o.startedAt), 7.6, COL_W[0]),
            { x: ctx.left + COLS[0], y: ctx.y, size: 7.6, font, color: MUTED },
          );
          ctx.page.drawText(
            `(${t("continued")})`,
            { x: ctx.left + COLS[2], y: ctx.y, size: 7.6, font, color: MUTED },
          );
        }
        if (i < areaLines.length) {
          ctx.page.drawText(truncToWidth(font, areaLines[i], 7.6, COL_W[4]), { x: ctx.left + COLS[4], y: ctx.y - chunk * 9, size: 7.6, font, color: INK });
        }
        if (i < noteLines.length) {
          ctx.page.drawText(truncToWidth(font, noteLines[i], 7.6, COL_W[5]), { x: ctx.left + COLS[5], y: ctx.y - chunk * 9, size: 7.6, font, color: INK });
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
  const foot1 = wrapText(t("footer1"), 7, font, ctx.width);
  const foot2 = wrapText(t("footer2"), 7, font, ctx.width);
  let fy = 46;
  for (const l of [...foot1, ...foot2]) {
    ctx.page.drawText(safe(l), { x: ctx.left, y: fy, size: 7, font, color: MUTED });
    fy -= 9;
  }

  // Every page (incl. continuation pages) gets a running stamp: child identity
  // + page number, plus a demo tag when the report was built from demo data.
  const pages = doc.getPages();
  const stamp = `${safe(child.name)}${child.isDemo ? ` (${t("demoTag")})` : ""} — p. `;
  pages.forEach((p, i) => {
    p.drawText(`${stamp}${i + 1}/${pages.length}`, { x: ctx.left, y: 20, size: 7, font, color: MUTED });
  });

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
