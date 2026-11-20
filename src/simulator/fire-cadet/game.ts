/**
 * MakeX Lebanon, Season 2027 - "Fire Cadet - Rescue City" (ages 4-7, the Makeblock mTiny): the game
 * and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?            -> createBodies()
 *   2. Which areas could be highlighted on the mat?             -> overlays()
 *   3. What has the robot earned so far, when, and why (not)?   -> createReferee()
 *   4. How is a program run?                                    -> Game.createVM (cards.ts)
 *
 * The referee follows the organiser's rules (txt/rules.txt) and answers (design 1, 6):
 *
 *   +5  each rescue item, at the first moment its whole base is inside its target square (A6): the
 *       Water in the square with the Fire, the Cat in the Safe Zone (D4), the Injured Person in the
 *       Hospital (A5), the Equipment back in the Fire Station at the bottom (D7, ORGANISER 1). The
 *       referee then takes it off the field and the points stay (rules l.162-167, N6).
 *   +5  the return bonus: when the match ends, the whole robot, sticks included, is inside D7 - and
 *       it was completely outside D7 before (A8).
 *   -1  each obstacle the ROBOT (its body or a stick) touched, once for each obstacle, so -3 at
 *       most (rules l.179-181, l.243-245; A7).
 *   The total is never below 0 (A9). Highest score: 4 x 5 + 5 = 25 (rules l.254).
 *
 * THE OBSTACLES (lead decision D1, which replaces A7's fixed blocks, N17 and N23 of the design).
 * The rules say "If an obstacle is moved, the referee returns it to its original position while
 * the match timer continues" (l.183), so real obstacles can be moved. Here an obstacle is a game
 * element standing on the middle of its square (OBSTACLE_BASE). As soon as ANYTHING touches it -
 * the robot, or an item the robot pushes against it - the referee lifts it off the field at once
 * (RefereeCall.removeBodies), and puts it back on its own spot, unturned, as soon as that spot is
 * free (RefereeCall.restoreBodies: nothing nearer to its base than RESTORE_CLEARANCE; the engine
 * checks, and the referee asks again at every tick until it is back). So the robot is never stuck
 * on an obstacle and never pushed off the squares by one: it goes on with its row, on the squares.
 * Only the robot's own touch costs a point; an item that touches an obstacle costs nothing. (An
 * obstacle that moved although nothing touches it was turned by the robot's sticks - the sticks
 * take along what stands between them, core/engine.ts - so it counts as the robot's touch.)
 *
 * The match lasts 120 s. Junior: it also ends when the whole row has run (the engine ends it when
 * the interpreter is idle and the robot stands still: 'program-ended'), and that time counts (A10).
 * Mini: at 120 s or at STOP. STOP is the student saying "STOP" (Simulation.declareFinished). There
 * are no restarts: the rules have none.
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 */
import { obbTouches, obbTouchesRect, rectContainsOBB, type OBB, type Rect } from '../core/geometry';
import type {
  Body,
  FinishReason,
  Game,
  ProgramJson,
  Referee,
  RefereeCall,
  ScoreContext,
  ScoreLine,
  ScoreReport,
  VM,
  ZoneOverlay,
} from '../core/types';
import type { RobotIO } from '../core/io';
import { createCardVM, createFireCadetVM, createPanelVM, isPanelProgram } from './cards';
import { MAT_IMAGE_URL, MAT_RECT, MAT_SENSOR_IMAGE_URL, MAT_VECTOR, PLACES, PLACE_NAMES, PLACE_WORDS, START_SQUARE, type PlaceName } from './field';
import { FIRE_CADET, spot, squareRect, type CardTimes } from './numbers';
import { MTINY_ROBOT, START_POSE, mtinyRobot } from './robot';
import {
  ITEM_NAMES,
  ITEM_WORDS,
  OBSTACLE_KINDS,
  OBSTACLE_WORDS,
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  scenarioProblems,
  targetPlace,
  targetSquare,
  type FireCadetScenario,
  type ItemName,
  type ObstacleKind,
} from './scenario';

// =============================================================================================
// The game elements
// =============================================================================================

/** The id of an item's body: 'item:water' ... */
export const itemId = (item: ItemName): string => `item:${item}`;
/** The id of an obstacle's body: 'obstacle:road-closed' ... */
export const obstacleId = (kind: ObstacleKind): string => `obstacle:${kind}`;
/** The kind of an item's body, for the stage's painters: 'cadet-water' ... */
export const itemBodyKind = (item: ItemName): string => `cadet-${item}`;
/** The kind of an obstacle's body: 'cadet-road-closed' ... */
export const obstacleBodyKind = (kind: ObstacleKind): string => `cadet-${kind}`;

