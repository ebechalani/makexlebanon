/**
 * Helpers for fixed walls (FixedWall in ./types.ts), for referees and renderers.
 * The engine itself keeps its own packed copy of the walls for speed (./engine.ts).
 */
import { rayBoxDistance } from './engine-collide';
import type { OBB, Vec2 } from './geometry';
import type { FixedWall } from './types';

/** Footprint of a wall on the mat, seen from above. */
export function wallFootprint(wall: FixedWall): OBB {
  return { x: wall.x, y: wall.y, w: wall.w, l: wall.l, angle: wall.angle };
}

/**
 * The first wall that stands on the straight line from `a` to `b` (seen from above), or null
 * when the way is free. A wall that the line only reaches at its far end (at `b`) does not count.
 */
export function wallBetween(walls: readonly FixedWall[] | undefined, a: Vec2, b: Vec2): FixedWall | null {
  if (!walls || walls.length === 0) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return null;
  const ux = dx / length;
  const uy = dy / length;
  let first: FixedWall | null = null;
  let firstAt = length;
  for (const wall of walls) {
    const at = rayBoxDistance(a.x, a.y, ux, uy, wall.x, wall.y, wall.w / 2, wall.l / 2, Math.sin(wall.angle), Math.cos(wall.angle));
    if (at >= 0 && at < firstAt) {
      first = wall;
      firstAt = at;
    }
  }
  return first;
}
