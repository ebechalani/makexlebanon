/**
 * MakeX Lebanon, Season 2027 - Fire Fighter (mBot2, ages 8-10): the field.
 *
 * Every measure of the mat and of the things on it is in this one file. Each number says where it
 * comes from:
 *   MEASURED  on the vectors of the organiser's print file "Fire_Fighter1250mm.pdf" (one page of
 *             3543.31 pt = 1250.001 mm, 1 pt = 25.4 / 72 mm; numbers to 0.001 mm). field.test.ts
 *             holds the print file's own numbers and checks every shape here against them.
 *   PICTURE   measured on the pictures of the print file, in a render of 4 px per mm: the average
 *             colours of the pictures, and the corner brackets of the squares the cubes stand on.
 *   RULE      the organiser's rules ("Fire Fighter - Fire City", Official Rules, ages 8-10).
 *   ORGANISER an answer of the organiser to a question the rules leave open.
 *   ASSUMPTION  nothing says it; the comment says why the simulator chose this number.
 *
 * Everything is in millimetres, origin at the top-left corner of the mat (the side with the MakeX
 * Lebanon logo is the top), +x to the right, +y DOWN (as in the print file and in the other games).
 *
 *   +--------------[ MakeX Lebanon logo ]--------------+
 *   | [E park]         (robot picture)      [K bakery] |    [E] [K] [M] [A]  the four corner
 *   |   T                                       T      |        pictures, each with its letter
 *   |   |      +========= top line ======+      |      |        tower; a stem with a T bar
 *   |   +------|            |            |------+      |        leads to each tower
 *   |          |            T            |             |    [X hydrant]  tower X in the middle,
 *   | [left]T--|       [X hydrant]       |--T[right]   |        reached from the top line only
 *   | [bay ]T--|                         |--T[bay  ]   |    [left bay] [right bay]  the pickup bays,
 *   |          |          [yellow]       |             |        two of the red cubes in each
 *   |   +------|             T           |------+      |    [yellow]  the yellow cube's red square
 *   |   |      |             |           |      |      |    [Fire Station]  the start; the bottom
 *   |   T      +====[ Fire Station ]=====+      T      |        line runs under its picture
 *   | [M school]                          [A hospital] |
 *   +--------------------------------------------------+
 *
 * Plain TypeScript, no DOM.
 */
import type { Rect, Vec2 } from '../core/geometry';
import type { MatLayer, MatVector, RGB } from '../core/types';

// =============================================================================================
// The mat
// =============================================================================================

/** MEASURED: the page of the print file is 3543.31 pt = 1250.001 mm square. */
export const MAT_SIZE = 1250;
/** One point of the print file in mm (1 pt = 1/72 inch). */
export const MM_PER_PT = 25.4 / 72;

export const MAT_IMAGE_URL = '/simulator/fire-fighter/mat.webp';
export const MAT_SENSOR_IMAGE_URL = '/simulator/fire-fighter/mat-sensor.webp';

/** The whole mat as a rectangle. */
export const MAT_RECT: Rect = { x: 0, y: 0, w: MAT_SIZE, h: MAT_SIZE };

// =============================================================================================
// Colours
// =============================================================================================

/** The mat: white paper (the print file paints no background). */
export const WHITE: RGB = { r: 255, g: 255, b: 255 };
/**
 * MEASURED: the black lines are CMYK K=1 (100 % black, printed over what is under it). As a screen
 * colour 35, 31, 32 (brightness 12.7) - the same black as Fire Rescue's lines.
 */
export const LINE_COLOR: RGB = { r: 35, g: 31, b: 32 };
/** Off the mat: the table (the same grey as in the other games). */
const TABLE: RGB = { r: 120, g: 120, b: 120 };

// =============================================================================================
// The pictures (rules §2: the Fire Station, the pickup bays, the five landmark tiles)
// =============================================================================================

