/**
 * The robot Fire Chief is played with: the simulator's mBot2 WITHOUT the gripper and without the
 * front colour sensor, and with two new parts at its front:
 *
 *   - a flame sensor (infrared), looking forward
 *   - a fan, blowing forward, on DC motor port M1 of the mBot2 shield
 *
 * It keeps the two encoder motors, the Ultrasonic Sensor 2 (looking forward), the Quad RGB
 * sensor (looking down: it sees the printed grid lines, a real way to count cells) and the
 * CyberPi (gyro, LEDs, screen, buttons, timer).
 *
 * The chassis is 175 mm long and 130 mm wide: inside the 180 x 130 mm limit of the rules.
 *
 * The numbers of the flame sensor and of the fan are ASSUMPTIONS (the organiser has not
 * published a sensor or a fan). They are all here, in one place; the list of every assumption
 * of this game is at the top of ./game.ts.
 */
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { FanConfig, FlameSensorConfig, Pose, RobotConfig } from '../core/types';
import { START_CELL, cellCenter } from './field';

/**
 * The flame sensor. Its value is 0 (no infrared light) .. 100 (the emitter right in front of
 * it); how the value is worked out is written down at flameSignal() in core/engine-sensors.ts:
 *
 *   value = 100 x (1 - distance / range)^2 x (how straight ahead the flame is) x (how much the
 *           flame is turned towards the sensor)
 *
 * With these numbers a flame straight ahead reads about 81 at 100 mm, 49 at 300 mm (one cell),
 * 16 at 600 mm and 0 from 1000 mm on; at 15 degrees to the side it reads half of that, at 30
 * degrees nothing. Behind a wall it always reads 0.
 *
 * "How much the flame is turned towards the sensor" is judged from the point the robot turns
 * around (the middle of its wheel axle), not from the sensor on its nose. So a robot that turns
 * on the spot reads its highest value exactly when it points at the flame - unless the end of a
 * wall hides the flame at that very heading.
 */
export const FLAME_SENSOR: FlameSensorConfig = {
  enabled: true,
  // on the front face of the chassis, beside the ultrasonic sensor
  forward: 105,
  // at the height of the emitter of the target (and below the 150 mm limit of the rules)
  height: 60,
  // it sees 30 degrees to each side
  halfAngleDeg: 30,
  // and up to one metre
  rangeMm: 1000,
  // the value falls with the square of (1 - distance / range): fast near the flame, slowly far away
  distancePower: 2,
  // "a flame is detected" above 10: straight ahead that is up to about 680 mm (two cells)
  threshold: 10,
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
  // ... and at most 300 mm from the fan (ASSUMPTION: about one cell)
  reachMm: 300,
};

export const FIRE_CHIEF_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb },
  ultrasonic: { ...DEFAULT_ROBOT_CONFIG.ultrasonic },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  flameSensor: FLAME_SENSOR,
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
