/**
 * Drawing the stage: the mat seen from above, the fixed walls, the game elements, the robot, and
 * the optional helpers (zones, sensor view, driven path, ruler).
 *
 * What is drawn follows from the simulation, not from the name of a game: the walls it has
 * (World.walls), what kind of thing a body is (Body.kind: a person, a fire target), and the
 * parts of the robot (RobotConfig: gripper, fan, a colour sensor fixed to the front).
 *
 * Everything is drawn in MILLIMETRES: drawStage() first sets a transform that maps mat
 * millimetres to screen pixels, so the numbers below are real sizes (a 70 mm tower is drawn 70
 * units wide). Browser only (it needs a 2-D canvas), but free of React.
 *
 * Reminder of the simulator's conventions (see core/geometry.ts): +x is right, +y is DOWN,
 * heading 0 faces up the mat and grows clockwise - exactly how a canvas rotates, so a body is
 * drawn by translate(x, y) + rotate(heading) and then "forward" is the canvas direction -y.
 */
import { rayBoxDistance } from '../core/engine-collide';
import { DEG, localRectToOBB, localToWorld, obbCorners, pointInOBB, type OBB, type Rect, type Vec2 } from '../core/geometry';
import { mmPerWheelDegree, robotShapesAt, widestClawGap } from '../core/robot';
import {
  PROBE_NAMES,
  type Body,
  type FixedWall,
  type MatVector,
  type Pose,
  type RobotConfig,
  type SensorSnapshot,
  type Simulation,
  type ZoneOverlay,
} from '../core/types';
import { inkOn, parseHex, rgbCss, shade } from './format';
import { rulerLabels, type Ruler, type RulerLabel } from './ruler';
import type { Trail } from './trail';

// =============================================================================================
// View: where the mat sits inside the canvas
// =============================================================================================

export interface StageView {
  /** size of the canvas element in CSS pixels */
  cssWidth: number;
  cssHeight: number;
  /** device pixels per CSS pixel (2 on a retina screen) */
  dpr: number;
  /** CSS pixels per millimetre */
  scale: number;
  /** CSS pixel position of the mat's top-left corner */
  originX: number;
  originY: number;
}

/** Strip of table shown around the mat, in mm. */
export const STAGE_MARGIN = 45;

/** Largest view of the mat (plus a margin of table) that fits the canvas; the mat lands on whole device pixels. */
export function fitView(
  cssWidth: number,
  cssHeight: number,
  matWidth: number,
  matHeight: number,
  dpr: number,
  margin: number = STAGE_MARGIN,
): StageView {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const availW = Math.max(1, cssWidth * d);
  const availH = Math.max(1, cssHeight * d);
  const fit = Math.min(availW / (matWidth + 2 * margin), availH / (matHeight + 2 * margin));
  const matPixels = Math.max(1, Math.floor(matWidth * fit));
  const devicePerMm = matPixels / matWidth;
  return {
    cssWidth,
    cssHeight,
    dpr: d,
    scale: devicePerMm / d,
    originX: Math.round((availW - matWidth * devicePerMm) / 2) / d,
    originY: Math.round((availH - matHeight * devicePerMm) / 2) / d,
  };
}

/** Mat position (mm) of a point given in CSS pixels relative to the canvas' top-left corner. */
export function viewToMat(view: StageView, cssX: number, cssY: number): Vec2 {
  return { x: (cssX - view.originX) / view.scale, y: (cssY - view.originY) / view.scale };
}

// =============================================================================================
// The mat picture
// =============================================================================================

/** Paint the geometric description of a mat (used until the real picture has loaded). */
export function paintMatVector(ctx: CanvasRenderingContext2D, mat: MatVector): void {
  ctx.save();
  ctx.fillStyle = rgbCss(mat.background);
  ctx.fillRect(0, 0, mat.width, mat.height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  for (const layer of mat.layers) {
    if (layer.kind === 'rect') {
      ctx.fillStyle = rgbCss(layer.color);
      ctx.fillRect(layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h);
      continue;
    }
    if (layer.points.length < 2) continue;
    ctx.beginPath();
    layer.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    if (layer.closed) ctx.closePath();
    ctx.strokeStyle = rgbCss(layer.color);
    ctx.lineWidth = layer.width;
    ctx.setLineDash(layer.dash ? [layer.dash.on, layer.dash.off] : []);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Keeps a copy of the mat at exactly the size it is shown, so that every frame only has to copy
 * pixels instead of shrinking a large picture again.
 */
export class MatPainter {
  private image: HTMLImageElement | null = null;
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';

  constructor(private readonly vector: MatVector) {}

  /** Use the real mat picture from now on (null = back to the drawn version). */
  setImage(image: HTMLImageElement | null): void {
    this.image = image;
    this.cacheKey = '';
  }

  get hasImage(): boolean {
    return this.image !== null;
  }

  /** Draw the mat with its top-left corner at (0, 0); `ctx` must already be in millimetres. */
  paint(ctx: CanvasRenderingContext2D, view: StageView): void {
    const m = this.vector;
    const w = Math.max(1, Math.round(m.width * view.scale * view.dpr));
    const h = Math.max(1, Math.round(m.height * view.scale * view.dpr));
    const key = `${w}x${h}:${this.image ? 'picture' : 'drawing'}`;
    if (!this.cache || key !== this.cacheKey) {
      const cache = this.cache ?? document.createElement('canvas');
      cache.width = w;
      cache.height = h;
      const g = cache.getContext('2d');
      if (g) {
        if (this.image) {
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = 'high';
          g.drawImage(this.image, 0, 0, w, h);
        } else {
          g.setTransform(w / m.width, 0, 0, h / m.height, 0, 0);
          paintMatVector(g, m);
        }
      }
      this.cache = cache;
      this.cacheKey = key;
    }
    ctx.drawImage(this.cache, 0, 0, m.width, m.height);
  }
}

// =============================================================================================
// Small drawing helpers
// =============================================================================================

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * Height cue: the higher something is above the mat, the further away and the softer its shadow.
 * (Canvas shadows are measured in device pixels, hence `devicePerMm`.)
 */
function castShadow(ctx: CanvasRenderingContext2D, heightMm: number, devicePerMm: number): void {
  const h = Math.max(0, heightMm);
  ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
  ctx.shadowBlur = (2 + h * 0.1) * devicePerMm;
  ctx.shadowOffsetX = h * 0.07 * devicePerMm;
  ctx.shadowOffsetY = h * 0.11 * devicePerMm;
}

function noShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Text with a thin outline so it stays readable on any part of the mat. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ink: string, halo: string, haloWidth: number): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = haloWidth;
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y);
}

