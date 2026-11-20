/**
 * The map code on the screen, and what the screen remembers in the browser (design 7.8, 7.14).
 *
 *   - The code of the map on the stage: "P3" for a practice map, "S-A6-D5-C5-C7-E3-F5-F7" for an
 *     own setup (../../fire-cadet/scenario.ts encodeScenario). A teacher copies it, or types one.
 *   - A typed code is read by the game itself (readMapCode): the map, or ONE plain sentence that
 *     says what is wrong with it.
 *   - The settings (map, way to play, speed, which sections are open) and the row are remembered
 *     in the browser. A saved code that no longer reads gives practice map 1; a saved row is read
 *     with readCards, so it is always a valid row.
 *   - An example (design 7.12): its cards, and the map it was made for (its `field`).
 *
 * Plain TypeScript (no DOM, no React), so it is tested under Node.
 */
import { cardRowProgram, readCards, type CardName } from '../../fire-cadet/cards';
import { defaultScenario, encodeScenario, practiceMapNumber, readMapCode, type FireCadetScenario } from '../../fire-cadet/scenario';
import { isRecord } from '../storage';
import type { Speed } from '../useSimulation';
import { CADET_WORDS, PLAY_MODES, type PlayMode } from './words';

/** The game's id: the name of its keys in the browser (ui/storage.ts storageKey) and of its examples. */
export const GAME_ID = 'fire-cadet';

/** The speeds Junior may choose (N8): the engine's 1x, 2x and 4x. Mini always plays at 1x. */
export const CADET_SPEEDS: readonly Extract<Speed, number>[] = [1, 2, 4];

/** What reading a typed code gives: the map, or the one sentence of the game that says what is wrong. */
export type TypedCode = { ok: true; scenario: FireCadetScenario } | { ok: false; problem: string };

/** Read a code that a teacher typed (capitals, blanks, hyphens, dots and commas do not matter). */
export function readTypedCode(text: string): TypedCode {
  const reading = readMapCode(text);
  return reading.ok ? { ok: true, scenario: reading.scenario } : { ok: false, problem: reading.problem };
}

/** The code of a map, as the screen shows it. */
export const mapCode = (s: FireCadetScenario): string => encodeScenario(s);

/** The note in the banner when a map is put on the stage: "Map 3." or "My own map." */
export function mapNote(s: FireCadetScenario): string {
  const n = practiceMapNumber(s);
  return n !== null ? CADET_WORDS.notes.practiceMap(n) : CADET_WORDS.notes.ownMap;
}

// =============================================================================================
// What the browser remembers (design 7.14)
// =============================================================================================

/** The settings, as they are saved: `{ scenario: <code>, mode, speed, open: { map, score } }`. */
export interface SavedSettings {
  scenario: string;
  mode: PlayMode;
  speed: number;
  open: { map: boolean; score: boolean };
}

/** The settings of a first visit: practice map 1, Junior, 1x, the Map section open and the Score sheet closed. */
export const FIRST_VISIT: Readonly<SavedSettings> = Object.freeze({
  scenario: encodeScenario(defaultScenario()),
  mode: 'cards',
  speed: 1,
  open: Object.freeze({ map: true, score: false }),
});

/** The settings the screen starts with. */
export interface ScreenSettings {
  scenario: FireCadetScenario;
  mode: PlayMode;
  speed: Extract<Speed, number>;
  open: { map: boolean; score: boolean };
}

/**
 * Whatever was saved, made into settings the screen can use: what is missing or no longer reads
 * is the first visit's (a code that no longer reads gives practice map 1). It never throws.
 */
export function readSettings(saved: unknown): ScreenSettings {
  const raw = isRecord(saved) ? saved : {};
  const reading = typeof raw.scenario === 'string' ? readMapCode(raw.scenario) : null;
  const mode = (PLAY_MODES as readonly unknown[]).includes(raw.mode) ? (raw.mode as PlayMode) : FIRST_VISIT.mode;
  const speed = (CADET_SPEEDS as readonly unknown[]).includes(raw.speed) ? (raw.speed as Extract<Speed, number>) : 1;
  const open = isRecord(raw.open) ? raw.open : {};
  return {
    scenario: reading?.ok ? reading.scenario : defaultScenario(),
    mode,
    speed,
    open: {
      map: typeof open.map === 'boolean' ? open.map : FIRST_VISIT.open.map,
      score: typeof open.score === 'boolean' ? open.score : FIRST_VISIT.open.score,
    },
  };
}

/** The settings as they are saved. */
export const savedSettings = (settings: ScreenSettings): SavedSettings => ({
  scenario: encodeScenario(settings.scenario),
  mode: settings.mode,
  speed: settings.speed,
  open: { ...settings.open },
});

/** The row as it is saved: the program of design 4.1, without a map. */
export const savedRow = (cards: readonly CardName[]): ReturnType<typeof cardRowProgram> => cardRowProgram(cards);

/** A saved row, read back: always a valid row (anything else gives an empty row). */
export const readSavedRow = (saved: unknown): CardName[] => readCards(saved);

// =============================================================================================
// Loading an example (design 7.12)
// =============================================================================================

/** What loading an example puts on the screen: its cards, and the map it was made for (null when its `field` does not read: the map stays). */
export interface ExampleToLoad {
  cards: CardName[];
  scenario: FireCadetScenario | null;
}

/** Read an example's program: its row with readCards, and its `field` with readMapCode. */
export function exampleToLoad(program: unknown): ExampleToLoad {
  const field = isRecord(program) && typeof program.field === 'string' ? readMapCode(program.field) : null;
  return { cards: readCards(program), scenario: field?.ok ? field.scenario : null };
}
