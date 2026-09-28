import i18n from "./i18n";
import { db, setSetting } from "./db";
import { clearChildDrafts } from "./drafts";
import type { Child, Observation } from "./types";

// Demo child "Léo" — 9 y/o, non-verbal, autism.
// 3 weeks of data telling the demo story: recurrent night episodes,
// ear-pulling, comfort helps sometimes, ibuprofen works — and the
// pattern that emerges is "suspected ear pain, mostly at night".
export async function seedDemo(): Promise<void> {
  await clearDemo();
  const fr = i18n.language.startsWith("fr");
  const childId = (await db.children.add({
    name: "Léo",
    birthYear: 2016,
    conditions: fr ? "Autisme, non verbal" : "Autism, non-verbal",
    communicates: fr
      ? "Se touche les oreilles, se berce, se tape la tête doucement, devient très immobile"
      : "Pulls at ears, rocks, bangs head lightly, goes very still",
    customDescriptors: fr
      ? {
          face: "grimace, se mord la lèvre inférieure",
          legs: "coup de pieds rythmés",
          activity: "se berce d'avant en arrière",
          cry: "gémissements aigus, pas de mots",
          consolability: "seule sa couverture lestée l'apaise",
        }
      : {
          face: "grimaces, bites lower lip",
          legs: "kicks rhythmically",
          activity: "rocks back and forth",
          cry: "high-pitched hums, no words",
          consolability: "only his weighted blanket helps",
        },
    createdAt: Date.now() - 22 * 864e5,
    isDemo: true,
  } as Child)) as number;
  await setSetting("activeChildId", childId);

  const day = 864e5;
  const now = Date.now();
  const mk = (dAgo: number, hour: number, min = 0) => {
    const d = new Date(now - dAgo * day);
    d.setHours(hour, min, 0, 0);
    return d.getTime();
  };

  const obs: Omit<Observation, "id">[] = [
    { childId, startedAt: mk(21, 23, 10), recordedAt: mk(21, 23, 25), scores: { face: 2, legs: 1, activity: 2, cry: 1, consolability: 2 }, total: 8, durationMinutes: 45, bodyZones: ["ears", "head"], suspectedCause: "", interventions: [{ type: "comfort", label: "", helped: "no" }, { type: "medication", label: (fr ? "ibuprofène 10 ml" : "ibuprofen 10ml"), helped: "yes" }], note: fr ? "réveil en pleurs, tire l'oreille gauche" : "woke up crying, pulled left ear", baseline: false },
    { childId, startedAt: mk(20, 14, 0), recordedAt: mk(20, 14, 5), scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 }, total: 0, durationMinutes: null, bodyZones: [], suspectedCause: "", interventions: [], note: fr ? "après-midi calme, dessin" : "quiet afternoon, drawing", baseline: true },
    { childId, startedAt: mk(19, 2, 30), recordedAt: mk(19, 2, 45), scores: { face: 2, legs: 2, activity: 2, cry: 1, consolability: 2 }, total: 9, durationMinutes: 60, bodyZones: ["ears"], suspectedCause: fr ? "oreille ?" : "ear?", interventions: [{ type: "medication", label: (fr ? "ibuprofène 10 ml" : "ibuprofen 10ml"), helped: "yes" }], note: fr ? "pire que d'habitude" : "worse than usual", baseline: false },
    { childId, startedAt: mk(17, 23, 45), recordedAt: mk(17, 23, 55), scores: { face: 1, legs: 1, activity: 1, cry: 1, consolability: 1 }, total: 5, durationMinutes: 30, bodyZones: ["ears"], suspectedCause: "", interventions: [{ type: "comfort", label: "", helped: "unsure" }], note: "", baseline: false },
    { childId, startedAt: mk(15, 9, 15), recordedAt: mk(15, 9, 20), scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 }, total: 0, durationMinutes: null, bodyZones: [], suspectedCause: "", interventions: [], note: fr ? "bonne journée selon l'école" : "school said good day", baseline: true },
    { childId, startedAt: mk(14, 1, 20), recordedAt: mk(14, 1, 35), scores: { face: 2, legs: 1, activity: 2, cry: 2, consolability: 2 }, total: 9, durationMinutes: 55, bodyZones: ["ears", "head"], suspectedCause: fr ? "oreille" : "ear", interventions: [{ type: "medication", label: (fr ? "ibuprofène 10 ml" : "ibuprofen 10ml"), helped: "yes" }, { type: "repositioning", label: "", helped: "no" }], note: fr ? "hurlements, refusait de s'allonger du côté gauche" : "screamed, would not lie on left side", baseline: false },
    { childId, startedAt: mk(11, 22, 50), recordedAt: mk(11, 23, 5), scores: { face: 1, legs: 1, activity: 2, cry: 1, consolability: 1 }, total: 6, durationMinutes: 40, bodyZones: ["ears"], suspectedCause: "", interventions: [{ type: "environment", label: "", helped: "unsure" }], note: "", baseline: false },
    { childId, startedAt: mk(9, 8, 0), recordedAt: mk(9, 8, 5), scores: { face: 0, legs: 0, activity: 0, cry: 0, consolability: 0 }, total: 0, durationMinutes: null, bodyZones: [], suspectedCause: "", interventions: [], note: "", baseline: true },
    { childId, startedAt: mk(7, 3, 15), recordedAt: mk(7, 3, 30), scores: { face: 2, legs: 2, activity: 2, cry: 2, consolability: 2 }, total: 10, durationMinutes: 70, bodyZones: ["ears"], suspectedCause: fr ? "otite ?" : "ear infection?", interventions: [{ type: "medication", label: (fr ? "ibuprofène 10 ml" : "ibuprofen 10ml"), helped: "yes" }], note: "hottest cheek on left side", baseline: false },
    { childId, startedAt: mk(4, 23, 30), recordedAt: mk(4, 23, 40), scores: { face: 1, legs: 1, activity: 1, cry: 1, consolability: 1 }, total: 5, durationMinutes: 35, bodyZones: ["ears"], suspectedCause: "", interventions: [{ type: "comfort", label: "", helped: "yes" }], note: "", baseline: false },
    { childId, startedAt: mk(1, 2, 0), recordedAt: mk(1, 2, 15), scores: { face: 2, legs: 1, activity: 2, cry: 1, consolability: 2 }, total: 8, durationMinutes: 50, bodyZones: ["ears"], suspectedCause: fr ? "oreille" : "ear", interventions: [{ type: "medication", label: (fr ? "ibuprofène 10 ml" : "ibuprofen 10ml"), helped: "yes" }], note: fr ? "rdv médecin pris — j'apporte le rapport" : "doctor appt booked — bringing the report", baseline: false },
  ];
  await db.observations.bulkAdd(obs as Observation[]);
}

export async function clearDemo(): Promise<void> {
  const demos = await db.children.filter((c) => !!c.isDemo).toArray();
  for (const d of demos) {
    if (d.id) {
      const obsIds = (await db.observations.where("childId").equals(d.id).primaryKeys()) as number[];
      await db.observations.where("childId").equals(d.id).delete();
      await db.children.delete(d.id);
      clearChildDrafts(d.id, obsIds);
    }
  }
}