export type TileId =
  | 'hydrant'
  | 'hospital'
  | 'bakery'
  | 'park'
  | 'school'
  | 'rightBay'
  | 'logo'
  | 'robotPicture'
  | 'fireStation'
  | 'leftBay'
  | 'yellowSquare';

/** The pictures in the order the print file paints them (its images /Im0 to /Im10). */
export const TILE_IDS: readonly TileId[] = ['hydrant', 'hospital', 'bakery', 'park', 'school', 'rightBay', 'logo', 'robotPicture', 'fireStation', 'leftBay', 'yellowSquare'];

const box = (x0: number, x1: number, y0: number, y1: number): Rect => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

/**
 * MEASURED: the clip box of each picture (what is visible of it). The five landmark tiles and the
 * Fire Station are 250 mm squares, the two bays 120 x 240 mm, the yellow cube's red-framed square
 * 100 mm. The right bay's picture is placed turned by 180 degrees (it is another drawing than the
 * left bay's, not a mirror). The logo and the robot picture are decorations with no role.
 */
export const TILES: Readonly<Record<TileId, Rect>> = {
  hydrant: box(509.384, 759.384, 499.642, 749.643),
  hospital: box(986.765, 1236.766, 989.985, 1239.985),
  bakery: box(985.354, 1235.354, 13.214, 263.214),
  park: box(12.7, 262.7, 13.214, 263.214),
  school: box(13.406, 263.406, 987.163, 1237.163),
  rightBay: box(1115.429, 1235.428, 507.112, 747.112),
  logo: box(532.745, 723.345, 13.214, 70.158),
  robotPicture: box(568.045, 688.045, 94.822, 214.822),
  fireStation: box(503.045, 753.045, 985.412, 1235.412),
  leftBay: box(13.468, 133.467, 515.514, 755.514),
  yellowSquare: box(583.833, 683.833, 772.058, 872.058),
};

/**
 * PICTURE: the average colour of the visible part of each picture (the black lines and white dashes
 * printed over it left out), on the 4 px/mm render the mat pictures are made from (each channel cut
 * to a whole number). The vector mat (tests, headless runs) shows each picture as this one flat
 * colour; on the screen the floor sensors read the picture itself. The brightness (0..100) of each
 * colour below, and the share of the picture itself that reads "line" for this robot (brightness
 * below 35) - every average reads "background":
 *
 *   park 52.7 (30.0 % "line")      bakery 54.4 (29.5 %)     school 59.8 (21.0 %)
 *   hospital 59.0 (26.7 %)         hydrant 58.0 (25.8 %)    Fire Station 52.2 (34.4 %)
 *   left bay 73.0 (15.4 %)         right bay 73.4 (10.5 %)  yellow square 74.2 (19.1 %)
 *   logo 79.5 (0 %)                robot picture 71.3 (27.8 %)
 *
 * So a line follower that crosses a picture can see dark drawing lines on the screen that the
 * vector mat does not have (field.test.ts gives the agreement).
 */
export const TILE_COLORS: Readonly<Record<TileId, RGB>> = {
  hydrant: { r: 172, g: 141, b: 121 },
  hospital: { r: 163, g: 147, b: 135 },
  bakery: { r: 176, g: 128, b: 97 },
  park: { r: 144, g: 139, b: 85 },
  school: { r: 174, g: 148, b: 119 },
  rightBay: { r: 215, g: 183, b: 136 },
  logo: { r: 232, g: 189, b: 196 },
  robotPicture: { r: 183, g: 181, b: 183 },
  fireStation: { r: 163, g: 124, b: 102 },
  leftBay: { r: 213, g: 182, b: 136 },
  yellowSquare: { r: 220, g: 179, b: 162 },
};

/** RULE §2.1, §3: the robot starts inside the Fire Station (the picture of the fire truck, bottom middle). */
export const FIRE_STATION: Rect = TILES.fireStation;
/** RULE §2.2: the "single red square above the Fire Station" of the yellow cube (the whole red-framed picture, 100 x 100 mm). */
export const YELLOW_SQUARE: Rect = TILES.yellowSquare;

