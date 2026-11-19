/**
 * MakeX Lebanon, Season 2026 - Capelli Starter "Locker Room" (ages 13-15): the field.
 *
 * Every measure of the mat and of the things on it is in this one file. Each number says where it
 * comes from:
 *   MEASURED  on the vectors of the print file "Capelli-Starter_1235mm.idml" (an InDesign file: one
 *             page of 3500.787 pt = exactly 1235 mm, 1 pt = 25.4 / 72 mm; numbers rounded to
 *             0.01 mm). field.test.ts holds the print file's own numbers in points and checks
 *             every shape here against them.
 *   PICTURE   the print file only LINKS its pictures (the Locker Room and coach-approval art, the
 *             three zone pictures, the centre picture, the logos); the files are not in it. Their
 *             look and average colours come from the organiser's own render of the whole mat (the
 *             published rules v2.3, page 2: 0.488 px per mm; it lies within 1.2 mm of the vectors
 *             everywhere), cut out at the frames of the print file.
 *   RULE      the organiser's latest rules ("Starter - Locker Room Mission", 150 s).
 *   ASSUMPTION  nothing says it; the comment says why the simulator chose this number.
 *
 * The colours are the ones of that render: the print file has CMYK colours only, and the render
 * is how the organiser's own software turned them into screen colours.
 *
 * Everything is in millimetres, origin at the top-left corner of the mat, +x to the right, +y
 * DOWN (as in the print file and in the other games).
 *
 *     +=========[ MakeX ]=========+    === the yellow band (a gap in the middle of the top and
 *     | <red>    [cyan]   <green> |        of the bottom edge)
 *     |   \T       _T_      T/    |    <red> [cyan] <green>  the three rectangles at the top: the
 *     |    \_______|_______/      |        WAREHOUSES, the targets of the tokens (two of them turned)
 *     |  C  |      |       |   (RED)   T   a line with a T-end
 *     |  B  Y--+---+---+   |      |    (RED)  the big red circle, (GREEN) the big green one
 *     |  A  |  | [r] o [g]  |  \  |    A, B, C  the three distribution zones (pictures)
 *     |     Y--+--------+     \   |    Y   the yellow pieces in the long line on the left
 *     |     |  :gate: (GREEN)  |  |    [r] [g]  the small squares in the maze: the PICKUP ZONES,
 *     | [LOCKER]--------------[SCAN]       where the team cubes start; o the blue disc (a picture)
 *     +==========[      ]==========+    :gate:  the dotted rectangle where the stadium gate stands
 *                                       LOCKER  the start zone, SCAN  the Scan Station
 *
 * Plain TypeScript, no DOM.
 */
import { TABLE_MARGIN } from '../core/engine';
import { obbCorners, type OBB, type Rect, type Vec2 } from '../core/geometry';
import type { MatLayer, MatVector, RGB } from '../core/types';
import { LOGO_LETTER_OUTLINES } from '../warehouse-sort/sponsor-logo';

// =============================================================================================
// The mat
// =============================================================================================

/** MEASURED: the page of the print file is 3500.787 pt = 1235 mm square. */
export const MAT_SIZE = 1235;
/** The page in points (InDesign keeps it to 12 digits: 1235 mm / 25.4 x 72). */
export const PAGE_PT = 3500.787401574803;
/** One point of the print file in mm (= 25.4 / 72). */
export const MM_PER_PT = MAT_SIZE / PAGE_PT;

export const MAT_IMAGE_URL = '/simulator/locker-room/mat.webp';
export const MAT_SENSOR_IMAGE_URL = '/simulator/locker-room/mat-sensor.webp';

/**
 * ASSUMPTION: the mat lies on a table that goes on 100 mm on every side; at its edge the robot
 * and the cubes stop. The rules have no walls; this is the engine's own table strip, the same as
 * in Warehouse Sort (core/engine.ts TABLE_MARGIN).
 */
export const TABLE_STRIP = TABLE_MARGIN;

/** The whole mat as a rectangle. */
export const MAT_RECT: Rect = { x: 0, y: 0, w: MAT_SIZE, h: MAT_SIZE };

// =============================================================================================
// Colours (the organiser's render of the mat, rules v2.3 page 2)
// =============================================================================================

/** The ground: InDesign's "Black" (in the render 35, 31, 32 - the same as on the Inspire mat). */
export const GROUND: RGB = { r: 35, g: 31, b: 32 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };
/** The yellow band, the yellow pieces of the long line, the frames, the gate's dotted line (C0 M0 Y100). */
export const YELLOW: RGB = { r: 255, g: 241, b: 0 };
/** The red shapes and the big red circle (C0 M90 Y75). */
export const RED: RGB = { r: 240, g: 63, b: 69 };
/** The green shapes and the big green circle (C75 M5 Y100). */
export const GREEN: RGB = { r: 61, g: 174, b: 72 };
/** The light-blue rectangle at the top (C100: the sky blue of the MakeX mats, which the sensors name "blue"). */
export const CYAN: RGB = { r: 0, g: 173, b: 238 };
/** The letters of the Capelli logos on the two big circles (the render: as dark as the ground). */
export const LOGO_BLACK: RGB = { r: 35, g: 31, b: 32 };
/** Off the mat: the table (the same grey as in the other games). */
const TABLE: RGB = { r: 120, g: 120, b: 120 };