/** The website's font (Inter, where it is installed), then the same fall-backs as the rest of the site. */
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

// =============================================================================================
// Fixed walls
// =============================================================================================

/**
 * A wall is never drawn thinner than this many screen pixels. The walls of Fire Chief are 3 mm
 * thick: less than one pixel on a small stage, and thinner than the printed grid lines beside
 * them. So a thin wall is drawn thicker than it is - around its true middle line, where it
 * really stands - and what stops the robot is still the true wall of the engine.
 */
export const WALL_MIN_PIXELS = 6;

/**
 * The box a wall is drawn as: its own footprint, grown by the same amount on every side until
 * it is at least `minThickness` mm thick. The middle of the wall and its direction stay as they
 * are. (It grows at its ends too: two walls that meet at a corner then still close the corner.)
 */
export function wallDrawBox(wall: Pick<FixedWall, 'x' | 'y' | 'w' | 'l' | 'angle'>, minThickness: number): OBB {
  const grow = Math.max(0, minThickness - Math.min(wall.w, wall.l));
  return { x: wall.x, y: wall.y, w: wall.w + grow, l: wall.l + grow, angle: wall.angle };
}

/**
 * The picture of all walls, kept at the size of the stage: walls never move during a match, and
 * their soft shadows are slow to draw sixty times a second. It is drawn again when the walls
 * are other ones (the engine makes a new list for every new match and every new maze) or the
 * stage has another size (a new view for every new size).
 */
let wallPicture: { walls: readonly FixedWall[]; view: StageView; canvas: HTMLCanvasElement } | null = null;

function paintWalls(ctx: CanvasRenderingContext2D, walls: readonly FixedWall[], view: StageView): void {
  const devicePerMm = view.scale * view.dpr;
  const px = 1 / view.scale;
  const boxes = walls.map((wall) => ({ wall, corners: obbCorners(wallDrawBox(wall, WALL_MIN_PIXELS * px)), inner: obbCorners(wallDrawBox(wall, (WALL_MIN_PIXELS - 2) * px)) }));
  // 1. every wall with its shadow: the walls are tall (150 mm in Fire Chief), so the shadow is long
  for (const { wall, corners } of boxes) {
    castShadow(ctx, wall.h, devicePerMm);
    polygon(ctx, corners);
    ctx.fillStyle = rgbCss(shade(parseHex(wall.fill), -0.55));
    ctx.fill();
  }
  noShadow(ctx);
  // 2. the dark edge of every wall, over the shadows of its neighbours ...
  for (const { wall, corners } of boxes) {
    polygon(ctx, corners);
    ctx.fillStyle = rgbCss(shade(parseHex(wall.fill), -0.55));
    ctx.fill();
  }
  // 3. ... and then every top, one pixel in from the edge: walls that meet look like one piece
  for (const { wall, inner } of boxes) {
    polygon(ctx, inner);
    ctx.fillStyle = wall.fill;
    ctx.fill();
  }
}

/** Draw the fixed walls (from their kept picture). `ctx` may have any transform: it is put back. */
function drawWalls(ctx: CanvasRenderingContext2D, walls: readonly FixedWall[], view: StageView): void {
  if (walls.length === 0) return;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (!wallPicture || wallPicture.walls !== walls || wallPicture.view !== view || wallPicture.canvas.width !== width || wallPicture.canvas.height !== height) {
    const canvas = wallPicture?.canvas ?? document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    if (g) {
      const devicePerMm = view.scale * view.dpr;
      g.setTransform(devicePerMm, 0, 0, devicePerMm, view.originX * view.dpr, view.originY * view.dpr);
      paintWalls(g, walls, view);
    }
    wallPicture = { walls, view, canvas };
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(wallPicture.canvas, 0, 0);
  ctx.restore();
}

/**
 * What can be reached in a straight line from `origin` inside a cone: the cone is `halfAngle`
 * (radians) wide to each side of `heading` and `range` mm long, and every ray of it ends at the
 * first wall it meets. Returns the outline, starting at `origin` - for the air of a fan, which
 * does not go through a wall.
 */
export function sightPolygon(origin: Vec2, heading: number, halfAngle: number, range: number, walls: readonly FixedWall[] | undefined, rays = 41): Vec2[] {
  const points: Vec2[] = [{ x: origin.x, y: origin.y }];
  const list = walls ?? [];
  const sin = list.map((wall) => Math.sin(wall.angle));
  const cos = list.map((wall) => Math.cos(wall.angle));
  const count = Math.max(2, Math.floor(rays));
  for (let k = 0; k < count; k++) {
    const angle = heading - halfAngle + (2 * halfAngle * k) / (count - 1);
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    let reach = range;
    for (let i = 0; i < list.length; i++) {
      const wall = list[i];
      const at = rayBoxDistance(origin.x, origin.y, dx, dy, wall.x, wall.y, wall.w / 2, wall.l / 2, sin[i], cos[i]);
      if (at >= 0 && at < reach) reach = at;
    }
    points.push({ x: origin.x + dx * reach, y: origin.y + dy * reach });
  }
  return points;
}

// =============================================================================================
// Game elements
// =============================================================================================

/**
 * The outline of a flame, `height` mm tall, standing upright on the screen around (cx, cy).
 * (Numbers are parts of the height: the tip is at -0.5, the round base at +0.5.)
 */
function flamePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, height: number): void {
  const x = (u: number): number => cx + u * height;
  const y = (v: number): number => cy + v * height;
  ctx.beginPath();
  ctx.moveTo(x(0.03), y(-0.5));
  ctx.bezierCurveTo(x(0.08), y(-0.26), x(0.37), y(-0.12), x(0.37), y(0.17));
  ctx.bezierCurveTo(x(0.37), y(0.37), x(0.21), y(0.5), x(0), y(0.5));
  ctx.bezierCurveTo(x(-0.21), y(0.5), x(-0.37), y(0.37), x(-0.37), y(0.17));
  ctx.bezierCurveTo(x(-0.37), y(0.03), x(-0.29), y(-0.08), x(-0.22), y(-0.2));
  ctx.bezierCurveTo(x(-0.2), y(-0.1), x(-0.16), y(-0.05), x(-0.1), y(-0.03));
  ctx.bezierCurveTo(x(-0.13), y(-0.22), x(-0.07), y(-0.39), x(0.03), y(-0.5));
  ctx.closePath();
}

