/**
 * The list of example programs of the Fire Rescue simulator, WITHOUT the programs themselves:
 * what the Examples window needs to draw its cards (name, level, a few sentences) and whether a
 * card is open to everyone or for registered members only.
 *
 *   hello          starter       open      drive, turn, LEDs, screen
 *   line-follow    starter       open      follow the black line with the Quad RGB sensor
 *   gripper-demo   starter       open      every gripper block, on the bucket of water tower W1
 *   one-bucket     intermediate  members   deliver one bucket (default combination)
 *   one-person     intermediate  members   rescue one person (default combination)
 *   smart-bucket   advanced      members   deliver the W1 bucket for ANY combination
 *   full-mission   advanced      members   the whole match, 180 points (default combination)
 *
 * The blocks of the open programs are in ./samples-open.ts and travel to the browser with the
 * simulator. The blocks of the members' programs are in ./samples-locked.ts and stay on the
 * website's server until a member's code has been checked there (see ../members/unlock.ts).
 * That is why this file exists: the browser may know that "Smart bucket" exists and what it
 * does, but not how it is built.
 *
 * To change the name or the text of a card, change it here: the programs take their title,
 * level and description from this list, so the two can never disagree.
 *
 * Plain TypeScript, no DOM, no Blockly, and it imports no program.
 */
import type { ProgramJson } from '../core/types';

export type SampleLevel = 'starter' | 'intermediate' | 'advanced';

/** One card of the Examples window. */
export interface SampleInfo {
  /** stable name, used in links and tests */
  id: string;
  title: string;
  level: SampleLevel;
  /** what the program does and when it works, in a few plain sentences */
  description: string;
  /** true: for registered members; the program is handed out by the server, to a member's code */
  locked: boolean;
}

/** An example with its blocks. */
export interface SampleProgram {
  /** stable name, used in links and tests */
  id: string;
  title: string;
  level: SampleLevel;
  /** what the program does and when it works, in a few plain sentences */
  description: string;
  program: ProgramJson;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly SampleInfo[] = [
  {
    id: 'hello',
    title: 'Hello, mBot2',
    level: 'starter',
    locked: false,
    description:
      'A first program: the robot says hello on its screen, lights its LEDs green, drives 20 cm forward and ' +
      '20 cm back, turns a quarter turn to the right and lights its LEDs blue. Works for every combination ' +
      '(it scores no points). Try changing the numbers and the colours.',
  },
  {
    id: 'line-follow',
    title: 'Follow the black line',
    level: 'starter',
    locked: false,
    description:
      'A line follower with the Quad RGB sensor. The robot drives 11 cm out of the Fire Station (the picture ' +
      'inside it has dark spots that are not a line), then follows the black line to the upper safe zone. ' +
      'The rule inside "forever": both middle probes (L1 and R1) on the line = straight on; line under a left ' +
      'probe = steer left; line under a right probe = steer right; no line at all (the yellow marker) = keep ' +
      'going straight. It stops when the ultrasonic sensor sees the rescue towers closer than 12 cm. ' +
      'Put the robot a little crooked in the Fire Station and watch it steer back onto the line. ' +
      'In "EM1 / EM2" blocks the right motor (EM2) is mirrored: a negative speed drives it forward. ' +
      'Works for every combination (it scores no points).',
  },
  {
    id: 'gripper-demo',
    title: 'Gripper: grab, put down, lift',
    level: 'starter',
    locked: false,
    description:
      'Shows every gripper block. The robot opens its claw, raises the arm (so the fingers pass over the ' +
      'tower), drives to water tower W1 and closes the claw around the bucket. It backs away, lowers the arm ' +
      'until the bucket stands on the mat and lets go. Then it grips the bucket again, on the mat this time, ' +
      'and lifts it. Works for every combination, whatever the colour of the bucket on W1 (it scores no points). ' +
      'Like all the programs that drive by distance, it needs the robot at its default start position.',
  },
  {
    id: 'one-bucket',
    title: 'Deliver one bucket',
    level: 'intermediate',
    locked: true,
    description:
      'Takes the bucket from water tower W1 and delivers it to square A2 of building A (the Apartment, top ' +
      'right), driving by distance only - no sensors. This scores 20 points ONLY when the bucket on W1 is the ' +
      'red one and the person of building A stands in square 1, as in the default combination. With another ' +
      'combination the bucket ends up at the wrong building, or the robot runs into the person. ' +
      'The robot gets in front of A2 by driving backwards, so its gripper never sticks out over the edge of the mat. ' +
      'Distances alone are exact only for the perfect simulated robot at its default start position: move the ' +
      'robot, or switch on wheel slip, and it starts to miss.',
  },
  {
    id: 'one-person',
    title: 'Rescue one person',
    level: 'intermediate',
    locked: true,
    description:
      'Drives to square A1 of building A, grips the person standing there, lifts it and carries it to the ' +
      'red rescue tower RR in the lower safe zone, where it is put down on top of the tower. This scores 20 ' +
      'points ONLY when the red person waits in A1, as in the default combination: with another combination ' +
      'the square is empty, or the person has another colour and RR is the wrong tower for it. ' +
      'It drives by distance only, which is exact for the perfect simulated robot at its default start position.',
  },
  {
    id: 'smart-bucket',
    title: 'Smart bucket: any colour, any square',
    level: 'advanced',
    locked: true,
    description:
      'Takes the bucket from water tower W1, reads its colour with the colour sensor at the claw and keeps it ' +
      'in the variable "colour". The colour decides the building: red = A, blue = B, yellow = C, green = D. ' +
      'In front of the building the robot faces the inner one of the two white squares and measures with the ' +
      'ultrasonic sensor: closer than 20 cm means a person stands there, so the water goes into the other ' +
      'square (the my-block "deliver" does this; it steps sideways by driving backwards, so the gripper stays ' +
      'over the mat). Delivers the W1 bucket correctly (20 points) for every one of the 9216 combinations. ' +
      'It drives by distance, so it relies on the perfect simulated robot at its default start position; switch ' +
      'on wheel slip to see why real robots also use the lines.',
  },
  {
    id: 'full-mission',
    title: 'Full mission: 180 points on the default combination',
    level: 'advanced',
    locked: true,
    description:
      'A complete solution, not a lesson: all eight missions in one run. Every bucket is delivered to its ' +
      'building and every person is carried to the rescue tower of its colour - 160 points plus the 20 point ' +
      'bonus, in about 103 of the 180 seconds. It scores 180 ONLY on the default combination, from the default ' +
      'start position and with the perfect simulated robot, because it drives by distance alone (no sensors). ' +
      'On any other combination it does not: that needs the ideas of the "Smart bucket" program. ' +
      'The my-blocks "pick up" and "put down" keep the script short.',
  },
];

/** The card of one example. */
export function sampleInfo(id: string): SampleInfo | undefined {
  return SAMPLE_CATALOG.find((info) => info.id === id);
}

/** Put the blocks of an example together with its card from the list above. */
export function sampleWithProgram(id: string, program: ProgramJson): SampleProgram {
  const info = sampleInfo(id);
  if (!info) throw new Error(`"${id}" is not in the list of examples (sample-catalog.ts).`);
  return { id: info.id, title: info.title, level: info.level, description: info.description, program };
}
