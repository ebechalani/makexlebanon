/**
 * Every sentence and name the Warehouse Sort referee says (./game.ts), in one place: the zones
 * on the mat, the console lines during a match and the lines of the score sheet.
 *
 * The referee is one and the same for two pages: Warehouse Sort in English (EN_REFEREE_WORDS,
 * below) and Robot en fête 2027 in French (../robot-en-fete/referee-words.ts). Only the words
 * differ - the points, the times, the line ids and what is judged are the referee's.
 *
 * The English words were moved here from game.ts as they were, byte for byte: the same
 * templates, the same order of their pieces. A sentence that names a number or a time gets it
 * already written (the language writes "1:23.4" or "1:23,4": `clock`, `cm`, `decimal`); the
 * points and penalties come in as numbers, since they are written the same in both languages.
 *
 * Plain TypeScript (no DOM, no React), so it also runs headless under Node.
 */
import type { BayColor, PadId, WarehouseId } from './field';
import type { CubeColor } from './scenario';

export interface RefereeWords {
  // ---- numbers and names
  /** match time as the referee writes it: 83.42 -> "1:23.4" (tenths cut off, never rounded up) */
  clock(seconds: number): string;
  /** mm in cm, as a sentence writes it: 10 -> "1", 40 -> "4" */
  cm(mm: number): string;
  /** a number the referee worked out, written with a point ("5.1"), as this language writes it */
  decimal(value: string): string;
  /** a warehouse in a sentence: "W2" */
  warehouse(warehouse: WarehouseId): string;
  /** "cube W2 (red)" */
  cubeName(warehouse: WarehouseId, color: CubeColor): string;
  /** "the red bay" */
  bayName(color: BayColor): string;

  // ---- the zones the screen can colour (Game.overlays)
  startZone: string;
  /** "W1 green" */
  warehouseZone(warehouse: WarehouseId, color: CubeColor): string;
  /** "Red bay" */
  bayZone(color: BayColor): string;
  finishPad: string;

  // ---- the console, during a match (`time` is written with `clock`, `cube` is `cubeName`)
  leftStart(points: number, time: string): string;
  pickedUp(points: number, time: string, cube: string): string;
  inBay(time: string, cube: string, bay: string): string;
  inWrongBay(time: string, cube: string, bay: string): string;
  offMat(time: string, cube: string): string;
  bluePickedUp(time: string, cube: string, penalty: number): string;
  blueMoved(time: string, cube: string): string;
  blueBack(time: string, cube: string): string;

  // ---- the score sheet: leaving the start zone
  leaveStartLabel: string;
  doneAt(time: string): string;
  neverLeft: string;
  notYetLeft: string;

  // ---- picking a cube up (`where`: offMatPlace or wrongBayPlace; `lift`, `carry`: cm)
  pickLabel(cube: string): string;
  notOnField: string;
  offMatPlace: string;
  wrongBayPlace: string;
  pickedButLost(time: string, where: string): string;
  lostNoPoints(where: string): string;
  grippedNotPicked(lift: string, carry: string): string;
  notPicked: string;
  notYetPicked(lift: string, carry: string): string;

  // ---- a cube in its bay (`bay` is `bayName`)
  deliverLabel(cube: string, bay: string): string;
  inBaySince(bay: string, time: string): string;
  inBayNow(bay: string): string;
  wrongBayDetail(bay: string, penalty: number): string;
  offMatNoPoints: string;
  heldPutDown(over: boolean, bay: string): string;
  liftedPutDown(bay: string): string;
  touchingRobot(bay: string, over: boolean): string;
  partlyInBay(bay: string): string;
  notInBay: string;
  notYetInBay(bay: string): string;

  // ---- parking, restarts, the wrong bay
  parkLabel: string;
  parkedOn(pad: PadId, over: boolean): string;
  noPadAtEnd: string;
  mustTouchPad: string;
  cleanLabel: string;
  noRestart: string;
  noRestartSoFar: string;
  restartUsed: string;
  restartsLabel: string;
  noRestarts: string;
  /** `times`: the match times of the restarts, each written with `clock` */
  restartsDetail(restarts: number, times: string[], penalty: number): string;
  wrongLabel: string;
  noneWrong: string;
  /** `cubes`: the cubes in the wrong bay, each a `cubeName` */
  wrongDetail(cubes: string[], penalty: number): string;

  // ---- the blue cube (Q15)
  blueLabel(warehouse: WarehouseId): string;
  leftAlone: string;
  blueMovedDetail(move: string, penalty: number): string;
  /** why the blue cube counts as moved: the robot holds it ... */
  robotHolds(over: boolean): string;
  /** ... it was picked up or lifted at `time` ... */
  pickedUpAt(time: string): string;
  /** ... it is off the mat ... */
  itIsOffMat: string;
  /** ... or it is this far from its place (`mm`: a number written with `decimal`) */
  fromItsPlace(mm: string): string;

  // ---- the time for a tie, the start position
  lastDeliveryLabel: string;
  tieDetail(delivered: number, time: string): string;
  startPositionLabel: string;
  startPositionDetail: string;
}

