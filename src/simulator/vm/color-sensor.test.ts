/**
 * The two blocks of the colour sensor that is fixed to the front of the robot (Fire Chief):
 *
 *   colour sensor (1) detects [red v] ?      true / false
 *   colour sensor (1) colour                 a colour name, or "none"
 *
 * First against the pretend robot (fake-io.ts): what each block reads, the number of the
 * sensor, and what happens on a robot that has no such sensor. Then on the real engine with
 * the robot and the field of Fire Chief: a program made of blocks drives up to the red target
 * and stops. Last: the "claw colour sensor" blocks of Fire Rescue read what they always read.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getBlockDef } from '../blocks/catalog';
import { createSimulation } from '../core/simulation';
import type { ProgramJson, RobotConfig, SensorColor, SimEvent } from '../core/types';
import { TARGET_DEPTH, targetPose } from '../fire-chief/field';
import { fireChiefGame, targetOf, targetShift } from '../fire-chief/game';
import { COLOR_SENSOR, COLOR_SENSOR_RANGE_MM, FIRE_CHIEF_ROBOT } from '../fire-chief/robot';
import { openField } from '../fire-chief/scenario';
import { fireRescueGame } from '../fire-rescue/game';
import * as B from './builder';
import { createFakeIO, FAKE_ROBOT_CONFIG, runFor, runTicks, runUntilDone } from './fake-io';
import { createVM } from './index';

/** The front colour sensor of a robot like the one of Fire Chief: fixed to the front, looking forward. */
const FIXED: RobotConfig['frontColorSensor'] = { enabled: true, rangeMm: 15, mount: { forward: 110, height: 60 } };

/**
 * Start a program on a fresh pretend robot. `sensor`: its front colour sensor - fixed to the
 * front (the default here), or the one of the pretend robot itself, which is at the claw.
 */
function boot(program: ProgramJson, sensor: RobotConfig['frontColorSensor'] = FIXED) {
  const io = createFakeIO({ config: { frontColorSensor: sensor } });
  const vm = createVM(program, io);
  vm.start();
  return { io, vm };
}

const start = (...blocks: B.BlockNode[]): ProgramJson => B.program([B.script(B.whenStart(), blocks)]);

const warnings = (io: ReturnType<typeof createFakeIO>): string[] => io.logs.filter((log) => log.level === 'warn').map((log) => log.text);

const COLOURS: B.ColourName[] = ['red', 'yellow', 'green', 'cyan', 'blue', 'purple', 'white', 'black'];

// =============================================================================================
// Pretend robot
// =============================================================================================

