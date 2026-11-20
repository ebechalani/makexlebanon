/**
 * Every word of the Fire Cadet screen (./words.ts, design 7.15 with lead decision D1), and that
 * the screen never says more than the game really does:
 *   - the table of 7.15, word for word (the banner's table is banner.test.ts's, the Rules window
 *     rules.test.ts's), every number in it from FIRE_CADET or the game's own lists;
 *   - the words of the game are the game's: the refusals of the row are ROW_PROBLEM_WORDS of
 *     ../../fire-cadet/cards.ts, and no sentence of the referee (../../fire-cadet/game.ts) is
 *     copied into a file of the screen - the banner shows ScoreReport.now as it is;
 *   - the score strip's words come from the referee's own score sheet, on real matches: its
 *     pictures stand for the sheet's line ids, a touched obstacle is the referee's obstacle;
 *   - the field in words (design 7.13), for known states of real matches: at the start, with the
 *     Cat between the sticks, after a delivery (the referee took the Cat off the map), with an
 *     obstacle the referee has lifted (D1: it is not on the map until it is back), off the map.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createSimulation } from '../../core/simulation';
import type { Simulation } from '../../core/types';
import { CARD_NAMES, MOVE_CARDS, NUMBER_CARDS, ROW_PROBLEM_WORDS, cardRowProgram, cardsFromText, type RowProblem } from '../../fire-cadet/cards';
import { PLACE_NAMES, PLACE_WORDS } from '../../fire-cadet/field';
import { REFEREE_WORDS, fireCadetGame, obstacleId } from '../../fire-cadet/game';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import {
  FIRE_PLACES,
  ITEM_NAMES,
  OBSTACLE_KINDS,
  OBSTACLE_WORDS,
  PRACTICE_MAPS,
  readMapCode,
  type FireCadetScenario,
  type PlaceProblem,
} from '../../fire-cadet/scenario';
import { DEFAULT_WORDS, scoreSheetSummary, screenWords } from '../screen-words';
import { STRIP_LINES, stripState } from './ScoreStrip';
import {
  AGES,
  CADET_SHEET_WORDS,
  CADET_WORDS,
  CARD_WORDS,
  MODE_NAME,
  STRIP_WORDS,
  THING_WORDS,
  clockUp,
  editorRefusal,
  fieldInWords,
  lookWord,
  secondsText,
  solverLine,
  squareAt,
} from './words';

const f = FIRE_CADET;
const here = (name: string): string => fileURLToPath(new URL(name, import.meta.url));

const mapOf = (code: string): FireCadetScenario => {
  const reading = readMapCode(code);
  assert.ok(reading.ok, code);
  return reading.scenario;
};
/** Run a row of cards until `until` says stop (or the match ends), tick by tick. */
function run(scenario: FireCadetScenario, row: string, until?: (sim: Simulation<FireCadetScenario>) => boolean): Simulation<FireCadetScenario> {
  const sim = createSimulation({ game: fireCadetGame, scenario, program: cardRowProgram(cardsFromText(row)) });
  sim.start();
  while (sim.status === 'running' && !until?.(sim)) sim.step(1);
  return sim;
}
const P1 = PRACTICE_MAPS[0];
/** The Road Closed sign on D5, right ahead of the robot (the test map of the referee's D1 cases). */
const SIGN_AHEAD = mapOf('S-A6-B3-C5-C7-D5-F5-F7');

// =============================================================================================
// The table of design 7.15
// =============================================================================================

