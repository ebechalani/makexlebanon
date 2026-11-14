/**
 * Placing the robot before the match: the whole robot (chassis and open gripper) must be inside
 * the start zone. These helpers work out poses that fit; the final word is always
 * Simulation.setStartPose(), which uses the same test.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import { DEG, obbCorners, wrapAngle, type Rect } from '../core/geometry';
import { robotFitsInRect, robotShapesAt } from '../core/robot';
import type { Pose, RobotConfig } from '../core/types';

/** Axis-aligned box around the whole robot at this pose. */
export function robotBounds(config: RobotConfig, pose: Pose): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of robotShapesAt(config, pose)) {
    for (const c of obbCorners(shape)) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/** The pose with this heading that puts the robot's bounding box in the middle of the zone. */
export function centredPose(config: RobotConfig, zone: Rect, heading: number): Pose {
  const h = wrapAngle(heading);
  const box = robotBounds(config, { x: 0, y: 0, heading: h });
  return {
    x: zone.x + zone.w / 2 - (box.minX + box.maxX) / 2,
    y: zone.y + zone.h / 2 - (box.minY + box.maxY) / 2,
    heading: h,
  };
}

export function poseFits(config: RobotConfig, zone: Rect, pose: Pose): boolean {
  return (
    Number.isFinite(pose.x) &&
    Number.isFinite(pose.y) &&
    Number.isFinite(pose.heading) &&
    robotFitsInRect(config, pose, zone)
  );
}

/**
 * Turn the robot to `heading`. If it no longer fits where it stands, try the middle of the zone
 * (a long robot only fits when it is centred). `legal` tells whether a fitting pose was found;
 * when it is false the returned pose is simply the old position with the new heading.
 */
export function rotatedPose(config: RobotConfig, zone: Rect, from: Pose, heading: number): { pose: Pose; legal: boolean } {
  const turned: Pose = { x: from.x, y: from.y, heading: wrapAngle(heading) };
  if (poseFits(config, zone, turned)) return { pose: turned, legal: true };
  const centred = centredPose(config, zone, heading);
  if (poseFits(config, zone, centred)) return { pose: centred, legal: true };
  return { pose: turned, legal: false };
}

/**
 * The button beside the two turning buttons brings the robot back to a place the student can
 * count on. Which place that is depends on where the game lets the robot start:
 *
 *   'middle'   The game's default start position IS the middle of the start zone (Fire Rescue:
 *              the robot with its open gripper is centred in the Fire Station). The button puts
 *              the robot into the middle and leaves it turned as it is.
 *   'default'  The game's default start position is somewhere else (Fire Chief: the point the
 *              robot turns around is in the middle of START, so the robot itself stands a little
 *              ahead of the middle). The ready-made programs of such a game count on exactly
 *              that position, and once the robot was dragged there would be no way back to it.
 *              The button puts the robot back there, facing as it faced at the default.
 */
export type HomeKind = 'middle' | 'default';

/** Two start positions closer together than this (mm) are the same position for the home button. */
const SAME_PLACE_MM = 0.5;

export function homeKind(config: RobotConfig, zone: Rect, defaultPose: Pose): HomeKind {
  const centred = centredPose(config, zone, defaultPose.heading);
  return Math.hypot(centred.x - defaultPose.x, centred.y - defaultPose.y) <= SAME_PLACE_MM ? 'middle' : 'default';
}

/** Where the home button puts a robot that now faces `heading` (see HomeKind). */
export function homePose(kind: HomeKind, config: RobotConfig, zone: Rect, defaultPose: Pose, heading: number): Pose {
  return kind === 'default' ? { x: defaultPose.x, y: defaultPose.y, heading: wrapAngle(defaultPose.heading) } : centredPose(config, zone, heading);
}

/** The name of the home button (for screen readers) and what it says when the pointer rests on it. */
export function homeButtonWords(kind: HomeKind, startZoneName: string): { label: string; hint: string } {
  return kind === 'default'
    ? { label: 'Put the robot back at its default start position', hint: `Back to the default start position in the ${startZoneName}` }
    : { label: `Put the robot in the middle of the ${startZoneName}`, hint: `Middle of the ${startZoneName}` };
}

/** Heading in whole degrees 0..359 for display (0 = up, 90 = right). */
export function headingDegrees(heading: number): number {
  // "+ 360, % 360" brings negative angles into 0..359 and also turns the "-0" that JavaScript
  // gives for tiny negative angles into a plain 0
  return ((Math.round(heading / DEG) % 360) + 360) % 360;
}

export function isPose(value: unknown): value is Pose {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return [p.x, p.y, p.heading].every((v) => typeof v === 'number' && Number.isFinite(v));
}