describe('colour sensor blocks (pretend robot)', () => {
  it('"colour sensor (1) colour" gives the name of the colour the sensor reads, or "none"', () => {
    const { io, vm } = boot(start(B.forever([B.print(B.colorSensorColor())])));
    const seen: Array<SensorColor | 'none'> = ['none', 'red', 'yellow', 'none', 'blue'];
    for (const colour of seen) {
      io.sensors.frontColor = colour;
      runTicks(vm, io, 1);
    }
    assert.deepEqual(io.lines, seen);
    assert.deepEqual(warnings(io), []);
    assert.deepEqual(vm.errors(), []);
  });

  it('"colour sensor (1) detects [colour] ?" is true for the colour the sensor reads and false for every other one', () => {
    for (const reads of [...COLOURS, 'none'] as const) {
      const { io, vm } = boot(start(...COLOURS.map((colour) => B.print(B.colorSensorDetects(colour)))));
      io.sensors.frontColor = reads;
      runUntilDone(vm, io);
      assert.deepEqual(
        io.lines,
        COLOURS.map((colour) => String(colour === reads)),
        `the sensor reads ${reads}`,
      );
      assert.deepEqual(warnings(io), []);
    }
  });

  it('its menu offers the eight colours a sensor of the simulator can name, red first', () => {
    const menu = getBlockDef('sensing_colorsensor_color_is')!.args[1];
    assert.equal(menu.type, 'field_dropdown');
    assert.deepEqual(menu.type === 'field_dropdown' ? menu.options.map(([text]) => text) : [], COLOURS);
    assert.deepEqual(menu.type === 'field_dropdown' ? menu.options.map(([, value]) => value) : [], COLOURS);
    // the same list as the colour menu of the Quad RGB block, which was checked against mBlock
    assert.deepEqual(menu, getBlockDef('sensing_quadrgb_probe_color_is')!.args[1]);
  });

  it('as dragged out of the palette they ask sensor 1, and the true / false block asks for red', () => {
    const { io, vm } = boot(start(B.print(B.b('sensing_colorsensor_color_is')), B.print(B.b('sensing_colorsensor_color'))));
    io.sensors.frontColor = 'red';
    runUntilDone(vm, io);
    assert.deepEqual(io.lines, ['true', 'red']);
    assert.deepEqual(warnings(io), []);
  });

  it('works in the places a program needs it: wait until, if, a comparison with a word, a variable', () => {
    const { io, vm } = boot(
      start(
        B.move('forward', 20),
        B.waitUntil(B.colorSensorDetects('red')),
        B.stopMotors('all'),
        B.setVar('seen', B.colorSensorColor()),
        B.ifThen(B.eq(B.colorSensorColor(), 'red'), [B.print(B.join('I see ', B.v('seen')))]),
        B.ifThen(B.not(B.colorSensorDetects('yellow')), [B.print('not a wall')]),
      ),
    );
    runFor(vm, io, 0.5);
    assert.equal(vm.running, true, 'still driving: nothing red in front');
    io.sensors.frontColor = 'yellow';
    runFor(vm, io, 0.2);
    assert.equal(vm.running, true, 'a wall is not red');
    assert.equal(io.wheels.left.rpm, 20);
    io.sensors.frontColor = 'red';
    runFor(vm, io, 0.1);
    assert.equal(vm.running, false);
    assert.deepEqual(io.lines, ['I see red', 'not a wall']);
    assert.equal(vm.variables().seen, 'red');
    assert.equal(io.calls[io.calls.length - 3], 'stopWheel all');
    assert.equal(io.wheels.left.rpm, 0);
  });

  it('the number on the block is the number of the sensor: only 1 reads the robot\'s colour sensor', () => {
    const { io, vm } = boot(
      start(
        B.print(B.colorSensorColor(1)),
        B.print(B.colorSensorColor(2)),
        B.print(B.colorSensorDetects('red', 2)),
        B.print(B.colorSensorColor(0)),
        B.print(B.colorSensorColor('1')),
        B.print(B.colorSensorDetects('red', 1)),
        B.forever([B.setVar('other', B.colorSensorColor(3))]),
      ),
    );
    io.sensors.frontColor = 'red';
    runFor(vm, io, 0.2);
    assert.deepEqual(io.lines, ['red', 'none', 'false', 'none', 'red', 'true']);
    assert.equal(vm.variables().other, 'none');
    // one warning per block, however often it runs
    assert.equal(warnings(io).length, 4);
    for (const text of warnings(io)) assert.match(text, /one colour sensor: its number is 1/);
    assert.deepEqual(vm.errors(), [], 'a wrong number is not an error of the program');
  });

  it('on a robot without a colour sensor that looks forward they read "none" and say why, once', () => {
    // the pretend robot as it is: a gripper, and its colour sensor at the claw (holding something red)
    assert.equal(FAKE_ROBOT_CONFIG.frontColorSensor.mount, undefined);
    const claw = boot(start(B.forever([B.print(B.colorSensorColor()), B.print(B.colorSensorDetects('red'))])), FAKE_ROBOT_CONFIG.frontColorSensor);
    claw.io.sensors.frontColor = 'red';
    runTicks(claw.vm, claw.io, 3);
    assert.deepEqual(claw.io.lines, ['none', 'false', 'none', 'false', 'none', 'false']);
    assert.equal(warnings(claw.io).length, 2);
    for (const text of warnings(claw.io)) assert.match(text, /no colour sensor that looks forward/);
    // a sensor that is fitted but switched off
    const off = boot(start(B.print(B.colorSensorColor())), { ...FIXED, enabled: false });
    off.io.sensors.frontColor = 'red';
    runUntilDone(off.vm, off.io);
    assert.deepEqual(off.io.lines, ['none']);
    assert.equal(warnings(off.io).length, 1);
  });

  it('the builder writes the number of the sensor into the slot (1 when left out) and the colour into the menu', () => {
    const blocks = start(B.print(B.colorSensorColor()), B.print(B.colorSensorDetects('yellow', B.v('n')))).blocks!.blocks![0];
    const first = blocks.next!.block!.inputs!.TEXT.block!;
    assert.equal(first.type, 'sensing_colorsensor_color');
    assert.equal(first.inputs!.INDEX.shadow!.fields!.NUM, 1);
    const second = blocks.next!.block!.next!.block!.inputs!.TEXT.block!;
    assert.equal(second.type, 'sensing_colorsensor_color_is');
    assert.equal(second.fields!.COLOR, 'yellow');
    assert.equal(second.inputs!.INDEX.block!.type, 'data_variable');
    assert.equal(B.colorSensorDetects('red').inputs!.INDEX, 1, 'left out: sensor 1');
    // a colour the menu does not have is refused
    assert.throws(() => B.colorSensorDetects('orange' as B.ColourName), /not a choice of "COLOR"/);
    // the name of a colour is a round value: it does not fit a pointed slot; the true / false block does
    assert.throws(() => B.ifThen(B.colorSensorColor(), []), /round value block/);
    assert.doesNotThrow(() => B.ifThen(B.colorSensorDetects('red'), []));
  });
});