/**
 * The kind of body that is "the fire": the wooden flame of Fire Chief (KIND_FIRE_TARGET in
 * fire-chief/game.ts - a test keeps the two words the same). The stage draws a flame sign
 * around it.
 */
export const FIRE_KIND = 'fire-target';

/** The smallest size (screen pixels) the flame sign of the fire is drawn at ... */
const FLAME_SIGN_MIN_PIXELS = 24;
/** ... and its size on a large stage (mm). */
const FLAME_SIGN_MM = 90;

/**
 * The sign of the fire: a flame, drawn around the middle of the body.
 *
 * The body itself is small (the fire target of Fire Chief is 60 x 20 mm seen from above: a few
 * pixels on a phone) and it stands in a room whose printed picture shows a fireplace or a candle
 * that is NOT the fire. The sign makes the real one easy to find at every size. It is only a
 * sign: what the robot can touch is the body itself, which is drawn on top of it at its true
 * size (drawBody).
 */
function drawFlameSign(ctx: CanvasRenderingContext2D, body: Body, view: StageView): void {
  const height = Math.max(FLAME_SIGN_MM, FLAME_SIGN_MIN_PIXELS / view.scale);
  const px = 1 / view.scale;
  ctx.save();
  // a warm glow and a white edge keep it visible on the white mat and on the room pictures
  ctx.shadowColor = 'rgba(234, 88, 12, 0.85)';
  ctx.shadowBlur = 9 * view.dpr;
  flamePath(ctx, body.x, body.y, height);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5 * px;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  noShadow(ctx);
  const fire = ctx.createLinearGradient(body.x, body.y - height / 2, body.x, body.y + height / 2);
  fire.addColorStop(0, '#dc2626');
  fire.addColorStop(0.45, '#f97316');
  fire.addColorStop(1, '#fbbf24');
  ctx.fillStyle = fire;
  ctx.fill();
  ctx.lineWidth = 1.2 * px;
  ctx.strokeStyle = '#7c2d12';
  ctx.stroke();
  // the bright heart of the flame (the body itself is drawn on it, and shows best on something light)
  flamePath(ctx, body.x, body.y + height * 0.14, height * 0.62);
  ctx.fillStyle = '#fef3c7';
  ctx.fill();
  ctx.restore();
}

/**
 * Draw one tower, bucket, person or fire target where it stands (or where the claw holds it).
 * `minEdge`: the thinnest its outline is drawn (mm), for a small body that must still be seen.
 */
