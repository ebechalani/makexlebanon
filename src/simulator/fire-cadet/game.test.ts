/**
 * Fire Cadet: the referee (game.ts, design 6, with lead decisions D1 and D5 for the obstacles).
 *
 * First the score sheet and every sentence, word for word, on fields set up by hand (a referee is a
 * plain object: it only reads what it is shown). Then every case of design 6.3 in the engine, with
 * the measured numbers, and the obstacle cases of D1 and D5: a head-on hit, a hit with a stick, an
 * item pushed against an obstacle - the robot finishes its row on the squares, the obstacle is back
 * on its spot, and the first touch of each obstacle costs a point, whether the robot or an item it
 * pushes touched it, -3 at most; the rows that push items through the obstacles of practice maps 4,
 * 5 and 8 no longer score 25.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RESTORE_CLEARANCE } from '../core/engine';
import { obbTouches, type OBB } from '../core/geometry';
import { robotShapesAt } from '../core/robot';
import type { Body, Pose, ScoreContext, ScoreLine, World } from '../core/types';
import { cardRowProgram, cardsFromText, panelProgram } from './cards';
import { createSimulation } from '../core/simulation';
import { REFEREE_WORDS, createBodies, createReferee, fireCadetGame, itemId, obstacleId, obstaclesTouched } from './game';
import { FIRE_CADET, spot, squareRect } from './numbers';
import { playFireCadet } from './play';
import { MTINY_ROBOT, START_POSE } from './robot';
import { OBSTACLE_KINDS, OBSTACLE_WORDS, PRACTICE_MAPS, type FireCadetScenario, type ItemName } from './scenario';
import { parkedMap, sq, watchMatch, withSizes, type WatchedMatch } from './test-helpers';

const program = (text: string) => cardRowProgram(cardsFromText(text));
const lineOf = (lines: readonly ScoreLine[], id: string): ScoreLine => lines.find((l) => l.id === id) as ScoreLine;
const points = (lines: readonly ScoreLine[]): Record<string, number> => Object.fromEntries(lines.map((l) => [l.id, l.points]));
const LATTICE = spot({ col: 0, row: 0 }).x;
const offLattice = (v: number): number => {
  const k = Math.round((v - LATTICE) / FIRE_CADET.GRID_PITCH);
  return Math.abs(v - (LATTICE + FIRE_CADET.GRID_PITCH * k));
};
const onASquare = ([x, y]: readonly number[]): boolean => offLattice(x) < 0.001 && offLattice(y) < 0.001;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const at = (name: string, heading = 0): Pose => ({ ...spot(sq(name)), heading });

// =============================================================================================
// The words, and the score sheet on fields set up by hand
// =============================================================================================

/** A field the referee can look at: the elements of the map, moved as `moves` says, and the robot at `pose`. */
class Field {
  bodies: Body[];
  time = 0;
  tick = 0;
  pose: Pose = { ...START_POSE };
  wheels: [number, number] = [0, 0];
  shapes: OBB[] | null = null;
  constructor(readonly scenario: FireCadetScenario) {
    this.bodies = createBodies(scenario);
  }
  body(id: string): Body {
    return this.bodies.find((b) => b.id === id) as Body;
  }
  put(id: string, x: number, y: number): this {
    const b = this.body(id);
    b.x = x;
    b.y = y;
    return this;
  }
  remove(ids: readonly string[] | undefined): void {
    if (ids) this.bodies = this.bodies.filter((b) => !ids.includes(b.id));
  }
  ctx(): ScoreContext<FireCadetScenario> {
    const world = {
      time: this.time,
      tick: this.tick,
      bodies: this.bodies,
      robot: { pose: this.pose, left: { angleDeg: this.wheels[0] }, right: { angleDeg: this.wheels[1] } },
    } as unknown as World;
    return { scenario: this.scenario, world, robotConfig: MTINY_ROBOT, restarts: 0, robotShapes: this.shapes ?? robotShapesAt(MTINY_ROBOT, this.pose) };
  }
  /** one tick later */
  later(seconds: number = FIRE_CADET.SIM_DT): this {
    this.time += seconds;
    this.tick += Math.round(seconds / FIRE_CADET.SIM_DT);
    return this;
  }
}

/** The referee of a field, begun, and a look at one tick that also applies what it asks to remove. */
function referee(field: Field) {
  const ref = createReferee(field.scenario);
  ref.begin?.(field.ctx());
  const look = () => {
    const call = ref.observe(field.ctx());
    field.remove(call?.removeBodies);
    return call;
  };
  return { ref, look, sheet: () => ref.score(field.ctx()) };
}

test('the labels of the score sheet (design 6.2)', () => {
  const sheet = createReferee(PRACTICE_MAPS[0]).score(new Field(PRACTICE_MAPS[0]).ctx());
  assert.deepEqual(
    sheet.lines.map((l) => [l.id, l.label, l.max]),
    [
      ['water', 'Water to the Fire', 5],
      ['cat', 'Cat to the Safe Zone', 5],
      ['person', 'Injured Person to the Hospital', 5],
      ['equipment', 'Equipment to the Fire Station', 5],
      ['return', 'Robot back in the Fire Station', 5],
      ['obstacles', 'Obstacles touched', 0],
    ],
  );
  assert.equal(sheet.max, 25);
});

test('a sheet before anything happened: what to do, line by line', () => {
  for (const [s, fire] of [
    [PRACTICE_MAPS[0], 'the School'],
    [PRACTICE_MAPS[1], 'the Bakery'],
    [PRACTICE_MAPS[2], 'the House'],
    [PRACTICE_MAPS[4], 'the Factory'],
  ] as const) {
    const sheet = createReferee(s).score(new Field(s).ctx());
    assert.deepEqual(
      sheet.lines.map((l) => l.detail),
      [
        `Push the Water into the square with the Fire: ${fire}.`,
        'Push the Cat into the Safe Zone.',
        'Push the Injured Person into the Hospital.',
        'Push the Equipment into the Fire Station at the bottom.',
        'The robot has not left the Fire Station yet. Here the bonus needs it to leave first.',
        'No obstacle touched.',
      ],
    );
    assert.equal(sheet.total, 0);
    assert.equal(sheet.complete, false);
    assert.equal(sheet.time, undefined);
    assert.equal(sheet.now, undefined);
    assert.deepEqual(obstaclesTouched(sheet), []);
    // the game's own score() is this sheet
    assert.deepEqual(fireCadetGame.score(new Field(s).ctx()), sheet);
  }
});