/**
 * PICTURE: the average colour of each picture, measured on the 4 px/mm render the mat pictures
 * are made from, over the part of the picture that is not covered by something printed on top.
 * The vector mat (tests, headless runs) shows each picture as this one flat colour; on the screen
 * the floor sensors read the picture itself. Brightness (0..100) and the share of the picture's
 * pixels that are brighter than the line border of this robot (70):
 *
 *   Locker Room art        26.0    6.0 %  read "line" (the silver ring and letters)
 *   glow of the Scan Station 21.5  1.3 %
 *   coach-approval badge   37.0    7.6 %
 *   zone A picture         21.3    0 %    (dark red: its average reads "red")
 *   zone B picture         50.9   30.6 %  (a blue badge on a white square)
 *   zone C picture         39.4    1.2 %
 *   blue disc in the maze  55.0   25.0 %  (white sports icons on blue: its average reads "blue")
 *
 * Every average is darker than 70: the vector says "background" over every picture, which is what
 * most of each picture says. A program that follows a line over a picture can differ from the
 * screen there (field.test.ts and the measuring note give the agreement region by region).
 */
export const PICTURE_COLORS = {
  lockerArt: { r: 59, g: 69, b: 71 } as RGB,
  scanGlow: { r: 57, g: 55, b: 50 } as RGB,
  coachBadge: { r: 90, g: 94, b: 107 } as RGB,
  zoneA: { r: 83, g: 42, b: 42 } as RGB,
  zoneB: { r: 115, g: 132, b: 158 } as RGB,
  zoneC: { r: 81, g: 115, b: 76 } as RGB,
  blueDisc: { r: 83, g: 159, b: 196 } as RGB,
};

// =============================================================================================
// The yellow band along the edge (printed only)
// =============================================================================================

/**
 * MEASURED: the yellow band, 20 mm wide (19.86 mm at the bottom left), with a gap in the middle of
 * the top edge (x 484.53 to 759.34) and of the bottom edge (x 483.77 to 749.74 - not quite the same
 * gap). The pieces that run off the page are cut at the edge of the mat. The left and right
 * pieces are covered by the Locker Room and the Scan Station where those are; the bottom pieces
 * are printed over them.
 */
export const YELLOW_BANDS = {
  topLeft: { x: 3.67, y: 0, w: 480.86, h: 20 },
  topRight: { x: 759.34, y: 0, w: 475.66, h: 20 },
  left: { x: 0, y: 0, w: 20, h: 1235 },
  right: { x: 1215, y: 0, w: 20, h: 1235 },
  bottomLeft: { x: 2.91, y: 1215.14, w: 480.86, h: 19.86 },
} satisfies Record<string, Rect>;
/** MEASURED: the bottom right piece is a little slanted (its left end is 1 mm further right at the bottom). */
export const BAND_BOTTOM_RIGHT: readonly Vec2[] = [
  { x: 749.74, y: 1215 },
  { x: 1230.6, y: 1215 },
  { x: 1231.62, y: 1235 },
  { x: 750.76, y: 1235 },
];

// =============================================================================================
// The white lines (for line following: white on black, as in Warehouse Sort)
// =============================================================================================

/** MEASURED: the white lines are 26.19 mm wide (74.24 pt); three pieces are 25.63, 26.57 and 26.63 mm. */
export const LINE_WIDTH = 26.19;

/**
 * MEASURED: every white line that is a rectangle along the edges of the mat, one filled rectangle
 * each, as the print file has them (where two meet they overlap).
 *
 *   the maze      a square of lines (x 446.2 to 785.63, y 445.43 to 785.23) with a short stub
 *                 through its left and its right side at half height (36.7 mm on each side)
 *   the long line left of the maze (x 235.7 to 261.9, y 408.76 to 822.42) in three white pieces
 *                 with the two yellow pieces between them (YELLOW_PIECES), joined to the maze by
 *                 three lines (top, middle, bottom)
 *   the tree      up from the middle of the maze's top to the cross line (y 304.62 to 330.81), on
 *                 up to a T-end (y 225.8 to 251.99) under the light-blue rectangle; turned lines
 *                 and T-ends to the top left and the top right: TURNED_LINES
 *   the way to the Scan Station: from the maze's right stub to the right, a turned line down to the
 *                 right (TURNED_LINES.rightDiagonal), then down into the Scan Station
 *   the bottom line from the Locker Room (it starts 13 mm inside its frame) to the Scan Station
 */
