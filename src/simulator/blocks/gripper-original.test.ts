/**
 * The "original code" of the Gripper blocks (./gripper-original.ts).
 *
 * Real mBlock has no Gripper category, so every Gripper block of the simulator stands for a My
 * Block made of the servo block and a wait. These tests make sure that
 *  - the five My Blocks are written from the robot's own numbers, out of blocks mBlock has;
 *  - each of them does what its Gripper block does, on the real engine;
 *  - every example program that uses Gripper blocks plays the same match once it is rewritten
 *    "the mBlock way";
 *  - rewriting a program keeps everything else as it was, never breaks a My Block or a variable
 *    the student already has, and changes nothing more when it is done twice;
 *  - what comes out loads into the real block editor, and one Undo takes it back.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

import { runBatch, runMatch } from '../core/batch';
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { BlockJson, ProgramJson, RobotConfig, ServoPort, SimEvent, Simulation } from '../core/types';
import { SERVO_PORTS } from '../core/types';
import { bucketBodyId, fireRescueGame } from '../fire-rescue/game';
import { FULL_MISSION_SAMPLE, getSampleProgram, SAMPLE_PROGRAMS } from '../fire-rescue/samples';
import { defaultScenario, encodeScenario, scenarioFromIndex, SCENARIO_COUNT, type FireRescueScenario } from '../fire-rescue/scenario';
import { supportsBlock } from '../vm';
import * as B from '../vm/builder';
import { BLOCKS, fieldArgs, getBlockDef } from './catalog';
import {
  addGripperMyBlocks,
  convertGripperBlocks,
  countGripperBlocks,
  GRIPPER_VARIANTS,
  gripperBlockProgram,
  gripperDefinitionProgram,
  gripperDefinitionsProgram,
  gripperOriginals,
  gripperVariantOf,
  gripperWaitSeconds,
  type GripperVariantId,
} from './gripper-original';
import { createEditor, type BlocklyApi } from './register';
import { estimateStackWidth } from './stack-size';
import { GRIPPER_CODE_CALLBACK, SEE_MBLOCK_CODE, TOOLBOX } from './toolbox';

type Sim = Simulation<FireRescueScenario>;

// =============================================================================================
// Helpers
// =============================================================================================

/** The blocks real mBlock has for this: the servo block, wait, + - *, and a My Block with a number input. */
const MBLOCK_TYPES = [
  'procedures_defnoreturn',
  'mbot2_servo_set',
  'control_wait',
  'math_number',
  'data_variable',
  'operator_add',
  'operator_subtract',
  'operator_multiply',
];

function robot(change: { servoSpeed?: number; gripper?: Partial<RobotConfig['gripper']> }): RobotConfig {
  return {
    ...DEFAULT_ROBOT_CONFIG,
    servoSpeed: change.servoSpeed ?? DEFAULT_ROBOT_CONFIG.servoSpeed,
    gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, ...change.gripper },
  };
}

function tops(program: ProgramJson): BlockJson[] {
  return program.blocks?.blocks ?? [];
}

/** Every block of a program, in reading order: a stack from top to bottom, each block before what is inside it. */
function allBlocks(program: ProgramJson): BlockJson[] {
  const out: BlockJson[] = [];
  const walk = (first: BlockJson | undefined): void => {
    for (let block = first; block; block = block.next?.block) {
      out.push(block);
      for (const slot of Object.values(block.inputs ?? {})) {
        walk(slot.shadow);
        walk(slot.block);
      }
    }
  };
  tops(program).forEach(walk);
  return out;
}

const typesOf = (program: ProgramJson): string[] => allBlocks(program).map((b) => b.type);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function definition(program: ProgramJson, name: string): BlockJson {
  const found = tops(program).filter((b) => b.type.startsWith('procedures_def') && b.fields?.NAME === name);
  assert.equal(found.length, 1, `exactly one definition called "${name}"`);
  return found[0];
}

const definitionNames = (program: ProgramJson): string[] =>
  tops(program)
    .filter((b) => b.type.startsWith('procedures_def'))
    .map((b) => String(b.fields?.NAME));

/** The My Block a call block runs. */
const calledName = (block: BlockJson): string => (block.extraState as { name: string }).name;

function simulate(program: ProgramJson, robotConfig: RobotConfig = DEFAULT_ROBOT_CONFIG, scenario: FireRescueScenario = defaultScenario()): Sim {
  return createSimulation({ game: fireRescueGame, scenario, robotConfig, program });
}

function runToEnd(sim: Sim): SimEvent[] {
  const events: SimEvent[] = [];
  sim.start();
  while (sim.status === 'running') {
    sim.step(5);
    events.push(...sim.drainEvents());
  }
  events.push(...sim.drainEvents());
  return events;
}

const problems = (events: SimEvent[]): SimEvent[] => events.filter((e) => e.type === 'log' && e.level !== 'info');

/**
 * The gripper ends in the same state in two matches: the four servos, the arm, the claw and
 * what it holds. Angles may differ by a rounding error of the computer and no more: the Gripper
 * block works out 90 x (70 / 100), its My Block 70 x 0.9, which is 63 give or take 0.00000000000001.
 */
function assertSameGripper(actual: Sim, expected: Sim, message?: string): void {
  const near = (a: number, b: number, what: string): void => assert.ok(Math.abs(a - b) < 1e-9, `${message ?? ''} ${what}: ${a} instead of ${b}`);
  for (const port of SERVO_PORTS) {
    near(actual.world.robot.servos[port].angle, expected.world.robot.servos[port].angle, `servo ${port}`);
    near(actual.world.robot.servos[port].target, expected.world.robot.servos[port].target, `where servo ${port} was sent`);
  }
  near(actual.world.robot.gripper.height, expected.world.robot.gripper.height, 'height of the arm');
  near(actual.world.robot.gripper.gap, expected.world.robot.gripper.gap, 'gap of the claw');
  assert.equal(actual.world.robot.gripper.holding, expected.world.robot.gripper.holding, message);
}

/**
 * Play a program and the same program rewritten the mBlock way; neither may complain, and both
 * must end the same way (by themselves, unless `finish` says the match runs until the time is up).
 */
function playBoth(
  program: ProgramJson,
  robotConfig: RobotConfig = DEFAULT_ROBOT_CONFIG,
  scenario: FireRescueScenario = defaultScenario(),
  finish: 'program-ended' | 'time' = 'program-ended',
) {
  const change = convertGripperBlocks(program, robotConfig);
  const original = simulate(program, robotConfig, scenario);
  const converted = simulate(change.program, robotConfig, scenario);
  const originalEvents = runToEnd(original);
  const convertedEvents = runToEnd(converted);
  for (const [name, sim, events] of [['with Gripper blocks', original, originalEvents], ['the mBlock way', converted, convertedEvents]] as const) {
    assert.equal(sim.finishReason, finish, name);
    assert.deepEqual(sim.vm.errors(), [], name);
    assert.deepEqual(problems(events), [], name);
  }
  return { change, original, converted, originalEvents, convertedEvents };
}

const start = (body: B.BlockNode[]): ProgramJson => B.program([B.script(B.whenStart(), body)]);

// =============================================================================================
// The five My Blocks
// =============================================================================================

