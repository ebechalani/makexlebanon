/**
 * What the stage draws for Fire Cadet (design 8.3), through the painter seam of ../render.ts
 * (StagePainters): the Fire marker and the target hints on the mat, the rescue items and the
 * obstacles, and the mTiny with its two sticks. Everything else - the mat picture, the table, the
 * driven path - the stage draws as for every game.
 *
 * Everything is drawn in millimetres on the mat (drawStage has set the transform), and every
 * painter leaves the context as it found it (save / restore).
 *
 *   ground   the Fire marker (an orange and yellow flame 110 mm high in the middle of its square,
 *            and an orange frame just inside the dashed frame), and in the top left corner of each
 *            target square a half see-through picture of the item that belongs there - a green
 *            tick once the referee has taken that item off the field.
 *   body     the four items (round tokens) and the three obstacles (square tokens), by their kind
 *            (../../fire-cadet/game.ts itemBodyKind, obstacleBodyKind). A token is never drawn
 *            smaller than TOKEN_MIN_PIXELS across: on a small stage it is drawn larger than its
 *            base, with the true base as a darker square under it (N16). An obstacle the referee
 *            has lifted is not in World.bodies, so it is not drawn until it is back (D1).
 *   robot    the mTiny from above, at its true size, with its two amber sticks.
 *
 * The pictures are those of ./pictures.tsx, path for path, so a thing looks the same on the stage,
 * the score strip, the editor and the Rules window.
 *
 * Browser only (a 2-D canvas; Path2D for the pictures - without it, the tokens are drawn plain).
 */
import { DASHED_FRAMES, PLACES } from '../../fire-cadet/field';
import { itemBodyKind, itemId, obstacleBodyKind } from '../../fire-cadet/game';
import { FIRE_CADET, squareRect } from '../../fire-cadet/numbers';
import { ITEM_NAMES, OBSTACLE_KINDS, targetSquare, type FireCadetScenario, type ItemName } from '../../fire-cadet/scenario';
import type { Body } from '../../core/types';
import type { StagePainters, StageSim, StageView } from '../render';
import { PICTURES, TOKEN_ROUND, TOKEN_SQUARE, type PictureName } from './pictures';

const f = FIRE_CADET;

/** The picture of each element on the stage, by the kind of its body. */
export const PICTURE_OF_KIND: ReadonlyMap<string, PictureName> = new Map<string, PictureName>([
  ...ITEM_NAMES.map((item): [string, PictureName] => [itemBodyKind(item), item]),
  ...OBSTACLE_KINDS.map((kind): [string, PictureName] => [obstacleBodyKind(kind), kind]),
]);

/** The Fire marker: a flame this many mm high in the middle of its square (design 8.3). */
export const FLAME_MM = 110;
/** ... and an orange frame this wide just inside the dashed frame. */
export const FIRE_FRAME_MM = 6;
/** The target hints: a round picture this many mm across in the top left corner of the target square. */
export const HINT_MM = 44;
/** ... this far inside the corner of the square (clear of the black line and the dashed frame). */
const HINT_INSET_MM = 10;

/** How many 24-unit pictures fit in `mm`: the scale of the 24 x 24 box of ./pictures.tsx. */
const unit = (mm: number): number => mm / 24;