// =============================================================================================
// The black lines
// =============================================================================================

/** MEASURED: every black line is 72 pt = 25.4 mm wide, a straight stroke with square ends. */
export const LINE_WIDTH = 25.4;

export type LineId =
  | 'B00' | 'B01' | 'B02' | 'B03' | 'B04' | 'B05' | 'B06' | 'B07' | 'B08' | 'B09' | 'B10' | 'B11' | 'B12' | 'B13' | 'B14' | 'B15'
  | 'B16' | 'B17' | 'B18' | 'B19' | 'B20' | 'B21' | 'B22' | 'B23' | 'B24' | 'B25' | 'B26' | 'B27' | 'B28' | 'B29' | 'B30' | 'B31';

const line = (x0: number, y0: number, x1: number, y1: number): readonly [Vec2, Vec2] => [
  { x: x0, y: y0 },
  { x: x1, y: y1 },
];

/**
 * MEASURED: the centre line of every black line, numbered in the order of the print file and drawn
 * in its direction (first point, last point):
 *
 *   B00 bakery branch          B08 park stem               B16 yellow T bar            B24 left bay, upper branch
 *   B01 right line, middle     B09 hospital branch         B17 hydrant stem            B25 left bay, upper T bar
 *   B02 left line, middle      B10 left line, bottom       B18 right bay, upper branch B26 Fire Station stem
 *   B03 left line, top         B11 hospital stem           B19 right bay, upper T bar  B27 M T bar
 *   B04 bakery stem            B12 bottom line             B20 right bay, lower branch B28 A T bar
 *   B05 top line               B13 right line, bottom      B21 right bay, lower T bar  B29 E T bar
 *   B06 right line, top        B14 school stem             B22 left bay, lower branch  B30 K T bar
 *   B07 park branch            B15 X T bar                 B23 left bay, lower T bar   B31 school branch
 *
 * The track: an outer loop (the left line x 380.633, the right line x 885.339, the top line y 248.748
 * and the bottom line y 1110.412, which runs UNDER the Fire Station picture from x 503.045 to
 * 753.045); branches from the left and the right line to the four corner towers and to the two bays;
 * the hydrant stem from the top line down to tower X; the Fire Station stem from the Fire Station up
 * to the yellow square. The corner stems, their T bars and the Fire Station stem are printed OVER the
 * pictures. The right bay's lower T bar lies 2.116 mm over the bay picture.
 */
export const LINES: Readonly<Record<LineId, readonly [Vec2, Vec2]>> = {
  B00: line(1113.299, 364.22, 885.339, 364.22),
  B01: line(885.339, 363.708, 885.339, 896.592),
  B02: line(380.633, 354.32, 380.633, 874.504),
  B03: line(380.633, 237.812, 380.633, 376.92),
  B04: line(1104.845, 193.512, 1104.845, 376.568),
  B05: line(885.339, 248.748, 367.933, 248.748),
  B06: line(885.339, 235.535, 885.339, 374.644),
  B07: line(385.013, 364.06, 122.313, 364.06),
  B08: line(129.939, 193.512, 129.939, 376.568),
  B09: line(1113.03, 884.405, 872.639, 884.405),
  B10: line(380.633, 1122.599, 380.633, 871.192),
  B11: line(1104.577, 1055.113, 1104.577, 872.058),
  B12: line(885.339, 1110.412, 384.691, 1110.412),
  B13: line(885.339, 1122.599, 885.339, 871.192),
  B14: line(129.67, 1055.113, 129.67, 872.058),
  B15: line(683.833, 486.943, 583.834, 486.943),
  B16: line(683.833, 903.314, 583.834, 903.314),
  B17: line(637.7, 474.243, 637.7, 261.448),
  B18: line(885.339, 563.707, 1090.029, 563.707),
  B19: line(1102.729, 594.412, 1102.729, 534.412),
  B20: line(885.339, 690.208, 1102.729, 690.208),
  B21: line(1104.845, 720.208, 1104.845, 660.208),
  B22: line(373.859, 698.214, 158.868, 698.214),
  B23: line(146.168, 668.214, 146.168, 728.214),
  B24: line(393.333, 572.418, 146.168, 572.418),
  B25: line(146.168, 542.418, 146.168, 602.418),
  B26: line(633.834, 1036.014, 633.834, 916.014),
  B27: line(179.939, 1048.714, 79.939, 1048.714),
  B28: line(1149.929, 1048.714, 1049.929, 1048.714),
  B29: line(179.939, 205.859, 79.939, 205.859),
  B30: line(1152.729, 202.122, 1052.729, 202.122),
  B31: line(373.859, 885.441, 133.468, 885.441),
};

