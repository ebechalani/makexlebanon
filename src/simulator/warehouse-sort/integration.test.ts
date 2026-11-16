/**
 * The whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Warehouse Sort referee
 *
 * A program made of real blocks leaves the start zone (at the bottom of the turned field, facing
 * up), drives to a warehouse, takes the cube with the gripper, carries it into its bay, puts it
 * down and parks on a finish pad. It is played through the headless helper (./play.ts), which the
 * examples use too.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../core/simulation';
import type { ProgramJson } from '../core/types';
import {
  arm,
  drivePower,
  forever,
  gripper,
  lineDeviation,
  moveCm,
  mul,
  program,
  script,
  sub,
  add,
  turn,
  whenStart,
} from '../vm/builder';
import { BAYS, CUBE_SIZE, FINISH_PADS, LONG_LINE_X, START_ZONE } from './field';
import {
  LINE_BLUE,
  LINE_LAST_DELIVERY,
  LINE_LEAVE_START,
  LINE_PARK,
  LINE_WRONG_BAY,
  cubeBodyId,
  deliverLineId,
  pickLineId,
  warehouseSortGame,
} from './game';
import { arrangement, playEveryArrangement, playWarehouseSort } from './play';
import { START_POSE } from './robot';
import { allScenarios, decodeScenario, defaultScenario, encodeScenario } from './scenario';

/**
 * From the start zone to warehouse W3 (bottom left), take its cube, carry it into the RED bay,
 * put it down and back onto the left pad. Encoder moves only (mBlock's "moves forward ... cm"
 * and "turns ... degrees"):
 *   4.575 cm forward: the robot is level with W3 (y 1105.3 mm); left 90: it faces left;
 *   36.243 cm: the open claw is around the cube; close the claw, raise the arm;
 *   right 90: it faces up; 48.678 cm: it is level with the bays (y 618.6 mm), left of the green bay;
 *   right 90: it faces right; 37.761 cm: the cube is over the middle of the red bay (it passes
 *   over the green bay and the logo with the arm up);
 *   lower the arm, open the claw, 32.6 cm backwards: its back is on the left pad.
 * (Before the field was turned this program took the cube then called "W4" to the red bay
 * through the same moves: the field turned, the program did not change.)
 */
const W3_TO_RED_BAY: ProgramJson = program([
  script(whenStart(), [
    moveCm('forward', 4.575),
    turn('left', 90),
    moveCm('forward', 36.243),
    gripper('close'),
    arm('raise'),
    turn('right', 90),
    moveCm('forward', 48.678),
    turn('right', 90),
    moveCm('forward', 37.761),
    arm('lower'),
    gripper('open'),
    moveCm('backward', 32.6),
  ]),
]);

/** W1 green, W2 blue, W3 red, W4 red: the cube of W3 is red. */
const RED_W3 = 'GB-RR';

test('real blocks: leave the start zone, take the W3 cube, carry it into the red bay, put it down, park on a pad', () => {
  const result = playWarehouseSort(W3_TO_RED_BAY, RED_W3);
  assert.equal(result.scenarioCode, RED_W3);
  assert.equal(result.errors, undefined, 'every block is known to the interpreter');
  assert.equal(result.finishReason, 'program-ended');
  assert.ok(result.time > 12 && result.time < 14, `the program took ${result.time} s`);
  const line = (id: string) => result.lines.find((l) => l.id === id)!;
  assert.equal(line(LINE_LEAVE_START).points, 5);
  assert.ok(line(LINE_LEAVE_START).time! < 0.3, 'the claw is out of the zone after 14 mm');
  assert.equal(line(pickLineId('W3')).points, 5);
  assert.equal(line(deliverLineId('W3')).points, 15);
  assert.equal(line(deliverLineId('W3')).detail.startsWith('in the red bay since 0:1'), true);
  assert.deepEqual([line(LINE_PARK).points, line(LINE_PARK).detail], [10, 'the robot touched the left pad']);
  assert.equal(line(LINE_LAST_DELIVERY).time, line(deliverLineId('W3')).time);
  // the other two red and green cubes were not touched, and the blue one was left alone
  for (const w of ['W1', 'W4'] as const) assert.equal(line(pickLineId(w)).points + line(deliverLineId(w)).points, 0, w);
  assert.deepEqual([line(LINE_BLUE).points, line(LINE_BLUE).detail], [0, 'left alone']);
  assert.equal(result.total, 5 + 5 + 15 + 10 + 5);
  assert.equal(result.max, 80);
  assert.equal(result.complete, false);
});

test('real blocks: where the cube and the robot are at the end of that run', () => {
  const sim = createSimulation({ game: warehouseSortGame, scenario: decodeScenario(RED_W3)!, program: W3_TO_RED_BAY });
  sim.start();
  while (sim.status === 'running') sim.step(50);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W3'))!;
  const bay = BAYS.red;
  // the cube stands in the middle of the red bay, with room on every side
  assert.equal(cube.held, false);
  assert.equal(cube.z, 0);
  assert.ok(cube.x - CUBE_SIZE / 2 > bay.x + 25 && cube.x + CUBE_SIZE / 2 < bay.x + bay.w - 25, `x ${cube.x}`);
  assert.ok(cube.y - CUBE_SIZE / 2 > bay.y + 60 && cube.y + CUBE_SIZE / 2 < bay.y + bay.h - 60, `y ${cube.y}`);
  // the robot faces right; its back is just over the right edge of the left pad
  const pad = FINISH_PADS.left;
  const back = sim.world.robot.pose.x - warehouseSortGame.robotConfig!.chassisRear;
  assert.ok(back < pad.cx + pad.rx && back > pad.cx + pad.rx - 10, `back at ${back}`);
});

