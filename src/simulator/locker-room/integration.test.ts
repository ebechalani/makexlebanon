/**
 * The whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Locker Room referee
 *
 * A program made of real blocks leaves the Locker Room along the bottom line, stops in the Scan
 * Station, waits until the referee shows the card, READS IT with the colour sensor at the claw, waits
 * until the referee has lifted the Team Box, and then - by what it read - takes the cube of its team
 * colour from its pickup zone with the gripper and puts it into the big circle of that colour (the
 * gate opens); then it takes the blue token from zone A and puts it completely inside the blue
 * disc. It is played through the headless helper (./play.ts), which the examples use too.
 *
 * The moves are mBlock's "moves forward ... cm" and "turns ... degrees", worked out from the
 * numbers of ./field.ts by a small route planner below (the simulated robot is perfect).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../core/simulation';
import type { ProgramJson } from '../core/types';
import { arm, clawColor, eq, gripper, ifElse, moveCm, print, program, script, setVar, turn, v, wait, whenStart, type BlockNode } from '../vm/builder';
import { BIG_CIRCLES, MARKS, SCAN_STATION, type TeamColor } from './field';
import {
  BOX_LIFT_S,
  CARD_AWAY_S,
  CARD_SHOW_S,
  LINE_APPROVAL,
  LINE_DELIVERY,
  LINE_GATE,
  LINE_GATE_TOUCH,
  LINE_LEAVE,
  LINE_SCAN_STATION,
  lockerRoomGame,
  teamCubeHome,
  teamCubeId,
  tokenHome,
  tokenId,
  tokenLineId,
} from './game';
import { arrangement, playEveryArrangement, playLockerRoom } from './play';
import { LOCKER_ROOM_ROBOT, START_POSE } from './robot';

const DEG = 180 / Math.PI;
/** How far ahead of the axle the gripping centre is (mm). */
const GRIP = LOCKER_ROOM_ROBOT.gripper.gripForward;
/** The robot stops this far (mm) before a cube, turns towards it there, and then drives the rest with the claw open. */
const STAGE = 110;
/** After putting a cube down it backs away this far (mm). */
const BACK = 150;

/** A route of straight moves and turns on the spot, as blocks, from a pose (headings in degrees, 0 = up, clockwise). */
class Route {
  readonly blocks: BlockNode[] = [];
  constructor(public x: number, public y: number, public h: number) {}
  face(h: number): this {
    const d = ((h - this.h + 540) % 360) - 180;
    if (Math.abs(d) > 1e-9) this.blocks.push(turn(d > 0 ? 'right' : 'left', Math.abs(d)));
    this.h = h;
    return this;
  }
  go(x: number, y: number): this {
    const dist = Math.hypot(x - this.x, y - this.y);
    if (dist < 1e-6) return this;
    this.face(Math.atan2(x - this.x, -(y - this.y)) * DEG);
    this.blocks.push(moveCm('forward', dist / 10));
    this.x = x;
    this.y = y;
    return this;
  }
  back(mm: number): this {
    this.blocks.push(moveCm('backward', mm / 10));
    this.x -= mm * Math.sin(this.h / DEG);
    this.y += mm * Math.cos(this.h / DEG);
    return this;
  }
  /** take the cube at (x, y), driving at it with heading h: stop before it, turn, the claw goes around it, close, raise */
  grab(c: { x: number; y: number }, h: number): this {
    const fx = Math.sin(h / DEG);
    const fy = -Math.cos(h / DEG);
    this.go(c.x - (GRIP + STAGE) * fx, c.y - (GRIP + STAGE) * fy).face(h);
    this.blocks.push(moveCm('forward', STAGE / 10));
    this.x = c.x - GRIP * fx;
    this.y = c.y - GRIP * fy;
    this.blocks.push(gripper('close'), arm('raise'));
    return this;
  }
  /** put the cube in the claw down with its middle at (x, y), arriving with heading h; then back away */
  put(c: { x: number; y: number }, h: number): this {
    this.go(c.x - GRIP * Math.sin(h / DEG), c.y + GRIP * Math.cos(h / DEG)).face(h);
    this.blocks.push(arm('lower'), gripper('open'));
    return this.back(BACK);
  }
}