/** The middle of the left line of the outer loop (x, mm). */
export const LEFT_LINE_X = LINES.B02[0].x;
/** The middle of the right line of the outer loop (x, mm). */
export const RIGHT_LINE_X = LINES.B01[0].x;
/** The middle of the top line (y, mm). */
export const TOP_LINE_Y = LINES.B05[0].y;
/** The middle of the bottom line (y, mm), which runs under the Fire Station picture. */
export const BOTTOM_LINE_Y = LINES.B12[0].y;
/** The middle of the Fire Station stem (x, mm): the robot starts on it. */
export const FIRE_STATION_STEM_X = LINES.B26[0].x;
/** The middle of the hydrant stem (x, mm): 3.867 mm right of the middle of tower X. */
export const HYDRANT_STEM_X = LINES.B17[0].x;

// =============================================================================================
// The letter towers (rules §2.3, §3, §5; the organiser's answers)
// =============================================================================================

/** The five letter towers, in the order of the rules' check table (§6). */
export type TowerId = 'M' | 'A' | 'K' | 'E' | 'X';
export const TOWER_IDS: readonly TowerId[] = ['M', 'A', 'K', 'E', 'X'];

/**
 * RULE §2.3 and ORGANISER ("M bottom left and then counter clockwise"; always the same, no draw):
 * the landmark each tower stands at, and where that is on the mat (the logo at the top).
 */
export const TOWER_NAMES: Readonly<Record<TowerId, string>> = { M: 'school', A: 'hospital', K: 'bakery', E: 'park', X: 'hydrant' };
export const TOWER_PLACES: Readonly<Record<TowerId, string>> = { M: 'bottom left', A: 'bottom right', K: 'top right', E: 'top left', X: 'middle' };

/**
 * ORGANISER: "Width 10.5 cm length 4 cm" - across the opening and along it. (The white dashed outline
 * of a tower is 104.894 mm wide between the centre lines of its dashes, and its two side marks are
 * 40.000 mm deep to their outer edge.)
 */
export const TOWER_WIDTH = 105;
export const TOWER_DEPTH = 40;
/**
 * ORGANISER: the space between the two side supports is "about 6 cm" - the width of the white
 * dashed square printed between the side marks (60.000 mm between the centre lines of its dashes).
 * A claw that holds a cube is 66 mm wide: it does not fit, so the robot lets go and pushes the cube
 * in (the organiser: as the simulator does).
 */
export const TOWER_GAP = 60;
/** Each side support is (105 - 60) / 2 = 22.5 mm thick: it follows from the two sizes above (ASSUMPTION: solid, the rules' photos show thin plates). */
export const SUPPORT_WIDTH = (TOWER_WIDTH - TOWER_GAP) / 2;
/** ORGANISER: "Tower height is 10 cm" (in the rules' photos the side plates are about 1.4 times as high as the 7 cm cube). */
export const TOWER_HEIGHT = 100;
/** ORGANISER: the towers "can slide". ASSUMPTION: each support is as light as a cube (light plywood), so a robot that bumps a tower slides it. */
export const TOWER_MASS = 1;

/** The heights of the drawn flap with the letter: from just above a cube (7 cm) to the top of the tower. */
export const FLAP_BOTTOM = 70;