test('the same program on all 24 arrangements: W3 red - 40 points; W3 green - into the red bay, -5; W3 blue - lifted, -5', () => {
  const results = playEveryArrangement(W3_TO_RED_BAY);
  assert.equal(results.length, 24);
  assert.deepEqual(
    results.map((r) => r.scenarioCode),
    allScenarios().map(encodeScenario),
  );
  for (const r of results) {
    const w3 = arrangement(r.scenarioCode).cubes.W3;
    // red: 5 leave + 5 pick + 15 bay + 10 park + 5 clean
    // green, in the red bay: 5 leave + 0 pick ("no points for that cube") - 5 wrong bay + 10 park + 5 clean
    // blue, lifted and put in the red bay: 5 leave - 5 blue + 10 park + 5 clean (no "wrong bay" for it)
    assert.equal(r.total, w3 === 'red' ? 40 : 15, r.scenarioCode);
    assert.equal(r.lines.find((l) => l.id === LINE_WRONG_BAY)!.points, w3 === 'green' ? -5 : 0, r.scenarioCode);
    assert.equal(r.lines.find((l) => l.id === LINE_BLUE)!.points, w3 === 'blue' ? -5 : 0, r.scenarioCode);
  }
});

test('the headless helper: arrangements by code or number, options, and a clear error for a wrong code', () => {
  assert.deepEqual(arrangement('gr-br'), defaultScenario());
  assert.deepEqual(arrangement(0), allScenarios()[0]);
  assert.deepEqual(arrangement(), defaultScenario());
  assert.throws(() => arrangement('RG-GR'), /not the code of a Warehouse Sort arrangement/, 'no blue cube');
  assert.throws(() => arrangement('BB-RG'), /not the code of a Warehouse Sort arrangement/, 'two blue cubes');
  assert.throws(() => playWarehouseSort(W3_TO_RED_BAY, 'XYZ'), /not the code/);
  // a place in the list is a number, not a text: "5" is no code
  assert.deepEqual(arrangement(23), allScenarios()[23]);
  assert.throws(() => arrangement('5'), /not the code/);
  assert.throws(() => arrangement(24), /not the place/);
  assert.throws(() => arrangement(1.5), /not the place/);
  // cut short after 3 s: as if the team said "Finished"
  const short = playWarehouseSort(W3_TO_RED_BAY, RED_W3, { maxSeconds: 3 });
  assert.equal(short.finishReason, 'declared');
  assert.equal(short.time, 3);
  // the same program, arrangement and seed always give the same result
  assert.deepEqual(playWarehouseSort(W3_TO_RED_BAY, 5, { seed: 9 }), playWarehouseSort(W3_TO_RED_BAY, 5, { seed: 9 }));
  // an empty program: the robot stays in the start zone, the match ends at once with the clean-run bonus
  const nothing = playWarehouseSort(program([]));
  assert.equal(nothing.total, 5);
  assert.equal(nothing.finishReason, 'program-ended');
});

test("real blocks: Makeblock's line follower follows the WHITE long line up out of the start zone", () => {
  // EM1 = base - kp x deviation, EM2 = -(base + kp x deviation), as in Makeblock's examples
  const BASE = 25;
  const KP = 0.3;
  const follower = program([
    script(whenStart(), [
      moveCm('forward', 8),
      forever([drivePower(sub(BASE, mul(KP, lineDeviation())), mul(-1, add(BASE, mul(KP, lineDeviation()))))]),
    ]),
  ]);
  for (const offset of [-12, 12]) {
    // start a little beside the line (still in the start zone)
    const startPose = { ...START_POSE, x: START_POSE.x + offset };
    const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: follower, startPose });
    assert.ok(START_ZONE.x < startPose.x);
    sim.start();
    let worst = 0;
    // follow it up until the claw reaches the bottom side of the loop (y 854)
    for (let i = 0; i < 1500 && sim.world.robot.pose.y - 167 > 870; i++) {
      sim.step(1);
      if (sim.world.robot.pose.y < 1000) worst = Math.max(worst, Math.abs(sim.world.robot.pose.x - LONG_LINE_X));
    }
    assert.ok(sim.world.robot.pose.y - 167 <= 870, `it drove along the line (y ${sim.world.robot.pose.y.toFixed(0)})`);
    assert.ok(worst < 12, `offset ${offset}: at most ${worst.toFixed(1)} mm beside the line`);
    assert.equal(sim.readSensors().lineStatus & 0b0110, 0b0110, 'the two middle probes are on the white line');
  }
  // on the line the line status says so, beside it not
  const on = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {}, startPose: { ...START_POSE, y: 900 } });
  assert.equal(on.readSensors().lineStatus, 0b0110);
  const off = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {}, startPose: { ...START_POSE, x: 735, y: 900 } });
  assert.equal(off.readSensors().lineStatus, 0);
  assert.equal(off.readSensors().probes.L1.color, 'black');
});
