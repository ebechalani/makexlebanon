/**
 * A Locker Room "arrangement": the two cards the referee draws before the match (rules §3).
 *
 *   - the Team Color card: RED or GREEN (§3.1). It decides which pickup zone the robot visits and
 *     which big circle it delivers to; the referee shows it to the robot at the Scan Station.
 *   - the Zone Assignment card: one of the six options of §3.2, numbered as there - which token
 *     colour stands in zone A, B and C:
 *
 *       Option 1: RED in A, GREEN in B, BLUE in C      Option 4: GREEN in A, BLUE in B, RED in C
 *       Option 2: RED in A, BLUE in B, GREEN in C      Option 5: BLUE in A, RED in B, GREEN in C
 *       Option 3: GREEN in A, RED in B, BLUE in C      Option 6: BLUE in A, GREEN in B, RED in C
 *
 * 2 x 6 = 12 arrangements. (Zone A is the LOWEST of the three zone pictures, C the top one:
 * ./field.ts ZONES.)
 *
 * The short code is the first letter of the team colour and the option's number: "G5" = team
 * GREEN, option 5 (BLUE in A, RED in B, GREEN in C) - the two cards as the referee draws them.
 */
import { ZONE_IDS, type MarkColor, type TeamColor, type ZoneId } from './field';

/** The colour of a token (rules §2.5: "ONE colored token (RED, GREEN, or BLUE)"). */
export type TokenColor = MarkColor;
export const TOKEN_COLORS: TokenColor[] = ['red', 'green', 'blue'];

/** The number of a Zone Assignment option (rules §3.2). */
export type ZoneOption = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * RULE §3.2: the six options, as the rules list them - the token colour in zone A, B and C. (The
 * six orders of three colours, in the order the rules give.)
 */
export const ZONE_OPTIONS: Readonly<Record<ZoneOption, Readonly<Record<ZoneId, TokenColor>>>> = {
  1: { A: 'red', B: 'green', C: 'blue' },
  2: { A: 'red', B: 'blue', C: 'green' },
  3: { A: 'green', B: 'red', C: 'blue' },
  4: { A: 'green', B: 'blue', C: 'red' },
  5: { A: 'blue', B: 'red', C: 'green' },
  6: { A: 'blue', B: 'green', C: 'red' },
};
export const ZONE_OPTION_NUMBERS: ZoneOption[] = [1, 2, 3, 4, 5, 6];

export interface LockerRoomScenario {
  /** the Team Color card */
  team: TeamColor;
  /** the Zone Assignment card */
  option: ZoneOption;
}

/** How many arrangements there are: 2 team colours x 6 options. */
export const SCENARIO_COUNT = 2 * ZONE_OPTION_NUMBERS.length;

const TEAM_LETTER: Record<TeamColor, string> = { red: 'R', green: 'G' };
const TEAM_OF_LETTER: Record<string, TeamColor> = { R: 'red', G: 'green' };

const isTeam = (v: unknown): v is TeamColor => v === 'red' || v === 'green';
const isOption = (v: unknown): v is ZoneOption => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;

/** What is wrong with an arrangement, one plain sentence per problem; an empty list means it can be played. */
export function scenarioProblems(s: LockerRoomScenario): string[] {
  if (!s || typeof s !== 'object') return ['Choose a team colour and a zone card.'];
  const out: string[] = [];
  if (!isTeam(s.team)) out.push('The team colour must be RED or GREEN.');
  if (!isOption(s.option)) out.push('The zone card must be option 1 to 6.');
  return out;
}

export function isValidScenario(s: LockerRoomScenario): boolean {
  return scenarioProblems(s).length === 0;
}

/** The colour of the token in each zone. */
export function tokensOf(s: LockerRoomScenario): Readonly<Record<ZoneId, TokenColor>> {
  return ZONE_OPTIONS[s.option];
}

/** The zone the token of this colour stands in. */
export function zoneOfToken(s: LockerRoomScenario, color: TokenColor): ZoneId {
  return ZONE_IDS.find((zone) => ZONE_OPTIONS[s.option][zone] === color) as ZoneId;
}

