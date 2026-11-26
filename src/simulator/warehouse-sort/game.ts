/**
 * MakeX Lebanon - Inspire (beginner), mission "Warehouse Sort": the game and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?           -> createBodies()
 *   2. Which areas should be highlighted on the mat?           -> overlays()
 *   3. What has the robot earned so far, when, and why (not)?  -> createReferee()
 *
 * The referee follows the rules (§5 - §8, "Beginner - Warehouse Sort (MakeX Lebanon, Local)"),
 * with one change the owner of the site decided: one of the four cubes is BLUE, and the robot
 * must leave it where it is ("Blue shouldn't be touched: the robot checks it; if it is blue, it
 * leaves it" - ./scenario.ts). The three other cubes are red or green and are sorted as the
 * rules say:
 *
 *   +5   Leave the start zone: the first moment a part of the robot is outside it (kept)
 *   +5   each red or green cube picked: held by the gripper and lifted at least 1 cm, or
 *        carried (once per cube)
 *   +15  each red or green cube in the bay of its own colour at the end: completely inside,
 *        standing on the mat, not held, not touching the robot
 *   -5   each red or green cube in the bay of the other colour at the end (same conditions), "and
 *        no points for that cube": no +15, and no +5 for picking it either (Q10)
 *   -5   the blue cube is not where it was put (ASSUMPTION, Q15): it was picked up or lifted at
 *        any time, the robot holds it at the end, or at the end it is more than 5 mm from its
 *        place. Once, whatever happened to it. It never scores anything.
 *   +10  Finish park: at the end the robot touches one of the two round finish pads
 *   +5   Clean run: no restart
 *   -10  each restart: the robot goes back to the start zone, the clock runs on
 *   The total is never below 0. Highest score: 5 + 3 x 5 + 3 x 15 + 10 + 5 = 80.
 *
 * A match lasts 90 s. It ends then, when the program has ended and the robot stands still, or
 * when the team says "Finished"; then the field is judged as it lies (like Fire Rescue).
 *
 * The "picked" points and the time of a cube's delivery depend on what happened during the
 * match, so this referee has a memory and looks at every tick (core/types.ts: Referee).
 *
 * The same referee speaks French on the page of Robot en fête 2027 (../robot-en-fete/game.ts):
 * every sentence and name it says is in ./referee-words.ts, and createWarehouseSortGame() below
 * makes the game from a set of those words, its own id and title, and its way of writing codes.
 * The English game, warehouseSortGame, is made by the same function with the English words.
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 *
 * =====================================================================================
 *  WHERE THE RULES ARE OPEN, CONTRADICT THEMSELVES OR DIFFER FROM THE MAT
 * =====================================================================================
 * What the simulator does, and the constant or function behind it. Each one is a question for
 * the organiser. The README's list "Questions for the organiser" (section "The Warehouse Sort
 * simulator") has the same questions with the same numbers: change both together.
 *
 *   (The field is turned 90 degrees to the right - the owner's decision, ./field.ts: what the
 *   rules call "on the right", "upper middle", "top" is at the bottom, right of the middle and on
 *   the right here.)
 *   Q1. §2 calls the start zone "a large green area on the right". The mat has a yellow-framed
 *       area with a blue picture there. The simulator uses that area, and counts the yellow
 *       frame in (as Fire Rescue counts its outlines).                    START_ZONE (./field.ts)
 *   Q2. §2 calls the finish pads "yellow circles with checkerboards". The mat has two round
 *       pictures without a checkerboard at the top and the bottom of the print file (left and
 *       right on the turned field). The simulator uses those.            FINISH_PADS (./field.ts)
 *   Q3. The finish park: §5 "park touching the circle", §8 "projection entirely inside one
 *       circle". The pads are 160 x 157 mm; the mBot2 with its gripper is 237 x 130 mm, so it
 *       can never be entirely inside one. The simulator scores "touching".           parkedOn()
 *   Q4. §6 "Example max = 85", but its own line items add up to 5 + 20 + 60 + 10 + 5 = 100 for
 *       four cubes. With the blue cube (Q15) three cubes are sorted, and the line items give
 *       5 + 15 + 45 + 10 + 5 = 80. The simulator uses the line items.             MAX_SCORE
 *   Q5. The clean run bonus (+5, "no human touch after GO"): taken as written, a robot that
 *       never moves earns it. The simulator gives it whenever no restart was used.  POINTS_CLEAN
 *   Q6. The rules give no size or weight for the cubes: 40 mm, light.
 *                                                          CUBE_SIZE, CUBE_MASS (./field.ts)
 *   Q7. "Clear lift >= 1 cm or visibly carried": the simulator counts a cube as picked when the
 *       gripper holds it and its base is at least 10 mm above the mat, or the gripper has
 *       moved it 40 mm (one cube) while holding it.                     LIFT_MM, CARRY_MM
 *   Q8. Restart ("human touch"): the robot goes back to its start position; a cube the gripper
 *       holds goes back onto the orange square of its own warehouse (if that is taken: on the
 *       mat as close to it as possible); every other cube stays where it is. Points already
 *       earned stay. No limit on restarts (the rules set none).      core/engine.ts restart()
 *   Q9. "Cube off the mat: may be left there (no score) or the referee returns it to its
 *       warehouse with -5." The simulator never returns a cube: it stays off the mat and gets
 *       no points at all - also not the 5 for picking it up ("no score"). A cube the gripper
 *       still holds is not off the mat: it is held.                  isLyingOffMat(), judgeCube()
 *   Q10. "Wrong-color delivery: -5 (and no points for that cube)". The simulator takes the -5
 *       only for a cube completely inside the bay of the other colour, on the mat, not touching
 *       the robot (the conditions of a delivery); a cube only partly inside costs nothing. And
 *       "no points for that cube" as written: that cube also loses its 5 for picking it up -
 *       read the same way as "no score" in Q9.                          judgeCube(), score()
 *   Q11. Leaving the start zone: the zone runs to the edge of the mat (the bottom edge on the
 *       turned field), so a robot that backs over that edge onto the table has also left it, and
 *       gets the 5 points without driving into the field.                isOutsideStartZone()
 *   Q12. The rules have no walls ("teams may navigate freely as long as they stay on the mat").
 *       Leaving the mat costs nothing here; a table 100 mm wide around the mat stops the robot
 *       and the cubes.                                                  TABLE_STRIP (./field.ts)
 *   Q13. The total is never below 0 (as in Fire Rescue; the rules do not say).        score()
 *   Q14. Tie-breaker 3, "faster time of last correct delivery": the simulator shows the latest
 *       moment at which a cube that counts at the end was put down in its bay. LINE_LAST_DELIVERY
 *   Q15. The blue cube is the owner's addition: the rules have no blue cube, so they do not say
 *       what touching or moving it costs. The simulator: -5, once, when at the end the blue cube
 *       is not where it was put - it was picked up or lifted at any time (also when a restart
 *       put it back), the robot holds it, or it is more than 5 mm from its place (the largest
 *       distance of one of its corners, as Fire Chief measures its target). A touch that does
 *       not move it costs nothing. It counts once, wherever the cube ends (a bay, off the mat):
 *       no "wrong bay" for it. A match in which it was moved is not "complete" (every goal),
 *       though its line has no points. At a restart a cube in the claw goes back to its square
 *       (engine): a blue cube that was only dragged there (less than CARRY_MM, never lifted) is
 *       then left alone again, and the referee says "back in its place". If another cube stands
 *       on its square, the engine puts it as close as there is room, and it is still judged
 *       from its square: more than 5 mm away is moved. (Judge it from where the restart put it
 *       instead? Part of the question.)          BLUE_PENALTY, BLUE_MOVED_MM, blueMove(), score()
 *
 * Not simulated: field damage (-20), the operator rules, the referee returning a cube (-5),
 * "the robot looks safe", "onboard battery only". The robot is the simulator's mBot2 (it fits
 * the start zone). The CyberPi buttons work during a match, so a program that reads them can be
 * steered by hand - the rules say "runs autonomously". Cubes cannot stand on each other: the
 * engine slides a cube that is put down on another cube off it (as with Fire Rescue's buckets).
 */