export const WHITE_LINES = {
  // ---- the maze
  mazeTop: { x: 446.2, y: 445.43, w: 339.43, h: 26.19 },
  mazeLeft: { x: 446.2, y: 453.66, w: 26.19, h: 320.05 },
  mazeRight: { x: 759.43, y: 445.43, w: 26.19, h: 339.43 },
  mazeBottom: { x: 446.2, y: 759.04, w: 339.43, h: 26.19 },
  mazeStubRight: { x: 722.77, y: 602.05, w: 99.52, h: 26.19 },
  mazeStubLeft: { x: 409.53, y: 602.05, w: 99.52, h: 26.19 },
  // ---- the long line on the left of the maze, and the three lines that join it to the maze
  linkBottom: { x: 257.11, y: 759.2, w: 214.39, h: 26.19 },
  longBottom: { x: 236.09, y: 722.9, w: 25.63, h: 99.52 },
  linkMiddle: { x: 257.48, y: 602.05, w: 214.38, h: 26.63 },
  longMiddle: { x: 236.09, y: 565.83, w: 25.63, h: 99.52 },
  linkTop: { x: 257.48, y: 445.43, w: 214.38, h: 26.19 },
  longTop: { x: 235.67, y: 408.76, w: 26.19, h: 99.52 },
  // ---- the tree above the maze
  treeTopT: { x: 569.99, y: 225.8, w: 99.52, h: 26.19 },
  crossLeft: { x: 315.96, y: 304.62, w: 305.21, h: 26.19 },
  crossRight: { x: 608.47, y: 304.62, w: 305.21, h: 26.19 },
  treeUpper: { x: 606.62, y: 248.06, w: 26.19, h: 148.33 },
  treeLower: { x: 606.26, y: 317.47, w: 26.19, h: 150.4 },
  // ---- the bottom line, and the way down from the maze to the Scan Station
  bottom: { x: 227.71, y: 1095.05, w: 775.82, h: 26.19 },
  rightLink: { x: 805.03, y: 602.05, w: 146.67, h: 26.57 },
  rightDown: { x: 1097.54, y: 776.14, w: 26.64, h: 233.26 },
} satisfies Record<string, Rect>;

export type WhiteLineId = keyof typeof WHITE_LINES;

/**
 * MEASURED: the white lines that are turned by 45 degrees, as their four corners: the two lines
 * of the tree to the top left and the top right with the T-ends at their ends, and the line from
 * the maze down to the right towards the Scan Station.
 */
export const TURNED_LINES = {
  treeLeftT: [
    { x: 166.55, y: 231.93 },
    { x: 185.07, y: 250.45 },
    { x: 255.44, y: 180.07 },
    { x: 236.92, y: 161.55 },
  ],
  treeLeftDiagonal: [
    { x: 227.74, y: 206.31 },
    { x: 209.22, y: 224.82 },
    { x: 315.56, y: 331.17 },
    { x: 334.08, y: 312.65 },
  ],
  treeRightT: [
    { x: 1062.38, y: 231.56 },
    { x: 1043.86, y: 250.08 },
    { x: 973.48, y: 179.71 },
    { x: 992.0, y: 161.19 },
  ],
  treeRightDiagonal: [
    { x: 1001.19, y: 205.94 },
    { x: 1019.71, y: 224.46 },
    { x: 913.36, y: 330.81 },
    { x: 894.84, y: 312.29 },
  ],
  rightDiagonal: [
    { x: 952.2, y: 603.23 },
    { x: 933.68, y: 621.75 },
    { x: 1105.65, y: 793.72 },
    { x: 1124.17, y: 775.2 },
  ],
} satisfies Record<string, readonly Vec2[]>;

/**
 * MEASURED: the two YELLOW pieces of the long line (y 507.61 to 566.28 and 665.05 to 723.72), printed
 * over its white pieces. The rules give them no role: they are printed only. The floor sensors see
 * them as yellow - and as "line": yellow is brighter than the robot's line border (robot.ts).
 */
export const YELLOW_PIECES = {
  upper: { x: 235.75, y: 507.61, w: 26.19, h: 58.67 },
  lower: { x: 235.75, y: 665.05, w: 26.19, h: 58.67 },
} satisfies Record<string, Rect>;

/** The middle of the bottom line (y, mm): the robot starts on it, facing along it. */
export const BOTTOM_LINE_Y = WHITE_LINES.bottom.y + WHITE_LINES.bottom.h / 2;
/** The middle of the line down into the Scan Station (x, mm). */
export const RIGHT_DOWN_X = WHITE_LINES.rightDown.x + WHITE_LINES.rightDown.w / 2;

// =============================================================================================
// The Locker Room (start zone, rules §2.1) and the Scan Station (rules §2.2)
// =============================================================================================

/** MEASURED: the frames of both are 34 pt = 11.99 mm wide, yellow, centred on their rectangle (as InDesign draws a stroke). */
export const FRAME_WIDTH = 11.99;

/**
 * MEASURED: the Locker Room, bottom left: a picture ("Capelli Locker Room Robotic Mission") that
 * fills a square of 248.01 mm with a YELLOW frame (the print file's stroke colour is C0 M0 Y100; the
 * render shows it yellow). This is the middle of the frame; its left and bottom sides lie off the
 * mat.
 */
