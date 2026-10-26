// Report options carried between the Report page and its on-screen view in
// router state (never in the URL: questions can be personal).
export const REPORT_PERIODS = [7, 14, 30, null] as const;

export interface ReportViewState {
  period: number | null;
  questions: string[];
}

// Router state from the Report page; a direct visit or reload without it
// falls back to the Report page's own default (last 30 days, no questions).
export function readReportState(state: unknown): ReportViewState {
  const s = state && typeof state === "object" ? (state as Partial<Record<keyof ReportViewState, unknown>>) : {};
  const period = "period" in s && (REPORT_PERIODS as readonly unknown[]).includes(s.period) ? (s.period as number | null) : 30;
  const questions = Array.isArray(s.questions) ? s.questions.filter((q): q is string => typeof q === "string").slice(0, 2) : ["", ""];
  return { period, questions: [...questions, "", ""].slice(0, 2) };
}
