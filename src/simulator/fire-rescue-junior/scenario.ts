/**
 * A Fire Rescue Junior "combination" (Season 2027, ages 10-12): what the referee draws before a
 * match. The organiser split Fire Rescue into two categories: in Fire Rescue Junior "the water
 * buckets will be randomised position, everything else at its place"; in Fire Rescue Senior
 * (ages 13-15) everything is drawn, as in ../fire-rescue/scenario.ts.
 *
 * So a Junior combination is ONE thing only: which coloured bucket stands on each water tower
 * W1..W4 (4! = 24 draws). Everything else stands where the rule book shows it - the people of
 * defaultScenario() in ../fire-rescue/scenario.ts: every person in square 1 (the left square)
 * of its building, the red person at A, blue at B, yellow at C, green at D; the water then goes
 * into square 2 of every building.
 *
 * A Junior combination is a FireRescueScenario, so the field, the robot, the referee and the
 * examples of Fire Rescue play it as they are (./game.ts). What this file adds is that nothing
 * but the buckets can ever change: every combination it gives has the people of the rule book,
 * and a code or a combination that moves a person is refused.
 *
 * The code of a combination is the four bucket colours on W1 W2 W3 W4: "RGBY" is the rule book.
 * (A Fire Rescue Senior code is longer - "RGBY-A1R-B1B-C1Y-D1G" - and is never a Junior code.)
 *
 * Plain TypeScript (no DOM, no React), so it also runs headless under Node.
 */
import type { ColorName } from '../core/types';
import { BUILDING_IDS, WATER_TOWER_IDS } from '../fire-rescue/field';
import { COLOR_PERMUTATIONS, COLORS, defaultScenario, isValidScenario, type FireRescueScenario } from '../fire-rescue/scenario';

/** 4! ways to put the four buckets on the four water towers. */
export const JUNIOR_SCENARIO_COUNT = 24;

const LETTER: Record<ColorName, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
const FROM_LETTER: Record<string, ColorName> = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };

/** The people as the rule book shows them: they stand there in every Junior match. */
export function rulebookPeople(): FireRescueScenario['people'] {
  return defaultScenario().people;
}

/** The combination with these bucket colours on W1, W2, W3, W4 and the people of the rule book. */
function withBuckets(colors: readonly ColorName[]): FireRescueScenario {
  const s = defaultScenario();
  WATER_TOWER_IDS.forEach((tower, i) => {
    s.buckets[tower] = colors[i];
  });
  return s;
}

/**
 * True when this is one of the 24 Junior combinations: a valid Fire Rescue combination whose
 * people all stand where the rule book shows them (same square, same colour).
 */
export function isJuniorScenario(s: FireRescueScenario): boolean {
  if (!isValidScenario(s)) return false;
  const book = rulebookPeople();
  return BUILDING_IDS.every((b) => s.people[b].slot === book[b].slot && s.people[b].color === book[b].color);
}

/** Number 0 .. 23 of a Junior combination (in the order of COLOR_PERMUTATIONS), or -1 for any other combination. */
export function juniorScenarioIndex(s: FireRescueScenario): number {
  if (!isJuniorScenario(s)) return -1;
  return COLOR_PERMUTATIONS.findIndex((colors) => WATER_TOWER_IDS.every((tower, i) => s.buckets[tower] === colors[i]));
}

/** The Junior combination with this number (any whole number is taken modulo 24). */
export function juniorScenarioFromIndex(index: number): FireRescueScenario {
  const n = ((Math.floor(index) % JUNIOR_SCENARIO_COUNT) + JUNIOR_SCENARIO_COUNT) % JUNIOR_SCENARIO_COUNT;
  return withBuckets(COLOR_PERMUTATIONS[n]);
}

/** All 24 Junior combinations, in number order (the rule book's RGBY first). */
export function allJuniorScenarios(): FireRescueScenario[] {
  return COLOR_PERMUTATIONS.map((colors) => withBuckets(colors));
}

/** A random draw like the referee's: only the buckets change (`rng` gives numbers from 0 up to, but not including, 1). */
export function randomJuniorScenario(rng: () => number): FireRescueScenario {
  return juniorScenarioFromIndex(Math.floor(rng() * JUNIOR_SCENARIO_COUNT));
}

/** "RGBY": the bucket colours on W1 W2 W3 W4. */
export function encodeJuniorScenario(s: FireRescueScenario): string {
  return WATER_TOWER_IDS.map((tower) => LETTER[s.buckets[tower]]).join('');
}

/** The four letters of a text that could be a Junior code (any letter case, any separators - as a Senior code), or null. */
function bucketLetters(code: string): string | null {
  const compact = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[RGBY]{4}$/.test(compact) ? compact : null;
}

/**
 * The Junior combination of a code: four letters R, G, B, Y - each colour once - for the buckets
 * on W1 W2 W3 W4, in any letter case, with or without spaces or dashes ("rgby", "G-R-B-Y").
 * Anything else is no Junior code (null): a number, a Fire Rescue Senior code, a colour twice.
 */
export function decodeJuniorScenario(code: string): FireRescueScenario | null {
  const letters = bucketLetters(code);
  if (!letters) return null;
  const colors = [...letters].map((letter) => FROM_LETTER[letter]);
  if (!COLORS.every((color) => colors.includes(color))) return null;
  return withBuckets(colors);
}

/** A colour that four bucket letters hold more than once, and how many times they hold it. */
export interface RepeatedBucketColor {
  color: ColorName;
  /** 2, 3 or 4 */
  times: number;
}

/**
 * The colours that four bucket letters hold more than once - "RRBY": red 2 times, "RRRR": red 4
 * times, "RRBB": red and blue 2 times each - or null for any other text.
 */
export function repeatedBucketColors(code: string): RepeatedBucketColor[] | null {
  const letters = bucketLetters(code);
  if (!letters) return null;
  const colors = [...letters].map((letter) => FROM_LETTER[letter]);
  const repeated = COLORS.map((color) => ({ color, times: colors.filter((c) => c === color).length })).filter((r) => r.times > 1);
  return repeated.length > 0 ? repeated : null;
}

export function describeJuniorScenario(s: FireRescueScenario): string {
  const buckets = WATER_TOWER_IDS.map((tower) => `${tower} ${s.buckets[tower]}`).join(', ');
  const people = BUILDING_IDS.map((b) => `${b}${s.people[b].slot} ${s.people[b].color}`).join(', ');
  return `Buckets: ${buckets}. People (as in the rule book): ${people}.`;
}

/** What keeps a combination from being a Junior combination, in plain words (empty: it is one). */
export function juniorScenarioProblems(s: FireRescueScenario): string[] {
  if (!isValidScenario(s)) return ['This is not a Fire Rescue combination: every colour must be there once.'];
  if (!isJuniorScenario(s)) return ['In Fire Rescue Junior only the buckets are drawn: every person stands where the rule book shows it.'];
  return [];
}