/**
 * Number 0..11 of an arrangement: 6 x team (RED 0, GREEN 1) + option - 1; -1 for one that is not
 * valid. (Only for the order of "all 12 arrangements" and the random draw: a code is never a
 * number - see decodeScenario.)
 */
export function scenarioIndex(s: LockerRoomScenario): number {
  if (!isValidScenario(s)) return -1;
  return (s.team === 'green' ? 6 : 0) + s.option - 1;
}

/** The arrangement with this number (0..11; other whole numbers wrap round). */
export function scenarioFromIndex(index: number): LockerRoomScenario {
  const n = ((Math.floor(index) % SCENARIO_COUNT) + SCENARIO_COUNT) % SCENARIO_COUNT;
  return { team: n < 6 ? 'red' : 'green', option: ((n % 6) + 1) as ZoneOption };
}

/** All 12 arrangements, in number order: R1 .. R6, G1 .. G6 (for "test on every arrangement"). */
export function allScenarios(): LockerRoomScenario[] {
  return Array.from({ length: SCENARIO_COUNT }, (_, i) => scenarioFromIndex(i));
}

/**
 * The arrangement a new visitor sees first: "G5" - team GREEN, option 5 (BLUE in A, RED in B,
 * GREEN in C). Not the first of anything: not the first team colour, not the first option, and
 * every token stands in another zone than option 1 puts it, so a program that was only tried on
 * the first card of each kind shows it at once. (The rules have no arrangement of their own.)
 */
export function defaultScenario(): LockerRoomScenario {
  return { team: 'green', option: 5 };
}

/** Each of the 12 arrangements is equally likely. The same `rng` sequence gives the same arrangement. */
export function randomScenario(rng: () => number): LockerRoomScenario {
  return scenarioFromIndex(Math.floor(rng() * SCENARIO_COUNT) % SCENARIO_COUNT);
}

/** Short code of an arrangement: "G5" (the team colour's letter and the option's number). */
export function encodeScenario(s: LockerRoomScenario): string {
  return `${TEAM_LETTER[s.team] ?? '?'}${isOption(s.option) ? s.option : '?'}`;
}

/** The digits of Arabic writing (٠ - ٩, and the Persian ۰ - ۹), which NFKC leaves as they are. */
const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * A typed code with its digits and letters in the usual form: wide letters, as a keyboard for
 * Chinese or Japanese types them ("Ｇ５"), are read as the usual ones (NFKC), and so are the digits
 * of an Arabic keyboard ("G٥" -> "G5"): many students here type on one.
 */
export function normaliseCode(code: string): string {
  return code.normalize('NFKC').replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf));
}

/** The letters and digits of a typed code, in capitals: "g-5" -> "G5", "Ｇ５" and "G٥" -> "G5". */
export function compactCode(code: string): string {
  return normaliseCode(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Read a code back: "G5", "g5", "G-5", "green 5", "RED 2". Null for anything else - a number alone
 * included (the test window numbers its rows 1 to 12, and a row number must not name another
 * arrangement than that row's). Never throws.
 */
export function decodeScenario(code: string): LockerRoomScenario | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  const match = /^(R|RED|G|GREEN)([1-6])$/.exec(compactCode(code.trim()));
  if (!match) return null;
  return { team: TEAM_OF_LETTER[match[1][0]], option: Number(match[2]) as ZoneOption };
}

const TOKEN_WORD: Record<TokenColor, string> = { red: 'RED', green: 'GREEN', blue: 'BLUE' };

/** One line for people: "Team GREEN. Option 5: BLUE in A, RED in B, GREEN in C." */
export function describeScenario(s: LockerRoomScenario): string {
  const problems = scenarioProblems(s);
  if (problems.length > 0) return `This draw cannot be played. ${problems.join(' ')}`;
  const tokens = tokensOf(s);
  return `Team ${TOKEN_WORD[s.team]}. Option ${s.option}: ${ZONE_IDS.map((zone) => `${TOKEN_WORD[tokens[zone]]} in ${zone}`).join(', ')}.`;
}
