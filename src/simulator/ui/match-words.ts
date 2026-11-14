/**
 * What the match controls and the status line say about restarts and about the end of a match -
 * for any game. The facts come from the game (Game.restartPenalty, Game.restartRules) and from
 * the simulation (Simulation.restartsLeft, Simulation.finishDetail); this file turns them into
 * words.
 *
 * Two kinds of restart exist today:
 *   Fire Rescue   as many as the team wants, 5 points each
 *   Fire Chief    one per attempt; it costs no points of its own but clears what was earned
 * The words below are put together from the rules, not from the name of the game, so a third
 * game with other numbers gets true sentences too.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import type { FinishReason } from '../core/types';
import { finishText, formatStamp, restartNote, restartsLeftText, type RestartFacts, type TimeText } from './format';

/** What the "Restart" button shows and says. */
export interface RestartButtonWords {
  /** the small label behind the word "Restart": "-5", "1 left", "0 left"; empty = no label */
  badge: string;
  /** what the label is about: the restart costs points / so many are left / none is left */
  tone: 'cost' | 'left' | 'none';
  /** false when the rules allow no (more) restart: the button stays off, also during a match */
  allowed: boolean;
  /** what the button says when the pointer rests on it: what a restart does, or why it is off */
  hint: string;
}

/**
 * The "Restart" button of a game.
 * `left`: the restarts the team may still use (Simulation.restartsLeft; Infinity = no limit).
 * `match`: what the game calls one scored run ("match", "attempt").
 */
export function restartButton(facts: RestartFacts, left: number, match: string): RestartButtonWords {
  const max = facts.rules?.maxRestarts;
  const limited = max !== undefined;
  const remaining = limited ? (Number.isFinite(left) ? Math.max(0, Math.floor(left)) : Math.max(0, Math.floor(max))) : Infinity;

  if (limited && remaining === 0) {
    const allowance = max <= 0 ? 'This game allows no restart.' : `No restart left: this game allows ${max} restart${max === 1 ? '' : 's'} per ${match}, and ${max === 1 ? 'it was' : 'they were'} used.`;
    return { badge: '0 left', tone: 'none', allowed: false, hint: allowance };
  }

  let hint = 'Rules restart: the robot goes back into the start zone, ';
  hint += facts.rules?.resetsBodies ? 'every game element is put back where it started, ' : 'whatever it carries goes back to where it came from, ';
  hint += 'the clock keeps running.';
  if (facts.rules?.clearsPoints) hint += ' The points earned so far are cleared.';
  if (facts.penalty > 0) hint += ` Costs ${facts.penalty} points.`;
  if (limited) hint += ` This game allows ${max} restart${max === 1 ? '' : 's'} per ${match}: ${remaining} left.`;

  if (limited) return { badge: `${remaining} left`, tone: 'left', allowed: true, hint };
  return { badge: facts.penalty > 0 ? `-${facts.penalty}` : '', tone: 'cost', allowed: true, hint };
}

/**
 * What the restarts of this match have done so far, for the status line:
 * "1 restart: -5 points" (Fire Rescue), "1 restart: points cleared, no restart left" (Fire Chief).
 * Empty when there was no restart.
 */
export function restartSummary(restarts: number, facts: RestartFacts, left?: number): string {
  const count = Number.isFinite(restarts) ? Math.max(0, Math.floor(restarts)) : 0;
  if (count === 0) return '';
  const parts: string[] = [];
  if (facts.penalty > 0) {
    // (the same words as before there were games without a penalty)
    parts.push(restartNote(count, facts.penalty));
  } else {
    parts.push(`${count} restart${count === 1 ? '' : 's'}${facts.rules?.clearsPoints ? ': points cleared' : ''}`);
  }
  if (facts.penalty > 0 && facts.rules?.clearsPoints) parts.push('points cleared');
  const remaining = restartsLeftText(facts, left);
  if (remaining) parts.push(remaining.charAt(0).toLowerCase() + remaining.slice(1));
  return parts.join(', ');
}

/**
 * How the match ended, as one sentence for the status line: the referee's own sentence when
 * the referee ended the match (Simulation.finishDetail), otherwise the reason and the time -
 * "Time is up at 3:00.0." (`timeText`: how this game writes a time, see timeTextOf in ./format.ts.)
 */
export function finishSentence(reason: FinishReason | null, detail: string | null | undefined, time: number, timeText: TimeText = formatStamp): string {
  const own = detail?.trim();
  if (own) return /[.!?]$/.test(own) ? own : `${own}.`;
  return `${finishText(reason)} at ${timeText(time)}.`;
}

/**
 * The first statement of the referee's sentence about the end of a match, for the status line
 * above the mat:
 *
 *   "Mission complete at 0:14.4 with 80 of 100 points: the fan blew ... Not earned: ..."
 *       -> "Mission complete at 0:14.4 with 80 of 100 points."
 *   "The robot pushed the fire target out of its place (by 6 mm). The attempt ends here; ..."
 *       -> "The robot pushed the fire target out of its place (by 6 mm)."
 *
 * The status line has room for two lines of text; a longer one pushes the mat and the buttons
 * under it down, out of a small window. So it says how the match ended in the referee's first
 * words, and the whole sentence stands on the score sheet (which the button beside the status
 * line opens) and in the console.
 *
 * It ends where the first sentence ends, or at the first colon that is followed by a blank
 * (the colon inside a time, "0:14.4", is not one).
 */
export function finishHeadline(detail: string): string {
  const own = detail.trim();
  const end = /[.!?](?=\s|$)|:(?=\s)/.exec(own);
  if (!end) return own === '' ? '' : `${own}.`;
  const head = own.slice(0, end.index);
  return `${head}${end[0] === ':' ? '.' : end[0]}`;
}