/** The colour of each element when the stage draws it without its picture (design 8.3). */
const ITEM_FILL: Readonly<Record<ItemName, string>> = { water: '#2563eb', cat: '#f97316', person: '#db2777', equipment: '#0f766e' };
const OBSTACLE_FILL: Readonly<Record<ObstacleKind, string>> = {
  'road-closed': '#f8fafc',
  'fallen-tree': '#bbf7d0',
  'broken-vehicle': '#d1d5db',
};
const ITEM_LABEL: Readonly<Record<ItemName, string>> = { water: 'W', cat: 'C', person: 'P', equipment: 'E' };
const OBSTACLE_LABEL: Readonly<Record<ObstacleKind, string>> = { 'road-closed': 'RC', 'fallen-tree': 'FT', 'broken-vehicle': 'BV' };

function element(id: string, kind: string, label: string, fill: string, at: { x: number; y: number }, base: number, height: number): Body {
  return {
    id,
    kind,
    label,
    fill,
    x: at.x,
    y: at.y,
    angle: 0,
    w: base,
    l: base,
    h: height,
    z: 0,
    restingOn: null,
    held: false,
    // the sticks never close: nothing is gripped
    grippable: false,
    platform: false,
    mass: 1,
    home: { x: at.x, y: at.y, angle: 0, z: 0, restingOn: null },
  };
}

/** Every element in its place at the start: the four items, then the three obstacles, each on the spot of its square (N1). */
export function createBodies(s: FireCadetScenario): Body[] {
  const f = FIRE_CADET;
  return [
    ...ITEM_NAMES.map((item) => element(itemId(item), itemBodyKind(item), ITEM_LABEL[item], ITEM_FILL[item], spot(s[item]), f.ITEM_BASE, f.ITEM_HEIGHT)),
    ...OBSTACLE_KINDS.map((kind, k) =>
      element(obstacleId(kind), obstacleBodyKind(kind), OBSTACLE_LABEL[kind], OBSTACLE_FILL[kind], spot(s.obstacles[k]), f.OBSTACLE_BASE, f.OBSTACLE_HEIGHT),
    ),
  ];
}

/** The start square and the four targets (the screen of this game does not draw them: the mat shows them). */
export function overlays(s: FireCadetScenario): ZoneOverlay[] {
  const zones: ZoneOverlay[] = [{ id: 'start', label: 'Start', rect: squareRect(START_SQUARE), color: 'rgba(37, 99, 235, 0.25)', kind: 'start' }];
  for (const item of ITEM_NAMES) {
    if (item === 'equipment') continue; // (its target is the start square)
    zones.push({ id: `target-${item}`, label: ITEM_WORDS[item], rect: squareRect(targetSquare(s, item)), color: 'rgba(22, 163, 74, 0.25)', kind: 'delivery' });
  }
  return zones;
}

// =============================================================================================
// The referee's words (design 6.2 and 6.4, with lead decision D1 for the obstacles)
// =============================================================================================

const points = (n: number): string => `${n} ${n === 1 ? 'point' : 'points'}`;

/** Where an item belongs, at the end of a sentence. */
const BELONGS: Readonly<Record<ItemName, (fire: string) => string>> = {
  water: (fire) => `It belongs to the Fire at ${fire}.`,
  cat: () => `It belongs in ${PLACE_WORDS.safeZone}.`,
  person: () => `It belongs in ${PLACE_WORDS.hospital}.`,
  equipment: () => `It belongs in ${PLACE_WORDS.station} at the bottom.`,
};

