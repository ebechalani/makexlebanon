/**
 * What the "Rules" button of the Fire Chief simulator shows. Two parts, kept clearly apart:
 *
 *   1. FIRE_CHIEF_RULES - the draft rules of the category in short student words ("MakeX
 *      Lebanon 2027, Fire Chief, Dynamic Maze Challenge, draft competition rules"), together
 *      with what the organiser has decided since the draft was written:
 *        - the walls are 3 mm thick and the outer edge of the field is walled,
 *        - the fire target is 6 cm wide and 12 cm high,
 *        - touching or hitting the target without moving it costs nothing,
 *        - a fan action counts from outside the room when the fan is within 30 cm of the target,
 *        - the 30 points need only the position: what the colour sensor reads does not matter
 *          to the referee,
 *        - the robot finds the fire with a colour sensor that looks forward, and the fire
 *          target is red. (The draft names a flame sensor and an infrared light in the target.
 *          This decision overrules it: the game has neither.)
 *      The window marks this part as a draft (FIRE_CHIEF_RULES_NOTE).
 *
 *   2. FIRE_CHIEF_ASSUMPTIONS - "What this simulator assumes": what neither the draft nor the
 *      organiser has said yet and the simulator had to choose, as far as a student can notice
 *      it. Nobody should take one of these for a rule, so they are never mixed into part 1.
 *      About the colour sensor almost everything is here: which sensor it is, that it names a
 *      colour only from 15 mm or closer, that the target is red on every side, and what the
 *      sensor reads on a wall.
 *      The full list, with the constant behind every line, is at the top of
 *      ../../fire-chief/game.ts.
 *
 * No sentence here may say more than the draft, the organiser or the code says, and every
 * number is the number of the code: ./rules.test.ts compares each one with the constant that
 * holds it, and fails for a number that is not on its list. So when a constant of the game
 * changes, that test says which sentence to change here.
 *
 * (The referee itself is in ../../fire-chief/game.ts; this is only what students read.)
 */
import type { RulesPart, RulesSection } from '../SimulatorApp';

/** The sentence under the heading of the rules window. */
export const FIRE_CHIEF_RULES_NOTE = 'Draft rules, MakeX Lebanon 2027. Timing, scoring and restarts are proposals and can change.';

export const FIRE_CHIEF_RULES: RulesSection[] = [
  {
    title: 'The field',
    items: [
      'The mat is a grid of 5 x 5 cells. On the printed map a cell is 30 x 30 cm and the whole mat is 150 x 150 cm.',
      'START is the cell at the bottom centre. The living room is the top left cell, the bedroom is the top right cell.',
      'Walls stand on the lines between the cells. They are 15 cm high and 3 mm thick and do not move during an attempt. The outer edge of the field is walled too.',
      'The black lines of the grid are only printed: the robot may drive over a line where no wall stands.',
      'The maze can be different in every round. There is always a way from START to both rooms.',
      'The fire is a red wooden flame, 6 cm wide and 12 cm high. It stands in the living room or in the bedroom. The candle and the fireplace printed in the rooms are only pictures.',
      'Teams hand in their robot before the maze and the place of the fire are shown. After that the program must not be changed.',
    ],
  },
  {
    title: 'The robot',
    items: [
      'It may be at most 18 cm long, 13 cm wide and 30 cm high, at every moment of the attempt.',
      'No sensor and no motor may be higher than 15 cm above the mat: the robot must not look over the walls.',
      'It drives by itself after the start, with its own battery. Remote control and commands from outside are not allowed.',
      'It has a colour sensor that looks forward, and a fan. The fire target is red: the robot finds it, reads "red" with the colour sensor and blows at it with the fan.',
      'The draft rules still name a flame sensor. The organiser has decided since then: the game is played with a colour sensor, not with a flame sensor.',
      'It must find its way with its sensors. A program that only repeats a list of moves learned by heart is not what the challenge asks for.',
      'It stays on the mat. It does not climb over walls and does not move them.',
      'It must not damage the field, and it must not use a wall that was moved as a shortcut.',
    ],
  },
  {
    title: 'The attempt',
    items: [
      'An attempt lasts at most 3 minutes (180 seconds).',
      'The whole robot starts inside the START cell. Before the start the referee checks its size and where it stands.',
      'At the signal of the referee one team member starts the robot with a single action. The clock starts at that signal.',
      'The robot drives through the maze, looks for the fire, goes to it, faces it and blows at it with its fan. It may look into either room first.',
      // (draft §6, step 6: "Stop to indicate mission completion")
      'When the fan action is done, the robot stops. That shows that its mission is complete.',
    ],
  },
  {
    title: 'Points - each achievement counts once (100 in all)',
    items: [
      '10 points: the whole robot has left the START cell.',
      '20 points: the whole robot is inside the living room or the bedroom. The second room adds nothing.',
      '30 points: the robot stands still, faces the fire target and its fan is on. The fan must be at most 30 cm from the target, with no wall between them, and the robot must not touch the target. Only this position counts: what the colour sensor reads does not matter to the referee.',
      '40 points: the fan keeps blowing at the target like this for 3 seconds without a break.',
      'The fan action also counts from outside the room, when the fan is at most 30 cm from the target. A robot that completes it without ever being completely inside a room ends the attempt with 80 points.',
      'The referee writes down the time of every achievement.',
    ],
  },
  {
    title: 'What does not count',
    items: [
      'A fan that blows in the room without the fire.',
      'A fan that blows while the robot moves, while the robot touches the target, or with a wall between the fan and the target.',
      'A fan action that stops before the 3 seconds are over. The 30 points stay, and the 3 seconds start again with the next fan action.',
      'A second time for an achievement: each one is given once per attempt.',
    ],
  },
  {
    title: 'An attempt ends when',
    items: [
      'the mission is complete: the 3-second fan action is done;',
      'the time is up;',
      'the team asks for the end ("Finished");',
      'the referee stops it, because a rule was broken or because of a problem with the equipment.',
      'The robot moves the fire target or a wall: the attempt ends at once and only the achievements earned before count. Touching or hitting the target without moving it costs nothing.',
      'A light touch of a wall by accident is allowed, as long as the wall stays in its place.',
      'A team member touches the robot without the permission of the referee: the attempt ends, and the points earned before stay.',
      'When equipment of the organiser fails, the referee can give the team a new attempt.',
    ],
  },
  {
    title: 'Restart',
    items: [
      'A team may ask for one restart per attempt. The team touches the robot only when the referee allows it.',
      'The robot goes back to START. The clock keeps running.',
      'The points earned so far in this attempt are cleared.',
      'The maze and the fire stay as they are. The team may reset the robot but must not change the robot or its program.',
    ],
  },
  {
    title: 'Ranking',
    items: [
      'Every team has two scored attempts. The better one counts.',
      'Teams are ranked by the most points; then by the shortest time to reach these points; then by the points of the other attempt; then by a deciding attempt.',
    ],
  },
  {
    title: 'Fair play',
    items: [
      'Students build, program and run their robot themselves.',
      'Coaches and spectators give no directions and send no commands during an attempt.',
      'All teams respect the field, the equipment, the other teams and what the referee says.',
    ],
  },
];