/** MEASURED: the white dashes of the tower outlines are 14 pt = 4.939 mm wide. */
export const DASH_WIDTH = 14 * MM_PER_PT;

/**
 * MEASURED: the white dashed square in the middle of each tower outline, between the centre lines
 * of its dashes: 60.000 x 60.700 mm. ORGANISER: "the extra white is the square where the cube will be
 * posed (5x5cm) under the tower".
 */
export const DASHED_SQUARES: Readonly<Record<TowerId, Rect>> = {
  M: box(98.301, 158.301, 1084.635, 1145.335),
  A: box(1074.762, 1134.762, 1084.635, 1145.335),
  K: box(1072.645, 1132.645, 107.864, 168.564),
  E: box(99.856, 159.856, 107.864, 168.564),
  X: box(603.833, 663.833, 593.96, 654.66),
};

/**
 * MEASURED: the two dashed side marks of each outline (centre line of the dashes, 22.428 x 35.062 mm;
 * 40.000 mm deep to their outer edge), where the two side supports stand.
 */
export const SIDE_MARKS: Readonly<Record<TowerId, { readonly left: Rect; readonly right: Rect }>> = {
  M: { left: box(75.937, 98.365, 1097.434, 1132.495), right: box(158.404, 180.832, 1097.434, 1132.495) },
  A: { left: box(1052.398, 1074.826, 1097.434, 1132.495), right: box(1134.865, 1157.293, 1097.434, 1132.495) },
  K: { left: box(1050.281, 1072.709, 120.663, 155.724), right: box(1132.748, 1155.176, 120.663, 155.724) },
  E: { left: box(77.492, 99.919, 120.663, 155.724), right: box(159.958, 182.386, 120.663, 155.724) },
  X: { left: box(581.469, 603.897, 606.759, 641.821), right: box(663.936, 686.364, 606.759, 641.821) },
};

const middleOf = (r: Rect): Vec2 => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The middle of each white dashed square: where a cube that stands right in the middle of a tower stands. */
export const SQUARE_MIDDLES: Readonly<Record<TowerId, Vec2>> = {
  M: middleOf(DASHED_SQUARES.M),
  A: middleOf(DASHED_SQUARES.A),
  K: middleOf(DASHED_SQUARES.K),
  E: middleOf(DASHED_SQUARES.E),
  X: middleOf(DASHED_SQUARES.X),
};

/**
 * The middle of each tower's base (105 x 40 mm): across, the middle of its dashed square; along,
 * the middle of its side marks (0.020 mm from the middle of the square).
 */
export const TOWER_MIDDLES: Readonly<Record<TowerId, Vec2>> = {
  M: { x: SQUARE_MIDDLES.M.x, y: middleOf(SIDE_MARKS.M.left).y },
  A: { x: SQUARE_MIDDLES.A.x, y: middleOf(SIDE_MARKS.A.left).y },
  K: { x: SQUARE_MIDDLES.K.x, y: middleOf(SIDE_MARKS.K.left).y },
  E: { x: SQUARE_MIDDLES.E.x, y: middleOf(SIDE_MARKS.E.left).y },
  X: { x: SQUARE_MIDDLES.X.x, y: middleOf(SIDE_MARKS.X.left).y },
};

/** A tower's base (105 x 40 mm) on its outline, before anything moved it. */
export function towerBase(tower: TowerId): Rect {
  const m = TOWER_MIDDLES[tower];
  return { x: m.x - TOWER_WIDTH / 2, y: m.y - TOWER_DEPTH / 2, w: TOWER_WIDTH, h: TOWER_DEPTH };
}

/** The space between a tower's two supports (60 x 40 mm), before anything moved the tower. */
export function towerGap(tower: TowerId): Rect {
  const m = TOWER_MIDDLES[tower];
  return { x: m.x - TOWER_GAP / 2, y: m.y - TOWER_DEPTH / 2, w: TOWER_GAP, h: TOWER_DEPTH };
}

