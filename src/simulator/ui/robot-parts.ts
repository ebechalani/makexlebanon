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
import { DC_MOTOR_PORTS, type DcMotorPort, type FanConfig, type RobotConfig, type SensorSnapshot } from '../core/types';
import { formatNumber } from './format';

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

/**
 * The few words on the closed Sensors panel: the line status, the ultrasonic distance, and the
 * readings of the sensors this robot has besides them ("claw empty", "colour red", "fan off").
 */
export function sensorSummary(parts: RobotParts, sensors: Pick<SensorSnapshot, 'lineStatus' | 'ultrasonicCm' | 'frontColor' | 'fanOn'>): string {
  const words = [`line ${sensors.lineStatus}`, `${formatNumber(sensors.ultrasonicCm)} cm`];
  if (parts.clawColour) words.push(`claw ${sensors.frontColor === 'none' ? 'empty' : sensors.frontColor}`);
  // (the word the "colour sensor (1) colour" block gives: a colour name, or "none")
  if (parts.frontColour) words.push(`colour ${sensors.frontColor}`);
  if (parts.fan) words.push(`fan ${sensors.fanOn ? 'on' : 'off'}`);
  return words.join(' · ');
}
