/**
 * Reading a combination code that a student typed or pasted into the Fire Rescue Junior screen
 * (or that the screen saved for the next visit).
 *
 * A Junior code is the four bucket colours on W1 W2 W3 W4: "RGBY" is the rule book. Letter case,
 * spaces and dashes do not matter. Only the 24 Junior combinations are accepted; everything else
 * gets one plain sentence that says why not - a colour there more than once (and how many times),
 * a Fire Rescue Senior code (it says where the people stand, and in Junior they do not move), or
 * no code at all.
 *
 * A Senior code is refused even when its people stand where the rule book shows them: then the
 * sentence says which four letters to type instead.
 *
 * A number is no code here, and the sentence says so as for any other text. (Fire Rescue Senior
 * also reads a number from 0 to 9215, but its screen never shows one: its codes are letters, like
 * RGBY-A1R-B1B-C1Y-D1G. A student who types "12" for "combination 12" would not know what a
 * sentence about Senior codes and the people meant.)
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { decodeScenario as decodeSeniorScenario, type FireRescueScenario } from '../../fire-rescue/scenario';
import {
  decodeJuniorScenario,
  encodeJuniorScenario,
  isJuniorScenario,
  repeatedBucketColors,
  type RepeatedBucketColor,
} from '../../fire-rescue-junior/scenario';
import type { CodeReading } from '../scenario-code';

/** The code of the rule book's combination. */
export const DEFAULT_JUNIOR_CODE = 'RGBY';

const LOOKS_LIKE = `A Fire Rescue Junior code is the four bucket colours on W1 to W4, like ${DEFAULT_JUNIOR_CODE} (R red, G green, B blue, Y yellow).`;

/** What was typed, as the sentence quotes it: a long text is cut. */
function quoted(text: string): string {
  return text.length > 30 ? `"${text.slice(0, 29)}…"` : `"${text}"`;
}

const TIMES: Readonly<Record<number, string>> = { 2: 'twice', 3: 'three times', 4: 'four times' };

/** "red is there twice", "red is there three times", "red and blue are there twice". */
function howOften(repeated: readonly RepeatedBucketColor[]): string {
  const times = (n: number): string => TIMES[n] ?? `${n} times`;
  // (four letters hold one colour 2, 3 or 4 times, or two colours 2 times each)
  if (repeated.every((r) => r.times === repeated[0].times)) {
    const names = repeated.map((r) => r.color).join(' and ');
    return `${names} ${repeated.length === 1 ? 'is' : 'are'} there ${times(repeated[0].times)}`;
  }
  return repeated.map((r) => `${r.color} is there ${times(r.times)}`).join(' and ');
}

/** Read what was typed into the code field of the Fire Rescue Junior screen. Never throws. */
export function readJuniorCode(text: string): CodeReading<FireRescueScenario> {
  const typed = text.trim();
  if (typed.length === 0) return { ok: false, problem: `Type a code into the field. ${LOOKS_LIKE}` };
  const scenario = decodeJuniorScenario(typed);
  if (scenario) return { ok: true, scenario };

  const repeated = repeatedBucketColors(typed);
  if (repeated) {
    return { ok: false, problem: `In ${quoted(typed)} ${howOften(repeated)}. Every bucket colour is there once. ${LOOKS_LIKE}` };
  }

  // a number: no code (see above) - the same sentence as for any other text
  if (/^\d+$/.test(typed)) return { ok: false, problem: `${quoted(typed)} is not a Fire Rescue Junior code. ${LOOKS_LIKE}` };

  // the long code of Fire Rescue Senior, with the people: refused - it is not one of the 24
  const senior = typed.length <= 100 ? decodeSeniorScenario(typed) : null;
  if (senior) {
    if (isJuniorScenario(senior)) {
      return {
        ok: false,
        problem: `This is a Fire Rescue Senior code. A Fire Rescue Junior code has only the four bucket letters: for these buckets, type ${encodeJuniorScenario(senior)}.`,
      };
    }
    return {
      ok: false,
      problem:
        'This is a Fire Rescue Senior code. In Fire Rescue Junior only the buckets are drawn, and the people always stand where the rule book shows them. ' +
        LOOKS_LIKE,
    };
  }
  return { ok: false, problem: `${quoted(typed)} is not a Fire Rescue Junior code. ${LOOKS_LIKE}` };
}
