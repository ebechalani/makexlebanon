'use client';

/**
 * Live values of everything the robot can measure, as the blocks would report them:
 * the four probes of the Quad RGB line sensor, the ultrasonic distance, the gyro, the wheel
 * encoders, the timer and the student's own variables - and the parts only some robots have
 * (./robot-parts.ts): the colour in the claw and the two servos of the gripper, or the colour
 * sensor at the front, the DC motor ports and the fan.
 */
import { PROBE_NAMES, type ProbeName, type ProbeReading, type RobotConfig, type Scalar } from '../core/types';
import { rgbCss } from './format';
import { robotParts, SENSOR_COLOR_CSS } from './robot-parts';
import { useScreenText } from './text/context';
import type { ScreenText } from './text/types';
import type { UiSnapshot } from './useSimulation';

function ProbeCard({ name, reading }: { name: ProbeName; reading: ProbeReading }) {
  const text = useScreenText();
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2" title={text.probeTitle(name, text.probeHint[name])}>
      <span className="text-xs font-bold text-ink-700">{name}</span>
      <span
        className="h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-slate-300"
        style={{ background: rgbCss(reading.rgb) }}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold capitalize text-ink-800">{text.sensorColour(reading.color)}</span>
      <span
        className={
          'rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ' +
          (reading.onLine ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-300')
        }
      >
        {reading.onLine ? text.probeOnLine : text.probeBackground}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-500" title={text.lightHint}>
        {text.probeLight(text.number(reading.light))}
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

/** A value of the program as the Variables list shows it: as the program holds it, a number as the screen writes numbers. */
function showScalar(value: Scalar, text: ScreenText): string {
  if (typeof value === 'number') return text.number(value, Number.isInteger(value) ? 0 : 2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value === '' ? '""' : value;
}

export interface SensorDashboardProps {
  snapshot: UiSnapshot;
  robotConfig: RobotConfig;
}

export function SensorDashboard({ snapshot, robotConfig }: SensorDashboardProps) {
  const text = useScreenText();
  const s = snapshot.sensors;
  const status = s.lineStatus & 15;
  const bits = status.toString(2).padStart(4, '0');
  const sees = s.ultrasonicCm < robotConfig.ultrasonic.maxRangeCm - 1e-6;
  const variables = Object.entries(snapshot.variables);
  const g = robotConfig.gripper;
  const parts = robotParts(robotConfig);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">{text.quadRgb}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PROBE_NAMES.map((name) => (
            <ProbeCard key={name} name={name} reading={s.probes[name]} />
          ))}
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4">
          <Value
            label={text.lineStatus}
            value={`${status}`}
            unit={`(${bits})`}
            hint={text.lineStatusHint}
          />
          <Value label={text.deviation} value={text.number(s.lineOffset)} hint={text.deviationHint} />
        </dl>
      </div>

      {/* The colour sensor at the front (a robot that has one) gets a row of the full width, with a
          sentence under it that is always to be read: how close a thing must be. Without it a
          student sees "none" while the robot stands right in front of the target, and cannot
          know why - a hint that needs a mouse is no help on a tablet. */}
      {parts.frontColour && (
        <dl>
          <div
            className="flex flex-wrap items-center justify-between gap-x-2 border-b border-slate-100 py-1"
            title={text.frontColourHint(text.number(parts.frontColour.rangeMm))}
          >
            <dt className="text-xs text-ink-500">{text.colourSensor}</dt>
            {/* (the words are the ones the "colour sensor (1) colour" block gives: a colour name, or "none") */}
            <dd className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              {s.frontColor !== 'none' && (
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-400" style={{ background: SENSOR_COLOR_CSS[s.frontColor] }} aria-hidden="true" />
              )}
              {text.sensorColour(s.frontColor)}
            </dd>
            <dd className="basis-full text-[11px] leading-snug text-ink-500" data-colour-range>
              {text.colourRangeNote(parts.frontColour)}
            </dd>
          </div>
        </dl>
      )}

      <dl className="grid grid-cols-2 gap-x-4">
        <Value
          label={text.ultrasonic}
          value={sees ? text.number(s.ultrasonicCm, 1) : `${text.number(robotConfig.ultrasonic.maxRangeCm)}`}
          unit={sees ? 'cm' : text.ultrasonicNothing}
        />
        {parts.clawColour && (
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
            <dt className="text-xs text-ink-500">{text.clawColour}</dt>
            <dd className="flex items-center gap-1.5 text-sm font-semibold capitalize text-ink-900">
              {s.frontColor !== 'none' && (
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-400" style={{ background: SENSOR_COLOR_CSS[s.frontColor] }} aria-hidden="true" />
              )}
              {text.clawReading(s.frontColor)}
            </dd>
          </div>
        )}
        <Value label={text.yaw} value={text.number(s.yawDeg, 1)} unit="°" hint={text.yawHint} />
        <Value label={text.timer} value={text.number(s.timer, 1)} unit="s" />
        <Value
          label={text.em1Angle}
          value={text.number(s.leftAngleDeg)}
          unit="°"
          hint={text.em1AngleHint}
        />
        <Value
          label={text.em2Angle}
          value={text.number(-s.rightAngleDeg)}
          unit="°"
          hint={text.em2AngleHint}
        />
        <Value label={text.em1Speed} value={text.number(s.leftRpm)} unit={text.rpm} />
        <Value label={text.em2Speed} value={text.number(-s.rightRpm)} unit={text.rpm} hint={text.em2SpeedHint} />
        {parts.gripper && (
          <>
            <Value label={text.armLabel(g.liftServo)} value={text.number(snapshot.servos[g.liftServo])} unit="°" hint={text.armHint(text.number(snapshot.gripper.height))} />
            <Value label={text.clawLabel(g.clawServo)} value={text.number(snapshot.servos[g.clawServo])} unit="°" hint={text.clawHint(text.number(snapshot.gripper.gap))} />
          </>
        )}
        {parts.dcMotors.map((port) => {
          const use = text.dcMotorUse(parts, port);
          return (
            <Value
              key={port}
              label={text.dcMotorLabel(port, use)}
              value={text.number(s.dcMotorPower[port])}
              unit="%"
              hint={text.dcMotorHint(port, use)}
            />
          );
        })}
        {parts.fan && (
          <div
            className="flex items-center justify-between gap-2 border-b border-slate-100 py-1"
            title={text.fanHint(parts.fan.port, text.number(parts.fan.minPower))}
          >
            <dt className="text-xs text-ink-500">{text.fan}</dt>
            <dd>
              <span
                className={
                  'rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ' + (s.fanOn ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-300')
                }
              >
                {text.fanState(s.fanOn)}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">{text.variablesTitle}</p>
        {variables.length === 0 ? (
          <p className="text-xs text-ink-500">{text.noVariables}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {variables.map(([name, value]) => (
              <div key={name} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1">
                <dt className="truncate text-xs font-semibold text-orange-700">{text.variableName(name)}</dt>
                <dd className="min-w-0 truncate font-mono text-sm font-semibold tabular-nums text-ink-900">
                  {Array.isArray(value) ? `[${value.map((item) => showScalar(item, text)).join(', ')}]` : showScalar(value, text)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