export const LOCKER_ROOM_FRAME: Rect = { x: -1.16, y: 987.36, w: 248.01, h: 248.01 };
/**
 * The Locker Room as the simulator counts it: everything inside the OUTER edge of the frame, to the
 * left and the bottom edge of the mat - 252.84 x 253.64 mm. (The rules do not say whether the frame
 * belongs to the zone. Inside the frame there are only 236.01 mm, less than the 237 mm of the
 * robot with its open claw: the frame must belong to it, or the robot could only start turned.)
 */
export const LOCKER_ROOM: Rect = {
  x: 0,
  y: LOCKER_ROOM_FRAME.y - FRAME_WIDTH / 2,
  w: LOCKER_ROOM_FRAME.x + LOCKER_ROOM_FRAME.w + FRAME_WIDTH / 2,
  h: MAT_SIZE - (LOCKER_ROOM_FRAME.y - FRAME_WIDTH / 2),
};

/**
 * MEASURED: the Scan Station ("Coach approval"), bottom right: a square of 248.01 mm with the same
 * yellow frame, filled with a round glow (white in its middle, black from 116.7 mm out) under the
 * coach-approval badge. The middle of its frame; its right and bottom sides lie off the mat.
 */
export const SCAN_STATION_FRAME: Rect = { x: 988.28, y: 988.95, w: 248.01, h: 248.01 };
/** The Scan Station as the simulator counts it: inside the outer edge of its frame, to the edges of the mat (252.72 x 252.04 mm). */
export const SCAN_STATION: Rect = {
  x: SCAN_STATION_FRAME.x - FRAME_WIDTH / 2,
  y: SCAN_STATION_FRAME.y - FRAME_WIDTH / 2,
  w: MAT_SIZE - (SCAN_STATION_FRAME.x - FRAME_WIDTH / 2),
  h: MAT_SIZE - (SCAN_STATION_FRAME.y - FRAME_WIDTH / 2),
};

/** A circle: middle and radius (mm). */
export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

/**
 * PICTURE: the coach-approval badge is round and fills its picture frame (x 1015.63 to 1205.63,
 * y 1015.04 to 1204.73): the circle inside that frame.
 */
export const COACH_BADGE: Circle = { cx: 1110.63, cy: 1109.89, r: 94.84 };

/**
 * MEASURED, NOT ON THE MAT: two small orange squares (39.81 mm in a yellow square of 41.9 mm), one
 * in the top left corner of the Locker Room and one in the top right corner of the Scan Station.
 * The print file paints them BEFORE (under) the Locker Room picture and the Scan Station's glow,
 * which cover them completely, and the organiser's render does not show them. So the simulator
 * does not show them either. Kept here in case the organiser says they are printed (the README
 * asks): they are where a cube or the Team Box could stand.
 */
export const HIDDEN_ORANGE_SQUARES = {
  lockerRoom: { outline: { x: 29.45, y: 996.42, w: 41.9, h: 41.9 }, square: { x: 30.5, y: 997.47, w: 39.81, h: 39.81 } },
  scanStation: { outline: { x: 1163.29, y: 996.07, w: 41.9, h: 41.9 }, square: { x: 1164.34, y: 997.11, w: 39.81, h: 39.81 } },
} satisfies Record<string, { outline: Rect; square: Rect }>;

// =============================================================================================
// The big delivery circles (rules §2.3)
// =============================================================================================

/** The colour of a team: RED or GREEN (rules §3.1). */
export type TeamColor = 'red' | 'green';
export const TEAM_COLORS: TeamColor[] = ['red', 'green'];

/**
 * MEASURED: the big RED circle on the right (206.94 mm across) and the big GREEN circle in the lower
 * middle (208.47 mm across, with a 3 pt green outline: 209.53 mm as printed). Each has a Capelli
 * logo (LOGOS). "RED cubes go here", "GREEN cubes go here".
 */
export const BIG_CIRCLES: Record<TeamColor, Circle> = {
  red: { cx: 1107.71, cy: 505.32, r: 103.47 },
  green: { cx: 623.58, cy: 933.21, r: 104.76 },
};

// =============================================================================================
// The coloured marks, and WHICH ONE IS A PICKUP ZONE AND WHICH ONE IS A TARGET
// =============================================================================================

/** The marks on the mat that a cube can start on or be delivered to. */
export type MarkId = 'redDiamond' | 'greenDiamond' | 'cyanRect' | 'redSquare' | 'greenSquare' | 'blueDisc';
export type MarkColor = 'red' | 'green' | 'blue';
export const MARK_IDS: readonly MarkId[] = ['redDiamond', 'greenDiamond', 'cyanRect', 'redSquare', 'greenSquare', 'blueDisc'];

export interface Mark {
  id: MarkId;
  /** what the mark looks like and where it is, in plain words (for texts) */
  name: string;
  /** only where it is, in plain words: "at the top left" (for texts that name the mark by its role) */
  place: string;
  color: MarkColor;
  /** a rectangle (perhaps turned) ... */
  box?: OBB;
  /** ... or a circle */
  circle?: Circle;
}

