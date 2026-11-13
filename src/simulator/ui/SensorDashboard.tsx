'use client';

/**
 * Live values of everything the robot can measure, as the blocks would report them:
 * the four probes of the Quad RGB line sensor, the ultrasonic distance, the gyro, the wheel
 * encoders, the timer and the student's own variables - and the parts only some robots have
 * (./robot-parts.ts): the colour in the claw and the two servos of the gripper, or the flame
 * sensor, the DC motor ports and the fan.
 */
import { PROBE_NAMES, type ProbeName, type ProbeReading, type RobotConfig, type Scalar, type SensorColor } from '../core/types';
import { formatNumber, rgbCss } from './format';
import { dcMotorUse, robotParts } from './robot-parts';
import type { UiSnapshot } from './useSimulation';

/** CSS colours for the colour names a sensor can report. */
const SENSOR_COLOR_CSS: Record<SensorColor | 'none', string> = {
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

const PROBE_HINT: Record<ProbeName, string> = {
  L2: 'far left',
  L1: 'left',
  R1: 'right',
  R2: 'far right',
};

function ProbeCard({ name, reading }: { name: ProbeName; reading: ProbeReading }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2" title={`Probe ${name} (${PROBE_HINT[name]})`}>
      <span className="text-xs font-bold text-ink-700">{name}</span>
      <span
        className="h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-slate-300"
        style={{ background: rgbCss(reading.rgb) }}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold capitalize text-ink-800">{reading.color}</span>
      <span
        className={
          'rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ' +
          (reading.onLine ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-300')
        }
      >
        {reading.onLine ? 'line' : 'background'}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-500" title="reflected light, 0 (black) to 100 (white)">
        light {formatNumber(reading.light)}
      </span>
    </div>
  );
}

function Value({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1" title={hint}>
      <dt className="truncate text-xs text-ink-500">{label}</dt>
      <dd className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink-900">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-ink-500">{unit}</span>}
      </dd>
    </div>
  );
}

function showScalar(value: Scalar): string {
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value === '' ? '""' : value;
}

export interface SensorDashboardProps {
  snapshot: UiSnapshot;
  robotConfig: RobotConfig;
}