test('7.15: the title row, the loading screen, the mode switch, the match bar and the round button', () => {
  const w = CADET_WORDS;
  assert.deepEqual([w.title, w.robot, w.examplesButton, w.rulesButton], ['Fire Cadet', 'mTiny', 'Examples', 'Rules']);
  assert.equal(w.loading, 'Getting the map and the robot ready…');
  assert.equal(w.howLoadingWorks, 'Loading one puts its cards in your row and sets its map (Undo brings your cards back).');
  // whose members the examples are for, as the other games' screens say it (the shared window builds its sentences with it)
  assert.equal(w.organisation, 'MakeX Lebanon');
  // the screen and the loader hand these very words to the title row
  for (const file of ['FireCadetSimulator.tsx', 'FireCadetLoader.tsx']) {
    assert.match(readFileSync(here(file), 'utf8'), new RegExp(`<TitleBar title="${w.title}" robot="${w.robot}"`), file);
  }
  assert.equal(w.modeGroup, 'How to play');
  assert.deepEqual(w.mode.cards, { label: 'Junior: cards', ages: 'ages 6-7' });
  assert.deepEqual(w.mode.panel, { label: 'Mini: tap to drive', ages: 'ages 4-5' });
  assert.deepEqual(AGES, { panel: '4-5', cards: '6-7' });
  assert.deepEqual(MODE_NAME, { cards: 'Junior', panel: 'Mini' });
  assert.equal(w.speedGroup, 'Speed');
  assert.deepEqual([1, 2, 4].map(w.speed), ['1x', '2x', '4x']);
  assert.equal(w.clockLabel('1:47'), 'Match clock: 1:47 left');
  assert.equal(w.pointsLabel(10, f.MAX_POINTS), '10 of 25 points');
  // design 7.4
  assert.deepEqual([w.go.word, w.stop.word, w.again.word], ['GO', 'STOP', 'AGAIN']);
  assert.equal(w.go.label.cards, 'Go: the robot runs your row');
  assert.equal(w.go.label.panel, 'Go: the match starts');
  assert.equal(w.stop.label, 'Stop: the match ends now and the points count');
  assert.equal(w.again.label, 'Again: put everything back to the start');
});

test('7.15 and 7.13: the row, the card box and the names a screen reader hears', () => {
  const r = CADET_WORDS.row;
  assert.deepEqual([r.heading, r.box], ['Your row', 'The cards']);
  assert.equal(r.label(6), 'Your row: 6 cards');
  assert.equal(r.label(1), 'Your row: 1 card');
  assert.equal(r.startCard, 'Start card');
  assert.equal(r.card(1, 'forward', false), 'Card 1: Forward');
  assert.equal(r.card(2, 'x3', true), 'Card 2: 3 times, for the card before it');
  assert.deepEqual(
    CARD_NAMES.map(r.add),
    ['Add Forward', 'Add Backward', 'Add Turn left', 'Add Turn right', 'Add 2 times', 'Add 3 times', 'Add 4 times', 'Add 5 times'],
  );
  assert.deepEqual([r.undo, r.redo, r.moveLeft, r.moveRight, r.remove, r.clear], ['Undo', 'Redo', 'Move the card to the left', 'Move the card to the right', 'Remove the card', 'New row']);
  // the hidden line after every change of the row
  assert.equal(r.added('forward', 6), 'Forward added. 6 cards.');
  assert.equal(r.removed(5), 'Card removed. 5 cards.');
  assert.equal(r.moved, 'Card moved.');
  // a number card says how many times: the number of its name
  for (const card of NUMBER_CARDS) assert.equal(CARD_WORDS[card], `${card.slice(1)} times`);
  // the panel (design 7.5): the four move cards, by the names of the row
  assert.deepEqual(
    MOVE_CARDS.map((move) => CADET_WORDS.panel.card[move]),
    ['Forward', 'Backward', 'Turn left', 'Turn right'],
  );
  for (const move of MOVE_CARDS) assert.equal(CADET_WORDS.panel.card[move], CARD_WORDS[move]);
  assert.equal(CADET_WORDS.panel.oneTap, 'One tap, one move.');
  assert.equal(CADET_WORDS.panel.goFirst, 'Press GO first.');
});

test('7.15 and 4.3: the refusals of the row are the game\'s own words, the full row with MAX_ROW_CARDS', () => {
  assert.equal(CADET_WORDS.refusals, ROW_PROBLEM_WORDS);
  const expected: Record<RowProblem, string> = {
    'number-first': 'Put an arrow card first.',
    'number-twice': 'One number card for each arrow.',
    'number-alone': 'A number card comes after an arrow.',
    full: `The row is full: ${f.MAX_ROW_CARDS} cards.`,
  };
  assert.deepEqual({ ...CADET_WORDS.refusals }, expected);
  assert.equal(f.MAX_ROW_CARDS, 70);
});

