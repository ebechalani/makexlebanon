/**
 * Robot en fête 2027: what the referee of the Warehouse Sort mission says, in French - the
 * zones on the mat, the console lines of a match and the lines of the score sheet
 * (../warehouse-sort/referee-words.ts RefereeWords; the English words are there).
 *
 * The texts are those of the design's French table (fr-strings.json, "src/simulator/warehouse-
 * sort/game.ts"), with "tu" for the student. Numbers and times have a decimal comma: "1:23,4",
 * "5,1 mm" (design D10) - the English referee's digits with the point replaced, so the tenths
 * are still cut off, never rounded up. A cube is named with its warehouse E1 - E4 and its
 * colour: "cube E2 (rouge)" (design D6). Two forms of a word that counts: the first for 0 and 1.
 *
 * Plain TypeScript (no DOM, no React), so it also runs headless under Node.
 */
import { clock as enClock, type RefereeWords } from '../warehouse-sort/referee-words';
import { FR_PAD, NB, frBayColour, frCubeColour, frWarehouse, withComma } from './scenario-words';

/** The first form for 0 and 1, the second above ("1 relance", "2 relances"). */
const plural = (n: number, one: string, other: string): string => (Math.abs(n) <= 1 ? one : other);
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const cubeName = (w: Parameters<RefereeWords['cubeName']>[0], color: Parameters<RefereeWords['cubeName']>[1]): string =>
  `cube ${frWarehouse(w)} (${frCubeColour(color)})`;
const robotHolds = (over: boolean): string => (over ? 'le robot le tenait encore' : 'le robot le tient');

