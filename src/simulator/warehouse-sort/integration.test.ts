/**
 * The whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Warehouse Sort referee
 *
 * A program made of real blocks leaves the start zone, drives to a warehouse, takes the cube
 * with the gripper, carries it into its bay, puts it down and parks on a finish pad. It is
 * played through the headless helper (./play.ts), which the examples will use too.
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
import { BAYS, CUBE_SIZE, FINISH_PADS, LONG_LINE_Y, START_ZONE } from './field';
import {
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
import { allScenarios, defaultScenario, encodeScenario } from './scenario';

/**
 * From the start zone to warehouse W4 (bottom right), take its cube, carry it into the RED bay,
 * put it down and back onto the bottom pad. Encoder moves only (mBlock's "moves forward ... cm"
 * and "turns ... degrees"):
 *   4.575 cm forward: the robot is above W4 (x 1105.3 mm); left 90: it faces down;
 *   36.243 cm: the open claw is around the cube; close the claw, raise the arm;
 *   right 90: it faces left; 48.678 cm: it is under the red bay (x 618.6 mm);
 *   right 90: it faces up; 37.761 cm: the cube is over the middle of the red bay;
 *   lower the arm, open the claw, 32.6 cm backwards: its back is on the bottom pad.
 */
const W4_TO_RED_BAY: ProgramJson = program([
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

test('real blocks: leave the start zone, take the W4 cube, carry it into the red bay, put it down, park on a pad', () => {
  const result = playWarehouseSort(W4_TO_RED_BAY, 'RG-GR');
  assert.equal(result.scenarioCode, 'RG-GR');
  assert.equal(result.errors, undefined, 'every block is known to the interpreter');
  assert.equal(result.finishReason, 'program-ended');
  assert.ok(result.time > 12 && result.time < 14, `the program took ${result.time} s`);
  const line = (id: string) => result.lines.find((l) => l.id === id)!;
  assert.equal(line(LINE_LEAVE_START).points, 5);
  assert.ok(line(LINE_LEAVE_START).time! < 0.3, 'the claw is out of the zone after 14 mm');
  assert.equal(line(pickLineId('W4')).points, 5);
  assert.equal(line(deliverLineId('W4')).points, 15);
  assert.equal(line(deliverLineId('W4')).detail.startsWith('in the red bay since 0:1'), true);
  assert.deepEqual([line(LINE_PARK).points, line(LINE_PARK).detail], [10, 'the robot touched the bottom pad']);
  assert.equal(line(LINE_LAST_DELIVERY).time, line(deliverLineId('W4')).time);
  // the other three cubes were not touched
  for (const w of ['W1', 'W2', 'W3'] as const) assert.equal(line(pickLineId(w)).points + line(deliverLineId(w)).points, 0, w);
  assert.equal(result.total, 5 + 5 + 15 + 10 + 5);
  assert.equal(result.max, 100);
  assert.equal(result.complete, false);
});

test('real blocks: where the cube and the robot are at the end of that run', () => {
  const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: W4_TO_RED_BAY });
  sim.start();
  while (sim.status === 'running') sim.step(50);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W4'))!;
  const bay = BAYS.red;
  // the cube stands in the middle of the red bay, with room on every side
  assert.equal(cube.held, false);
  assert.equal(cube.z, 0);
  assert.ok(cube.x - CUBE_SIZE / 2 > bay.x + 60 && cube.x + CUBE_SIZE / 2 < bay.x + bay.w - 60, `x ${cube.x}`);
  assert.ok(cube.y - CUBE_SIZE / 2 > bay.y + 25 && cube.y + CUBE_SIZE / 2 < bay.y + bay.h - 25, `y ${cube.y}`);
  // the robot's back is just over the edge of the bottom pad
  const pad = FINISH_PADS.bottom;
  const back = sim.world.robot.pose.y + warehouseSortGame.robotConfig!.chassisRear;
  assert.ok(back > pad.cy - pad.ry && back < pad.cy - pad.ry + 10, `back at ${back}`);
});