test('7.15 and 7.10: the planning clock, its numbers from PLANNING_SECONDS', () => {
  const p = CADET_WORDS.planning;
  assert.deepEqual([p.title, p.start, p.finish, p.again], ['Planning time', 'Start', 'Finish!', 'Again']);
  assert.equal(p.over, `${f.PLANNING_SECONDS / 60} minutes are over.`);
  assert.equal(p.over, '2 minutes are over.');
  assert.equal(p.recorded('1:23'), 'Planning time: 1:23.');
  assert.equal(p.underSheet('1:23'), 'Planning time: 1:23 of 2:00.');
  assert.equal(clockUp(f.PLANNING_SECONDS), '2:00');
  assert.equal(clockUp(83.9), '1:23');
  assert.equal(clockUp(0), '0:00');
});

test('7.15 and 7.8: the Map section, its note, and the own-map editor with its six sentences', () => {
  const m = CADET_WORDS.map;
  assert.deepEqual(
    [m.title, m.practiceGroup, m.own, m.surprise, m.first, m.copy, m.copied, m.enterCode, m.use],
    ['Map', 'Practice map', 'My own map', 'Surprise', 'Map 1', 'Copy the map code', 'Copied', 'Enter a code', 'Use'],
  );
  assert.deepEqual(PRACTICE_MAPS.map((_, k) => m.practice(k + 1)), ['1', '2', '3', '4', '5', '6', '7', '8']);
  assert.equal(
    m.note,
    'Maps 1 to 8 are practice maps of this simulator, not official ones. 1 is the easiest, 8 the hardest. ' +
      'Here an obstacle stands in the middle of its square. A new map puts everything back to the start.',
  );
  const e = CADET_WORDS.editor;
  assert.deepEqual([e.title, e.how, e.code, e.cancel, e.use], ['My own map', 'Tap a thing. Then tap a square.', 'Code:', 'Cancel', 'Use this map']);
  assert.deepEqual(
    Object.values(THING_WORDS),
    ['Fire', 'Water', 'Cat', 'Injured Person', 'Equipment', 'Road Closed', 'Fallen Tree', 'Broken Vehicle'],
  );
  const refusals: [PlaceProblem, Parameters<typeof editorRefusal>[1], string][] = [
    ['fire-place', 'fire', 'The Fire can be at the School, the Factory, the House or the Bakery.'],
    ['water-square', 'water', 'The Water starts on A6, B6, A7 or B7.'],
    ['start-square', 'cat', 'Nothing can stand where the robot starts.'],
    ['own-target', 'cat', 'The Cat cannot start in the Safe Zone.'],
    ['own-target', 'person', 'The Injured Person cannot start in the Hospital.'],
    ['obstacle-marked', 'fallen-tree', 'An obstacle cannot stand on a marked place.'],
    ['taken', 'equipment', 'This square is taken.'],
  ];
  for (const [problem, thing, sentence] of refusals) assert.equal(editorRefusal(problem, thing), sentence, problem);
  // the Fire's places are the game's four (organiser 4)
  assert.equal(FIRE_PLACES.length, 4);
  // the solver's two lines (N18): "found", never "possible"; 25 and 120 from the table
  assert.equal(solverLine({ found: true, moves: 27, seconds: 52.1 }), 'This simulator found a row for all 25 points: 27 moves, 52.1 seconds.');
  assert.equal(solverLine({ found: false }), 'This simulator found no row for all 25 points inside 120 seconds.');
  assert.equal(e.notFound, `This simulator found no row for all ${f.MAX_POINTS} points inside ${f.MATCH_SECONDS} seconds.`);
  for (const line of [e.found(1, 1), e.notFound]) assert.doesNotMatch(line, /possible/i);
});

test('7.15 and 7.9: the score sheet\'s titles and words, and the closed section\'s few words', () => {
  assert.equal(CADET_WORDS.score.sheet('cards'), 'Score sheet · Junior');
  assert.equal(CADET_WORDS.score.sheet('panel'), 'Score sheet · Mini');
  assert.deepEqual(CADET_SHEET_WORDS, {
    match: 'match',
    goal: 'job',
    goals: 'jobs',
    goalsShort: 'done',
    sheetNotesHeading: 'Obstacles',
    sheetNote: 'The points are what the referee would write down right now. Here the total is never below 0: the rules do not say.',
  });
  // "10 / 25 points · 2 of 5 done": the five lines that bring points, counted from the referee's own sheet
  const sim = run(P1, 'F3 B3');
  const score = sim.score();
  const goals = score.lines.filter((line) => line.max > 0);
  assert.deepEqual(goals.map((line) => line.id), [...ITEM_NAMES, 'return']);
  assert.equal(scoreSheetSummary(score, goals.filter((line) => line.ok).length, goals.length, screenWords(CADET_SHEET_WORDS)), '10 / 25 points · 2 of 5 done');
  // (every word the game leaves to the shared sheet is the shared one)
  assert.equal(screenWords(CADET_SHEET_WORDS).scenario, DEFAULT_WORDS.scenario);
});