/** Match time as the referee writes it: 83.42 -> "1:23.4" (tenths cut off, never rounded up). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1)}`;
}

/** mm in cm, as a sentence writes it: 10 -> "1", 40 -> "4". */
const cm = (mm: number): string => String(Math.round(mm) / 10);
const bayName = (color: BayColor): string => `the ${color} bay`;
/** "cube W2 (red)" */
const cubeName = (w: WarehouseId, color: CubeColor): string => `cube ${w} (${color})`;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The words of Warehouse Sort: the English page. */
export const EN_REFEREE_WORDS: RefereeWords = {
  clock,
  cm,
  decimal: (value) => value,
  warehouse: (w) => w,
  cubeName,
  bayName,

  startZone: 'Start zone',
  warehouseZone: (w, color) => `${w} ${color}`,
  bayZone: (color) => `${color === 'red' ? 'Red' : 'Green'} bay`,
  finishPad: 'Finish pad',

  leftStart: (points, time) => `+${points} points at ${time}: the robot left the start zone.`,
  pickedUp: (points, time, name) => `+${points} points at ${time}: ${name} picked up.`,
  inBay: (time, name, bay) => `${time}: ${capital(name)} is in ${bay}.`,
  inWrongBay: (time, name, bay) => `${time}: ${capital(name)} is in ${bay} - the wrong bay.`,
  offMat: (time, name) => `${time}: ${capital(name)} is off the mat. It scores nothing now.`,
  bluePickedUp: (time, name, penalty) => `${time}: ${capital(name)} was picked up: -${penalty}. The blue cube must stay where it is.`,
  blueMoved: (time, name) => `${time}: ${capital(name)} was moved out of its place. The blue cube must stay where it is.`,
  blueBack: (time, name) => `${time}: ${capital(name)} is back in its place.`,

  leaveStartLabel: 'Leave the start zone',
  doneAt: (time) => `done at ${time}`,
  neverLeft: 'the robot never left the start zone',
  notYetLeft: 'not yet - drive out of the start zone',

  pickLabel: (name) => `Pick up ${name}`,
  notOnField: 'this cube is not on the field',
  offMatPlace: 'off the mat',
  wrongBayPlace: 'in the wrong bay',
  pickedButLost: (time, where) => `picked at ${time}, but the cube is ${where}: no points`,
  lostNoPoints: (where) => `the cube is ${where}: no points`,
  grippedNotPicked: (lift, carry) => `gripped, but not lifted ${lift} cm or carried ${carry} cm`,
  notPicked: 'not picked up',
  notYetPicked: (lift, carry) => `not yet - grip it, then lift it ${lift} cm or carry it ${carry} cm`,

  deliverLabel: (name, bay) => `${capital(name)} in ${bay}`,
  inBaySince: (bay, time) => `in ${bay} since ${time}`,
  inBayNow: (bay) => `in ${bay}`,
  wrongBayDetail: (bay, penalty) => `in ${bay} - wrong bay, -${penalty}`,
  offMatNoPoints: 'off the mat: no points',
  heldPutDown: (over, bay) => `the robot ${over ? 'still held' : 'is holding'} it - put it down in ${bay}`,
  liftedPutDown: (bay) => `not standing on the mat - put it down in ${bay}`,
  touchingRobot: (bay, over) => `in ${bay}, but touching the robot${over ? '' : ' - move away'}`,
  partlyInBay: (bay) => `only partly in ${bay} - the whole cube must be inside`,
  notInBay: 'not in a bay',
  notYetInBay: (bay) => `not yet - put it in ${bay}`,

  parkLabel: 'Park on a finish pad',
  parkedOn: (pad, over) => `the robot ${over ? 'touched' : 'touches'} the ${pad} pad`,
  noPadAtEnd: 'the robot did not touch a finish pad at the end',
  mustTouchPad: 'at the end the robot must touch a round pad (left or right)',
  cleanLabel: 'Clean run: no restart',
  noRestart: 'no restart',
  noRestartSoFar: 'no restart so far',
  restartUsed: 'a restart was used',
  restartsLabel: 'Restarts',
  noRestarts: 'no restarts',
  restartsDetail: (restarts, times, penalty) => `${restarts} restart${restarts === 1 ? '' : 's'} (${times.join(', ')}), -${penalty} each`,
  wrongLabel: 'Cubes in the wrong bay',
  noneWrong: 'none',
  wrongDetail: (cubes, penalty) => `${cubes.join(', ')}, -${penalty} each`,

  blueLabel: (w) => `Blue cube (${w})`,
  leftAlone: 'left alone',
  blueMovedDetail: (move, penalty) => `moved: ${move}, -${penalty}`,
  robotHolds: (over) => `the robot ${over ? 'still held' : 'is holding'} it`,
  pickedUpAt: (time) => `picked up at ${time}`,
  itIsOffMat: 'it is off the mat',
  fromItsPlace: (mm) => `${mm} mm from its place`,

  lastDeliveryLabel: 'Time of the last correct delivery',
  tieDetail: (delivered, time) => `for a tie: ${delivered} cube${delivered === 1 ? '' : 's'} in the right bay, the last one put there at ${time}`,
  startPositionLabel: 'Start inside the start zone',
  startPositionDetail: 'the robot did not start completely inside the start zone - a referee would not start this match',
};
