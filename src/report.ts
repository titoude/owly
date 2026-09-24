import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { bandFor, type Child, type Observation } from "./types";
import i18n from "./i18n";

const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52);
const ACCENT = rgb(0.05, 0.6, 0.55);
const LINE = rgb(0.85, 0.87, 0.9);

const zoneLabel = (z: string) => i18n.t(`zones.${z}`, { defaultValue: z });
const intervLabel = (id: string): string => i18n.t(`interventions.${id}`, { defaultValue: id });

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  left: number;
  width: number;
}

// StandardFonts (Helvetica) only encode WinAnsi — emoji, CJK, etc. throw
// inside drawText. Strip them so an unusual name/note can never crash the PDF.
function safe(s: string): string {
  return s.replace(/[^\u0020-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "");
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

function line(ctx: Ctx, text: string, opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number } = {}) {
  const size = opts.size ?? 9.5;
  const font = opts.font ?? ctx.font;
  for (const l of wrapText(text, size, font, ctx.width)) {
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
  const page = doc.addPage([595, 842]); // A4
  const ctx: Ctx = { page, font, bold, y: 800, left: 48, width: 499 };

  // Header
  line(ctx, t("title"), { font: bold, size: 15, color: INK, gap: 19 });
  line(ctx, `${child.name}${child.birthYear ? ` · ${t("born")} ${child.birthYear}` : ""}${child.conditions ? ` · ${child.conditions}` : ""}`, { size: 10, color: MUTED, gap: 14 });
  line(ctx, t("prepared", { date: fmtDate(Date.now()), count: episodes.length }), { size: 8.5, color: MUTED, gap: 10 });
  page.drawLine({ start: { x: ctx.left, y: ctx.y }, end: { x: ctx.left + ctx.width, y: ctx.y }, thickness: 1.4, color: ACCENT });
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

  // Timeline table — fixed column x positions (proportional font can't padEnd)
  heading(ctx, t("episodeLog"));
  const cols = [0, 90, 132, 178, 224, 318]; // date, score, band, duration, areas, cause/note
  const colW = [90, 42, 46, 46, 94, 181];
  const headerRow = [t("colDate"), t("colScore"), t("colBand"), t("colDuration"), t("colAreas"), t("colCause")];
  headerRow.forEach((h, i) => {
    page.drawText(safe(h), { x: ctx.left + cols[i], y: ctx.y, size: 7.5, font: bold, color: MUTED });
  });
  ctx.y -= 10;
  const shown = episodes.slice(-14);
  for (const o of shown) {
    const areas = o.bodyZones.map((z) => zoneLabel(z)).join("+").replace(/\s+/g, "");
    const cells = [
      fmtDate(o.startedAt),
      `${o.total}/10`,
      i18n.t(`band.${bandFor(o.total)}`),
      o.durationMinutes ? `${o.durationMinutes}m` : "—",
      areas,
      [o.suspectedCause, o.note].filter(Boolean).join(" — "),
    ];
    cells.forEach((c, i) => {
      page.drawText(truncToWidth(font, c, 7.6, colW[i]), { x: ctx.left + cols[i], y: ctx.y, size: 7.6, font, color: INK });
    });
    ctx.y -= 10.5;
  }
  if (episodes.length > shown.length) {
    line(ctx, t("earlierEpisodes", { count: episodes.length - shown.length }), { size: 7.5, color: MUTED });
  }

  // Baselines
  const baselines = observations.filter((o) => o.baseline);
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

  // Footer
  ctx.y = 46;
  line(ctx, t("footer1"), { size: 7, color: MUTED, gap: 9 });
  line(ctx, t("footer2"), { size: 7, color: MUTED });

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
