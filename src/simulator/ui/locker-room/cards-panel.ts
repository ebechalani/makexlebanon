/**
 * What the Cards panel of Locker Room does when a student changes a card (./CardsEditor.tsx), and
 * the words it shows.
 *
 * A draw is two cards (../../locker-room/scenario.ts): the Team Colour card, RED or GREEN, and the
 * Zone Assignment card, one of the six options of the rules (§3.2), each of which puts the three
 * tokens - RED, GREEN and BLUE - into zones A, B and C, one token in each zone. The panel offers
 * three ways to change them:
 *
 *   - the team colour: RED or GREEN;
 *   - the zone card by its number, 1 to 6;
 *   - the colour of the token in one zone. Every colour is in exactly one zone, so the token of
 *     that colour MOVES there: it swaps places with the token that was in the zone (one plain
 *     sentence says which zone changed too). The six options are all the ways to put three
 *     colours into three zones, so a swap always gives one of them.
 *
 * Anything else - a team colour that is not RED or GREEN, an option that is not 1 to 6, a token
 * colour that is not RED, GREEN or BLUE - is refused with one plain sentence, and the field stays
 * as it was: a draw that is not one of the 12 never reaches the stage.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { TEAM_COLORS, ZONE_IDS, type TeamColor, type ZoneId } from '../../locker-room/field';
import { TOKEN_COLORS, ZONE_OPTIONS, ZONE_OPTION_NUMBERS, tokensOf, type LockerRoomScenario, type TokenColor, type ZoneOption } from '../../locker-room/scenario';

/** A colour as the rules write it: "RED". */
export const COLOR_WORD: Record<TokenColor, string> = { red: 'RED', green: 'GREEN', blue: 'BLUE' };

/**
 * The three zones as they lie on the mat, from the top down: C at the top, B in the middle, A at
 * the bottom (../../locker-room/field.ts ZONES - "Zone A = the lowest").
 */
export const ZONES_TOP_DOWN: readonly ZoneId[] = ['C', 'B', 'A'];

/** Where a zone is on the mat, in two words. */
export const ZONE_PLACE: Record<ZoneId, string> = { A: 'at the bottom', B: 'in the middle', C: 'at the top' };

/** What a change of a card gives: the new draw (with a sentence when a second zone changed too), or the sentence that says why not. */
export type CardChange = { ok: true; scenario: LockerRoomScenario; note?: string } | { ok: false; problem: string };

const isTeam = (value: unknown): value is TeamColor => (TEAM_COLORS as unknown[]).includes(value);
const isOption = (value: unknown): value is ZoneOption => (ZONE_OPTION_NUMBERS as unknown[]).includes(value);
const isToken = (value: unknown): value is TokenColor => (TOKEN_COLORS as unknown[]).includes(value);

/** The draw with another team colour. */
export function changeTeam(scenario: LockerRoomScenario, team: TeamColor): CardChange {
  if (!isTeam(team)) return { ok: false, problem: 'The team colour is RED or GREEN.' };
  return { ok: true, scenario: team === scenario.team ? scenario : { ...scenario, team } };
}

/** The draw with another zone card, by its number. */
export function changeOption(scenario: LockerRoomScenario, option: ZoneOption): CardChange {
  if (!isOption(option)) return { ok: false, problem: `There are ${ZONE_OPTION_NUMBERS.length} zone cards: option 1 to ${ZONE_OPTION_NUMBERS.length}.` };
  return { ok: true, scenario: option === scenario.option ? scenario : { ...scenario, option } };
}

/**
 * The zone card that puts these colours into zones A, B and C, or null when no card does (two
 * zones with the same colour, a colour that is no token's).
 */
export function optionOf(tokens: Readonly<Record<ZoneId, TokenColor>>): ZoneOption | null {
  return ZONE_OPTION_NUMBERS.find((option) => ZONE_IDS.every((zone) => ZONE_OPTIONS[option][zone] === tokens[zone])) ?? null;
}

/**
 * The draw with the token of `color` in `zone`. That token moves there from its zone, and the token
 * that was in `zone` takes its place: still one token of each colour, so still one of the six
 * zone cards.
 */
export function changeZone(scenario: LockerRoomScenario, zone: ZoneId, color: TokenColor): CardChange {
  if (!ZONE_IDS.includes(zone)) return { ok: false, problem: 'The zones are A, B and C.' };
  if (!isToken(color)) return { ok: false, problem: 'A token is RED, GREEN or BLUE.' };
  const now = tokensOf(scenario);
  if (now[zone] === color) return { ok: true, scenario };
  const from = ZONE_IDS.find((other) => now[other] === color) as ZoneId;
  const next: Record<ZoneId, TokenColor> = { ...now, [zone]: color, [from]: now[zone] };
  const option = optionOf(next);
  // (cannot happen: a swap of two zones is always one of the six cards - but a draw that is no card never reaches the stage)
  if (option === null) return { ok: false, problem: 'Not one of the six zone cards: each colour must be in one zone only.' };
  return { ok: true, scenario: { ...scenario, option }, note: `Each colour is in one zone only: zone ${from} has the ${COLOR_WORD[now[zone]]} token now.` };
}

/** The zone card in words, zone by zone: "BLUE in A, RED in B, GREEN in C". */
export function optionInWords(option: ZoneOption): string {
  return ZONE_IDS.map((zone) => `${COLOR_WORD[ZONE_OPTIONS[option][zone]]} in ${zone}`).join(', ');
}
