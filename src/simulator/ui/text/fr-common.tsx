/**
 * What every part of the French word table (./fr.tsx) shares: how French numbers and times are
 * written, the names of the cubes, the colours a sensor reads, how a match ends and what a
 * restart did.
 *
 * Numbers: the digits of the English screen with a decimal comma - 18,9 cm, 1:23,4, 0,5× (design
 * D10). A French number IS the English number with its "." replaced, so it keeps every rule of
 * ../format.ts: no "-0", tenths cut off for the referee, rounded time stamps elsewhere.
 * Typography: a no-break space (U+00A0) before : ; ! ? % » and after « (design 4.3).
 */
import type { FinishReason, Game, SensorColor } from '../../core/types';
import { formatNumber, formatRefereeTime, formatStamp, type RestartFacts, type TimeText } from '../format';
import { frPlural } from './plural';

/** The no-break space of French typography. */
export const NB = ' ';

/** The English way of writing a number or a time, with a decimal comma. (Only the decimal point is a "." there.) */
export const withComma = (text: string): string => text.replace('.', ',');

export const frNumber = (value: number, digits = 0): string => withComma(formatNumber(value, digits));
export const frMoment: TimeText = (seconds) => withComma(formatStamp(seconds));
export const frRefereeTime: TimeText = (seconds) => withComma(formatRefereeTime(seconds));
export const frTimeTextOf = (game: Pick<Game, 'createReferee'>): TimeText => (game.createReferee ? frRefereeTime : frMoment);

// =============================================================================================
// Names
// =============================================================================================

/** What the edge of the table is called where a sentence does not say (the word of Robot en fête). */
const TABLE_EDGE = 'le bord de la table';

/**
 * "cube:W1" -> "le cube E1": the warehouses are E1 – E4 on the French screen, in every sentence
 * (design D6). "wall" -> the edge of the table. (The other bodies of ../format.ts bodyName belong
 * to games that have no French page; they are named "le <kind> <name>".)
 */
export function frBodyName(bodyId: string, tableEdge = TABLE_EDGE): string {
  if (bodyId === 'wall') return tableEdge;
  const [kind, name] = bodyId.split(':');
  if (!name) return bodyId;
  if (kind === 'cube' && /^W\d$/.test(name)) return `le cube E${name.slice(1)}`;
  return `le ${kind} ${name}`;
}

/**
 * The French of the colours a sensor gives (design 6.3, D7). The program gets them in English
 * (`red`) - the same on both pages, compared with "=" in the examples - so the screen shows the
 * value as the program gets it, and its French in brackets.
 */
export const FR_COLOUR_NAMES: Record<SensorColor, string> = {
  red: 'rouge',
  green: 'vert',
  blue: 'bleu',
  yellow: 'jaune',
  cyan: 'cyan',
  purple: 'violet',
  white: 'blanc',
  black: 'noir',
};

/** "red" -> "red (rouge)"; a colour whose French is the same word stays one word ("cyan"). ("none" belongs to a sensor this page does not have.) */
export function frSensorValue(colour: SensorColor | 'none'): string {
  if (colour === 'none') return colour;
  const french = FR_COLOUR_NAMES[colour];
  return french === colour ? colour : `${colour} (${french})`;
}

// =============================================================================================
// The end of a match, restarts
// =============================================================================================

/** finishText (../format.ts) in French. (The two ends of Fire Chief never happen on this page: they keep their English.) */
export function frFinishText(reason: FinishReason | null): string {
  switch (reason) {
    case 'time':
      return 'Le temps est écoulé';
    case 'declared':
      return 'Tu as dit « Terminé »';
    case 'program-ended':
      return 'Le programme est fini';
    case 'mission-complete':
      return 'Mission complete';
    case 'target-displaced':
      return 'The target was moved';
    default:
      return 'Match terminé';
  }
}

/** finishSentence (../match-words.ts) in French: the referee's own sentence, or the reason and the time. */
export function frFinishSentence(reason: FinishReason | null, detail: string | null | undefined, time: number, timeText: TimeText = frMoment): string {
  const own = detail?.trim();
  if (own) return /[.!?]$/.test(own) ? own : `${own}.`;
  return `${frFinishText(reason)} à ${timeText(time)}.`;
}

/** Restarts are counted in whole numbers; "no limit" stays Infinity (../format.ts). */
function wholeRestarts(n: number): number {
  if (n === Infinity) return Infinity;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** restartsLeftText (../format.ts) in French: "1 relance restante", "Plus de relance". */
export function frRestartsLeftText(facts: RestartFacts, left: number | undefined): string {
  if (facts.rules?.maxRestarts === undefined || left === undefined) return '';
  const n = wholeRestarts(left);
  if (n === Infinity) return '';
  return n === 0 ? 'Plus de relance' : frPlural(n, `${n} relance restante`, `${n} relances restantes`);
}

/** restartLine (../format.ts) in French: the console line of a restart. */
export function frRestartLine(facts: RestartFacts, left?: number): string {
  let text = `Relance${NB}: le robot est de retour dans la zone de départ`;
  text += facts.penalty > 0 ? ` (-${facts.penalty} points).` : '.';
  if (facts.rules?.clearsPoints) text += ` Les points gagnés jusque-là sont effacés${NB}; le chrono continue.`;
  const remaining = frRestartsLeftText(facts, left);
  if (remaining) text += ` ${remaining}.`;
  return text;
}

/** restartNote (../format.ts) in French: "1 relance : -10 points". */
export function frRestartNote(restarts: number, penaltyEach: number): string {
  const count = Number.isFinite(restarts) ? Math.max(0, Math.floor(restarts)) : 0;
  if (count === 0) return '';
  const lost = count * Math.abs(penaltyEach);
  const points = frPlural(lost, 'point', 'points');
  return frPlural(count, `${count} relance${NB}: -${lost} ${points}`, `${count} relances${NB}: -${lost} ${points}`);
}