/** The second part of the window: what the simulator had to choose because nobody has said it yet. */
export const FIRE_CHIEF_ASSUMPTIONS: RulesPart = {
  title: 'What this simulator assumes',
  note: 'These are not rules. The rules do not say these things yet, so the simulator had to choose. At the competition they can be different.',
  sections: [
    {
      title: 'The fire target',
      items: [
        'It can stand at three places of its room, always against an outer wall and facing into the room: in the corner, in the middle of the back wall (the top edge of the mat) or in the middle of the side wall.',
        'It is 2 cm thick and light: the robot can push it away.',
        'It is red on every side: the colour sensor reads "red" on its front, on its back and on its two ends.',
        'It counts as moved when one of its corners is more than 5 mm away from its place.',
        'It cannot fall over here. A real target can fall over when the robot hits it.',
        '"Touching" means: closer than 0.5 mm.',
      ],
    },
    {
      title: 'The colour sensor and the fan',
      items: [
        'Which colour sensor the robot gets is not decided yet. Here it is one sensor in the middle of the front of the robot, 6 cm above the mat. It looks straight ahead. In real mBlock its blocks can have other words than here.',
        'It names a colour only when the thing in front of it is 15 mm away or closer. Further away it reads "none". It does not see through a wall.',
        'So a robot that stands close to the fire target can still read "none": on the screen the last 15 mm are only a few dots wide. Open the Sensors panel to see what the sensor reads.',
        'On the fire target it reads "red". On a wall it reads "yellow", never "red".',
        'When the target stands in a corner, the two walls of the corner stop the robot before it reaches the target: 15 mm in front of it when the robot comes straight at it. There the sensor reads "red" only while the robot touches both walls, or almost touches them.',
        'The fan is on DC motor port M1. It blows when the power of that motor is 20 % or more, forwards or backwards.',
        '"Facing the target" means: the fan points straight at some part of the target, or the middle of the target is at most 20 degrees to the side.',
        'The 30 cm are measured from the fan, at the front of the robot, to the middle of the target. "No wall between" means: no wall on the straight line between these two points.',
      ],
    },
    {
      title: 'The robot and the walls',
      items: [
        'The robot is always the same mBot2: 17.5 cm long and 13 cm wide, with the colour sensor and the fan at its front. Its size is not checked before the start.',
        'The robot is perfect: its wheels do not slip and its sensors make no mistakes. A real robot drifts a little.',
        'Walls cannot be moved here and they are perfectly smooth: a robot that touches a wall slides along it, for as long as it likes. Pushing a wall on purpose is not judged.',
        'Walls close the corners without a gap: no sensor looks through a corner.',
        'Walls are drawn thicker than they really are, so that you can see them. The robot stops at the real wall, in the middle of the drawn one. With the ruler, measure to the middle of a drawn wall.',
      ],
    },
    {
      title: 'The referee of the simulator',
      items: [
        '"Standing still" means: both wheels have stopped and the robot does not move at all. Wheels that turn while the robot is stuck at a wall do not count as standing still.',
        'The time written on the 30 points is the moment the fan action begins.',
        'What the robot earns in the very last moment of the time still counts.',
        'One more end that the draft rules do not name: the attempt also ends when the program has ended, the robot stands still and no DC motor runs. A program that ends with the fan still on runs until the time is up.',
        'When the mission is complete, the simulator stops the robot and its fan by itself. On a real field your program has to stop them.',
        'The only broken rule that ends an attempt here is a moved target.',
        'A restart puts the robot back exactly where and how it started. A target that was pushed a little goes back to its place.',
        'Before the start the robot can only be put completely inside the START cell.',
        'The CyberPi buttons work during an attempt. At the competition nobody may steer the robot.',
        'The simulator does not judge how a program finds its way: a list of moves learned by heart is not noticed.',
        'The simulator plays one attempt at a time. It shows the points and the time of every achievement, but it does not compare two attempts.',
      ],
    },
  ],
};
