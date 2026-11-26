/**
 * Logistique intelligente has ONE setup and nothing is drawn. RULE p. 12/8: "Starting Condition:
 * 10 Transport cubes are located in the storage center with 2 layers, each layer have 5 cubes,
 * placing as a “cross”." (Fig 4.4-1, p. 13/9: a stack of two cubes on each of the five squares of
 * the cross, each top cube right on the bottom cube of its square.) The robot starts in the start
 * area (p. 15/11); the warehouses are printed on the mat.
 *
 * So the game's "combination" has one value, RULES_SETUP, with the code "CROIX" (the cross). The
 * screen shows no code, no Random and no Default for it (the shared screen's `fixedSetup`); the
 * console's start line reads « C’est parti ! Disposition CROIX. ».
 *
 * Plain TypeScript, no DOM.
 */

/** The no-break space of French typography: before : ; ! ? and the closing guillemet, after the opening one. */
export const NB = '\u00a0';

/** The one setup of the rules. (An object, as every game's combination is.) */
export interface LogistiqueScenario {
  readonly setup: 'croix';
}

export const RULES_SETUP: LogistiqueScenario = Object.freeze({ setup: 'croix' as const });

/** The code of the one setup: the cross of the storage centre. */
export const SETUP_CODE = 'CROIX';

/** How many setups there are: one. */
export const SCENARIO_COUNT = 1;

/** The setup a visitor sees first: the one setup. */
export function defaultScenario(): LogistiqueScenario {
  return RULES_SETUP;
}

/** A "random" setup: the one setup (nothing is drawn, so no number is taken from `rng`). */
export function randomScenario(_rng: () => number): LogistiqueScenario {
  return RULES_SETUP;
}

export function encodeScenario(_s: LogistiqueScenario): string {
  return SETUP_CODE;
}

/**
 * Read a code back: "CROIX" in any letter case, with spaces around it (a code saved by the screen,
 * or typed). Null for anything else. Never throws.
 */
export function decodeScenario(code: string): LogistiqueScenario | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  return code.trim().toUpperCase() === SETUP_CODE ? RULES_SETUP : null;
}

/** One line for people, in French (« dessous / dessus » for the two layers). */
export function describeScenario(_s: LogistiqueScenario): string {
  return `Dix cubes jaunes sur la croix de la zone de stockage, en deux étages de cinq${NB}: les cubes 1 à 5 dessous, les cubes 6 à 10 dessus.`;
}