test('a delivery: 5 points at the first moment the base is inside, the item leaves the field, the sentence for 3 s', () => {
  const s = PRACTICE_MAPS[0]; // the Fire at the School
  const cases: [ItemName, string, string, string][] = [
    ['water', 'A1', 'The Water reached the Fire. 5 points.', 'The Water reached the Fire at the School.'],
    ['cat', 'D4', 'The Cat is in the Safe Zone. 5 points.', 'The Cat reached the Safe Zone.'],
    ['person', 'A5', 'The Injured Person is in the Hospital. 5 points.', 'The Injured Person reached the Hospital.'],
    ['equipment', 'D7', 'The Equipment is back in the Fire Station. 5 points.', 'The Equipment is back in the Fire Station.'],
  ];
  for (const [item, target, said, detail] of cases) {
    const field = new Field(s);
    field.pose = at('G7'); // the robot away from everything
    const { look, sheet } = referee(field);
    field.later(1.5);
    const p = spot(sq(target));
    field.put(itemId(item), p.x, p.y);
    const call = look();
    assert.deepEqual(call?.say, [said]);
    assert.deepEqual(call?.removeBodies, [itemId(item)]);
    assert.equal(REFEREE_WORDS.delivered[item], said);
    const line = lineOf(sheet().lines, item);
    assert.deepEqual([line.points, line.ok, line.detail, line.time], [5, true, detail, 1.5]);
    assert.equal(sheet().now, said);
    // 3 s later the sentence has had its time; the points stay
    field.later(FIRE_CADET.MESSAGE_SECONDS - FIRE_CADET.SIM_DT);
    assert.equal(sheet().now, said);
    field.later(FIRE_CADET.SIM_DT);
    assert.equal(sheet().now, undefined);
    assert.equal(lineOf(sheet().lines, item).points, 5);
  }
});

test('an item only partly inside its target counts nothing yet (A6: the WHOLE base)', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  field.pose = at('G7');
  const { look, sheet } = referee(field);
  const d4 = squareRect(sq('D4'));
  // the Cat's base 1 mm over the bottom line of the Safe Zone
  field.later().put(itemId('cat'), d4.x + d4.w / 2, d4.y + d4.h - FIRE_CADET.ITEM_BASE / 2 + 1);
  assert.equal(look(), null);
  assert.equal(lineOf(sheet().lines, 'cat').points, 0);
  field.later().put(itemId('cat'), d4.x + d4.w / 2, d4.y + d4.h - FIRE_CADET.ITEM_BASE / 2);
  assert.deepEqual(look()?.say, ['The Cat is in the Safe Zone. 5 points.']);
});

test('N24: an item at rest in a marked place that is not its own - said once, no points, and on the sheet', () => {
  const s = PRACTICE_MAPS[0]; // the Fire at the School
  const cases: [ItemName, string, string][] = [
    ['water', 'A5', 'The Water is in the Hospital. It belongs to the Fire at the School.'],
    ['cat', 'A5', 'The Cat is in the Hospital. It belongs in the Safe Zone.'],
    ['person', 'D4', 'The Injured Person is in the Safe Zone. It belongs in the Hospital.'],
    ['equipment', 'D1', 'The Equipment is in the top Fire Station. It belongs in the Fire Station at the bottom.'],
    ['cat', 'D7', 'The Cat is in the Fire Station. It belongs in the Safe Zone.'],
    ['water', 'G3', 'The Water is in the House. It belongs to the Fire at the School.'],
  ];
  for (const [item, place, sentence] of cases) {
    const field = new Field(s);
    field.pose = at('G7');
    const { look, sheet } = referee(field);
    const p = spot(sq(place));
    // moving through it: not said (the item moved in this tick)
    field.later().put(itemId(item), p.x, p.y + 1);
    field.wheels = [10, 10];
    assert.equal(look(), null);
    field.later().put(itemId(item), p.x, p.y);
    field.wheels = [20, 20];
    assert.equal(look(), null, 'it moved in this tick');
    // the item did not move, but the wheels turned: not at rest
    field.later();
    field.wheels = [30, 30];
    assert.equal(look(), null, 'the wheels turned in this tick');
    // at rest: said once
    field.later();
    assert.deepEqual(look()?.say, [sentence], `${item} in ${place}`);
    assert.equal(REFEREE_WORDS.wrongPlace(item, place === 'A5' ? 'hospital' : place === 'D4' ? 'safeZone' : place === 'D1' ? 'stationTop' : place === 'D7' ? 'station' : 'house', 'the School'), sentence);
    const line = lineOf(sheet().lines, item);
    assert.deepEqual([line.points, line.detail], [0, sentence]);
    field.later();
    assert.equal(look(), null, 'said once for this item and place');
    // pushed out again: the sheet says what to do once more
    field.later().put(itemId(item), p.x + (p.x < 600 ? 100 : -100), p.y);
    field.wheels = [40, 40];
    look();
    assert.doesNotMatch(lineOf(sheet().lines, item).detail, /belongs/);
  }
});

test('N24: an item that starts on a marked place and is never moved is not in a wrong place', () => {
  // an own setup with the Cat on the House, the Injured Person on the top Fire Station
  const s: FireCadetScenario = { ...PRACTICE_MAPS[0], cat: sq('G3'), person: sq('D1') };
  const field = new Field(s);
  field.pose = at('G7');
  const { ref, look, sheet } = referee(field);
  for (let k = 0; k < 5; k++) {
    field.later();
    assert.equal(look(), null);
  }
  ref.finished?.(field.ctx(), 'time');
  assert.equal(lineOf(sheet().lines, 'cat').detail, 'Push the Cat into the Safe Zone.');
  assert.equal(lineOf(sheet().lines, 'person').detail, 'Push the Injured Person into the Hospital.');
});

test('an item partly off the map is in no target: "off the map", and where it belongs', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  field.pose = at('G7');
  const { look, sheet } = referee(field);
  field.later().put(itemId('cat'), 13.764, 802.764).put(itemId('water'), 90.764, -5).put(itemId('person'), 1250, 600).put(itemId('equipment'), 600, 1240);
  look();
  assert.deepEqual(
    sheet().lines.slice(0, 4).map((l) => l.detail),
    [
      'The Water is off the map. It belongs to the Fire at the School.',
      'The Cat is off the map. It belongs in the Safe Zone.',
      'The Injured Person is off the map. It belongs in the Hospital.',
      'The Equipment is off the map. It belongs in the Fire Station at the bottom.',
    ],
  );
});

