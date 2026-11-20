/**
 * The whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Fire Fighter referee
 *
 * A program of real blocks takes all five cubes to their towers for 100 points: first the yellow
 * cube to X, coming down from the top through X's opening (once the robot has taken the yellow
 * cube, X is its next delivery), then the two red cubes of the left bay to E and M, and the two of
 * the right bay to A and K. At every tower it lets the cube go 1 cm before the tower, backs off
 * 5.5 cm, closes its empty claw and pushes the cube in (a my-block). The program drives by distance
 * only; its numbers come from ./field.ts. It is played through createSimulation (the screen's way:
 * the real interpreter), through the headless helper (./play.ts), and on the sensor picture the
 * browser reads.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RasterMatSampler } from '../core/mat';
import { createSimulation } from '../core/simulation';
import type { MatSampler, ProgramJson, Simulation } from '../core/types';
import { call, define, gripper, moveCm, program, script, turn, whenStart, type BlockNode } from '../vm/builder';
import { MAT_SENSOR_IMAGE_URL, MAT_SIZE, MAT_VECTOR, SQUARE_MIDDLES, TOWER_IDS, type TowerId } from './field';
import { CUBE_IDS, MAX_SCORE, fireFighterGame, towerLineId, towerShift } from './game';
import { playFireFighter } from './play';
import { RULES_SETUP, type FireFighterScenario } from './scenario';

/** Let go 1 cm before the tower, back off 5.5 cm, close the empty claw, push the cube 5.5 cm in, back off. */
const SLIDE_IN = 'slide the cube in';
const slideIn = (): BlockNode => call(SLIDE_IN);
const slideInDefinition = define(SLIDE_IN, [], [
  gripper('open'),
  moveCm('backward', 5.5),
  gripper('close'),
  moveCm('forward', 6),
  moveCm('backward', 6),
  gripper('open'),
]);

/** Take a red cube from a bay square: drive the claw around it, close, back out. */
const take = (cm: number): BlockNode[] => [moveCm('forward', cm), gripper('close'), moveCm('backward', cm)];

/** The whole mission by distance (every move worked out from field.ts: e.g. 18.93 cm = the yellow cube's middle - the start - 14.2 cm). */
const WHOLE_MISSION: ProgramJson = program([
  slideInDefinition,
  script(whenStart(), [
    // the yellow cube, around the hydrant picture, down into X from the top
    moveCm('forward', 18.93),
    gripper('close'),
    turn('left', 90),
    moveCm('forward', 15.38),
    turn('right', 90),
    moveCm('forward', 66.96),
    turn('right', 90),
    moveCm('forward', 15.38),
    turn('right', 90),
    moveCm('forward', 12.73),
    slideIn(),
    // the upper red cube of the left bay to E
    turn('right', 90),
    moveCm('forward', 25.32),
    turn('left', 90),
    moveCm('forward', 20.14),
    turn('right', 90),
    ...take(17.44),
    turn('right', 90),
    moveCm('forward', 20.96),
    turn('left', 90),
    moveCm('forward', 25.08),
    turn('right', 90),
    moveCm('forward', 2.89),
    slideIn(),
    // the lower red cube of the left bay to M
    turn('right', 90),
    moveCm('forward', 25.08),
    turn('right', 90),
    moveCm('forward', 30.7),
    turn('right', 90),
    ...take(17.43),
    turn('left', 90),
    moveCm('forward', 18.82),
    turn('right', 90),
    moveCm('forward', 25.23),
    turn('left', 90),
    moveCm('forward', 3.25),
    slideIn(),
    // the lower red cube of the right bay to A
    turn('left', 90),
    moveCm('forward', 75.7),
    turn('left', 90),
    moveCm('forward', 16.98),
    turn('right', 90),
    ...take(14.81),
    turn('right', 90),
    moveCm('forward', 19.13),
    turn('left', 90),
    moveCm('forward', 21.94),
    turn('right', 90),
    moveCm('forward', 3.36),
    slideIn(),
    // the upper red cube of the right bay to K
    turn('right', 90),
    moveCm('forward', 21.94),
    turn('right', 90),
    moveCm('forward', 30.17),
    turn('right', 90),
    ...take(14.82),
    turn('left', 90),
    moveCm('forward', 19.7),
    turn('right', 90),
    moveCm('forward', 21.73),
    turn('left', 90),
    moveCm('forward', 2.9),
    slideIn(),
  ]),
]);

/** When each tower's cube was delivered (s), and when the program ends - as the design measured them (8.3). */
const DELIVERED: Record<TowerId, number> = { X: 11.67, E: 25.33, M: 39.52, A: 55.43, K: 68.91 };
const ENDS = 69.65;

/** Play the program to its end on the screen's engine; what the referee said, and whether anything was bumped. */
function run(sampler?: MatSampler): { sim: Simulation<FireFighterScenario>; said: string[]; bumped: string[] } {
  const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: WHOLE_MISSION, ...(sampler ? { sampler } : {}) });
  sim.start();
  const said: string[] = [];
  const bumped: string[] = [];
  while (sim.status === 'running') {
    sim.step(100);
    for (const e of sim.drainEvents()) {
      if (e.type === 'log' && e.level === 'info') said.push(e.text);
      if (e.type === 'bump') bumped.push(`${e.bodyId} at ${e.time}`);
    }
  }
  return { sim, said, bumped };
}

