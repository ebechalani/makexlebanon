/**
 * Reading a code that somebody typed in, pasted or saved: either it stands for a combination
 * of the game, or it gets ONE plain sentence that says why not. Never an exception, never a
 * technical message - the sentence is shown under the field as it is.
 *
 * A game that says nothing is read with its own Game.decodeScenario and the sentence of the
 * first game, Fire Rescue. A game whose codes need more words (Fire Chief: a text can be no
 * code at all, or the code of a maze that is not finished) hands over its own reader
 * (SimulatorAppProps.readCode).
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import type { Game } from '../core/types';

/** What a text turned out to be: a combination, or the sentence that says why it is none. */
export type CodeReading<S> = { ok: true; scenario: S } | { ok: false; problem: string };

/** How a game reads a code. It must never throw, whatever the text is. */
export type CodeReader<S> = (text: string) => CodeReading<S>;

/** The reader of a game that brings none of its own: the game decodes, the screen words the refusal. */
export function codeReaderOf<S>(game: Pick<Game<S>, 'decodeScenario' | 'encodeScenario' | 'defaultScenario'>): CodeReader<S> {
  return (text) => {
    const typed = text.trim();
    const scenario = game.decodeScenario(typed);
    if (scenario) return { ok: true, scenario };
    return { ok: false, problem: `"${typed}" is not a combination code. A code looks like ${game.encodeScenario(game.defaultScenario())}.` };
  };
}
