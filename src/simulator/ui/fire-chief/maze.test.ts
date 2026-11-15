/**
 * The Fire Chief maze editor without a screen: the plan's wall places against the game's, the
 * arrow keys, the words about how hard a maze is and what kind of maze it is (a competition
 * maze or a practice maze), the code field, the lists of mazes for "Test on many mazes", and
 * what the editor says about a maze in which a room cannot be reached.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runMatch } from '../../core/batch';
import { makeRng } from '../../core/geometry';
import {
  CELL_SIZE,
  FIELD_SIZE,
  FIRE_SPOTS,
  INNER_WALL_COUNT,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  WALL_POSITIONS,
  cellCenter,
  cellName,
  cellNumber,
  cellRect,
  neighbours,
  targetPose,
  wallIndexBetween,
  type Cell,
} from '../../fire-chief/field';
import { TARGET_FILL, fireChiefGame } from '../../fire-chief/game';
import { FIRE_CHIEF_ROBOT, START_POSE } from '../../fire-chief/robot';
import {
  COMPETITION_WALLS_TEXT,
  COMPETITION_WALL_COUNTS,
  NAMED_MAZES,
  PERFECT_MAZE_WALLS,
  decodeScenario,
  defaultScenario,
  encodeScenario,
  isCompetitionMaze,
  namedMaze,
  openField,
  perfectMazeWalls,
  randomScenario,
  randomScenarioWithWalls,
  scenarioOfCode,
  scenarioProblems,
  stepsFrom,
  stepsToRoom,
  toggleWall,
  wallBetweenCells,
  withFire,
  withWall,
  type FireChiefScenario,
} from '../../fire-chief/scenario';
import { fireRescueGame } from '../../fire-rescue/game';
import { blankProgram } from '../program-file';
import { dcMotor, moveCm, program, script, wait, whenStart } from '../../vm/builder';
import { bestAndWorst, compareRuns, endSentence, scoreTimeText } from '../batch-words';
import { BatchDialog } from '../BatchDialog';
import { CombinationPanel } from '../CombinationPanel';
import { formatRefereeTime } from '../format';
import { codeReaderOf } from '../scenario-code';
import { screenWords } from '../screen-words';
import {
  FIRE_PLACES,
  MAZE_BATCH_PRESETS,
  MAZE_BATCH_RANDOM,
  RANDOM_MAZES_NOTE,
  RANDOM_MAZE_KINDS,
  namedKindsSentence,
  namedMazesEverywhere,
  randomKindLabel,
  randomMazes,
  stageMazeNote,
  withEveryFirePlace,
} from './maze-batch';
import { MAZE_CHOICES, RANDOM_MAZE_DRAWS } from './maze-choices';
import { EXAMPLE_MAZE_CODE, readMazeCode } from './maze-code';
import {
  COMPETITION_MAZE_HAS,
  HARDEST_LEVEL,
  KIND_WORD,
  LEVEL_NOTE,
  LEVEL_WALLS,
  LEVEL_WORD,
  LONG_WAY_CELLS,
  competitionMazeHas,
  corridorsOnly,
  kindSentence,
  levelFacts,
  levelTitle,
  mazeFacts,
  mazeKind,
  mazeLevel,
  wayFacts,
  type MazeFacts,
} from './maze-level';
import {
  PLAN_BOX,
  PLAN_CELL,
  PLAN_CELLS,
  PLAN_COLUMN_NAMES,
  PLAN_LINES,
  PLAN_ROW_NAMES,
  PLAN_SIZE,
  PLAN_WALLS,
  WALL_HIT_HALF,
  hitContains,
  hitOutline,
  hitShape,
  isPlanKey,
  movePlanFocus,
  percentAcross,
  percentDown,
  planFire,
  planFlame,
  planUnits,
  planWallOf,
  reachableCells,
  wallName,
  type PlanKey,
  type PlanWall,
} from './maze-plan';
import { OWN_MAZE_ABOUT, PLAN_HINT, practiceNote, wallHint } from './maze-words';
import { MazeEditor } from './MazeEditor';
import { FIRE_CHIEF_RULES } from './rules';
import { FIRE_CHIEF_WORDS } from './words';

const nothing = (): void => undefined;

/** What a reader sees: the tags taken out, quotation marks back as typed. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

/** A maze in which the robot cannot leave START: the three walls around START stand. */
function boxedStart(): FireChiefScenario {
  let s = openField('living', 'back');
  for (const next of neighbours(START_CELL)) s = withWall(s, wallIndexBetween(START_CELL, next), true);
  return s;
}

/** A maze in which only the bedroom is closed: its two doors are walled up. */
function closedBedroom(fireRoom: 'living' | 'bedroom' = 'living'): FireChiefScenario {
  let s = openField(fireRoom, 'corner');
  const bedroom = ROOMS.bedroom.cell;
  for (const next of neighbours(bedroom)) s = withWall(s, wallIndexBetween(bedroom, next), true);
  return s;
}

/**
 * A maze with 13 inner walls in which the bedroom is closed off: the default maze (13 walls)
 * with the two doors of the bedroom walled up and the two walls beside START taken away.
 */
function thirteenWallsClosedRoom(): FireChiefScenario {
  let s = defaultScenario();
  const bedroom = ROOMS.bedroom.cell;
  for (const next of neighbours(bedroom)) s = withWall(s, wallIndexBetween(bedroom, next), true);
  for (const next of neighbours(START_CELL)) if (next.row === START_CELL.row) s = withWall(s, wallIndexBetween(START_CELL, next), false);
  assert.equal(s.walls.filter(Boolean).length, 13);
  assert.deepEqual(scenarioProblems(s), ['There is no way from START to the bedroom: take a wall away.']);
  return s;
}

// =============================================================================================
// The plan: its wall places are the game's
// =============================================================================================

test('plan: its 40 wall places are the 40 of the game - same number, same name, same place', () => {
  assert.equal(PLAN_WALLS.length, INNER_WALL_COUNT);
  assert.equal(PLAN_WALLS.length, 40);
  assert.deepEqual(
    PLAN_WALLS.map((wall) => wall.index).sort((a, b) => a - b),
    WALL_POSITIONS.map((position) => position.index),
    'every number of the game once',
  );
  for (const wall of PLAN_WALLS) {
    const position = WALL_POSITIONS[wall.index];
    assert.equal(position.index, wall.index);
    assert.equal(wall.label, position.label);
    assert.equal(wall.direction, position.direction);
    // one cell of the mat (300 mm) is one cell of the plan (100 units)
    assert.equal(wall.x, (position.x / CELL_SIZE) * PLAN_CELL, wall.label);
    assert.equal(wall.y, (position.y / CELL_SIZE) * PLAN_CELL, wall.label);
    // it lies exactly between the middles of the two cells it separates, and is one cell long
    const [a, b] = position.between;
    assert.equal(wall.x, planUnits((cellCenter(a).x + cellCenter(b).x) / 2));
    assert.equal(wall.y, planUnits((cellCenter(a).y + cellCenter(b).y) / 2));
    assert.equal(Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y), PLAN_CELL);
    assert.equal((wall.from.x + wall.to.x) / 2, wall.x);
    assert.equal((wall.from.y + wall.to.y) / 2, wall.y);
    // an upright wall is drawn up-down, a level one left-right
    assert.equal(wall.from.x === wall.to.x, position.direction === 'upright');
    // the game finds the same place between these two cells
    assert.equal(wallIndexBetween(a, b), wall.index);
    // what a screen reader says names the two cells
    assert.equal(wall.name, `Wall between ${cellName(a)} and ${cellName(b)}`);
    assert.equal(wallName(position), wall.name);
    assert.equal(planWallOf(wall.index), wall);
  }
  assert.equal(new Set(PLAN_WALLS.map((wall) => wall.name)).size, 40, 'no two walls have the same name');
  assert.equal(planWallOf(40), undefined);
  assert.equal(planUnits(FIELD_SIZE), PLAN_SIZE);
});

test('plan: a wall switched on the plan is the wall the engine puts on the field', () => {
  const open = openField();
  const outer = fireChiefGame.createWalls?.(open) ?? [];
  assert.equal(outer.length, 4, 'the open field has the four walls around it');
  for (const wall of PLAN_WALLS) {
    const scenario = toggleWall(open, wall.index);
    assert.equal(scenario.walls.filter(Boolean).length, 1);
    const built = (fireChiefGame.createWalls?.(scenario) ?? []).filter((w) => !outer.some((o) => o.id === w.id));
    assert.equal(built.length, 1, wall.label);
    assert.equal(built[0].id, `wall:${wall.label}`);
    // its middle on the mat is the middle of the place on the plan
    assert.equal(planUnits(built[0].x), wall.x);
    assert.equal(planUnits(built[0].y), wall.y);
    // and it is long in the direction the plan draws it
    assert.equal(built[0].l > built[0].w, wall.direction === 'upright', wall.label);
    // the same click again takes it away
    assert.deepEqual(toggleWall(scenario, wall.index), open);
    // the two cells are cut off from each other by exactly this wall
    const [a, b] = WALL_POSITIONS[wall.index].between;
    assert.equal(wallBetweenCells(scenario.walls, a, b), true);
    assert.equal(wallBetweenCells(open.walls, a, b), false);
  }
});

/** The corners of a wall's button on the plan, from its CSS box and its CSS shape. */
function cssCorners(wall: PlanWall): Array<{ x: number; y: number }> {
  const shape = hitShape(wall.direction);
  const points = [...shape.matchAll(/([\d.]+)% ([\d.]+)%/g)].map((m) => ({ px: Number(m[1]), py: Number(m[2]) }));
  assert.equal(points.length, 6, shape);
  const left = PLAN_BOX.x + (wall.box.left / 100) * PLAN_BOX.w;
  const top = PLAN_BOX.y + (wall.box.top / 100) * PLAN_BOX.h;
  const width = (wall.box.width / 100) * PLAN_BOX.w;
  const height = (wall.box.height / 100) * PLAN_BOX.h;
  return points.map((p) => ({ x: left + (p.px / 100) * width, y: top + (p.py / 100) * height }));
}