test('the return bonus: the four states of the line', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  const { ref, look, sheet } = referee(field);
  field.later();
  look();
  assert.equal(lineOf(sheet().lines, 'return').detail, 'The robot has not left the Fire Station yet. Here the bonus needs it to leave first.');
  // the robot's back still touches D7: it has not left yet
  field.pose = { ...at('D6'), y: at('D6').y + 40 };
  field.later();
  look();
  assert.equal(lineOf(sheet().lines, 'return').detail, 'The robot has not left the Fire Station yet. Here the bonus needs it to leave first.');
  field.pose = at('D5');
  field.later();
  look();
  assert.deepEqual([lineOf(sheet().lines, 'return').points, lineOf(sheet().lines, 'return').detail], [0, 'The robot is not in the Fire Station.']);
  field.pose = { ...at('D7'), y: at('D7').y - 40 };
  field.later();
  look();
  assert.deepEqual([lineOf(sheet().lines, 'return').points, lineOf(sheet().lines, 'return').detail], [0, 'A part of the robot is outside the Fire Station.']);
  field.pose = at('D7', Math.PI);
  field.later();
  look();
  // home during the match: not yet - the bonus is looked at once, when the match ends (A8), and the
  // robot may still drive out again, so it is not shown as earned nor added to the live total
  assert.deepEqual([lineOf(sheet().lines, 'return').points, lineOf(sheet().lines, 'return').ok, lineOf(sheet().lines, 'return').detail], [
    0,
    false,
    'The robot is in the Fire Station now. The bonus counts when the match ends.',
  ]);
  assert.equal(sheet().total, 0);
  // at the end it is judged once and for all
  ref.finished?.(field.ctx(), 'program-ended');
  assert.deepEqual([lineOf(sheet().lines, 'return').points, lineOf(sheet().lines, 'return').detail], [5, 'The whole robot is inside the Fire Station.']);
  field.pose = at('D5');
  assert.equal(lineOf(sheet().lines, 'return').points, 5);
  assert.equal(sheet().time, field.time);
});

test('the return bonus is never shown during the match: Forward, Backward, Forward - the live total stays 0 (it went 0, 5, 0 before)', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: program('F B F') });
  sim.start();
  const totals = new Set<number>();
  let homeNow = false;
  while (sim.status === 'running') {
    sim.step(1);
    const live = sim.score();
    totals.add(live.total);
    if (lineOf(live.lines, 'return').detail === REFEREE_WORDS.homeNow) homeNow = true;
  }
  assert.deepEqual([...totals], [0]);
  assert.ok(homeNow, 'while it stood in D7 the line said it is home now');
  assert.equal(lineOf(sim.score().lines, 'return').points, 0);
  // Forward, Backward: home when the row ends - 5 at the end, and only then
  assert.equal(playFireCadet(program('F B'), parkedMap()).total, 5);
});

test('the obstacles (D1): -1 for each obstacle the robot touched, once; the words of the sheet; the total never below 0', () => {
  const s = PRACTICE_MAPS[0]; // Road Closed E3, Fallen Tree F5, Broken Vehicle F7
  const field = new Field(s);
  field.pose = at('A3');
  const { look, sheet } = referee(field);
  const touch = (name: string): void => {
    // a part of the robot right on the obstacle's spot
    const p = spot(sq(name));
    field.shapes = [{ x: p.x, y: p.y + FIRE_CADET.OBSTACLE_BASE / 2 + 10, w: 20, l: 20, angle: 0 }];
  };
  touch('F5');
  field.later();
  let call = look();
  assert.deepEqual(call?.say, ['The robot touched the Fallen Tree: -1. The referee puts it back.']);
  assert.deepEqual(call?.removeBodies, [obstacleId('fallen-tree')]);
  assert.deepEqual(call?.restoreBodies, [obstacleId('fallen-tree')], 'asked back at once: the engine puts it back when its spot is free');
  assert.deepEqual([lineOf(sheet().lines, 'obstacles').points, lineOf(sheet().lines, 'obstacles').detail], [-1, 'Touched: the Fallen Tree.']);
  assert.deepEqual(obstaclesTouched(sheet()), ['fallen-tree']);
  // while it is off the field, the referee asks for it at every tick
  field.shapes = null;
  field.later();
  call = look();
  assert.deepEqual(call, { restoreBodies: [obstacleId('fallen-tree')] });
  // back on the field (the engine put it there): no more asking
  field.bodies.push(createBodies(s).find((b) => b.id === obstacleId('fallen-tree')) as Body);
  field.later();
  assert.equal(look(), null);
  // touched again: no point more
  touch('F5');
  field.later(FIRE_CADET.MESSAGE_SECONDS);
  call = look();
  assert.deepEqual(call?.say, ['The robot touched the Fallen Tree again. The referee puts it back.']);
  assert.equal(lineOf(sheet().lines, 'obstacles').points, -1);
  field.bodies.push(createBodies(s).find((b) => b.id === obstacleId('fallen-tree')) as Body);
  touch('E3');
  field.later();
  look();
  touch('F7');
  field.later();
  look();
  assert.deepEqual([lineOf(sheet().lines, 'obstacles').points, lineOf(sheet().lines, 'obstacles').detail], [
    -3,
    'Touched: the Road Closed sign, the Fallen Tree and the Broken Vehicle.',
  ]);
  assert.deepEqual(obstaclesTouched(sheet()), [...OBSTACLE_KINDS]);
  assert.equal(sheet().total, 0, 'never below 0 (A9)');
  assert.equal(REFEREE_WORDS.touched(['road-closed', 'broken-vehicle']), 'Touched: the Road Closed sign and the Broken Vehicle.');
});

test('the obstacles (D5): an item that touches one costs 1 point too; once for each obstacle, whoever touched it; -3 at most', () => {
  const s = PRACTICE_MAPS[0]; // Road Closed E3, Fallen Tree F5, Broken Vehicle F7
  const field = new Field(s);
  field.pose = at('A3');
  const { look, sheet } = referee(field);
  const sign = (): Body => createBodies(s).find((b) => b.id === obstacleId('road-closed')) as Body;
  /** an item pushed right against the obstacle on `name` (its base just meets the obstacle's base) */
  const against = (item: ItemName, name: string): void => {
    const p = spot(sq(name));
    field.put(itemId(item), p.x, p.y + FIRE_CADET.OBSTACLE_BASE / 2 + FIRE_CADET.ITEM_BASE / 2);
  };
  /** the item back on its own start spot, away from the obstacles */
  const park = (item: ItemName): void => void field.put(itemId(item), field.body(itemId(item)).home.x, field.body(itemId(item)).home.y);
  const signLine = (): [number, boolean, string] => {
    const line = lineOf(sheet().lines, 'obstacles');
    return [line.points, line.ok, line.detail ?? ''];
  };
  // the Cat against the Road Closed sign: -1, like the robot's own touch, and the referee lifts it
  against('cat', 'E3');
  field.later();
  let call = look();
  assert.deepEqual(call?.say, ['The Cat touched the Road Closed sign: -1. On the real map, go round it.']);
  assert.deepEqual(call?.removeBodies, [obstacleId('road-closed')]);
  assert.deepEqual(call?.restoreBodies, [obstacleId('road-closed')]);
  assert.deepEqual(signLine(), [-1, false, 'Touched: the Road Closed sign.']);
  assert.deepEqual(obstaclesTouched(sheet()), ['road-closed']);
  assert.equal(sheet().total, 0);
  // back on its spot; the Cat touches it again: no point more ("again")
  field.bodies.push(sign());
  field.later(FIRE_CADET.MESSAGE_SECONDS);
  call = look();
  assert.deepEqual(call?.say, ['The Cat touched the Road Closed sign again. On the real map, go round it.']);
  assert.deepEqual(signLine(), [-1, false, 'Touched: the Road Closed sign.']);
  // back again; the Cat goes away and the robot touches it: still -1 ("too": the Cat touched it first)
  park('cat');
  field.bodies.push(sign());
  field.shapes = [{ x: spot(sq('E3')).x, y: spot(sq('E3')).y + FIRE_CADET.OBSTACLE_BASE / 2 + 10, w: 20, l: 20, angle: 0 }];
  field.later(FIRE_CADET.MESSAGE_SECONDS);
  assert.deepEqual(look()?.say, ['The robot touched the Road Closed sign too. The referee puts it back.']);
  field.shapes = null;
  field.bodies.push(sign());
  field.later(FIRE_CADET.MESSAGE_SECONDS);
  // ... and the Water: still -1 ("too")
  against('water', 'E3');
  assert.deepEqual(look()?.say, ['The Water touched the Road Closed sign too. On the real map, go round it.']);
  assert.deepEqual(signLine(), [-1, false, 'Touched: the Road Closed sign.']);
  park('water');
  // the Injured Person against the Fallen Tree, the Equipment against the Broken Vehicle: -3 in all, the total stays 0
  against('person', 'F5');
  field.later(FIRE_CADET.MESSAGE_SECONDS);
  assert.deepEqual(look()?.say, ['The Injured Person touched the Fallen Tree: -1. On the real map, go round it.']);
  park('person');
  against('equipment', 'F7');
  field.later();
  assert.deepEqual(look()?.say, ['The Equipment touched the Broken Vehicle: -1. On the real map, go round it.']);
  assert.deepEqual(signLine(), [-3, false, 'Touched: the Road Closed sign, the Fallen Tree and the Broken Vehicle.']);
  assert.deepEqual(obstaclesTouched(sheet()), [...OBSTACLE_KINDS]);
  assert.equal(sheet().total, 0, 'never below 0 (A9)');
  // no sentence or line of the referee says that an item's touch is free
  for (const text of [REFEREE_WORDS.noObstacle, ...Object.values(REFEREE_WORDS).filter((v): v is string => typeof v === 'string')]) {
    assert.doesNotMatch(text, /no points? lost|costs nothing|not counted|An item touched/i, text);
  }
});

