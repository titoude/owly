export interface FlaccScores {
  face: number;
  legs: number;
  activity: number;
  cry: number;
  consolability: number;
}

export type FlaccCategory = keyof FlaccScores;
export const FLACC_CATEGORIES: FlaccCategory[] = ["face", "legs", "activity", "cry", "consolability"];

export interface Intervention {
  type: "comfort" | "repositioning" | "medication" | "distraction" | "environment" | "food_drink" | "other";
  label: string;
  helped: "yes" | "no" | "unsure" | null;
}

export interface Observation {
  id?: number;
  childId: number;
  startedAt: number; // epoch ms — when the episode started
  recordedAt: number; // epoch ms — when it was logged
  scores: FlaccScores;
  total: number; // 0-10
  durationMinutes: number | null;
  bodyZones: string[]; // zone ids from BODY_ZONES
  suspectedCause: string;
  interventions: Intervention[];
  note: string;
  baseline: boolean; // observed at baseline (not an episode)
}

export interface CustomDescriptors {
  // rFLACC: the child's personal pain behaviors per category (free text, shown as hints)
  face: string;
  legs: string;
  activity: string;
  cry: string;
  consolability: string;
}

export interface Child {
  id?: number;
  name: string;
  birthYear: number | null;
  conditions: string;
  communicates: string; // how the child usually signals discomfort (free text)
  customDescriptors: CustomDescriptors;
  passcodeHash: string | null;
  createdAt: number;
  isDemo?: boolean;
}

export interface Settings {
  key: string;
  value: unknown;
}

export type PainBand = "none" | "mild" | "moderate" | "severe";

export function bandFor(total: number): PainBand {
  if (total === 0) return "none";
  if (total <= 3) return "mild";
  if (total <= 6) return "moderate";
  return "severe";
}