export function drawBody(ctx: CanvasRenderingContext2D, body: Body, devicePerMm: number, minEdge = 0): void {
  const fill = parseHex(body.fill);
  const edge = rgbCss(shade(fill, -0.45));
  const { w, l } = body;
  const size = Math.min(w, l);

  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle);

  // base shape = the exact footprint the referee measures
  castShadow(ctx, body.z + body.h, devicePerMm);
  roundRect(ctx, -w / 2, -l / 2, w, l, body.platform ? 5 : 6);
  ctx.fillStyle = body.fill;
  ctx.fill();
  noShadow(ctx);
  ctx.lineWidth = Math.max(1.6, minEdge);
  ctx.strokeStyle = edge;
  ctx.stroke();

  let ink = inkOn(fill);
  if (body.platform) {
    // tower: a lighter top plate inside a darker rim
    const inset = Math.min(8, size * 0.12);
    roundRect(ctx, -w / 2 + inset, -l / 2 + inset, w - 2 * inset, l - 2 * inset, 3);
    ctx.fillStyle = rgbCss(shade(fill, 0.35));
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgbCss(shade(fill, -0.2));
    ctx.stroke();
    ink = inkOn(shade(fill, 0.35));
  } else if (body.kind === 'person') {
    // person: shoulders and a round white head
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.42, size * 0.27, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgbCss(shade(fill, -0.25));
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.29, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ink = rgbCss(shade(fill, -0.2));
  } else if (body.grippable) {
    // bucket: an open container, darker inside
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.37, 0, Math.PI * 2);
    ctx.fillStyle = rgbCss(shade(fill, -0.3));
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgbCss(shade(fill, 0.45));
    ctx.stroke();
    ink = '#ffffff';
  }

  // label, always upright so it can be read whichever way the element is turned
  if (body.label) {
    ctx.rotate(-body.angle);
    const fontSize = body.platform ? size * 0.34 : size * 0.44;
    ctx.font = `700 ${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.fillText(body.label, 0, fontSize * 0.06);
  }
  ctx.restore();
}

// =============================================================================================
// Robot
// =============================================================================================

type StageSim = Pick<Simulation<unknown>, 'world' | 'robotConfig' | 'game' | 'status' | 'readSensors'>;

/** Oriented box around the whole robot (chassis and gripper), used to tell whether the pointer is on it. */
export function robotHull(config: RobotConfig, pose: Pose): OBB {
  const g = config.gripper;
  const front = g.enabled ? Math.max(config.chassisFront, g.gripForward + g.fingerLength / 2) : config.chassisFront;
  const half = config.chassisWidth / 2;
  return localRectToOBB(pose, -config.chassisRear, front, -half, half);
}

export function robotHit(config: RobotConfig, pose: Pose, point: Vec2, tolerance = 0): boolean {
  return pointInOBB(point, robotHull(config, pose), tolerance);
}

/** 0 = arm fully down, 1 = fully up. */
function liftFraction(config: RobotConfig, height: number): number {
  const g = config.gripper;
  const span = g.liftUpHeight - g.liftDownHeight;
  if (Math.abs(span) < 1e-9) return 0;
  return Math.max(0, Math.min(1, (height - g.liftDownHeight) / span));
}

function drawRobot(ctx: CanvasRenderingContext2D, sim: StageSim, devicePerMm: number): void {
  const robot = sim.world.robot;
  const c = sim.robotConfig;
  const g = c.gripper;
  const { pose } = robot;
  const half = c.chassisWidth / 2;
  const front = c.chassisFront;
  const rear = c.chassisRear;

  // ------------------------------------------------------------------ chassis, wheels, CyberPi
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);
  // from here on: x = to the robot's right, y = towards its REAR (so the front is at negative y)

  // base plate = the exact box the engine uses for collisions
  castShadow(ctx, c.chassisHeight * 0.6, devicePerMm);
  roundRect(ctx, -half, -front, 2 * half, front + rear, 13);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  noShadow(ctx);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#075985';
  ctx.stroke();

  // wheels, with a tread that rolls with the encoder
  const wheelW = Math.min(22, half * 0.36);
  const wheelL = c.wheelDiameter;
  const wheelX = Math.min(c.trackWidth / 2, half - wheelW / 2 - 1);
  const mmPerDeg = mmPerWheelDegree(c);
  const treadGap = 9;
  for (const side of [-1, 1] as const) {
    const wheel = side < 0 ? robot.left : robot.right;
    const x = side * wheelX - wheelW / 2;
    roundRect(ctx, x, -wheelL / 2, wheelW, wheelL, 5);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const rolled = (((wheel.angleDeg * mmPerDeg) % treadGap) + treadGap) % treadGap;
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // seen from above the top of the wheel moves forward when the robot drives forward
    for (let y = wheelL / 2 + treadGap - rolled; y > -wheelL / 2 - treadGap; y -= treadGap) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + wheelW, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // the mBot2 shield (dark board) between the wheels
  const innerHalf = Math.max(12, wheelX - wheelW / 2 - 3);
  roundRect(ctx, -innerHalf, -front + 24, 2 * innerHalf, front + rear - 32, 6);
  ctx.fillStyle = '#0c4a6e';
  ctx.fill();

  // CyberPi: screen, joystick, buttons and the strip of five LEDs
  const piHalf = Math.max(10, innerHalf - 2);
  const piTop = -30;
  const piLength = 46;
  roundRect(ctx, -piHalf, piTop, 2 * piHalf, piLength, 8);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#4b5563';
  ctx.stroke();

  const screenOn = robot.screen.lines.length > 0 || robot.screen.labels.length > 0;
  roundRect(ctx, -piHalf * 0.4, piTop + 6, piHalf * 0.8, 21, 2);
  ctx.fillStyle = screenOn ? '#bae6fd' : '#020617';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.arc(-piHalf * 0.68, piTop + 16, 4, 0, Math.PI * 2); // joystick
  ctx.arc(piHalf * 0.68, piTop + 11, 3, 0, Math.PI * 2); // button A
  ctx.fill();
  ctx.beginPath();
  ctx.arc(piHalf * 0.68, piTop + 21, 3, 0, Math.PI * 2); // button B
  ctx.fill();

  const ledPitch = Math.min(12, (2 * piHalf - 10) / 5);
  for (let i = 0; i < 5; i++) {
    const led = robot.leds[i] ?? { r: 0, g: 0, b: 0 };
    const lit = led.r + led.g + led.b > 24;
    const x = (i - 2) * ledPitch;
    if (lit) {
      ctx.shadowColor = rgbCss(led);
      ctx.shadowBlur = 7 * devicePerMm;
    }
    roundRect(ctx, x - ledPitch * 0.36, piTop + piLength - 13, ledPitch * 0.72, 7, 2);
    ctx.fillStyle = lit ? rgbCss(led) : '#374151';
    ctx.fill();
    noShadow(ctx);
  }

  // ultrasonic sensor: the two "eyes" at the front
  const eyeY = -front + 9.5;
  roundRect(ctx, -32, -front + 1.5, 64, 16, 8);
  ctx.fillStyle = '#0369a1';
  ctx.fill();
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(side * 17, eyeY, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e0f2fe';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side * 17, eyeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0c4a6e';
    ctx.fill();
  }

  // fan (a robot that has one): a round guard behind the ultrasonic sensor; the blades turn while it blows
  if (c.fan && c.fan.enabled) {
    const fanY = -front + 40;
    const fanRadius = Math.min(17, innerHalf - 4);
    ctx.beginPath();
    ctx.arc(0, fanY, fanRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
    const blowing = robot.fanOn === true;
    // (one turn in 0.3 s of match time: fast enough to look like a fan, slow enough to be seen turning)
    const spin = blowing ? ((sim.world.time / 0.3) % 1) * Math.PI * 2 : 0.5;
    ctx.fillStyle = blowing ? '#7dd3fc' : '#94a3b8';
    for (let blade = 0; blade < 3; blade++) {
      const a = spin + (blade * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * fanRadius * 0.5, fanY + Math.sin(a) * fanRadius * 0.5, fanRadius * 0.42, fanRadius * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, fanY, fanRadius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
  }

  // colour sensor (a robot that has one fixed to its front): a small white module between the
  // two eyes of the ultrasonic sensor, its face on the front edge where the sensor looks out.
  // Its eye is drawn in three colours (red, green, blue), so that it is not taken for a third
  // eye of the ultrasonic sensor.
  const colourSensor = c.frontColorSensor;
  if (colourSensor.enabled && colourSensor.mount) {
    const faceY = -colourSensor.mount.forward;
    roundRect(ctx, -7, faceY, 14, 12, 2.5);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#0c4a6e';
    ctx.stroke();
    const eyeColours = ['#ef4444', '#22c55e', '#3b82f6'];
    for (let part = 0; part < 3; part++) {
      const from = -Math.PI / 2 + (part * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(0, faceY + 6);
      ctx.arc(0, faceY + 6, 4, from, from + (Math.PI * 2) / 3);
      ctx.closePath();
      ctx.fillStyle = eyeColours[part];
      ctx.fill();
    }
  }

  // gripper arm: neck and palm (the fingers come later, on top of whatever they hold)
  const lift = liftFraction(c, robot.gripper.height);
  const armColor = rgbCss(shade({ r: 51, g: 65, b: 85 }, lift * 0.45));
  const fingerRear = g.gripForward - g.fingerLength / 2;
  const fingerFront = g.gripForward + g.fingerLength / 2;
  if (g.enabled) {
    const palmHalf = widestClawGap(c) / 2 + g.fingerThickness;
    castShadow(ctx, robot.gripper.height, devicePerMm);
    ctx.fillStyle = armColor;
    roundRect(ctx, -8, -fingerRear, 16, Math.max(6, fingerRear - front + 6), 3);
    ctx.fill();
    roundRect(ctx, -palmHalf, -fingerRear, 2 * palmHalf, Math.min(9, Math.max(4, fingerRear - front)), 3);
    ctx.fill();
    noShadow(ctx);
  }
  ctx.restore();

  // ------------------------------------------------------------------ what the claw holds
  const holding = robot.gripper.holding;
  if (holding) {
    const held = sim.world.bodies.find((b) => b.id === holding);
    if (held) drawBody(ctx, held, devicePerMm);
  }

  // ------------------------------------------------------------------ fingers
  if (g.enabled) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.heading);
    const gap = robot.gripper.gap;
    castShadow(ctx, robot.gripper.height + g.fingerHeight, devicePerMm);
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? -gap / 2 - g.fingerThickness : gap / 2;
      roundRect(ctx, x, -fingerFront, g.fingerThickness, fingerFront - fingerRear, Math.min(3.5, g.fingerThickness / 2));
      ctx.fillStyle = armColor;
      ctx.fill();
    }
    noShadow(ctx);
    ctx.lineWidth = 1;
    ctx.strokeStyle = lift > 0.5 ? '#0f172a' : '#e2e8f0';
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? -gap / 2 - g.fingerThickness : gap / 2;
      roundRect(ctx, x, -fingerFront, g.fingerThickness, fingerFront - fingerRear, Math.min(3.5, g.fingerThickness / 2));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// =============================================================================================
// Sensor view
// =============================================================================================

/** How far the "nothing seen" beam is drawn (mm). */
const EMPTY_BEAM_LENGTH = 420;

interface Beam {
  origin: Vec2;
  /** true when the sensor sees something within its range */
  sees: boolean;
  /** length of the drawn beam, mm */
  range: number;
  /** half opening angle, radians */
  half: number;
  /** direction of the beam as a canvas angle (0 = +x, clockwise) */
  centre: number;
}

function beamOf(sim: StageSim, sensors: SensorSnapshot): Beam {
  const u = sim.robotConfig.ultrasonic;
  const pose = sim.world.robot.pose;
  const sees = sensors.ultrasonicCm < u.maxRangeCm - 1e-6;
  return {
    origin: localToWorld(pose, u.forward, 0),
    sees,
    range: sees ? sensors.ultrasonicCm * 10 : EMPTY_BEAM_LENGTH,
    half: u.halfAngleDeg * DEG,
    // canvas angles start at +x; our heading 0 points up, a quarter turn earlier
    centre: pose.heading - Math.PI / 2,
  };
}

/** The light-blue cone of the ultrasonic sensor, drawn under the game elements. */
function drawUltrasonicBeam(ctx: CanvasRenderingContext2D, beam: Beam, view: StageView): void {
  const { origin, range, half, centre } = beam;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.arc(origin.x, origin.y, range, centre - half, centre + half);
  ctx.closePath();
  if (beam.sees) {
    ctx.fillStyle = 'rgba(14, 165, 233, 0.26)';
  } else {
    const fade = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, range);
    fade.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
    fade.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = fade;
  }
  ctx.fill();
  if (beam.sees) {
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, range, centre - half, centre + half);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3 / view.scale;
    ctx.stroke();
  }
  ctx.restore();
}

/** The measured distance, written beside the end of the beam, on top of everything else. */
function drawUltrasonicLabel(ctx: CanvasRenderingContext2D, sim: StageSim, sensors: SensorSnapshot, beam: Beam, view: StageView): void {
  if (!beam.sees) return;
  const u = sim.robotConfig.ultrasonic;
  const pose = sim.world.robot.pose;
  // to the right of where the beam ends, so that it covers neither the beam nor what it hit
  const aside = beam.range * Math.tan(beam.half) + 24 / view.scale;
  let at = localToWorld(pose, u.forward + beam.range, aside);
  const fontSize = 11 / view.scale;
  const label = `${Math.round(sensors.ultrasonicCm)} cm`;
  ctx.save();
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // On a field with walls around it the beam very often ends on a wall at the edge of the
  // picture, and the number would be cut off there: it is moved until all of it is on the stage.
  // (On a field without walls the number stands where it always stood.)
  if ((sim.world.walls?.length ?? 0) > 0) at = keptOnStage(at, ctx.measureText(label).width, fontSize, view);
  haloText(ctx, label, at.x, at.y, '#075985', 'rgba(255, 255, 255, 0.95)', 3.5 / view.scale);
  ctx.restore();
}

/** The middle of a number written beside the robot, moved (if need be) until the whole number is on the stage. */
function keptOnStage(at: Vec2, textWidth: number, fontSize: number, view: StageView): Vec2 {
  const half = textWidth / 2 + 4 / view.scale;
  const corner = viewToMat(view, 0, 0);
  return {
    x: Math.max(corner.x + half, Math.min(corner.x + view.cssWidth / view.scale - half, at.x)),
    y: Math.max(corner.y + fontSize, Math.min(corner.y + view.cssHeight / view.scale - fontSize, at.y)),
  };
}

/**
 * The air of the fan while it blows: a cone in front of the fan, as wide and as long as the
 * robot's configuration says, cut off at the walls, with a few curved lines that move away from
 * the robot. (It is drawn for every robot that has a fan, whatever is switched on under the mat.)
 */
function drawFanAir(ctx: CanvasRenderingContext2D, sim: StageSim, view: StageView): void {
  const fan = sim.robotConfig.fan;
  if (!fan || !fan.enabled || sim.world.robot.fanOn !== true || !(fan.reachMm > 0)) return;
  const pose = sim.world.robot.pose;
  const origin = localToWorld(pose, fan.forward, 0);
  const half = fan.coneHalfAngleDeg * DEG;
  const outline = sightPolygon(origin, pose.heading, half, fan.reachMm, sim.world.walls, 21);
  const centre = pose.heading - Math.PI / 2;
  ctx.save();
  polygon(ctx, outline);
  const fade = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, fan.reachMm);
  fade.addColorStop(0, 'rgba(100, 116, 139, 0.42)');
  fade.addColorStop(1, 'rgba(100, 116, 139, 0.1)');
  ctx.fillStyle = fade;
  ctx.fill();
  ctx.lineWidth = 1 / view.scale;
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
  ctx.stroke();
  // the moving lines stay inside the cone (and in front of the walls)
  ctx.clip();
  const waves = 4;
  // (one line needs 0.6 s of match time from the fan to the end of its reach)
  const phase = (sim.world.time / 0.6) % 1;
  ctx.lineCap = 'round';
  for (let k = 0; k < waves; k++) {
    const t = (k + phase) / waves;
    const radius = fan.reachMm * t;
    if (radius < 6) continue;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, centre - half * 0.8, centre + half * 0.8);
    ctx.globalAlpha = 1 - 0.75 * t;
    ctx.lineWidth = 4 / view.scale;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.lineWidth = 1.8 / view.scale;
    ctx.strokeStyle = '#334155';
    ctx.stroke();
  }
  ctx.restore();
}

function drawProbes(ctx: CanvasRenderingContext2D, sim: StageSim, sensors: SensorSnapshot): void {
  const q = sim.robotConfig.quadRgb;
  const pose = sim.world.robot.pose;
  ctx.save();
  PROBE_NAMES.forEach((name, i) => {
    const p = localToWorld(pose, q.forward, q.probeOffsets[i]);
    const reading = sensors.probes[name];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6.6, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.6, 0, Math.PI * 2);
    // orange ring = this probe is on the line, white ring = background
    ctx.fillStyle = reading.onLine ? '#f97316' : '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.9, 0, Math.PI * 2);
    ctx.fillStyle = rgbCss(reading.rgb);
    ctx.fill();
  });
  ctx.restore();
}

// =============================================================================================
// Zones, path, placing the robot
// =============================================================================================

/** Where the name of one zone is written: centre x and text baseline y, in mat millimetres. */
export interface ZoneLabelPlace {
  x: number;
  y: number;
  /** true when the name had to go below its area */
  below: boolean;
}

/**
 * Decide where the name of every zone is written.
 *
 * A name normally sits just above its area, so that whatever stands in the area does not hide
 * it. Names are often wider than their areas, though: the two squares of a building are 110 mm
 * apart and "A1 person" / "A2 water" would run into each other. A name that would touch one
 * already placed is therefore written below its area instead.
 *
 * `textWidth` measures a name, `fontSize` is the height of the letters and `gap` the distance
 * between an area and its name - all in the same unit as the zone rectangles (mm).
 *
 * An area that begins at the top edge of the mat (a room of Fire Chief) has no room for a name
 * above it: the name would be written on the table, and on a small stage beyond the edge of the
 * picture. Its name is written below the area, and - `stage` is what the picture shows, the mat
 * and the strip of table around it - moved sideways until all of it is on the stage.
 * (Only such areas are treated this way: every other name stands where it always stood.)
 */
export function placeZoneLabels(
  zones: ReadonlyArray<Pick<ZoneOverlay, 'label' | 'rect'>>,
  textWidth: (label: string) => number,
  fontSize: number,
  gap: number,
  stage?: Rect,
): ZoneLabelPlace[] {
  interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  const taken: Box[] = [];
  // two names side by side need a clear space between them (one letter height), or they read as one
  const air = fontSize;
  const free = (box: Box): boolean =>
    taken.every((t) => box.right + air <= t.left || t.right + air <= box.left || box.bottom <= t.top || t.bottom <= box.top);

  return zones.map((zone) => {
    const { x, y, w, h } = zone.rect;
    const half = textWidth(zone.label) / 2;
    const atTopEdge = y <= 0;
    let centre = x + w / 2;
    if (atTopEdge && stage && 2 * half <= stage.w) centre = Math.max(stage.x + half, Math.min(stage.x + stage.w - half, centre));
    const above: Box = { left: centre - half, right: centre + half, top: y - gap - fontSize, bottom: y - gap };
    const under: Box = { left: centre - half, right: centre + half, top: y + h + gap, bottom: y + h + gap + fontSize };
    const below = (atTopEdge || !free(above)) && free(under);
    const box = below ? under : above;
    taken.push(box);
    // the letters stand on the baseline; capital letters are about 0.72 of the font size tall
    return { x: centre, y: below ? box.top + fontSize * 0.72 : box.bottom, below };
  });
}

/** The coloured areas of the zones (their names are written by drawZoneNames). */
function drawZoneAreas(ctx: CanvasRenderingContext2D, overlays: ZoneOverlay[], view: StageView): void {
  ctx.save();
  for (const zone of overlays) {
    const { x, y, w, h } = zone.rect;
    ctx.globalAlpha = zone.kind === 'start' ? 0.1 : 0.3;
    ctx.fillStyle = zone.color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2 / view.scale;
    ctx.strokeStyle = zone.color;
    ctx.setLineDash(zone.kind === 'delivery' ? [6 / view.scale, 4 / view.scale] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/**
 * The names of the zones: on top of all the areas, each where it does not run into another name
 * and all of it is on the stage.
 */
function drawZoneNames(ctx: CanvasRenderingContext2D, overlays: ZoneOverlay[], view: StageView): void {
  const fontSize = 10 / view.scale;
  ctx.save();
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const corner = viewToMat(view, 0, 0);
  // (the halo of the letters needs a little room too)
  const edge = 3 / view.scale;
  const stage: Rect = { x: corner.x + edge, y: corner.y + edge, w: view.cssWidth / view.scale - 2 * edge, h: view.cssHeight / view.scale - 2 * edge };
  const places = placeZoneLabels(overlays, (label) => ctx.measureText(label).width, fontSize, 5 / view.scale, stage);
  overlays.forEach((zone, i) => {
    haloText(ctx, zone.label, places[i].x, places[i].y, '#0f172a', 'rgba(255, 255, 255, 0.92)', 3 / view.scale);
  });
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail, view: StageView): void {
  const pts = trail.points;
  if (pts.length < 4) return;
  ctx.save();
  ctx.beginPath();
  let penDown = false;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i];
    const y = pts[i + 1];
    if (Number.isNaN(x)) {
      penDown = false;
    } else if (!penDown) {
      ctx.moveTo(x, y);
      penDown = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5 / view.scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
  ctx.lineWidth = 2.5 / view.scale;
  ctx.strokeStyle = '#c026d3';
  ctx.stroke();
  ctx.restore();
}

/** Outline of the start zone while the robot can still be placed; red when the wanted place is not allowed. */
function drawStartZone(ctx: CanvasRenderingContext2D, sim: StageSim, view: StageView, illegal: boolean): void {
  const z = sim.game.startZone;
  ctx.save();
  ctx.lineWidth = 2.5 / view.scale;
  ctx.setLineDash([9 / view.scale, 6 / view.scale]);
  ctx.strokeStyle = illegal ? '#dc2626' : 'rgba(255, 255, 255, 0.95)';
  ctx.strokeRect(z.x, z.y, z.w, z.h);
  ctx.lineDashOffset = 9 / view.scale;
  ctx.strokeStyle = illegal ? '#fecaca' : 'rgba(15, 23, 42, 0.75)';
  ctx.strokeRect(z.x, z.y, z.w, z.h);
  ctx.restore();
}

/** Red outline of the robot at a place where it is not allowed to start. */
function drawGhost(ctx: CanvasRenderingContext2D, config: RobotConfig, pose: Pose, view: StageView): void {
  ctx.save();
  ctx.lineWidth = 2.5 / view.scale;
  ctx.strokeStyle = '#dc2626';
  ctx.fillStyle = 'rgba(220, 38, 38, 0.22)';
  ctx.setLineDash([7 / view.scale, 4 / view.scale]);
  for (const shape of robotShapesAt(config, pose)) {
    polygon(ctx, obbCorners(shape));
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// =============================================================================================
// The ruler
// =============================================================================================

/** The ruler's own colour: an orange that is neither on the mat nor used by another helper. */
const RULER_COLOR = '#ea580c';
const RULER_DARK = '#9a3412';

/** How far the line that shows where the robot faces reaches from its turning centre (mm): just past the open claw. */
const RULER_HEADING_LENGTH = 190;

/**
 * Where the numbers of the ruler were written in the last picture. Finding their places measures
 * every text and tries many spots, and during a match the stage is drawn sixty times a second
 * while the ruler does not change. The places are the same as long as the line is the same
 * (ruler.ts makes a new object for every change), the stage has the same size (a new view for
 * every new size) and the letters have the same width (they change once, when the website's
 * font has loaded).
 */
let lastRulerLabels: { ruler: Ruler; view: StageView; letter: number; labels: RulerLabel[] } | null = null;

/**
 * The ruler lies on top of everything else: its line, a dot on every point, and the numbers
 * (where each number goes is decided in ruler.ts). Line widths, dots and letters have a fixed
 * size on the SCREEN, whatever the size of the mat - hence all the "/ view.scale".
 */
function drawRuler(ctx: CanvasRenderingContext2D, ruler: Ruler, view: StageView): void {
  const { points } = ruler;
  if (points.length === 0) return;
  const px = 1 / view.scale;
  // letters grow a little with the stage, so that the enlarged stage is also easier to read
  const fontSize = Math.max(11, Math.min(14, view.cssWidth / 48)) * px;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // a line that starts on the robot: where the robot faces now (its first turn is measured from there)
  if (ruler.startHeading !== null) {
    const ahead = localToWorld({ ...points[0], heading: ruler.startHeading }, RULER_HEADING_LENGTH, 0);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(ahead.x, ahead.y);
    ctx.setLineDash([5 * px, 5 * px]);
    ctx.lineWidth = 3.5 * px;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
    ctx.lineWidth = 1.5 * px;
    ctx.strokeStyle = RULER_DARK;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // the line, with a white edge so that it shows on the black lines of the mat too
  if (points.length > 1) {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineWidth = 5.5 * px;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.stroke();
    ctx.lineWidth = 2.5 * px;
    ctx.strokeStyle = RULER_COLOR;
    ctx.stroke();
  }

  // the points: a filled dot where the line starts on the robot, a ring everywhere else
  points.forEach((p, i) => {
    const onRobot = i === 0 && ruler.startHeading !== null;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * px, 0, Math.PI * 2);
    ctx.fillStyle = onRobot ? RULER_COLOR : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = onRobot ? '#ffffff' : RULER_COLOR;
    ctx.stroke();
    if (onRobot) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5 * px, 0, Math.PI * 2);
      ctx.lineWidth = 1.2 * px;
      ctx.strokeStyle = RULER_DARK;
      ctx.stroke();
    }
  });

  // the numbers, each in a small box so that it can be read on any part of the mat
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letter = ctx.measureText('0').width;
  if (!lastRulerLabels || lastRulerLabels.ruler !== ruler || lastRulerLabels.view !== view || lastRulerLabels.letter !== letter) {
    const corner = viewToMat(view, 0, 0);
    const labels = rulerLabels(ruler, {
      textWidth: (text) => ctx.measureText(text).width,
      fontSize,
      clearance: 9 * px,
      bounds: { x: corner.x + 2 * px, y: corner.y + 2 * px, w: view.cssWidth * px - 4 * px, h: view.cssHeight * px - 4 * px },
    });
    lastRulerLabels = { ruler, view, letter, labels };
  }
  for (const label of lastRulerLabels.labels) {
    roundRect(ctx, label.x - label.w / 2, label.y - label.h / 2, label.w, label.h, 4 * px);
    // lengths: white; turns: light yellow; the total: filled, because it is the sum of the others
    ctx.fillStyle = label.kind === 'total' ? RULER_DARK : label.kind === 'turn' ? 'rgba(254, 243, 199, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.lineWidth = 1 * px;
    ctx.strokeStyle = label.kind === 'total' ? '#ffffff' : RULER_COLOR;
    ctx.stroke();
    ctx.fillStyle = label.kind === 'total' ? '#ffffff' : '#0f172a';
    ctx.fillText(label.text, label.x, label.y + fontSize * 0.06);
  }
  ctx.restore();
}

// =============================================================================================
// The whole picture
// =============================================================================================

export interface StageOptions {
  /** coloured zones of the game (start, pick-up, delivery, tower areas) */
  overlays: boolean;
  /** what the sensors see: line sensor dots and the ultrasonic beam */
  sensors: boolean;
  /** the path the robot has driven */
  trail: boolean;
}

export interface StageScene {
  sim: StageSim;
  view: StageView;
  options: StageOptions;
  mat: MatPainter;
  trail: Trail;
  overlays: ZoneOverlay[];
  /** the robot may still be placed: show the start zone */
  placing: boolean;
  /** where the student is trying to put the robot although it does not fit there */
  ghost: Pose | null;
  /** the measuring line, while the ruler is on (null = no ruler) */
  ruler: Ruler | null;
}

/** The table the mat lies on: the website's ink-600 (the frame of the stage in StageCanvas.tsx has the same colour). */
export const TABLE_COLOR = '#2c3a5c';

export function drawStage(ctx: CanvasRenderingContext2D, scene: StageScene): void {
  const { sim, view, options } = scene;
  const devicePerMm = view.scale * view.dpr;
  const mat = sim.game.mat;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = TABLE_COLOR;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // from here on everything is in millimetres on the mat
  ctx.setTransform(devicePerMm, 0, 0, devicePerMm, view.originX * view.dpr, view.originY * view.dpr);

  // the mat, lying on the table
  ctx.save();
  castShadow(ctx, 30, devicePerMm);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, mat.width, mat.height);
  ctx.restore();
  scene.mat.paint(ctx, view);

  // The zones: their coloured areas lie on the mat, under everything else. Their names are
  // written right after them - except on a field with walls: a name is often wider than its
  // area (a room of Fire Chief is one cell, "Living room (fire)" is longer than that on a small
  // stage), so a wall would be drawn across it and hide some of its letters. There the names
  // are written after the walls.
  const walls = sim.world.walls ?? [];
  const namesOverWalls = walls.length > 0;
  if (options.overlays) {
    drawZoneAreas(ctx, scene.overlays, view);
    if (!namesOverWalls) drawZoneNames(ctx, scene.overlays, view);
  }
  if (scene.placing) drawStartZone(ctx, sim, view, scene.ghost !== null);
  if (options.trail) drawTrail(ctx, scene.trail, view);
  // the fixed walls of the match (a game without walls has none)
  drawWalls(ctx, walls, view);
  if (options.overlays && namesOverWalls) drawZoneNames(ctx, scene.overlays, view);

  // game elements, lowest first, so that what stands on a tower is drawn over the tower
  const holding = sim.world.robot.gripper.holding;
  const standing = sim.world.bodies.filter((b) => b.id !== holding && !b.held);
  standing.sort((a, b) => a.z - b.z);

  const sensors = options.sensors ? sim.readSensors() : null;
  const beam = sensors ? beamOf(sim, sensors) : null;
  if (beam) drawUltrasonicBeam(ctx, beam, view);

  for (const body of standing) {
    if (body.kind === FIRE_KIND) {
      // the fire: its sign first, then the body itself on top, with an outline that shows on a small stage too
      drawFlameSign(ctx, body, view);
      drawBody(ctx, body, devicePerMm, 1.25 / view.scale);
    } else {
      drawBody(ctx, body, devicePerMm);
    }
  }
  drawRobot(ctx, sim, devicePerMm);
  drawFanAir(ctx, sim, view);
  if (sensors) drawProbes(ctx, sim, sensors);
  if (sensors && beam) drawUltrasonicLabel(ctx, sim, sensors, beam, view);
  if (scene.ghost) drawGhost(ctx, sim.robotConfig, scene.ghost, view);
  if (scene.ruler) drawRuler(ctx, scene.ruler, view);
}