/** The middle of a support (x, y) at the start: its inner face on the edge of the dashed square's centre line. */
export function supportMiddle(tower: TowerId, side: 'left' | 'right'): Vec2 {
  const m = TOWER_MIDDLES[tower];
  const off = TOWER_GAP / 2 + SUPPORT_WIDTH / 2;
  return { x: m.x + (side === 'left' ? -off : off), y: m.y };
}

/**
 * THE LETTER AREA (ORGANISER: only when the whole cube is inside the white dashed square - "yes";
 * ASSUMPTION: measured to the outer edge of the dashes, question 4): a cube makes the letter show only
 * when its whole base is inside the white dashed square measured to the OUTER edge of its dashes,
 * 64.939 x 65.639 mm - the dashed line itself counts. (Its inner edge would leave 55.061 x 55.761 mm,
 * its centre line 60.000 x 60.700 mm.)
 */
export const LETTER_AREA: Readonly<Record<TowerId, Rect>> = {
  M: grow(DASHED_SQUARES.M, DASH_WIDTH / 2),
  A: grow(DASHED_SQUARES.A, DASH_WIDTH / 2),
  K: grow(DASHED_SQUARES.K, DASH_WIDTH / 2),
  E: grow(DASHED_SQUARES.E, DASH_WIDTH / 2),
  X: grow(DASHED_SQUARES.X, DASH_WIDTH / 2),
};

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/**
 * Which side of the mat each tower's opening faces (RULE §3: "The referee faces each tower opening
 * toward its track"). MEASURED: each corner stem ends at its T bar on the track's side of its outline,
 * so M and A open to the top and K and E to the bottom. ORGANISER: tower X opens "Up, toward the
 * hydrant line" - nothing joins X from below (the Fire Station stem ends under the yellow square).
 * The side of a tower away from its opening is its back.
 */
export type OpeningSide = 'top' | 'bottom';
export const OPENING: Readonly<Record<TowerId, OpeningSide>> = { M: 'top', A: 'top', K: 'bottom', E: 'bottom', X: 'top' };

/** The black line each tower is reached by (its stem) and the T bar at its end. */
export const TOWER_STEMS: Readonly<Record<TowerId, { readonly stem: LineId; readonly tBar: LineId }>> = {
  M: { stem: 'B14', tBar: 'B27' },
  A: { stem: 'B11', tBar: 'B28' },
  K: { stem: 'B04', tBar: 'B30' },
  E: { stem: 'B08', tBar: 'B29' },
  X: { stem: 'B17', tBar: 'B15' },
};

/** RULE §7.2: "The picture square is the whole printed landmark tile beneath that tower. The center X tower uses the hydrant picture square." */
export const PICTURE_SQUARES: Readonly<Record<TowerId, Rect>> = {
  M: TILES.school,
  A: TILES.hospital,
  K: TILES.bakery,
  E: TILES.park,
  X: TILES.hydrant,
};

// =============================================================================================
// The cubes (rules §2.2, §3)
// =============================================================================================

/** RULE §2.2: "Every cube has a 5 x 5 cm base and is 7 cm tall." */
export const CUBE_SIZE = 50;
export const CUBE_HEIGHT = 70;
/** ASSUMPTION: a light cube (as in Locker Room). */
export const CUBE_MASS = 1;

/** Where a cube starts: the four marked squares of the two pickup bays, and the yellow cube's red square. */
export type CubePlace = 'red-left-upper' | 'red-left-lower' | 'red-right-upper' | 'red-right-lower' | 'yellow';
export const CUBE_PLACES: readonly CubePlace[] = ['red-left-upper', 'red-left-lower', 'red-right-upper', 'red-right-lower', 'yellow'];

/**
 * PICTURE: the marked squares, as the boxes around the corner brackets printed in the pictures
 * (orange brackets in the bays, red ones on the yellow square). The squares of the right bay are
 * wider (70.6 mm) than those of the left bay (61 mm): the two bays are different drawings.
 */
