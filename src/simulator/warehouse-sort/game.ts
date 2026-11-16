/**
 * MakeX Lebanon - Inspire (beginner), mission "Warehouse Sort": the game and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?           -> createBodies()
 *   2. Which areas should be highlighted on the mat?           -> overlays()
 *   3. What has the robot earned so far, when, and why (not)?  -> createReferee()
 *
 * The referee follows the rules (§5 - §8, "Beginner - Warehouse Sort (MakeX Lebanon, Local)"):
 *
 *   +5   Leave the start zone: the first moment a part of the robot is outside it (kept)
 *   +5   each cube picked: held by the gripper and lifted at least 1 cm, or carried (once per cube)
 *   +15  each cube in the bay of its own colour at the end: completely inside, standing on the
 *        mat, not held, not touching the robot
 *   -5   each cube in the bay of the other colour at the end (same conditions), "and no points
 *        for that cube": no +15, and no +5 for picking it either (Q10)
 *   +10  Finish park: at the end the robot touches one of the two round finish pads
 *   +5   Clean run: no restart
 *   -10  each restart: the robot goes back to the start zone, the clock runs on
 *   The total is never below 0. Highest score: 5 + 4 x 5 + 4 x 15 + 10 + 5 = 100.
 *
 * A match lasts 90 s. It ends then, when the program has ended and the robot stands still, or
 * when the team says "Finished"; then the field is judged as it lies (like Fire Rescue).
 *
 * The "picked" points and the time of a cube's delivery depend on what happened during the
 * match, so this referee has a memory and looks at every tick (core/types.ts: Referee).
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
 *   Q1. §2 calls the start zone "a large green area on the right". The mat has a yellow-framed
 *       area with a blue picture there. The simulator uses that area, and counts the yellow
 *       frame in (as Fire Rescue counts its outlines).                    START_ZONE (./field.ts)
 *   Q2. §2 calls the finish pads "yellow circles with checkerboards". The mat has two round
 *       pictures without a checkerboard at the top and the bottom. The simulator uses those.
 *                                                                        FINISH_PADS (./field.ts)
 *   Q3. The finish park: §5 "park touching the circle", §8 "projection entirely inside one
 *       circle". The pads are 160 x 157 mm; the mBot2 with its gripper is 237 x 130 mm, so it
 *       can never be entirely inside one. The simulator scores "touching".           parkedOn()
 *   Q4. §6 "Example max = 85", but its own line items add up to 5 + 20 + 60 + 10 + 5 = 100.
 *       The simulator uses the line items.                                         MAX_SCORE
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
 *   Q11. Leaving the start zone: the zone runs to the right edge of the mat, so a robot that
 *       backs over that edge onto the table has also left it, and gets the 5 points without
 *       driving into the field.                                          isOutsideStartZone()
 *   Q12. The rules have no walls ("teams may navigate freely as long as they stay on the mat").
 *       Leaving the mat costs nothing here; a table 100 mm wide around the mat stops the robot
 *       and the cubes.                                                  TABLE_STRIP (./field.ts)
 *   Q13. The total is never below 0 (as in Fire Rescue; the rules do not say).        score()
 *   Q14. Tie-breaker 3, "faster time of last correct delivery": the simulator shows the latest
 *       moment at which a cube that counts at the end was put down in its bay. LINE_LAST_DELIVERY
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
import {
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  scenarioProblems,
  type CubeColor,
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
export const CUBE_COUNT = WAREHOUSE_IDS.length;
/** 5 + 4 x 5 + 4 x 15 + 10 + 5 = 100 (the rules' own line items; their "example max = 85" does not add up). */
export const MAX_SCORE = POINTS_LEAVE_START + CUBE_COUNT * (POINTS_PICK + POINTS_DELIVER) + POINTS_PARK + POINTS_CLEAN;
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

/** The cubes are drawn in the colours of the Fire Rescue buckets. */
const CUBE_FILL: Record<CubeColor, string> = { red: '#ef4044', green: '#40ad49' };
/** Letter drawn on a cube, so the colour can also be read without seeing colours. */
const CUBE_LETTER: Record<CubeColor, string> = { red: 'R', green: 'G' };

/** Where the cube of a warehouse stands at the start: the middle of its orange square. */
export function cubeHome(warehouse: WarehouseId): { x: number; y: number } {
  return rectCenter(WAREHOUSES[warehouse].square);
}