/**
 * MEASURED: every coloured mark.
 *   redDiamond, greenDiamond  the red and the green rectangle at the top left and the top right:
 *                 104.76 x 62.86 mm, turned by 45 degrees (they look like diamonds)
 *   cyanRect      the light-blue rectangle at the top in the middle, the same size, not turned (the
 *                 rules call it BLUE: the sensors name this sky blue "blue")
 *   redSquare, greenSquare  the small red and green squares in the maze, above and below its
 *                 middle: 41.9 mm (an outer and an inner square of the same colour)
 *   blueDisc      PICTURE: the round blue picture in the middle of the maze; it fills its frame of
 *                 136.25 mm (the render: light blue to 62 mm from its middle, a dark blue rim to
 *                 68 to 69 mm, the frame cuts it at 68.13 mm)
 */
export const MARKS: Record<MarkId, Mark> = {
  redDiamond: { id: 'redDiamond', name: 'the red rectangle at the top left', place: 'at the top left', color: 'red', box: { x: 130.82, y: 118.54, w: 62.86, l: 104.76, angle: Math.PI / 4 } },
  greenDiamond: { id: 'greenDiamond', name: 'the green rectangle at the top right', place: 'at the top right', color: 'green', box: { x: 1102.45, y: 118.91, w: 62.86, l: 104.76, angle: -Math.PI / 4 } },
  cyanRect: { id: 'cyanRect', name: 'the light-blue rectangle at the top', place: 'at the top in the middle', color: 'blue', box: { x: 621.17, y: 118.54, w: 104.76, l: 62.86, angle: 0 } },
  redSquare: { id: 'redSquare', name: 'the red square in the maze', place: 'in the maze', color: 'red', box: { x: 621.88, y: 506.43, w: 41.9, l: 41.9, angle: 0 } },
  greenSquare: { id: 'greenSquare', name: 'the green square in the maze', place: 'in the maze', color: 'green', box: { x: 621.88, y: 723.25, w: 41.9, l: 41.9, angle: 0 } },
  blueDisc: { id: 'blueDisc', name: 'the blue disc in the maze', place: 'in the middle of the maze', color: 'blue', circle: { cx: 618.43, cy: 615.14, r: 68.13 } },
};

/**
 * THE ONE TABLE OF THE QUESTION "WHICH MARK IS WHAT" - everything else (where the cubes start,
 * which mark the referee judges, the screen's highlights, the texts) reads it from here.
 *
 *   pickup   where the cube of each team colour stands at the start (rules §3.1 "which pickup zone
 *            to visit", §5 Step 5 "go to the RED pickup zone, get the RED cube")
 *   target   where the token of each colour goes (rules §2.6, §5 Step 7) - the organiser calls the
 *            targets "warehouses" (ROLE_WORD)
 *
 * DECIDED BY THE ORGANISER. This was the first question: the older rules v2.3 said both "RED
 * pickup zone (top-left)" and "the cube located in the center zone on the matching RED or GREEN
 * square". The organiser wrote: "red and green that robot should place in the circles should be
 * placed in the squares in center, the warehouses are on the top of the map". So the team cubes
 * start on the two small squares in the maze, and the tokens go to the three rectangles at the top
 * (red at the top left, light blue - the BLUE one - in the middle, green at the top right). The
 * blue disc has no role: it is a picture. The rest agrees: the rules call the targets "3 colored
 * target rectangles: RED, GREEN, and BLUE"; the three rectangles are of one size (104.76 x 62.86
 * mm) that holds the 50 mm cube (CUBE_SIZE), which a 41.9 mm square cannot; and the event photo
 * public/gallery/2026/locker-room/event-025.webp shows a red cube on the small red square early in
 * a match. The table can still be changed here: game.test.ts plays the earlier reading (team cubes
 * at the top, tokens to the squares and the disc) with it, and the referee and the screen follow.
 */
export const MARK_ROLES: {
  readonly pickup: Readonly<Record<TeamColor, MarkId>>;
  readonly target: Readonly<Record<MarkColor, MarkId>>;
} = {
  pickup: { red: 'redSquare', green: 'greenSquare' },
  target: { red: 'redDiamond', green: 'greenDiamond', blue: 'cyanRect' },
};

/** The words for the two roles in texts: the rules' "pickup zone", and the organiser's "warehouse" for a target. */
export const ROLE_WORD = { pickup: 'pickup zone', target: 'warehouse' } as const;

/** The pickup zone of a team colour (MARK_ROLES). */
export const pickupZone = (color: TeamColor): Mark => MARKS[MARK_ROLES.pickup[color]];
/** The target - the warehouse - of a token colour (MARK_ROLES). */
export const targetOf = (color: MarkColor): Mark => MARKS[MARK_ROLES.target[color]];
/** The marks that are neither a pickup zone nor a target (with the decided table: the blue disc). */
export const marksWithoutRole = (): Mark[] =>
  MARK_IDS.filter((id) => !Object.values(MARK_ROLES.pickup).includes(id) && !Object.values(MARK_ROLES.target).includes(id)).map((id) => MARKS[id]);