function assertMission(sim: Simulation<FireFighterScenario>, said: string[], bumped: string[], what: string): void {
  assert.deepEqual(sim.vm.errors(), [], what);
  assert.equal(sim.finishReason, 'program-ended', what);
  assert.ok(Math.abs(sim.world.time - ENDS) < 0.05, `${what}: ends at ${sim.world.time}`);
  const report = sim.score();
  assert.equal(report.total, MAX_SCORE, what);
  assert.equal(report.complete, true, what);
  for (const t of TOWER_IDS) {
    const line = report.lines.find((l) => l.id === towerLineId(t));
    assert.ok(line && line.points === 20, `${what}: ${t}`);
    assert.ok(Math.abs((line.time ?? 0) - DELIVERED[t]) < 0.05, `${what}: ${t} delivered at ${line.time}`);
    // no tower moved, by even 0.01 mm
    const shift = towerShift(t, sim.world.bodies);
    assert.ok(Math.hypot(shift.x, shift.y) < 0.01, `${what}: tower ${t} moved (${shift.x}, ${shift.y})`);
    // every letter shows on its flap
    assert.equal(sim.world.props?.find((p) => p.id === `letter:${t}`)?.label, t, `${what}: flap ${t}`);
  }
  // every cube ends within 0.1 mm of the middle of its tower's square
  const towerOf: Record<string, TowerId> = { 'cube:yellow': 'X', 'cube:red-left-upper': 'E', 'cube:red-left-lower': 'M', 'cube:red-right-lower': 'A', 'cube:red-right-upper': 'K' };
  for (const id of CUBE_IDS) {
    const cube = sim.world.bodies.find((b) => b.id === id);
    assert.ok(cube, id);
    const middle = SQUARE_MIDDLES[towerOf[id]];
    assert.ok(Math.hypot(cube.x - middle.x, cube.y - middle.y) < 0.1, `${what}: ${id} at ${cube.x - middle.x}, ${cube.y - middle.y}`);
    // (square to the mat: a cube that was carried round a corner is turned by a quarter turn, which is the same square)
    assert.ok(Math.abs(Math.sin(2 * cube.angle)) < 1e-9, `${what}: ${id} turned by ${(cube.angle * 180) / Math.PI} degrees`);
  }
  // the referee's words, in order: the yellow cube taken, then each delivery
  assert.deepEqual(
    said,
    [
      'The robot took the yellow cube. Now tower X must be its next delivery.',
      'The yellow cube is under tower X: the letter X shows.',
      'A red cube is under tower E: the letter E shows.',
      'A red cube is under tower M: the letter M shows.',
      'A red cube is under tower A: the letter A shows.',
      'A red cube is under tower K: the letter K shows.',
    ],
    what,
  );
  // the robot never pushed a tower (it bumps only the cubes it takes)
  assert.ok(!bumped.some((b) => b.startsWith('tower:')), `${what}: ${bumped.join(', ')}`);
}

test('real blocks, the interpreter, the engine and the referee: all five letters, M A K E X, 100 points, nothing pushed', () => {
  const { sim, said, bumped } = run();
  assertMission(sim, said, bumped, 'on the vector mat');
});

test('the same match through the headless helper: 100, the same times', () => {
  const result = playFireFighter(WHOLE_MISSION);
  assert.equal(result.total, 100);
  assert.equal(result.complete, true);
  assert.equal(result.finishReason, 'program-ended');
  assert.equal(result.scenarioCode, 'MAKEX');
  for (const t of TOWER_IDS) assert.ok(Math.abs((result.lines.find((l) => l.id === towerLineId(t))?.time ?? 0) - DELIVERED[t]) < 0.05, t);
  // cut short after 50 s (as if the team said "Finished"): X, E and M are delivered, A and K not yet
  const short = playFireFighter(WHOLE_MISSION, { maxSeconds: 50 });
  assert.equal(short.total, 60);
  assert.equal(short.finishReason, 'declared');
});

/** The sensor picture of the mat, decoded with sharp (it comes with Next.js); null where it is missing. */
async function loadMatPicture(): Promise<MatSampler | null> {
  interface Decoded {
    data: Uint8Array;
    info: { width: number; height: number };
  }
  type Sharp = (file: string) => {
    ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<Decoded> } };
  };
  try {
    const sharp = createRequire(import.meta.url)('sharp') as Sharp;
    const file = fileURLToPath(new URL(`../../../public${MAT_SENSOR_IMAGE_URL}`, import.meta.url));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

test('on the sensor picture the browser reads: the same 100 points at the same times (the program does not look at the floor)', async (t) => {
  const picture = await loadMatPicture();
  if (!picture) return t.skip('the mat picture could not be decoded (sharp is not installed)');
  const { sim, said, bumped } = run(picture);
  assertMission(sim, said, bumped, 'on the picture');
});
