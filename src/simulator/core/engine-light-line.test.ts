/**
 * The Quad RGB sensor taught to see a LIGHT line (RobotConfig.quadRgb.lightLine): white lines on
 * a black mat. The real sensor learns which of the two is the line (put on the background, its
 * button pressed twice, swept over line and background); the simulator's robot has it as a
 * setting. Without the setting nothing changes: the dark-line tests are in ./engine.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { lineOffsetOf, lineStatusOf, makeProbeReading } from './engine-sensors';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { forever, scripted } from './test-helpers';
import type { Game, MatVector, ProbeReading, RGB, RobotConfig } from './types';

const BLACK: RGB = { r: 35, g: 31, b: 32 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

test('a light line: "on the line" means brighter than the threshold', () => {
  const white = makeProbeReading(WHITE, 70, true);
  const black = makeProbeReading(BLACK, 70, true);
  assert.equal(white.onLine, true);
  assert.equal(black.onLine, false);
  // brightness, grey level and colour do not depend on which one is the line
  assert.deepEqual({ ...white, onLine: false }, { ...makeProbeReading(WHITE, 70), onLine: false });
  assert.equal(black.color, 'black');
  assert.equal(white.color, 'white');
  // exactly on the threshold is background, as for a dark line
  const grey = { r: 178.5, g: 178.5, b: 178.5 }; // brightness 70
  assert.equal(makeProbeReading(grey, 70, true).onLine, false);
  assert.equal(makeProbeReading(grey, 70).onLine, false);
  // the default is still a dark line
  assert.equal(makeProbeReading(BLACK, 35).onLine, true);
});

/** Readings with brightness `light` (a grey of that brightness). */
function readingsOf(lights: number[], threshold: number, lightLine: boolean): ProbeReading[] {
  return lights.map((light) => {
    const v = light * 2.55;
    return makeProbeReading({ r: v, g: v, b: v }, threshold, lightLine);
  });
}

test('a light line gives the same line status and deviation as the mirror-image dark line', () => {
  const offsets = DEFAULT_ROBOT_CONFIG.quadRgb.probeOffsets;
  const patterns = [
    [100, 10, 10, 100],
    [10, 100, 100, 10],
    [100, 100, 10, 10],
    [10, 10, 10, 100],
    [55, 80, 95, 20],
    [100, 100, 100, 100],
    [10, 10, 10, 10],
    [72, 64, 31, 99],
  ];
  for (const lights of patterns) {
    // a light line at threshold T on the mat  ==  a dark line at 100 - T on the mirror image
    const light = readingsOf(lights, 70, true);
    const dark = readingsOf(
      lights.map((l) => 100 - l),
      30,
      false,
    );
    assert.equal(lineStatusOf(light), lineStatusOf(dark), `status ${lights}`);
    const a = lineOffsetOf(light, offsets, 70, true);
    const b = lineOffsetOf(dark, offsets, 30);
    assert.ok(Math.abs(a - b) < 1e-9, `deviation ${lights}: ${a} vs ${b}`);
  }
  // white under the left probes only: the sensor is to the RIGHT of the line, as for a dark line
  assert.equal(lineOffsetOf(readingsOf([100, 10, 10, 10], 70, true), offsets, 70, true), 100);
  assert.equal(lineOffsetOf(readingsOf([10, 10, 10, 100], 70, true), offsets, 70, true), -100);
  assert.ok(Object.is(lineOffsetOf(readingsOf([10, 100, 100, 10], 70, true), offsets, 70, true), 0), 'centred: 0, not -0');
  // a threshold of 100 or more: nothing can be brighter, no line anywhere
  assert.equal(lineOffsetOf(readingsOf([100, 10, 10, 10], 100, true), offsets, 100, true), 0);
});

test('the engine reads a white line on a black mat with a robot whose sensor learned it', () => {
  // a black mat with one white line, 26 mm wide, running up the middle (x = 200)
  const mat: MatVector = {
    width: 400,
    height: 400,
    background: BLACK,
    outside: { r: 120, g: 120, b: 120 },
    layers: [{ kind: 'rect', rect: { x: 187, y: 0, w: 26, h: 400 }, color: WHITE }],
  };
  const game: Game<null> = {
    id: 'light-line-test',
    title: 'light line',
    mat: { width: 400, height: 400, imageUrl: '', sensorImageUrl: '', vector: mat },
    matchDuration: 10,
    startZone: { x: 0, y: 0, w: 400, h: 400 },
    defaultStartPose: { x: 200, y: 300, heading: 0 },
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '-',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: () => [],
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
  const learned: RobotConfig = {
    ...DEFAULT_ROBOT_CONFIG,
    quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb, lightLine: true, lineThreshold: 70 },
  };
  const read = (config: RobotConfig, x: number) => {
    const h = scripted(forever);
    createEngineSimulation({ game, scenario: null, program: {}, robotConfig: config, startPose: { x, y: 300, heading: 0 } }, h.factory);
    return h.io();
  };
  const centred = read(learned, 200);
  assert.equal(centred.lineStatus(), 0b0110, 'the two middle probes are on the white line');
  assert.equal(centred.probe('L1').onLine, true);
  assert.equal(centred.probe('L2').onLine, false);
  assert.equal(centred.lineOffset(), 0);
  // robot 10 mm left of the line -> the line is under its right probes -> negative, as on the real mBot2
  const left = read(learned, 190);
  assert.equal(left.lineStatus(), 0b0011);
  assert.ok(left.lineOffset() < -30, `offset ${left.lineOffset()}`);
  assert.ok(read(learned, 210).lineOffset() > 30);
  // the same robot without the learned setting sees the black mat as the line
  const untaught = read(DEFAULT_ROBOT_CONFIG, 200);
  assert.equal(untaught.lineStatus(), 0b1001);
});