// =============================================================================================
// The distribution zones A, B, C (rules §2.5)
// =============================================================================================

export type ZoneId = 'A' | 'B' | 'C';
/** In the order of the rules (§3.2: "RED in A, GREEN in B, BLUE in C"). */
export const ZONE_IDS: ZoneId[] = ['A', 'B', 'C'];

/**
 * MEASURED: the three zone pictures on the left of the long line - A the LOWEST, B in the middle,
 * C at the top (confirmed by the organiser; the render of rules v2.3 shows them so). Each picture is
 * placed 2.82 mm to the right in its frame of 58.81 x 58.04 mm, so what shows is 55.99 x 57.69 mm:
 * that is the zone here. A token stands in the middle of it at the start.
 */
export const ZONES: Record<ZoneId, Rect> = {
  A: { x: 102.84, y: 747.48, w: 55.99, h: 57.69 },
  B: { x: 102.84, y: 582.18, w: 55.99, h: 57.69 },
  C: { x: 105.64, y: 429.05, w: 55.99, h: 57.69 },
};

// =============================================================================================
// The stadium gate (rules §2.4)
// =============================================================================================

/**
 * MEASURED: the dotted yellow rectangle left of the big green circle, where the gate stands (the
 * organiser confirmed it). This is the rectangle the dotted line draws (the middle of the line):
 * 57.69 x 86.56 mm. The line is 8 pt = 2.82 mm wide, in dashes of 12 pt = 4.23 mm with gaps as
 * long, spread evenly so that a dash sits on each corner (InDesign's "dashes and gaps" corners).
 */
export const GATE_MARK: Rect = { x: 430.45, y: 829.01, w: 57.69, h: 86.56 };
export const GATE_LINE_WIDTH = 2.82;
export const GATE_DASH = 4.23;
/**
 * ASSUMPTION: the gate ("a small yellow barrier") stands on its mark with the mark's footprint and
 * is 60 mm high: higher than the ultrasonic sensor's beam (35 mm), so the robot can see it, and
 * lower than the arm raised up (75 mm). The rules give no size.
 */
export const GATE_HEIGHT = 60;

// =============================================================================================
// The cubes and the tokens
// =============================================================================================

/**
 * MEASURED on the published "Inspire + Starter cube" (public/downloads/inspire-starter-cube-stl.zip,
 * one STL): a block of 50 x 50 mm, 70 mm high (71 mm with the 1 mm letters on its top), its edges
 * rounded by 3.5 mm. NOT the cube of Warehouse Sort, which assumes 40 mm (no file then): the
 * gripper takes it all the same (open 64 mm, closed 20 mm).
 */
export const CUBE_SIZE = 50;
/** MEASURED: 70 mm high (the 1 mm letters on top left out). */
export const CUBE_HEIGHT = 70;
/** ASSUMPTION: a cube is light (like Warehouse Sort's, mass 1): the robot can push it. */
export const CUBE_MASS = 1;

// =============================================================================================
// What rides on the robot and what the referee holds
// =============================================================================================

/**
 * ASSUMPTION (the rules give no size; the render of rules v2.3 shows an orange box about as wide as
 * the mBot2 on top of it): the Team Box is 90 mm across, 110 mm long and 80 mm high. It rides on top
 * of the robot (90 mm high), its middle 17.5 mm ahead of the axle - over the middle of the chassis,
 * so it does not reach beyond the robot's footprint (175 x 130 mm without the claw).
 */
export const TEAM_BOX = { w: 90, l: 110, h: 80, forward: 17.5 } as const;

/**
 * ASSUMPTION: the colour card ("the referee places a color cube (RED or GREEN) in front of the robot")
 * is a card of 60 x 100 mm that the referee holds upright, 2 mm thick, its face 5 mm beyond the tips
 * of the claw, in the middle in front of the robot, from the mat up: the colour sensor at the claw
 * reads it whether the arm is down or up (rangeMm in core/robot.ts: it sees 10 mm beyond the tips).
 */
export const CARD = { w: 60, thickness: 2, h: 100, gapToClaw: 5 } as const;

// =============================================================================================
// The pictures and the logos (decoration - but the floor sensors see them)
// =============================================================================================

/** PICTURE: the Locker Room art fills the inside of its frame (the picture is bigger than the frame and cut by it). */
export const LOCKER_ART: Rect = { x: 0, y: 987.36, w: 246.84, h: 247.64 };
/** PICTURE: the glow of the Scan Station fills the inside of its frame; the badge (COACH_BADGE) lies on it. */
export const SCAN_GLOW: Rect = { x: 988.28, y: 988.95, w: 246.72, h: 246.05 };
/**
 * PICTURE, NOT IN THE VECTOR MAT: the MakeX Lebanon logo at the top (x 535.45 to 711.45, y 23.57 to
 * 73.05: red and blue letters on the ground, in the gap of the yellow band). The vector mat shows the
 * ground there, as Warehouse Sort does; no line comes near it.
 */