import { obbCorners, obbTouches, obbTouchesRect, pointInRect, rectCenter, rectContainsOBB, type OBB, type Rect } from '../core/geometry';
import type {
  Body,
  Game,
  Referee,
  RefereeCall,
  ScoreContext,
  ScoreLine,
  ScoreReport,
  ZoneOverlay,
} from '../core/types';
import {
  BAYS,
  BAY_COLORS,
  CUBE_HEIGHT,
  CUBE_MASS,
  CUBE_SIZE,
  FINISH_PADS,
  MAT_IMAGE_URL,
  MAT_RECT,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  PAD_IDS,
  START_ZONE,
  WAREHOUSES,
  WAREHOUSE_IDS,
  type BayColor,
  type Ellipse,
  type PadId,
  type WarehouseId,
} from './field';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from './robot';
import { EN_REFEREE_WORDS, clock, type RefereeWords } from './referee-words';
import {
  EN_CODEC,
  EN_SCENARIO_WORDS,
  LEAVE_ALONE_COLOR,
  SCENARIO_COUNT,
  blueWarehouse,
  defaultScenario,
  randomScenario,
  scenarioText,
  sortedWarehouses,
  type CubeColor,
  type ScenarioCodec,
  type ScenarioText,
  type WarehouseSortScenario,
} from './scenario';

// =============================================================================================
// Points and limits (rules §5 - §7)
// =============================================================================================

export const POINTS_LEAVE_START = 5;
export const POINTS_PICK = 5;
export const POINTS_DELIVER = 15;
/** Points removed for each cube in the bay of the other colour. */
export const WRONG_BAY_PENALTY = 5;
export const POINTS_PARK = 10;
export const POINTS_CLEAN = 5;
/** Points removed for each restart ("human touch after GO"). */
export const RESTART_PENALTY = 10;
/** Four warehouses, one cube on each. */
export const CUBE_COUNT = WAREHOUSE_IDS.length;
/** Three of the four cubes are red or green and go to a bay; the fourth is blue and stays where it is. */
export const CUBES_TO_SORT = CUBE_COUNT - 1;
/**
 * ASSUMPTION (Q15): points removed when the blue cube is not where it was put at the end. The
 * rules have no blue cube; the owner of the site added it ("the robot checks it; if it is blue,
 * it leaves it"), and nobody has said yet what moving it costs.
 */
export const BLUE_PENALTY = 5;
/**
 * ASSUMPTION (Q15): the blue cube counts as moved when one of its corners is more than this (mm)
 * away from where it stood (a touch that moves it by a millimetre does not count - the same
 * number and the same measure as Fire Chief's fire target).
 */
