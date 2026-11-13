/**
 * Which parts a robot has, as far as the screen shows them: the Sensors panel lists only the
 * sensors and motors that are really fitted, and the stage draws only those.
 *
 *   Fire Rescue   gripper (two servos), colour sensor at the claw; no fan, no flame sensor
 *   Fire Chief    flame sensor, fan on a DC motor port; no gripper, no servos, no colour sensor
 *
 * Every robot has the Quad RGB line sensor, the ultrasonic sensor, the gyro, the timer and the
 * two encoder motors: those are always shown.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import { DC_MOTOR_PORTS, type DcMotorPort, type FanConfig, type FlameSensorConfig, type RobotConfig, type SensorSnapshot } from '../core/types';
import { formatNumber } from './format';

export interface RobotParts {
  /** the arm and the claw, driven by two servos */
  gripper: boolean;
  /** the colour sensor that looks at what is in the claw */
  clawColour: boolean;
  /** the flame sensor, or null when the robot has none */
  flameSensor: FlameSensorConfig | null;
  /** the fan, or null when the robot has none */
  fan: FanConfig | null;
  /** the DC motor ports that are shown: all of them on a robot that uses one, none otherwise */
  dcMotors: DcMotorPort[];
}

export function robotParts(config: RobotConfig): RobotParts {
  const fan = config.fan && config.fan.enabled ? config.fan : null;
  return {
    gripper: config.gripper.enabled,
    clawColour: config.frontColorSensor.enabled,
    flameSensor: config.flameSensor && config.flameSensor.enabled ? config.flameSensor : null,
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
 * reading of the sensor this robot has besides them ("claw empty", "flame 12").
 */
export function sensorSummary(parts: RobotParts, sensors: Pick<SensorSnapshot, 'lineStatus' | 'ultrasonicCm' | 'frontColor' | 'flame' | 'fanOn'>): string {
  const words = [`line ${sensors.lineStatus}`, `${formatNumber(sensors.ultrasonicCm)} cm`];
  if (parts.clawColour) words.push(`claw ${sensors.frontColor === 'none' ? 'empty' : sensors.frontColor}`);
  if (parts.flameSensor) words.push(`flame ${formatNumber(sensors.flame)}`);
  if (parts.fan) words.push(`fan ${sensors.fanOn ? 'on' : 'off'}`);
  return words.join(' · ');
}

/**
 * What the "Sensors" button of the stage says it shows. Every robot has the line sensor and the
 * ultrasonic sensor; a robot with a flame sensor shows what that one sees too.
 */
export function sensorsViewHint(parts: RobotParts): string {
  return parts.flameSensor
    ? 'Show what the line sensor, the ultrasonic sensor and the flame sensor see'
    : 'Show what the line sensor and the ultrasonic sensor see';
}
