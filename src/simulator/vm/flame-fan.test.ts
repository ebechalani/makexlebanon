/**
 * The blocks of the DC motor ports (M1 / M2: the fan) and of the flame sensor.
 *
 * First against the pretend robot (fake-io.ts): which commands does each block send, what does
 * it read. Then on the real engine with the robot and the field of Fire Chief: does the fan
 * really blow, does the flame block read what the sensor reads, and can a program made of
 * blocks alone finish the mission.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSimulation } from '../core/simulation';
import type { FlameSensorConfig, ProgramJson, SimEvent, Simulation } from '../core/types';
import { fireChiefGame } from '../fire-chief/game';
import { FAN, FIRE_CHIEF_ROBOT, FLAME_SENSOR } from '../fire-chief/robot';
import { openField, type FireChiefScenario } from '../fire-chief/scenario';
import { fireRescueGame } from '../fire-rescue/game';
import * as B from './builder';
import { createFakeIO, runFor, runTicks, runUntilDone } from './fake-io';
import { createVM } from './index';

const SENSOR: FlameSensorConfig = { enabled: true, forward: 100, height: 60, halfAngleDeg: 30, rangeMm: 1000, threshold: 10 };

/** Start a program on a fresh pretend robot that has a flame sensor (unless `sensor` is false). */
function boot(program: ProgramJson, sensor: FlameSensorConfig | false = SENSOR) {
  const io = createFakeIO(sensor ? { config: { flameSensor: sensor } } : {});
  const vm = createVM(program, io);
  vm.start();
  return { io, vm };
}

const start = (...blocks: B.BlockNode[]): ProgramJson => B.program([B.script(B.whenStart(), blocks)]);

const warnings = (io: ReturnType<typeof createFakeIO>): string[] => io.logs.filter((log) => log.level === 'warn').map((log) => log.text);

// =============================================================================================
// DC motor blocks, pretend robot
// =============================================================================================