export const CUBE_SQUARES: Readonly<Record<CubePlace, Rect>> = {
  'red-left-upper': box(33.628, 94.778, 541.354, 606.024),
  'red-left-lower': box(33.898, 94.778, 664.874, 729.534),
  'red-right-upper': box(1140.188, 1210.808, 528.352, 594.102),
  'red-right-lower': box(1140.188, 1210.668, 660.392, 725.872),
  yellow: box(595.793, 671.633, 792.388, 862.888),
};

/**
 * ASSUMPTION ("on the marked square", RULE §2.2, read as "in its middle"): each cube starts upright,
 * square to the mat, with its middle on the middle of its marked square. The yellow cube then stands
 * 0.12 mm left of the Fire Station stem and 5.6 mm below the middle of its red square.
 */
export const CUBE_HOMES: Readonly<Record<CubePlace, Vec2>> = {
  'red-left-upper': middleOf(CUBE_SQUARES['red-left-upper']),
  'red-left-lower': middleOf(CUBE_SQUARES['red-left-lower']),
  'red-right-upper': middleOf(CUBE_SQUARES['red-right-upper']),
  'red-right-lower': middleOf(CUBE_SQUARES['red-right-lower']),
  yellow: middleOf(CUBE_SQUARES.yellow),
};

/**
 * How far a cube in a tower may stand off the middle of the dashed square and still make the letter
 * show (see LETTER_AREA): along the opening (towards it or towards the back) half of what the letter
 * area leaves, 7.82 mm; across, the supports leave (60 - 50) / 2 = 5 mm on each side - less than the
 * letter area's 7.47 mm.
 */
export const ROOM_ALONG_OPENING = (LETTER_AREA.X.h - CUBE_SIZE) / 2;
export const ROOM_ACROSS = (TOWER_GAP - CUBE_SIZE) / 2;

// =============================================================================================
// The white dashed outlines of the towers, as printed
// =============================================================================================

/**
 * MEASURED: InDesign fits the dashes of each side of an outline to its corners: every corner is a
 * solid piece of 7 pt along both sides, and every side has its own dash, the same length on and off.
 * The four lengths are the same for the five towers.
 */
export const DASH_CORNER = 7 * MM_PER_PT;
export const DASHES = {
  /** the square's sides along x (60 mm): 12.006 pt */
  squareAlongX: 12.006 * MM_PER_PT,
  /** the square's sides along y (60.7 mm): 12.159 pt */
  squareAlongY: 12.159 * MM_PER_PT,
  /** the side marks' sides along x (22.4 mm): 9.915 pt */
  sideAlongX: 9.915 * MM_PER_PT,
  /** the side marks' sides along y (35.1 mm): 12.198 pt */
  sideAlongY: 12.198 * MM_PER_PT,
} as const;

type StrokeLayer = Extract<MatLayer, { kind: 'stroke' }>;

/**
 * One dashed outline as the print file draws it: first its four sides (the top from right to left,
 * the left one down, the bottom from left to right, the right one up; each begins a corner piece and
 * a dash after its corner, so it starts with a gap, and ends a corner piece and half a dash before the
 * next corner), then its four solid corners.
 */
export function dashedOutline(r: Rect, dashX: number, dashY: number): StrokeLayer[] {
  const x0 = r.x;
  const y0 = r.y;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  const c = DASH_CORNER;
  const side = (a: Vec2, b: Vec2, dash: number): StrokeLayer => ({ kind: 'stroke', points: [a, b], width: DASH_WIDTH, color: WHITE, dash: { on: dash, off: dash } });
  const corner = (a: Vec2, b: Vec2, d: Vec2): StrokeLayer => ({ kind: 'stroke', points: [a, b, d], width: DASH_WIDTH, color: WHITE });
  return [
    side({ x: x1 - c - dashX, y: y0 }, { x: x0 + c + dashX / 2, y: y0 }, dashX),
    side({ x: x0, y: y0 + c + dashY }, { x: x0, y: y1 - c - dashY / 2 }, dashY),
    side({ x: x0 + c + dashX, y: y1 }, { x: x1 - c - dashX / 2, y: y1 }, dashX),
    side({ x: x1, y: y1 - c - dashY }, { x: x1, y: y0 + c + dashY / 2 }, dashY),
    corner({ x: x0 + c, y: y0 }, { x: x0, y: y0 }, { x: x0, y: y0 + c }),
    corner({ x: x0, y: y1 - c }, { x: x0, y: y1 }, { x: x0 + c, y: y1 }),
    corner({ x: x1 - c, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y1 - c }),
    corner({ x: x1, y: y0 + c }, { x: x1, y: y0 }, { x: x1 - c, y: y0 }),
  ];
}

