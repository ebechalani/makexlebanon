/**
 * The robot Fire Chief is played with: the simulator's mBot2 WITHOUT the gripper (and so without
 * the colour sensor at the claw), and with these parts at its front:
 *
 *   - a colour sensor, fixed to the middle of the front face, looking forward: it reads "red"
 *     when the red fire target is right in front of it
 *   - a fan, blowing forward, on DC motor port M1 of the mBot2 shield
 *
 * (The draft rules name a flame sensor. The organiser has decided since that the game is played
 * with a colour sensor and a red target: this robot has no flame sensor.)
 *
 * It keeps the two encoder motors, the Ultrasonic Sensor 2 (looking forward), the Quad RGB
 * sensor (looking down: it sees the printed grid lines, a real way to count cells) and the
 * CyberPi (gyro, LEDs, screen, buttons, timer).
 *
 * The chassis is 175 mm long and 130 mm wide: inside the 180 x 130 mm limit of the rules.
 *
 * The numbers of the colour sensor and of the fan are ASSUMPTIONS (the organiser has not
 * published a sensor or a fan) - all but one: that a fan action counts within 30 cm of the
 * target is a DECISION of the organiser. They are all here; the list of every assumption and
 * decision of this game is at the top of ./game.ts.
 */
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { FanConfig, Pose, RobotConfig } from '../core/types';
import { START_CELL, TARGET_HEIGHT, cellCenter } from './field';

/**
 * ASSUMPTION: how close the colour sensor must be. It names the colour of a thing that is at
 * most this far (mm) from the face of the sensor; further away it reads "none".
 *
 * Source: Makeblock gives a detection range of 5 to 15 mm for its RGB colour sensors. (That
 * number was handed to us with the task; Makeblock's own pages could not be opened to read it
 * there.) The simulator takes the far end of that range and not a millimetre more: a stricter
 * simulator is the safe side - a program that works at 15 mm also works with a sensor that sees
 * further. The near end is not modelled: the simulated sensor also reads a thing it touches.
 */
export const COLOR_SENSOR_RANGE_MM = 15;

/**
 * The colour sensor. ASSUMPTIONS, all of it (the organiser has only said: a colour sensor that
 * looks forward): which sensor it is, where it sits and how far it sees.
 *
 * It looks along one straight line, from the middle of the front face of the chassis, and
 * names the colour of the nearest thing on that line - the fire target, or a wall - when that
 * thing is close enough. It is never wrong: the simulator's sensor noise does not touch it.
 * (How it is worked out: lookAhead() in core/engine.ts; FrontColorMount in core/types.ts.)
 */
export const COLOR_SENSOR: RobotConfig['frontColorSensor'] = {
  enabled: true,
  rangeMm: COLOR_SENSOR_RANGE_MM,
  mount: {
    // on the front face of the chassis, in the middle
    forward: DEFAULT_ROBOT_CONFIG.chassisFront,
    // at half the height of the target (60 mm; below the 150 mm limit of the rules)
    height: TARGET_HEIGHT / 2,
  },
};

/**
 * The fan. The referee counts a fan action only when the fan is directed at the target - its
 * straight-ahead line hits the target, or the middle of the target is inside this cone - and
 * the target is in reach, with no wall between (rules §7: "the fan must be directed towards the
 * wooden flame"; lookAtFan() in ./game.ts).
 */
export const FAN: FanConfig = {
  enabled: true,
  port: 'M1',
  // on the front face of the chassis
  forward: 105,
  // it blows from 20 % power on, forwards or backwards
  minPower: 20,
  // "directed": the middle of the target is at most 20 degrees away from straight ahead
  // (or the fan points straight at some other part of the target) ...
  coneHalfAngleDeg: 20,
  // ... and at most 300 mm from the fan (DECISION of the organiser: a fan action counts within 30 cm)
  reachMm: 300,
};

export const FIRE_CHIEF_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb },
  ultrasonic: { ...DEFAULT_ROBOT_CONFIG.ultrasonic },
  frontColorSensor: COLOR_SENSOR,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  fan: FAN,
  noise: { ...DEFAULT_ROBOT_CONFIG.noise },
};

/**
 * Where the robot starts: facing up the mat, with the midpoint of its drive axle (the point it
 * turns around) exactly in the middle of the START cell. From there every 300 mm forward puts
 * that point in the middle of the next cell, where the robot has the most room to turn.
 * (The whole robot is inside START: 45 mm free in front of it, 80 mm behind it.)
 */
export const START_POSE: Pose = { ...cellCenter(START_CELL), heading: 0 };