/** Draw a picture of ./pictures.tsx centred on the origin, `size` mm across. */
export function paintPicture(ctx: CanvasRenderingContext2D, name: PictureName, size: number): void {
  const art = PICTURES[name];
  ctx.save();
  const k = unit(size);
  ctx.scale(k, k);
  ctx.translate(-12, -12);
  if (art.token === 'round') {
    ctx.beginPath();
    ctx.arc(TOKEN_ROUND.cx, TOKEN_ROUND.cy, TOKEN_ROUND.r, 0, Math.PI * 2);
    ctx.fillStyle = art.fill;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = art.edge;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(TOKEN_ROUND.cx, TOKEN_ROUND.cy, TOKEN_ROUND.ring, 0, Math.PI * 2);
    ctx.lineWidth = TOKEN_ROUND.ringWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else if (art.token === 'square') {
    roundRect(ctx, TOKEN_SQUARE.x, TOKEN_SQUARE.y, TOKEN_SQUARE.size, TOKEN_SQUARE.size, TOKEN_SQUARE.radius);
    ctx.fillStyle = art.fill;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = art.edge;
    ctx.stroke();
  }
  if (typeof Path2D !== 'undefined') {
    for (const layer of art.layers) {
      ctx.fillStyle = layer.fill;
      ctx.fill(new Path2D(layer.d));
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** A soft shadow under what is drawn next (canvas shadows are in device pixels). */
function softShadow(ctx: CanvasRenderingContext2D, view: StageView, heightMm: number): void {
  const devicePerMm = view.scale * view.dpr;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.4)';
  ctx.shadowBlur = (2 + heightMm * 0.1) * devicePerMm;
  ctx.shadowOffsetX = heightMm * 0.06 * devicePerMm;
  ctx.shadowOffsetY = heightMm * 0.1 * devicePerMm;
}

function noShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** How large a token is drawn (mm): its base, or TOKEN_MIN_PIXELS across on a small stage (N16). */
export const tokenSize = (base: number, view: Pick<StageView, 'scale'>): number => Math.max(base, f.TOKEN_MIN_PIXELS / Math.max(1e-6, view.scale));

/** One item or obstacle, by its kind. False: not one of ours (the stage draws it as always). */
export function paintElement(ctx: CanvasRenderingContext2D, body: Body, view: StageView): boolean {
  const name = PICTURE_OF_KIND.get(body.kind);
  if (name === undefined) return false;
  const base = Math.min(body.w, body.l);
  const size = tokenSize(base, view);
  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle);
  if (size > base + 1e-6) {
    // drawn larger than it is: the true base under it, darker, so the referee's square is still seen
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(-body.w / 2, -body.l / 2, body.w, body.l);
  }
  softShadow(ctx, view, body.h * 0.5);
  // (the shadow belongs to the token only, not to every layer of the picture)
  ctx.beginPath();
  if (PICTURES[name].token === 'round') ctx.arc(0, 0, (size / 2) * (TOKEN_ROUND.r / 12), 0, Math.PI * 2);
  else roundRect(ctx, -size / 2, -size / 2, size, size, (size * TOKEN_SQUARE.radius) / 24);
  ctx.fillStyle = PICTURES[name].fill;
  ctx.fill();
  noShadow(ctx);
  paintPicture(ctx, name, size);
  ctx.restore();
  return true;
}

/** The Fire marker: a frame just inside the dashed frame of its place, and a flame in the middle. */
export function paintFireMarker(ctx: CanvasRenderingContext2D, scenario: Pick<FireCadetScenario, 'fire'>): void {
  const [left, top, right, bottom] = DASHED_FRAMES[scenario.fire];
  const inset = f.GRID_LINE_WIDTH / 2 + FIRE_FRAME_MM / 2 + 1;
  ctx.save();
  // (a frame at the edge of the map is cut at the edge)
  ctx.beginPath();
  ctx.rect(0, 0, f.MAT, f.MAT);
  ctx.clip();
  ctx.lineWidth = FIRE_FRAME_MM;
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.95)';
  ctx.strokeRect(left + inset, top + inset, right - left - 2 * inset, bottom - top - 2 * inset);
  const sq = squareRect(PLACES[scenario.fire]);
  ctx.translate(sq.x + sq.w / 2, sq.y + sq.h / 2);
  // the flame of the picture is 17 of its 24 units high: scale it to FLAME_MM
  const box = (FLAME_MM * 24) / 17;
  ctx.globalAlpha = 0.92;
  paintPicture(ctx, 'fire', box);
  ctx.restore();
}

/** Has the referee taken this item off the field (delivered)? Before the start every item is on it. */
export const isDelivered = (bodies: readonly Pick<Body, 'id'>[], item: ItemName): boolean => !bodies.some((b) => b.id === itemId(item));

/** The hint in the top left corner of a target square: the item that belongs there, or a green tick once it is delivered. */
export function paintTargetHint(ctx: CanvasRenderingContext2D, scenario: Pick<FireCadetScenario, 'fire'>, item: ItemName, delivered: boolean): void {
  const sq = squareRect(targetSquare(scenario, item));
  ctx.save();
  ctx.translate(sq.x + HINT_INSET_MM + HINT_MM / 2, sq.y + HINT_INSET_MM + HINT_MM / 2);
  if (delivered) {
    ctx.beginPath();
    ctx.arc(0, 0, HINT_MM / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#16a34a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-HINT_MM * 0.22, 0);
    ctx.lineTo(-HINT_MM * 0.05, HINT_MM * 0.17);
    ctx.lineTo(HINT_MM * 0.24, -HINT_MM * 0.16);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.55;
    paintPicture(ctx, item, HINT_MM);
  }
  ctx.restore();
}

/** The mTiny from above (design 8.3), at its pose. */
export function paintRobot(ctx: CanvasRenderingContext2D, sim: StageSim, view: StageView): void {
  const { pose } = sim.world.robot;
  const c = sim.robotConfig;
  const half = c.chassisWidth / 2;
  const front = c.chassisFront;
  const rear = c.chassisRear;
  const g = c.gripper;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);
  // from here on: x to the robot's right, y towards its back (the front is at negative y)

  // the body: white, round corners, a grey edge, a soft shadow
  softShadow(ctx, view, c.chassisHeight * 0.6);
  roundRect(ctx, -half, -front, 2 * half, front + rear, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  noShadow(ctx);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();

  // the two sticks: amber bars on the left and the right edge of the front, from the front of the body to their tips
  if (g.enabled) {
    const inner = g.clawOpenGap / 2;
    for (const side of [-1, 1] as const) {
      const x = side < 0 ? -inner - g.fingerThickness : inner;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x, -front - g.fingerLength, g.fingerThickness, g.fingerLength + 6);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#78350f';
      ctx.strokeRect(x, -front - g.fingerLength, g.fingerThickness, g.fingerLength + 6);
    }
  }

  // two black round ears on the front corners, inside the outline
  ctx.fillStyle = '#1f2937';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * (half - 17), -front + 17, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  // two round black eyes with light blue middles, at the front edge
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 15, -front + 13, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side * 15, -front + 13, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
  }
  // a soft blue arrowhead on its back, pointing forward
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(22, 26);
  ctx.lineTo(0, 16);
  ctx.lineTo(-22, 26);
  ctx.closePath();
  ctx.fillStyle = '#93c5fd';
  ctx.fill();
  ctx.restore();
}

/** The painters of the stage for this map (the Fire marker and the target hints depend on it). */
export function cadetPainters(scenario: FireCadetScenario): StagePainters {
  return {
    ground(ctx, sim) {
      paintFireMarker(ctx, scenario);
      for (const item of ITEM_NAMES) paintTargetHint(ctx, scenario, item, isDelivered(sim.world.bodies, item));
    },
    body: paintElement,
    robot: paintRobot,
  };
}