/** The three dashed outlines of a tower, as printed: its square, its left side mark, its right side mark (24 strokes). */
export function towerOutline(tower: TowerId): StrokeLayer[] {
  return [
    ...dashedOutline(DASHED_SQUARES[tower], DASHES.squareAlongX, DASHES.squareAlongY),
    ...dashedOutline(SIDE_MARKS[tower].left, DASHES.sideAlongX, DASHES.sideAlongY),
    ...dashedOutline(SIDE_MARKS[tower].right, DASHES.sideAlongX, DASHES.sideAlongY),
  ];
}

// =============================================================================================
// What the floor sensors see: the vector drawing of the mat
// =============================================================================================

/** One thing the print file paints: a black line, a picture, or the dashed outlines of a tower. */
export type PrintItem = { line: LineId } | { tile: TileId } | { outline: TowerId };

const lines = (...ids: LineId[]): PrintItem[] => ids.map((id) => ({ line: id }));

/**
 * MEASURED: the order in which the print file paints everything (what comes later covers what came
 * before): B00 B01 B02, the hydrant, B03, the hospital, the bakery, B04, the park, the school,
 * B05 - B16, the right bay, the logo, the robot picture, the Fire Station, B17 - B21, the left bay,
 * B22 - B25, the yellow square, B26, the outlines of X, A, M and E, B27 - B30 (the corner T bars),
 * the outline of K, B31. (No T bar touches an outline, so that order changes nothing a sensor sees.)
 */
export const PRINT_ORDER: readonly PrintItem[] = [
  ...lines('B00', 'B01', 'B02'),
  { tile: 'hydrant' },
  ...lines('B03'),
  { tile: 'hospital' },
  { tile: 'bakery' },
  ...lines('B04'),
  { tile: 'park' },
  { tile: 'school' },
  ...lines('B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16'),
  { tile: 'rightBay' },
  { tile: 'logo' },
  { tile: 'robotPicture' },
  { tile: 'fireStation' },
  ...lines('B17', 'B18', 'B19', 'B20', 'B21'),
  { tile: 'leftBay' },
  ...lines('B22', 'B23', 'B24', 'B25'),
  { tile: 'yellowSquare' },
  ...lines('B26'),
  { outline: 'X' },
  { outline: 'A' },
  { outline: 'M' },
  { outline: 'E' },
  ...lines('B27', 'B28', 'B29', 'B30'),
  { outline: 'K' },
  ...lines('B31'),
];

function layersOf(item: PrintItem): MatLayer[] {
  if ('line' in item) return [{ kind: 'stroke', points: [...LINES[item.line]], width: LINE_WIDTH, color: LINE_COLOR }];
  if ('tile' in item) return [{ kind: 'rect', rect: TILES[item.tile], color: TILE_COLORS[item.tile] }];
  return towerOutline(item.outline);
}

/**
 * The mat as the floor sensors see it in tests and headless runs: white, the 32 black lines, every
 * picture as its average colour and the white dashed outlines of the towers, painted in the order of
 * the print file (163 layers). The screen's sensors read the picture instead (MAT_SENSOR_IMAGE_URL).
 */
export const MAT_VECTOR: MatVector = {
  width: MAT_SIZE,
  height: MAT_SIZE,
  background: WHITE,
  outside: TABLE,
  layers: PRINT_ORDER.flatMap(layersOf),
};