test('a time in a sentence is cut to tenths, as the referee writes it, and has no ".0"', () => {
  assert.deepEqual([secondsText(52.1), secondsText(7), secondsText(11.6), secondsText(3.6999), secondsText(-1), secondsText(Number.NaN)], ['52.1', '7', '11.6', '3.6', '0', '0']);
});

// =============================================================================================
// The words of the game are the game's
// =============================================================================================

/** Every sentence the referee says or writes, for every item, obstacle, place and Fire. */
function refereeSentences(): string[] {
  const out: string[] = [];
  const fires = FIRE_PLACES.map((place) => PLACE_WORDS[place]);
  for (const item of ITEM_NAMES) {
    out.push(REFEREE_WORDS.delivered[item]);
    for (const fire of fires) {
      out.push(REFEREE_WORDS.reached[item](fire), REFEREE_WORDS.push[item](fire), REFEREE_WORDS.offMap(item, fire));
      for (const place of PLACE_NAMES) out.push(REFEREE_WORDS.wrongPlace(item, place, fire));
    }
    for (const kind of OBSTACLE_KINDS) out.push(REFEREE_WORDS.itemTouched(item, kind));
  }
  for (const kind of OBSTACLE_KINDS) out.push(REFEREE_WORDS.robotTouched(kind), REFEREE_WORDS.robotTouchedAgain(kind));
  out.push(REFEREE_WORDS.leftMap, REFEREE_WORDS.home, REFEREE_WORDS.homeNow, REFEREE_WORDS.neverLeft, REFEREE_WORDS.partlyHome, REFEREE_WORDS.notHome, REFEREE_WORDS.noObstacle);
  out.push(...Object.values(REFEREE_WORDS.label), REFEREE_WORDS.touched([...OBSTACLE_KINDS]), REFEREE_WORDS.pushed([...OBSTACLE_KINDS]), REFEREE_WORDS.robotNone);
  return out;
}

test('no sentence of the referee is copied into the screen: the banner and the sheet show the referee\'s own words', () => {
  const sentences = refereeSentences();
  assert.ok(sentences.length > 200, `${sentences.length}`);
  // the parts of those sentences that a copy would hold: each sentence cut at ". " and ": "
  const pieces = new Set(sentences.flatMap((s) => s.split(/(?<=[.:!?])\s+/)).filter((piece) => piece.split(' ').length >= 4));
  const files = readdirSync(here('.')).filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts'));
  assert.ok(files.length >= 22, files.join(', '));
  for (const file of files) {
    const source = readFileSync(here(file), 'utf8');
    for (const piece of pieces) assert.ok(!source.includes(piece), `${file} holds the referee's words: "${piece}"`);
  }
  // in particular what the referee says about an obstacle under D1
  assert.equal(REFEREE_WORDS.robotTouched('fallen-tree'), 'The robot touched the Fallen Tree: -1. The referee puts it back.');
});

