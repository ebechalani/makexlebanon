/**
 * What the "Rules" button of the Locker Room simulator shows. Two parts, kept clearly apart:
 *
 *   1. LOCKER_ROOM_RULES - the mission ("Starter - Locker Room Mission", the organiser's latest
 *      rules, 150 s) in short, plain words, with the points as the simulator counts them, and
 *      where the pickup zones and the targets are - which the organiser confirmed (the team cubes
 *      on the squares in the maze, the tokens to the "warehouses" at the top: ../../locker-room/field.ts
 *      MARK_ROLES).
 *   2. LOCKER_ROOM_ASSUMPTIONS - "What this simulator assumes": where the rules are open, where
 *      they say two things, and every number the simulator had to choose. Nobody should take one
 *      of these for a rule, so they are never mixed into part 1. The list of questions for the
 *      organiser, with the constant behind every one, is at the top of
 *      ../../locker-room/game.ts (L1 - L11) and in the README.
 *
 * The category is for ages 13 to 15, and many students read English as a second language: short
 * sentences, plain words, nothing more certain than the rules or the simulator. Every number is
 * written from the constant that holds it, and ./rules.test.ts checks every number of every
 * sentence against the game. Which mark is a pickup zone and which a target is read from the one
 * table of ../../locker-room/field.ts (MARK_ROLES): should it ever change, the texts follow.
 *
 * (The referee itself is in ../../locker-room/game.ts; this is only what students read.)
 */
import { TABLE_MARGIN } from '../../core/engine';
import type { RobotConfig } from '../../core/types';
import { distanceToSegment, type OBB } from '../../core/geometry';
import {
  CARD,
  CUBE_HEIGHT,
  CUBE_SIZE,
  FRAME_WIDTH,
  GATE_HEIGHT,
  LOCKER_ROOM_FRAME,
  MAT_SIZE,
  ROLE_WORD,
  TEAM_BOX,
  TEAM_COLORS,
  markOutline,
  marksWithoutRole,
  pickupZone,
  targetOf,
  type Mark,
} from '../../locker-room/field';
import {
  BOX_LIFT_S,
  CARD_AWAY_S,
  CARD_SHOW_S,
  GATE_TOUCH_PENALTY,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_APPROVAL,
  POINTS_DELIVERY,
  POINTS_GATE,
  POINTS_LEAVE,
  POINTS_SCAN_STATION,
  POINTS_TOKEN,
  POINTS_TOKEN_PARTLY,
  WRONG_DELIVERY_PENALTY,
  WRONG_TOKEN_PENALTY,
  cubeFitsInside,
  turnRoom,
} from '../../locker-room/game';
import { LOCKER_ROOM_ROBOT, robotReach } from '../../locker-room/robot';
import { TOKEN_COLORS, ZONE_OPTION_NUMBERS, type TokenColor } from '../../locker-room/scenario';
import type { RulesPart, RulesSection } from '../SimulatorApp';
import { COLOR_WORD } from './cards-panel';

/** mm in cm, as a sentence writes it: 50 -> "5", 1235 -> "123.5". */
const cm = (mm: number): string => String(Math.round(mm) / 10);
/** seconds as a sentence writes them: 0.5 -> "0.5", 4 -> "4". */
const s = (seconds: number): string => String(seconds);

/** The whole robot seen from above, with its claw open: from the back of the chassis to the tips of the fingers (mm). */
export const robotLength = (config: RobotConfig): number => robotReach(config).front + robotReach(config).rear;
/** ... and across (mm). */
export const robotWidth = (config: RobotConfig): number => 2 * robotReach(config).halfWidth;

/** The room inside the yellow frame of the Locker Room (mm): the frame is drawn on the middle of its square. */
export const INSIDE_THE_FRAME = LOCKER_ROOM_FRAME.w - FRAME_WIDTH;

/** (Can a cube stand completely inside a mark? The referee asks the same: ../../locker-room/game.ts.) */
export { cubeFitsInside };

/** The token colours whose target can never hold a whole cube (with the decided marks: none - the warehouses all hold one). */
export const TOO_SMALL_TARGETS: readonly TokenColor[] = TOKEN_COLORS.filter((color) => !cubeFitsInside(targetOf(color)));