export function SensorDashboard({ snapshot, robotConfig }: SensorDashboardProps) {
  const s = snapshot.sensors;
  const status = s.lineStatus & 15;
  const bits = status.toString(2).padStart(4, '0');
  const sees = s.ultrasonicCm < robotConfig.ultrasonic.maxRangeCm - 1e-6;
  const variables = Object.entries(snapshot.variables);
  const g = robotConfig.gripper;
  const parts = robotParts(robotConfig);
  const flame = parts.flameSensor;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">Quad RGB line sensor</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PROBE_NAMES.map((name) => (
            <ProbeCard key={name} name={name} reading={s.probes[name]} />
          ))}
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4">
          <Value
            label="Line status"
            value={`${status}`}
            unit={`(${bits})`}
            hint="One digit per probe, L2 L1 R1 R2: 1 = on the line. Example: 0110 = 6 means the two middle probes see the line."
          />
          <Value label="Deviation" value={formatNumber(s.lineOffset)} hint="-100 = the robot is far to the left of the line, 0 = centred, 100 = far to the right of the line (as on the real mBot2)" />
        </dl>
      </div>

      <dl className="grid grid-cols-2 gap-x-4">
        {flame && (
          <div
            // (over the full width: the value and the "flame detected" label need more room than half a row)
            className="col-span-2 flex items-center justify-between gap-2 border-b border-slate-100 py-1"
            title={`Infrared light the flame sensor sees, 0 (none) to 100 (very strong). "Flame detected" above ${formatNumber(flame.threshold)}.`}
          >
            <dt className="truncate text-xs text-ink-500">Flame sensor</dt>
            <dd className="flex shrink-0 items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-ink-900">
              {formatNumber(s.flame, 1)}
              <span
                className={
                  'rounded px-1.5 py-0.5 font-sans text-[11px] font-bold leading-none ' +
                  (s.flameDetected ? 'bg-orange-600 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-300')
                }
              >
                {s.flameDetected ? 'flame detected' : 'no flame'}
              </span>
            </dd>
          </div>
        )}
        <Value
          label="Ultrasonic"
          value={sees ? formatNumber(s.ultrasonicCm, 1) : `${formatNumber(robotConfig.ultrasonic.maxRangeCm)}`}
          unit={sees ? 'cm' : 'cm (nothing seen)'}
        />
        {parts.clawColour && (
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
            <dt className="text-xs text-ink-500">Claw colour</dt>
            <dd className="flex items-center gap-1.5 text-sm font-semibold capitalize text-ink-900">
              {s.frontColor !== 'none' && (
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-400" style={{ background: SENSOR_COLOR_CSS[s.frontColor] }} aria-hidden="true" />
              )}
              {s.frontColor === 'none' ? 'nothing' : s.frontColor}
            </dd>
          </div>
        )}
        <Value label="Yaw (turned)" value={formatNumber(s.yawDeg, 1)} unit="°" hint="How far the robot has turned since the gyro was reset; clockwise is positive" />
        <Value label="Timer" value={formatNumber(s.timer, 1)} unit="s" />
        <Value
          label="EM1 angle (left)"
          value={formatNumber(s.leftAngleDeg)}
          unit="°"
          hint="Encoder of motor EM1, the left wheel"
        />
        <Value
          label="EM2 angle (right)"
          value={formatNumber(-s.rightAngleDeg)}
          unit="°"
          hint="Encoder of motor EM2, the right wheel. It is mounted mirrored, so it counts backwards when the robot drives forward - just like on the real mBot2."
        />
        <Value label="EM1 speed" value={formatNumber(s.leftRpm)} unit="RPM" />
        <Value label="EM2 speed" value={formatNumber(-s.rightRpm)} unit="RPM" hint="Negative while the robot drives forward (mirrored motor)" />
        {parts.gripper && (
          <>
            <Value label={`Arm (${g.liftServo})`} value={formatNumber(snapshot.servos[g.liftServo])} unit="°" hint={`Claw is ${formatNumber(snapshot.gripper.height)} mm above the mat`} />
            <Value label={`Claw (${g.clawServo})`} value={formatNumber(snapshot.servos[g.clawServo])} unit="°" hint={`Opening: ${formatNumber(snapshot.gripper.gap)} mm`} />
          </>
        )}
        {parts.dcMotors.map((port) => {
          const use = dcMotorUse(parts, port);
          return (
            <Value
              key={port}
              label={use ? `DC motor ${port} (${use})` : `DC motor ${port}`}
              value={formatNumber(s.dcMotorPower[port])}
              unit="%"
              hint={`Power of DC motor port ${port}, -100 to 100 %${use ? '' : '. Nothing is connected to this port on this robot.'}`}
            />
          );
        })}
        {parts.fan && (
          <div
            className="flex items-center justify-between gap-2 border-b border-slate-100 py-1"
            title={`The fan blows while DC motor ${parts.fan.port} runs at ${formatNumber(parts.fan.minPower)} % power or more, forwards or backwards.`}
          >
            <dt className="text-xs text-ink-500">Fan</dt>
            <dd>
              <span
                className={
                  'rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ' + (s.fanOn ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-300')
                }
              >
                {s.fanOn ? 'fan on' : 'fan off'}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">Variables</p>
        {variables.length === 0 ? (
          <p className="text-xs text-ink-500">Your program has no variables yet.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {variables.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1">
                <dt className="truncate text-xs font-semibold text-orange-700">{name}</dt>
                <dd className="min-w-0 truncate font-mono text-sm font-semibold tabular-nums text-ink-900">
                  {Array.isArray(value) ? `[${value.map(showScalar).join(', ')}]` : showScalar(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
