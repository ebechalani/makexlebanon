/**
 * Robot en fête 2027 - « Logistique intelligente »: the game and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?           -> createBodies(), createWalls()
 *   2. Which areas should be highlighted on the mat?           -> overlays()
 *   3. What has the robot earned so far, and why (not)?        -> createReferee()
 *
 * The referee follows the regular mission of the rules ("MakeX Inspire", V2.0, theme "Smart
 * Logistics", 4.4 and chapter 6) and speaks French only: there is no English twin of this game,
 * so its words are written here (Tri d'entrepôt needed a word table because Warehouse Sort exists
 * in English). « tu » for the student; a no-break space before : ; ! ? and inside « »; times with a
 * decimal comma, « 1:02,3 ».
 *
 *   +50  each VALID cube at the end of the match (p. 13/9 "Each successful removal of one yellow
 *        cube counts for 50 points"; "the referee calculates the scoring according to the status
 *        of props at the scoring time"). Ten cubes: at most 500.
 *   -20  each time the robot leaves the arena (R19, p. 22/18; E02 p. 19/15; the score sheet p. 31/27
 *        "Violation (-20points each)").
 *   A cube that leaves the arena is removed and scores nothing (R18, p. 22/18) - no -20.
 *   The total is never below 0.
 *
 * VALID (p. 13/9): "(1) The yellow cube completely covers the warehouse area, has direct contact
 * with the arena and does not contact the robot directly. (2) The yellow cube only contacts the
 * other yellow cube that completely covers the warehouse area directly and does not contact the
 * robot directly. (3) Each warehouse has a maximum of 2 valid cubes." E04 (p. 20/16): "At the
 * scoring time, if the prop is in contact with the robot directly, the prop can not be scored."
 *
 * The cubes are judged BOTTOM-UP: first the cubes standing on the mat, then the cubes resting on
 * them, and so on; a cube on a cube reads the result of the cube under it (judgeCubes(), the cases
 * a - l of the design's table 6.3, in this order, the first that applies):
 *   a  in the claw                                                            no
 *   on the mat:  b covers a warehouse but touches the robot                    no
 *                c covers a warehouse, does not touch the robot                YES (1)
 *                d covers only part of a warehouse                             no
 *                e in the storage cross                                        no
 *                f elsewhere                                                   no
 *   on cube m:   g touches the robot                                           no
 *                h1 m is in the claw; h2 m is in the storage cross; h3 m is valid by (2) (a third
 *                layer); h4 m touches the robot; h5 m does not cover a whole warehouse; h6 m does
 *                not count for another reason                                  no
 *                i  (m valid by (1)) it touches another cube too               no (2)
 *                j  the warehouse already has two valid cubes (a guard)        no (3)
 *                k  else                                                       YES (2)
 *   l  lifted, not held and resting on nothing (a guard: never seen at the end of a tick)  no
 * A cube that left the arena is off the field: its line says when.
 *
 * WORDS OF THE RULES, IN ENGINE TERMS
 *   - COVERS a warehouse: every corner of the warehouse's 40 mm square (its yellow border
 *     included) is inside the cube's footprint, seen from above - no tolerance (1e-6 mm). A
 *     centred cube has 5.0 mm to spare on each side and may be turned up to 17.1 degrees; E1 and E4
 *     are diamonds: a cube covers them only turned 45 ± 17.1 degrees.
 *   - STANDS ON THE MAT ("direct contact with the arena"): not held, resting on nothing, its base
 *     at most ON_MAT_MM high.
 *   - TOUCHES THE ROBOT: a part of the robot is closer than TOUCH_MM to the cube, seen from above
 *     AND in height (the chassis from the mat to 90 mm, each finger from the claw's underside up
 *     by 20 mm). A raised claw above a cube does not touch it.
 *   - TOUCHES ANOTHER CUBE p (rule (2), "only contacts the other yellow cube"): p is neither the
 *     cube under it nor a cube resting on it (Q17), and either their footprints are closer than
 *     TOUCH_MM and their heights overlap by more than TOUCH_MM (side to side), or their footprints
 *     overlap by more than TOUCH_MM and one's base is within TOUCH_MM of the other's top (a cube
 *     lying partly on p). Two cubes that meet only along an edge do not touch (Q18).
 *   - LEAVES THE ARENA (R18, R19): a corner of the cube's footprint, or of the chassis or of a
 *     finger, is more than LEAVE_MM outside 0 .. 1200 (the inner side of the frame, Q15). The robot
 *     is back IN when every corner of its shapes is inside 0 .. 1200 again.
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 *
 * =====================================================================================
 *  WHERE THE RULES ARE OPEN - what the simulator does, and the constant behind it
 * =====================================================================================
 * The design's questions for the organiser (its section 10), with the same numbers:
 *   Q1. The warehouse: 50 mm (text) or 40 mm (figure, mat)? 40.              WAREHOUSE_SIZE (./field.ts)
 *   Q2. The frame's height: not given. 50 mm; the raised claw passes over it.  FRAME_HEIGHT (./field.ts)
 *   Q3. A cube on a cube counts only if the cube under it counts by (1).              judgeCubes()
 *   Q4. The first violation is not a warning: -20 at once, every time.           VIOLATION_POINTS
 *   Q5. One violation per exit: out, back in, out again = two.                          observe()
 *   Q6. The total is never below 0.                                                       score()
 *   Q7. The completion time is the end of the match (time, « Terminé », or the program ended
 *       and the robot still).                                                          finished()
 *   Q8. The claw may take a stack by its bottom cube and carry the pair (Body.keepsRiders). cube()
 *   Q9. The CyberPi buttons work during a match and cost nothing (a fault in competition: R14).
 *   Q10. The start pose: facing up on the stem; the student may move it in the start area.
 *                                                                        START_POSE (./robot.ts)
 *   Q11. A cube is exactly 50 mm.                                           CUBE_SIZE (./field.ts)
 *   Q13. A held cube does not count in the robot's height (nothing here measures it).
 *   Q14. The warehouses are E1 - E8 and the cubes 1 - 10 on the screen.     WAREHOUSE_IDS, cubeId()
 *   Q15. The arena ends at the frame's INNER side, and "leave" means any part.          LEAVE_MM
 *   Q16. A cube that leaves the arena is removed: 0 points, no -20 (R18 has no penalty bullet).
 *   Q17. A stack of three in one warehouse: 100 (a cube resting on a cube is not that cube's
 *        "contact"; the third cube is the one (3) leaves out).                     cubesTouch()
 *   Q18. A cube on a cube that meets a neighbour only along an edge still counts.   cubesTouch()
 * (Q12 is about the site's pages.)
 *
 * Not simulated: a referee's judgement by eye (the simulator measures to the millimetre); a cube
 * that tips, rolls or bounces (a cube that loses its support comes down flat beside it, or over the
 * frame where there is no room beside it: core/engine.ts overTheWall); the
 * conduct and safety rules (R01 - R17, R20 - R24), which no program can break.
 */