function createBodies(s: WarehouseSortScenario): Body[] {
  return WAREHOUSE_IDS.map((warehouse) => {
    const color = s.cubes[warehouse];
    const { x, y } = cubeHome(warehouse);
    return {
      id: cubeBodyId(warehouse),
      kind: KIND_CUBE,
      label: CUBE_LETTER[color] ?? '?',
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

function overlays(s: WarehouseSortScenario): ZoneOverlay[] {
  const out: ZoneOverlay[] = [{ id: 'start', label: 'Start zone', rect: START_ZONE, color: START_CSS, kind: 'start' }];
  for (const w of WAREHOUSE_IDS) {
    const color = s.cubes[w];
    out.push({ id: `warehouse:${w}`, label: `${w} ${color}`, rect: WAREHOUSES[w].frame, color: WAREHOUSE_CSS, kind: 'pickup' });
  }
  for (const color of BAY_COLORS) {
    out.push({ id: `bay:${color}`, label: `${color === 'red' ? 'Red' : 'Green'} bay`, rect: BAYS[color], color: BAY_CSS[color], kind: 'delivery' });
  }
  for (const pad of PAD_IDS) {
    // (the round pad itself; its rect is the box around it)
    out.push({ id: `pad:${pad}`, label: 'Finish pad', rect: ellipseBox(FINISH_PADS[pad]), color: PAD_CSS, kind: 'info', shape: 'ellipse' });
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

/** Rules §5: the finish pad the robot touches (the top one first), or null. */
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

// =============================================================================================
// Words
// =============================================================================================

/** Match time as the referee writes it: 83.42 -> "1:23.4" (tenths cut off, never rounded up). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1)}`;
}

const bayName = (color: BayColor): string => `the ${color} bay`;
/** mm in cm, as a sentence writes it: 10 -> "1", 40 -> "4". */
const cm = (mm: number): string => String(Math.round(mm) / 10);
/** "cube W2 (red)" */
const cubeName = (w: WarehouseId, color: CubeColor): string => `cube ${w} (${color})`;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

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

function createReferee(scenario: WarehouseSortScenario): Referee<WarehouseSortScenario> {
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

  function begin(ctx: ScoreContext<WarehouseSortScenario>): void {
    begun = true;
    startedInside = ctx.robotShapes.every((shape) => rectContainsOBB(START_ZONE, shape));
  }

  function observe(ctx: ScoreContext<WarehouseSortScenario>): RefereeCall | null {
    const time = ctx.world.time;
    const holding = ctx.world.robot.gripper.holding;
    say = null;

    // ---- +5: the first moment a part of the robot is outside the start zone
    if (leftAt === null && isOutsideStartZone(ctx.robotShapes)) {
      leftAt = time;
      speak(`+${POINTS_LEAVE_START} points at ${clock(time)}: the robot left the start zone.`);
    }

    for (const w of WAREHOUSE_IDS) {
      const cube = cubeOf(ctx, w);
      if (!cube) continue;
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
            speak(`+${POINTS_PICK} points at ${clock(time)}: ${name} picked up.`);
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
          speak(
            bay === colorOf(w)
              ? `${clock(time)}: ${capital(name)} is in ${bayName(bay)}.`
              : `${clock(time)}: ${capital(name)} is in ${bayName(bay)} - the wrong bay.`,
          );
        }
      }

      // ---- off the mat: said once each time it happens (not while the gripper holds it out over the table)
      if (isLyingOffMat(cube, holding)) {
        if (!offMat.has(w)) {
          offMat.add(w);
          speak(`${clock(time)}: ${capital(name)} is off the mat. It scores nothing now.`);
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
      label: 'Leave the start zone',
      points: leftAt !== null ? POINTS_LEAVE_START : 0,
      max: POINTS_LEAVE_START,
      ok: leftAt !== null,
      detail:
        leftAt !== null
          ? `done at ${clock(leftAt)}`
          : over
            ? 'the robot never left the start zone'
            : 'not yet - drive out of the start zone',
      ...(leftAt !== null ? { time: leftAt } : {}),
    });

    // ---- the cubes: picked, delivered
    const judged = new Map<WarehouseId, Delivery>();
    for (const w of WAREHOUSE_IDS) {
      const cube = cubeOf(ctx, w);
      if (cube) judged.set(w, judgeCube(cube, ctx));
    }
    // "no score" for a cube off the mat (§7) and "no points for that cube" for a cube in the
    // wrong bay (§6): that cube also loses its points for being picked up (Q9, Q10)
    const lost = (w: WarehouseId): 'off the mat' | 'in the wrong bay' | null => {
      const d = judged.get(w);
      if (d?.why === 'off-mat') return 'off the mat';
      if (d?.result === 'wrong') return 'in the wrong bay';
      return null;
    };

    for (const w of WAREHOUSE_IDS) {
      const at = pickedAt.get(w);
      const where = lost(w);
      const earned = at !== undefined && where === null;
      let detail: string;
      if (!judged.has(w)) detail = 'this cube is not on the field';
      else if (where !== null) detail = at !== undefined ? `picked at ${clock(at)}, but the cube is ${where}: no points` : `the cube is ${where}: no points`;
      else if (at !== undefined) detail = `done at ${clock(at)}`;
      else if (over) detail = gripped.has(w) ? `gripped, but not lifted ${cm(LIFT_MM)} cm or carried ${cm(CARRY_MM)} cm` : 'not picked up';
      else detail = `not yet - grip it, then lift it ${cm(LIFT_MM)} cm or carry it ${cm(CARRY_MM)} cm`;
      lines.push({
        id: pickLineId(w),
        label: `Pick up ${cubeName(w, colorOf(w))}`,
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
    for (const w of WAREHOUSE_IDS) {
      const color = colorOf(w);
      const d = judged.get(w);
      const since = inBay.get(w)?.since;
      let detail: string;
      if (!d) detail = 'this cube is not on the field';
      else if (d.result === 'own') {
        delivered++;
        if (since !== undefined) lastDelivery = lastDelivery === null ? since : Math.max(lastDelivery, since);
        detail = since !== undefined ? `in ${bayName(color)} since ${clock(since)}` : `in ${bayName(color)}`;
      } else if (d.result === 'wrong') {
        wrong.push(w);
        detail = `in ${bayName(d.bay as BayColor)} - wrong bay, -${WRONG_BAY_PENALTY}`;
      } else {
        switch (d.why) {
          case 'off-mat':
            detail = 'off the mat: no points';
            break;
          case 'held':
            detail = `the robot ${over ? 'still held' : 'is holding'} it - put it down in ${bayName(color)}`;
            break;
          case 'lifted':
            detail = `not standing on the mat - put it down in ${bayName(color)}`;
            break;
          case 'touching':
            detail = `in ${bayName(d.bay as BayColor)}, but touching the robot${over ? '' : ' - move away'}`;
            break;
          case 'partly':
            detail = `only partly in ${bayName(d.bay as BayColor)} - the whole cube must be inside`;
            break;
          default:
            detail = over ? 'not in a bay' : `not yet - put it in ${bayName(color)}`;
        }
      }
      const ok = d?.result === 'own';
      lines.push({
        id: deliverLineId(w),
        label: `${capital(cubeName(w, color))} in ${bayName(color)}`,
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
      label: 'Park on a finish pad',
      points: pad ? POINTS_PARK : 0,
      max: POINTS_PARK,
      ok: pad !== null,
      detail: pad
        ? `the robot ${over ? 'touched' : 'touches'} the ${pad} pad`
        : over
          ? 'the robot did not touch a finish pad at the end'
          : 'at the end the robot must touch a round pad (top or bottom)',
    });

    // ---- clean run, restarts
    lines.push({
      id: LINE_CLEAN,
      label: 'Clean run: no restart',
      points: restarts === 0 ? POINTS_CLEAN : 0,
      max: POINTS_CLEAN,
      ok: restarts === 0,
      detail: restarts === 0 ? (over ? 'no restart' : 'no restart so far') : 'a restart was used',
    });
    lines.push({
      id: LINE_RESTARTS,
      label: 'Restarts',
      points: 0 - RESTART_PENALTY * restarts,
      max: 0,
      ok: restarts === 0,
      detail:
        restarts === 0
          ? 'no restarts'
          : `${restarts} restart${restarts === 1 ? '' : 's'} (${restartTimes.map(clock).join(', ')}), -${RESTART_PENALTY} each`,
    });
    lines.push({
      id: LINE_WRONG_BAY,
      label: 'Cubes in the wrong bay',
      points: 0 - WRONG_BAY_PENALTY * wrong.length,
      max: 0,
      ok: wrong.length === 0,
      detail:
        wrong.length === 0
          ? 'none'
          : `${wrong.map((w) => cubeName(w, colorOf(w))).join(', ')}, -${WRONG_BAY_PENALTY} each`,
    });

    // ---- tie-breaker 3: the time of the last correct delivery (a line only when there is one:
    // it costs nothing and is no fault, and a line without points that is not "ok" would read
    // as a warning on the sheet)
    if (lastDelivery !== null) {
      lines.push({
        id: LINE_LAST_DELIVERY,
        label: 'Time of the last correct delivery',
        points: 0,
        max: 0,
        ok: true,
        detail: `for a tie: ${delivered} cube${delivered === 1 ? '' : 's'} in the right bay, the last one put there at ${clock(lastDelivery)}`,
        time: lastDelivery,
      });
    }

    // ---- the start position (only a start pose handed to the simulation can be outside)
    const inside = begun || ctx.world.tick > 0 ? startedInside : ctx.robotShapes.every((shape) => rectContainsOBB(START_ZONE, shape));
    if (!inside) {
      lines.push({
        id: LINE_START_POSITION,
        label: 'Start inside the start zone',
        points: 0,
        max: 0,
        ok: false,
        detail: 'the robot did not start completely inside the start zone - a referee would not start this match',
      });
    }

    const sum = lines.reduce((total, line) => total + line.points, 0);
    const complete = lines.every((line) => line.max === 0 || line.ok);
    return { total: Math.max(0, sum), max: MAX_SCORE, lines, complete };
  }

  return { begin, observe, restart, finished, score };
}

// =============================================================================================
// The game
// =============================================================================================

export const warehouseSortGame: Game<WarehouseSortScenario> = {
  id: 'warehouse-sort',
  title: 'MakeX Lebanon - Inspire: Warehouse Sort',
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
  encodeScenario,
  decodeScenario,
  describeScenario,
  createBodies,
  overlays,
  // (during a match the referee below keeps the score; this is the sheet of a match in which
  // nothing has happened yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: WAREHOUSE_SORT_ROBOT,
  createReferee,
  // no restartRules: as many restarts as the team wants, RESTART_PENALTY each; only the cube in
  // the gripper goes back (to its warehouse)
  scenarioProblems,
};