describe('DC motor blocks (pretend robot)', () => {
  it('"DC motor M1 rotates at power 60 %" starts the motor and carries on at once', () => {
    const { io, vm } = boot(start(B.dcMotor('M1', 60), B.print('next')));
    runTicks(vm, io, 1);
    assert.deepEqual(io.calls, ['setDcMotor M1 60', 'print next']);
    assert.deepEqual(io.dcMotors, { M1: 60, M2: 0 });
    assert.equal(vm.running, false, 'the script has ended ...');
    runFor(vm, io, 1);
    assert.equal(io.dcMotors.M1, 60, '... and the motor keeps running, like on the real robot');
  });

  it('takes the port from its menu and the power from its slot: -100 to 100, anything else is cut off', () => {
    const { io, vm } = boot(
      start(B.dcMotor('M2', -35), B.dcMotor('M1', 250), B.dcMotor('M2', -250), B.dcMotor('M1', 'fast'), B.dcMotor('M2', B.add(10, 5))),
    );
    runTicks(vm, io, 1);
    assert.deepEqual(io.calls, ['setDcMotor M2 -35', 'setDcMotor M1 100', 'setDcMotor M2 -100', 'setDcMotor M1 0', 'setDcMotor M2 15']);
    assert.deepEqual(vm.errors(), []);
  });

  it('as dragged out of the palette it runs M1 at 50 %', () => {
    const { io, vm } = boot(start(B.b('mbot2_dc_motor_power'), B.b('mbot2_dc_motor_drive'), B.b('mbot2_dc_motor_stop')));
    runTicks(vm, io, 1);
    assert.deepEqual(io.calls, ['setDcMotor M1 50', 'setDcMotor M1 50', 'setDcMotor M2 50', 'stopDcMotor M1']);
    assert.deepEqual(io.dcMotors, { M1: 0, M2: 50 });
  });

  it('the block for both ports gives the first power to M1 and the second to M2', () => {
    const { io, vm } = boot(start(B.dcMotors(30, -40)));
    runTicks(vm, io, 1);
    assert.deepEqual(io.calls, ['setDcMotor M1 30', 'setDcMotor M2 -40']);
    assert.deepEqual(io.dcMotors, { M1: 30, M2: -40 });
  });

  it('"DC motor ... stops rotating" stops one port or both', () => {
    for (const [port, left] of [
      ['M1', { M1: 0, M2: 80 }],
      ['M2', { M1: 80, M2: 0 }],
      ['all', { M1: 0, M2: 0 }],
    ] as const) {
      const { io, vm } = boot(start(B.dcMotors(80, 80), B.stopDcMotor(port)));
      runTicks(vm, io, 1);
      assert.equal(io.calls[io.calls.length - 1], `stopDcMotor ${port}`);
      assert.deepEqual(io.dcMotors, left, port);
    }
  });

  it('does not take the drive motors away from a move that is under way', () => {
    const { io, vm } = boot(
      B.program([
        B.script(B.whenStart(), [B.moveCm('forward', 10), B.print('arrived')]),
        B.script(B.whenStart(), [B.wait(0.2), B.dcMotor('M1', 100), B.wait(0.2), B.stopDcMotor('M1')]),
      ]),
    );
    runFor(vm, io, 0.3);
    assert.ok(io.motion, 'the move goes on while the fan is switched on');
    assert.equal(io.dcMotors.M1, 100);
    runUntilDone(vm, io);
    assert.deepEqual(io.lines, ['arrived']);
    assert.equal(io.motions.length, 1);
    assert.equal(io.dcMotors.M1, 0);
  });

  it('"stop all" stops a DC motor that is running; "stop this script" does not', () => {
    const all = boot(start(B.dcMotor('M1', 100), B.wait(0.1), B.stop('all'), B.print('never')));
    runUntilDone(all.vm, all.io);
    assert.deepEqual(all.io.calls, ['setDcMotor M1 100', 'stopWheel all', 'stopDcMotor all']);
    assert.deepEqual(all.io.dcMotors, { M1: 0, M2: 0 });
    assert.equal(all.vm.idle, true);

    const one = boot(start(B.dcMotor('M1', 100), B.stop('this script'), B.print('never')));
    runUntilDone(one.vm, one.io);
    assert.deepEqual(one.io.calls, ['setDcMotor M1 100']);
    assert.equal(one.io.dcMotors.M1, 100);
  });

  it('"stop all" sends no DC motor command to a robot whose DC motors are not running', () => {
    const { io, vm } = boot(start(B.move('forward', 50), B.stop('all')));
    runUntilDone(vm, io);
    assert.equal(io.calls[io.calls.length - 1], 'stopWheel all');
    assert.ok(!io.calls.some((call) => call.startsWith('stopDcMotor')));
  });

  it('the builder refuses a port the menu does not have', () => {
    assert.throws(() => B.dcMotor('M3' as B.DcMotorName, 50), /not a choice of "PORT"/);
    assert.throws(() => B.b('mbot2_dc_motor_power', { fields: { PORT: 'all' } }), /not a choice/);
    assert.throws(() => B.b('mbot2_dc_motor_stop', { fields: { PORT: 'EM1' } }), /not a choice/);
    assert.throws(() => B.b('mbot2_dc_motor_drive', { inputs: { POWER: 5 } }), /no value slot "POWER"/);
    assert.equal(B.stopDcMotor().fields?.PORT, 'M1');
    assert.equal(B.stopDcMotor('all').fields?.PORT, 'all');
  });
});

// =============================================================================================
// Flame sensor blocks, pretend robot
// =============================================================================================

