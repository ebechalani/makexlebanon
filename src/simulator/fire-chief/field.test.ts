/**
 * The Fire Chief field: its measures, its cells, the 40 wall places, the fire target, what the
 * floor sensors see, and the robot the game is played with.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProbeReading } from '../core/engine-sensors';
import { VectorMatSampler } from '../core/mat';
import { DEG, obbCorners, pointInRect, rectContainsOBB, wrapAngle } from '../core/geometry';
import { DEFAULT_ROBOT_CONFIG, robotFitsInRect, robotShapesAt, robotSize } from '../core/robot';
import {
  BEDROOM_CELL,
  BEDROOM_COLOR,
  CELL_SIZE,
  FIELD_SIZE,
  FIRE_SPOTS,
  GRID_CELLS,
  GRID_LINE_COLOR,
  GRID_LINE_STARTS,
  GRID_LINE_WIDTH,
  INNER_WALL_COUNT,
  LIVING_ROOM_CELL,
  LIVING_ROOM_COLOR,
  MAT_VECTOR,
  ROBOT_MAX_HEIGHT,
  ROBOT_MAX_LENGTH,
  ROBOT_MAX_WIDTH,
  ROOMS,
  ROOM_IDS,
  SENSOR_MAX_HEIGHT,
  START_CELL,
  START_RECT,
  TARGET_DEPTH,
  TARGET_HEIGHT,
  TARGET_WIDTH,
  WALL_HEIGHT,
  WALL_POSITIONS,
  WALL_THICKNESS,
  cellAt,
  cellCenter,
  cellFromNumber,
  cellName,
  cellNumber,
  cellRect,
  innerWall,
  isCell,
  neighbours,
  outerWalls,
  roomRect,
  targetPose,
  wallIndexBetween,
  type Cell,
} from './field';
import { FAN, FIRE_CHIEF_ROBOT, FLAME_SENSOR, START_POSE } from './robot';

const near = (actual: number, expected: number, eps: number, what = 'value') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: ${actual} is not within ${eps} of ${expected}`);

const allCells = (): Cell[] => Array.from({ length: 25 }, (_, n) => cellFromNumber(n));

// =============================================================================================
// Mat and cells
// =============================================================================================

test('field: 1500 x 1500 mm, 5 x 5 cells of 300 mm; START bottom centre, the rooms in the top corners', () => {
  assert.equal(FIELD_SIZE, 1500);
  assert.equal(GRID_CELLS, 5);
  assert.equal(CELL_SIZE, 300);
  assert.deepEqual(START_CELL, { col: 2, row: 4 });
  assert.deepEqual(LIVING_ROOM_CELL, { col: 0, row: 0 });
  assert.deepEqual(BEDROOM_CELL, { col: 4, row: 0 });
  assert.deepEqual(START_RECT, { x: 600, y: 1200, w: 300, h: 300 });
  assert.deepEqual(roomRect('living'), { x: 0, y: 0, w: 300, h: 300 });
  assert.deepEqual(roomRect('bedroom'), { x: 1200, y: 0, w: 300, h: 300 });
  assert.deepEqual(ROOM_IDS, ['living', 'bedroom']);
  assert.equal(ROOMS.living.outerSide, 'left');
  assert.equal(ROOMS.bedroom.outerSide, 'right');
});

test('field: cells have a number, a name, a square and a middle', () => {
  const cells = allCells();
  assert.deepEqual(cells.map(cellNumber), Array.from({ length: 25 }, (_, n) => n));
  assert.equal(new Set(cells.map(cellName)).size, 25);
  assert.equal(cellName(LIVING_ROOM_CELL), 'A1');
  assert.equal(cellName(BEDROOM_CELL), 'E1');
  assert.equal(cellName(START_CELL), 'C5');
  assert.deepEqual(cellRect({ col: 3, row: 1 }), { x: 900, y: 300, w: 300, h: 300 });
  assert.deepEqual(cellCenter(START_CELL), { x: 750, y: 1350 });
  for (const cell of cells) {
    assert.ok(isCell(cell));
    assert.deepEqual(cellAt(cellCenter(cell).x, cellCenter(cell).y), cell);
    assert.ok(pointInRect(cellCenter(cell), cellRect(cell)));
  }
  assert.deepEqual(cellAt(0, 0), { col: 0, row: 0 });
  assert.deepEqual(cellAt(299.9, 300), { col: 0, row: 1 });
  assert.equal(cellAt(-1, 100), null);
  assert.equal(cellAt(100, 1500), null);
  assert.equal(cellAt(Number.NaN, 100), null);
  assert.equal(isCell({ col: 5, row: 0 }), false);
  assert.equal(isCell({ col: 0, row: -1 }), false);
  assert.equal(isCell({ col: 1.5, row: 0 }), false);
  // neighbours: 2 in a corner, 3 on an edge, 4 inside
  assert.equal(neighbours({ col: 0, row: 0 }).length, 2);
  assert.equal(neighbours(START_CELL).length, 3);
  assert.equal(neighbours({ col: 2, row: 2 }).length, 4);
});

// =============================================================================================
// Walls
// =============================================================================================

test('walls: 150 mm high and 3 mm thick', () => {
  assert.equal(WALL_HEIGHT, 150);
  assert.equal(WALL_THICKNESS, 3);
});

test('walls: 40 inner places - 20 between cells side by side, 20 between cells above each other', () => {
  assert.equal(INNER_WALL_COUNT, 40);
  assert.equal(WALL_POSITIONS.length, 40);
  assert.equal(WALL_POSITIONS.filter((p) => p.direction === 'upright').length, 20);
  assert.equal(WALL_POSITIONS.filter((p) => p.direction === 'level').length, 20);
  assert.deepEqual(WALL_POSITIONS.map((p) => p.index), Array.from({ length: 40 }, (_, i) => i));
  assert.equal(new Set(WALL_POSITIONS.map((p) => p.label)).size, 40);
  for (const p of WALL_POSITIONS) {
    const [a, b] = p.between;
    // it stands on the boundary between its two cells, in the middle of that boundary
    const ca = cellCenter(a);
    const cb = cellCenter(b);
    assert.equal(p.x, (ca.x + cb.x) / 2);
    assert.equal(p.y, (ca.y + cb.y) / 2);
    if (p.direction === 'upright') {
      assert.equal(a.row, b.row);
      assert.equal(b.col, a.col + 1);
      assert.equal(p.x % 300, 0);
    } else {
      assert.equal(a.col, b.col);
      assert.equal(b.row, a.row + 1);
      assert.equal(p.y % 300, 0);
    }
    assert.equal(p.label, `${cellName(a)}-${cellName(b)}`);
    // the index can be found again from the two cells, in either order
    assert.equal(wallIndexBetween(a, b), p.index);
    assert.equal(wallIndexBetween(b, a), p.index);
  }
  assert.equal(WALL_POSITIONS[0].label, 'A1-B1');
  assert.equal(WALL_POSITIONS[20].label, 'A1-A2');
  assert.equal(WALL_POSITIONS[39].label, 'E4-E5');
});

test('walls: every pair of neighbouring cells has exactly one wall place, other pairs have none', () => {
  const seen = new Set<number>();
  for (const cell of allCells()) {
    for (const next of neighbours(cell)) {
      const index = wallIndexBetween(cell, next);
      assert.ok(index >= 0 && index < 40, `${cellName(cell)}-${cellName(next)}`);
      seen.add(index);
    }
  }
  assert.equal(seen.size, 40);
  assert.equal(wallIndexBetween({ col: 0, row: 0 }, { col: 1, row: 1 }), -1, 'diagonal');
  assert.equal(wallIndexBetween({ col: 0, row: 0 }, { col: 2, row: 0 }), -1, 'two apart');
  assert.equal(wallIndexBetween({ col: 0, row: 0 }, { col: 0, row: 0 }), -1, 'the same cell');
  assert.equal(wallIndexBetween({ col: 4, row: 0 }, { col: 5, row: 0 }), -1, 'off the field');
  assert.equal(wallIndexBetween({ col: 0, row: -1 }, { col: 0, row: 0 }), -1);
});

test('walls: an inner wall panel is centred on its boundary and closes it from post to post', () => {
  for (const p of WALL_POSITIONS) {
    const wall = innerWall(p);
    assert.equal(wall.id, `wall:${p.label}`);
    assert.equal(wall.h, 150);
    assert.equal(wall.angle, 0);
    assert.equal(wall.x, p.x);
    assert.equal(wall.y, p.y);
    // 3 mm across its boundary, a cell (plus one thickness) along it
    assert.equal(p.direction === 'upright' ? wall.w : wall.l, 3);
    assert.equal(p.direction === 'upright' ? wall.l : wall.w, 303);
  }
  // free width of a cell between two walls: 300 mm minus two half walls
  const left = innerWall(WALL_POSITIONS[wallIndexBetween({ col: 1, row: 2 }, { col: 2, row: 2 })]);
  const right = innerWall(WALL_POSITIONS[wallIndexBetween({ col: 2, row: 2 }, { col: 3, row: 2 })]);
  assert.equal(right.x - right.w / 2 - (left.x + left.w / 2), 297);
});

test('walls: four outer walls stand just outside the mat and close it all around', () => {
  const walls = outerWalls();
  assert.deepEqual(walls.map((w) => w.id), ['wall:top', 'wall:right', 'wall:bottom', 'wall:left']);
  const [top, right, bottom, left] = walls;
  for (const wall of walls) assert.equal(wall.h, 150);
  // their inner faces are the four edges of the mat
  assert.equal(top.y + top.l / 2, 0);
  assert.equal(bottom.y - bottom.l / 2, 1500);
  assert.equal(left.x + left.w / 2, 0);
  assert.equal(right.x - right.w / 2, 1500);
  // and they overlap at the corners: no gap
  assert.ok(top.x - top.w / 2 <= left.x - left.w / 2);
  assert.ok(top.x + top.w / 2 >= right.x + right.w / 2);
  assert.ok(left.y - left.l / 2 <= top.y - top.l / 2);
  assert.ok(left.y + left.l / 2 >= bottom.y + bottom.l / 2);
});

// =============================================================================================
// The fire target
// =============================================================================================

test('fire target: 60 x 20 mm, 120 mm high (assumed), at three spots per room', () => {
  assert.equal(TARGET_WIDTH, 60);
  assert.equal(TARGET_DEPTH, 20);
  assert.equal(TARGET_HEIGHT, 120);
  assert.deepEqual(FIRE_SPOTS, ['corner', 'back', 'side']);
  assert.ok(TARGET_HEIGHT <= WALL_HEIGHT);
});

test('fire target: it stands inside its room, against the outer walls, and looks into the room', () => {
  for (const room of ROOM_IDS) {
    const rect = roomRect(room);
    const middle = { x: rect.x + 150, y: rect.y + 150 };
    for (const spot of FIRE_SPOTS) {
      const at = targetPose(room, spot);
      const box = { x: at.x, y: at.y, w: TARGET_WIDTH, l: TARGET_DEPTH, angle: at.angle };
      const corners = obbCorners(box);
      assert.ok(rectContainsOBB(rect, box), `${room} ${spot}: inside the room`);
      // it touches the outer wall(s) it stands against
      const toTop = Math.min(...corners.map((c) => c.y));
      const toSide = Math.min(...corners.map((c) => (room === 'living' ? c.x : 1500 - c.x)));
      if (spot !== 'side') near(toTop, 0, 1e-9, `${room} ${spot}: touches the top wall`);
      if (spot !== 'back') near(toSide, 0, 1e-9, `${room} ${spot}: touches the outer side wall`);
      if (spot === 'side') near(toTop, 150 - 30, 1e-9, 'in the middle of the side wall');
      if (spot === 'back') near(toSide, 150 - 30, 1e-9, 'in the middle of the top wall');
      // it faces into the room: 100 mm ahead of it is nearer to the middle of the room
      const ahead = { x: at.x + 100 * Math.sin(at.angle), y: at.y - 100 * Math.cos(at.angle) };
      assert.ok(
        Math.hypot(ahead.x - middle.x, ahead.y - middle.y) < Math.hypot(at.x - middle.x, at.y - middle.y) - 50,
        `${room} ${spot}: faces the room`,
      );
    }
    // the corner target is turned by 45 degrees and looks exactly at the middle of the room
    const corner = targetPose(room, 'corner');
    near(Math.abs(wrapAngle(corner.angle)), 135 * DEG, 1e-12);
    near(wrapAngle(Math.atan2(middle.x - corner.x, corner.y - middle.y) - corner.angle), 0, 1e-9);
  }
  // exact places in the living room
  assert.deepEqual(targetPose('living', 'back'), { x: 150, y: 10, angle: Math.PI });
  assert.deepEqual(targetPose('living', 'side'), { x: 10, y: 150, angle: Math.PI / 2 });
  near(targetPose('living', 'corner').x, 28.284, 0.001);
  near(targetPose('living', 'corner').y, 28.284, 0.001);
  // the bedroom is the mirror image of the living room
  for (const spot of FIRE_SPOTS) {
    const l = targetPose('living', spot);
    const b = targetPose('bedroom', spot);
    near(b.x, 1500 - l.x, 1e-9);
    near(b.y, l.y, 1e-9);
    // (mirrored left-right, a direction of +a degrees becomes -a degrees)
    near(wrapAngle(b.angle + l.angle), 0, 1e-9, `${spot}: mirrored direction`);
  }
});

// =============================================================================================
// What the floor sensors see
// =============================================================================================

test('mat: white cells, eight black grid lines where they are printed, the two rooms in their colours', () => {
  const mat = new VectorMatSampler(MAT_VECTOR);
  const white = { r: 255, g: 255, b: 255 };
  // the black of the lines as it is in the print file: dark enough for the Quad RGB sensor to
  // call it a line (its brightness is about 13 of 100; "line" is below 35) and to name it black
  assert.deepEqual(GRID_LINE_COLOR, { r: 35, g: 31, b: 32 });
  const seen = makeProbeReading(GRID_LINE_COLOR, FIRE_CHIEF_ROBOT.quadRgb.lineThreshold);
  assert.ok(seen.onLine && seen.light > 12 && seen.light < 13.5, `brightness ${seen.light}`);
  assert.equal(seen.color, 'black');
  const isBlack = (c: { r: number; g: number; b: number }): boolean =>
    c.r === GRID_LINE_COLOR.r && c.g === GRID_LINE_COLOR.g && c.b === GRID_LINE_COLOR.b;
  assert.equal(MAT_VECTOR.width, 1500);
  assert.equal(MAT_VECTOR.height, 1500);
  assert.equal(GRID_LINE_WIDTH, 6.5);
  assert.deepEqual(GRID_LINE_STARTS, [299.9, 599.8, 899.7, 1199.6]);
  // plain cells and START are white
  for (const cell of allCells()) {
    const c = cellCenter(cell);
    const expected =
      cellNumber(cell) === cellNumber(LIVING_ROOM_CELL)
        ? LIVING_ROOM_COLOR
        : cellNumber(cell) === cellNumber(BEDROOM_CELL)
          ? BEDROOM_COLOR
          : white;
    assert.deepEqual(mat.sample(c.x, c.y), expected, cellName(cell));
  }
  assert.deepEqual(LIVING_ROOM_COLOR, { r: 177, g: 125, b: 89 });
  assert.deepEqual(BEDROOM_COLOR, { r: 153, g: 123, b: 105 });
  // every line: white just before it, black from its start to 6.5 mm further, white after it
  for (const start of GRID_LINE_STARTS) {
    // (crossed in the white cells: next to a room the ground before the line is the room's picture)
    for (const across of [450, 750, 1050]) {
      // a line that runs up-down, crossed at height `across` ...
      assert.deepEqual(mat.sample(start - 0.2, across), white);
      assert.ok(isBlack(mat.sample(start + 0.2, across)));
      assert.ok(isBlack(mat.sample(start + 3.25, across)));
      assert.ok(isBlack(mat.sample(start + 6.3, across)));
      assert.deepEqual(mat.sample(start + 6.7, across), white);
      // ... and a line that runs left-right
      assert.deepEqual(mat.sample(across, start - 0.2), white);
      assert.ok(isBlack(mat.sample(across, start + 3.25)));
      assert.deepEqual(mat.sample(across, start + 6.7), white);
    }
    // the lines run from edge to edge, also past the rooms
    assert.ok(isBlack(mat.sample(start + 3, 1)));
    assert.ok(isBlack(mat.sample(start + 3, 1499)));
    assert.ok(isBlack(mat.sample(1, start + 3)));
    assert.ok(isBlack(mat.sample(1499, start + 3)));
  }
  // beside a room the picture reaches up to the line
  assert.deepEqual(mat.sample(299.7, 150), LIVING_ROOM_COLOR);
  assert.ok(isBlack(mat.sample(300.2, 150)));
  assert.deepEqual(mat.sample(1350, 299.7), BEDROOM_COLOR);
  assert.ok(isBlack(mat.sample(1350, 300.2)));
  // no printed line on the outer edge
  assert.deepEqual(mat.sample(1, 750), white);
  assert.deepEqual(mat.sample(750, 1499), white);
  // off the mat
  assert.deepEqual(mat.sample(-5, 750), MAT_VECTOR.outside);
  assert.equal(MAT_VECTOR.layers.filter((l) => l.kind === 'stroke').length, 8);
  assert.equal(MAT_VECTOR.layers.filter((l) => l.kind === 'rect').length, 2);
});

// =============================================================================================
// The robot
// =============================================================================================

test('robot: the mBot2 without gripper and front colour sensor, inside the size limits of the rules', () => {
  assert.equal(FIRE_CHIEF_ROBOT.gripper.enabled, false);
  assert.equal(FIRE_CHIEF_ROBOT.frontColorSensor.enabled, false);
  const size = robotSize(FIRE_CHIEF_ROBOT);
  assert.deepEqual(size, { length: 175, width: 130 });
  assert.ok(size.length <= ROBOT_MAX_LENGTH && ROBOT_MAX_LENGTH === 180);
  assert.ok(size.width <= ROBOT_MAX_WIDTH && ROBOT_MAX_WIDTH === 130);
  assert.ok(FIRE_CHIEF_ROBOT.chassisHeight <= ROBOT_MAX_HEIGHT);
  assert.equal(robotShapesAt(FIRE_CHIEF_ROBOT, START_POSE).length, 1);
  // it keeps the drive, the ultrasonic sensor and the Quad RGB sensor of the standard robot
  assert.equal(FIRE_CHIEF_ROBOT.maxRpm, DEFAULT_ROBOT_CONFIG.maxRpm);
  assert.equal(FIRE_CHIEF_ROBOT.wheelDiameter, DEFAULT_ROBOT_CONFIG.wheelDiameter);
  assert.equal(FIRE_CHIEF_ROBOT.trackWidth, DEFAULT_ROBOT_CONFIG.trackWidth);
  assert.deepEqual(FIRE_CHIEF_ROBOT.ultrasonic, DEFAULT_ROBOT_CONFIG.ultrasonic);
  assert.deepEqual(FIRE_CHIEF_ROBOT.quadRgb, DEFAULT_ROBOT_CONFIG.quadRgb);
  // the standard robot itself was not changed: it still has its gripper and no flame sensor or fan
  assert.equal(DEFAULT_ROBOT_CONFIG.gripper.enabled, true);
  assert.equal(DEFAULT_ROBOT_CONFIG.flameSensor, undefined);
  assert.equal(DEFAULT_ROBOT_CONFIG.fan, undefined);
});

test('robot: a flame sensor and a fan on M1 at its front, no sensor higher than 150 mm', () => {
  assert.equal(FIRE_CHIEF_ROBOT.flameSensor, FLAME_SENSOR);
  assert.deepEqual(FLAME_SENSOR, {
    enabled: true,
    forward: 105,
    height: 60,
    halfAngleDeg: 30,
    rangeMm: 1000,
    distancePower: 2,
    threshold: 10,
  });
  assert.equal(FIRE_CHIEF_ROBOT.fan, FAN);
  assert.deepEqual(FAN, { enabled: true, port: 'M1', forward: 105, minPower: 20, coneHalfAngleDeg: 20, reachMm: 300 });
  assert.equal(FLAME_SENSOR.forward, FIRE_CHIEF_ROBOT.chassisFront);
  assert.equal(FAN.forward, FIRE_CHIEF_ROBOT.chassisFront);
  assert.ok(FLAME_SENSOR.height <= SENSOR_MAX_HEIGHT);
  assert.ok(FIRE_CHIEF_ROBOT.ultrasonic.height <= SENSOR_MAX_HEIGHT);
  assert.ok(FIRE_CHIEF_ROBOT.chassisHeight <= SENSOR_MAX_HEIGHT);
  // the ultrasonic sensor is low enough to see the walls and the target
  assert.ok(FIRE_CHIEF_ROBOT.ultrasonic.height < WALL_HEIGHT);
  assert.ok(FIRE_CHIEF_ROBOT.ultrasonic.height < TARGET_HEIGHT);
});

test('robot: it starts facing up, completely inside START, turning point in the middle of the cell', () => {
  assert.deepEqual(START_POSE, { x: 750, y: 1350, heading: 0 });
  assert.ok(robotFitsInRect(FIRE_CHIEF_ROBOT, START_POSE, START_RECT));
  // in any direction it faces, it stays inside START and clear of walls on the sides of START
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const pose = { ...START_POSE, heading: degrees * DEG };
    for (const shape of robotShapesAt(FIRE_CHIEF_ROBOT, pose)) {
      for (const c of obbCorners(shape)) {
        assert.ok(c.x >= 601.5 && c.x <= 898.5 && c.y >= 1201.5 && c.y <= 1500, `heading ${degrees}: ${c.x}, ${c.y}`);
      }
    }
  }
  // 300 mm further up it is in the middle of the next cell
  assert.deepEqual(cellCenter({ col: 2, row: 3 }), { x: START_POSE.x, y: START_POSE.y - 300 });
});