test('the obstacles (D1): one that moved with nothing touching it was turned by the sticks - the robot moved it', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  field.pose = at('A3');
  const { look, sheet } = referee(field);
  const b = field.body(obstacleId('broken-vehicle'));
  b.angle = 0.02;
  b.x += 2;
  field.later();
  assert.deepEqual(look()?.say, ['The robot touched the Broken Vehicle: -1. The referee puts it back.']);
  assert.equal(lineOf(sheet().lines, 'obstacles').points, -1);
});

test('"The robot left the map." once, when its turning point leaves the mat; it costs nothing', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  const { look, sheet } = referee(field);
  field.pose = { x: 624.764, y: -1, heading: 0 };
  field.later();
  assert.deepEqual(look()?.say, ['The robot left the map.']);
  field.pose = { x: 624.764, y: -13, heading: 0 };
  field.later();
  assert.equal(look(), null);
  assert.equal(sheet().total, 0);
  assert.equal(REFEREE_WORDS.leftMap, 'The robot left the map.');
});

test('the newest sentence is "now" for MESSAGE_SECONDS; after the end there is none, and the time of the end is on the sheet', () => {
  const s = PRACTICE_MAPS[0];
  const field = new Field(s);
  field.pose = at('G7');
  const { ref, look, sheet } = referee(field);
  field.later(2);
  field.put(itemId('cat'), spot(sq('D4')).x, spot(sq('D4')).y);
  look();
  field.later(1).put(itemId('person'), spot(sq('A5')).x, spot(sq('A5')).y);
  look();
  assert.equal(sheet().now, 'The Injured Person is in the Hospital. 5 points.', 'the newest one');
  field.later(1);
  ref.finished?.(field.ctx(), 'declared');
  assert.equal(sheet().now, undefined);
  assert.equal(sheet().time, 4);
  assert.equal(sheet().total, 10);
});

// =============================================================================================
// In the engine: the cases of design 6.3
// =============================================================================================

test('E3: an item counts 0.35 s into the card that drives it in (32.4 mm driven), leaves the field the next tick, and keeps its points and time', () => {
  const watched = watchMatch(program('F F F'), parkedMap({ cat: sq('D5') }));
  const sim = watched.sim;
  // the third card begins at 4.00 s (tick 400); the Cat counts at 4.34 s
  assert.deepEqual(watched.said, [[4.34, 'The Cat is in the Safe Zone. 5 points.']]);
  assert.deepEqual(watched.gone, [[4.34, itemId('cat')]]);
  const cat = lineOf(sim.score().lines, 'cat');
  assert.deepEqual([cat.points, r3(cat.time ?? 0)], [5, 4.34]);
  assert.equal(sim.world.bodies.some((b) => b.id === itemId('cat')), false);
  assert.equal(sim.score().total, 5, 'the robot stays in the Safe Zone: no return bonus');
  // where the robot was at that moment: 32.4 mm into the card
  const again = createSimulation({ game: fireCadetGame, scenario: parkedMap({ cat: sq('D5') }), program: program('F F F') });
  again.start();
  again.step(434);
  assert.ok(Math.abs(at('D5').y - again.world.robot.pose.y - 32.421) < 0.01, `${at('D5').y - again.world.robot.pose.y}`);
});

test('E4, N24 in the engine: the Cat pushed into the Hospital and left there - 0 points, said once when it came to rest, it stays', () => {
  // the robot starts 10 mm above the spot of A3, looking down, so that the Cat comes to rest
  // completely inside the Hospital (pushed along the squares, an item rests 8 mm over the far
  // line of the square ahead: it is 77 mm ahead of the robot and 40 mm wide)
  const start: Pose = { ...at('A3', Math.PI), y: at('A3').y - 10 };
  const watched = watchMatch(program('F2 L R'), parkedMap({ cat: sq('A4') }), { startPose: start });
  const sentence = 'The Cat is in the Hospital. It belongs in the Safe Zone.';
  assert.deepEqual(
    watched.said.filter(([, t]) => /belongs/.test(t)),
    [[3.58, sentence]],
    'said once: not again after the turn took it out and back',
  );
  const sheet = watched.sim.score();
  assert.deepEqual([lineOf(sheet.lines, 'cat').points, lineOf(sheet.lines, 'cat').detail], [0, sentence]);
  assert.ok(watched.sim.world.bodies.some((b) => b.id === itemId('cat')), 'it stays on the field');
});

test('E7: the Water in a building without the Fire is in a wrong place; in the square with the Fire it scores', () => {
  const start: Pose = { ...at('A3', Math.PI), y: at('A3').y - 10 };
  const wrong = watchMatch(program('F2'), parkedMap({ fire: 'school', water: sq('A4') }), { startPose: start });
  assert.equal(lineOf(wrong.sim.score().lines, 'water').detail, 'The Water is in the Hospital. It belongs to the Fire at the School.');
  assert.equal(wrong.sim.score().total, 0);
  // the Water on A2 pushed up from A3 into the School, where the Fire is
  const right = playFireCadet(program('F2'), parkedMap({ fire: 'school', water: sq('A2') }), { startPose: at('A3') });
  assert.equal(lineOf(right.lines, 'water').points, 5);
});