export const BLUE_MOVED_MM = 5;
/** 5 + 3 x 5 + 3 x 15 + 10 + 5 = 80 (the rules' own line items for the three cubes that are sorted; their "example max = 85" does not add up). */
export const MAX_SCORE = POINTS_LEAVE_START + CUBES_TO_SORT * (POINTS_PICK + POINTS_DELIVER) + POINTS_PARK + POINTS_CLEAN;
/** A match lasts 90 seconds. */
export const MATCH_DURATION = 90;

/** Rules §6: a cube is picked when it is lifted clearly - at least 1 cm (its base this high above the mat, mm) ... */
export const LIFT_MM = 10;
/** ... or "visibly carried": ASSUMPTION - the gripper has moved it this far (mm, one cube) while holding it. */
export const CARRY_MM = CUBE_SIZE;
/** Two things closer than this (mm) touch (as in Fire Rescue). */
export const TOUCH_MM = 0.5;
/** A cube whose base is at most this high (mm) stands on the mat (as in Fire Rescue). */
const ON_MAT_MM = 0.5;

// =============================================================================================
// The cubes
// =============================================================================================

export const KIND_CUBE = 'cube';

/** Body id of the cube that starts in a warehouse: 'cube:W1' ... */
export const cubeBodyId = (warehouse: WarehouseId): string => `cube:${warehouse}`;

/**
 * The cubes are drawn in the colours of the Fire Rescue buckets - the blue one too: the clear
 * blue printed on the MakeX mats (0, 174, 239), which the simulator's colour naming reads as
 * "blue" (core/engine-sensors.ts classifyColor). (The colour sensor at the claw names a cube by
 * its colorName, so it reads "blue" for the blue cube exactly where it reads "red" or "green"
 * for the others.)
 */
export const CUBE_FILL: Record<CubeColor, string> = { red: '#ef4044', green: '#40ad49', blue: '#00aeef' };
/**
 * Letter drawn on a cube, so the colour can also be read without seeing colours: the letter of
 * the codes (./scenario.ts EN_LETTERS; a game made with other codes draws its own letters).
 */
export const CUBE_LETTER: Record<CubeColor, string> = EN_CODEC.letters as Record<CubeColor, string>;

/** Where the cube of a warehouse stands at the start: the middle of its orange square. */
export function cubeHome(warehouse: WarehouseId): { x: number; y: number } {
  return rectCenter(WAREHOUSES[warehouse].square);
}

function createBodies(s: WarehouseSortScenario, letters: Readonly<Record<CubeColor, string>>): Body[] {
  return WAREHOUSE_IDS.map((warehouse) => {
    const color = s.cubes[warehouse];
    const { x, y } = cubeHome(warehouse);
    return {
      id: cubeBodyId(warehouse),
      kind: KIND_CUBE,
      label: letters[color] ?? '?',
      fill: CUBE_FILL[color] ?? '#888888',
      colorName: color,
      x,
      y,
      angle: 0,
      w: CUBE_SIZE,
      l: CUBE_SIZE,
      h: CUBE_HEIGHT,
      z: 0,
      restingOn: null,
      held: false,
      grippable: true,
      platform: false,
      mass: CUBE_MASS,
      home: { x, y, angle: 0, z: 0, restingOn: null },
    };
  });
}

// =============================================================================================
// Areas the screen can highlight
// =============================================================================================

const START_CSS = '#facc15';
const WAREHOUSE_CSS = '#f59e0b';
const BAY_CSS: Record<BayColor, string> = { red: '#dc2626', green: '#16a34a' };
const PAD_CSS = '#38bdf8';

/** The square around an ellipse. */
export function ellipseBox(e: Ellipse): Rect {
  return { x: e.cx - e.rx, y: e.cy - e.ry, w: 2 * e.rx, h: 2 * e.ry };
}

function overlays(s: WarehouseSortScenario, words: RefereeWords): ZoneOverlay[] {
  const out: ZoneOverlay[] = [{ id: 'start', label: words.startZone, rect: START_ZONE, color: START_CSS, kind: 'start' }];
  for (const w of WAREHOUSE_IDS) {
    const color = s.cubes[w];
    out.push({ id: `warehouse:${w}`, label: words.warehouseZone(w, color), rect: WAREHOUSES[w].frame, color: WAREHOUSE_CSS, kind: 'pickup' });
  }
  for (const color of BAY_COLORS) {
    out.push({ id: `bay:${color}`, label: words.bayZone(color), rect: BAYS[color], color: BAY_CSS[color], kind: 'delivery' });
  }
  for (const pad of PAD_IDS) {
    // (the round pad itself; its rect is the box around it)
    out.push({ id: `pad:${pad}`, label: words.finishPad, rect: ellipseBox(FINISH_PADS[pad]), color: PAD_CSS, kind: 'info', shape: 'ellipse' });
  }
  return out;
}

// =============================================================================================
// What the referee looks at
// =============================================================================================

/** Footprint of a body on the mat, seen from above. */
export function footprint(body: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle'>): OBB {
  return { x: body.x, y: body.y, w: body.w, l: body.l, angle: body.angle };
}

/** True while a part of the robot is outside the start zone. */
export function isOutsideStartZone(robotShapes: readonly OBB[]): boolean {
  return robotShapes.some((shape) => !rectContainsOBB(START_ZONE, shape));
}