describe('the original code of the Gripper blocks', () => {
  test('default robot: the five My Blocks, in words', () => {
    assert.deepEqual(
      gripperOriginals(DEFAULT_ROBOT_CONFIG).map((o) => o.lines),
      [
        ['define gripper opens', 'set servo S2 angle to 0 °', 'wait 0.4 seconds'],
        ['define gripper closes', 'set servo S2 angle to 60 °', 'wait 0.4 seconds'],
        ['define arm raises', 'set servo S1 angle to 90 °', 'wait 0.5 seconds'],
        ['define arm lowers', 'set servo S1 angle to 0 °', 'wait 0.5 seconds'],
        ['define arm moves to height (height)', 'set servo S1 angle to height * 0.9 °', 'wait 0.5 seconds'],
      ],
    );
    assert.deepEqual(
      gripperOriginals(DEFAULT_ROBOT_CONFIG).map((o) => [o.variant.id, o.servo, o.angle, o.wait]),
      [
        ['claw-open', 'S2', 0, 0.4],
        ['claw-close', 'S2', 60, 0.4],
        ['arm-raise', 'S1', 90, 0.5],
        ['arm-lower', 'S1', 0, 0.5],
        ['arm-height', 'S1', undefined, 0.5],
      ],
    );
  });

  test('every Gripper block of the catalog, with every choice of its menu, has its My Block', () => {
    const fromCatalog: string[] = [];
    for (const def of BLOCKS.filter((d) => d.category === 'gripper')) {
      const menu = fieldArgs(def).find((arg) => arg.type === 'field_dropdown');
      if (menu && menu.type === 'field_dropdown') {
        for (const [shown, stored] of menu.options) {
          const variant = gripperVariantOf({ type: def.type, fields: { [menu.name]: stored } });
          assert.ok(variant, `${def.type} ${stored}`);
          assert.equal(variant.blockType, def.type);
          assert.equal(variant.action, stored);
          assert.equal(variant.label, def.message.replace('%1', shown), 'the words of the block');
          fromCatalog.push(variant.id);
        }
      } else {
        const variant = gripperVariantOf({ type: def.type });
        assert.ok(variant, def.type);
        assert.equal(variant.label, def.message.replace('%1', '50'));
        fromCatalog.push(variant.id);
      }
    }
    assert.deepEqual(fromCatalog, GRIPPER_VARIANTS.map((v) => v.id), 'the same five, in palette order');
    assert.equal(new Set(GRIPPER_VARIANTS.map((v) => v.myBlock)).size, 5, 'five different names');
    for (const variant of GRIPPER_VARIANTS) assert.ok(variant.label.startsWith(variant.myBlock), `"${variant.myBlock}" is named after its block`);
    assert.deepEqual(GRIPPER_VARIANTS.find((v) => v.id === 'arm-height')?.inputs, ['height']);
  });

  test('a block saved without its menu, or with an unknown choice, counts as the interpreter runs it', () => {
    // vm/handlers.ts: the claw closes only for "close", the arm raises only for "raise"; a missing menu is the first choice
    assert.equal(gripperVariantOf({ type: 'gripper_claw' })?.id, 'claw-open');
    assert.equal(gripperVariantOf({ type: 'gripper_claw', fields: { ACTION: 'whatever' } })?.id, 'claw-open');
    assert.equal(gripperVariantOf({ type: 'gripper_arm' })?.id, 'arm-raise');
    assert.equal(gripperVariantOf({ type: 'gripper_arm', fields: { ACTION: 'whatever' } })?.id, 'arm-lower');
    assert.equal(gripperVariantOf({ type: 'mbot2_servo_set' }), undefined);
    assert.equal(gripperVariantOf({ type: 'procedures_callnoreturn' }), undefined);
  });

  test('the definitions are made only of blocks real mBlock has, and the interpreter knows them all', () => {
    const robots = [DEFAULT_ROBOT_CONFIG, robot({ gripper: { liftDownAngle: 20, liftUpAngle: 140 } }), robot({ gripper: { liftDownAngle: 100, liftUpAngle: 10 } })];
    for (const config of robots) {
      const program = gripperDefinitionsProgram(config);
      assert.equal(tops(program).length, 5);
      for (const block of allBlocks(program)) {
        assert.ok(MBLOCK_TYPES.includes(block.type), `${block.type} is not a block of real mBlock`);
        assert.ok(supportsBlock(block.type), block.type);
      }
      assert.equal(countGripperBlocks(program), 0);
      const ids = allBlocks(program).map((b) => b.id);
      assert.equal(new Set(ids).size, ids.length, 'every block has its own id');
    }
    // on the default robot nothing but the servo block, the wait and one "*"
    assert.deepEqual(
      [...new Set(typesOf(gripperDefinitionsProgram(DEFAULT_ROBOT_CONFIG)))].sort(),
      ['control_wait', 'data_variable', 'math_number', 'mbot2_servo_set', 'operator_multiply', 'procedures_defnoreturn'],
    );
  });

  test('in a program every definition carries a short note that names its Gripper block; the pictures have none', () => {
    const program = gripperDefinitionsProgram(DEFAULT_ROBOT_CONFIG);
    for (const original of gripperOriginals(DEFAULT_ROBOT_CONFIG)) {
      const def = definition(program, original.variant.myBlock);
      const note = (def.icons as { comment: { text: string; pinned: boolean } }).comment;
      assert.equal(note.text, original.note);
      assert.equal(note.pinned, false, 'closed until the student clicks the "?" icon');
      assert.ok(note.text.includes(`"${original.variant.label}"`), note.text);
      assert.ok(note.text.includes(`servo ${original.servo}`), note.text);
      assert.ok(note.text.length <= 220, `a note is short ("${note.text}")`);
      assert.equal(tops(gripperDefinitionProgram(DEFAULT_ROBOT_CONFIG, original.variant.id))[0].icons, undefined);
    }
    assert.equal(
      gripperOriginals(DEFAULT_ROBOT_CONFIG)[1].note,
      'Does what the Gripper block "gripper closes until done" does: servo S2 turns to 60°, and the wait gives it time to get there.',
    );
  });

  test('"arm moves to height" has one number input, a variable of the program', () => {
    const program = gripperDefinitionsProgram(DEFAULT_ROBOT_CONFIG);
    assert.equal(program.variables?.length, 1);
    const height = program.variables![0];
    assert.equal(height.name, 'height');
    const def = definition(program, 'arm moves to height');
    assert.deepEqual(def.extraState, { params: [{ name: 'height', id: height.id }] });
    const reads = allBlocks(programOf(def)).filter((b) => b.type === 'data_variable');
    assert.deepEqual(reads.map((b) => b.fields?.VARIABLE), [{ id: height.id }], 'the definition reads its input');
    for (const name of ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers']) {
      assert.equal(definition(program, name).extraState, undefined, `${name} has no input`);
    }
  });

  test('nothing is a fixed number: ports, angles and waits come from the robot', () => {
    const other = robot({
      servoSpeed: 60,
      gripper: { liftServo: 'S3', clawServo: 'S4', liftDownAngle: 20, liftUpAngle: 140, clawOpenAngle: 30, clawClosedAngle: 90 },
    });
    assert.deepEqual(
      gripperOriginals(other).map((o) => o.lines),
      [
        ['define gripper opens', 'set servo S4 angle to 30 °', 'wait 1 seconds'],
        ['define gripper closes', 'set servo S4 angle to 90 °', 'wait 1 seconds'],
        ['define arm raises', 'set servo S3 angle to 140 °', 'wait 2 seconds'],
        ['define arm lowers', 'set servo S3 angle to 20 °', 'wait 2 seconds'],
        ['define arm moves to height (height)', 'set servo S3 angle to 20 + height * 1.2 °', 'wait 2 seconds'],
      ],
    );
    // the blocks say the same as the words
    const program = gripperDefinitionsProgram(other);
    const closes = definition(program, 'gripper closes').inputs!.STACK.block!;
    assert.equal(closes.type, 'mbot2_servo_set');
    assert.equal(closes.fields?.PORT, 'S4');
    assert.equal(closes.inputs!.ANGLE.shadow!.fields!.NUM, 90);
    assert.equal(closes.inputs!.ANGLE.block, undefined, 'a plain number sits in the white bubble');
    assert.equal(closes.next!.block!.type, 'control_wait');
    assert.equal(closes.next!.block!.inputs!.DURATION.shadow!.fields!.NUM, 1);
    assert.equal(closes.next!.block!.next, undefined, 'two blocks, no more');
    const height = definition(program, 'arm moves to height').inputs!.STACK.block!;
    const sum = height.inputs!.ANGLE.block!;
    assert.equal(sum.type, 'operator_add');
    assert.equal(sum.inputs!.NUM1.shadow!.fields!.NUM, 20);
    assert.equal(sum.inputs!.NUM2.block!.type, 'operator_multiply');
    assert.equal(sum.inputs!.NUM2.block!.inputs!.NUM1.block!.type, 'data_variable');
    assert.equal(sum.inputs!.NUM2.block!.inputs!.NUM2.shadow!.fields!.NUM, 1.2);
  });

  test('the height formula is written as simply as the numbers allow', () => {
    const formula = (liftDownAngle: number, liftUpAngle: number): string =>
      gripperOriginals(robot({ gripper: { liftDownAngle, liftUpAngle } })).find((o) => o.variant.id === 'arm-height')!.angleText;
    assert.equal(formula(0, 90), 'height * 0.9');
    assert.equal(formula(0, 100), 'height');
    assert.equal(formula(10, 110), '10 + height');
    assert.equal(formula(20, 140), '20 + height * 1.2');
    assert.equal(formula(100, 10), '100 - height * 0.9', 'an arm whose servo turns the other way');
    assert.equal(formula(120, 20), '120 - height');
    assert.equal(formula(15, 50), '15 + height * 0.35', 'no binary noise in the number');
    assert.equal(formula(45, 45), '45', 'an arm that cannot move');
  });

  test('the wait is the travel time of the servo, rounded up to a tenth of a second', () => {
    const wait = (servoSpeed: number, open: number, closed: number): number =>
      gripperWaitSeconds(robot({ servoSpeed, gripper: { clawOpenAngle: open, clawClosedAngle: closed } }), 'claw');
    assert.equal(wait(180, 0, 60), 0.4, '0.333 s rounds up');
    assert.equal(wait(180, 0, 54), 0.3, 'exactly 0.3 s stays 0.3 s');
    assert.equal(wait(180, 0, 55), 0.4);
    assert.equal(wait(180, 60, 0), 0.4, 'the direction does not matter');
    assert.equal(wait(180, 0, 180), 1);
    assert.equal(wait(100, 0, 7), 0.1);
    assert.equal(wait(60, 10, 100), 1.5);
    assert.equal(wait(180, 30, 30), 0, 'a claw that does not move needs no wait');
    assert.equal(wait(0, 0, 60), 0, 'a servo speed of 0 cannot be waited for');
    assert.equal(gripperWaitSeconds(DEFAULT_ROBOT_CONFIG, 'arm'), 0.5);
    // long enough: the servo really is there when the wait is over
    for (const config of [DEFAULT_ROBOT_CONFIG, robot({ servoSpeed: 77, gripper: { clawClosedAngle: 53, liftUpAngle: 131 } })]) {
      const g = config.gripper;
      assert.ok(gripperWaitSeconds(config, 'claw') * config.servoSpeed >= Math.abs(g.clawClosedAngle - g.clawOpenAngle));
      assert.ok(gripperWaitSeconds(config, 'arm') * config.servoSpeed >= Math.abs(g.liftUpAngle - g.liftDownAngle));
    }
  });

  test('the pictures of the window: the Gripper block as the palette hands it out, and its definition alone', () => {
    const gripper = TOOLBOX.contents.find((c) => c.toolboxitemid === 'gripper')!;
    for (const variant of GRIPPER_VARIANTS) {
      const block = tops(gripperBlockProgram(variant.id));
      assert.equal(block.length, 1);
      assert.equal(gripperVariantOf(block[0])?.id, variant.id);
      const inPalette = gripper.contents!.find((item) => item.kind === 'block' && item.type === variant.blockType);
      assert.ok(inPalette && inPalette.kind === 'block');
      // the same slots with the same bubbles as in the palette; only the menu is set to this variant
      assert.deepEqual(
        Object.fromEntries(Object.entries(block[0].inputs ?? {}).map(([name, slot]) => [name, slot.shadow?.fields])),
        Object.fromEntries(Object.entries(inPalette.inputs ?? {}).map(([name, slot]) => [name, slot.shadow.fields])),
      );

      const code = gripperDefinitionProgram(DEFAULT_ROBOT_CONFIG, variant.id);
      assert.equal(tops(code).length, 1);
      assert.equal(tops(code)[0].fields?.NAME, variant.myBlock);
      assert.equal(code.variables?.length, variant.inputs.length);
      // the same blocks as the definition that goes into a program
      const inProgram = definition(gripperDefinitionsProgram(DEFAULT_ROBOT_CONFIG), variant.myBlock);
      assert.deepEqual(typesOf(code), typesOf(programOf(inProgram)));
    }
  });
});