test('E5: an item pushed off the map is in no target, and nobody puts it back', () => {
  const result = watchMatch(program('F3'), parkedMap({ cat: sq('B5') }), { startPose: at('D5', -Math.PI / 2) });
  const cat = result.sim.world.bodies.find((b) => b.id === itemId('cat')) as Body;
  assert.equal(r3(cat.x), 13.764, 'its left edge 6.2 mm over the edge of the mat');
  assert.equal(lineOf(result.sim.score().lines, 'cat').detail, 'The Cat is off the map. It belongs in the Safe Zone.');
});

test('E6: the robot leaves the map, stops with the tips of its sticks 100 mm outside, "The robot left the map." once; no points lost', () => {
  const watched = watchMatch(program('F5 F2 B'), parkedMap());
  assert.deepEqual(watched.stops.slice(6, 7), [[624.764, -13, 0]]);
  assert.equal(r3(watched.stops[6][1] - FIRE_CADET.TURNING_POINT_TO_FRONT - FIRE_CADET.STICK_LENGTH), -FIRE_CADET.TABLE_MARGIN);
  assert.deepEqual(
    watched.said.filter(([, t]) => t === 'The robot left the map.').length,
    1,
  );
  assert.equal(watched.sim.score().total, 0);
  assert.ok(watched.sim.score().lines.every((l) => l.points === 0));
  // ... and the first card Backward: the robot backs off the map from the start (134.2 mm)
  const back = watchMatch(program('B'), parkedMap());
  assert.equal(r3(back.stops[0][1] - START_POSE.y), 134.236);
});

test('E8: the Equipment home - 10 points with the return bonus, the Equipment at 21.14 s, the match at 22.4 s', () => {
  const result = playFireCadet(program('L F R F3 R F R F3'), parkedMap({ equipment: sq('D5') }));
  assert.equal(result.total, 10);
  assert.ok(Math.abs(result.time - 22.4) < 1e-9);
  assert.deepEqual(points(result.lines), { water: 0, cat: 0, person: 0, equipment: 5, return: 5, obstacles: 0 });
  assert.equal(r3(lineOf(result.lines, 'equipment').time ?? 0), 21.14);
});

test('E9: the return bonus needs the robot to have left - R R: none; F B: 5 at 3.6 s; STOP 0.6 s before it is home: none', () => {
  assert.equal(playFireCadet(program('R R'), parkedMap()).total, 0);
  const fb = playFireCadet(program('F B'), parkedMap());
  assert.equal(fb.total, 5);
  assert.ok(Math.abs(fb.time - 3.6) < 1e-9);
  const stop = playFireCadet(program('L F R F3 R F R F3'), parkedMap({ equipment: sq('D5') }), { maxSeconds: 21.8 });
  assert.equal(stop.finishReason, 'declared');
  assert.deepEqual(points(stop.lines), { water: 0, cat: 0, person: 0, equipment: 5, return: 0, obstacles: 0 });
  assert.equal(lineOf(stop.lines, 'return').detail, 'A part of the robot is outside the Fire Station.');
});

test('E11: the maximum is 25 = 4 x 5 + 5 (practice map 1)', () => {
  const result = playFireCadet(program('F3 B L F3 L F R2 F5 B5 B R F3'), PRACTICE_MAPS[0]);
  assert.equal(result.total, FIRE_CADET.MAX_POINTS);
  assert.equal(result.max, 25);
  assert.ok(result.complete);
});

test('E12: a delivery on the tick of exactly 120.00 s still counts', () => {
  // Mini: three Forward taps bring the Cat into the Safe Zone; tapped so that the third move
  // delivers it on the very last tick of the match
  const run = (firstTapTick: number) => {
    const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap({ cat: sq('D5') }), program: panelProgram() });
    sim.start();
    const taps = [firstTapTick, firstTapTick + 50, firstTapTick + 250];
    while (sim.status === 'running') {
      if (taps.includes(sim.world.tick)) sim.setButton('up', true);
      if (taps.some((t) => sim.world.tick === t + 3)) sim.setButton('up', false);
      sim.step(1);
    }
    return sim;
  };
  const early = run(0);
  const offset = Math.round((lineOf(early.score().lines, 'cat').time ?? 0) / FIRE_CADET.SIM_DT);
  const late = run(12_000 - offset);
  const cat = lineOf(late.score().lines, 'cat');
  assert.equal(late.finishReason, 'time');
  assert.deepEqual([cat.points, cat.time], [5, FIRE_CADET.MATCH_SECONDS]);
  // one tick later it would have been too late
  const tooLate = run(12_001 - offset);
  assert.equal(lineOf(tooLate.score().lines, 'cat').points, 0);
});

test('E13: two items pushed at once are each judged on their own', () => {
  // the robot catches the Injured Person on D6 and pushes it into the Cat on D5: the Cat goes into
  // the Safe Zone (5 points), the Injured Person does not count there
  const watched = watchMatch(program('F2'), parkedMap({ person: sq('D6'), cat: sq('D5') }));
  assert.deepEqual(watched.said, [[3.43, 'The Cat is in the Safe Zone. 5 points.']]);
  assert.deepEqual(points(watched.sim.score().lines), { water: 0, cat: 5, person: 0, equipment: 0, return: 0, obstacles: 0 });
  // the Equipment pushed into the Injured Person: the Injured Person comes to rest in the Safe Zone
  const chain = watchMatch(program('F F F R F'), parkedMap({ equipment: sq('D6'), person: sq('D5') }));
  assert.deepEqual(chain.said, [[3.58, 'The Injured Person is in the Safe Zone. It belongs in the Hospital.']]);
  assert.equal(chain.sim.score().total, 0);
});

// =============================================================================================
// In the engine: the obstacles of lead decision D1
// =============================================================================================

const ROAD_CLOSED_ON = (name: string, part: Partial<FireCadetScenario> = {}): FireCadetScenario =>
  parkedMap({ obstacles: [sq(name), sq('C1'), sq('E1')], ...part });