/** Rules §7: a cube is "off the mat" when no part of it is on the mat any more (seen from above). */
export function isOffMat(cube: Body): boolean {
  // (almost always the cube is well inside the mat: no need to look at its corners then)
  const reach = Math.hypot(cube.w, cube.l) / 2;
  if (cube.x >= reach && cube.y >= reach && cube.x <= MAT_SIZE - reach && cube.y <= MAT_SIZE - reach) return false;
  return !obbTouchesRect(footprint(cube), MAT_RECT);
}

/**
 * Does a box touch (or overlap) an ellipse? The ellipse is squeezed into a circle - the box
 * becomes a parallelogram - and the circle then touches it when its middle is inside, or no
 * further from an edge than its radius.
 */
export function obbTouchesEllipse(box: OBB, e: Ellipse): boolean {
  const k = e.rx / e.ry;
  const corners = obbCorners(box).map((c) => ({ x: c.x - e.cx, y: (c.y - e.cy) * k }));
  // the middle of the circle (0, 0) inside the parallelogram: on the same side of every edge
  let sign = 0;
  let inside = true;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const side = (b.x - a.x) * (0 - a.y) - (b.y - a.y) * (0 - a.x);
    if (side === 0) continue;
    if (sign === 0) sign = Math.sign(side);
    else if (Math.sign(side) !== sign) inside = false;
  }
  if (inside) return true;
  const r2 = e.rx * e.rx;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    if (px * px + py * py <= r2 + 1e-9) return true;
  }
  return false;
}

/** Rules §5: the finish pad the robot touches (the left one first), or null. */
export function parkedOn(robotShapes: readonly OBB[]): PadId | null {
  return PAD_IDS.find((pad) => robotShapes.some((shape) => obbTouchesEllipse(shape, FINISH_PADS[pad]))) ?? null;
}

/** The bay (if any) that a footprint lies completely inside. */
export function bayAround(fp: OBB): BayColor | null {
  // (a footprint that is completely inside a bay has its middle inside it: most of the time
  // there is nothing more to look at)
  return BAY_COLORS.find((color) => pointInRect(fp, BAYS[color]) && rectContainsOBB(BAYS[color], fp)) ?? null;
}

/** The bay (if any) that a footprint lies partly inside. */
function bayTouched(fp: OBB): BayColor | null {
  return BAY_COLORS.find((color) => obbTouchesRect(fp, BAYS[color])) ?? null;
}

/** The cube is held by the gripper. */
const isHeld = (cube: Body, holding: string | null): boolean => cube.held || holding === cube.id;

/**
 * The cube lies off the mat (Q9). A cube the gripper holds out over the table is not: it is
 * held, and it is judged as held - the rules' "cube off the mat ... may be left there" is about
 * a cube that lies there.
 */
export function isLyingOffMat(cube: Body, holding: string | null): boolean {
  return !isHeld(cube, holding) && isOffMat(cube);
}

/**
 * The cube touches the robot (rules §8: "not in contact with the robot"): a part of the robot is
 * closer than TOUCH_MM to it, seen from above AND in height. The chassis reaches from the mat up
 * to its height; each finger from the underside of the claw up by the height of a finger. So a
 * raised claw above a cube does not touch it. (ScoreContext.robotShapes: the chassis first,
 * then the two fingers - core/robot.ts robotShapesAt.)
 */
export function touchesRobot(cube: Body, ctx: ScoreContext<WarehouseSortScenario>): boolean {
  const config = ctx.robotConfig;
  const claw = ctx.world.robot.gripper.height;
  const fp = footprint(cube);
  return ctx.robotShapes.some((shape, i) => {
    const finger = i > 0 && config.gripper.enabled;
    const bottom = finger ? claw : 0;
    const top = finger ? claw + config.gripper.fingerHeight : config.chassisHeight;
    const heightsMeet = bottom < cube.z + cube.h + TOUCH_MM && cube.z < top + TOUCH_MM;
    return heightsMeet && obbTouches(fp, shape, TOUCH_MM);
  });
}

/** The cube stands on the mat: not held, not lifted, not on anything. */
const standsOnMat = (cube: Body, holding: string | null): boolean =>
  !isHeld(cube, holding) && cube.restingOn === null && cube.z <= ON_MAT_MM;

/**
 * Rules §8: where a cube is at the end, and what that is worth:
 *   'own'      completely inside the bay of its colour, on the mat, not touching the robot: +15
 *   'wrong'    the same in the bay of the other colour: -5
 *   'none'     anything else (the reason is in `why`)
 */
interface Delivery {
  result: 'own' | 'wrong' | 'none';
  /** the bay it is in or touches */
  bay: BayColor | null;
  why: 'held' | 'off-mat' | 'lifted' | 'touching' | 'partly' | 'no-bay' | null;
}

function judgeCube(cube: Body, ctx: ScoreContext<WarehouseSortScenario>): Delivery {
  const holding = ctx.world.robot.gripper.holding;
  const fp = footprint(cube);
  if (isHeld(cube, holding)) return { result: 'none', bay: bayTouched(fp), why: 'held' };
  if (isOffMat(cube)) return { result: 'none', bay: null, why: 'off-mat' };
  if (!standsOnMat(cube, holding)) return { result: 'none', bay: bayTouched(fp), why: 'lifted' };
  const bay = bayAround(fp);
  if (bay === null) {
    const touched = bayTouched(fp);
    return { result: 'none', bay: touched, why: touched ? 'partly' : 'no-bay' };
  }
  if (touchesRobot(cube, ctx)) return { result: 'none', bay, why: 'touching' };
  return { result: bay === cube.colorName ? 'own' : 'wrong', bay, why: null };
}