function programOf(...blocks: BlockJson[]): ProgramJson {
  return { blocks: { languageVersion: 0, blocks }, variables: [] };
}

// =============================================================================================
// Each My Block does what its Gripper block does
// =============================================================================================

describe('each My Block behaves like its Gripper block', () => {
  const cases: Array<{ name: string; uses: GripperVariantId[]; body: () => B.BlockNode[] }> = [
    { name: 'gripper closes', uses: ['claw-close'], body: () => [B.gripper('close')] },
    { name: 'gripper closes, then opens', uses: ['claw-close', 'claw-open'], body: () => [B.gripper('close'), B.gripper('open')] },
    { name: 'gripper opens when it is open already', uses: ['claw-open'], body: () => [B.gripper('open')] },
    { name: 'arm raises', uses: ['arm-raise'], body: () => [B.arm('raise')] },
    { name: 'arm raises, then lowers', uses: ['arm-raise', 'arm-lower'], body: () => [B.arm('raise'), B.arm('lower')] },
    { name: 'arm lowers when it is down already', uses: ['arm-lower'], body: () => [B.arm('lower')] },
    { name: 'arm moves to height 30', uses: ['arm-height'], body: () => [B.armHeight(30)] },
    { name: 'arm moves to height 100, then 25', uses: ['arm-height'], body: () => [B.armHeight(100), B.armHeight(25)] },
    { name: 'arm raises, then moves to height 0', uses: ['arm-raise', 'arm-height'], body: () => [B.arm('raise'), B.armHeight(0)] },
    { name: 'all five, one after the other', uses: ['claw-close', 'arm-raise', 'arm-height', 'arm-lower', 'claw-open'], body: () => [B.gripper('close'), B.arm('raise'), B.armHeight(60), B.arm('lower'), B.gripper('open'), B.armHeight(45), B.gripper('close')] }, // prettier-ignore
  ];
  const robots: Array<{ name: string; config: RobotConfig }> = [
    { name: 'default robot', config: DEFAULT_ROBOT_CONFIG },
    {
      name: 'robot with other ports, angles and servo speed',
      config: robot({ servoSpeed: 110, gripper: { liftServo: 'S4', clawServo: 'S1', liftDownAngle: 15, liftUpAngle: 120, clawOpenAngle: 10, clawClosedAngle: 85 } }),
    },
  ];

  for (const { name: robotName, config } of robots) {
    test(`${robotName}: the servos end at the same angles`, () => {
      for (const c of cases) {
        const { change, original, converted } = playBoth(start(c.body()), config);
        assert.deepEqual(Object.keys(change.myBlocks).sort(), [...c.uses].sort(), c.name);
        assert.equal(countGripperBlocks(change.program), 0, c.name);
        assertSameGripper(converted, original, c.name);
        // ... and the servos really are where they were sent
        for (const port of SERVO_PORTS) assert.equal(converted.world.robot.servos[port].angle, converted.world.robot.servos[port].target, `${c.name}: ${port}`);
      }
    });
  }

  test('the angles are the ones of the robot', () => {
    const angle = (body: B.BlockNode[], port: ServoPort): number => playBoth(start(body)).converted.world.robot.servos[port].angle;
    assert.equal(angle([B.gripper('close')], 'S2'), 60);
    assert.equal(angle([B.gripper('close'), B.gripper('open')], 'S2'), 0);
    assert.equal(angle([B.arm('raise')], 'S1'), 90);
    assert.equal(angle([B.arm('raise'), B.arm('lower')], 'S1'), 0);
    assert.equal(angle([B.armHeight(50)], 'S1'), 45);
    assert.equal(angle([B.armHeight(100)], 'S1'), 90);
  });

  test('the claw really grabs a bucket, puts it down and grabs it again', () => {
    const demo = getSampleProgram('gripper-demo')!.program;
    for (const scenario of [defaultScenario(), scenarioFromIndex(4321)]) {
      const code = encodeScenario(scenario);
      const bucketId = bucketBodyId(scenario.buckets.W1);
      const { original, converted, originalEvents, convertedEvents } = playBoth(demo, DEFAULT_ROBOT_CONFIG, scenario);
      const grips = (events: SimEvent[]) => events.filter((e) => e.type === 'grab' || e.type === 'release').map((e) => [e.type, 'bodyId' in e ? e.bodyId : '']);
      assert.deepEqual(grips(convertedEvents), [['grab', bucketId], ['release', bucketId], ['grab', bucketId]], code);
      assert.deepEqual(grips(convertedEvents), grips(originalEvents), code);
      assert.equal(converted.world.robot.gripper.holding, bucketId, code);
      const bucket = converted.world.bodies.find((b) => b.id === bucketId)!;
      assert.ok(bucket.held && bucket.z > 60, `${code}: the bucket hangs in the raised claw (z = ${bucket.z})`);
      // the whole field ends as with the Gripper blocks
      assertSameGripper(converted, original, code);
      for (const body of converted.world.bodies) {
        const twin = original.world.bodies.find((b) => b.id === body.id)!;
        assert.ok(Math.hypot(body.x - twin.x, body.y - twin.y) < 0.01 && Math.abs(body.z - twin.z) < 0.01, `${code}: ${body.id} ends in the same place`);
      }
    }
  });
});