describe('flame sensor blocks (pretend robot)', () => {
  it('"flame size" gives the value of the sensor, 0 to 100, with one decimal', () => {
    const { io, vm } = boot(start(B.print(B.flameSize()), B.wait(0.1), B.print(B.flameSize()), B.wait(0.1), B.print(B.flameSize(1))));
    io.sensors.flame = 0;
    runTicks(vm, io, 1);
    io.sensors.flame = 37.26;
    runFor(vm, io, 0.12);
    io.sensors.flame = 100;
    runUntilDone(vm, io);
    assert.deepEqual(io.lines, ['0', '37.3', '100']);
    assert.deepEqual(warnings(io), []);
    assert.deepEqual(vm.errors(), []);
  });

  it('"detects flame?" is true above the threshold of the sensor, false at it and below', () => {
    const { io, vm } = boot(start(B.forever([B.ifElse(B.flameDetected(), [B.ledColor('all', '#ff0000')], [B.ledOff('all')])])));
    const lit = (): boolean => io.leds[0].r === 255;
    for (const [value, seen] of [
      [0, false],
      [9.9, false],
      [10, false],
      [10.1, true],
      [80, true],
      [3, false],
    ] as const) {
      io.sensors.flame = value;
      runTicks(vm, io, 1);
      assert.equal(lit(), seen, `flame value ${value}`);
    }
    assert.deepEqual(warnings(io), []);
  });

  it('the threshold comes from the robot, not from the block', () => {
    const { io, vm } = boot(start(B.print(B.flameDetected())), { ...SENSOR, threshold: 40 });
    io.sensors.flame = 30;
    runTicks(vm, io, 1);
    assert.deepEqual(io.lines, ['false']);
  });

  it('works in the places a program needs it: wait until, a comparison, a variable', () => {
    const { io, vm } = boot(
      start(
        B.waitUntil(B.flameDetected()),
        B.setVar('best', B.flameSize()),
        B.ifThen(B.gt(B.flameSize(), B.v('best')), [B.print('never: it is the same value')]),
        B.ifThen(B.and(B.flameDetected(), B.gt(B.flameSize(), 20)), [B.print(B.join('flame ', B.v('best')))]),
      ),
    );
    runFor(vm, io, 0.5);
    assert.equal(vm.running, true, 'still waiting: no flame');
    io.sensors.flame = 42;
    runFor(vm, io, 0.1);
    assert.deepEqual(io.lines, ['flame 42']);
    assert.equal(vm.variables().best, 42);
  });

  it('the number on the block is the number of the sensor: only 1 reads the robot\'s flame sensor', () => {
    const { io, vm } = boot(
      start(
        B.print(B.flameSize(1)),
        B.print(B.flameSize(2)),
        B.print(B.flameDetected(2)),
        B.print(B.flameSize(0)),
        B.print(B.flameSize('1')),
        B.forever([B.setVar('other', B.flameSize(3))]),
      ),
    );
    io.sensors.flame = 55;
    runFor(vm, io, 0.2);
    assert.deepEqual(io.lines, ['55', '0', 'false', '0', '55']);
    // one warning per block, however often it runs
    assert.equal(warnings(io).length, 4);
    for (const text of warnings(io)) assert.match(text, /one flame sensor: its number is 1/);
    assert.deepEqual(vm.errors(), [], 'a wrong number is not an error of the program');
  });

  it('on a robot without a flame sensor they read "no flame" and say why, once', () => {
    const { io, vm } = boot(start(B.forever([B.print(B.flameSize()), B.print(B.flameDetected())])), false);
    io.sensors.flame = 90;
    runTicks(vm, io, 3);
    assert.deepEqual(io.lines, ['0', 'false', '0', 'false', '0', 'false']);
    assert.equal(warnings(io).length, 2);
    for (const text of warnings(io)) assert.match(text, /no flame sensor fitted/);
  });

  it('the builder writes the number of the sensor into the slot (1 when left out)', () => {
    const blocks = start(B.print(B.flameSize()), B.print(B.flameDetected(B.v('n')))).blocks!.blocks![0];
    const first = blocks.next!.block!.inputs!.TEXT.block!;
    assert.equal(first.type, 'sensing_flame_size');
    assert.equal(first.inputs!.INDEX.shadow!.fields!.NUM, 1);
    const second = blocks.next!.block!.next!.block!.inputs!.TEXT.block!;
    assert.equal(second.inputs!.INDEX.block!.type, 'data_variable');
    // a true / false block does not fit where a pointed slot wants one of its own kind only
    assert.throws(() => B.ifThen(B.flameSize(), []), /round value block/);
  });
});