import { obbContainsOBB, obbCorners, obbOverlap, obbTouches, type OBB } from '../core/geometry';
import type { Body, FixedWall, Game, Referee, RefereeCall, ScoreContext, ScoreLine, ScoreReport, ZoneOverlay } from '../core/types';
import {
  ARENA_SIZE,
  CUBE_MASS,
  CUBE_SIZE,
  FRAME_HEIGHT,
  FRAME_THICKNESS,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  START_AREA,
  STORAGE_BOX,
  STORAGE_OUTLINE,
  STORAGE_SQUARE_IDS,
  WAREHOUSE_IDS,
  WAREHOUSES,
  inStorage,
  storageSquareCentre,
  warehouseBox,
  warehouseCorners,
  warehouseFrame,
  type StorageSquare,
  type WarehouseId,
} from './field';
import { LOGISTIQUE_ROBOT, START_POSE } from './robot';
import {
  NB,
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  type LogistiqueScenario,
} from './scenario';

// =============================================================================================
// Identity
// =============================================================================================

/** The game's id = the page's slug: it names the work a student saves here and the program files. */
export const LOGISTIQUE_ID = 'logistique-intelligente';
/** The game's title (the pattern of Tri d'entrepôt's). */
export const LOGISTIQUE_GAME_TITLE = `MakeX Lebanon - Inspire${NB}: Logistique intelligente (Robot en fête 2027)`;

// =============================================================================================
// Points and time (rules p. 9/5, 13/9, 19/15, 22/18, 31/27)
// =============================================================================================

/** RULE p. 9/5, 15/11: a match lasts 150 seconds (the 5 s countdown is not simulated). */
export const MATCH_DURATION = 150;
/** RULE p. 13/9: "Each successful removal of one yellow cube counts for 50 points." */
export const POINTS_PER_CUBE = 50;
/** RULE p. 12/8: ten cubes, two layers of five. */
export const CUBE_COUNT = 10;
/** RULE p. 13/9: "(3) Each warehouse has a maximum of 2 valid cubes." */
export const MAX_PER_WAREHOUSE = 2;
/** RULE p. 13/9: "Maximum scores= 50*10=500". */
export const MAX_SCORE = POINTS_PER_CUBE * CUBE_COUNT;
/** RULE E02 p. 19/15, R19 p. 22/18, the score sheet p. 31/27: "Violation (-20points each)". */
export const VIOLATION_POINTS = 20;

/** Two things closer than this (mm) touch (as in the other games). */
export const TOUCH_MM = 0.5;
/** A cube whose base is at most this high (mm) stands on the mat. */
export const ON_MAT_MM = 0.5;
/** A corner more than this (mm) outside 0 .. 1200 has left the arena (R18, R19). */
export const LEAVE_MM = 0.5;