test('D1, head-on: the robot hits the Road Closed sign on D5 (-1, 0.88 s into the second card), the referee lifts it, and the robot ends its row on the squares', () => {
  const map = ROAD_CLOSED_ON('D5');
  const f2 = watchMatch(program('F2'), map);
  assert.deepEqual(f2.said, [[2.88, 'The robot touched the Road Closed sign: -1. The referee puts it back.']]);
  assert.deepEqual(f2.gone, [[2.88, obstacleId('road-closed')]]);
  assert.deepEqual(f2.stops, [
    [624.764, 980.764, 0],
    [624.764, 802.764, 0],
  ]);
  // the robot stands on the spot of D5: the sign cannot go back yet
  assert.deepEqual(f2.back, []);
  assert.equal(f2.sim.world.bodies.some((b) => b.id === obstacleId('road-closed')), false);
  assert.equal(lineOf(f2.sim.score().lines, 'obstacles').points, -1);
  // one more square: once the robot has left its spot, the sign is back there, unturned
  const f3 = watchMatch(program('F3'), map);
  assert.deepEqual(f3.back, [[4.73, obstacleId('road-closed'), spot(sq('D5')).x, spot(sq('D5')).y, 0]]);
  assert.deepEqual(f3.stops[2], [624.764, 624.764, 0]);
  const sign = f3.sim.world.bodies.find((b) => b.id === obstacleId('road-closed')) as Body;
  assert.deepEqual([sign.x, sign.y, sign.angle, sign.z], [spot(sq('D5')).x, spot(sq('D5')).y, 0, 0]);
  // a hit costs 1 point, not the return bonus: F2 B2 scores 4
  const home = playFireCadet(program('F2 B2'), map);
  assert.deepEqual(points(home.lines), { water: 0, cat: 0, person: 0, equipment: 0, return: 5, obstacles: -1 });
  assert.equal(home.total, 4);
});

test('D1, the same sign hit twice: -1 once; the second time it is lifted again and the referee says "again"', () => {
  const watched = watchMatch(program('F3 B3'), ROAD_CLOSED_ON('D5'));
  assert.deepEqual(watched.said, [
    [2.88, 'The robot touched the Road Closed sign: -1. The referee puts it back.'],
    [6.88, 'The robot touched the Road Closed sign again. The referee puts it back.'],
  ]);
  assert.deepEqual(
    watched.back.map(([t]) => t),
    [4.73, 8.73],
  );
  assert.ok(watched.stops.every(onASquare), JSON.stringify(watched.stops));
  assert.equal(watched.sim.score().total, 4);
});

test('D1, with a stick: the robot 40 mm off its line hits the sign with its right stick (-1 at 2.64 s) and keeps to its own line', () => {
  const start: Pose = { ...START_POSE, x: START_POSE.x + 40 };
  const watched = watchMatch(program('F3 B3'), ROAD_CLOSED_ON('D5'), { startPose: start });
  assert.deepEqual(watched.said.filter(([, t]) => /touched/.test(t)), [
    [2.64, 'The robot touched the Road Closed sign: -1. The referee puts it back.'],
    [6.88, 'The robot touched the Road Closed sign again. The referee puts it back.'],
  ]);
  for (const [x, y] of watched.stops) {
    assert.equal(x, r3(start.x), 'never pushed aside');
    assert.ok(offLattice(y) < 0.001);
  }
  const sign = watched.sim.world.bodies.find((b) => b.id === obstacleId('road-closed')) as Body;
  assert.deepEqual([sign.x, sign.y, sign.angle], [spot(sq('D5')).x, spot(sq('D5')).y, 0]);
  assert.equal(lineOf(watched.sim.score().lines, 'obstacles').points, -1);
});

test('D5, an item pushed against an obstacle: -1; the obstacle is lifted, and back once the robot and the item have passed', () => {
  const map = ROAD_CLOSED_ON('D3', { equipment: sq('D5') });
  const f5 = watchMatch(program('F5'), map);
  assert.deepEqual(f5.said, [[6.57, 'The Equipment touched the Road Closed sign: -1. On the real map, go round it.']]);
  assert.deepEqual(f5.back, [[8.73, obstacleId('road-closed'), spot(sq('D3')).x, spot(sq('D3')).y, 0]]);
  assert.ok(f5.stops.every(onASquare));
  assert.equal(lineOf(f5.sim.score().lines, 'obstacles').points, -1);
  assert.deepEqual(obstaclesTouched(f5.sim.score()), ['road-closed']);
  // and home again: the return bonus, and the point for the sign: 4
  const home = playFireCadet(program('F4 B4'), map);
  assert.deepEqual(points(home.lines), { water: 0, cat: 0, person: 0, equipment: 0, return: 5, obstacles: -1 });
  assert.equal(home.total, 4);
  // a robot that pushes an item still passes through the square of the lifted obstacle (the robot
  // itself then never touches it: F4 ends on D3, the sign's square), but no longer for free
  const through = watchMatch(program('F4'), map);
  assert.deepEqual(through.stops[3], [624.764, 446.764, 0]);
  assert.deepEqual([lineOf(through.sim.score().lines, 'obstacles').points, lineOf(through.sim.score().lines, 'obstacles').ok], [-1, false]);
  assert.equal(lineOf(through.sim.score().lines, 'obstacles').detail, 'Touched: the Road Closed sign.');
});