/** The middle of the Scan Station's room for the robot facing right (it can stop anywhere within 15.7 mm of it). */
const STATION_X = 1060;
/** Where both routes meet again: below the long line, clear of the gate (x 430 .. 488). */
const MEET = { x: 350, y: tokenHome('A').y + GRIP + STAGE };

/** From the Scan Station (facing right, box lifted) to the team cube of `color`, into its circle, and on to MEET (facing down). */
function teamRoute(color: TeamColor): BlockNode[] {
  const r = new Route(STATION_X, START_POSE.y, 90);
  const cube = teamCubeHome(color);
  if (color === 'green') {
    // up the right side (the claw stays clear of the cube), then at it heading up-right
    r.go(STATION_X, 420).grab(cube, 45);
    r.put({ x: BIG_CIRCLES.green.cx, y: BIG_CIRCLES.green.cy }, 180);
  } else {
    // up, then along y 360 (clear of the token in zone C), then at it heading up-left
    r.go(STATION_X, 360).go(MEET.x - 41, 360).grab(cube, -45);
    r.put({ x: BIG_CIRCLES.red.cx, y: BIG_CIRCLES.red.cy }, 90);
  }
  r.go(MEET.x, r.y).go(MEET.x, MEET.y);
  return r.blocks;
}

/** From MEET to the blue token in zone A (arrangements 5 and 6: BLUE in A), and completely onto the blue disc. */
function blueTokenRoute(): BlockNode[] {
  const r = new Route(MEET.x, MEET.y, 180);
  r.grab(tokenHome('A'), 0);
  r.put({ x: MARKS.blueDisc.circle!.cx, y: MARKS.blueDisc.circle!.cy }, 90);
  return r.blocks;
}

/** The program reads the card this long (s) after it stopped in the Scan Station ... */
const READ_AFTER_S = 1;
/** ... and moves again this long after it stopped. */
const MOVE_AFTER_S = 4.2;

/**
 * The whole program: along the bottom line into the Scan Station, wait for the card and read it,
 * wait for the box to be lifted, then the route of the colour that was read, then the blue token.
 */
const start = new Route(START_POSE.x, START_POSE.y, 90).go(STATION_X, START_POSE.y);
const WHOLE_MISSION: ProgramJson = program([
  script(whenStart(), [
    ...start.blocks,
    // the card is shown CARD_SHOW_S after the robot stopped (and taken away at CARD_AWAY_S), the
    // box lifted BOX_LIFT_S after it: read the card at 1 s, move again at 4.2 s
    wait(READ_AFTER_S),
    setVar('team colour', clawColor()),
    print(v('team colour')),
    wait(MOVE_AFTER_S - READ_AFTER_S),
    // (the card is gone by now: the program goes by what it read)
    ifElse(eq(v('team colour'), 'red'), teamRoute('red'), teamRoute('green')),
    ...blueTokenRoute(),
  ]),
]);

test('the route: the robot stops completely inside the Scan Station, reads while the card is shown, moves after the box is lifted', () => {
  assert.ok(STATION_X - 70 >= SCAN_STATION.x && STATION_X + 167 <= SCAN_STATION.x + SCAN_STATION.w);
  assert.ok(READ_AFTER_S > CARD_SHOW_S && READ_AFTER_S < CARD_AWAY_S);
  assert.ok(MOVE_AFTER_S > BOX_LIFT_S);
});