// =============================================================================================
// The ten cubes and the frame
// =============================================================================================

export const KIND_CUBE = 'cube';
/** How a cube is drawn: Fire Fighter's strong yellow. */
export const CUBE_FILL = '#ffd21f';
/**
 * How the frame is drawn: almost black (the rules' Fig 4.1 shows low dark walls), so that it stands out
 * at 3:1 or more from every colour of the mat it borders - the grey band (6.2:1), the blue and red
 * bands (4.1 and 3.0:1), the start area - and from a cube pushed against it: the arena ends at the
 * frame's inner side (WCAG 1.4.11).
 */
export const FRAME_FILL = '#09090b';

/** Body id of cube n (1 - 10): 'cube:1' ... 'cube:10'. The console names it « le cube 3 ». */
export const cubeId = (n: number): string => `cube:${n}`;
/** The number of a cube from its body id (null for any other id). */
export function cubeNumber(id: string | null | undefined): number | null {
  const m = /^cube:(\d+)$/.exec(id ?? '');
  return m ? Number(m[1]) : null;
}
/** The ten cubes, 1 - 10. */
export const CUBE_NUMBERS: readonly number[] = Array.from({ length: CUBE_COUNT }, (_, i) => i + 1);
export const CUBE_IDS: readonly string[] = CUBE_NUMBERS.map(cubeId);

/** Where a cube starts: the square of the cross and its layer (« dessous »: on the mat, « dessus »: on the cube below). */
export interface CubeStart {
  readonly square: StorageSquare;
  readonly layer: 'dessous' | 'dessus';
}
/**
 * The start of each cube (the design's 3.1): the bottom cube of the square « haut » is cube 1,
 * « gauche » 2, « centre » 3, « droite » 4, « bas » 5; the cube on it is that number + 5.
 */
export function cubeStart(n: number): CubeStart {
  const half = CUBE_COUNT / 2;
  return { square: STORAGE_SQUARE_IDS[(n - 1) % half], layer: n <= half ? 'dessous' : 'dessus' };
}

/**
 * A cube at its start. Every cube is grippable, a platform (a cube can stand on it) and keeps its
 * riders (Q8): when the claw takes a cube with another cube on it, the cube on it comes along.
 */
function cube(n: number): Body {
  const { square, layer } = cubeStart(n);
  const { x, y } = storageSquareCentre(square);
  const top = layer === 'dessus';
  const z = top ? CUBE_SIZE : 0;
  const restingOn = top ? cubeId(n - CUBE_COUNT / 2) : null;
  return {
    id: cubeId(n),
    kind: KIND_CUBE,
    label: String(n),
    fill: CUBE_FILL,
    colorName: 'yellow',
    x,
    y,
    angle: 0,
    w: CUBE_SIZE,
    l: CUBE_SIZE,
    h: CUBE_SIZE,
    z,
    restingOn,
    held: false,
    grippable: true,
    platform: true,
    mass: CUBE_MASS,
    home: { x, y, angle: 0, z, restingOn },
    keepsRiders: true,
  };
}

/**
 * The ten cubes, the five bottom ones first (they are drawn under the top ones, and a claw lower
 * than 49.5 mm, which reaches both cubes of a stack, takes the first one in the list: the bottom
 * cube), then the five top ones.
 */
function createBodies(): Body[] {
  return CUBE_NUMBERS.map(cube);
}

/** The ids of the four walls of the frame. The console names each « le cadre ». */
export const FRAME_IDS = ['cadre:haut', 'cadre:bas', 'cadre:gauche', 'cadre:droit'] as const;

/**
 * The frame (the design's L4, ASSUMPTION Q2): four fixed walls standing just outside the arena,
 * FRAME_HEIGHT high and FRAME_THICKNESS thick. The robot's chassis and the cubes on the mat cannot
 * pass; the raised claw and a carried cube pass over it. The ultrasonic sensor sees it.
 */
function createWalls(): FixedWall[] {
  const t = FRAME_THICKNESS;
  const a = ARENA_SIZE;
  const wall = (id: (typeof FRAME_IDS)[number], x: number, y: number, w: number, l: number): FixedWall => ({ id, label: 'cadre', x, y, angle: 0, w, l, h: FRAME_HEIGHT, fill: FRAME_FILL });
  return [
    wall('cadre:haut', a / 2, -t / 2, a + 2 * t, t),
    wall('cadre:bas', a / 2, a + t / 2, a + 2 * t, t),
    wall('cadre:gauche', -t / 2, a / 2, t, a),
    wall('cadre:droit', a + t / 2, a / 2, t, a),
  ];
}

// =============================================================================================
// Areas the screen can highlight
// =============================================================================================