/** The most a robot can score in this simulator: every point, less what the targets that are too small for a cube cannot give (85). */
export const REACHABLE_MAX = MAX_SCORE - TOO_SMALL_TARGETS.length * (POINTS_TOKEN - POINTS_TOKEN_PARTLY);

/** The token colours whose target is turned (with the decided marks: RED and GREEN, the warehouses at the top left and right). */
export const TURNED_TARGETS: readonly TokenColor[] = TOKEN_COLORS.filter((color) => (targetOf(color).box?.angle ?? 0) !== 0);
/** How far those targets are turned, in whole degrees, as a sentence says it (45). */
export const TURNED_DEGREES = TURNED_TARGETS.length > 0 ? Math.round(Math.abs(((targetOf(TURNED_TARGETS[0]).box as OBB).angle * 180) / Math.PI)) : 0;

/**
 * How far off the turn of its warehouse a token may stand and still be completely inside, in whole
 * degrees as a sentence says it: the smallest of the warehouses' (../../locker-room/game.ts
 * turnRoom), rounded DOWN, so that the window never promises a turn the referee refuses (17: the
 * referee's edge is at 17.7 degrees, for a token in the middle of its warehouse).
 */
export const TURN_ROOM_DEGREES = Math.floor((Math.min(...TOKEN_COLORS.map((color) => turnRoom(targetOf(color)))) * 180) / Math.PI + 1e-9);
/** The token colours whose target is not turned (with the decided marks: BLUE, the warehouse at the top in the middle). */
export const STRAIGHT_TARGETS: readonly TokenColor[] = TOKEN_COLORS.filter((color) => !TURNED_TARGETS.includes(color));

/** The shortest distance between the outlines of two marks that do not overlap (mm). */
export function markGap(a: Mark, b: Mark): number {
  const pa = markOutline(a);
  const pb = markOutline(b);
  let best = Infinity;
  for (const [from, to] of [[pa, pb], [pb, pa]]) {
    for (const p of from) {
      for (let i = 0; i < to.length; i++) best = Math.min(best, distanceToSegment(p, to[i], to[(i + 1) % to.length]).dist);
    }
  }
  return best;
}

/** One cube might lie on two targets at once: two of them are closer than a cube's diagonal (with the decided marks: no, they are over 36 cm apart). */
export const TARGETS_CLOSE = TOKEN_COLORS.some((a, i) => TOKEN_COLORS.slice(i + 1).some((b) => markGap(targetOf(a), targetOf(b)) < CUBE_SIZE * Math.SQRT2));

/** "the RED and the GREEN token", "the BLUE token" */
const tokensWord = (colors: readonly TokenColor[], noun = 'token'): string =>
  colors.length === 1 ? `the ${COLOR_WORD[colors[0]]} ${noun}` : `${colors.slice(0, -1).map((c) => `the ${COLOR_WORD[c]}`).join(', ')} and the ${COLOR_WORD[colors[colors.length - 1]]} ${noun}`;

/**
 * The sentence under the heading of the rules window. (The rules file on the category page is
 * these newest rules since they replaced v2.3: content/seasons.ts. No name of the category here:
 * "Starter" is also the name of a level of the examples - ./rules.test.ts.)
 *
 * It ends with a colon: the window puts LOCKER_ROOM_RULES_LINK right after it, and a full stop
 * (../SimulatorApp.tsx). "On this website" alone did not say where, and the simulator's page has
 * no other way to the file.
 */
export const LOCKER_ROOM_RULES_NOTE =
  `MakeX Lebanon, Season 2026, ages 13 to 15. This simulator follows the newest rules of the organiser (${MATCH_DURATION} s). ` +
  'You can download them on this website:';

/**
 * Where the rules file can be downloaded: the page of this category, which lists it under "Rules
 * and downloads" (content/seasons.ts; ./screen.test.ts checks that this is that page and that the
 * file is on it). A link to the page, not to the file: the page also says what the organiser
 * confirmed after the rules were written, and a later version of the file keeps the link.
 */
export const LOCKER_ROOM_RULES_LINK = { label: 'the Locker Room page of Season 2026', href: '/season/2026/locker-room' } as const;