/** Every sentence the referee says or writes on its sheet. ({fire} is "the School", "the Factory", "the House" or "the Bakery".) */
export const REFEREE_WORDS = {
  // ---- said (RefereeCall.say, and ScoreReport.now for MESSAGE_SECONDS)
  delivered: {
    water: `The Water reached the Fire. ${points(FIRE_CADET.POINTS_ITEM)}.`,
    cat: `The Cat is in ${PLACE_WORDS.safeZone}. ${points(FIRE_CADET.POINTS_ITEM)}.`,
    person: `The Injured Person is in ${PLACE_WORDS.hospital}. ${points(FIRE_CADET.POINTS_ITEM)}.`,
    equipment: `The Equipment is back in ${PLACE_WORDS.station}. ${points(FIRE_CADET.POINTS_ITEM)}.`,
  } as Readonly<Record<ItemName, string>>,
  /** the robot touched an obstacle for the first time (D1) */
  robotTouched: (kind: ObstacleKind): string => `The robot touched ${OBSTACLE_WORDS[kind]}: -${FIRE_CADET.POINTS_OBSTACLE}. The referee puts it back.`,
  /** the robot touched an obstacle it had touched before: no point more (D1) */
  robotTouchedAgain: (kind: ObstacleKind): string => `The robot touched ${OBSTACLE_WORDS[kind]} again. The referee puts it back.`,
  /** an item the robot pushes touched an obstacle (D1) */
  itemTouched: (item: ItemName, kind: ObstacleKind): string =>
    `The ${ITEM_WORDS[item]} touched ${OBSTACLE_WORDS[kind]}: no points lost. The referee puts it back.`,
  /** an item at rest in a marked place that is not its own (N24); also the line's detail */
  wrongPlace: (item: ItemName, place: PlaceName, fire: string): string => `The ${ITEM_WORDS[item]} is in ${PLACE_WORDS[place]}. ${BELONGS[item](fire)}`,
  leftMap: 'The robot left the map.',

  // ---- the score sheet: labels
  label: {
    water: 'Water to the Fire',
    cat: 'Cat to the Safe Zone',
    person: 'Injured Person to the Hospital',
    equipment: 'Equipment to the Fire Station',
    return: 'Robot back in the Fire Station',
    obstacles: 'Obstacles touched',
  },
  // ---- the score sheet: the detail of an item line
  reached: {
    water: (fire: string): string => `The Water reached the Fire at ${fire}.`,
    cat: (): string => `The Cat reached ${PLACE_WORDS.safeZone}.`,
    person: (): string => `The Injured Person reached ${PLACE_WORDS.hospital}.`,
    equipment: (): string => `The Equipment is back in ${PLACE_WORDS.station}.`,
  } as Readonly<Record<ItemName, (fire: string) => string>>,
  push: {
    water: (fire: string): string => `Push the Water into the square with the Fire: ${fire}.`,
    cat: (): string => `Push the Cat into ${PLACE_WORDS.safeZone}.`,
    person: (): string => `Push the Injured Person into ${PLACE_WORDS.hospital}.`,
    equipment: (): string => `Push the Equipment into ${PLACE_WORDS.station} at the bottom.`,
  } as Readonly<Record<ItemName, (fire: string) => string>>,
  offMap: (item: ItemName, fire: string): string => `The ${ITEM_WORDS[item]} is off the map. ${BELONGS[item](fire)}`,
  // ---- the score sheet: the return bonus
  home: 'The whole robot is inside the Fire Station.',
  neverLeft: 'The robot has not left the Fire Station yet. Here the bonus needs it to leave first.',
  partlyHome: 'A part of the robot is outside the Fire Station.',
  notHome: 'The robot is not in the Fire Station.',
  // ---- the score sheet: the obstacles
  noObstacle: 'No obstacle touched.',
  touched: (kinds: readonly ObstacleKind[]): string => {
    const names = kinds.map((kind) => OBSTACLE_WORDS[kind]);
    const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `Touched: ${list}.`;
  },
};

// =============================================================================================
// The referee
// =============================================================================================

/** The score sheet of this game: a ScoreReport that also names the obstacles the robot touched (for the screen's score strip). */
export interface FireCadetScoreReport extends ScoreReport {
  /** the obstacles the robot touched, in the order of OBSTACLE_KINDS */
  obstaclesTouched: ObstacleKind[];
}

/** The obstacles the robot touched, read from any score report of this game ([] for another report). */
export function obstaclesTouched(report: ScoreReport): ObstacleKind[] {
  const list = (report as Partial<FireCadetScoreReport>).obstaclesTouched;
  return Array.isArray(list) ? list.filter((kind): kind is ObstacleKind => (OBSTACLE_KINDS as readonly string[]).includes(kind)) : [];
}

const boxOf = (b: Body): OBB => ({ x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle });
const START_RECT: Rect = squareRect(START_SQUARE);
const KIND_OF_OBSTACLE: ReadonlyMap<string, ObstacleKind> = new Map(OBSTACLE_KINDS.map((kind) => [obstacleId(kind), kind]));