test('D5, sticks longer than the item: a 40 mm obstacle stands between the sticks, so an item pushed into it is what touches it, and the referee names the item; only an obstacle 90 mm wide or more meets longer sticks first', () => {
  // the Injured Person on D6, the Road Closed sign on D3: F5 pushes the person head-on into the sign.
  // The sticks stay 30 mm; an item of 26 mm makes them 4 mm longer than the item, one of 30 mm as long
  const map = ROAD_CLOSED_ON('D3', { person: sq('D6') });
  const person = itemId('person');
  const sign = obstacleId('road-closed');
  const itemSaid = 'The Injured Person touched the Road Closed sign: -1. On the real map, go round it.';
  const robotSaid = 'The robot touched the Road Closed sign: -1. The referee puts it back.';
  const touches = (w: WatchedMatch): [number, string][] => w.said.filter(([, t]) => / touched /.test(t));
  const signBack = (w: WatchedMatch): boolean => w.back.some(([, id, x, y, a]) => id === sign && x === spot(sq('D3')).x && y === spot(sq('D3')).y && a === 0);
  /** F5 with these bases; and, until the sign is first lifted, how far the tips of the sticks got past its near side, and how near a stick then came to it sideways */
  const play = (sizes: Record<string, number>): { w: WatchedMatch; past: number; beside: number } => {
    let lifted = false;
    let past = -Infinity;
    let beside = Infinity;
    const w = watchMatch(program('F5'), map, {
      game: withSizes(sizes),
      onTick: (sim) => {
        const b = sim.world.bodies.find((x) => x.id === sign);
        if (b === undefined) lifted = true;
        if (b === undefined || lifted) return;
        const pose = sim.world.robot.pose;
        assert.equal(pose.heading, 0, 'straight up the map: the boxes below are lined up with the map');
        for (const stick of robotShapesAt(MTINY_ROBOT, pose).slice(1)) {
          const along = (stick.l + b.l) / 2 - Math.abs(stick.y - b.y);
          past = Math.max(past, along);
          if (along > 0) beside = Math.min(beside, Math.abs(stick.x - b.x) - (stick.w + b.w) / 2);
        }
      },
    });
    return { w, past: r3(past), beside: r3(beside) };
  };
  // the sign of 40 mm: whatever the length of the item, the item touches it, and the sticks pass
  // beside it, (90.5 - 40) / 2 = 25.25 mm away on each side
  assert.equal((FIRE_CADET.STICK_GAP - FIRE_CADET.OBSTACLE_BASE) / 2, 25.25);
  let tips26 = NaN;
  for (const [base, time, past, beside] of [
    [26, 6.68, 3.379, 25.25],
    [30, 6.64, -1.707, Infinity],
    [FIRE_CADET.ITEM_BASE, 6.57, -10.607, Infinity],
  ] as const) {
    const { w, past: p, beside: s } = play({ [person]: base });
    if (base === 26) tips26 = p;
    assert.deepEqual(touches(w), [[time, itemSaid]], `an item of ${base} mm`);
    assert.deepEqual([p, s], [past, beside], `an item of ${base} mm: the tips of the sticks past the near side of the sign, and how far beside it`);
    assert.equal(lineOf(w.sim.score().lines, 'obstacles').points, -1);
    assert.ok(signBack(w) && w.stops.every(onASquare));
  }
  // a sign wider than the gap between the sticks, less the touching distance (90.5 - 2 x 0.5 = 89.5
  // mm): the tips of sticks longer than the item meet it before the item does, and the referee says
  // so - the robot did touch it. The same -1 (D5)
  for (const [signBase, itemBase, time, said, past, beside] of [
    [89, 26, 6.48, itemSaid, 2.45, 0.75], // (the tips pass it 0.75 mm away: not touching)
    [90, 26, 6.45, robotSaid, -0.864, Infinity],
    [100, 26, 6.41, robotSaid, -0.95, Infinity],
    [100, FIRE_CADET.ITEM_BASE, 6.33, itemSaid, -11.121, Infinity],
  ] as const) {
    const { w, past: p, beside: s } = play({ [person]: itemBase, [sign]: signBase });
    assert.deepEqual(touches(w), [[time, said]], `a sign of ${signBase} mm, an item of ${itemBase} mm`);
    assert.deepEqual([p, s], [past, beside], `a sign of ${signBase} mm, an item of ${itemBase} mm: the tips of the sticks`);
    assert.equal(lineOf(w.sim.score().lines, 'obstacles').points, -1);
    assert.ok(w.stops.every(onASquare));
  }
  // the README says what was measured here - and no longer that longer sticks would touch the obstacle
  const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  for (const part of [
    `A ${FIRE_CADET.OBSTACLE_BASE} mm obstacle stands between the sticks (${FIRE_CADET.STICK_GAP} mm apart), ${(FIRE_CADET.STICK_GAP - FIRE_CADET.OBSTACLE_BASE) / 2} mm from each`,
    `items of 26 mm (the tips of the sticks get ${tips26.toFixed(1)} mm past the front of the obstacle, beside it) and 30 mm`,
    'Only an obstacle 90 mm wide or more is met by the tips of longer sticks before the item',
  ]) {
    assert.ok(readme.includes(part), part);
  }
  assert.doesNotMatch(readme, /would also be the sticks touching it|sticks shorter than an item/);
});

test('D5, the robot touches an obstacle and later pushes an item into it (and the other way round): -1 in all', () => {
  // the Road Closed sign on D5, the Equipment on C5: F2 B2 runs into the sign and back; L F R F2
  // catches the Equipment on C5, R F pushes it into the sign
  const map = ROAD_CLOSED_ON('D5', { equipment: sq('C5') });
  const robotFirst = watchMatch(program('F2 B2 L F R F2 R F'), map);
  assert.deepEqual(robotFirst.said, [
    [2.88, 'The robot touched the Road Closed sign: -1. The referee puts it back.'],
    [19.67, 'The Equipment touched the Road Closed sign too. On the real map, go round it.'],
  ]);
  assert.deepEqual(robotFirst.gone, [[2.88, obstacleId('road-closed')], [19.67, obstacleId('road-closed')]]);
  assert.equal(lineOf(robotFirst.sim.score().lines, 'obstacles').points, -1);
  // the Equipment first, then the robot (it backs away from the Equipment and drives in again)
  const itemFirst = watchMatch(program('L F R F2 R F B F'), map);
  assert.deepEqual(itemFirst.said, [
    [11.67, 'The Equipment touched the Road Closed sign: -1. On the real map, go round it.'],
    [15.98, 'The robot touched the Road Closed sign too. The referee puts it back.'],
  ]);
  assert.equal(lineOf(itemFirst.sim.score().lines, 'obstacles').points, -1);
  assert.ok(robotFirst.stops.every(onASquare) && itemFirst.stops.every(onASquare));
});

test('D5 and the blocked road: the rows that push items through the obstacles of practice maps 4, 5 and 8 score less than 25; the proof rows, which go round, still score 25', () => {
  // the reviewers' rows: the shortest rows of these maps with the obstacles taken away (the solver
  // on the map without them), played on the real map. Under D1 they scored 25, sooner than the
  // proof rows (80.0 s, 86.3 s and 101.1 s), because an item's touch cost nothing
  const shortcuts = [
    { map: 4, row: 'L F3 R F5 F R F2 R F4 R F2 R F2 R F3 R F R B L F3 R F', seconds: 74.3, total: 22, touched: ['fallen-tree', 'road-closed', 'broken-vehicle'] },
    { map: 5, row: 'L B R F3 L F L B R F3 L F4 L F5 F L F5 F B L F3 L F5', seconds: 84.6, total: 24, touched: ['road-closed'] },
    { map: 8, row: 'L B3 R F3 L F3 B R F L F4 L F3 L F5 F L F5 B L F3 L F5', seconds: 92.6, total: 22, touched: ['broken-vehicle', 'fallen-tree', 'road-closed'] },
  ] as const;
  for (const { map, row, seconds, total, touched } of shortcuts) {
    const watched = watchMatch(program(row), PRACTICE_MAPS[map - 1]);
    const sheet = watched.sim.score();
    assert.equal(sheet.total, total, `P${map}`);
    assert.ok(sheet.total < 25, `P${map}`);
    assert.ok(Math.abs((sheet.time ?? 0) - seconds) < 1e-9, `P${map}: ${sheet.time}`);
    // every item delivered and the robot home: only the obstacles cost the points
    assert.ok(sheet.lines.every((line) => line.id === 'obstacles' || line.ok), `P${map}`);
    assert.equal(lineOf(sheet.lines, 'obstacles').points, -touched.length, `P${map}`);
    // the obstacles in the order they were first touched, each by an item, each said once with its -1
    const minus = watched.said.filter(([, text]) => /: -1\./.test(text)).map(([, text]) => text);
    assert.equal(minus.length, touched.length, minus.join(' | '));
    minus.forEach((text, k) => {
      assert.match(text, new RegExp(`^The (Water|Cat|Injured Person|Equipment) touched ${OBSTACLE_WORDS[touched[k]]}: -1\\. On the real map, go round it\\.$`), text);
    });
    for (const [, text] of watched.said) assert.doesNotMatch(text, /no points? lost/i, text);
  }
  // the proof rows of the same maps go round: nothing is touched, all 25 points (practice.test.ts proves all eight)
  for (const [map, row] of [
    [4, 'L F3 R F5 F B2 R F L F R F2 R F2 B R F3 L F3 L F4 L2 F L F'],
    [5, 'L B R F3 L F R F L F3 L F4 L F5 F L F5 F L F L F5 F R F2'],
    [8, 'F R F3 R2 F R F2 L F2 B R F L2 F R F4 L F2 L F L F5 R F5 B R F5 F R F2'],
  ] as const) {
    const proof = watchMatch(program(row), PRACTICE_MAPS[map - 1]);
    assert.equal(proof.sim.score().total, 25, `P${map}`);
    assert.deepEqual([lineOf(proof.sim.score().lines, 'obstacles').ok, lineOf(proof.sim.score().lines, 'obstacles').detail], [true, REFEREE_WORDS.noObstacle]);
    assert.deepEqual(obstaclesTouched(proof.sim.score()), []);
  }
});