export const LOCKER_ROOM_RULES: RulesSection[] = [
  {
    title: 'The mission',
    items: [
      'The robot carries the Team Box from the Locker Room to the Scan Station.',
      'There it reads a colour card: the team colour, RED or GREEN.',
      'Then it takes the cube of the team colour to the big circle of that colour. This opens the stadium gate.',
      `Last, it sorts the ${TOKEN_COLORS.length} tokens (RED, GREEN, BLUE) into the ${ROLE_WORD.target}s of their colour.`,
      'After GO the robot works on its own. Nobody touches it.',
    ],
  },
  {
    title: 'The field',
    items: [
      `The mat is ${cm(MAT_SIZE)} x ${cm(MAT_SIZE)} cm. It is black, with white lines.`,
      'The Locker Room (the start) is at the bottom left. The Scan Station is at the bottom right.',
      'The big RED circle is on the right. The big GREEN circle is in the lower middle.',
      // (where the pickup zones and the targets are: the organiser's answer, ../../locker-room/field.ts MARK_ROLES)
      `The team cubes start in the ${ROLE_WORD.pickup}s: ${TEAM_COLORS.map((team) => `${COLOR_WORD[team]} on ${pickupZone(team).name}`).join(', ')}.`,
      'Zones A, B and C are on the left of the maze: A at the bottom, C at the top. Each holds one token.',
      `The targets of the tokens are the ${TOKEN_COLORS.length} ${ROLE_WORD.target}s: ${TOKEN_COLORS.map((color) => `${COLOR_WORD[color]} ${targetOf(color).place}`).join(', ')}.`,
      // (the written rules: "Inside the maze, there are 3 colored target rectangles")
      'The written rules say the targets are "inside the maze". The organiser has confirmed the places above.',
      'The stadium gate stands left of the big GREEN circle. It is closed at the start.',
    ],
  },
  {
    title: 'Before the match',
    items: [
      // (the rules: "Two random cards are drawn" - they do not say by whom)
      'Two cards are drawn: the Team Colour card (RED or GREEN) and the Zone Assignment card.',
      `The Zone Assignment card is one of ${ZONE_OPTION_NUMBERS.length} options. It says which token stands in zone A, B and C.`,
      'Here the Cards panel shows the two cards, and you can change them.',
      'The robot starts completely inside the Locker Room, with the Team Box. It holds no cube.',
    ],
  },
  {
    title: 'The match',
    items: [
      `A match lasts ${MATCH_DURATION} seconds.`,
      'It ends when the time is up, or when the referee says "STOP". Here the "Finished" button is that "STOP".',
      'Here the match also ends when your program has ended and the robot stands still.',
      'Then the referee looks at the field as it is.',
      // (the rules never name a restart: they only void a run that somebody touched, §8.3 - so the window does not make "no restarts" a rule)
      'The rules say nothing about restarts. If anyone but the referee touches the robot after GO, the run counts 0. So there is no Restart button here.',
    ],
  },
  {
    title: 'At the Scan Station',
    items: [
      'The robot drives into the Scan Station with the Team Box.',
      // (the rules say "places a color cube" and "scans the card": how it is shown is the simulator's choice, in part 2)
      'The referee puts the team colour (RED or GREEN) in front of the robot. The robot reads it by itself.',
      'Then the referee takes the card away and lifts the Team Box off the robot. This is the coach approval.',
      `The rules say: it is better when the robot waits ${s(BOX_LIFT_S)} seconds, so that the referee can lift the Team Box.`,
    ],
  },
  {
    title: `Points (${MAX_SCORE} at most)`,
    items: [
      `+${POINTS_LEAVE}: Step 1, the robot leaves the Locker Room with the Team Box.`,
      `+${POINTS_SCAN_STATION}: Step 2, the robot reaches the Scan Station with the Team Box.`,
      `+${POINTS_APPROVAL}: Step 3, the referee lifts the Team Box (coach approval).`,
      '(Step 4, a pause, is cancelled in the rules.)',
      `+${POINTS_DELIVERY}: Step 5, the cube of the team colour in the big circle of that colour. In the wrong circle: -${WRONG_DELIVERY_PENALTY}.`,
      `+${POINTS_GATE}: Step 6, the gate bonus. It comes with a correct Step 5, and the gate opens.`,
      `+${POINTS_TOKEN} for each token completely inside the target of its colour, +${POINTS_TOKEN_PARTLY} when it is only partly inside. A wrong delivery: -${WRONG_TOKEN_PENALTY}.`,
      `-${GATE_TOUCH_PENALTY}: the robot touches the gate.`,
      `All together: ${POINTS_LEAVE} + ${POINTS_SCAN_STATION} + ${POINTS_APPROVAL} + ${POINTS_DELIVERY} + ${POINTS_GATE} + ${TOKEN_COLORS.length} x ${POINTS_TOKEN} = ${MAX_SCORE}.`,
    ],
  },
  {
    title: 'Ranking',
    items: ['Every team has 2 runs. The better one counts.'],
  },
];