// =============================================================================================
// On the real engine, with the robot and the field of Fire Chief
// =============================================================================================

type Sim = Simulation<FireChiefScenario>;

function runToEnd(sim: Sim, watch?: (sim: Sim) => void): SimEvent[] {
  const events: SimEvent[] = [];
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    watch?.(sim);
  }
  events.push(...sim.drainEvents());
  return events;
}

const problems = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));

describe('DC motor and flame sensor blocks on the real engine', () => {
  it('the fan blows while the DC motor of its port runs at 20 % or more, in either direction', () => {
    assert.equal(FAN.port, 'M1');
    assert.equal(FAN.minPower, 20);
    const steps: Array<[B.BlockNode, boolean, number]> = [
      [B.dcMotor('M1', 100), true, 100],
      [B.dcMotor('M1', 19), false, 19],
      [B.dcMotor('M1', 20), true, 20],
      [B.dcMotor('M1', -20), true, -20],
      [B.dcMotor('M1', -19.9), false, -19.9],
      [B.dcMotors(60, 0), true, 60],
      [B.stopDcMotor('M1'), false, 0],
      [B.dcMotor('M2', 100), false, 0], // the fan is not on M2
      [B.dcMotors(0, 100), false, 0],
      [B.dcMotor('M1', 100), true, 100],
      [B.stopDcMotor('M2'), true, 100],
      [B.stopDcMotor('all'), false, 0],
    ];
    const sim = createSimulation({
      game: fireChiefGame,
      scenario: openField('living', 'back'),
      program: start(...steps.flatMap(([block]) => [block, B.wait(0.5)])),
    });
    sim.start();
    const ticksPerStep = Math.round(0.5 / sim.dt);
    sim.step(Math.round(ticksPerStep / 2));
    steps.forEach(([, blowing, power], i) => {
      const sensors = sim.readSensors();
      assert.equal(sensors.fanOn, blowing, `step ${i + 1}: fan`);
      assert.equal(sim.world.robot.fanOn, blowing, `step ${i + 1}: robot state`);
      assert.equal(sensors.dcMotorPower.M1, power, `step ${i + 1}: power of M1`);
      sim.step(ticksPerStep);
    });
    assert.deepEqual(sim.vm.errors(), []);
  });

  it('a program that ends with the fan on leaves it on (the attempt goes on); "stop all" switches it off', () => {
    const scenario = openField('living', 'back');
    const left = createSimulation({ game: fireChiefGame, scenario, program: start(B.dcMotor('M1', 100)) });
    left.start();
    left.step(Math.round(5 / left.dt));
    assert.equal(left.vm.idle, true, 'the program has ended');
    assert.equal(left.status, 'running', 'but the fan still runs, so the attempt is not over');
    assert.equal(left.world.robot.fanOn, true);

    const stopped = createSimulation({ game: fireChiefGame, scenario, program: start(B.dcMotor('M1', 100), B.wait(1), B.stop('all')) });
    runToEnd(stopped);
    assert.equal(stopped.finishReason, 'program-ended');
    assert.ok(Math.abs(stopped.world.time - 1) < 0.1, `ended at ${stopped.world.time} s`);
    assert.equal(stopped.readSensors().dcMotorPower.M1, 0);
    assert.equal(stopped.score().total, 0, 'a fan at START, with no target in front of it, scores nothing');
  });

  it('the flame blocks read what the sensor reads: 0 far away, a value in front of the fire, "detected" above the threshold', () => {
    // open field, fire at the side wall of the living room, looking across the top row
    const sim = createSimulation({
      game: fireChiefGame,
      scenario: openField('living', 'side'),
      program: start(
        B.print(B.join('at START: ', B.flameSize())),
        B.print(B.flameDetected()),
        B.moveCm('forward', 120), // up to the top row, cell C1
        B.turn('left', 90), // now facing the living room, two cells away
        B.wait(0.2),
        B.setVar('far', B.flameSize()),
        B.print(B.flameDetected()),
        B.moveCm('forward', 30), // one cell nearer
        B.wait(0.2),
        B.setVar('near', B.flameSize()),
        B.turn('right', 90), // looking away
        B.wait(0.2),
        B.setVar('away', B.flameSize()),
        B.print(B.flameDetected()),
      ),
    });
    const events = runToEnd(sim);
    assert.deepEqual(problems(events), []);
    assert.deepEqual(sim.vm.errors(), []);
    const lines = sim.world.robot.screen.lines;
    assert.deepEqual(lines, ['at START: 0', 'false', 'true', 'false']);
    const { far, near, away } = sim.vm.variables() as Record<string, number>;
    // straight ahead the value is 100 x (1 - distance / range) squared; the sensor is 105 mm ahead of the turning point
    const expected = (mm: number): number => Math.round(100 * (1 - mm / FLAME_SENSOR.rangeMm) ** 2 * 10) / 10;
    assert.equal(far, expected(750 - 105 - 20));
    assert.equal(near, expected(450 - 105 - 20));
    assert.ok(far > FLAME_SENSOR.threshold && near > far, `far ${far}, near ${near}`);
    assert.equal(away, 0);
    assert.equal(sim.readSensors().flame, 0);
  });

  it('blocks alone finish the mission: drive into the room, face the fire, fan for 3 seconds - 100 points', () => {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario: openField('living', 'side'),
      program: start(
        B.moveCm('forward', 120),
        B.turn('left', 90),
        B.moveCm('forward', 60), // the middle of the living room, facing the fire at its side wall
        B.waitUntil(B.gt(B.flameSize(), 50)),
        B.dcMotor('M1', 100),
        B.wait(4),
        B.stopDcMotor('M1'),
      ),
    });
    assert.equal(sim.robotConfig, FIRE_CHIEF_ROBOT);
    const events = runToEnd(sim);
    assert.deepEqual(problems(events), []);
    assert.equal(sim.finishReason, 'mission-complete');
    const report = sim.score();
    assert.equal(report.total, 100);
    assert.deepEqual(
      report.lines.filter((line) => line.max > 0).map((line) => line.points),
      [10, 20, 30, 40],
    );
    const [, , fanStart, fanDone] = report.lines.filter((line) => line.max > 0);
    assert.ok(Math.abs(fanDone.time! - fanStart.time! - 3) < 2 * sim.dt, 'three seconds of fan');
    assert.equal(sim.readSensors().fanOn, false, 'the fan is off after the attempt');
  });

  it('on the Fire Rescue robot the flame blocks read "no flame" with a warning, and the DC motor block moves nothing', () => {
    const sim = createSimulation({
      game: fireRescueGame,
      scenario: fireRescueGame.defaultScenario(),
      program: start(B.print(B.flameSize()), B.print(B.flameDetected()), B.dcMotor('M1', 100), B.wait(0.5), B.stop('all')),
    });
    const before = { ...sim.world.robot.pose };
    sim.start();
    const events: SimEvent[] = [];
    while (sim.status === 'running') {
      sim.step(1);
      events.push(...sim.drainEvents());
    }
    events.push(...sim.drainEvents());
    assert.deepEqual(sim.world.robot.screen.lines, ['0', 'false']);
    assert.equal(problems(events).length, 2);
    for (const text of problems(events)) assert.match(text, /no flame sensor fitted/);
    assert.deepEqual(sim.world.robot.pose, before);
    assert.equal(sim.world.robot.fanOn, false);
    assert.equal(sim.finishReason, 'program-ended');
    assert.equal(sim.score().total, 0);
  });
});