/** The marked place, other than the item's own target, that holds the item's whole base - or null. */
function wrongPlaceOf(s: FireCadetScenario, item: ItemName, b: Body): PlaceName | null {
  const own = targetPlace(s, item);
  for (const place of PLACE_NAMES) {
    if (place === own) continue;
    if (rectContainsOBB(squareRect(PLACES[place]), boxOf(b))) return place;
  }
  return null;
}

/** Is a part of the element's base off the mat? (Then it is in no target: N10.) */
const offTheMat = (b: Body): boolean => !rectContainsOBB(MAT_RECT, boxOf(b));

/** The referee of one match (a referee with memory: core/types.ts, Referee). */
export function createReferee(s: FireCadetScenario): Referee<FireCadetScenario> {
  const fire = PLACE_WORDS[s.fire];
  /** the time each item was delivered */
  const delivered: Partial<Record<ItemName, number>> = {};
  /** the obstacles the robot touched (-1 each, once) */
  const touched = new Set<ObstacleKind>();
  /** the obstacles the referee has lifted and not yet put back */
  const lifted = new Set<ObstacleKind>();
  /** when the referee last said something about each obstacle */
  const saidAbout = new Map<ObstacleKind, number>();
  /** where each item was at the tick before, and the two wheel angles then */
  const before = new Map<string, { x: number; y: number; angle: number }>();
  let wheelsBefore: [number, number] | null = null;
  /** N24: the marked place each item is at rest in now (kept while it stays there unmoved) */
  const restingIn: Partial<Record<ItemName, PlaceName>> = {};
  /** N24: "item:place" already said, once each */
  const saidWrong = new Set<string>();
  let leftStation = false;
  let saidOffMap = false;
  /** the newest sentence and when it was said (ScoreReport.now shows it for MESSAGE_SECONDS) */
  let message: { text: string; time: number } | null = null;
  // the end of the match
  let over = false;
  let endTime = 0;
  let homeAtEnd = false;
  const wrongAtEnd: Partial<Record<ItemName, PlaceName>> = {};
  const offAtEnd: Partial<Record<ItemName, boolean>> = {};

  const allInside = (ctx: ScoreContext<FireCadetScenario>): boolean => ctx.robotShapes.every((shape) => rectContainsOBB(START_RECT, shape));
  const bodyOf = (ctx: ScoreContext<FireCadetScenario>, id: string): Body | undefined => ctx.world.bodies.find((b) => b.id === id);
  const moved = (b: Body): boolean => b.x !== b.home.x || b.y !== b.home.y || b.angle !== b.home.angle;

  const itemLine = (ctx: ScoreContext<FireCadetScenario>, item: ItemName): ScoreLine => {
    const time = delivered[item];
    const label = REFEREE_WORDS.label[item];
    if (time !== undefined) {
      return { id: item, label, points: FIRE_CADET.POINTS_ITEM, max: FIRE_CADET.POINTS_ITEM, ok: true, detail: REFEREE_WORDS.reached[item](fire), time };
    }
    const b = bodyOf(ctx, itemId(item));
    let detail = REFEREE_WORDS.push[item](fire);
    const off = over ? offAtEnd[item] === true : b !== undefined && offTheMat(b);
    const wrong = over ? wrongAtEnd[item] : restingIn[item];
    if (off) detail = REFEREE_WORDS.offMap(item, fire);
    else if (wrong !== undefined) detail = REFEREE_WORDS.wrongPlace(item, wrong, fire);
    return { id: item, label, points: 0, max: FIRE_CADET.POINTS_ITEM, ok: false, detail };
  };

  const returnLine = (ctx: ScoreContext<FireCadetScenario>): ScoreLine => {
    const label = REFEREE_WORDS.label.return;
    const earned = over ? homeAtEnd : leftStation && allInside(ctx);
    if (earned) return { id: 'return', label, points: FIRE_CADET.POINTS_RETURN, max: FIRE_CADET.POINTS_RETURN, ok: true, detail: REFEREE_WORDS.home };
    let detail: string = REFEREE_WORDS.notHome;
    if (!leftStation) detail = REFEREE_WORDS.neverLeft;
    else if (ctx.robotShapes.some((shape) => obbTouchesRect(shape, START_RECT))) detail = REFEREE_WORDS.partlyHome;
    return { id: 'return', label, points: 0, max: FIRE_CADET.POINTS_RETURN, ok: false, detail };
  };

  const obstacleLine = (): ScoreLine => {
    const kinds = OBSTACLE_KINDS.filter((kind) => touched.has(kind));
    return {
      id: 'obstacles',
      label: REFEREE_WORDS.label.obstacles,
      points: kinds.length === 0 ? 0 : -FIRE_CADET.POINTS_OBSTACLE * kinds.length,
      max: 0,
      ok: kinds.length === 0,
      detail: kinds.length === 0 ? REFEREE_WORDS.noObstacle : REFEREE_WORDS.touched(kinds),
    };
  };

  return {
    begin(ctx) {
      wheelsBefore = [ctx.world.robot.left.angleDeg, ctx.world.robot.right.angleDeg];
    },

    observe(ctx): RefereeCall | null {
      const w = ctx.world;
      const call: RefereeCall = {};
      const say = (text: string): void => {
        (call.say ??= []).push(text);
        message = { text, time: w.time };
      };
      const remove = (id: string): void => {
        (call.removeBodies ??= []).push(id);
      };
      const wheels: [number, number] = [w.robot.left.angleDeg, w.robot.right.angleDeg];
      const wheelsStill = wheelsBefore !== null && wheels[0] === wheelsBefore[0] && wheels[1] === wheelsBefore[1];

      // 1. Deliveries: the item's whole base inside its target, at the first moment (A6). It
      //    leaves the field from the next tick on (N6); its points stay.
      for (const item of ITEM_NAMES) {
        if (delivered[item] !== undefined) continue;
        const b = bodyOf(ctx, itemId(item));
        if (b === undefined) continue;
        if (rectContainsOBB(squareRect(targetSquare(s, item)), boxOf(b))) {
          delivered[item] = w.time;
          delete restingIn[item];
          remove(b.id);
          say(REFEREE_WORDS.delivered[item]);
        }
      }

      // 2. A wrong place (N24): only an item that has moved since the start and is at rest - in
      //    this tick neither wheel turned and the item did not move - completely inside a marked
      //    place that is not its own. Said once for each item and place. No points, no penalty.
      for (const item of ITEM_NAMES) {
        if (delivered[item] !== undefined) continue;
        const b = bodyOf(ctx, itemId(item));
        if (b === undefined) continue;
        const prev = before.get(b.id) ?? b.home;
        const still = prev.x === b.x && prev.y === b.y && prev.angle === b.angle;
        if (!still) delete restingIn[item];
        if (!still || !wheelsStill || !moved(b)) continue;
        const place = wrongPlaceOf(s, item, b);
        if (place === null) continue;
        restingIn[item] = place;
        const key = `${item}:${place}`;
        if (!saidWrong.has(key)) {
          saidWrong.add(key);
          say(REFEREE_WORDS.wrongPlace(item, place, fire));
        }
      }

      // 3. The obstacles (D1). One that is back on the field is no longer lifted. One that anything
      //    touches - or that has moved - is lifted at once; the robot's own touch costs a point,
      //    once for each obstacle. Every lifted obstacle is asked back at every tick: the engine
      //    puts it on its spot as soon as nothing is nearer to it than RESTORE_CLEARANCE.
      for (const kind of [...lifted]) if (bodyOf(ctx, obstacleId(kind)) !== undefined) lifted.delete(kind);
      for (const b of w.bodies) {
        const kind = KIND_OF_OBSTACLE.get(b.id);
        if (kind === undefined) continue;
        const box = boxOf(b);
        const byRobot = ctx.robotShapes.some((shape) => obbTouches(box, shape, FIRE_CADET.TOUCH_MM));
        const byItem = ITEM_NAMES.find((item) => {
          const other = bodyOf(ctx, itemId(item));
          return other !== undefined && obbTouches(box, boxOf(other), FIRE_CADET.TOUCH_MM);
        });
        // (moved with nothing touching it: the sticks turned it along - the robot moved it)
        const robotsDoing = byRobot || (byItem === undefined && moved(b));
        if (!robotsDoing && byItem === undefined) continue;
        if (robotsDoing && !touched.has(kind)) {
          touched.add(kind);
          say(REFEREE_WORDS.robotTouched(kind));
          saidAbout.set(kind, w.time);
        } else if (w.time - (saidAbout.get(kind) ?? -Infinity) >= FIRE_CADET.MESSAGE_SECONDS - 1e-9) {
          // (a touch that costs nothing is said again only after the last sentence about this
          // obstacle has had its time in the banner: an obstacle that the sticks turn along is
          // lifted and put back at every small step of a turn)
          say(robotsDoing ? REFEREE_WORDS.robotTouchedAgain(kind) : REFEREE_WORDS.itemTouched(byItem as ItemName, kind));
          saidAbout.set(kind, w.time);
        }
        lifted.add(kind);
        remove(b.id);
      }
      if (lifted.size > 0) call.restoreBodies = OBSTACLE_KINDS.filter((kind) => lifted.has(kind)).map(obstacleId);

      // 4. Has the robot left the Fire Station? (A8: needed for the return bonus.)
      if (!leftStation && ctx.robotShapes.every((shape) => !obbTouchesRect(shape, START_RECT))) leftStation = true;

      // 5. Off the map (N10): said once; it costs nothing.
      const pose = w.robot.pose;
      if (!saidOffMap && (pose.x < 0 || pose.x > FIRE_CADET.MAT || pose.y < 0 || pose.y > FIRE_CADET.MAT)) {
        saidOffMap = true;
        say(REFEREE_WORDS.leftMap);
      }

      // remember this tick for the next one
      wheelsBefore = wheels;
      before.clear();
      for (const b of w.bodies) before.set(b.id, { x: b.x, y: b.y, angle: b.angle });

      return call.say || call.removeBodies || call.restoreBodies ? call : null;
    },

    restart() {
      // (no restarts in this game: Game.restartRules)
    },

    finished(ctx, _reason: FinishReason) {
      over = true;
      endTime = ctx.world.time;
      homeAtEnd = leftStation && allInside(ctx);
      // the last look at the items: everything stops now, so "at rest" no longer matters
      for (const item of ITEM_NAMES) {
        if (delivered[item] !== undefined) continue;
        const b = bodyOf(ctx, itemId(item));
        if (b === undefined) continue;
        offAtEnd[item] = offTheMat(b);
        const place = moved(b) ? wrongPlaceOf(s, item, b) : null;
        if (place !== null) wrongAtEnd[item] = place;
      }
    },

    score(ctx): FireCadetScoreReport {
      const lines: ScoreLine[] = [...ITEM_NAMES.map((item) => itemLine(ctx, item)), returnLine(ctx), obstacleLine()];
      const sum = lines.reduce((total, line) => total + line.points, 0);
      const report: FireCadetScoreReport = {
        total: Math.max(0, sum),
        max: FIRE_CADET.MAX_POINTS,
        lines,
        complete: lines.every((line) => line.id === 'obstacles' || line.ok),
        obstaclesTouched: OBSTACLE_KINDS.filter((kind) => touched.has(kind)),
      };
      if (over) report.time = endTime;
      else if (message !== null && ctx.world.time - message.time < FIRE_CADET.MESSAGE_SECONDS - 1e-9) report.now = message.text;
      return report;
    },
  };
}