/** Is the point inside the polygon? (the usual "count the crossings" rule) */
function inside(polygon: Array<{ x: number; y: number }>, x: number, y: number): boolean {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
}

test('plan: no point of the plan means two walls, and the middle of a cell means none', () => {
  // every 2.3 units across the whole field. (The points are chosen so that none lies exactly on
  // the edge between two areas - there both walls are equally near, and CSS gives the point to
  // the button that is drawn last.)
  let owned = 0;
  let free = 0;
  for (let y = 0.71; y < PLAN_SIZE; y += 2.3) {
    for (let x = 0.37; x < PLAN_SIZE; x += 2.3) {
      const hits = PLAN_WALLS.filter((wall) => hitContains(wall, x, y));
      assert.ok(hits.length <= 1, `(${x}, ${y}) means ${hits.map((w) => w.label).join(' and ')}`);
      if (hits.length === 1) {
        owned++;
        // the wall that is meant is the nearest wall place
        const nearest = [...PLAN_WALLS].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        assert.equal(Math.hypot(hits[0].x - x, hits[0].y - y), Math.hypot(nearest.x - x, nearest.y - y));
      } else free++;
    }
  }
  assert.ok(owned > free, 'most of the plan answers to a wall');
  // the middle of every cell - where START and the names of the rooms are written - switches nothing
  for (const cell of PLAN_CELLS) {
    const mid = { x: cell.x + PLAN_CELL / 2, y: cell.y + PLAN_CELL / 2 };
    for (const [dx, dy] of [[0, 0], [10, 0], [0, -10], [-12, 12]]) {
      assert.equal(PLAN_WALLS.some((wall) => hitContains(wall, mid.x + dx, mid.y + dy)), false, cell.name);
    }
  }
  // a click right on a wall place means that wall
  for (const wall of PLAN_WALLS) assert.ok(hitContains(wall, wall.x, wall.y));
});

test('plan: the button of a wall has exactly the shape the plan means, and is large enough for a finger', () => {
  for (const wall of PLAN_WALLS) {
    const corners = cssCorners(wall);
    // the CSS shape and the rule of hitContains() agree, point by point
    for (let dy = -60; dy <= 60; dy += 4.3) {
      for (let dx = -60; dx <= 60; dx += 4.3) {
        const x = wall.x + dx;
        const y = wall.y + dy;
        assert.equal(inside(corners, x, y), hitContains(wall, x, y), `${wall.label} at (${dx.toFixed(1)}, ${dy.toFixed(1)})`);
      }
    }
    // the outline that is drawn for the keyboard focus is that same shape
    const outline = hitOutline(wall)
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    assert.equal(outline.length, 6);
    outline.forEach(([x, y], i) => {
      assert.ok(Math.abs(x - corners[i].x) < 1e-9 && Math.abs(y - corners[i].y) < 1e-9, `${wall.label} corner ${i}`);
    });
    // the button lies on the plan and is centred on its wall
    assert.ok(wall.box.left >= 0 && wall.box.top >= 0 && wall.box.left + wall.box.width <= 100 && wall.box.top + wall.box.height <= 100, wall.label);
    assert.ok(Math.abs(wall.box.left + wall.box.width / 2 - percentAcross(wall.x)) < 1e-9);
    assert.ok(Math.abs(wall.box.top + wall.box.height / 2 - percentDown(wall.y)) < 1e-9);
    // a circle of 35 units around the middle of the wall is all inside its area ...
    for (let angle = 0; angle < 360; angle += 15) {
      const x = wall.x + 35 * Math.cos((angle * Math.PI) / 180);
      const y = wall.y + 35 * Math.sin((angle * Math.PI) / 180);
      assert.ok(hitContains(wall, x, y), `${wall.label} at ${angle} degrees`);
    }
  }
  // ... and on the smallest plan (288 px wide, on a phone 360 px wide) that circle is 37 px across:
  // more than the 24 px a finger target must have at least
  const smallestPlan = 288;
  const across = (2 * 35 * smallestPlan) / PLAN_BOX.w;
  assert.ok(across > 36 && across < 38, `${across.toFixed(1)} px`);
  assert.equal(WALL_HIT_HALF, 0.36);
  // the drawing is a square that holds the whole field, with room for the names of the columns and rows
  assert.equal(PLAN_BOX.w, PLAN_BOX.h);
  assert.ok(PLAN_BOX.x < 0 && PLAN_BOX.y < 0 && PLAN_BOX.x + PLAN_BOX.w > PLAN_SIZE && PLAN_BOX.y + PLAN_BOX.h > PLAN_SIZE);
  assert.equal(percentAcross(PLAN_BOX.x), 0);
  assert.equal(percentDown(PLAN_BOX.y + PLAN_BOX.h), 100);
});