// =============================================================================================
// The claw colour sensor blocks of Fire Rescue
// =============================================================================================

describe('claw colour sensor blocks', () => {
  const clawProgram = start(B.print(B.clawColor()), B.print(B.clawColorIs('red')), B.print(B.clawObjectDetected()));

  it('on a robot with the sensor at the claw they read it, as they always did, without a word', () => {
    for (const [reads, lines] of [
      ['red', ['red', 'true', 'true']],
      ['blue', ['blue', 'false', 'true']],
      ['none', ['none', 'false', 'false']],
    ] as const) {
      const { io, vm } = boot(clawProgram, FAKE_ROBOT_CONFIG.frontColorSensor);
      io.sensors.frontColor = reads;
      runUntilDone(vm, io);
      assert.deepEqual(io.lines, lines, reads);
      assert.deepEqual(warnings(io), []);
    }
    // also when that sensor is switched off: the robot's own "none", and no warning (as before)
    const off = boot(clawProgram, { enabled: false, rangeMm: 30 });
    runUntilDone(off.vm, off.io);
    assert.deepEqual(off.io.lines, ['none', 'false', 'false']);
    assert.deepEqual(warnings(off.io), []);
  });

  it('on a robot whose colour sensor is fixed to its front they read "none" - it has no claw - and say so', () => {
    const { io, vm } = boot(clawProgram);
    io.sensors.frontColor = 'red';
    runUntilDone(vm, io);
    assert.deepEqual(io.lines, ['none', 'false', 'false']);
    assert.equal(warnings(io).length, 3);
    for (const text of warnings(io)) assert.match(text, /This robot has no claw/);
  });
});

// =============================================================================================
// On the real engine, with the robot and the field of Fire Chief
// =============================================================================================

const problems = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));