const START_CSS = '#facc15';
const STORAGE_CSS = '#f59e0b';
const WAREHOUSE_CSS = '#16a34a';

/** The overlay id of a warehouse: 'entrepot:E1' ... */
export const warehouseZoneId = (w: WarehouseId): string => `entrepot:${w}`;

function overlays(): ZoneOverlay[] {
  const out: ZoneOverlay[] = [
    { id: 'start', label: 'Zone de départ', rect: START_AREA, color: START_CSS, kind: 'start' },
    { id: 'stockage', label: 'Zone de stockage', rect: STORAGE_BOX, color: STORAGE_CSS, kind: 'pickup', outline: STORAGE_OUTLINE },
  ];
  for (const w of WAREHOUSE_IDS) {
    const diamond = WAREHOUSES[w].turnedDeg !== 0;
    out.push({ id: warehouseZoneId(w), label: w, rect: warehouseFrame(w), color: WAREHOUSE_CSS, kind: 'delivery', ...(diamond ? { outline: warehouseCorners(w) } : {}) });
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

/** The cube is held by the gripper. */
export const isHeld = (body: Body, holding: string | null): boolean => body.held || holding === body.id;

/** The cube stands on the mat ("direct contact with the arena"): not held, resting on nothing, not lifted. */
export const standsOnMat = (body: Body, holding: string | null): boolean => !isHeld(body, holding) && body.restingOn === null && body.z <= ON_MAT_MM;

/**
 * The cube touches the robot: a part of the robot is closer than TOUCH_MM to it, seen from above AND
 * in height. The chassis reaches from the mat up to its height; each finger from the underside of
 * the claw up by the height of a finger (ScoreContext.robotShapes: the chassis first, then the two
 * fingers). So a raised claw above a cube does not touch it. (Warehouse Sort's touchesRobot,
 * copied: its signature is typed to its own scenario.)
 */
export function touchesRobot(body: Body, ctx: ScoreContext<LogistiqueScenario>): boolean {
  const config = ctx.robotConfig;
  const claw = ctx.world.robot.gripper.height;
  const fp = footprint(body);
  return ctx.robotShapes.some((shape, i) => {
    const finger = i > 0 && config.gripper.enabled;
    const bottom = finger ? claw : 0;
    const top = finger ? claw + config.gripper.fingerHeight : config.chassisHeight;
    const heightsMeet = bottom < body.z + body.h + TOUCH_MM && body.z < top + TOUCH_MM;
    return heightsMeet && obbTouches(fp, shape, TOUCH_MM);
  });
}

/** (two cubes farther apart than this in x or in y cannot touch: two half-diagonals and the touch distance) */
const NEAR_CUBES = Math.SQRT2 * CUBE_SIZE + TOUCH_MM + 1;

/**
 * Two cubes touch (rule (2), "contacts"): side to side - their footprints are closer than
 * TOUCH_MM and their heights overlap by more than TOUCH_MM; or face to face - their footprints
 * overlap by more than TOUCH_MM (the smallest overlap along a separating axis) and the base of one
 * is within TOUCH_MM of the top of the other (a cube lying partly on another). Two cubes that meet
 * only along an edge touch neither way (Q18): an aligned cube on a cube beside a cube on the mat.
 */
export function cubesTouch(a: Body, b: Body): boolean {
  if (Math.abs(a.x - b.x) > NEAR_CUBES || Math.abs(a.y - b.y) > NEAR_CUBES) return false;
  const fa = footprint(a);
  const fb = footprint(b);
  const heights = Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z);
  if (heights > TOUCH_MM && obbTouches(fa, fb, TOUCH_MM)) return true;
  const stacked = Math.abs(a.z - (b.z + b.h)) <= TOUCH_MM || Math.abs(b.z - (a.z + a.h)) <= TOUCH_MM;
  if (!stacked) return false;
  const overlap = obbOverlap(fa, fb);
  return overlap !== null && overlap.depth > TOUCH_MM;
}

/** (a cube whose middle is farther than this from a warehouse's middle can neither cover nor overlap it) */
const NEAR_WAREHOUSE = (Math.SQRT2 * (CUBE_SIZE + 40)) / 2 + 1;

const nearWarehouse = (body: Body, w: WarehouseId): boolean => {
  const c = WAREHOUSES[w].centre;
  return Math.abs(body.x - c.x) <= NEAR_WAREHOUSE && Math.abs(body.y - c.y) <= NEAR_WAREHOUSE;
};

/** The warehouse (if any) whose whole 40 mm square the cube's footprint covers, seen from above (no tolerance). */
export function coveredWarehouse(body: Body): WarehouseId | null {
  const fp = footprint(body);
  return WAREHOUSE_IDS.find((w) => nearWarehouse(body, w) && obbContainsOBB(fp, warehouseBox(w))) ?? null;
}

/** The warehouse (if any) that the cube's footprint overlaps (touching its edge is not overlapping). */
export function overlappedWarehouse(body: Body): WarehouseId | null {
  const fp = footprint(body);
  return WAREHOUSE_IDS.find((w) => nearWarehouse(body, w) && obbOverlap(fp, warehouseBox(w)) !== null) ?? null;
}

/** A corner of the box is more than LEAVE_MM outside the arena (0 .. 1200). */
export function leavesArena(box: OBB): boolean {
  const reach = Math.hypot(box.w, box.l) / 2;
  if (box.x >= reach && box.y >= reach && box.x <= ARENA_SIZE - reach && box.y <= ARENA_SIZE - reach) return false;
  return obbCorners(box).some((c) => c.x < -LEAVE_MM || c.y < -LEAVE_MM || c.x > ARENA_SIZE + LEAVE_MM || c.y > ARENA_SIZE + LEAVE_MM);
}

/** Every corner of the box is inside the arena (0 .. 1200, the edge counts). */
export function insideArena(box: OBB): boolean {
  return obbCorners(box).every((c) => c.x >= 0 && c.y >= 0 && c.x <= ARENA_SIZE && c.y <= ARENA_SIZE);
}

// =============================================================================================
// Words (French)
// =============================================================================================

/** Match time as the referee writes it: 62.37 -> « 1:02,3 » (tenths cut off, never rounded up; a decimal comma). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1).replace('.', ',')}`;
}

/** What the referee says in the console, once, on the tick it happens (the design's 6.4). */
export const SAY = {
  /** R18: a cube leaves the arena; the referee takes it off the field. */
  cubeOut: (n: number, time: string): string =>
    `Le cube ${n} sort du terrain à ${time}${NB}: vu de dessus, il passe au-dessus du cadre. L’arbitre l’enlève${NB}: il ne rapporte plus rien.`,
  /** R19: the robot leaves the arena. */
  robotOut: (time: string): string => `Faute à ${time}${NB}: le robot sort du terrain (vu de dessus, il passe au-dessus du cadre). -${VIOLATION_POINTS}${NB}points.`,
  /** A cube that rested on another one has come down (pushed off, or the cube under it was taken away). */
  fell: (n: number, from: number): string => `Le cube ${n} est tombé du cube ${from}.`,
} as const;

/** The detail of a cube's line on the score sheet (the design's 6.3), in the present tense: the sheet "if the match ended now". */
export const SHEET = {
  /** a */
  held: 'Dans la pince du robot.',
  /** b */
  coversTouchesRobot: (w: WarehouseId): string => `Couvre l’entrepôt ${w}, mais touche le robot.`,
  /** c: valid by (1) */
  covers: (w: WarehouseId): string => `Couvre tout l’entrepôt ${w} et touche le tapis.`,
  /** d */
  partly: (w: WarehouseId): string => `Couvre seulement une partie de l’entrepôt ${w}.`,
  /** e */
  inStorage: 'Dans la zone de stockage.',
  /** f */
  noWarehouse: 'Ne couvre aucun entrepôt.',
  /** g */
  onTouchesRobot: (m: number): string => `Posé sur le cube ${m}, mais touche le robot.`,
  /** h1 */
  onHeld: (m: number): string => `Posé sur le cube ${m}, que la pince tient.`,
  /** h2 */
  onInStorage: (m: number): string => `Dans la zone de stockage, sur le cube ${m}.`,
  /** h3 */
  third: (w: WarehouseId): string => `Troisième cube de la pile de l’entrepôt ${w}${NB}: un entrepôt compte au plus deux cubes valides.`,
  /** h4 */
  onRobotTouched: (m: number): string => `Posé sur le cube ${m}, qui touche le robot.`,
  /** h5 */
  onNotCovering: (m: number): string => `Posé sur le cube ${m}, qui ne couvre pas tout un entrepôt.`,
  /** h6 */
  onNotCounting: (m: number): string => `Posé sur le cube ${m}, qui ne compte pas.`,
  /** i */
  touchesOther: (m: number, other: number): string => `Posé sur le cube ${m}, mais touche aussi le cube ${other}.`,
  /** j */
  alreadyTwo: (w: WarehouseId): string => `Déjà deux cubes valides dans l’entrepôt ${w}.`,
  /** k: valid by (2) */
  onCovering: (m: number, w: WarehouseId): string => `Posé sur le cube ${m}, qui couvre tout l’entrepôt ${w}.`,
  /** l */
  lifted: 'Ne touche pas le tapis.',
  /** R18 */
  removed: (time: string): string => `Sorti du terrain à ${time}${NB}: l’arbitre l’a enlevé.`,
  /** (a guard: a cube neither on the field nor taken off by this referee - never in a match) */
  missing: 'Ce cube n’est pas sur le terrain.',
} as const;

/** The line of the faults (R19). */
export const FAULTS = {
  label: 'Robot sorti du terrain',
  none: 'Le robot est resté sur le terrain.',
  once: (time: string): string => `Une fois, à ${time}${NB}: -${VIOLATION_POINTS}${NB}points.`,
  many: (times: readonly string[]): string => `${times.length} fois (${times.join(`${NB}; `)})${NB}: -${VIOLATION_POINTS}${NB}points chacune.`,
} as const;

/** The label of a cube's line: « Cube 3 ». */
export const cubeLabel = (n: number): string => `Cube ${n}`;
/** The id of the faults' line. */
export const LINE_FAULTS = 'fautes';

// =============================================================================================
// The judgement of the cubes (a pure function of the field: the design's 6.3)
// =============================================================================================

/** The cases of the design's table 6.3 ('removed': R18; 'missing': a guard). */
export type CubeCase = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'i' | 'j' | 'k' | 'l' | 'removed' | 'missing';

export interface CubeJudgement {
  /** the cube's number, 1 - 10 */
  n: number;
  case: CubeCase;
  valid: boolean;
  /** the warehouse it counts for (valid), or the one its line names */
  warehouse: WarehouseId | null;
  /** the cube it rests on (cases g - k) */
  on: number | null;
  /** the line's detail */
  detail: string;
}

/** The field as the referee judges it: the cubes on it, what the claw holds, which cubes the robot touches, which cubes were taken off and when. */
export interface FieldView {
  cubes: readonly Body[];
  holding: string | null;
  touchesRobot: (cube: Body) => boolean;
  /** cube id -> match time (s) at which it left the arena */
  removed: ReadonlyMap<string, number>;
}

/** How many cubes are under a cube (0: it stands on the mat or is held); cubes resting on something that is not a cube count as 0. */
function levelOf(body: Body, byId: ReadonlyMap<string, Body>): number {
  let level = 0;
  let at: Body | undefined = body;
  const seen = new Set<string>();
  while (at && at.restingOn !== null && !seen.has(at.id)) {
    seen.add(at.id);
    at = byId.get(at.restingOn);
    if (at) level++;
  }
  return level;
}

/**
 * Judge every cube of the field (the design's 6.3), bottom-up: the cubes on the mat (and in the
 * claw) first, then those resting on them, and so on, each level in the order of the cube
 * numbers. Returns one judgement per cube 1 - 10, in that order.
 */
export function judgeCubes(field: FieldView): CubeJudgement[] {
  const byId = new Map<string, Body>();
  for (const c of field.cubes) byId.set(c.id, c);
  const order = [...field.cubes].sort((a, b) => levelOf(a, byId) - levelOf(b, byId) || (cubeNumber(a.id) ?? 0) - (cubeNumber(b.id) ?? 0));
  const judged = new Map<string, CubeJudgement>();
  const validIn = new Map<WarehouseId, number>();
  const count = (w: WarehouseId): void => {
    validIn.set(w, (validIn.get(w) ?? 0) + 1);
  };

  for (const c of order) {
    const n = cubeNumber(c.id) ?? 0;
    const result = (kind: CubeCase, detail: string, extra: Partial<Pick<CubeJudgement, 'valid' | 'warehouse' | 'on'>> = {}): CubeJudgement => {
      const j: CubeJudgement = { n, case: kind, valid: extra.valid ?? false, warehouse: extra.warehouse ?? null, on: extra.on ?? null, detail };
      judged.set(c.id, j);
      return j;
    };

    // ---- a: in the claw
    if (isHeld(c, field.holding)) {
      result('a', SHEET.held);
      continue;
    }

    // ---- on the mat: b - f
    if (standsOnMat(c, field.holding)) {
      const covered = coveredWarehouse(c);
      if (covered !== null) {
        if (field.touchesRobot(c)) result('b', SHEET.coversTouchesRobot(covered), { warehouse: covered });
        else {
          result('c', SHEET.covers(covered), { valid: true, warehouse: covered });
          count(covered);
        }
        continue;
      }
      const partly = overlappedWarehouse(c);
      if (partly !== null) result('d', SHEET.partly(partly), { warehouse: partly });
      else if (inStorage(c)) result('e', SHEET.inStorage);
      else result('f', SHEET.noWarehouse);
      continue;
    }

    // ---- on another cube: g - k
    const support = c.restingOn !== null ? byId.get(c.restingOn) : undefined;
    const under = support ? judged.get(support.id) : undefined;
    if (!support || !under) {
      // ---- l: lifted, not held, resting on nothing (a guard)
      result('l', SHEET.lifted);
      continue;
    }
    const m = under.n;
    if (field.touchesRobot(c)) {
      result('g', SHEET.onTouchesRobot(m), { on: m });
      continue;
    }
    if (under.case === 'a') {
      result('h1', SHEET.onHeld(m), { on: m });
      continue;
    }
    if (under.case === 'e') {
      result('h2', SHEET.onInStorage(m), { on: m });
      continue;
    }
    if (under.valid && under.case === 'k') {
      result('h3', SHEET.third(under.warehouse as WarehouseId), { on: m, warehouse: under.warehouse });
      continue;
    }
    if (under.case === 'b' || under.case === 'g') {
      result('h4', SHEET.onRobotTouched(m), { on: m });
      continue;
    }
    if (under.case === 'd' || under.case === 'f') {
      result('h5', SHEET.onNotCovering(m), { on: m });
      continue;
    }
    if (!(under.valid && under.case === 'c')) {
      result('h6', SHEET.onNotCounting(m), { on: m });
      continue;
    }
    // m is valid by (1): rule (2) - it touches no other cube (not m, not a cube resting on it: Q17)
    const w = under.warehouse as WarehouseId;
    let other: number | null = null;
    for (const p of field.cubes) {
      if (p.id === c.id || p.id === support.id || p.restingOn === c.id) continue;
      if (!cubesTouch(c, p)) continue;
      const k = cubeNumber(p.id) ?? 0;
      if (other === null || k < other) other = k;
    }
    if (other !== null) {
      result('i', SHEET.touchesOther(m, other), { on: m, warehouse: w });
      continue;
    }
    if ((validIn.get(w) ?? 0) >= MAX_PER_WAREHOUSE) {
      result('j', SHEET.alreadyTwo(w), { on: m, warehouse: w });
      continue;
    }
    result('k', SHEET.onCovering(m, w), { valid: true, on: m, warehouse: w });
    count(w);
  }

  return CUBE_NUMBERS.map((n) => {
    const id = cubeId(n);
    const j = judged.get(id);
    if (j) return j;
    const when = field.removed.get(id);
    if (when !== undefined) return { n, case: 'removed', valid: false, warehouse: null, on: null, detail: SHEET.removed(clock(when)) };
    return { n, case: 'missing', valid: false, warehouse: null, on: null, detail: SHEET.missing };
  });
}

// =============================================================================================
// The referee
// =============================================================================================

/** What the referee remembers of a cube from the last tick (to see a cube come down from another one). */
interface Seen {
  restingOn: string | null;
  held: boolean;
}

export interface LogistiqueReferee extends Referee<LogistiqueScenario> {
  /** The times (s) at which the robot left the arena (R19), in order. */
  faults(): readonly number[];
  /** The cubes taken off the field (R18): id -> the time (s) it left the arena. */
  removed(): ReadonlyMap<string, number>;
  /** The robot is out of the arena now (as of the referee's last look). */
  robotIsOut(): boolean;
  /** Every cube judged as the sheet would judge it now (after the end: as the match left the field). */
  judgements(ctx: ScoreContext<LogistiqueScenario>): CubeJudgement[];
}

function cubesOf(bodies: readonly Body[]): Body[] {
  return bodies.filter((b) => b.kind === KIND_CUBE);
}

function createReferee(_scenario: LogistiqueScenario): LogistiqueReferee {
  /** R18: the cubes taken off the field, and when */
  const removed = new Map<string, number>();
  /** R19: the times the robot went out */
  const faults: number[] = [];
  /** the robot is out of the arena (from its going out until every corner is back inside) */
  let out = false;
  /** each cube's support and grip as of the last look (null: not looked yet) */
  let seen: Map<string, Seen> | null = null;
  /** the match is over: from now on the sheet is final and judges the field kept in `final` */
  let over = false;
  let final: FieldView | null = null;
  let endTime: number | null = null;

  function remember(bodies: readonly Body[], holding: string | null): void {
    const next = new Map<string, Seen>();
    for (const c of cubesOf(bodies)) next.set(c.id, { restingOn: c.restingOn, held: isHeld(c, holding) });
    seen = next;
  }

  /** The match starts: the field as the team left it (the cubes on the cross). */
  function begin(ctx: ScoreContext<LogistiqueScenario>): void {
    remember(ctx.world.bodies, ctx.world.robot.gripper.holding);
  }

  function observe(ctx: ScoreContext<LogistiqueScenario>): RefereeCall | null {
    const world = ctx.world;
    const time = world.time;
    const holding = world.robot.gripper.holding;
    const say: string[] = [];
    const takeOff: string[] = [];
    const cubes = cubesOf(world.bodies);

    // ---- a cube that came down from the cube it rested on (pushed off, or the cube under it was taken away)
    if (seen === null) remember(world.bodies, holding);
    const before = seen as Map<string, Seen>;
    for (const c of cubes) {
      const was = before.get(c.id);
      // (`was.held` is a guard only: grab() clears restingOn of what it takes, so a cube held last tick rested on nothing)
      if (!was || was.restingOn === null || was.held || isHeld(c, holding) || c.restingOn === was.restingOn) continue;
      say.push(SAY.fell(cubeNumber(c.id) ?? 0, cubeNumber(was.restingOn) ?? 0));
    }

    // ---- R18: a cube (held or not) that leaves the arena is taken off the field
    for (const c of cubes) {
      if (removed.has(c.id) || !leavesArena(footprint(c))) continue;
      removed.set(c.id, time);
      takeOff.push(c.id);
      say.push(SAY.cubeOut(cubeNumber(c.id) ?? 0, clock(time)));
    }

    // ---- R19: the robot leaves the arena (once per exit, -20 at once)
    if (!out) {
      if (ctx.robotShapes.some(leavesArena)) {
        out = true;
        faults.push(time);
        say.push(SAY.robotOut(clock(time)));
      }
    } else if (ctx.robotShapes.every(insideArena)) {
      out = false;
    }

    remember(world.bodies, holding);
    if (say.length === 0 && takeOff.length === 0) return null;
    return takeOff.length > 0 ? { say, removeBodies: takeOff } : { say };
  }

  /** There are no restarts in this game (Game.restartRules: none allowed): nothing to forget. */
  function restart(): void {
    // (the engine never calls this: restartRules.maxRestarts is 0)
  }

  /** The match is over (Q7): keep the field as it is now, before the motors stop, and the completion time. */
  function finished(ctx: ScoreContext<LogistiqueScenario>): void {
    const cubes = cubesOf(ctx.world.bodies).map((c) => ({ ...c, home: { ...c.home } }));
    const touching = new Set(cubesOf(ctx.world.bodies).filter((c) => touchesRobot(c, ctx)).map((c) => c.id));
    final = { cubes, holding: ctx.world.robot.gripper.holding, touchesRobot: (c) => touching.has(c.id), removed: new Map(removed) };
    endTime = ctx.world.time;
    over = true;
  }

  function liveView(ctx: ScoreContext<LogistiqueScenario>): FieldView {
    return { cubes: cubesOf(ctx.world.bodies), holding: ctx.world.robot.gripper.holding, touchesRobot: (c) => touchesRobot(c, ctx), removed };
  }

  function judgements(ctx: ScoreContext<LogistiqueScenario>): CubeJudgement[] {
    return judgeCubes(over && final ? final : liveView(ctx));
  }

  function faultsDetail(): string {
    if (faults.length === 0) return FAULTS.none;
    if (faults.length === 1) return FAULTS.once(clock(faults[0]));
    return FAULTS.many(faults.map(clock));
  }

  function score(ctx: ScoreContext<LogistiqueScenario>): ScoreReport {
    const judged = judgements(ctx);
    const lines: ScoreLine[] = judged.map((j) => ({
      id: cubeId(j.n),
      label: cubeLabel(j.n),
      points: j.valid ? POINTS_PER_CUBE : 0,
      max: POINTS_PER_CUBE,
      ok: j.valid,
      detail: j.detail,
    }));
    const penalty = VIOLATION_POINTS * faults.length;
    lines.push({
      id: LINE_FAULTS,
      label: FAULTS.label,
      // (0, not -0, when the robot never left the arena)
      points: penalty === 0 ? 0 : -penalty,
      max: 0,
      ok: faults.length === 0,
      detail: faultsDetail(),
    });
    const valid = judged.filter((j) => j.valid).length;
    const total = Math.max(0, POINTS_PER_CUBE * valid - penalty);
    return { total, max: MAX_SCORE, lines, complete: valid === CUBE_COUNT, ...(over && endTime !== null ? { time: endTime } : {}) };
  }

  return {
    begin,
    observe,
    restart,
    finished,
    score,
    faults: () => faults,
    removed: () => removed,
    robotIsOut: () => out,
    judgements,
  };
}

// =============================================================================================
// The game
// =============================================================================================

export const logistiqueGame: Game<LogistiqueScenario> = {
  id: LOGISTIQUE_ID,
  title: LOGISTIQUE_GAME_TITLE,
  mat: {
    width: MAT_SIZE,
    height: MAT_SIZE,
    imageUrl: MAT_IMAGE_URL,
    sensorImageUrl: MAT_SENSOR_IMAGE_URL,
    vector: MAT_VECTOR,
  },
  matchDuration: MATCH_DURATION,
  startZone: START_AREA,
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
  // (during a match the referee below keeps the score; this is the sheet of the field as it is,
  // looked at once - at the start of a match: nothing earned yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: LOGISTIQUE_ROBOT,
  createWalls,
  createReferee,
  // RULE p. 15/11: "teams are not allowed to restart or modify their robot".
  restartRules: { maxRestarts: 0 },
};

export { createReferee as createLogistiqueReferee };