export const MAKEX_LOGO: Rect = { x: 535.45, y: 23.57, w: 176, h: 49.48 };

/**
 * The Capelli logo on each big circle: in the print file a picture (not a vector), placed in these
 * boxes (MEASURED, the boxes of the picture). The simulator draws the logo's letters from the vector
 * outlines of the same logo on the Inspire mat (../warehouse-sort/sponsor-logo.ts), stretched from
 * the box around them (the "(R)" mark included) to these boxes: the letters measured on the render
 * lie within 1.3 mm of that. On the red circle the logo's frame (x up to 1190.45) cuts the "(R)" off.
 */
export const LOGO_BOXES: Record<TeamColor, Rect> = {
  red: { x: 1021.86, y: 485.48, w: 176, h: 55.56 },
  green: { x: 538.62, y: 906.4, w: 176, h: 53.62 },
};
/** MEASURED: the right edge of the red logo's frame. */
export const RED_LOGO_CLIP_X = 1190.45;

/** The outlines of the letters of one logo, in mm on this mat. */
function logoLetters(color: TeamColor): Vec2[][][] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const shape of LOGO_LETTER_OUTLINES) {
    for (const outline of shape) {
      for (let i = 0; i + 1 < outline.length; i += 2) {
        x0 = Math.min(x0, outline[i]);
        x1 = Math.max(x1, outline[i]);
        y0 = Math.min(y0, outline[i + 1]);
        y1 = Math.max(y1, outline[i + 1]);
      }
    }
  }
  const box = LOGO_BOXES[color];
  const sx = box.w / (x1 - x0);
  const sy = box.h / (y1 - y0);
  const shapes = LOGO_LETTER_OUTLINES.map((shape) =>
    shape.map((outline) => {
      const points: Vec2[] = [];
      for (let i = 0; i + 1 < outline.length; i += 2) points.push({ x: box.x + (outline[i] - x0) * sx, y: box.y + (outline[i + 1] - y0) * sy });
      return points;
    }),
  );
  // (on the red circle: the "(R)" lies wholly beyond the frame's edge, every letter wholly before it)
  return color === 'red' ? shapes.filter((shape) => shape.some((outline) => outline.some((p) => p.x < RED_LOGO_CLIP_X))) : shapes;
}

/** The letters of the two Capelli logos (outlines with holes, as LOGO_LETTER_OUTLINES). */
export const LOGOS: Record<TeamColor, readonly Vec2[][][]> = { red: logoLetters('red'), green: logoLetters('green') };

// =============================================================================================
// What the floor sensors see
// =============================================================================================

/** A closed outline of a circle with `count` corners (the sensors and the screen fill it). */
export function circleOutline(c: Circle, count = 72): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    out.push({ x: c.cx + c.r * Math.cos(a), y: c.cy + c.r * Math.sin(a) });
  }
  return out;
}

/** The corners of a mark that is a rectangle. */
export function markOutline(mark: Mark): Vec2[] {
  if (mark.circle) return circleOutline(mark.circle);
  return obbCorners(mark.box as OBB);
}

const rectLayer = (rect: Rect, color: RGB): MatLayer => ({ kind: 'rect', rect, color });
const polygonLayer = (outline: readonly Vec2[], color: RGB): MatLayer => ({ kind: 'polygon', contours: [[...outline]], color });

/** The four sides of a frame (stroke `width` centred on `rect`), as rectangles: its corners are square, as InDesign prints them. */
export function frameSides(rect: Rect, width: number): Rect[] {
  const h = width / 2;
  const x0 = rect.x - h;
  const y0 = rect.y - h;
  const x1 = rect.x + rect.w + h;
  const y1 = rect.y + rect.h + h;
  return [
    { x: x0, y: y0, w: x1 - x0, h: width },
    { x: x0, y: y1 - width, w: x1 - x0, h: width },
    { x: x0, y: y0, w: width, h: y1 - y0 },
    { x: x1 - width, y: y0, w: width, h: y1 - y0 },
  ];
}

/**
 * The dashes of the gate's dotted line, as rectangles: on each side n + 1 dashes of GATE_DASH,
 * evenly spaced with one on each corner (n = the side's length over a dash and a gap, rounded):
 * 8 on the short sides, 11 on the long ones, as on the mat.
 */