describe('colour sensor blocks on the real engine', () => {
  // the fire stands at the back wall of the living room; its front face is at y = 20
  const scenario = openField('living', 'back');
  const face = { x: targetPose('living', 'back').x, y: TARGET_DEPTH };
  const FRONT = FIRE_CHIEF_ROBOT.chassisFront;

  it('drive slowly forward until the colour sensor reads red, then stop: the robot stops just inside the 15 mm and does not touch the target', () => {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario,
      program: start(
        B.print(B.colorSensorColor()),
        B.move('forward', 30),
        B.waitUntil(B.colorSensorDetects('red')),
        B.stopMotors('all'),
        B.wait(0.5),
        B.print(B.colorSensorColor()),
        B.print(B.colorSensorDetects('red')),
        B.print(B.colorSensorDetects('yellow')),
      ),
      // in the middle of the living room, facing the fire: the nose is 25 mm from its face
      startPose: { x: face.x, y: 150, heading: 0 },
    });
    assert.equal(sim.robotConfig.frontColorSensor, COLOR_SENSOR);
    const events: SimEvent[] = [];
    let touched = false;
    sim.start();
    while (sim.status === 'running') {
      sim.step(1);
      events.push(...sim.drainEvents());
      if (sim.world.robot.touching) touched = true;
    }
    events.push(...sim.drainEvents());
    // (the one thing the log notes: the test put the robot into the room, not into START)
    assert.deepEqual(
      problems(events).filter((text) => !/start zone/.test(text)),
      [],
    );
    assert.deepEqual(sim.vm.errors(), []);
    assert.deepEqual(sim.world.robot.screen.lines, ['none', 'red', 'true', 'false']);
    const gap = sim.world.robot.pose.y - FRONT - face.y;
    assert.ok(gap > 12 && gap <= COLOR_SENSOR_RANGE_MM, `it stopped ${gap} mm in front of the target`);
    assert.equal(touched, false);
    assert.equal(targetShift(targetOf(sim.world)!), 0);
    assert.equal(sim.finishReason, 'program-ended');
  });

  it('blocks alone finish the mission with the colour sensor: drive to the fire until red, stop, fan for 3 seconds - 100 points', () => {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario,
      program: start(
        B.moveCm('forward', 120), // up to the top row
        B.turn('left', 90),
        B.moveCm('forward', 60), // the middle of the living room
        B.turn('right', 90), // facing the fire at the back wall
        B.move('forward', 30),
        B.waitUntil(B.colorSensorDetects('red')),
        B.stopMotors('all'),
        B.dcMotor('M1', 100),
        B.wait(4),
        B.stopDcMotor('M1'),
      ),
    });
    const events: SimEvent[] = [];
    sim.start();
    while (sim.status === 'running') {
      sim.step(1);
      events.push(...sim.drainEvents());
    }
    events.push(...sim.drainEvents());
    assert.deepEqual(problems(events), []);
    assert.equal(sim.finishReason, 'mission-complete');
    assert.equal(sim.score().total, 100);
    assert.equal(sim.readSensors().frontColor, 'red');
    assert.equal(targetShift(targetOf(sim.world)!), 0);
  });

  it('a wall is not the fire: in front of a wall the blocks read "yellow", and "detects red" stays false', () => {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario,
      program: start(B.print(B.colorSensorColor()), B.print(B.colorSensorDetects('red')), B.print(B.colorSensorDetects('yellow'))),
      // the nose 10 mm from the top wall, beside the fire
      startPose: { x: 250, y: 10 + FRONT, heading: 0 },
    });
    sim.start();
    while (sim.status === 'running') sim.step(1);
    assert.deepEqual(sim.world.robot.screen.lines, ['yellow', 'false', 'true']);
  });

  it('on the Fire Rescue robot they read "none" with a warning; its own claw blocks read the claw as before', () => {
    const sim = createSimulation({
      game: fireRescueGame,
      scenario: fireRescueGame.defaultScenario(),
      program: start(B.print(B.colorSensorColor()), B.print(B.colorSensorDetects('red')), B.print(B.clawColor()), B.print(B.clawObjectDetected())),
    });
    const events: SimEvent[] = [];
    sim.start();
    while (sim.status === 'running') {
      sim.step(1);
      events.push(...sim.drainEvents());
    }
    events.push(...sim.drainEvents());
    assert.deepEqual(sim.world.robot.screen.lines, ['none', 'false', 'none', 'false']);
    assert.equal(problems(events).length, 2);
    for (const text of problems(events)) assert.match(text, /no colour sensor that looks forward/);
    assert.equal(sim.finishReason, 'program-ended');
  });

  it('on the Fire Chief robot a claw block of Fire Rescue reads "none" with a warning, right in front of the red target too', () => {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario,
      program: start(B.print(B.clawColor()), B.print(B.clawObjectDetected()), B.print(B.colorSensorColor())),
      startPose: { x: face.x, y: face.y + 10 + FRONT, heading: 0 },
    });
    const events: SimEvent[] = [];
    sim.start();
    while (sim.status === 'running') {
      sim.step(1);
      events.push(...sim.drainEvents());
    }
    events.push(...sim.drainEvents());
    assert.deepEqual(sim.world.robot.screen.lines, ['none', 'false', 'red']);
    assert.equal(problems(events).filter((text) => /This robot has no claw/.test(text)).length, 2);
  });
});
