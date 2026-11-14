/**
 * Helpers shared by the tests that drive the engine WITHOUT the block interpreter.
 *
 * A tiny fake VM runs a "script" (a generator function) that talks to the engine through
 * RobotIO, one step per simulation tick, exactly like a student program would. `yield` means
 * "wait for the next tick". (Only tests import this file.)
 */
import assert from 'node:assert/strict';
import type { VMFactory } from './engine';
import type { RobotIO } from './io';
import { wheelDegreesForDistance, wheelDegreesForTurn } from './robot';
import type { Body, VM } from './types';

export type Script = (io: RobotIO) => Generator<void, void, void>;

export interface Harness {
  factory: VMFactory;
  /** the RobotIO the engine handed to the VM */
  io(): RobotIO;
  /** how often the program was started (1 + number of restarts) */
  starts(): number;
}

/** A fake VM that runs one script; it is idle once the script has ended. */
export function scripted(script: Script): Harness {
  let io: RobotIO | null = null;
  let starts = 0;
  const factory: VMFactory = (_program, robotIO) => {
    io = robotIO;
    let run: Generator<void, void, void> | null = null;
    const vm: VM = {
      start() {
        starts++;
        run = script(robotIO);
      },
      step() {
        if (run && run.next().done) run = null;
      },
      stopAll() {
        run = null;
      },
      get running() {
        return run !== null;
      },
      get idle() {
        return run === null;
      },
      activeBlockIds: () => [],
      variables: () => ({}),
      errors: () => [],
    };
    return vm;
  };
  return {
    factory,
    io: () => {
      assert.ok(io, 'the VM was created');
      return io;
    },
    starts: () => starts,
  };
}

// ---- building blocks for scripts

export function* waitUntil(condition: () => boolean): Generator<void, void, void> {
  while (!condition()) yield;
}

export function* sleep(ticks: number): Generator<void, void, void> {
  for (let i = 0; i < ticks; i++) yield;
}

export function* forever(): Generator<void, void, void> {
  for (;;) yield;
}

/** Drive straight by `mm` (negative = backwards) using the wheel encoders. */
export function* drive(io: RobotIO, mm: number, rpm = 60): Generator<void, void, void> {
  const deg = wheelDegreesForDistance(io.config, mm);
  io.startMotion(deg, deg, rpm);
  yield* waitUntil(() => io.motionDone());
}

/** Turn on the spot by `degrees` (clockwise positive). */
export function* turn(io: RobotIO, degrees: number, rpm = 40): Generator<void, void, void> {
  const deg = wheelDegreesForTurn(io.config, degrees);
  io.startMotion(deg, -deg, rpm);
  yield* waitUntil(() => io.motionDone());
}

// ---- small things for assertions

export const near = (actual: number, expected: number, eps: number, what = 'value'): void =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: ${actual} is not within ${eps} of ${expected}`);

/** A box-shaped game element with sensible defaults. */
export function makeBody(part: Partial<Body> & Pick<Body, 'id' | 'x' | 'y' | 'w' | 'l' | 'h'>): Body {
  const z = part.z ?? 0;
  const restingOn = part.restingOn ?? null;
  return {
    kind: 'thing',
    label: part.id,
    fill: '#888',
    angle: 0,
    z,
    restingOn,
    held: false,
    grippable: false,
    platform: false,
    mass: 1,
    home: { x: part.x, y: part.y, angle: part.angle ?? 0, z, restingOn },
    ...part,
  };
}
