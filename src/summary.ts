import type { Intervention, Observation } from "./types";

// One source of truth for what the journal "shows": the PDF report, the
// on-screen report, the pain passport and the Patterns page all read these
// numbers, so a clinician and a carer never see two different summaries.

export type TimeBucket = "night" | "morning" | "afternoon" | "evening";
export const TIME_BUCKETS: TimeBucket[] = ["night", "morning", "afternoon", "evening"];

export function timeBucket(hour: number): TimeBucket {
  if (hour >= 22 || hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export interface HelpedTally {
  yes: number;
  n: number; // uses where the caregiver recorded an outcome
}

export interface Summary {
  episodes: Observation[]; // oldest first
  baselines: Observation[]; // oldest first
  avg: number; // 0 when there are no episodes
  max: number;
  night: number;
  byTime: Record<TimeBucket, number>;
  zones: [string, number][]; // most frequent first
  meds: string[]; // distinct medication labels, first-seen order
  helped: [Intervention["type"], HelpedTally][]; // most "yes" first
}

export function inPeriod(o: Observation, periodDays: number | null, now: number): boolean {
  return periodDays == null || o.startedAt >= now - periodDays * 864e5;
}

export function summarize(observations: Observation[], periodDays: number | null = null, now = Date.now()): Summary {
  const kept = observations
    .filter((o) => inPeriod(o, periodDays, now))
    .sort((a, b) => a.startedAt - b.startedAt);
  const episodes = kept.filter((o) => !o.baseline);
  const baselines = kept.filter((o) => o.baseline);

  const byTime: Record<TimeBucket, number> = { night: 0, morning: 0, afternoon: 0, evening: 0 };
  const zoneCounts = new Map<string, number>();
  const meds: string[] = [];
  const helped = new Map<Intervention["type"], HelpedTally>();
  for (const o of episodes) {
    byTime[timeBucket(new Date(o.startedAt).getHours())]++;
    for (const z of o.bodyZones) zoneCounts.set(z, (zoneCounts.get(z) ?? 0) + 1);
    for (const i of o.interventions) {
      if (i.type === "medication" && i.label && !meds.includes(i.label)) meds.push(i.label);
      if (!i.helped) continue;
      const e = helped.get(i.type) ?? { yes: 0, n: 0 };
      e.n++;
      if (i.helped === "yes") e.yes++;
      helped.set(i.type, e);
    }
  }

  return {
    episodes,
    baselines,
    avg: episodes.length ? episodes.reduce((s, o) => s + o.total, 0) / episodes.length : 0,
    max: episodes.reduce((m, o) => Math.max(m, o.total), 0),
    night: byTime.night,
    byTime,
    // Stable sorts: ties keep first-seen order, so output is deterministic.
    zones: [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]),
    meds,
    helped: [...helped.entries()].sort((a, b) => b[1].yes - a[1].yes),
  };
}

/** Night is reported as a pattern only when it is strictly the most common
 *  time of day, covers more than half of the episodes, and has at least 2. */
export function mostlyAtNight(s: Summary): boolean {
  const counts = Object.values(s.byTime);
  const top = Math.max(...counts);
  return s.byTime.night === top && counts.filter((v) => v === top).length === 1 && top >= 2 && top > s.episodes.length / 2;
}