test('the same program on all 14 arrangements: W4 red - 40 points; W4 green - into the red bay, -5 and no pick points', () => {
  const results = playEveryArrangement(W4_TO_RED_BAY);
  assert.equal(results.length, 14);
  assert.deepEqual(
    results.map((r) => r.scenarioCode),
    allScenarios().map(encodeScenario),
  );
  for (const r of results) {
    const w4Red = arrangement(r.scenarioCode).cubes.W4 === 'red';
    // (green W4 in the red bay: 5 leave + 0 pick ("no points for that cube") - 5 + 10 park + 5 clean)
    assert.equal(r.total, w4Red ? 40 : 15, r.scenarioCode);
    const wrong = r.lines.find((l) => l.id === LINE_WRONG_BAY)!;
    assert.equal(wrong.points, w4Red ? 0 : -5, r.scenarioCode);
  }
});

test('the headless helper: arrangements by code or number, options, and a clear error for a wrong code', () => {
  assert.deepEqual(arrangement('rg-gr'), defaultScenario());
  assert.deepEqual(arrangement(0), allScenarios()[0]);
  assert.deepEqual(arrangement(), defaultScenario());
  assert.throws(() => arrangement('RR-RR'), /not the code of a Warehouse Sort arrangement/);
  assert.throws(() => playWarehouseSort(W4_TO_RED_BAY, 'XYZ'), /not the code/);
  // a place in the list is a number, not a text: "5" is no code
  assert.deepEqual(arrangement(13), allScenarios()[13]);
  assert.throws(() => arrangement('5'), /not the code/);
  assert.throws(() => arrangement(14), /not the place/);
  assert.throws(() => arrangement(1.5), /not the place/);
  // cut short after 3 s: as if the team said "Finished"
  const short = playWarehouseSort(W4_TO_RED_BAY, 'RG-GR', { maxSeconds: 3 });
  assert.equal(short.finishReason, 'declared');
  assert.equal(short.time, 3);
  // the same program, arrangement and seed always give the same result
  assert.deepEqual(playWarehouseSort(W4_TO_RED_BAY, 5, { seed: 9 }), playWarehouseSort(W4_TO_RED_BAY, 5, { seed: 9 }));
  // an empty program: the robot stays in the start zone, the match ends at once with the clean-run bonus
  const nothing = playWarehouseSort(program([]));
  assert.equal(nothing.total, 5);
  assert.equal(nothing.finishReason, 'program-ended');
});

test("real blocks: Makeblock's line follower follows the WHITE long line out of the start zone", () => {
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
    const startPose = { ...START_POSE, y: START_POSE.y + offset };
    const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: follower, startPose });
    assert.ok(START_ZONE.y < startPose.y);
    sim.start();
    let worst = 0;
    // follow it until the claw reaches the right side of the loop (x 854)
    for (let i = 0; i < 1500 && sim.world.robot.pose.x - 167 > 870; i++) {
      sim.step(1);
      if (sim.world.robot.pose.x < 1000) worst = Math.max(worst, Math.abs(sim.world.robot.pose.y - LONG_LINE_Y));
    }
    assert.ok(sim.world.robot.pose.x - 167 <= 870, `it drove along the line (x ${sim.world.robot.pose.x.toFixed(0)})`);
    assert.ok(worst < 12, `offset ${offset}: at most ${worst.toFixed(1)} mm beside the line`);
    assert.equal(sim.readSensors().lineStatus & 0b0110, 0b0110, 'the two middle probes are on the white line');
  }
  // on the line the line status says so, beside it not
  const on = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {}, startPose: { ...START_POSE, x: 900 } });
  assert.equal(on.readSensors().lineStatus, 0b0110);
  const off = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {}, startPose: { ...START_POSE, x: 900, y: 500 } });
  assert.equal(off.readSensors().lineStatus, 0);
  assert.equal(off.readSensors().probes.L1.color, 'black');
});
