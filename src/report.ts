import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { bandFor, type Child, type Observation } from "./types";
import { BODY_ZONES, INTERVENTION_TYPES } from "./flacc";

const INK = rgb(0.13, 0.15, 0.2);
const MUTED = rgb(0.42, 0.45, 0.52);
const ACCENT = rgb(0.05, 0.6, 0.55);
const LINE = rgb(0.85, 0.87, 0.9);

const ZONE_LABEL: Map<string, string> = new Map(BODY_ZONES.map((z) => [z.id, z.label]));

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  left: number;
  width: number;
}

function line(ctx: Ctx, text: string, opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number } = {}) {
  const size = opts.size ?? 9.5;
  ctx.page.drawText(safe(text), {
    x: ctx.left,
    y: ctx.y,
    size,
    font: opts.font ?? ctx.font,
    color: opts.color ?? INK,
  });
  ctx.y -= opts.gap ?? size + 4.5;
}

function heading(ctx: Ctx, text: string) {
  ctx.y -= 6;
  line(ctx, text.toUpperCase(), { font: ctx.bold, size: 8.5, color: ACCENT, gap: 11 });
  ctx.page.drawLine({ start: { x: ctx.left, y: ctx.y + 4 }, end: { x: ctx.left + ctx.width, y: ctx.y + 4 }, thickness: 0.7, color: LINE });
}

// StandardFonts (Helvetica) only encode WinAnsi — emoji, CJK, etc. throw
// inside drawText. Strip them so an unusual name/note can never crash the PDF.
function safe(s: string): string {
  return s.replace(/[^\u0020-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "");
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
    new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const BAND_EN = { none: "comfortable", mild: "mild", moderate: "moderate", severe: "severe" } as const;

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
  doc.setTitle(`Owly pain report — ${child.name}`);
  doc.setCreator("Owly (open-source pain observation journal)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // A4
  const ctx: Ctx = { page, font, bold, y: 800, left: 48, width: 499 };

  // Header
  line(ctx, "PAIN OBSERVATION REPORT", { font: bold, size: 15, color: INK, gap: 19 });
  line(ctx, `${child.name}${child.birthYear ? ` · born ${child.birthYear}` : ""}${child.conditions ? ` · ${child.conditions}` : ""}`, { size: 10, color: MUTED, gap: 14 });
  line(ctx, `Prepared ${fmtDate(Date.now())} · ${episodes.length} episode(s) observed · owly.app`, { size: 8.5, color: MUTED, gap: 10 });
  page.drawLine({ start: { x: ctx.left, y: ctx.y }, end: { x: ctx.left + ctx.width, y: ctx.y }, thickness: 1.4, color: ACCENT });
  ctx.y -= 12;

  // How the child communicates
  if (child.communicates) {
    heading(ctx, "How they usually signal discomfort");
    line(ctx, trunc(child.communicates, 160));
  }
  const custom = Object.entries(child.customDescriptors).filter(([, v]) => v.trim());
  if (custom.length > 0) {
    line(ctx, `Individual pain behaviours (rFLACC): ${custom.map(([k, v]) => `${k}: ${v}`).join(" · ")}`, { size: 8.5, color: MUTED, gap: 12 });
  }

  // Pattern summary
  if (episodes.length > 0) {
    heading(ctx, "What the observations show");
    const avg = episodes.reduce((s, o) => s + o.total, 0) / episodes.length;
    const night = episodes.filter((o) => { const h = new Date(o.startedAt).getHours(); return h >= 22 || h < 6; }).length;
    const zoneCounts = new Map<string, number>();
    episodes.forEach((o) => o.bodyZones.forEach((z) => zoneCounts.set(z, (zoneCounts.get(z) ?? 0) + 1)));
    const topZones = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    line(ctx, `• ${episodes.length} episodes, average FLACC ${avg.toFixed(1)}/10 (max ${Math.max(...episodes.map((o) => o.total))})`);
    if (night > 0) line(ctx, `• ${night}/${episodes.length} occurred at night (22:00–06:00)`);
    if (topZones.length) line(ctx, `• Suspected areas: ${topZones.map(([z, n]) => `${ZONE_LABEL.get(z) ?? z} (${n}×)`).join(", ")}`);
    const med = episodes.flatMap((o) => o.interventions).filter((i) => i.type === "medication" && i.label);
    if (med.length) line(ctx, `• Medication given: ${[...new Set(med.map((m) => m.label))].join(", ")}`);
    const worked = new Map<string, { yes: number; n: number }>();
    episodes.forEach((o) => o.interventions.forEach((i) => {
      if (!i.helped) return;
      const e = worked.get(i.type) ?? { yes: 0, n: 0 };
      e.n++; if (i.helped === "yes") e.yes++;
      worked.set(i.type, e);
    }));
    const workedList = [...worked.entries()].map(([k, v]) => `${k} ${v.yes}/${v.n} helped`).join(", ");
    if (workedList) line(ctx, `• Interventions: ${workedList}`, { color: MUTED });
  }

  // Timeline table
  heading(ctx, "Episode log (FLACC 0–10)");
  line(ctx, "date        score  band      duration  areas             cause / note", { font: bold, size: 7.5, color: MUTED, gap: 10 });
  const shown = episodes.slice(-14);
  for (const o of shown) {
    const areas = o.bodyZones.map((z) => ZONE_LABEL.get(z) ?? z).join("+").replace(/\s+/g, "");
    const row = [
      fmtDate(o.startedAt).padEnd(12),
      `${o.total}/10`.padEnd(7),
      BAND_EN[bandFor(o.total)].padEnd(10),
      (o.durationMinutes ? `${o.durationMinutes}m` : "—").padEnd(9),
      trunc(areas, 18).padEnd(19),
      trunc([o.suspectedCause, o.note].filter(Boolean).join(" — "), 30),
    ].join("");
    line(ctx, row, { size: 7.6, gap: 10.5 });
  }
  if (episodes.length > shown.length) {
    line(ctx, `… ${episodes.length - shown.length} earlier episodes in the full export`, { size: 7.5, color: MUTED });
  }

  // Baselines
  const baselines = observations.filter((o) => o.baseline);
  if (baselines.length > 0) {
    ctx.y -= 4;
    line(ctx, `Baseline (calm) observations: ${baselines.length} — FLACC ${baselines.map((b) => b.total).join(", ")}`, { size: 8, color: MUTED });
  }

  // Questions
  const qs = opts.questions.map((q) => q.trim()).filter(Boolean);
  if (qs.length > 0) {
    heading(ctx, "Questions for the clinician");
    qs.slice(0, 5).forEach((q, i) => line(ctx, `${i + 1}. ${trunc(q, 90)}`));
  }

  // Footer
  ctx.y = 46;
  line(ctx, "Recorded with Owly — a free, open-source observation journal (FLACC: Merkel 1997; individualised rFLACC: Malviya 2006).", { size: 7, color: MUTED, gap: 9 });
  line(ctx, "Observations are caregiver-reported and are not a diagnosis.", { size: 7, color: MUTED });

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const INTERVENTION_LABEL = new Map(INTERVENTION_TYPES.map((t) => [t, t]));
