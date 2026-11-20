/**
 * Fire Fighter has ONE setup and nothing is drawn (rules §3; the organiser: "Always the same: no
 * draw of the letters"):
 *
 *   - the referee puts the five cubes on their squares: a red cube on each of the four marked
 *     squares of the two pickup bays, the yellow cube on the red square above the Fire Station;
 *   - the four red cubes are alike ("Pick up any red cube", §4.2);
 *   - the letter towers always stand in the same places: M at the school (bottom left), A at the
 *     hospital (bottom right), K at the bakery (top right), E at the park (top left), X at the
 *     hydrant (middle).
 *
 * "Choose the order of the four red deliveries" (§4.2) is the team's choice, not a draw. So the
 * game's "combination" has one value, RULES_SETUP, with the code "MAKEX" (the five letters, in the
 * order of the rules' check table). The screen shows no code, no Random and no Default for it (the
 * shared screen's `fixedSetup`).
 */

/** The one setup of the rules. (An object, as every game's combination is.) */
export interface FireFighterScenario {
  readonly setup: 'rules';
}

export const RULES_SETUP: FireFighterScenario = Object.freeze({ setup: 'rules' as const });

/** The code of the one setup: the five letters of the towers, M A K E X. */
export const SETUP_CODE = 'MAKEX';

/** How many setups there are: one. */
export const SCENARIO_COUNT = 1;

/** The setup a visitor sees first: the one setup. */
export function defaultScenario(): FireFighterScenario {
  return RULES_SETUP;
}

/** A "random" setup: the one setup (nothing is drawn, so no number is taken from `rng`). */
export function randomScenario(_rng: () => number): FireFighterScenario {
  return RULES_SETUP;
}

export function encodeScenario(_s: FireFighterScenario): string {
  return SETUP_CODE;
}

/**
 * Read a code back: "MAKEX" in any letter case, with spaces around it (a code saved by the screen,
 * or typed). Null for anything else. Never throws.
 */
export function decodeScenario(code: string): FireFighterScenario | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  return code.trim().toUpperCase() === SETUP_CODE ? RULES_SETUP : null;
}

/** One line for people. */
export function describeScenario(_s: FireFighterScenario): string {
  return 'Red cubes on the four squares of the bays, the yellow cube on its red square; towers M (school), A (hospital), K (bakery), E (park) and X (hydrant).';
}