export function gateDashes(rect: Rect = GATE_MARK, width = GATE_LINE_WIDTH, dash = GATE_DASH): Rect[] {
  const out: Rect[] = [];
  const hw = width / 2;
  const sides: Array<[number, number, boolean, number]> = [
    [rect.x, rect.y, true, rect.w],
    [rect.x, rect.y + rect.h, true, rect.w],
    [rect.x, rect.y, false, rect.h],
    [rect.x + rect.w, rect.y, false, rect.h],
  ];
  for (const [sx, sy, along, length] of sides) {
    const n = Math.max(1, Math.round(length / (2 * dash)));
    for (let k = 0; k <= n; k++) {
      const t = (k * length) / n;
      const a = k === 0 ? -hw : Math.max(-hw, t - dash / 2);
      const b = k === n ? length + hw : Math.min(length + hw, t + dash / 2);
      out.push(along ? { x: sx + a, y: sy - hw, w: b - a, h: width } : { x: sx - hw, y: sy + a, w: width, h: b - a });
    }
  }
  return out;
}

/**
 * A purely geometric description of the mat: what the floor sensors see in headless runs and
 * tests, and on the screen until the picture has loaded. Layers are painted in the order of the
 * print file (back to front), where two of them overlap:
 *
 *   black ground; most white lines; the yellow pieces of the long line; the yellow band; the
 *   Locker Room art and its frame; the Scan Station's glow and its frame; the bottom line (over
 *   both frames); the coach-approval badge; the zone pictures; the rest of the white lines (the
 *   line down into the Scan Station over its frame); the three rectangles at the top; the blue
 *   disc; the small squares; the big circles and their logos; the gate's dashes; the bottom band
 *   (over both zones); the red circle's logo.
 *
 * The pictures are flat average colours (PICTURE_COLORS); the MakeX Lebanon logo is left out
 * (MAKEX_LOGO).
 */
export const MAT_VECTOR: MatVector = {
  width: MAT_SIZE,
  height: MAT_SIZE,
  background: GROUND,
  outside: TABLE,
  layers: [
    ...(['mazeTop', 'mazeLeft', 'mazeRight', 'mazeBottom', 'mazeStubRight', 'mazeStubLeft', 'linkBottom', 'longBottom', 'linkMiddle', 'longMiddle', 'linkTop', 'longTop'] as const).map(
      (id) => rectLayer(WHITE_LINES[id], WHITE),
    ),
    polygonLayer(TURNED_LINES.treeLeftT, WHITE),
    ...(['treeTopT', 'crossLeft', 'crossRight'] as const).map((id) => rectLayer(WHITE_LINES[id], WHITE)),
    rectLayer(YELLOW_PIECES.upper, YELLOW),
    rectLayer(YELLOW_PIECES.lower, YELLOW),
    ...(['topLeft', 'topRight', 'left', 'right'] as const).map((id) => rectLayer(YELLOW_BANDS[id], YELLOW)),
    rectLayer(LOCKER_ART, PICTURE_COLORS.lockerArt),
    ...frameSides(LOCKER_ROOM_FRAME, FRAME_WIDTH).map((side) => rectLayer(side, YELLOW)),
    rectLayer(SCAN_GLOW, PICTURE_COLORS.scanGlow),
    ...frameSides(SCAN_STATION_FRAME, FRAME_WIDTH).map((side) => rectLayer(side, YELLOW)),
    rectLayer(WHITE_LINES.bottom, WHITE),
    polygonLayer(circleOutline(COACH_BADGE), PICTURE_COLORS.coachBadge),
    rectLayer(ZONES.A, PICTURE_COLORS.zoneA),
    rectLayer(ZONES.B, PICTURE_COLORS.zoneB),
    rectLayer(ZONES.C, PICTURE_COLORS.zoneC),
    rectLayer(WHITE_LINES.rightLink, WHITE),
    polygonLayer(TURNED_LINES.rightDiagonal, WHITE),
    polygonLayer(TURNED_LINES.treeLeftDiagonal, WHITE),
    rectLayer(WHITE_LINES.treeUpper, WHITE),
    rectLayer(WHITE_LINES.rightDown, WHITE),
    rectLayer(WHITE_LINES.treeLower, WHITE),
    polygonLayer(markOutline(MARKS.redDiamond), RED),
    polygonLayer(markOutline(MARKS.greenDiamond), GREEN),
    polygonLayer(markOutline(MARKS.cyanRect), CYAN),
    polygonLayer(markOutline(MARKS.blueDisc), PICTURE_COLORS.blueDisc),
    polygonLayer(markOutline(MARKS.redSquare), RED),
    polygonLayer(markOutline(MARKS.greenSquare), GREEN),
    polygonLayer(circleOutline(BIG_CIRCLES.red), RED),
    polygonLayer(circleOutline(BIG_CIRCLES.green), GREEN),
    ...LOGOS.green.map((contours): MatLayer => ({ kind: 'polygon', contours, color: LOGO_BLACK })),
    ...gateDashes().map((dash) => rectLayer(dash, YELLOW)),
    polygonLayer(TURNED_LINES.treeRightT, WHITE),
    polygonLayer(TURNED_LINES.treeRightDiagonal, WHITE),
    rectLayer(YELLOW_BANDS.bottomLeft, YELLOW),
    polygonLayer(BAND_BOTTOM_RIGHT, YELLOW),
    ...LOGOS.red.map((contours): MatLayer => ({ kind: 'polygon', contours, color: LOGO_BLACK })),
  ],
};