// =============================================================================================
// The example programs, the mBlock way
// =============================================================================================

describe('the example programs rewritten the mBlock way', () => {
  const expected: Record<string, { score: number; gripperBlocks: number; myBlocks: string[] }> = {
    'gripper-demo': { score: 0, gripperBlocks: 7, myBlocks: ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers'] },
    'one-bucket': { score: 20, gripperBlocks: 4, myBlocks: ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers'] },
    'one-person': { score: 20, gripperBlocks: 4, myBlocks: ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers'] },
    'smart-bucket': { score: 20, gripperBlocks: 4, myBlocks: ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers'] },
    'full-mission': { score: 180, gripperBlocks: 12, myBlocks: ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers'] },
  };

  test('every example that uses Gripper blocks is in the list above', () => {
    const using = [...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE].filter((s) => countGripperBlocks(s.program) > 0).map((s) => s.id);
    assert.deepEqual(using.sort(), Object.keys(expected).sort());
  });

  test('examples without Gripper blocks come back as they are', () => {
    for (const id of ['hello', 'line-follow']) {
      const sample = getSampleProgram(id)!;
      const change = convertGripperBlocks(sample.program, DEFAULT_ROBOT_CONFIG);
      assert.equal(change.program, sample.program, `${id}: the very same program`);
      assert.equal(change.replaced, 0);
      assert.deepEqual(change.added, []);
    }
  });

  for (const [id, want] of Object.entries(expected)) {
    test(`${id}: no Gripper block left, the same score (${want.score}) on the default combination`, () => {
      const sample = getSampleProgram(id)!;
      const before = copy(sample.program);
      const { change, original, converted, convertedEvents } = playBoth(sample.program);
      assert.deepEqual(sample.program, before, 'the example itself is not touched');

      assert.equal(countGripperBlocks(sample.program), want.gripperBlocks);
      assert.equal(change.replaced, want.gripperBlocks);
      assert.deepEqual(change.added, want.myBlocks);
      assert.equal(countGripperBlocks(change.program), 0);
      assert.ok(!typesOf(change.program).some((type) => type.startsWith('gripper_')), 'no Gripper block left');
      for (const type of typesOf(change.program)) assert.ok(supportsBlock(type), type);
      assert.equal(allBlocks(change.program).filter((b) => b.type === 'procedures_callnoreturn' && want.myBlocks.includes(calledName(b))).length, want.gripperBlocks);

      assert.equal(original.score().total, want.score, 'with Gripper blocks');
      assert.equal(converted.score().total, want.score, 'the mBlock way');
      assert.deepEqual(converted.score().lines.map((l) => [l.id, l.ok, l.points]), original.score().lines.map((l) => [l.id, l.ok, l.points]));
      assert.equal(convertedEvents.filter((e) => e.type === 'bump').length, 0, 'it never ran into anything');
      assert.deepEqual(converted.world.robot.screen.lines, original.world.robot.screen.lines);
      // the fixed waits cost a little time, never much
      assert.ok(converted.world.time >= original.world.time);
      assert.ok(converted.world.time < original.world.time + want.gripperBlocks * 0.5 + 0.01, `${original.world.time.toFixed(2)} s -> ${converted.world.time.toFixed(2)} s`);
      assert.ok(converted.world.time < fireRescueGame.matchDuration - 30, 'well inside the match time');
    });
  }

  test('smart-bucket the mBlock way still scores 20 on 240 other combinations', () => {
    const converted = convertGripperBlocks(getSampleProgram('smart-bucket')!.program, DEFAULT_ROBOT_CONFIG).program;
    const scenarios: FireRescueScenario[] = [];
    // 37 and the number of combinations have no common divisor: 240 different ones, spread over all of them
    for (let i = 0; i < 240; i++) scenarios.push(scenarioFromIndex((i * 37 + 11) % SCENARIO_COUNT));
    const codes = scenarios.map(encodeScenario);
    assert.equal(new Set(codes).size, 240, '240 different combinations');
    assert.ok(!codes.includes(encodeScenario(defaultScenario())), 'none of them is the default combination');
    assert.equal(new Set(scenarios.map((s) => s.buckets.W1)).size, 4, 'every colour stands on W1 in some of them');

    const results = runBatch(fireRescueGame, DEFAULT_ROBOT_CONFIG, converted, scenarios);
    const failed = results.filter((r) => r.total !== 20 || r.errors !== undefined || r.finishReason !== 'program-ended');
    assert.deepEqual(failed.map((r) => `${r.scenarioCode}: ${r.total}`), []);
    assert.equal(results.length, 240);
  });
});

// =============================================================================================
// Rewriting a program
// =============================================================================================

/** A program with Gripper blocks in every kind of place. */
function tricky(): ProgramJson {
  const program = B.program([
    B.script(B.whenStart(), [
      B.setVar('h', 40),
      B.repeat(2, [B.gripper('close'), B.gripper('open')]),
      B.ifElse(B.lt(B.ultrasonic(), 500), [B.arm('raise')], [B.arm('lower'), B.gripper('close')]),
      B.ifThen(B.gt(B.v('h'), 10), [B.withId(B.armHeight(B.v('h')), 'height-of-variable')]),
      B.withId(B.armHeight(B.add(B.v('h'), 35)), 'height-of-sum'),
      B.call('up and down', 3),
      B.note(B.withId(B.arm('lower'), 'noted'), 'Down again.'),
      B.print(B.join('h = ', B.v('h'))),
    ]),
    B.script(B.whenButton('a'), [B.repeatUntil(B.buttonPressed('b'), [B.gripper('close'), B.wait(0.2)])]),
    B.define('up and down', ['times'], [B.repeat(B.v('times'), [B.armHeight(10), B.armHeight(90)])]),
  ]);
  // a Gripper block lying loose on the workspace, and one that is switched off
  tops(program).push({ type: 'gripper_claw', id: 'loose', x: 900, y: 500, fields: { ACTION: 'close' }, next: { block: { type: 'gripper_arm', id: 'loose-2', fields: { ACTION: 'lower' } } } });
  const startScript = tops(program).find((b) => b.type === 'event_cyberpi_start')!;
  const first = startScript.next!.block!;
  first.next = { block: { type: 'gripper_arm', id: 'switched-off', enabled: false, fields: { ACTION: 'raise' }, next: first.next } };
  return program;
}

/**
 * A block with everything the rewriting must keep, and the Gripper blocks (or the calls that took
 * their place) written the same way, so that a program and its rewritten twin can be compared.
 */
function shape(block: BlockJson | undefined, names: Partial<Record<GripperVariantId, string>>): unknown {
  if (!block) return undefined;
  const variant = gripperVariantOf(block);
  const isOurCall = block.type === 'procedures_callnoreturn' && Object.values(names).includes(calledName(block));
  const { type, fields, inputs, extraState, next, ...rest } = block;
  const slots = Object.fromEntries(
    Object.entries(inputs ?? {}).map(([name, slot]) => [variant || isOurCall ? 'SLOT' : name, { shadow: shape(slot.shadow, names), block: shape(slot.block, names) }]),
  );
  const what = variant ? { myBlock: names[variant.id] } : isOurCall ? { myBlock: calledName(block) } : { type, fields, extraState };
  return { ...rest, ...what, slots, next: shape(next?.block, names) };
}

describe('rewriting a program the mBlock way', () => {
  test('Gripper blocks in loops, ifs, My Blocks, other scripts and lying loose all become calls; the rest stays', () => {
    const program = tricky();
    const before = copy(program);
    const change = convertGripperBlocks(program, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(program, before, 'the program that was passed in is not changed');

    assert.equal(countGripperBlocks(program), 14);
    assert.equal(change.replaced, 14);
    assert.equal(countGripperBlocks(change.program), 0);
    assert.deepEqual(change.added, ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers', 'arm moves to height']);
    assert.deepEqual(change.myBlocks, {
      'claw-open': 'gripper opens',
      'claw-close': 'gripper closes',
      'arm-raise': 'arm raises',
      'arm-lower': 'arm lowers',
      'arm-height': 'arm moves to height',
    });

    // the five new definitions come first; then the stacks that were there, in their order, in their places
    const after = tops(change.program);
    assert.deepEqual(after.slice(0, 5).map((b) => b.fields?.NAME), change.added);
    const kept = after.slice(5);
    assert.deepEqual(kept.map((b) => [b.id, b.x, b.y]), tops(program).map((b) => [b.id, b.x, b.y]));
    // every block keeps its id, its place in the stack, its neighbours, its note and whether it is switched off
    assert.deepEqual(allBlocks(programOf(...kept)).map((b) => b.id), allBlocks(program).map((b) => b.id));
    assert.deepEqual(kept.map((b) => shape(b, change.myBlocks)), tops(program).map((b) => shape(b, change.myBlocks)));

    const byId = new Map(allBlocks(change.program).map((b) => [b.id, b]));
    assert.deepEqual((byId.get('noted')!.icons as { comment: { text: string } }).comment.text, 'Down again.');
    assert.equal(byId.get('switched-off')!.enabled, false);
    assert.equal(byId.get('switched-off')!.type, 'procedures_callnoreturn');
    assert.deepEqual([byId.get('loose')!.x, byId.get('loose')!.y], [900, 500]);
    assert.equal(calledName(byId.get('loose')!), 'gripper closes');
    assert.equal(calledName(byId.get('loose-2')!), 'arm lowers');
    // calls are written as Blockly writes them
    assert.deepEqual(byId.get('noted')!.extraState, { name: 'arm lowers' });
    assert.deepEqual(byId.get('height-of-sum')!.extraState, { name: 'arm moves to height', params: ['height'] });
  });

  test('a variable or a sum plugged into "height" moves over untouched', () => {
    const program = tricky();
    const change = convertGripperBlocks(program, DEFAULT_ROBOT_CONFIG);
    const was = new Map(allBlocks(program).map((b) => [b.id, b]));
    const now = new Map(allBlocks(change.program).map((b) => [b.id, b]));
    for (const id of ['height-of-variable', 'height-of-sum']) {
      assert.deepEqual(Object.keys(now.get(id)!.inputs!), ['ARG0'], id);
      assert.deepEqual(now.get(id)!.inputs!.ARG0, was.get(id)!.inputs!.HEIGHT, id);
    }
    assert.equal(now.get('height-of-variable')!.inputs!.ARG0.block!.type, 'data_variable');
    assert.equal(now.get('height-of-sum')!.inputs!.ARG0.block!.type, 'operator_add');

    // and it is worked out as before: 40 % -> 36 degrees, 40 + 35 = 75 % -> 67.5 degrees
    const angle = (body: B.BlockNode[]): number => playBoth(start(body)).converted.world.robot.servos.S1.angle;
    assert.equal(angle([B.setVar('h', 40), B.armHeight(B.v('h'))]), 36);
    assert.equal(angle([B.setVar('h', 40), B.armHeight(B.add(B.v('h'), 35))]), 67.5);
    assert.equal(angle([B.setVar('h', 40), B.armHeight(B.mul(B.v('h'), 2))]), 72);
  });

  test('the rewritten program runs like the one with Gripper blocks', () => {
    // (it has a "when button A pressed" script, so the match runs until the time is up)
    const { original, converted } = playBoth(tricky(), DEFAULT_ROBOT_CONFIG, defaultScenario(), 'time');
    assertSameGripper(converted, original);
    assert.deepEqual(converted.world.robot.screen.lines, ['h = 40']);
    assert.deepEqual(converted.vm.variables(), original.vm.variables());
  });

  test('nothing to convert: the program comes back as it is', () => {
    const plain = start([B.moveCm('forward', 10), B.setServo('S2', 60), B.wait(0.4)]);
    const change = convertGripperBlocks(plain, DEFAULT_ROBOT_CONFIG);
    assert.equal(change.program, plain);
    assert.equal(change.replaced, 0);
    assert.deepEqual(change.added, []);
    assert.deepEqual(change.myBlocks, {});
    for (const empty of [{}, { blocks: {} }, { blocks: { blocks: [] }, variables: [] }] as ProgramJson[]) {
      assert.equal(convertGripperBlocks(empty, DEFAULT_ROBOT_CONFIG).program, empty);
    }
  });

  test('converting twice changes nothing more', () => {
    const programs = [tricky(), ...[...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE].map((s) => s.program)];
    for (const program of programs) {
      const once = convertGripperBlocks(program, DEFAULT_ROBOT_CONFIG);
      const snapshot = copy(once.program);
      const twice = convertGripperBlocks(once.program, DEFAULT_ROBOT_CONFIG);
      assert.equal(twice.program, once.program, 'the very same program comes back');
      assert.deepEqual(twice.program, snapshot);
      assert.equal(twice.replaced, 0);
      assert.deepEqual(twice.added, []);
    }
  });

  test('"add these My Blocks": five definitions, and none the second time', () => {
    const blank: ProgramJson = { blocks: { languageVersion: 0, blocks: [{ type: 'event_cyberpi_start', id: 'start-hat', x: 40, y: 40 }] }, variables: [] };
    const before = copy(blank);
    const once = addGripperMyBlocks(blank, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(blank, before, 'the program that was passed in is not changed');
    assert.deepEqual(once.added, ['gripper opens', 'gripper closes', 'arm raises', 'arm lowers', 'arm moves to height']);
    assert.equal(once.replaced, 0);
    assert.deepEqual(definitionNames(once.program), once.added);
    assert.equal(tops(once.program).length, 6);
    assert.deepEqual(once.program.variables, [{ name: 'height', id: 'mblock-height' }]);

    const twice = addGripperMyBlocks(once.program, DEFAULT_ROBOT_CONFIG);
    assert.equal(twice.program, once.program, 'nothing is added the second time');
    assert.deepEqual(twice.added, []);
    assert.equal(Object.keys(twice.myBlocks).length, 5);

    // an empty program gets them too; a program that already has some gets only the missing ones
    assert.equal(tops(addGripperMyBlocks({}, DEFAULT_ROBOT_CONFIG).program).length, 5);
    const oneBucket = convertGripperBlocks(getSampleProgram('one-bucket')!.program, DEFAULT_ROBOT_CONFIG).program;
    assert.deepEqual(addGripperMyBlocks(oneBucket, DEFAULT_ROBOT_CONFIG).added, ['arm moves to height']);
    // Gripper blocks stay Gripper blocks when the My Blocks are only added
    const demo = getSampleProgram('gripper-demo')!.program;
    assert.equal(countGripperBlocks(addGripperMyBlocks(demo, DEFAULT_ROBOT_CONFIG).program), countGripperBlocks(demo));
    // ... and are converted later without a second set of definitions
    const later = convertGripperBlocks(addGripperMyBlocks(demo, DEFAULT_ROBOT_CONFIG).program, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(later.added, []);
    assert.equal(later.replaced, 7);
    assert.equal(definitionNames(later.program).length, 5);
  });

  test('the new definitions stand in a column to the right of everything, clear of each other', () => {
    for (const program of [tricky(), getSampleProgram('smart-bucket')!.program, FULL_MISSION_SAMPLE.program]) {
      const change = addGripperMyBlocks(program, DEFAULT_ROBOT_CONFIG);
      const added = tops(change.program).slice(0, change.added.length);
      const kept = tops(change.program).slice(change.added.length);
      const rightEdge = Math.max(...kept.map((b) => (b.x ?? 0) + estimateStackWidth(b, change.program.variables)));
      for (const def of added) assert.ok(def.x! >= rightEdge + 40, `${String(def.fields?.NAME)} at x = ${def.x}, the stacks reach to ${rightEdge.toFixed(0)}`);
      assert.equal(new Set(added.map((b) => b.x)).size, 1, 'one column');
      assert.equal(added[0].y, Math.min(...kept.map((b) => b.y ?? 0)), 'starting level with the top of the program');
      // (a definition is about 200 pixels tall in the editor, 205 with the "*" block)
      for (let i = 1; i < added.length; i++) assert.ok(added[i].y! - added[i - 1].y! >= 230, 'room for a definition and a gap');
    }
  });
});

// =============================================================================================
// What the student already has is never broken
// =============================================================================================

describe('My Blocks and variables of the student', () => {
  test('a My Block of the same name that is something else is left alone; the new one gets a number', () => {
    const program = B.program([
      B.define('gripper opens', [], [B.playTone(440, 0.1), B.print('my own block')]),
      B.script(B.whenStart(), [B.gripper('close'), B.call('gripper opens'), B.withId(B.gripper('open'), 'real-open')]),
    ]);
    const mine = copy(definition(program, 'gripper opens'));
    const { change, original, converted, convertedEvents } = playBoth(program);

    assert.deepEqual(change.added, ['gripper opens 2', 'gripper closes']);
    assert.deepEqual(change.myBlocks, { 'claw-open': 'gripper opens 2', 'claw-close': 'gripper closes' });
    assert.deepEqual(definition(change.program, 'gripper opens'), mine, 'the student\'s My Block is untouched');
    const calls = allBlocks(change.program).filter((b) => b.type === 'procedures_callnoreturn').map(calledName);
    assert.deepEqual(calls, ['gripper closes', 'gripper opens', 'gripper opens 2'], 'the student\'s call still runs the student\'s block');
    assert.equal(calledName(allBlocks(change.program).find((b) => b.id === 'real-open')!), 'gripper opens 2');
    // both blocks did their own thing: the tone was played and the claw is open again
    assert.equal(convertedEvents.filter((e) => e.type === 'tone').length, 1);
    assert.deepEqual(converted.world.robot.screen.lines, ['my own block']);
    assertSameGripper(converted, original);
    assert.equal(converted.world.robot.servos.S2.angle, 0);

    // doing it again finds "gripper opens 2" and adds nothing
    const again = addGripperMyBlocks(change.program, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(again.added, ['arm raises', 'arm lowers', 'arm moves to height']);
    assert.equal(again.myBlocks['claw-open'], 'gripper opens 2');
  });

  test('a My Block of the same name with other inputs, or one that gives back a value, is left alone', () => {
    const program = B.program([
      B.define('arm moves to height', ['height', 'speed'], [B.setServo('S1', B.v('height')), B.wait(B.v('speed'))]),
      B.defineReturn('arm raises', [], [B.setServo('S1', 90)], 1),
      B.script(B.whenStart(), [B.armHeight(50), B.arm('raise'), B.call('arm moves to height', 20, 0.3), B.print(B.callReturn('arm raises'))]),
    ]);
    const before = copy(program);
    const { change, original, converted } = playBoth(program);
    assert.deepEqual(change.added, ['arm raises 2', 'arm moves to height 2']);
    assert.deepEqual(definition(change.program, 'arm moves to height'), definition(before, 'arm moves to height'));
    assert.deepEqual(definition(change.program, 'arm raises'), definition(before, 'arm raises'));
    assert.deepEqual(definition(change.program, 'arm moves to height 2').extraState, { params: [{ name: 'height', id: (change.program.variables ?? []).find((v) => v.name === 'height')!.id }] });
    assertSameGripper(converted, original);
    assert.deepEqual(converted.world.robot.screen.lines, ['1']);
  });

  test('a My Block the student built or tuned (same name, same inputs, moves the same servo) is used as it is', () => {
    const program = B.program([
      // tuned: a smaller angle and a longer wait than the simulator would write
      B.define('gripper closes', [], [B.setServo('S2', 55), B.wait(1), B.print('closed')]),
      // built by hand, with another name for the input
      B.define('Arm Moves To Height', ['percent'], [B.setServo('S1', B.mul(B.v('percent'), 0.9)), B.wait(0.5)]),
      B.script(B.whenStart(), [B.gripper('close'), B.withId(B.armHeight(40), 'to-40'), B.arm('lower')]),
    ]);
    const before = copy(program);
    const change = convertGripperBlocks(program, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(change.added, ['arm lowers'], 'only the one that was missing');
    assert.deepEqual(change.myBlocks, { 'claw-close': 'gripper closes', 'arm-height': 'Arm Moves To Height', 'arm-lower': 'arm lowers' });
    assert.deepEqual(definition(change.program, 'gripper closes'), definition(before, 'gripper closes'));
    assert.deepEqual(definition(change.program, 'Arm Moves To Height'), definition(before, 'Arm Moves To Height'));
    // the call names the block and its input as the student wrote them
    assert.deepEqual(allBlocks(change.program).find((b) => b.id === 'to-40')!.extraState, { name: 'Arm Moves To Height', params: ['percent'] });

    const sim = simulate(change.program);
    const events = runToEnd(sim);
    assert.deepEqual(problems(events), []);
    assert.equal(sim.world.robot.servos.S2.angle, 55, 'the student\'s angle');
    assert.deepEqual(sim.world.robot.screen.lines, ['closed']);
    assert.ok(sim.world.time > 1.9, 'the student\'s wait');
  });

  test('a My Block that holds a Gripper block or calls another My Block is never taken for the original (it could call itself)', () => {
    const program = B.program([
      // the student wrapped the Gripper block in a My Block of the same name
      B.define('gripper opens', [], [B.setServo('S2', 0), B.gripper('open')]),
      B.define('gripper closes', [], [B.setServo('S2', 60), B.call('helper')]),
      B.define('helper', [], [B.gripper('close')]),
      B.script(B.whenStart(), [B.gripper('close'), B.call('gripper opens'), B.call('gripper closes'), B.gripper('open')]),
    ]);
    const { change, original, converted } = playBoth(program);
    assert.deepEqual(change.added, ['gripper opens 2', 'gripper closes 2']);
    // inside the student's blocks the Gripper blocks now call the new My Blocks, not the block they are in
    assert.equal(calledName(definition(change.program, 'gripper opens').inputs!.STACK.block!.next!.block!), 'gripper opens 2');
    assert.equal(calledName(definition(change.program, 'helper').inputs!.STACK.block!), 'gripper closes 2');
    assertSameGripper(converted, original);
    assert.equal(converted.world.robot.servos.S2.angle, 0);
  });

  test('a switched-off My Block keeps its name; a My Block for another servo is not the original', () => {
    const program = B.program([
      B.define('gripper opens', [], [B.setServo('S2', 0), B.wait(0.4)]),
      B.define('gripper closes', [], [B.setServo('S3', 60), B.wait(0.4)]),
      B.script(B.whenStart(), [B.gripper('close'), B.gripper('open')]),
    ]);
    definition(program, 'gripper opens').enabled = false;
    const { change, original, converted } = playBoth(program);
    assert.deepEqual(change.added, ['gripper opens 2', 'gripper closes 2']);
    assertSameGripper(converted, original);
  });

  test('a variable called "height" is shared, as Blockly does, and keeps its value', () => {
    const program = start([B.setVar('height', 70), B.armHeight(30), B.print(B.v('height')), B.armHeight(B.v('height'))]);
    const mine = copy(program.variables);
    const { change, original, converted } = playBoth(program);
    assert.deepEqual(change.program.variables, mine, 'no second variable called "height"');
    assert.deepEqual(definition(change.program, 'arm moves to height').extraState, { params: [{ name: 'height', id: mine![0].id }] });
    assert.deepEqual(converted.world.robot.screen.lines, ['70'], 'the student\'s variable still holds 70 after the My Block ran with 30');
    assert.ok(Math.abs(converted.world.robot.servos.S1.angle - 63) < 1e-9);
    assertSameGripper(converted, original);
    assert.deepEqual(converted.vm.variables(), original.vm.variables());
  });

  test('a variable "Height" with a capital, a list called "height" and a My Block input called "height"', () => {
    // Blockly keeps one variable per name, capitals not counted: the input must use the one that is there
    const capital = start([B.setVar('Height', 20), B.armHeight(B.v('Height'))]);
    const change = convertGripperBlocks(capital, DEFAULT_ROBOT_CONFIG);
    assert.equal(change.program.variables?.length, 1);
    assert.deepEqual(definition(change.program, 'arm moves to height').extraState, { params: [{ name: 'Height', id: capital.variables![0].id }] });
    assert.deepEqual(allBlocks(change.program).find((b) => b.type === 'procedures_callnoreturn')!.extraState, { name: 'arm moves to height', params: ['Height'] });
    assert.equal(playBoth(capital).converted.world.robot.servos.S1.angle, 18);

    // a list is another kind of variable: it keeps its name, the input gets a variable of its own
    const withList = start([B.addToList('height', 5), B.armHeight(B.itemOfList('height', 1))]);
    const listChange = convertGripperBlocks(withList, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(listChange.program.variables, [...withList.variables!, { name: 'height', id: 'mblock-height' }]);
    assert.equal(playBoth(withList).converted.world.robot.servos.S1.angle, 4.5);

    // the student's own My Block with an input called "height" goes on working next to the new one
    const ownInput = B.program([
      B.define('lift', ['height'], [B.setServo('S3', B.v('height'))]),
      B.script(B.whenStart(), [B.call('lift', 33), B.armHeight(50)]),
    ]);
    const { change: own, converted } = playBoth(ownInput);
    assert.equal(own.program.variables?.length, 1);
    assert.equal(converted.world.robot.servos.S3.angle, 33);
    assert.equal(converted.world.robot.servos.S1.angle, 45);
  });

  test('ids that are taken are not used a second time', () => {
    const program = start([B.withId(B.gripper('close'), 'mblock-claw-close'), B.withId(B.wait(0.1), 'mblock-claw-close-servo'), B.withId(B.armHeight(20), 'mblock-arm-height')]);
    program.variables = [{ name: 'speed', id: 'mblock-height' }];
    const change = convertGripperBlocks(program, DEFAULT_ROBOT_CONFIG);
    const ids = allBlocks(change.program).map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, 'every block has its own id');
    const variableIds = (change.program.variables ?? []).map((v) => v.id);
    assert.deepEqual(variableIds, ['mblock-height', 'mblock-height-2']);
    assert.equal(playBoth(program).converted.world.robot.servos.S1.angle, 18);
  });
});

// =============================================================================================
// The palette
// =============================================================================================

describe('the Gripper category of the palette', () => {
  const gripper = TOOLBOX.contents.find((c) => c.toolboxitemid === 'gripper')!;

  test('starts with two short lines and the button, then the three blocks', () => {
    assert.deepEqual(gripper.contents!.map((item) => item.kind), ['label', 'sep', 'label', 'button', 'block', 'block', 'block']);
    const words = gripper.contents!.flatMap((item) => (item.kind === 'label' ? [item.text] : []));
    assert.match(words.join(' '), /shortcuts/i);
    assert.match(words.join(' '), /mBlock does not have/);
    for (const line of words) assert.ok(line.length <= 40, `"${line}" fits the width of the palette`);
    const button = gripper.contents!.find((item) => item.kind === 'button');
    assert.deepEqual(button, { kind: 'button', text: 'See the real mBlock code', callbackkey: GRIPPER_CODE_CALLBACK });
    assert.equal(SEE_MBLOCK_CODE, 'See the real mBlock code');
  });

  test('no other category got words or buttons', () => {
    for (const category of TOOLBOX.contents) {
      if (category === gripper) continue;
      assert.ok((category.contents ?? []).every((item) => item.kind === 'block' || item.kind === 'sep'), category.name);
    }
  });

  test('the tooltip of every Gripper block says that mBlock does not have it', () => {
    for (const type of ['gripper_claw', 'gripper_arm', 'gripper_arm_height']) {
      const tooltip = getBlockDef(type)!.tooltip;
      assert.match(tooltip, /shortcut that mBlock does not have/, type);
      assert.match(tooltip, /right-click/, type);
    }
    assert.doesNotMatch(getBlockDef('mbot2_servo_set')!.tooltip, /shortcut/);
  });
});

// =============================================================================================
// In the real block editor
// =============================================================================================

/** Give Node the few browser globals Blockly needs (jsdom comes along with Blockly), then load Blockly. */
async function loadBlocklyWithDom(): Promise<BlocklyApi | null> {
  let JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> };
  try {
    ({ JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: typeof JSDOM });
  } catch {
    return null; // no jsdom on this machine: the tests are skipped
  }
  const dom = new JSDOM('<!DOCTYPE html><div id="editor" style="width: 900px; height: 600px"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'DOMParser', 'XMLSerializer',
    'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']; // prettier-ignore
  // jsdom has no canvas; Blockly only uses it to measure how wide a text is
  const canvas = dom.window.HTMLCanvasElement as { prototype: { getContext: unknown } };
  canvas.prototype.getContext = () => ({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) });
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return (await import('blockly')) as unknown as BlocklyApi;
}

/** Blockly hands its events out a moment later; Undo only knows them after that. */
const eventsDelivered = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));

describe('in the block editor', () => {
  test('the rewritten examples load as they are, stack clear of stack, and play the same match when saved again', async (t) => {
    const Blockly = await loadBlocklyWithDom();
    if (!Blockly) return t.skip('jsdom is not installed');
    const workspace = createEditor(Blockly, 'editor', { sounds: false });
    const programs: Array<[string, ProgramJson]> = [
      ...[...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE].map((s): [string, ProgramJson] => [s.id, convertGripperBlocks(s.program, DEFAULT_ROBOT_CONFIG).program]),
      ['tricky', convertGripperBlocks(tricky(), DEFAULT_ROBOT_CONFIG).program],
      ['all five on a blank workspace', addGripperMyBlocks({ blocks: { blocks: [{ type: 'event_cyberpi_start', id: 'start-hat', x: 40, y: 40 }] } }, DEFAULT_ROBOT_CONFIG).program],
    ];
    for (const [name, program] of programs) {
      workspace.clear();
      Blockly.serialization.workspaces.load(program as never, workspace);
      await eventsDelivered();

      // Blockly took the program as written: it added no definition of its own and renamed nothing
      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      const listing = (p: ProgramJson): string[] => allBlocks(p).map((b) => `${b.id}:${b.type}`).sort();
      assert.deepEqual(listing(saved), listing(program), name);
      assert.deepEqual(definitionNames(saved).sort(), definitionNames(program).sort(), name);
      const variable = (p: ProgramJson): string[] => (p.variables ?? []).map((v) => `${v.id}:${v.name}:${v.type ?? ''}`).sort();
      assert.deepEqual(variable(saved), variable(program), name);
      for (const block of workspace.getAllBlocks(false)) {
        assert.ok(supportsBlock(block.type), `${name}: ${block.type}`);
        assert.ok(block.isEnabled() || block.id === 'switched-off', `${name}: Blockly switched "${block.type}" off`);
      }

      // no stack lies on top of another
      const stacks = workspace.getTopBlocks(false).map((block) => ({ type: block.type, box: block.getBoundingRectangle() }));
      for (let i = 0; i < stacks.length; i++) {
        for (let j = i + 1; j < stacks.length; j++) {
          const a = stacks[i].box;
          const b = stacks[j].box;
          assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${name}: ${stacks[i].type} and ${stacks[j].type} overlap`);
        }
      }

      const opts = { game: fireRescueGame, scenario: defaultScenario(), robotConfig: DEFAULT_ROBOT_CONFIG };
      assert.deepEqual(runMatch({ ...opts, program: saved }), runMatch({ ...opts, program }), name);
    }
    workspace.dispose();
  });

  test('one Undo takes the rewriting back, one Redo brings it again', async (t) => {
    const Blockly = await loadBlocklyWithDom();
    if (!Blockly) return t.skip('jsdom is not installed');
    const workspace = createEditor(Blockly, 'editor', { sounds: false });
    const listing = (): string[] => workspace.getAllBlocks(false).map((b) => `${b.id}:${b.type}`).sort();
    /** what the editor does for "load a program" (BlocklyEditor.tsx): one group of events = one step of Undo */
    const load = (program: ProgramJson): void => {
      Blockly.Events.setGroup(true);
      try {
        Blockly.serialization.workspaces.load(program as never, workspace, { recordUndo: true });
      } finally {
        Blockly.Events.setGroup(false);
      }
    };

    Blockly.serialization.workspaces.load(getSampleProgram('gripper-demo')!.program as never, workspace, { recordUndo: false });
    await eventsDelivered();
    workspace.clearUndo();
    const before = listing();
    const variablesBefore = workspace.getVariableMap().getAllVariables().length;

    for (const changeProgram of [convertGripperBlocks, addGripperMyBlocks]) {
      const change = changeProgram(Blockly.serialization.workspaces.save(workspace) as ProgramJson, DEFAULT_ROBOT_CONFIG);
      load(change.program);
      await eventsDelivered();
      const after = listing();
      assert.notDeepEqual(after, before);
      assert.equal(after.filter((entry) => entry.endsWith(':procedures_defnoreturn')).length, change.added.length);
      assert.equal(Blockly.Procedures.allProcedures(workspace)[0].length, change.added.length, 'they are listed under My Blocks');

      workspace.undo(false);
      await eventsDelivered();
      assert.deepEqual(listing(), before, 'one Undo: the blocks are as they were');
      assert.equal(workspace.getVariableMap().getAllVariables().length, variablesBefore);
      assert.equal(workspace.getUndoStack().length, 0, 'nothing else is left to undo');

      workspace.undo(true);
      await eventsDelivered();
      assert.deepEqual(listing(), after, 'one Redo: the change is back');
      workspace.undo(false);
      await eventsDelivered();
      assert.deepEqual(listing(), before);
      workspace.clearUndo();
    }
    workspace.dispose();
  });
});