test('plan: the cells - START at the bottom centre, the two rooms in the top corners, named like the walls name them', () => {
  assert.equal(PLAN_CELLS.length, 25);
  assert.deepEqual(PLAN_CELLS.filter((cell) => cell.kind === 'start').map((cell) => cell.name), ['C5']);
  assert.deepEqual(PLAN_CELLS.filter((cell) => cell.kind === 'living').map((cell) => cell.name), ['A1']);
  assert.deepEqual(PLAN_CELLS.filter((cell) => cell.kind === 'bedroom').map((cell) => cell.name), ['E1']);
  for (const [n, cell] of PLAN_CELLS.entries()) {
    assert.equal(cellNumber(cell.cell), n);
    assert.equal(cell.x, planUnits(cellRect(cell.cell).x));
    assert.equal(cell.y, planUnits(cellRect(cell.cell).y));
    // the name of a cell is the letter over its column and the number beside its row
    assert.equal(cell.name, PLAN_COLUMN_NAMES[cell.cell.col] + PLAN_ROW_NAMES[cell.cell.row]);
  }
  assert.deepEqual(PLAN_COLUMN_NAMES, ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(PLAN_ROW_NAMES, ['1', '2', '3', '4', '5']);
});

test('plan: the fire is drawn where the game puts it, in its room, for all six places', () => {
  for (const room of ROOM_IDS) {
    const cell = PLAN_CELLS.find((c) => c.kind === room);
    assert.ok(cell);
    for (const spot of FIRE_SPOTS) {
      const fire = planFire(room, spot);
      const pose = targetPose(room, spot);
      assert.equal(fire.x, planUnits(pose.x));
      assert.equal(fire.y, planUnits(pose.y));
      assert.equal(fire.width, 20, '60 mm wide');
      assert.ok(Math.abs(fire.depth - 20 / 3) < 1e-9, '20 mm deep');
      assert.ok(Math.abs(fire.turn - (pose.angle * 180) / Math.PI) < 1e-9);
      // the target and the flame sign in front of it are inside the cell of the room
      const flame = planFlame(room, spot);
      for (const p of [fire, flame]) {
        assert.ok(p.x > cell.x && p.x < cell.x + PLAN_CELL && p.y > cell.y && p.y < cell.y + PLAN_CELL, `${room} ${spot}`);
      }
      // the flame sign is in front of the target: further into the room than the target itself
      const mid = { x: cell.x + PLAN_CELL / 2, y: cell.y + PLAN_CELL / 2 };
      assert.ok(Math.hypot(flame.x - mid.x, flame.y - mid.y) < Math.hypot(fire.x - mid.x, fire.y - mid.y), `${room} ${spot}`);
    }
  }
  // the six places are six different points
  const points = ROOM_IDS.flatMap((room) => FIRE_SPOTS.map((spot) => `${planFire(room, spot).x.toFixed(2)},${planFire(room, spot).y.toFixed(2)}`));
  assert.equal(new Set(points).size, 6);
});

test('plan: the cells that cannot be reached from START are the ones the game cannot reach', () => {
  assert.ok(reachableCells(defaultScenario().walls).every(Boolean), 'in the default maze every cell can be reached');
  const boxed = reachableCells(boxedStart().walls);
  assert.equal(boxed.filter(Boolean).length, 1);
  assert.equal(boxed[cellNumber(START_CELL)], true);
  const closed = reachableCells(closedBedroom().walls);
  assert.equal(closed[cellNumber(ROOMS.bedroom.cell)], false);
  assert.equal(closed.filter(Boolean).length, 24);
  for (let seed = 1; seed <= 40; seed++) {
    const maze = randomScenario(makeRng(seed));
    const steps = stepsFrom(maze.walls, START_CELL);
    assert.deepEqual(reachableCells(maze.walls), steps.map((n) => n >= 0));
  }
});

// =============================================================================================
// The arrow keys
// =============================================================================================

test('keyboard: the walls are read in nine lines from top to bottom, each from left to right', () => {
  assert.deepEqual(PLAN_LINES.map((line) => line.length), [4, 5, 4, 5, 4, 5, 4, 5, 4]);
  assert.deepEqual(PLAN_LINES[0].map((wall) => wall.label), ['A1-B1', 'B1-C1', 'C1-D1', 'D1-E1']);
  assert.deepEqual(PLAN_LINES[1].map((wall) => wall.label), ['A1-A2', 'B1-B2', 'C1-C2', 'D1-D2', 'E1-E2']);
  assert.deepEqual(PLAN_LINES[8].map((wall) => wall.label), ['A5-B5', 'B5-C5', 'C5-D5', 'D5-E5']);
  assert.deepEqual(PLAN_WALLS, PLAN_LINES.flat());
  PLAN_LINES.forEach((line, i) => {
    assert.ok(line.every((wall) => wall.y === line[0].y), 'one line, one height');
    assert.ok(line.every((wall, k) => k === 0 || wall.x > line[k - 1].x), 'from left to right');
    if (i > 0) assert.ok(line[0].y > PLAN_LINES[i - 1][0].y, 'from top to bottom');
    assert.ok(line.every((wall) => wall.direction === (i % 2 === 0 ? 'upright' : 'level')));
  });
});

test('keyboard: left and right go along a line, up and down to the nearest wall of the next line, Home and End to its ends', () => {
  const at = (label: string): number => PLAN_WALLS.find((wall) => wall.label === label)?.index ?? -1;
  const label = (index: number): string => planWallOf(index)?.label ?? '?';
  const go = (from: string, ...keys: PlanKey[]): string => {
    let state: { index: number; column?: number } = { index: at(from) };
    for (const key of keys) state = movePlanFocus(state.index, key, state.column);
    return label(state.index);
  };
  assert.equal(go('A1-B1', 'ArrowRight'), 'B1-C1');
  assert.equal(go('A1-B1', 'ArrowRight', 'ArrowRight', 'ArrowRight'), 'D1-E1');
  assert.equal(go('D1-E1', 'ArrowRight'), 'D1-E1', 'at the end of a line the focus stays');
  assert.equal(go('A1-B1', 'ArrowLeft'), 'A1-B1');
  assert.equal(go('B3-C3', 'ArrowLeft'), 'A3-B3');
  assert.equal(go('C2-C3', 'Home'), 'A2-A3');
  assert.equal(go('C2-C3', 'End'), 'E2-E3');
  // down from a wall between two cells: of the two walls under them, the left one
  assert.equal(go('A1-B1', 'ArrowDown'), 'A1-A2');
  assert.equal(go('B3-C3', 'ArrowDown'), 'B3-B4');
  // down and down again stays in the column it started in; up twice comes back
  assert.equal(go('B1-C1', 'ArrowDown', 'ArrowDown'), 'B2-C2');
  assert.equal(go('B1-C1', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp'), 'B1-C1');
  assert.equal(go('C2-C3', 'ArrowDown', 'ArrowUp'), 'C2-C3');
  assert.equal(go('E4-E5', 'ArrowDown'), 'D5-E5');
  assert.equal(go('A1-B1', 'ArrowUp'), 'A1-B1', 'above the first line there is nothing');
  assert.equal(go('C5-D5', 'ArrowDown'), 'C5-D5', 'below the last line there is nothing');
  // left / right set the column anew
  assert.equal(go('A1-B1', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown'), 'B2-C2');
  // a number that is no wall place moves nowhere and does not break
  assert.deepEqual(movePlanFocus(99, 'ArrowDown'), { index: 99, column: 0 });

  // every wall can be reached from every other wall with the arrow keys alone
  const seen = new Set<number>([PLAN_WALLS[0].index]);
  const queue = [PLAN_WALLS[0].index];
  for (let head = 0; head < queue.length; head++) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const) {
      const next = movePlanFocus(queue[head], key).index;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, 40);

  assert.ok(isPlanKey('ArrowUp') && isPlanKey('Home') && isPlanKey('End'));
  assert.ok(!isPlanKey(' ') && !isPlanKey('Enter') && !isPlanKey('Tab'), 'space and Enter press the button, Tab leaves the plan');
});

// =============================================================================================
// How hard a maze is
// =============================================================================================

test('level: the five named mazes get the level the game itself gives them', () => {
  for (const maze of NAMED_MAZES) {
    assert.equal(mazeLevel(mazeFacts(maze.scenario)), maze.level, maze.name);
  }
  assert.deepEqual(NAMED_MAZES.map((maze) => maze.level), [1, 2, 3, 4, 5]);
  assert.equal(HARDEST_LEVEL, Math.max(...NAMED_MAZES.map((maze) => maze.level)));
  // the choices of the editor say the same level in their own sentence
  for (const choice of MAZE_CHOICES) {
    const maze = NAMED_MAZES.find((m) => m.id === choice.id);
    assert.ok(maze);
    // (after its kind: "Competition maze. Level 4 of 5. ...")
    assert.ok(choice.about.includes(`maze. Level ${mazeLevel(mazeFacts(maze.scenario))} of ${HARDEST_LEVEL}. `), choice.about);
  }
});

test('level: what is counted in the default maze, in "Crossroads" and in the open field, checked by hand', () => {
  // the default maze, "Detour" with the fire in the living room: 13 walls; C5 up to C3, left to A3, up into A1
  const first = mazeFacts(defaultScenario());
  assert.deepEqual(first, { walls: 13, way: 6, turns: 2, deadEnds: 0, closedCells: 0, oneWayOnly: false, bothRooms: true });
  assert.equal(levelTitle(first), 'Level 4 of 5: hard');
  assert.equal(levelFacts(first), '13 inner walls. The shortest way from START into the room of the fire is 6 cells long (1.8 m) with 2 turns.');
  // Crossroads: 10 walls; C5 up to C4, left to A4, up to A2, right to B2, up to B1, left into A1
  const crossroads = mazeFacts(namedMaze('crossroads') as FireChiefScenario);
  assert.deepEqual(crossroads, { walls: 10, way: 8, turns: 5, deadEnds: 2, closedCells: 0, oneWayOnly: false, bothRooms: true });
  assert.equal(levelTitle(crossroads), 'Level 3 of 5: medium');
  assert.equal(levelFacts(crossroads), '10 inner walls. The shortest way from START into the room of the fire is 8 cells long (2.4 m) with 5 turns. 2 dead ends.');
  // the open field: straight up four cells and two to the side - one turn
  const open = mazeFacts(openField('bedroom', 'side'));
  assert.deepEqual(open, { walls: 0, way: 6, turns: 1, deadEnds: 0, closedCells: 0, oneWayOnly: false, bothRooms: true });
  assert.equal(levelTitle(open), 'Level 1 of 5: very easy');
  assert.equal(levelFacts(open), 'No inner walls. The shortest way from START into the room of the fire is 6 cells long (1.8 m) with 1 turn.');
  // the perfect maze of the game: one way only
  const oneWay = mazeFacts(namedMaze('one-way') as FireChiefScenario);
  assert.equal(oneWay.walls, PERFECT_MAZE_WALLS);
  assert.equal(oneWay.oneWayOnly, true);
  assert.equal(levelTitle(oneWay), 'Level 5 of 5: very hard');
  assert.match(levelFacts(oneWay), /16 inner walls\. .* There is only one way to each room\.$/);
  // the way is to the room of the fire: it changes with the room
  const detour = namedMaze('detour') as FireChiefScenario;
  const detourLiving = mazeFacts(withFire(detour, 'living'));
  const detourBedroom = mazeFacts(withFire(detour, 'bedroom'));
  assert.equal(detourLiving.way, stepsToRoom(detour, 'living'));
  assert.equal(detourBedroom.way, stepsToRoom(detour, 'bedroom'));
  assert.notEqual(detourLiving.way, detourBedroom.way);
});

test('level: the bands of the wall count, one level more for a long way, never more than 5', () => {
  const facts = (walls: number, way = 6): MazeFacts => ({ walls, way, turns: 1, deadEnds: 0, closedCells: 0, oneWayOnly: false, bothRooms: true });
  assert.deepEqual(LEVEL_WALLS, [0, 6, 11, 15]);
  assert.deepEqual(
    [0, 1, 6, 7, 11, 12, 15, 16, 25, 40].map((walls) => mazeLevel(facts(walls))),
    [1, 2, 2, 3, 3, 4, 4, 5, 5, 5],
  );
  assert.equal(LONG_WAY_CELLS, 10);
  assert.equal(mazeLevel(facts(5, 9)), 2);
  assert.equal(mazeLevel(facts(5, 10)), 3, 'a long way to the fire makes it one level harder');
  assert.equal(mazeLevel(facts(16, 24)), 5, 'never more than 5');
  assert.deepEqual(Object.values(LEVEL_WORD), ['very easy', 'easy', 'medium', 'hard', 'very hard']);
  // every random maze of the game gets a level, and the levels are spread
  const seen = new Map<number, number>();
  for (let seed = 1; seed <= 400; seed++) {
    const level = mazeLevel(mazeFacts(randomScenario(makeRng(seed))));
    assert.ok(level !== null && level >= 2 && level <= 5, `seed ${seed}: ${level}`);
    seen.set(level, (seen.get(level) ?? 0) + 1);
  }
  assert.deepEqual([...seen.keys()].sort(), [2, 3, 4, 5]);
  // the note says what the level is made of, and does not promise more
  assert.match(LEVEL_NOTE, /counted from the number of walls and the length of the way/);
  assert.match(LEVEL_NOTE, /For your program another maze can be harder/);
});

/** The fewest quarter turns of a shortest way, found the slow way: by trying every shortest way. */
function slowFewestTurns(walls: readonly boolean[], goal: Cell): number {
  const steps = stepsFrom(walls, START_CELL);
  const DIRS = [
    { col: 0, row: -1 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: -1, row: 0 },
  ];
  let best = Infinity;
  const walk = (cell: Cell, facing: number, turns: number): void => {
    if (turns >= best) return;
    if (cell.col === goal.col && cell.row === goal.row) {
      best = turns;
      return;
    }
    DIRS.forEach((d, dir) => {
      const next = { col: cell.col + d.col, row: cell.row + d.row };
      if (next.col < 0 || next.col > 4 || next.row < 0 || next.row > 4) return;
      if (wallBetweenCells(walls, cell, next)) return;
      // (only steps of a shortest way: one step further from START each time)
      if (steps[cellNumber(next)] !== steps[cellNumber(cell)] + 1) return;
      const quarter = Math.min((dir - facing + 4) % 4, (facing - dir + 4) % 4);
      walk(next, dir, turns + quarter);
    });
  };
  walk(START_CELL, 0, 0);
  return best;
}

test('level: the turns are the fewest of all shortest ways (compared with trying every way, on 300 mazes)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const maze = randomScenario(makeRng(seed * 7));
    const facts = mazeFacts(maze);
    const goal = ROOMS[maze.fireRoom].cell;
    assert.equal(facts.way, stepsFrom(maze.walls, START_CELL)[cellNumber(goal)], `seed ${seed}`);
    assert.equal(facts.turns, slowFewestTurns(maze.walls, goal), `seed ${seed}: ${encodeScenario(maze)}`);
    assert.ok(facts.turns >= 1, 'a room is never straight ahead of START');
    assert.equal(facts.bothRooms, true);
    assert.equal(facts.walls, maze.walls.filter(Boolean).length);
  }
  // a perfect maze has no ring: one way only, and every dead end is a cell with one open side
  for (let seed = 1; seed <= 30; seed++) {
    const walls = perfectMazeWalls(makeRng(seed));
    const facts = mazeFacts({ walls, fireRoom: 'living', fireSpot: 'back' });
    assert.equal(facts.oneWayOnly, true);
    assert.equal(facts.closedCells, 0);
    assert.equal(facts.walls, PERFECT_MAZE_WALLS);
  }
});

test('level: a maze in which the fire cannot be reached has no level, and the words say why', () => {
  const boxed = mazeFacts(boxedStart());
  assert.equal(boxed.way, -1);
  assert.equal(mazeLevel(boxed), null);
  assert.equal(levelTitle(boxed), 'No level');
  assert.equal(boxed.closedCells, 24);
  assert.equal(boxed.bothRooms, false);
  assert.equal(levelFacts(boxed), '3 inner walls. There is no way from START into the room of the fire. 24 cells are closed off.');
  // the other room is closed, the fire can be reached: there is a level
  const other = mazeFacts(closedBedroom('living'));
  assert.equal(mazeLevel(other), 2);
  assert.equal(other.bothRooms, false);
  assert.match(levelFacts(other), /^2 inner walls\. The shortest way .* is 6 cells long \(1\.8 m\) with 1 turn\. 1 cell is closed off\.$/);
  // one wall, one dead end: singular words
  const single = mazeFacts(withWall(openField(), 0, true));
  assert.match(levelFacts(single), /^1 inner wall\. /);
});

// =============================================================================================
// A maze in which a room cannot be reached: practice
// =============================================================================================

test('practice maze: a maze with a closed room gets a note - what is wrong in the game\'s own words, and that an attempt is still possible', () => {
  // (the note is about a room that cannot be reached; what kind of maze it is, every maze is told in the box "How hard is this maze?")
  for (const maze of [defaultScenario(), openField(), ...NAMED_MAZES.map((m) => m.scenario)]) assert.equal(practiceNote(maze), null);
  const closed = closedBedroom();
  const note = practiceNote(closed);
  assert.ok(note);
  // the sentences are the game's (Game.scenarioProblems), unchanged
  assert.deepEqual(note.problems, fireChiefGame.scenarioProblems?.(closed));
  assert.deepEqual(note.problems, ['There is no way from START to the bedroom: take a wall away.']);
  assert.equal(note.title, 'This is a practice maze, not a competition maze.');
  assert.equal(note.meaning, 'A competition maze has 13 or 16 inner walls and a way from START to both rooms. You can still start an attempt in this maze to practise.');
  assert.ok(note.meaning.includes(COMPETITION_MAZE_HAS));
  assert.match(note.meaning, /You can still start an attempt in this maze to practise/);
  // both rooms closed: both sentences
  assert.equal(practiceNote(boxedStart())?.problems.length, 2);
  // the note never says the maze "cannot be played" - it can, for practice
  const said = [note.title, ...note.problems, note.meaning].join(' ');
  assert.ok(!/cannot be played|error|invalid/i.test(said), said);
});

test('practice maze: an attempt in it runs like any other - nothing breaks, and the referee counts as always', () => {
  // the robot is boxed in START and drives against the wall for a while
  const drive = program([script(whenStart(), [moveCm('forward', 60), wait(0.5)])]);
  const boxed = runMatch({ game: fireChiefGame, scenario: boxedStart(), program: drive });
  assert.equal(boxed.total, 0, 'it cannot leave START');
  assert.equal(boxed.finishReason, 'program-ended');
  // the fire room can be reached, the other room is closed: the points are earned as in any maze
  const toLiving = program([script(whenStart(), [moveCm('forward', 30)])]);
  const result = runMatch({ game: fireChiefGame, scenario: closedBedroom('living'), program: toLiving });
  assert.equal(result.total, 10);
  assert.equal(result.scenarioCode, encodeScenario(closedBedroom('living')));
  // an empty program, and a fan that is left on until the time is up
  assert.equal(runMatch({ game: fireChiefGame, scenario: boxedStart(), program: blankProgram() }).total, 0);
  const fan = runMatch({ game: fireChiefGame, scenario: boxedStart(), program: program([script(whenStart(), [dcMotor('M1', 100)])]) });
  assert.equal(fan.finishReason, 'time');
  // the game still describes such a maze without breaking, and its code is a code
  assert.match(fireChiefGame.describeScenario(boxedStart()), /no way from START/);
  assert.equal(fireChiefGame.createWalls?.(boxedStart()).length, 4 + 3);
});

// =============================================================================================
// The code field
// =============================================================================================

test('code: every maze the editor can show has a code that reads back to the same maze', () => {
  const mazes = [defaultScenario(), boxedStart(), closedBedroom('bedroom'), ...namedMazesEverywhere(), ...randomMazes(20, 3, 13), ...randomMazes(20, 3, 16)];
  // (and mazes of the mixed generator, with 4 to 16 walls)
  for (let seed = 1; seed <= 40; seed++) mazes.push(randomScenario(makeRng(seed)));
  // every single wall on its own
  for (const wall of PLAN_WALLS) mazes.push(toggleWall(openField('bedroom', 'side'), wall.index));
  // all 40 walls
  mazes.push({ walls: new Array<boolean>(40).fill(true), fireRoom: 'living', fireSpot: 'side' });
  for (const maze of mazes) {
    const code = encodeScenario(maze);
    const reading = readMazeCode(code);
    assert.ok(reading.ok, code);
    assert.deepEqual(reading.scenario, maze, code);
    // typed in small letters, with spaces instead of dashes, or with nothing between
    for (const typed of [code.toLowerCase(), code.replace(/-/g, ' '), `  ${code.replace(/-/g, '')}  `]) {
      const again = readMazeCode(typed);
      assert.ok(again.ok && encodeScenario(again.scenario) === code, typed);
    }
  }
  // a browser that saved the code of the old default maze gets that maze back: "Crossroads", a practice maze
  const saved = readMazeCode('LC-4406-N0E0');
  assert.ok(saved.ok);
  assert.deepEqual(saved.scenario, namedMaze('crossroads'));
  assert.equal(kindSentence(mazeFacts(saved.scenario)), 'Practice maze: 10 inner walls. A competition maze has 13 or 16 inner walls.');
  // the code shown as an example is the code of the default maze
  assert.equal(EXAMPLE_MAZE_CODE, 'LC-H8G6-69T0');
  assert.equal(EXAMPLE_MAZE_CODE, encodeScenario(defaultScenario()));
});

test('code: the code of a maze that cannot be played is a code too - the game refuses it, the editor shows it', () => {
  for (const maze of [boxedStart(), closedBedroom('living'), closedBedroom('bedroom')]) {
    const code = encodeScenario(maze);
    assert.equal(decodeScenario(code), null, 'the game plays only mazes with a way to both rooms');
    assert.equal(fireChiefGame.decodeScenario(code), null);
    assert.deepEqual(scenarioOfCode(code), maze);
    const reading = readMazeCode(code);
    assert.ok(reading.ok);
    assert.deepEqual(reading.scenario, maze);
    // ... and the editor then says what is wrong with it
    assert.ok((practiceNote(reading.scenario)?.problems.length ?? 0) > 0);
  }
  // for a maze that can be played the two readers agree
  for (let seed = 1; seed <= 60; seed++) {
    const code = encodeScenario(randomScenario(makeRng(seed)));
    const reading = readMazeCode(code);
    assert.ok(reading.ok);
    assert.deepEqual(reading.scenario, decodeScenario(code));
  }
});

test('code: a text that is no code gets one plain sentence that says what a code looks like', () => {
  const sentence = (typed: string): string => {
    const reading = readMazeCode(typed);
    assert.equal(reading.ok, false, typed);
    return reading.ok ? '' : reading.problem;
  };
  assert.equal(sentence(''), 'Type a maze code into the field. A maze code looks like LC-H8G6-69T0.');
  assert.equal(sentence('   '), 'Type a maze code into the field. A maze code looks like LC-H8G6-69T0.');
  assert.equal(sentence('hello'), 'This is not a maze code: a maze code has 10 letters and digits, and this text has 5. A maze code looks like LC-H8G6-69T0.');
  assert.equal(sentence('LC-4406-N0E'), 'This is not a maze code: a maze code has 10 letters and digits, and this text has 9. A maze code looks like LC-H8G6-69T0.');
  assert.equal(
    sentence('XC-4406-N0E0'),
    'This is not a maze code: the first letter says where the fire is, L (living room) or B (bedroom). This text begins with X. A maze code looks like LC-H8G6-69T0.',
  );
  assert.equal(
    sentence('LX-4406-N0E0'),
    'This is not a maze code: the second letter says where the fire stands in its room, C (corner), B (back wall) or S (side wall). This text has X there. A maze code looks like LC-H8G6-69T0.',
  );
  assert.equal(sentence('LC-44U6-N0E0'), 'This is not a maze code: U is never used in a maze code. Please check the code. A maze code looks like LC-H8G6-69T0.');
  assert.equal(sentence('LC-4406-N0E0'.repeat(30)), 'This text is too long for a maze code. A maze code looks like LC-H8G6-69T0.');
  // a Fire Rescue code is no maze code
  assert.match(sentence(fireRescueGame.encodeScenario(fireRescueGame.defaultScenario())), /^This is not a maze code/);
  // letters that are easy to mix up are understood, as the game understands them: O as 0, I and L as 1
  const mixed = readMazeCode('LC-44O6-NOEO');
  assert.ok(mixed.ok && encodeScenario(mixed.scenario) === 'LC-4406-N0E0');

  // whatever is typed: never an exception, never a technical word, always whole sentences
  const odd = ['\u0000', '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥', '<script>alert(1)</script>', '__proto__', 'null', 'undefined', 'NaN', '0'.repeat(10), 'L'.repeat(10), '-'.repeat(500), 'ＬＣ４４０６Ｎ０Ｅ０', 'LC-4406-N0E0\n', 'lc 4406 n0e0!'];
  const rng = makeRng(11);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-  lcbs';
  for (let i = 0; i < 3000; i++) {
    const length = Math.floor(rng() * 16);
    let typed = '';
    for (let k = 0; k < length; k++) typed += letters[Math.floor(rng() * letters.length)];
    odd.push(typed);
  }
  let codes = 0;
  for (const typed of odd) {
    const reading = readMazeCode(typed);
    if (reading.ok) {
      codes++;
      assert.equal(reading.scenario.walls.length, 40);
      assert.ok(reading.scenario.walls.every((wall) => typeof wall === 'boolean'));
      // what was read is what the game writes for that maze
      const again = readMazeCode(encodeScenario(reading.scenario));
      assert.ok(again.ok);
      assert.deepEqual(again.scenario, reading.scenario);
    } else {
      assert.match(reading.problem, /^(Type a maze code|This is not a maze code|This text is too long)/, JSON.stringify(typed));
      assert.match(reading.problem, /A maze code looks like LC-H8G6-69T0\.$/);
      assert.ok(!/error|exception|undefined|null|NaN|invalid|\[object/i.test(reading.problem), reading.problem);
      assert.ok(reading.problem.length < 220, reading.problem);
    }
  }
  assert.ok(codes >= 3, 'some of the texts are codes');
  // (not a string at all - a saved setting that is broken - is no code either)
  assert.equal(readMazeCode(undefined as unknown as string).ok, false);
  assert.equal(readMazeCode(42 as unknown as string).ok, false);
});

test('code: a game that brings no reader of its own keeps the sentence of Fire Rescue, letter for letter', () => {
  const read = codeReaderOf(fireRescueGame);
  const example = fireRescueGame.encodeScenario(fireRescueGame.defaultScenario());
  assert.deepEqual(read('zzz'), { ok: false, problem: `"zzz" is not a combination code. A code looks like ${example}.` });
  assert.deepEqual(read('  zzz '), { ok: false, problem: `"zzz" is not a combination code. A code looks like ${example}.` });
  const good = read(example);
  assert.ok(good.ok);
  assert.deepEqual(good.scenario, fireRescueGame.defaultScenario());
  // the same reader for Fire Chief would refuse a practice maze: that is why Fire Chief brings its own
  assert.equal(codeReaderOf(fireChiefGame)(encodeScenario(boxedStart())).ok, false);
});

// =============================================================================================
// The lists of "Test on many mazes"
// =============================================================================================

test('test lists: the fire has six places, and "this maze" is played with the fire at each of them', () => {
  assert.equal(FIRE_PLACES.length, ROOM_IDS.length * FIRE_SPOTS.length);
  assert.equal(FIRE_PLACES.length, 6);
  assert.equal(new Set(FIRE_PLACES.map((place) => `${place.room}/${place.spot}`)).size, 6);
  const mine = withFire(toggleWall(defaultScenario(), 3), 'bedroom', 'side');
  const list = withEveryFirePlace(mine);
  assert.equal(list.length, 6);
  for (const [i, maze] of list.entries()) {
    assert.deepEqual(maze.walls, mine.walls, 'the walls of the maze on the stage');
    assert.notEqual(maze.walls, mine.walls, 'a copy');
    assert.equal(maze.fireRoom, FIRE_PLACES[i].room);
    assert.equal(maze.fireSpot, FIRE_PLACES[i].spot);
  }
  assert.equal(new Set(list.map(encodeScenario)).size, 6);
  assert.deepEqual(new Set(list.map((maze) => maze.fireRoom)), new Set(ROOM_IDS));
  assert.deepEqual(new Set(list.map((maze) => maze.fireSpot)), new Set(FIRE_SPOTS));
});

test('test lists: the named mazes are the game\'s five, each with the fire at its six places, all playable', () => {
  const list = namedMazesEverywhere();
  assert.equal(list.length, NAMED_MAZES.length * 6);
  assert.equal(list.length, 30);
  assert.equal(new Set(list.map(encodeScenario)).size, 30);
  NAMED_MAZES.forEach((maze, i) => {
    for (const entry of list.slice(i * 6, i * 6 + 6)) assert.deepEqual(entry.walls, maze.scenario.walls, maze.name);
  });
  for (const maze of list) assert.deepEqual(scenarioProblems(maze), []);
});

test('test lists: random mazes are competition mazes with exactly 13 or 16 inner walls - different, playable, the same for the same seed - and the fire goes round its six places', () => {
  for (const walls of COMPETITION_WALL_COUNTS) {
    for (const count of [10, 50, 200]) {
      const list = randomMazes(count, 1, walls);
      assert.equal(list.length, count);
      assert.equal(new Set(list.map((maze) => encodeScenario(maze).slice(3))).size, count, 'no maze twice');
      for (const maze of list) {
        assert.equal(maze.walls.filter(Boolean).length, walls, `exactly ${walls} inner walls`);
        assert.deepEqual(scenarioProblems(maze), []);
        assert.equal(isCompetitionMaze(maze), true);
        assert.equal(mazeKind(mazeFacts(maze)), 'competition');
        assert.equal(mazeFacts(maze).closedCells, 0, 'every cell can be reached');
        assert.deepEqual(decodeScenario(encodeScenario(maze)), maze);
      }
      // both rooms and all three spots, and no place more than once more often than another
      const perPlace = FIRE_PLACES.map((place) => list.filter((maze) => maze.fireRoom === place.room && maze.fireSpot === place.spot).length);
      assert.ok(Math.min(...perPlace) >= 1, `${count}: ${perPlace.join(', ')}`);
      assert.ok(Math.max(...perPlace) - Math.min(...perPlace) <= 1, `${count}: ${perPlace.join(', ')}`);
      // ... in turn, as the note says: maze 1 has the first place, maze 7 has it again
      list.forEach((maze, i) => assert.deepEqual([maze.fireRoom, maze.fireSpot], [FIRE_PLACES[i % 6].room, FIRE_PLACES[i % 6].spot]));
      assert.deepEqual(randomMazes(count, 1, walls), list, 'the same seed, the same list');
      assert.notDeepEqual(randomMazes(count, 2, walls), list, 'another seed, other mazes');
    }
    // odd counts never break it
    assert.deepEqual(randomMazes(0, 1, walls), []);
    assert.deepEqual(randomMazes(-3, 1, walls), []);
    assert.deepEqual(randomMazes(Number.NaN, 1, walls), []);
    assert.equal(randomMazes(7.9, 1, walls).length, 7);
  }
  // with 16 walls every maze of the list has corridors only
  for (const maze of randomMazes(50, 4, 16)) assert.equal(corridorsOnly(mazeFacts(maze)), true);
  for (const maze of randomMazes(50, 4, 13)) assert.equal(mazeFacts(maze).oneWayOnly, false);
  assert.match(RANDOM_MAZES_NOTE, /each of its six places in turn/);
});

test('test lists: the random lists come in two kinds, one for each number of inner walls of a competition maze', () => {
  // one kind per number of the organiser's constant, in its order; the first one is chosen when the window opens
  assert.deepEqual(RANDOM_MAZE_KINDS.map((kind) => kind.id), COMPETITION_WALL_COUNTS.map((walls) => `walls-${walls}`));
  assert.deepEqual(RANDOM_MAZE_KINDS.map((kind) => kind.label), COMPETITION_WALL_COUNTS.map(randomKindLabel));
  assert.deepEqual(RANDOM_MAZE_KINDS.map((kind) => kind.label), ['13 inner walls', '16 inner walls (corridors only)']);
  COMPETITION_WALL_COUNTS.forEach((walls, i) => {
    assert.deepEqual(RANDOM_MAZE_KINDS[i].draw(12, 7), randomMazes(12, 7, walls));
    assert.ok(RANDOM_MAZE_KINDS[i].draw(12, 7).every((maze) => maze.walls.filter(Boolean).length === walls));
  });
  assert.equal(MAZE_BATCH_RANDOM.kinds, RANDOM_MAZE_KINDS);
  assert.deepEqual(MAZE_BATCH_RANDOM.draw(12, 7), RANDOM_MAZE_KINDS[0].draw(12, 7));
  assert.equal(MAZE_BATCH_RANDOM.name, 'competition mazes');
  assert.equal(MAZE_BATCH_RANDOM.kindsLegend, 'Competition mazes with');
  assert.equal(MAZE_BATCH_RANDOM.note, RANDOM_MAZES_NOTE);

  // the window: three random lists of competition mazes, and one small choice between the two kinds beside the seed
  const dialog = (game: typeof fireChiefGame, extra: object): string =>
    renderToStaticMarkup(
      createElement(BatchDialog<FireChiefScenario>, {
        game,
        robotConfig: FIRE_CHIEF_ROBOT,
        getProgram: () => blankProgram(),
        startPose: START_POSE,
        getSampler: () => undefined,
        currentScenario: defaultScenario(),
        onPick: nothing,
        onClose: nothing,
        ...extra,
      }),
    );
  const html = dialog(fireChiefGame, { presets: MAZE_BATCH_PRESETS, random: MAZE_BATCH_RANDOM, words: screenWords(FIRE_CHIEF_WORDS) });
  const said = text(html);
  for (const count of [10, 50, 200]) assert.ok(said.includes(`${count} random competition mazes`), `${count}`);
  assert.match(html, /role="radiogroup" aria-label="Competition mazes with"/);
  const kinds = [...html.matchAll(/<input type="radio"[^>]*name="batch-random-kind"[^>]*>([^<]*)/g)].map((m) => ({ tag: m[0], label: m[1] }));
  assert.deepEqual(kinds.map((kind) => kind.label), ['13 inner walls', '16 inner walls (corridors only)']);
  assert.deepEqual(kinds.map((kind) => /\schecked=""/.test(kind.tag)), [true, false], 'the first kind is chosen');
  assert.ok(said.includes(RANDOM_MAZES_NOTE));
  // a game without kinds (Fire Rescue) has no such choice, and its lists are called what they were
  const plain = dialog(fireChiefGame, { words: screenWords(FIRE_CHIEF_WORDS) });
  assert.ok(!plain.includes('batch-random-kind'));
  assert.ok(text(plain).includes('50 random mazes'));
});

test('test lists: what the window offers - the numbers in the names are the lengths of the lists', () => {
  assert.deepEqual(MAZE_BATCH_PRESETS.map((preset) => preset.id), ['named-mazes', 'this-maze']);
  const stage = defaultScenario();
  const [named, mine] = MAZE_BATCH_PRESETS;
  assert.equal(named.label, 'The 5 named mazes, fire at every place (30)');
  assert.equal(named.scenarios(stage).length, 30);
  assert.equal(
    named.hint,
    'Open field, Two doors, Crossroads, Detour, One way only: each one with the fire at its 6 places. Detour and One way only are competition mazes, the others are practice mazes.',
  );
  assert.equal(namedKindsSentence(), 'Detour and One way only are competition mazes, the others are practice mazes.');
  assert.deepEqual(NAMED_MAZES.filter((maze) => isCompetitionMaze(maze.scenario)).map((maze) => maze.name), ['Detour', 'One way only']);
  assert.equal(mine.label, 'This maze, fire at every place (6)');
  assert.equal(mine.scenarios(stage).length, 6);
  assert.deepEqual(mine.scenarios(stage)[0].walls, stage.walls);
  // nothing to add about a competition maze; a practice maze is called what it is, with what a
  // competition maze has that it has not - and, for a closed room, what is wrong in the game's words
  assert.equal(named.note, undefined);
  assert.equal(mine.note, stageMazeNote);
  assert.equal(mine.note?.(stage), null);
  assert.equal(mine.note?.(namedMaze('one-way') as FireChiefScenario), null);
  assert.equal(
    mine.note?.(namedMaze('crossroads') as FireChiefScenario),
    'The maze on the stage is a practice maze, not a competition maze: a competition maze has 13 or 16 inner walls.',
  );
  assert.equal(
    mine.note?.(closedBedroom()),
    'The maze on the stage is a practice maze, not a competition maze: a competition maze has 13 or 16 inner walls and a way from START to both rooms. ' +
      'There is no way from START to the bedroom: take a wall away.',
  );
  assert.equal(
    mine.note?.(thirteenWallsClosedRoom()),
    'The maze on the stage is a practice maze, not a competition maze: a competition maze has a way from START to both rooms. ' +
      'There is no way from START to the bedroom: take a wall away.',
  );
  // such a list can be played all the same: six results, no exception
  const results = mine.scenarios(closedBedroom()).map((scenario) => runMatch({ game: fireChiefGame, scenario, program: blankProgram() }));
  assert.equal(results.length, 6);
  assert.ok(results.every((result) => result.total === 0 && result.finishReason === 'program-ended'));
});

test('test results: where the time of the points ranks, the best run is the one with the most points and then the shortest time', () => {
  const run = (total: number, scoreTime?: number) => ({ total, scoreTime });
  assert.ok(compareRuns(run(100, 40), run(80, 10)) < 0, 'more points rank higher');
  assert.ok(compareRuns(run(100, 40), run(100, 37.2)) > 0, 'equal points: the shorter time ranks higher');
  assert.equal(compareRuns(run(30, 12), run(30, 12)), 0);
  assert.equal(compareRuns(run(0), run(0)), 0, 'no points, no time: equal');
  const runs = [run(30, 20), run(100, 61), run(0), run(100, 37.2), run(30, 25), run(0)];
  const found = bestAndWorst(runs);
  assert.equal(found?.best, runs[3]);
  assert.equal(found?.worst, runs[2]);
  assert.equal(bestAndWorst([]), null);
  assert.equal(scoreTimeText(run(100, 37.29), formatRefereeTime), '0:37.2', 'cut off like the referee cuts it');
  assert.equal(scoreTimeText(run(0), formatRefereeTime), '-');
  assert.equal(scoreTimeText(run(0), formatRefereeTime, ''), '');
  // how a run ended: the referee's own sentence where the referee ended it, otherwise the reason and the time
  const detail = 'Mission complete at 0:37.2: the fan blew at the fire for 3 seconds.';
  assert.equal(endSentence({ finishReason: 'mission-complete', finishDetail: detail, time: 37.2, restarts: 0 }, formatRefereeTime), detail);
  assert.equal(endSentence({ finishReason: 'time', time: 180, restarts: 0 }, formatRefereeTime), 'Time is up at 3:00.0.');
  assert.equal(endSentence({ finishReason: 'program-ended', time: 2.19, restarts: 1 }, formatRefereeTime), 'The program ended at 0:02.1. 1 restart used.');
  assert.equal(endSentence({ finishReason: 'time', time: 180, restarts: 2 }, formatRefereeTime), 'Time is up at 3:00.0. 2 restarts used.');
});

test('test results: a real run of each kind says how it ended in the referee\'s words, with the time of its points', () => {
  // leaves START and stops: 10 points at the moment it was out, ended because the program ended
  const short = runMatch({ game: fireChiefGame, scenario: defaultScenario(), program: program([script(whenStart(), [moveCm('forward', 30)])]) });
  assert.equal(short.total, 10);
  assert.ok(short.scoreTime !== undefined && short.scoreTime < short.time);
  assert.match(endSentence(short, formatRefereeTime), /^The program ended at 0:0\d\.\d\.$/);
  assert.match(scoreTimeText(short, formatRefereeTime), /^0:0\d\.\d$/);
  // nothing earned: no time of the points
  const none = runMatch({ game: fireChiefGame, scenario: defaultScenario(), program: blankProgram() });
  assert.equal(none.scoreTime, undefined);
  assert.equal(scoreTimeText(none, formatRefereeTime), '-');
  // Fire Rescue has no such referee: its results carry no time of the points and no sentence
  const rescue = runMatch({ game: fireRescueGame, scenario: fireRescueGame.defaultScenario(), program: blankProgram() });
  assert.equal(rescue.scoreTime, undefined);
  assert.equal(rescue.finishDetail, undefined);
  assert.equal(fireRescueGame.createReferee, undefined);
  assert.notEqual(fireChiefGame.createReferee, undefined);
});

// =============================================================================================
// The editor and the panel around it, drawn without a browser
// =============================================================================================

const editorHtml = (scenario: FireChiefScenario): string => renderToStaticMarkup(createElement(MazeEditor, { scenario, onChange: nothing }));

test('editor: every wall place is a button with a name, pressed or not, and one of them is the stop of the Tab key', () => {
  const maze = defaultScenario();
  const html = editorHtml(maze);
  const buttons = html.match(/<button\b[^>]*data-wall-index="\d+"[^>]*>/g) ?? [];
  assert.equal(buttons.length, 40);
  const standing: number[] = [];
  for (const tag of buttons) {
    const index = Number(/data-wall-index="(\d+)"/.exec(tag)?.[1]);
    const wall = planWallOf(index);
    assert.ok(wall, tag);
    assert.ok(tag.includes(`aria-label="${wall.name}"`), tag);
    assert.ok(tag.includes('type="button"'));
    const pressed = /aria-pressed="(true|false)"/.exec(tag)?.[1];
    assert.equal(pressed, String(maze.walls[index] === true), wall.label);
    if (pressed === 'true') standing.push(index);
    // what the pointer is told
    assert.ok(tag.includes(`title="${wallHint(wall.name, maze.walls[index] === true)}"`), tag);
  }
  assert.equal(standing.length, 13, 'the default maze has thirteen walls');
  // the buttons come in the order of the plan's lines
  assert.deepEqual(buttons.map((tag) => Number(/data-wall-index="(\d+)"/.exec(tag)?.[1])), PLAN_WALLS.map((wall) => wall.index));
  // one stop for the Tab key; the arrow keys reach the others
  assert.equal(buttons.filter((tag) => tag.includes('tabindex="0"')).length, 1);
  assert.equal(buttons.filter((tag) => tag.includes('tabindex="-1"')).length, 39);
  // the walls that stand are drawn, by the game's names
  const drawn = [...html.matchAll(/data-wall="([A-E][1-5]-[A-E][1-5])"/g)].map((m) => m[1]).sort();
  assert.deepEqual(drawn, standing.map((index) => WALL_POSITIONS[index].label).sort());
  // the plan says how it is used, also with the keyboard
  assert.ok(text(html).includes(PLAN_HINT));
  assert.match(PLAN_HINT, /Click or tap/);
  assert.match(PLAN_HINT, /arrow keys/);
  assert.match(PLAN_HINT, /space bar/);
  assert.match(html, /role="group" aria-label="Plan of the maze: the 40 places where an inner wall can stand"/);
});

test('editor: the fire, the ready-made mazes and the level are on it; a practice maze gets its note', () => {
  const html = editorHtml(withFire(defaultScenario(), 'bedroom', 'side'));
  assert.match(html, /data-fire="bedroom-side"/);
  // the target on the plan has the red of the target on the stage (the rules call it red, and the colour sensor reads "red" on it)
  assert.equal(TARGET_FILL, '#dc2626');
  assert.match(html, /<g data-fire="bedroom-side"><rect [^>]*fill="#dc2626"/);
  assert.ok(!/<g data-fire="[^"]*"><rect [^>]*fill="#f97316"/.test(html), 'not orange');
  // room and place: two groups of which one choice is checked
  assert.match(html, /role="radiogroup" aria-label="Room of the fire"/);
  assert.match(html, /role="radiogroup" aria-label="Place of the fire in its room"/);
  assert.match(html, /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>Bedroom<\/button>/);
  assert.match(html, /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>Side wall<\/button>/);
  assert.match(html, /<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>Living room<\/button>/);
  // the five ready-made mazes, each with its kind on the button; the one on the plan is pressed
  const choiceButton = (label: string): string => {
    const tag = new RegExp(`<button[^>]*data-maze-choice="[a-z-]+"[^>]*>(?:(?!</button>).)*>${label.replace(/[()]/g, '\\$&')}</span>(?:(?!</button>).)*</button>`).exec(html);
    assert.ok(tag, `the button "${label}"`);
    return tag[0];
  };
  for (const choice of MAZE_CHOICES) {
    const button = choiceButton(choice.label);
    assert.ok(button.includes(`data-choice-kind="${choice.kind}"`), choice.label);
    assert.equal(text(button).trim(), `${choice.label} ${choice.kindLabel}`, 'the name, then the kind');
    assert.ok(button.includes(`title="${choice.about}"`), choice.label);
  }
  assert.match(choiceButton('Detour (default maze)'), /aria-pressed="true"/);
  assert.match(choiceButton('Open field'), /aria-pressed="false"/);
  assert.equal(text(choiceButton('Detour (default maze)')).trim(), 'Detour (default maze) competition maze');
  assert.equal(text(choiceButton('Crossroads')).trim(), 'Crossroads practice maze');
  const said = text(html);
  assert.ok(said.includes('Level 4 of 5: hard'));
  // the kind of the maze on the stage, with its walls; then the ways
  assert.match(html, /data-maze-level="4" data-maze-kind="competition"/);
  assert.ok(said.includes('Competition maze: 13 inner walls. The shortest way from START into the room of the fire is 8 cells long (2.4 m) with 3 turns.'), said);
  assert.ok(said.includes(LEVEL_NOTE));
  // the sentence under the buttons is the one of the maze on the plan
  assert.ok(said.includes('Competition maze. Level 4 of 5. Thirteen walls. Narrow corridors, two ways to the bedroom and a big dead end.'));
  // a maze with a way to both rooms has no note - but the place for it is there, so that a screen reader hears it appear
  assert.match(html, /<div role="status" aria-live="polite"><\/div>/);
  assert.ok(!said.includes('This is a practice maze'));

  // a maze of one's own: none of the ready-made ones is pressed
  const own = editorHtml(toggleWall(defaultScenario(), 0));
  assert.ok(text(own).includes(OWN_MAZE_ABOUT));
  assert.ok(!/<button[^>]*aria-pressed="true"[^>]*data-maze-choice/.test(own));
  assert.equal((own.match(/data-maze-choice=/g) ?? []).length, 5);
  // (it has one wall less than the default maze: a practice maze, and the box says what a competition maze has)
  assert.match(own, /data-maze-kind="practice"/);
  assert.ok(text(own).includes('Practice maze: 12 inner walls. A competition maze has 13 or 16 inner walls.'));

  // a maze in which the bedroom cannot be reached
  const closed = editorHtml(closedBedroom());
  const closedSaid = text(closed);
  assert.ok(closedSaid.includes('This is a practice maze, not a competition maze.'));
  assert.ok(closedSaid.includes('There is no way from START to the bedroom: take a wall away.'));
  assert.ok(closedSaid.includes('You can still start an attempt in this maze to practise.'));
  // the box and the note call it the same thing, and say the same about a competition maze
  assert.ok(closedSaid.includes('Practice maze: 2 inner walls, and a room cannot be reached. A competition maze has 13 or 16 inner walls and a way from START to both rooms.'));
  assert.equal(closedSaid.split('A competition maze has 13 or 16 inner walls and a way from START to both rooms.').length, 3, 'in the box and in the note');
  assert.match(closed, /data-cell="E1"[^>]*data-closed=""/, 'the closed room is drawn as closed');
  assert.ok(!/data-cell="A1"[^>]*data-closed/.test(closed));
  // and one in which nothing can be reached still draws, with "No level"
  const boxed = text(editorHtml(boxedStart()));
  assert.ok(boxed.includes('No level'));
  assert.ok(boxed.includes('There is no way from START to the living room: take a wall away.'));
  // all 40 walls: nothing breaks
  assert.equal((editorHtml({ walls: new Array<boolean>(40).fill(true), fireRoom: 'living', fireSpot: 'corner' }).match(/aria-pressed="true"[^>]*data-wall-index/g) ?? []).length, 40);
});

test('panel: in Fire Chief the code is a "maze code"; Fire Rescue keeps every word it had', () => {
  const chiefWords = screenWords(FIRE_CHIEF_WORDS);
  const chief = renderToStaticMarkup(createElement(CombinationPanel<FireChiefScenario>, { game: fireChiefGame, scenario: defaultScenario(), onChange: nothing, words: chiefWords, readCode: readMazeCode }));
  assert.match(chief, /aria-label="Maze code LC-H8G6-69T0"/);
  assert.match(chief, /aria-label="Copy the maze code"/);
  // without draws of its own a game has one "Random" button, with the game's word on it
  assert.match(chief, />Random competition maze<\/button>/);
  assert.match(chief, />Default maze<\/button>/);
  assert.match(chief, /title="The default maze \(Detour, a competition maze with 13 inner walls\) with the fire in the corner of the living room"/);
  assert.ok(!chief.includes('data-random-draws'));
  assert.ok(text(chief).includes('More than 100 billion mazes have a way from START to both rooms. Changing the maze or the place of the fire puts the field back to the start.'));
  assert.ok(!/combination/i.test(text(chief)), 'no "combination" on the Fire Chief panel');
  // the code of a practice maze is shown like any other
  const practice = renderToStaticMarkup(createElement(CombinationPanel<FireChiefScenario>, { game: fireChiefGame, scenario: boxedStart(), onChange: nothing, words: chiefWords, readCode: readMazeCode }));
  assert.ok(practice.includes(`aria-label="Maze code ${encodeScenario(boxedStart())}"`));

  const rescue = renderToStaticMarkup(createElement(CombinationPanel<ReturnType<typeof fireRescueGame.defaultScenario>>, { game: fireRescueGame, scenario: fireRescueGame.defaultScenario(), onChange: nothing }));
  const code = fireRescueGame.encodeScenario(fireRescueGame.defaultScenario());
  assert.ok(rescue.includes(`aria-label="Combination code ${code}"`));
  assert.ok(rescue.includes('aria-label="Copy the combination code"'));
  assert.ok(rescue.includes(' combinations are possible. Changing the combination puts the field back to the start.'));
  assert.ok(rescue.includes(fireRescueGame.scenarioCount().toLocaleString('en')));
  assert.match(rescue, /title="Draw a random combination, like the referee does"/);
  assert.match(rescue, />Random<\/button>/);
  assert.ok(!rescue.includes('data-random-draws'));
  assert.ok(!/maze/i.test(rescue));
});

test('panel: one press gives a random competition maze with 13 inner walls, another one with 16', () => {
  // the two draws: one for each number of the organiser's constant, with the number on the button
  assert.deepEqual(RANDOM_MAZE_DRAWS.map((draw) => draw.id), COMPETITION_WALL_COUNTS.map((walls) => `walls-${walls}`));
  assert.deepEqual(RANDOM_MAZE_DRAWS.map((draw) => draw.label), COMPETITION_WALL_COUNTS.map((walls) => `${walls} inner walls`));
  assert.deepEqual(RANDOM_MAZE_DRAWS.map((draw) => draw.hint), [
    'Draw a random competition maze with 13 inner walls and a random place for the fire',
    'Draw a random competition maze with 16 inner walls (corridors only, one way to each room) and a random place for the fire',
  ]);
  COMPETITION_WALL_COUNTS.forEach((walls, i) => {
    const places = new Set<string>();
    const codes = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const maze = RANDOM_MAZE_DRAWS[i].draw(makeRng(seed));
      assert.deepEqual(maze, randomScenarioWithWalls(makeRng(seed), walls));
      assert.equal(maze.walls.filter(Boolean).length, walls);
      assert.equal(isCompetitionMaze(maze), true);
      assert.equal(kindSentence(mazeFacts(maze)), walls === 16 ? 'Competition maze: 16 inner walls, corridors only.' : `Competition maze: ${walls} inner walls.`);
      places.add(`${maze.fireRoom} ${maze.fireSpot}`);
      codes.add(encodeScenario(maze));
    }
    assert.equal(places.size, 6, 'the fire comes at each of its six places');
    assert.ok(codes.size >= 299, 'a new maze with every press');
    // with the page's own random numbers too
    assert.equal(RANDOM_MAZE_DRAWS[i].draw(Math.random).walls.filter(Boolean).length, walls);
  });

  // on the panel: the words "Random competition maze:" and the two buttons, in the place of the one "Random" button
  const words = screenWords(FIRE_CHIEF_WORDS);
  assert.equal(words.randomLabel, 'Random competition maze');
  assert.equal(words.randomHint, 'Draw a random competition maze (13 or 16 inner walls) and a random place for the fire');
  let picked: FireChiefScenario | null = null;
  const panel = renderToStaticMarkup(
    createElement(CombinationPanel<FireChiefScenario>, {
      game: fireChiefGame,
      scenario: defaultScenario(),
      onChange: (next: FireChiefScenario) => {
        picked = next;
      },
      words,
      readCode: readMazeCode,
      randomDraws: RANDOM_MAZE_DRAWS,
    }),
  );
  assert.equal(picked, null);
  assert.match(panel, /<div role="group" aria-label="Random competition maze"[^>]*data-random-draws="true">/);
  assert.ok(text(panel).includes('Random competition maze: 13 inner walls 16 inner walls'), text(panel));
  const buttons = [...panel.matchAll(/<button[^>]*data-random-draw="([a-z0-9-]+)"[^>]*>/g)];
  assert.deepEqual(buttons.map((m) => m[1]), ['walls-13', 'walls-16']);
  for (const [i, m] of buttons.entries()) {
    assert.ok(m[0].includes(`title="${RANDOM_MAZE_DRAWS[i].hint}"`), m[0]);
    assert.ok(m[0].includes(`aria-label="${RANDOM_MAZE_DRAWS[i].hint}"`), m[0]);
    // (the name a screen reader says holds the words on the button)
    assert.ok(RANDOM_MAZE_DRAWS[i].hint.includes(RANDOM_MAZE_DRAWS[i].label));
  }
  // the old button "Random maze" (4 to 16 walls) is gone; "Default maze" is still there
  assert.ok(!/>Random maze</.test(panel) && !/>Random competition maze<\/button>/.test(panel));
  assert.match(panel, />Default maze<\/button>/);
  // and the default maze is a competition maze
  assert.equal(isCompetitionMaze(fireChiefGame.defaultScenario()), true);
});

// =============================================================================================
// Competition maze or practice maze: one meaning on the whole screen
// =============================================================================================

test('kind: the box says the right kind for the five ready-made mazes', () => {
  const said = (id: string): string => kindSentence(mazeFacts(namedMaze(id) as FireChiefScenario));
  assert.equal(said('open'), 'Practice maze: no inner walls. A competition maze has 13 or 16 inner walls.');
  assert.equal(said('two-doors'), 'Practice maze: 4 inner walls. A competition maze has 13 or 16 inner walls.');
  assert.equal(said('crossroads'), 'Practice maze: 10 inner walls. A competition maze has 13 or 16 inner walls.');
  assert.equal(said('detour'), 'Competition maze: 13 inner walls.');
  assert.equal(said('one-way'), 'Competition maze: 16 inner walls, corridors only.');
  // the buttons of the ready-made mazes say the same kind, in the same words
  assert.deepEqual(
    MAZE_CHOICES.map((choice) => [choice.label, choice.kindLabel]),
    [
      ['Detour (default maze)', 'competition maze'],
      ['Open field', 'practice maze'],
      ['Two doors', 'practice maze'],
      ['Crossroads', 'practice maze'],
      ['One way only', 'competition maze'],
    ],
  );
  for (const choice of MAZE_CHOICES) {
    const maze = NAMED_MAZES.find((m) => m.id === choice.id);
    assert.ok(maze);
    assert.equal(choice.kind, isCompetitionMaze(maze.scenario) ? 'competition' : 'practice', choice.label);
    assert.equal(choice.kindLabel, KIND_WORD[choice.kind]);
    assert.ok(choice.about.startsWith(choice.kind === 'competition' ? 'Competition maze. Level ' : 'Practice maze. Level '), choice.about);
    // on the page: the box of the maze on the stage
    const html = editorHtml(maze.scenario);
    assert.ok(html.includes(`data-maze-kind="${choice.kind}"`), choice.label);
    assert.ok(text(html).includes(kindSentence(mazeFacts(maze.scenario))), choice.label);
  }
  // the sentences of the ready-made mazes do not say "perfect maze"
  for (const maze of NAMED_MAZES) assert.ok(!/perfect/i.test(`${maze.name} ${maze.about}`), maze.about);
  assert.match(NAMED_MAZES[4].about, /^Sixteen walls: corridors only\./);
});

test('kind: mazes with 12, 13, 14 and 16 inner walls, and a maze with 13 walls and a closed room', () => {
  const expected: Record<number, string> = {
    12: 'Practice maze: 12 inner walls. A competition maze has 13 or 16 inner walls.',
    13: 'Competition maze: 13 inner walls.',
    14: 'Practice maze: 14 inner walls. A competition maze has 13 or 16 inner walls.',
    15: 'Practice maze: 15 inner walls. A competition maze has 13 or 16 inner walls.',
    16: 'Competition maze: 16 inner walls, corridors only.',
  };
  for (const [walls, sentence] of Object.entries(expected)) {
    for (let seed = 1; seed <= 40; seed++) {
      const maze = randomScenarioWithWalls(makeRng(seed), Number(walls));
      const facts = mazeFacts(maze);
      assert.equal(kindSentence(facts), sentence, `${walls} walls, seed ${seed}`);
      assert.equal(mazeKind(facts), sentence.startsWith('Competition') ? 'competition' : 'practice');
      // the editor's answer is the game's
      assert.equal(mazeKind(facts) === 'competition', isCompetitionMaze(maze));
      // the level does not depend on the kind: it is counted as before
      assert.ok(mazeLevel(facts) !== null);
    }
    assert.ok(text(editorHtml(randomScenarioWithWalls(makeRng(5), Number(walls)))).includes(sentence), `${walls} walls on the page`);
  }
  // 13 inner walls, but the bedroom is closed off: a practice maze - and it is told what a competition maze has that it has not
  const closed = thirteenWallsClosedRoom();
  const facts = mazeFacts(closed);
  assert.deepEqual([facts.walls, facts.bothRooms], [13, false]);
  assert.equal(mazeKind(facts), 'practice');
  assert.equal(isCompetitionMaze(closed), false);
  assert.equal(kindSentence(facts), 'Practice maze: 13 inner walls, and a room cannot be reached. A competition maze has a way from START to both rooms.');
  assert.equal(competitionMazeHas(facts), 'a way from START to both rooms');
  const page = text(editorHtml(closed));
  assert.ok(page.includes(kindSentence(facts)));
  assert.ok(page.includes('This is a practice maze, not a competition maze.'), 'and the note under the plan says the same');
  // few walls and a closed room: both things are named
  assert.equal(kindSentence(mazeFacts(closedBedroom())), 'Practice maze: 2 inner walls, and a room cannot be reached. A competition maze has 13 or 16 inner walls and a way from START to both rooms.');
  assert.equal(kindSentence(mazeFacts(withWall(openField(), 0, true))), 'Practice maze: 1 inner wall. A competition maze has 13 or 16 inner walls.');
  // 16 walls with a closed-off cell that is no room: a competition maze by the two conditions, but not "corridors only"
  let boxed = namedMaze('one-way') as FireChiefScenario;
  const corner: Cell = { col: 0, row: 4 };
  for (const next of neighbours(corner)) boxed = withWall(boxed, wallIndexBetween(corner, next), true);
  // (the box put walls up: take others away until 16 stand again - that can only open more ways)
  for (let index = 0; boxed.walls.filter(Boolean).length > 16 && index < 40; index++) {
    if (!boxed.walls[index] || neighbours(corner).some((next) => wallIndexBetween(corner, next) === index)) continue;
    boxed = withWall(boxed, index, false);
  }
  const boxedFacts = mazeFacts(boxed);
  assert.deepEqual([boxedFacts.walls, boxedFacts.bothRooms, boxedFacts.closedCells > 0], [16, true, true]);
  assert.equal(corridorsOnly(boxedFacts), false);
  assert.equal(kindSentence(boxedFacts), 'Competition maze: 16 inner walls.');
  assert.match(wayFacts(boxedFacts), /\d cells? (is|are) closed off\./);
  // the box names the walls once: the sentence about the kind has them, the sentences about the ways do not
  for (const maze of [defaultScenario(), openField(), closedBedroom(), boxedStart()]) {
    const f = mazeFacts(maze);
    assert.ok(!/inner wall/.test(wayFacts(f)), wayFacts(f));
    assert.ok(levelFacts(f).endsWith(wayFacts(f)));
    assert.match(kindSentence(f), /^(Competition|Practice) maze: (no inner walls|\d+ inner walls?)/);
  }
});

test('kind: every text of the screen that names the numbers of a competition maze takes them from the one constant', () => {
  const numbers = COMPETITION_WALLS_TEXT;
  assert.equal(numbers, COMPETITION_WALL_COUNTS.join(' or '));
  // what the screen says, built here a second time from the constant
  assert.equal(COMPETITION_MAZE_HAS, `${numbers} inner walls and a way from START to both rooms`);
  assert.equal(competitionMazeHas({ walls: 10, bothRooms: true }), `${numbers} inner walls`);
  assert.equal(competitionMazeHas({ walls: 10, bothRooms: false }), COMPETITION_MAZE_HAS);
  assert.equal(screenWords(FIRE_CHIEF_WORDS).randomHint, `Draw a random competition maze (${numbers} inner walls) and a random place for the fire`);
  const rules = FIRE_CHIEF_RULES.flatMap((section) => section.items);
  assert.ok(rules.includes(`A competition maze has ${numbers} inner walls (the wall around the field is not counted); any other maze is a practice maze.`));
  assert.ok(
    rules.includes(`${Math.max(...COMPETITION_WALL_COUNTS)} inner walls are the most a maze can have while every cell can still be reached: then it has corridors only, and exactly one way to each room.`),
  );
  assert.equal(practiceNote(closedBedroom())?.meaning, `A competition maze has ${numbers} inner walls and a way from START to both rooms. You can still start an attempt in this maze to practise.`);
  assert.equal(stageMazeNote(openField()), `The maze on the stage is a practice maze, not a competition maze: a competition maze has ${numbers} inner walls.`);
  // one button and one kind of random list for each number, and no other
  assert.equal(RANDOM_MAZE_DRAWS.length, COMPETITION_WALL_COUNTS.length);
  assert.equal(RANDOM_MAZE_KINDS.length, COMPETITION_WALL_COUNTS.length);
  // the default maze and the two ready-made competition mazes have numbers of the constant
  assert.ok((COMPETITION_WALL_COUNTS as readonly number[]).includes(defaultScenario().walls.filter(Boolean).length));
  // "corridors only" is said of the larger number: it is the number of a maze with one way only
  assert.equal(Math.max(...COMPETITION_WALL_COUNTS), PERFECT_MAZE_WALLS);

  // and in the files of the screen no line of code that speaks of walls or of a competition maze
  // holds one of the numbers as digits or as a word (comments may: they explain)
  const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  const code = (source: string): string[] =>
    source
      .replace(/\/\*[^]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/(^|\s)\/\/.*$/, ''));
  const files = ['./rules.ts', './words.ts', './maze-level.ts', './maze-batch.ts', './maze-choices.ts', './maze-words.ts', './maze-code.ts', './MazeEditor.tsx', './FireChiefSimulator.tsx', '../CombinationPanel.tsx', '../BatchDialog.tsx'];
  for (const file of files) {
    for (const line of code(read(file))) {
      if (!/wall|competition|practice/i.test(line)) continue;
      assert.ok(!/\b(13|16|thirteen|sixteen)\b/i.test(line), `${file}: "${line.trim()}" names a number of walls itself`);
    }
  }
  // (the check does find such a line)
  assert.ok(code("const a = 'A competition maze has 13 inner walls';").some((line) => /\b13\b/.test(line)));
  assert.deepEqual(code('/* 13 walls */ const b = 1; // 16 walls'), [' const b = 1;']);
});