/**
 * How far (mm) a cube is from where it stood at the start: the largest distance of one of its
 * corners (the way Fire Chief measures its fire target, fire-chief/game.ts targetShift).
 */
export function blueShift(cube: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle' | 'home'>): number {
  // (almost always it has not moved at all: no need to work out its corners then)
  if (cube.x === cube.home.x && cube.y === cube.home.y && cube.angle === cube.home.angle) return 0;
  const now = obbCorners(footprint(cube));
  const home = obbCorners({ x: cube.home.x, y: cube.home.y, w: cube.w, l: cube.l, angle: cube.home.angle });
  let far = 0;
  for (let i = 0; i < 4; i++) far = Math.max(far, Math.hypot(now[i].x - home[i].x, now[i].y - home[i].y));
  return far;
}

/**
 * Q15: why the blue cube is not where it was put - in words for the score sheet - or null when it
 * is (left alone). It was picked up or lifted at some time (`takenAt`), the robot holds it, it
 * lies off the mat, or it is more than BLUE_MOVED_MM from its place. `over`: the match has ended.
 * (In English; blueMoveIn() says it in other words.)
 */
export function blueMove(cube: Body, holding: string | null, takenAt: number | null, over: boolean): string | null {
  return blueMoveIn(EN_REFEREE_WORDS, cube, holding, takenAt, over);
}

/** blueMove() in these words. */
export function blueMoveIn(words: RefereeWords, cube: Body, holding: string | null, takenAt: number | null, over: boolean): string | null {
  if (isHeld(cube, holding)) return words.robotHolds(over);
  if (takenAt !== null) return words.pickedUpAt(words.clock(takenAt));
  if (isOffMat(cube)) return words.itIsOffMat;
  if (isBlueShifted(cube)) return words.fromItsPlace(words.decimal(overLimit(blueShift(cube), BLUE_MOVED_MM)));
  return null;
}

/**
 * A distance that is over its limit, written so that it never reads like the limit itself or
 * less: 5.01 -> "5.1" (not "5.0 mm, -5"), 5.44 -> "5.4", 7.6 -> "8". (Like Fire Chief's
 * overLimit, which always rounds the tenths up; here they are rounded up only where the usual
 * rounding would print the limit.)
 */
function overLimit(value: number, limit: number): string {
  const whole = Math.round(value);
  if (whole > limit) return String(whole);
  const tenths = Math.round(value * 10) / 10;
  return (tenths > limit ? tenths : (Math.floor(value * 10) + 1) / 10).toFixed(1);
}

