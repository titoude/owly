import type { FlaccCategory, FlaccScores, PainBand } from "./types";

// Canonical FLACC descriptors (Merkel et al. 1997) — published clinical instrument;
// English wording only — redistribution/translation rights pending licensor confirmation (see README).
// rFLACC (Malviya et al. 2006) additionally allows per-child individualized descriptors;
// Owly surfaces them as "this is how {child} shows it" hints on each category.
export const FLACC: Record<
  FlaccCategory,
  { label: string; descriptors: [string, string, string] }
> = {
  face: {
    label: "Face",
    descriptors: [
      "No particular expression or smile",
      "Occasional grimace or frown, withdrawn, disinterested",
      "Frequent to constant quivering chin, clenched jaw",
    ],
  },
  legs: {
    label: "Legs",
    descriptors: [
      "Normal position or relaxed",
      "Uneasy, restless, tense",
      "Kicking, or legs drawn up",
    ],
  },
  activity: {
    label: "Activity",
    descriptors: [
      "Lying quietly, normal position, moves easily",
      "Squirming, shifting back and forth, tense",
      "Arched, rigid or jerking",
    ],
  },
  cry: {
    label: "Cry",
    descriptors: [
      "No cry (awake or asleep)",
      "Moans or whimpers, occasional complaint",
      "Crying steadily, screams or sobs, frequent complaints",
    ],
  },
  consolability: {
    label: "Consolability",
    descriptors: [
      "Content, relaxed",
      "Reassured by occasional touching, hugging or being talked to; distractible",
      "Difficult to console or comfort",
    ],
  },
};

export function totalFlacc(s: FlaccScores): number {
  return s.face + s.legs + s.activity + s.cry + s.consolability;
}

export const BAND_LABEL: Record<PainBand, string> = {
  none: "Comfortable / no pain signs",
  mild: "Mild discomfort",
  moderate: "Moderate pain",
  severe: "Severe discomfort or pain",
};

export const BAND_COLOR: Record<PainBand, string> = {
  none: "bg-emerald-500",
  mild: "bg-yellow-400",
  moderate: "bg-orange-500",
  severe: "bg-red-600",
};

export const BAND_TEXT: Record<PainBand, string> = {
  none: "text-emerald-700",
  mild: "text-amber-700",
  moderate: "text-orange-700",
  severe: "text-red-700",
};

// Body map zones — kept coarse on purpose (a parent taps, not an anatomist draws).
export const BODY_ZONES = [
  { id: "head", label: "Head" },
  { id: "ears", label: "Ears" },
  { id: "mouth", label: "Mouth / teeth" },
  { id: "throat", label: "Throat" },
  { id: "chest", label: "Chest" },
  { id: "stomach", label: "Tummy" },
  { id: "back", label: "Back" },
  { id: "bottom", label: "Bottom" },
  { id: "arm_l", label: "Left arm" },
  { id: "arm_r", label: "Right arm" },
  { id: "hand_l", label: "Left hand" },
  { id: "hand_r", label: "Right hand" },
  { id: "leg_l", label: "Left leg" },
  { id: "leg_r", label: "Right leg" },
  { id: "foot_l", label: "Left foot" },
  { id: "foot_r", label: "Right foot" },
  { id: "skin", label: "Skin" },
  { id: "whole", label: "Whole body" },
] as const;

export type BodyZoneId = (typeof BODY_ZONES)[number]["id"];

export const INTERVENTION_TYPES = [
  "comfort",
  "repositioning",
  "medication",
  "distraction",
  "environment",
  "food_drink",
  "other",
] as const;