// =============================================================================================
// The game
// =============================================================================================

/**
 * The game with another set of card times: its robot's top speed and its interpreters follow
 * them (for tests that check that a tuned time never breaks the counting, design 12.4).
 */
export function fireCadetGameWith(times: CardTimes): Game<FireCadetScenario> {
  return {
    ...fireCadetGame,
    robotConfig: mtinyRobot(times),
    createVM: (program: ProgramJson, io: RobotIO): VM => (isPanelProgram(program) ? createPanelVM(program, io, times) : createCardVM(program, io, times)),
  };
}

export const fireCadetGame: Game<FireCadetScenario> = {
  id: 'fire-cadet',
  title: 'MakeX Lebanon 2027 - Fire Cadet: Rescue City',
  mat: {
    width: FIRE_CADET.MAT,
    height: FIRE_CADET.MAT,
    imageUrl: MAT_IMAGE_URL,
    sensorImageUrl: MAT_SENSOR_IMAGE_URL,
    vector: MAT_VECTOR,
  },
  matchDuration: FIRE_CADET.MATCH_SECONDS,
  // the robot starts fully inside the Fire Station at the bottom (rules l.48-49, l.118)
  startZone: START_RECT,
  defaultStartPose: START_POSE,
  // (no restarts in this game: restartRules below)
  restartPenalty: 0,
  defaultScenario,
  randomScenario,
  scenarioCount: () => SCENARIO_COUNT,
  encodeScenario,
  decodeScenario,
  describeScenario,
  createBodies,
  overlays,
  // (during a match the referee keeps the score; this is the sheet of a match in which nothing has happened yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: MTINY_ROBOT,
  createReferee,
  // the rules have no restart
  restartRules: { maxRestarts: 0 },
  scenarioProblems,
  // a row of cards (Junior) or the direction panel (Mini): cards.ts
  createVM: createFireCadetVM,
};