test('real blocks, G5 and R5: out, Scan Station, the card read, box, the team cube into its circle, the gate opens, blue token onto the blue disc: 65', () => {
  for (const code of ['G5', 'R5']) {
    const team: TeamColor = code[0] === 'G' ? 'green' : 'red';
    // the program, played on the screen's engine: what it printed, and the events
    const sim = createSimulation({ game: lockerRoomGame, scenario: arrangement(code), program: WHOLE_MISSION });
    sim.start();
    const said: string[] = [];
    while (sim.status === 'running') {
      sim.step(100);
      for (const e of sim.drainEvents()) if (e.type === 'log') said.push(e.text);
    }
    assert.deepEqual(sim.world.robot.screen.lines, [team], `${code}: the card was read`);
    assert.deepEqual(sim.vm.errors(), []);
    // the cube of the team colour is in its circle, the other one where it started
    const cube = sim.world.bodies.find((b) => b.id === teamCubeId(team))!;
    assert.ok(Math.hypot(cube.x - BIG_CIRCLES[team].cx, cube.y - BIG_CIRCLES[team].cy) < 1, `${code}: ${cube.x}, ${cube.y}`);
    const other = sim.world.bodies.find((b) => b.id === teamCubeId(team === 'red' ? 'green' : 'red'))!;
    assert.deepEqual([other.x, other.y], [other.home.x, other.home.y]);
    const blue = sim.world.bodies.find((b) => b.id === tokenId('A'))!;
    assert.equal(blue.colorName, 'blue');
    assert.ok(Math.hypot(blue.x - MARKS.blueDisc.circle!.cx, blue.y - MARKS.blueDisc.circle!.cy) < 1);
    assert.deepEqual(sim.world.walls, [], 'the gate opened');
    assert.ok(said.some((t) => t.includes(`the referee shows the ${team.toUpperCase()} card`)), said.join('\n'));

    // the same through the headless helper
    const result = playLockerRoom(WHOLE_MISSION, code);
    const points = (id: string) => result.lines.find((l) => l.id === id)!.points;
    assert.equal(points(LINE_LEAVE), 5, code);
    assert.equal(points(LINE_SCAN_STATION), 10, code);
    assert.equal(points(LINE_APPROVAL), 15, code);
    assert.equal(points(LINE_DELIVERY), 20, code);
    assert.equal(points(LINE_GATE), 5, code);
    assert.equal(points(LINE_GATE_TOUCH), 0, code);
    assert.equal(points(tokenLineId('blue')), 10, code);
    assert.equal(points(tokenLineId('red')), 0);
    assert.equal(points(tokenLineId('green')), 0);
    assert.equal(result.total, 65, code);
    assert.equal(result.finishReason, 'program-ended');
    assert.equal(result.scenarioCode, code);
    assert.ok(result.time < 60, `${code}: ${result.time} s`);
    // the moments the referee wrote down
    const at = (id: string) => result.lines.find((l) => l.id === id)!.time!;
    assert.ok(at(LINE_LEAVE) < at(LINE_SCAN_STATION) && at(LINE_SCAN_STATION) < at(LINE_APPROVAL) && at(LINE_APPROVAL) < at(LINE_DELIVERY));
  }
});

test('the headless helper: arrangements by code, by number, as they are; all 12 in order', () => {
  assert.deepEqual(arrangement('g5'), { team: 'green', option: 5 });
  assert.deepEqual(arrangement(0), { team: 'red', option: 1 });
  assert.deepEqual(arrangement(11), { team: 'green', option: 6 });
  assert.deepEqual(arrangement({ team: 'red', option: 3 }), { team: 'red', option: 3 });
  assert.throws(() => arrangement('B5'), /not the code of a Locker Room arrangement/);
  assert.throws(() => arrangement(12), /not the place of a Locker Room arrangement/);
  // a program that only leaves the Locker Room: 5 on all 12, and the default arrangement is G5
  const leave = program([script(whenStart(), [moveCm('forward', 30)])]);
  const all = playEveryArrangement(leave);
  assert.deepEqual(all.map((r) => r.scenarioCode), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
  for (const r of all) assert.equal(r.total, 5, r.scenarioCode);
  assert.equal(playLockerRoom(leave).scenarioCode, 'G5');
  // cut short: after 1 s the robot has not left yet
  assert.equal(playLockerRoom(leave, 'R1', { maxSeconds: 1 }).total, 0);
});