/** More than BLUE_MOVED_MM from its place (a push of exactly 5 mm is not more, whatever the last digit of the arithmetic says). */
const isBlueShifted = (cube: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle' | 'home'>): boolean => blueShift(cube) > BLUE_MOVED_MM + 1e-9;

// =============================================================================================
// Words
// =============================================================================================

// Every sentence and name the referee says: ./referee-words.ts (the English ones: EN_REFEREE_WORDS).
/** Match time as the English referee writes it: 83.42 -> "1:23.4" (tenths cut off, never rounded up). */
export { clock };

// =============================================================================================
// The referee
// =============================================================================================

export const LINE_LEAVE_START = 'leave-start';
export const pickLineId = (w: WarehouseId): string => `pick:${w}`;
export const deliverLineId = (w: WarehouseId): string => `deliver:${w}`;
export const LINE_PARK = 'park';
export const LINE_CLEAN = 'clean-run';
export const LINE_RESTARTS = 'restarts';
export const LINE_WRONG_BAY = 'wrong-bay';
export const LINE_LAST_DELIVERY = 'last-delivery';
export const LINE_START_POSITION = 'start-position';
/** The line of the blue cube: left alone 0, moved -5 (Q15). */
export const LINE_BLUE = 'blue-cube';

function createReferee(scenario: WarehouseSortScenario, words: RefereeWords): Referee<WarehouseSortScenario> {
  // (the numbers and names in the words of this game: "1:23.4" or "1:23,4", "cube W2 (red)" or "cube E2 (rouge)")
  const clock = (seconds: number): string => words.clock(seconds);
  const cm = (mm: number): string => words.cm(mm);
  const cubeName = (w: WarehouseId, color: CubeColor): string => words.cubeName(w, color);
  const bayName = (color: BayColor): string => words.bayName(color);
  /** the warehouse of the blue cube, and the three whose cubes go to a bay */
  const blueW = blueWarehouse(scenario);
  const sorted = sortedWarehouses(scenario);
  /** when the robot first had a part outside the start zone */
  let leftAt: number | null = null;
  /** per warehouse: when its cube was picked */
  const pickedAt = new Map<WarehouseId, number>();
  /** per warehouse: where its cube was when the gripper took it (only while it is held) */
  const takenAt = new Map<WarehouseId, { x: number; y: number }>();
  /** per warehouse: the gripper has held its cube at some time (to say why it was not picked) */
  const gripped = new Set<WarehouseId>();
  /** per warehouse: since when its cube stands in a bay without a break (the bay and the time) */
  const inBay = new Map<WarehouseId, { bay: BayColor; since: number }>();
  /** per warehouse: the cube is off the mat (to say it once) */
  const offMat = new Set<WarehouseId>();
  /** per warehouse: the bay the referee last said its cube is in (said again only for the other bay) */
  const announced = new Map<WarehouseId, BayColor>();
  /** when the blue cube was first picked up or lifted (Q15: this counts, whatever happens later) */
  let blueTakenAt: number | null = null;
  /** the referee has said that the blue cube was moved (said once) */
  let blueSaid = false;
  /** what the referee says on this tick (almost always nothing) */
  let say: string[] | null = null;
  const speak = (text: string): void => {
    if (say === null) say = [];
    say.push(text);
  };
  /** match times of the restarts */
  const restartTimes: number[] = [];
  /** the match is over: from now on the sheet is final */
  let over = false;
  /** the whole robot was inside the start zone at the start signal (`begun`: the signal was given) */
  let startedInside = true;
  let begun = false;

  const cubeOf = (ctx: ScoreContext<WarehouseSortScenario>, w: WarehouseId): Body | null => {
    const id = cubeBodyId(w);
    for (const body of ctx.world.bodies) if (body.id === id) return body;
    return null;
  };
  const colorOf = (w: WarehouseId): CubeColor => scenario.cubes[w];
  /** the colour of a cube that goes to a bay (only asked for the red and green ones) */
  const bayColorOf = (w: WarehouseId): BayColor => (scenario.cubes[w] === 'green' ? 'green' : 'red');

  function begin(ctx: ScoreContext<WarehouseSortScenario>): void {
    begun = true;
    startedInside = ctx.robotShapes.every((shape) => rectContainsOBB(START_ZONE, shape));
  }

  /** The blue cube, tick by tick: picked up or lifted (counts for good), or moved out of its place. */
  function watchBlue(ctx: ScoreContext<WarehouseSortScenario>, cube: Body, time: number): void {
    const w = blueW as WarehouseId;
    const name = cubeName(w, LEAVE_ALONE_COLOR);
    if (isHeld(cube, ctx.world.robot.gripper.holding)) {
      let from = takenAt.get(w);
      if (!from) {
        from = { x: cube.x, y: cube.y };
        takenAt.set(w, from);
      }
      // (gripping alone is no move: lifted off the mat, or carried as far as a picked cube is)
      const lifted = cube.z > ON_MAT_MM;
      const carried = Math.hypot(cube.x - from.x, cube.y - from.y) >= CARRY_MM - 1e-9;
      if (blueTakenAt === null && (lifted || carried)) {
        blueTakenAt = time;
        blueSaid = true;
        speak(words.bluePickedUp(clock(time), name, BLUE_PENALTY));
      }
    } else {
      takenAt.delete(w);
    }
    if (!blueSaid && isBlueShifted(cube)) {
      blueSaid = true;
      speak(words.blueMoved(clock(time), name));
    } else if (blueSaid && blueTakenAt === null && !isHeld(cube, ctx.world.robot.gripper.holding) && !isBlueShifted(cube)) {
      // Back within BLUE_MOVED_MM of its place, never picked up or lifted, not held: the sheet
      // says "left alone" again (a restart puts a cube the claw held back on its square; a robot
      // can also drag it back), so the console must not end on "moved". A new move is said again.
      blueSaid = false;
      speak(words.blueBack(clock(time), name));
    }
  }

  function observe(ctx: ScoreContext<WarehouseSortScenario>): RefereeCall | null {
    const time = ctx.world.time;
    const holding = ctx.world.robot.gripper.holding;
    say = null;

    // ---- +5: the first moment a part of the robot is outside the start zone
    if (leftAt === null && isOutsideStartZone(ctx.robotShapes)) {
      leftAt = time;
      speak(words.leftStart(POINTS_LEAVE_START, clock(time)));
    }

    for (const w of WAREHOUSE_IDS) {
      const cube = cubeOf(ctx, w);
      if (!cube) continue;
      if (w === blueW) {
        watchBlue(ctx, cube, time);
        continue;
      }
      const name = cubeName(w, colorOf(w));

      // ---- +5: held and lifted 1 cm, or carried one cube length (once per cube)
      if (isHeld(cube, holding)) {
        let from = takenAt.get(w);
        if (!from) {
          from = { x: cube.x, y: cube.y };
          takenAt.set(w, from);
          gripped.add(w);
        }
        if (!pickedAt.has(w)) {
          const lifted = cube.z >= LIFT_MM - 1e-9;
          const carried = Math.hypot(cube.x - from.x, cube.y - from.y) >= CARRY_MM - 1e-9;
          if (lifted || carried) {
            pickedAt.set(w, time);
            speak(words.pickedUp(POINTS_PICK, clock(time), name));
          }
        }
      } else {
        takenAt.delete(w);
      }

      // ---- standing in a bay: since when (the time of a delivery - tie-breaker 3 of the rules)
      const bay = standsOnMat(cube, holding) ? bayAround(footprint(cube)) : null;
      const stay = inBay.get(w);
      if (bay === null) {
        inBay.delete(w);
      } else if (!stay || stay.bay !== bay) {
        inBay.set(w, { bay, since: time });
        // (a cube pushed in and out at the edge of a bay is announced once, not on every tick)
        if (announced.get(w) !== bay) {
          announced.set(w, bay);
          speak(bay === colorOf(w) ? words.inBay(clock(time), name, bayName(bay)) : words.inWrongBay(clock(time), name, bayName(bay)));
        }
      }

      // ---- off the mat: said once each time it happens (not while the gripper holds it out over the table)
      if (isLyingOffMat(cube, holding)) {
        if (!offMat.has(w)) {
          offMat.add(w);
          speak(words.offMat(clock(time), name));
        }
      } else {
        offMat.delete(w);
      }
    }
    return say === null ? null : { say };
  }

  /** Rules §7: -10, the robot goes back; points earned so far stay, the clock runs on. */
  function restart(ctx: ScoreContext<WarehouseSortScenario>): void {
    restartTimes.push(ctx.world.time);
  }

  function finished(): void {
    over = true;
  }

  function score(ctx: ScoreContext<WarehouseSortScenario>): ScoreReport {
    const lines: ScoreLine[] = [];
    const restarts = Number.isFinite(ctx.restarts) ? Math.max(0, Math.floor(ctx.restarts)) : 0;

    // ---- leave the start zone
    lines.push({
      id: LINE_LEAVE_START,
      label: words.leaveStartLabel,
      points: leftAt !== null ? POINTS_LEAVE_START : 0,
      max: POINTS_LEAVE_START,
      ok: leftAt !== null,
      detail: leftAt !== null ? words.doneAt(clock(leftAt)) : over ? words.neverLeft : words.notYetLeft,
      ...(leftAt !== null ? { time: leftAt } : {}),
    });

    // ---- the red and green cubes: picked, delivered (the blue one has a line of its own below)
    const judged = new Map<WarehouseId, Delivery>();
    for (const w of sorted) {
      const cube = cubeOf(ctx, w);
      if (cube) judged.set(w, judgeCube(cube, ctx));
    }
    // "no score" for a cube off the mat (§7) and "no points for that cube" for a cube in the
    // wrong bay (§6): that cube also loses its points for being picked up (Q9, Q10)
    const lost = (w: WarehouseId): string | null => {
      const d = judged.get(w);
      if (d?.why === 'off-mat') return words.offMatPlace;
      if (d?.result === 'wrong') return words.wrongBayPlace;
      return null;
    };

    for (const w of sorted) {
      const at = pickedAt.get(w);
      const where = lost(w);
      const earned = at !== undefined && where === null;
      let detail: string;
      if (!judged.has(w)) detail = words.notOnField;
      else if (where !== null) detail = at !== undefined ? words.pickedButLost(clock(at), where) : words.lostNoPoints(where);
      else if (at !== undefined) detail = words.doneAt(clock(at));
      else if (over) detail = gripped.has(w) ? words.grippedNotPicked(cm(LIFT_MM), cm(CARRY_MM)) : words.notPicked;
      else detail = words.notYetPicked(cm(LIFT_MM), cm(CARRY_MM));
      lines.push({
        id: pickLineId(w),
        label: words.pickLabel(cubeName(w, colorOf(w))),
        points: earned ? POINTS_PICK : 0,
        max: POINTS_PICK,
        ok: earned,
        detail,
        ...(earned ? { time: at } : {}),
      });
    }

    const wrong: WarehouseId[] = [];
    let lastDelivery: number | null = null;
    let delivered = 0;
    for (const w of sorted) {
      const color = bayColorOf(w);
      const d = judged.get(w);
      const since = inBay.get(w)?.since;
      let detail: string;
      if (!d) detail = words.notOnField;
      else if (d.result === 'own') {
        delivered++;
        if (since !== undefined) lastDelivery = lastDelivery === null ? since : Math.max(lastDelivery, since);
        detail = since !== undefined ? words.inBaySince(bayName(color), clock(since)) : words.inBayNow(bayName(color));
      } else if (d.result === 'wrong') {
        wrong.push(w);
        detail = words.wrongBayDetail(bayName(d.bay as BayColor), WRONG_BAY_PENALTY);
      } else {
        switch (d.why) {
          case 'off-mat':
            detail = words.offMatNoPoints;
            break;
          case 'held':
            detail = words.heldPutDown(over, bayName(color));
            break;
          case 'lifted':
            detail = words.liftedPutDown(bayName(color));
            break;
          case 'touching':
            detail = words.touchingRobot(bayName(d.bay as BayColor), over);
            break;
          case 'partly':
            detail = words.partlyInBay(bayName(d.bay as BayColor));
            break;
          default:
            detail = over ? words.notInBay : words.notYetInBay(bayName(color));
        }
      }
      const ok = d?.result === 'own';
      lines.push({
        id: deliverLineId(w),
        label: words.deliverLabel(cubeName(w, color), bayName(color)),
        points: ok ? POINTS_DELIVER : 0,
        max: POINTS_DELIVER,
        ok,
        detail,
        ...(ok && since !== undefined ? { time: since } : {}),
      });
    }

    // ---- finish park
    const pad = parkedOn(ctx.robotShapes);
    lines.push({
      id: LINE_PARK,
      label: words.parkLabel,
      points: pad ? POINTS_PARK : 0,
      max: POINTS_PARK,
      ok: pad !== null,
      detail: pad ? words.parkedOn(pad, over) : over ? words.noPadAtEnd : words.mustTouchPad,
    });

    // ---- clean run, restarts
    lines.push({
      id: LINE_CLEAN,
      label: words.cleanLabel,
      points: restarts === 0 ? POINTS_CLEAN : 0,
      max: POINTS_CLEAN,
      ok: restarts === 0,
      detail: restarts === 0 ? (over ? words.noRestart : words.noRestartSoFar) : words.restartUsed,
    });
    lines.push({
      id: LINE_RESTARTS,
      label: words.restartsLabel,
      points: 0 - RESTART_PENALTY * restarts,
      max: 0,
      ok: restarts === 0,
      detail:
        restarts === 0
          ? words.noRestarts
          : words.restartsDetail(
              restarts,
              restartTimes.map((t) => clock(t)),
              RESTART_PENALTY,
            ),
    });
    lines.push({
      id: LINE_WRONG_BAY,
      label: words.wrongLabel,
      points: 0 - WRONG_BAY_PENALTY * wrong.length,
      max: 0,
      ok: wrong.length === 0,
      detail:
        wrong.length === 0
          ? words.noneWrong
          : words.wrongDetail(
              wrong.map((w) => cubeName(w, colorOf(w))),
              WRONG_BAY_PENALTY,
            ),
    });

    // ---- the blue cube: left alone 0, moved -5 (Q15) - once, wherever it is
    if (blueW !== null) {
      const cube = cubeOf(ctx, blueW);
      const move = cube ? blueMoveIn(words, cube, ctx.world.robot.gripper.holding, blueTakenAt, over) : null;
      lines.push({
        id: LINE_BLUE,
        label: words.blueLabel(blueW),
        points: move === null ? 0 : -BLUE_PENALTY,
        max: 0,
        ok: move === null,
        detail: move === null ? (cube ? words.leftAlone : words.notOnField) : words.blueMovedDetail(move, BLUE_PENALTY),
      });
    }

    // ---- tie-breaker 3: the time of the last correct delivery (a line only when there is one:
    // it costs nothing and is no fault, and a line without points that is not "ok" would read
    // as a warning on the sheet)
    if (lastDelivery !== null) {
      lines.push({
        id: LINE_LAST_DELIVERY,
        label: words.lastDeliveryLabel,
        points: 0,
        max: 0,
        ok: true,
        detail: words.tieDetail(delivered, clock(lastDelivery)),
        time: lastDelivery,
      });
    }

    // ---- the start position (only a start pose handed to the simulation can be outside)
    const inside = begun || ctx.world.tick > 0 ? startedInside : ctx.robotShapes.every((shape) => rectContainsOBB(START_ZONE, shape));
    if (!inside) {
      lines.push({
        id: LINE_START_POSITION,
        label: words.startPositionLabel,
        points: 0,
        max: 0,
        ok: false,
        detail: words.startPositionDetail,
      });
    }

    const sum = lines.reduce((total, line) => total + line.points, 0);
    // Every goal: each line with points earned, and the blue cube left alone - its line has no
    // points (max 0), but leaving it is part of the mission (Q15). (A cube in the wrong bay or a
    // restart already fails a line with points.) The end of the match ("every goal complete")
    // and the test window read this.
    const complete = lines.every((line) => line.ok || (line.max === 0 && line.id !== LINE_BLUE));
    return { total: Math.max(0, sum), max: MAX_SCORE, lines, complete };
  }

  return { begin, observe, restart, finished, score };
}

// =============================================================================================
// The game
// =============================================================================================

/** What makes one game of the Warehouse Sort mission different from another: its id, its title and how it writes codes. */
export interface WarehouseSortGameOptions {
  id: string;
  title: string;
  /** how the codes of the arrangements are written and read (./scenario.ts EN_CODEC: "GR-BR") */
  codec: ScenarioCodec;
  /** the sentences about an arrangement (./scenario.ts scenarioText) */
  scenarioText: ScenarioText;
}

/**
 * The Warehouse Sort mission as a game: the same mat, cubes, 24 arrangements, points, constants
 * and referee, in the words given. Warehouse Sort (below) and Robot en fête 2027
 * (../robot-en-fete/game.ts) are both made here.
 */
export function createWarehouseSortGame(words: RefereeWords, options: WarehouseSortGameOptions): Game<WarehouseSortScenario> {
  const { codec, scenarioText: text } = options;
  const referee = (scenario: WarehouseSortScenario): Referee<WarehouseSortScenario> => createReferee(scenario, words);
  return {
    id: options.id,
    title: options.title,
    mat: {
      width: MAT_SIZE,
      height: MAT_SIZE,
      imageUrl: MAT_IMAGE_URL,
      sensorImageUrl: MAT_SENSOR_IMAGE_URL,
      vector: MAT_VECTOR,
    },
    matchDuration: MATCH_DURATION,
    startZone: START_ZONE,
    defaultStartPose: START_POSE,
    restartPenalty: RESTART_PENALTY,
    defaultScenario,
    randomScenario,
    scenarioCount: () => SCENARIO_COUNT,
    encodeScenario: codec.encode,
    decodeScenario: codec.decode,
    describeScenario: text.describeScenario,
    createBodies: (s) => createBodies(s, codec.letters),
    overlays: (s) => overlays(s, words),
    // (during a match the referee below keeps the score; this is the sheet of a match in which
    // nothing has happened yet)
    score: (ctx) => referee(ctx.scenario).score(ctx),

    robotConfig: WAREHOUSE_SORT_ROBOT,
    createReferee: referee,
    // no restartRules: as many restarts as the team wants, RESTART_PENALTY each; only the cube in
    // the gripper goes back (to its warehouse)
    scenarioProblems: text.scenarioProblems,
  };
}

export const warehouseSortGame: Game<WarehouseSortScenario> = createWarehouseSortGame(EN_REFEREE_WORDS, {
  id: 'warehouse-sort',
  title: 'MakeX Lebanon - Inspire: Warehouse Sort',
  codec: EN_CODEC,
  scenarioText: scenarioText(EN_SCENARIO_WORDS),
});