/** The second part of the window: what the simulator had to choose because the rules do not say it, or say two things. */
export const LOCKER_ROOM_ASSUMPTIONS: RulesPart = {
  title: 'What this simulator assumes',
  note: 'These are not rules. The rules do not say these things, or say two different things, so the simulator had to choose.',
  sections: [
    {
      title: `The ${ROLE_WORD.target}s`,
      items: [
        TOO_SMALL_TARGETS.length > 0
          ? `A cube is ${cm(CUBE_SIZE)} cm wide, and here ${tokensWord(TOO_SMALL_TARGETS)} ${TOO_SMALL_TARGETS.length === 1 ? 'has a target' : 'have targets'} that ${TOO_SMALL_TARGETS.length === 1 ? 'is' : 'are'} smaller. So ${TOO_SMALL_TARGETS.length === 1 ? 'it' : 'they'} can never be completely inside: +${POINTS_TOKEN_PARTLY} at most. The most a robot can score here is ${REACHABLE_MAX}.`
          : `A cube is ${cm(CUBE_SIZE)} cm wide. It fits completely inside every ${ROLE_WORD.target}.`,
        ...(TOO_SMALL_TARGETS.length > 0 ? [`So on the score sheet, +${POINTS_TOKEN_PARTLY} counts as done for ${TOO_SMALL_TARGETS.length === 1 ? 'that token' : 'those tokens'}.`] : []),
        // (how a cube must stand in a turned target: ../../locker-room/game.ts cubeFitsTurned, turnRoom. Not "the same
        // way": the referee gives +10 to a token that is up to 17.7 degrees off, and the window must not be stricter)
        ...(TURNED_TARGETS.length > 0
          ? [
              `${tokensWord(TURNED_TARGETS, ROLE_WORD.target).replace(/^t/, 'T')} ${TURNED_TARGETS.length === 1 ? 'is' : 'are'} turned by ${TURNED_DEGREES} degrees. A token is completely inside only if it is turned almost the same way.`,
              `"Almost": in the middle of the ${ROLE_WORD.target}, the token may be about ${TURN_ROOM_DEGREES} degrees off, not more.`,
              `A token that stands straight in one of them is only partly inside: +${POINTS_TOKEN_PARTLY}.`,
              'Here the claw holds a cube square to the robot. So the robot puts the token down facing along the turned white line that leads there.',
            ]
          : []),
        // (the same room to turn in a target that is not turned)
        ...(STRAIGHT_TARGETS.length > 0 && TURN_ROOM_DEGREES < 45
          ? [
              `${tokensWord(STRAIGHT_TARGETS, ROLE_WORD.target).replace(/^t/, 'T')} ${STRAIGHT_TARGETS.length === 1 ? 'is' : 'are'} not turned. There a token is completely inside only if it stands almost straight. It may be about ${TURN_ROOM_DEGREES} degrees off, not more.`,
            ]
          : []),
      ],
    },
    {
      title: 'The Team Box and the card',
      items: [
        `The Team Box rides on top of the robot from the start: ${cm(TEAM_BOX.w)} x ${cm(TEAM_BOX.l)} x ${cm(TEAM_BOX.h)} cm here. The rules give no size.`,
        'It does not make the robot bigger on the mat, and no sensor sees it.',
        'The rules say "a color cube" and "the card". Here the referee holds a card of the team colour just in front of the claw.',
        `The card is ${cm(CARD.w)} x ${cm(CARD.h)} cm. It is read by the colour sensor at the claw. The robot cannot push it, and the ultrasonic sensor does not see it.`,
      ],
    },
    {
      title: 'When the referee acts',
      items: [
        'The rules give no times. Here the referee waits until the robot stands still, completely inside the Scan Station, with the Team Box.',
        `${s(CARD_SHOW_S)} seconds later the referee shows the card. At ${s(CARD_AWAY_S)} seconds the referee takes it away. At ${s(BOX_LIFT_S)} seconds the referee lifts the Team Box: +${POINTS_APPROVAL}.`,
        'If the robot moves before that, the card goes away and the box stays on. It all starts again when the robot stops in the Scan Station again.',
        'If your program ends while the robot waits, the match ends too - before the box is lifted.',
        `The simulator cannot see if your program read the card. Here the box is lifted after ${s(BOX_LIFT_S)} seconds, read or not.`,
        'At the competition the robot must read the card. The rules do not say how the referee checks it.',
      ],
    },
    {
      title: 'Leaving and reaching',
      items: [
        'Step 1 counts when the whole robot is outside the Locker Room, its yellow frame included.',
        'Step 2 counts when the whole robot is inside the Scan Station, its yellow frame included.',
        `The frame is part of the zone here: inside the frame there are only ${cm(INSIDE_THE_FRAME)} cm, and the robot is ${cm(robotLength(LOCKER_ROOM_ROBOT))} cm long.`,
      ],
    },
    {
      title: 'The deliveries',
      items: [
        'A team cube is delivered when it stands on the mat, completely inside a big circle, not held and not touching the robot.',
        'The first delivery decides Step 5. Later deliveries change nothing.',
        `The rules say only "Wrong color circle". Here the cube of the other colour in any big circle is a wrong delivery too: -${WRONG_DELIVERY_PENALTY}.`,
        'The rules do not say that the robot must read the card first. Here it does not have to.',
        `A token in a big circle, or a team cube in a ${ROLE_WORD.target}, counts for nothing.`,
      ],
    },
    {
      title: 'The tokens',
      items: [
        'They are judged at the end: standing on the mat, not held and not touching the robot.',
        `A token that is partly inside a target of another colour, and not in its own, counts as a wrong delivery: -${WRONG_TOKEN_PENALTY}.`,
        // (only where two targets are close enough for one cube to touch both: not with the decided marks)
        ...(TARGETS_CLOSE ? ['A token that is partly inside its own target counts for it, even if it touches another target too.'] : []),
      ],
    },
    {
      title: 'The gate',
      items: [
        `It is a yellow barrier on its dotted rectangle, ${cm(GATE_HEIGHT)} cm high. The rules give no size.`,
        `Touching it costs ${GATE_TOUCH_PENALTY} points once, however often the robot touches it.`,
        'A cube that the robot pushes against the gate is not the robot touching it.',
        'After a wrong delivery, or none, the gate stays closed for the whole match.',
        'Here the closed gate does not stop the robot from sorting the tokens: they count all the same. The robot can drive around the gate.',
        'The story of the rules sorts the tokens after the gate opens, but Step 7 does not ask for an open gate.',
      ],
    },
    {
      title: 'The cubes and the mat',
      items: [
        `A cube is ${cm(CUBE_SIZE)} x ${cm(CUBE_SIZE)} cm and ${cm(CUBE_HEIGHT)} cm high, as the cube file on this website. It is light: the robot can push it.`,
        `The mat lies on a table. The robot and the cubes can leave the mat, and they stop ${cm(TABLE_MARGIN)} cm outside it.`,
        `The two yellow pieces in the long line on the left${marksWithoutRole().map((mark) => `, and ${mark.name},`).join('')} have no role in the rules. The line sensor sees the yellow pieces as yellow.`,
      ],
    },
    {
      title: 'The robot',
      items: [
        `It is the mBot2 of Warehouse Sort, with the gripper at the front: ${cm(robotLength(LOCKER_ROOM_ROBOT))} cm long and ${cm(robotWidth(LOCKER_ROOM_ROBOT))} cm wide. It fits inside the Locker Room.`,
        'Its line sensor is set for white lines on a black mat. "Line" means a light colour: white, and also yellow (the frames, the band, the pieces).',
        `The colour sensor at the claw sees a cube that is at most ${cm(LOCKER_ROOM_ROBOT.frontColorSensor.rangeMm)} cm in front of the middle of the claw.`,
        'The robot is perfect: its wheels do not slip and its sensors make no mistakes. A real robot drifts.',
        'The CyberPi buttons work during a match. At the competition nobody may steer the robot.',
      ],
    },
    {
      title: 'The total',
      items: ['The total is never below 0. The rules do not say.'],
    },
    {
      title: 'Not in the simulator',
      items: ['A run that counts 0 because somebody touched the robot, damage to the field, and the 2 runs of the ranking.'],
    },
  ],
};
