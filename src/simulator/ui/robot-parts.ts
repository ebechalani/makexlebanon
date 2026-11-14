/**
 * Which parts a robot has, as far as the screen shows them: the Sensors panel lists only the
 * sensors and motors that are really fitted, and the stage draws only those.
 *
 *   Fire Rescue   gripper (two servos), colour sensor at the claw; no fan
 *   Fire Chief    colour sensor fixed to the front, fan on a DC motor port; no gripper, no
 *                 servos, no colour sensor at a claw
 *
 * Every robot has the Quad RGB line sensor, the ultrasonic sensor, the gyro, the timer and the
 * two encoder motors: those are always shown.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import { DC_MOTOR_PORTS, type DcMotorPort, type FanConfig, type RobotConfig, type SensorColor, type SensorSnapshot } from '../core/types';
import { formatNumber } from './format';

/** CSS colours for the colour names a sensor can report (the dot in the Sensors panel, the sight line on the stage). */
export const SENSOR_COLOR_CSS: Record<SensorColor | 'none', string> = {
  black: '#111827',
  white: '#ffffff',
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
  cyan: '#22d3ee',
  blue: '#3b82f6',
  purple: '#a855f7',
  none: 'transparent',
};

/** A colour sensor that is fixed to the front of the robot: where it sits and how far it sees (all mm). */
export interface FrontColourPart {
  /** distance of its face ahead of the drive axle */
  forward: number;
  /** its height above the mat */
  height: number;
  /** it names the colour of a thing that is at most this far from its face */
  rangeMm: number;
}

export interface RobotParts {
  /** the arm and the claw, driven by two servos */
  gripper: boolean;
  /** the colour sensor that looks at what is in the claw */
  clawColour: boolean;
  /** the colour sensor that is fixed to the front of the robot and looks forward, or null when the robot has none */
  frontColour: FrontColourPart | null;
  /** the fan, or null when the robot has none */
  fan: FanConfig | null;
  /** the DC motor ports that are shown: all of them on a robot that uses one, none otherwise */
  dcMotors: DcMotorPort[];
}

export function robotParts(config: RobotConfig): RobotParts {
  const fan = config.fan && config.fan.enabled ? config.fan : null;
  // (a robot has one front colour sensor at most: at the claw, or - with a `mount` - fixed to its front)
  const colour = config.frontColorSensor;
  return {
    gripper: config.gripper.enabled,
    clawColour: colour.enabled && !colour.mount,
    frontColour: colour.enabled && colour.mount ? { forward: colour.mount.forward, height: colour.mount.height, rangeMm: colour.rangeMm } : null,
    fan,
    // (the DC ports are part of every mBot2 shield, but a robot that has nothing on them does
    // not need two rows that always read 0)
    dcMotors: fan ? [...DC_MOTOR_PORTS] : [],
  };
}

/** What sits on a DC motor port of this robot, for the label of its row: "fan", or nothing. */
export function dcMotorUse(parts: RobotParts, port: DcMotorPort): string {
  return parts.fan && parts.fan.port === port ? 'fan' : '';
}

/** How far the colour sensor at the front reads, as students measure everything else on this screen: "1.5 cm". */
export function colourRangeText(part: FrontColourPart): string {
  return `${formatNumber(part.rangeMm / 10, 1)} cm`;
}

/**
 * The sentence under the "Colour sensor" row of the Sensors panel, always to be read (not a
 * hint that needs a mouse): how close a thing must be. Said as what it is - a choice of this
 * simulator, not a fact about the real sensor.
 */
export function colourRangeNote(part: FrontColourPart): string {
  return `In this simulator it reads a colour only from ${colourRangeText(part)} or closer. Further away it reads "none".`;
}

/**
 * When the ultrasonic sensor measures this (cm) or less, something stands right in front of
 * the robot. If the colour sensor reads "none" then, a student wonders why: the robot looks
 * as if it stood at the thing (on the screen 1 cm is two or three dots).
 */
export const NEAR_FOR_COLOUR_CM = 5;

/**
 * True when the closed Sensors panel should say how close the colour sensor must be: the robot
 * has such a sensor, it reads "none", and something is right in front of the robot.
 */
export function colourNeedsCloser(parts: RobotParts, sensors: Pick<SensorSnapshot, 'ultrasonicCm' | 'frontColor'>): boolean {
  return parts.frontColour !== null && sensors.frontColor === 'none' && sensors.ultrasonicCm <= NEAR_FOR_COLOUR_CM;
}

/**
 * The few words on the closed Sensors panel: the line status, the ultrasonic distance, and the
 * readings of the sensors this robot has besides them ("claw empty", "colour red", "fan off").
 *
 * One case is different: the colour sensor at the front reads "none" although something stands
 * right in front of the robot (see colourNeedsCloser). Then the words say how close it must be.
 * The line status makes room for that - the panel is narrow on a phone, and what the robot
 * reads on the floor is not the question in that moment.
 */
export function sensorSummary(parts: RobotParts, sensors: Pick<SensorSnapshot, 'lineStatus' | 'ultrasonicCm' | 'frontColor' | 'fanOn'>): string {
  const closer = parts.frontColour !== null && colourNeedsCloser(parts, sensors);
  const words = closer ? [] : [`line ${sensors.lineStatus}`];
  words.push(`${formatNumber(sensors.ultrasonicCm)} cm`);
  if (parts.clawColour) words.push(`claw ${sensors.frontColor === 'none' ? 'empty' : sensors.frontColor}`);
  // (the word the "colour sensor (1) colour" block gives: a colour name, or "none")
  // ("needs 1.5 cm": the shortest words that say it. Measured in the browser, the whole text is
  // then 246 dots wide, and the closed panel of a phone that is 390 wide has room for 253.)
  if (parts.frontColour) words.push(closer ? `colour none (needs ${colourRangeText(parts.frontColour)})` : `colour ${sensors.frontColor}`);
  if (parts.fan) words.push(`fan ${sensors.fanOn ? 'on' : 'off'}`);
  return words.join(' · ');
}

/**
 * What the "Sensors" button under the mat says when the pointer rests on it: which sensors
 * its view shows on the stage. (A robot with a colour sensor at its front gets the short line
 * of that sensor drawn too: see drawColourSight in ./render.ts.)
 */
export function sensorsViewHint(parts: RobotParts): string {
  return parts.frontColour
    ? `Show what the line sensor and the ultrasonic sensor see, and how far the colour sensor reads (${colourRangeText(parts.frontColour)})`
    : 'Show what the line sensor and the ultrasonic sensor see';
}
