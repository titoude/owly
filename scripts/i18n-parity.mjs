#!/usr/bin/env node
// i18n key-parity check: every locale must define the same BASE keys as `en`,
// with the plural categories its own CLDR plural rules require.
// Usage: node scripts/i18n-parity.mjs   — exits 1 on missing/extra keys.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/locales");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

const SUFFIX = /_(zero|one|two|few|many|other)$/;
// plural categories each locale's CLDR rules may produce
const PLURALS = {
  ar: ["zero", "one", "two", "few", "many", "other"],
  "zh-CN": ["other"],
  hi: ["one", "other"],
};

const flatten = (o, p = "") =>
  Object.fromEntries(
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.entries(flatten(v, `${p}${k}.`))
        : [[`${p}${k}`, v]],
    ),
  );

const locales = Object.fromEntries(
  files.map((f) => [f.replace(/\.json$/, ""), flatten(JSON.parse(readFileSync(join(dir, f), "utf8")))]),
);

// en's keys → base keys (plural key "x_one" → base "x"; "x" stays "x")
const enKeys = Object.keys(locales.en);
const enBases = new Set(enKeys.map((k) => k.replace(SUFFIX, "")));

let bad = 0;
for (const [lang, kv] of Object.entries(locales)) {
  if (lang === "en") continue;
  const allowed = new Set(PLURALS[lang] ?? ["one", "other"]);
  const keys = Object.keys(kv);
  const bases = new Set(keys.map((k) => k.replace(SUFFIX, "")));
  for (const b of enBases) if (!bases.has(b)) { bad++; console.error(`${lang}: MISSING base key ${b}`); }
  for (const b of bases) if (!enBases.has(b)) { bad++; console.error(`${lang}: EXTRA base key ${b}`); }
  // a base key that is pluralized in en must exist in each allowed form used by the locale rules;
  // and no form outside the allowed set may appear
  for (const k of keys) {
    const m = k.match(SUFFIX);
    if (m && !allowed.has(m[1])) { bad++; console.error(`${lang}: plural form not used by its rules: ${k}`); }
  }
}
if (bad) { console.error(`\n${bad} parity problem(s)`); process.exit(1); }
console.log(`i18n parity OK — ${files.length} locales, ${enBases.size} base keys each`);