test('D1, all three obstacles in a column: -3 at most, and the total stays at 0', () => {
  const watched = watchMatch(program('F4'), parkedMap({ obstacles: [sq('D6'), sq('D5'), sq('D4')] }));
  assert.deepEqual(
    watched.said.map(([, t]) => t),
    [
      'The robot touched the Road Closed sign: -1. The referee puts it back.',
      'The robot touched the Fallen Tree: -1. The referee puts it back.',
      'The robot touched the Broken Vehicle: -1. The referee puts it back.',
    ],
  );
  const sheet = watched.sim.score();
  assert.equal(lineOf(sheet.lines, 'obstacles').points, -3);
  assert.equal(sheet.total, 0);
  // all three are back on their spots behind the robot
  assert.deepEqual(watched.back.map(([, id]) => id), [obstacleId('road-closed'), obstacleId('fallen-tree'), obstacleId('broken-vehicle')]);
});

test('D1, an obstacle the sticks turn along without touching it counts as the robot\'s touch', () => {
  // the robot stands (off the squares) with the sign between its sticks, 3 mm from its body, and turns
  const start: Pose = { x: spot(sq('D3')).x, y: spot(sq('D3')).y + 80, heading: 0 };
  const watched = watchMatch(program('R'), ROAD_CLOSED_ON('D3'), { startPose: start });
  assert.deepEqual(watched.said.filter(([, t]) => /touched/.test(t)), [[0.01, 'The robot touched the Road Closed sign: -1. The referee puts it back.']]);
  const sign = watched.sim.world.bodies.find((b) => b.id === obstacleId('road-closed')) as Body;
  assert.deepEqual([sign.x, sign.y, sign.angle], [spot(sq('D3')).x, spot(sq('D3')).y, 0], 'back on its spot, unturned');
});

test('D1, an item left on an obstacle\'s spot keeps it off the field: it goes back only when its spot is free', () => {
  // the robot starts 101 mm above the spot of D7, so that the Equipment ends exactly on the spot of D3
  const start: Pose = { ...START_POSE, y: START_POSE.y - 101 };
  const watched = watchMatch(program('F3 B'), ROAD_CLOSED_ON('D3', { equipment: sq('D5') }), { startPose: start });
  assert.deepEqual(watched.gone, [[5.17, obstacleId('road-closed')]]);
  assert.deepEqual(watched.back, []);
  const equipment = watched.sim.world.bodies.find((b) => b.id === itemId('equipment')) as Body;
  assert.deepEqual([r3(equipment.x), r3(equipment.y)], [624.764, 446.764]);
  // (the Equipment touched the sign: -1, D5)
  assert.equal(lineOf(watched.sim.score().lines, 'obstacles').points, -1);
});

test('D1 on 240 random rows on the eight practice maps: at most -3, never below 0, the robot on the squares unless it or an item met the edge of the table, and every obstacle that is off the field at the end has something on its spot', () => {
  let seed = 2027;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const moves = ['forward', 'forward', 'forward', 'backward', 'left', 'right'] as const;
  let hits = 0;
  let itemHits = 0;
  let edgeRows = 0;
  for (let k = 0; k < 240; k++) {
    const map = PRACTICE_MAPS[k % 8];
    const cards: string[] = [];
    const n = 3 + Math.floor(rnd() * 25);
    for (let i = 0; i < n; i++) {
      cards.push(moves[Math.floor(rnd() * moves.length)]);
      if (rnd() < 0.25) cards.push(`x${2 + Math.floor(rnd() * 4)}`);
    }
    const watched = watchMatch({ cards }, map);
    const sheet = watched.sim.score();
    const penalty = lineOf(sheet.lines, 'obstacles').points;
    assert.ok(penalty <= 0 && penalty >= -3);
    assert.ok(sheet.total >= 0);
    // once for each obstacle, whoever touched it (D5): one "-1" sentence for each obstacle on the sheet
    assert.equal(penalty + obstaclesTouched(sheet).length, 0, `row ${k}`);
    assert.equal(watched.said.filter(([, t]) => /: -1\./.test(t)).length, obstaclesTouched(sheet).length, `row ${k}`);
    const plus = sheet.lines.filter((line) => line.id !== 'obstacles').reduce((sum, line) => sum + line.points, 0);
    assert.equal(sheet.total, Math.max(0, plus + penalty), `row ${k}`);
    if (penalty < 0) hits++;
    if (watched.said.some(([, t]) => /^The (Water|Cat|Injured Person|Equipment) touched/.test(t))) itemHits++;
    if (watched.tableEdge) edgeRows++;
    else assert.ok(watched.stops.every(onASquare), `row ${k}: ${JSON.stringify(watched.stops)}`);
    // an obstacle on the field stands on its spot, unturned; one off the field has something near its spot
    const world = watched.sim.world;
    const shapes = watched.sim.robotShapes();
    for (const [i, kind] of OBSTACLE_KINDS.entries()) {
      const home = spot(map.obstacles[i]);
      const b = world.bodies.find((x) => x.id === obstacleId(kind));
      if (b) {
        assert.deepEqual([b.x, b.y, b.angle], [home.x, home.y, 0], `row ${k}: ${kind}`);
        continue;
      }
      const base: OBB = { x: home.x, y: home.y, w: FIRE_CADET.OBSTACLE_BASE, l: FIRE_CADET.OBSTACLE_BASE, angle: 0 };
      const blocked =
        shapes.some((s) => obbTouches(base, s, RESTORE_CLEARANCE + 0.01)) ||
        world.bodies.some((o) => obbTouches(base, { x: o.x, y: o.y, w: o.w, l: o.l, angle: o.angle }, RESTORE_CLEARANCE + 0.01));
      assert.ok(blocked, `row ${k}: ${kind} is off the field with nothing on its spot`);
    }
  }
  // (the rows do hit things: the test would mean little otherwise)
  assert.ok(hits > 50, `${hits} rows touched an obstacle`);
  assert.ok(itemHits > 3, `${itemHits} rows pushed an item against an obstacle`);
  assert.ok(edgeRows < 240, 'some rows never meet the edge of the table');
});