export const FR_REFEREE_WORDS: RefereeWords = {
  clock: (seconds) => withComma(enClock(seconds)),
  cm: (mm) => withComma(String(Math.round(mm) / 10)),
  decimal: withComma,
  warehouse: frWarehouse,
  cubeName,
  bayName: (color) => `la baie ${frBayColour(color)}`,

  startZone: 'Zone de départ',
  warehouseZone: (w, color) => `${frWarehouse(w)} ${frCubeColour(color)}`,
  bayZone: (color) => `Baie ${frBayColour(color)}`,
  finishPad: 'Aire d’arrivée',

  leftStart: (points, time) => `+${points} points à ${time}${NB}: le robot est sorti de la zone de départ.`,
  pickedUp: (points, time, name) => `+${points} points à ${time}${NB}: ${name} pris.`,
  inBay: (time, name, bay) => `${time}${NB}: le ${name} est dans ${bay}.`,
  inWrongBay: (time, name, bay) => `${time}${NB}: le ${name} est dans ${bay}\u00a0– la mauvaise baie.`,
  offMat: (time, name) => `${time}${NB}: le ${name} est hors du tapis. Il ne rapporte plus rien.`,
  bluePickedUp: (time, name, penalty) => `${time}${NB}: le ${name} a été pris${NB}: -${penalty}. Le cube bleu doit rester à sa place.`,
  blueMoved: (time, name) => `${time}${NB}: le ${name} a été déplacé de sa place. Le cube bleu doit rester à sa place.`,
  blueBack: (time, name) => `${time}${NB}: le ${name} est de retour à sa place.`,

  leaveStartLabel: 'Sortir de la zone de départ',
  doneAt: (time) => `fait à ${time}`,
  neverLeft: 'le robot n’est jamais sorti de la zone de départ',
  notYetLeft: 'pas encore\u00a0– sors de la zone de départ',

  pickLabel: (name) => `Prendre le ${name}`,
  notOnField: 'ce cube n’est pas sur le terrain',
  offMatPlace: 'hors du tapis',
  wrongBayPlace: 'dans la mauvaise baie',
  pickedButLost: (time, where) => `pris à ${time}, mais le cube est ${where}${NB}: aucun point`,
  lostNoPoints: (where) => `le cube est ${where}${NB}: aucun point`,
  grippedNotPicked: (lift, carry) => `saisi, mais pas soulevé de ${lift} cm ni porté sur ${carry} cm`,
  notPicked: 'pas pris',
  notYetPicked: (lift, carry) => `pas encore\u00a0– saisis-le, puis soulève-le de ${lift} cm ou porte-le sur ${carry} cm`,

  deliverLabel: (name, bay) => `${capital(name)} dans ${bay}`,
  inBaySince: (bay, time) => `dans ${bay} depuis ${time}`,
  inBayNow: (bay) => `dans ${bay}`,
  wrongBayDetail: (bay, penalty) => `dans ${bay}\u00a0– mauvaise baie, -${penalty}`,
  offMatNoPoints: `hors du tapis${NB}: aucun point`,
  heldPutDown: (over, bay) => `${robotHolds(over)}\u00a0– pose-le dans ${bay}`,
  liftedPutDown: (bay) => `pas posé sur le tapis\u00a0– pose-le dans ${bay}`,
  touchingRobot: (bay, over) => `dans ${bay}, mais il touche le robot${over ? '' : '\u00a0– éloigne-toi'}`,
  partlyInBay: (bay) => `seulement en partie dans ${bay}\u00a0– tout le cube doit être dedans`,
  notInBay: 'dans aucune baie',
  notYetInBay: (bay) => `pas encore\u00a0– mets-le dans ${bay}`,

  parkLabel: 'Se garer sur une aire d’arrivée',
  parkedOn: (pad, over) => `le robot ${over ? 'a touché' : 'touche'} l’aire d’arrivée ${FR_PAD[pad] ?? pad}`,
  noPadAtEnd: 'à la fin, le robot ne touchait aucune aire d’arrivée',
  mustTouchPad: 'à la fin, le robot doit toucher une aire d’arrivée ronde (à gauche ou à droite)',
  cleanLabel: `Parcours propre${NB}: aucune relance`,
  noRestart: 'aucune relance',
  noRestartSoFar: 'aucune relance pour l’instant',
  restartUsed: 'une relance a été utilisée',
  restartsLabel: 'Relances',
  noRestarts: 'aucune relance',
  // (the times have a decimal comma, "0:12,3": a list of them is cut with semicolons, as French
  // does - "0:12,3 ; 0:40,1" - where the table's ", " would make "0:12,3, 0:40,1")
  restartsDetail: (restarts, times, penalty) => {
    const when = times.join(`${NB}; `);
    return plural(restarts, `${restarts} relance (${when}), -${penalty}`, `${restarts} relances (${when}), -${penalty} chacune`);
  },
  wrongLabel: 'Cubes dans la mauvaise baie',
  noneWrong: 'aucun',
  wrongDetail: (cubes, penalty) => plural(cubes.length, `${cubes.join(', ')}, -${penalty}`, `${cubes.join(', ')}, -${penalty} chacun`),

  blueLabel: (w) => `Cube bleu (${frWarehouse(w)})`,
  leftAlone: 'laissé en place',
  blueMovedDetail: (move, penalty) => `déplacé${NB}: ${move}, -${penalty}`,
  robotHolds,
  pickedUpAt: (time) => `pris à ${time}`,
  itIsOffMat: 'il est hors du tapis',
  fromItsPlace: (mm) => `à ${mm} mm de sa place`,

  lastDeliveryLabel: 'Temps de la dernière livraison correcte',
  tieDetail: (delivered, time) =>
    plural(
      delivered,
      `pour départager${NB}: ${delivered} cube dans la bonne baie, posé à ${time}`,
      `pour départager${NB}: ${delivered} cubes dans la bonne baie, le dernier posé à ${time}`,
    ),
  startPositionLabel: 'Partir de l’intérieur de la zone de départ',
  startPositionDetail: 'le robot n’est pas parti tout entier dans la zone de départ\u00a0– un arbitre ne lancerait pas ce match',
};