test('the score strip says what the referee wrote: its pictures are the sheet\'s lines, its obstacles the referee\'s touched ones', () => {
  // the five pictures that bring points are lines of the referee's sheet, by their ids
  const atStart = createSimulation({ game: fireCadetGame, scenario: P1, program: {} }).score();
  assert.deepEqual(STRIP_LINES, [...ITEM_NAMES, 'return']);
  for (const id of STRIP_LINES) assert.ok(atStart.lines.some((line) => line.id === id), id);
  assert.deepEqual(
    stripState(atStart).map((p) => p.label),
    ['Water: not yet', 'Cat: not yet', 'Injured Person: not yet', 'Equipment: not yet', 'Robot home: not yet', 'Road Closed: not touched', 'Fallen Tree: not touched', 'Broken Vehicle: not touched'],
  );
  // the whole row of practice map 1: every line earned, no obstacle touched
  const all = run(P1, 'F3 B L F3 L F R2 F5 B5 B R F3');
  assert.equal(all.score().total, 25);
  assert.deepEqual(stripState(all.score()).map((p) => p.on), [true, true, true, true, true, false, false, false]);
  // the robot runs into the Road Closed sign: the referee's -1, and the strip's "touched, 1 point less"
  const hit = run(SIGN_AHEAD, 'F2');
  const sheet = hit.score();
  assert.equal(sheet.lines.find((line) => line.id === 'obstacles')?.points, -f.POINTS_OBSTACLE);
  const sign = stripState(sheet).find((p) => p.id === 'road-closed');
  assert.deepEqual([sign?.on, sign?.label], [true, 'Road Closed: touched, 1 point less']);
  assert.equal(CADET_WORDS.score.minus, '-1');
  // the Equipment pushed into the Road Closed sign (D1: no point): not "not touched" - the strip says an item touched it
  const pushed = run(mapOf('S-A6-B3-C5-D5-D3-F5-F7'), 'F4');
  assert.equal(pushed.score().lines.find((line) => line.id === 'obstacles')?.points, 0);
  const pushedSign = stripState(pushed.score()).find((p) => p.id === 'road-closed');
  assert.deepEqual([pushedSign?.on, pushedSign?.pushed, pushedSign?.label], [false, true, 'Road Closed: touched by an item. Not allowed on the real map']);
  assert.ok(stripState(pushed.score()).filter((p) => p.id !== 'road-closed').every((p) => !p.pushed));
  // the strip's name of an obstacle is the referee's, without "the" and "sign"
  for (const kind of OBSTACLE_KINDS) assert.ok(OBSTACLE_WORDS[kind].includes(THING_WORDS[kind]), kind);
  assert.equal(STRIP_WORDS.return, 'Robot home');
});

// =============================================================================================
// The field in words (design 7.13)
// =============================================================================================

test('the field in words: at the start, the Cat between the sticks, the Cat taken off the map, a turn', () => {
  const start = createSimulation({ game: fireCadetGame, scenario: P1, program: {} });
  assert.equal(
    fieldInWords(start.world, P1),
    'The robot is on D7 and looks up. On the map: the Water on A6, the Cat on D5, the Injured Person on C5, the Equipment on C7. ' +
      'Obstacles on E3, F5 and F7. The Fire is at the School.',
  );
  assert.equal(
    fieldInWords(run(P1, 'F2').world, P1),
    'The robot is on D5 and looks up. Between its sticks: the Cat. On the map: the Water on A6, the Injured Person on C5, the Equipment on C7. ' +
      'Obstacles on E3, F5 and F7. The Fire is at the School.',
  );
  // F3: the Cat reached the Safe Zone and the referee took it off the map
  assert.equal(
    fieldInWords(run(P1, 'F3').world, P1),
    'The robot is on D4 and looks up. On the map: the Water on A6, the Injured Person on C5, the Equipment on C7. Obstacles on E3, F5 and F7. The Fire is at the School.',
  );
  assert.match(fieldInWords(run(P1, 'R').world, P1), /^The robot is on D7 and looks right\./);
  // Backward first: the robot leaves the map and stops at the edge of the table
  assert.match(fieldInWords(run(P1, 'B').world, P1), /^The robot is off the map and looks up\./);
});

test('the field in words, lead decision D1: an obstacle the referee has lifted is not on the map until it is back', () => {
  const lifted = run(SIGN_AHEAD, 'F2', (sim) => !sim.world.bodies.some((b) => b.id === obstacleId('road-closed')));
  assert.equal(lifted.status, 'running');
  assert.match(fieldInWords(lifted.world, SIGN_AHEAD), / Obstacles on F5 and F7\. /);
  // F2 B2: the robot has left its square, and the sign is back
  const back = run(SIGN_AHEAD, 'F2 B2');
  assert.match(fieldInWords(back.world, SIGN_AHEAD), / Obstacles on D5, F5 and F7\. /);
});

test('squares and directions as the field in words says them', () => {
  assert.deepEqual(squareAt(0, 0), { col: 0, row: 0 });
  assert.deepEqual(squareAt(f.MAT, f.MAT), { col: 6, row: 6 });
  assert.equal(squareAt(-1, 10), null);
  assert.equal(squareAt(10, f.MAT + 1), null);
  assert.deepEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2, 2 * Math.PI, 0.3].map(lookWord), ['up', 'right', 'down', 'left', 'up', 'up']);
});
