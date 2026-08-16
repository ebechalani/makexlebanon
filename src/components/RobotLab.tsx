'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mat } from '@/lib/lessons';
import type { MblockProgram, SimDevice } from '@/lib/mblock';

/**
 * mBot2 simulator that executes real mBlock programs.
 *
 * Students program in mBlock (embedded IDE tab or desktop), save the .mblock
 * file, and load it here — the parser in src/lib/mblock.ts walks the actual
 * Scratch block graph and drives this time-stepped simulation: continuous RPM
 * motion, blocking cm moves, servo clamp, gyro Z, ultrasonic raycasts and
 * Quad RGB colour probes all answered from the mat geometry.
 *
 * A "starter blocks" workspace (Blockly) remains for the youngest students.
 */

const MAT_CM = 200;
const CANVAS = 480;
const SCALE = CANVAS / MAT_CM;
const ROBOT = 16; // body size, cm
const WHEEL_CIRC = 15.08; // mBot2 wheel circumference, cm
const TRACK = 11.2; // wheel track width, cm
const TIME_SCALE = 2; // simulation runs at 2× real time
const DRIVE_CM_SPEED = 30; // cm/s used for blocking "move X cm" blocks
const MAX_SIM_SECONDS = 120;

/** Zone fill colours -> the colour names students test for in mBlock. */
const COLOR_NAMES: Record<string, string> = {
  '#ffffff': 'white',
  '#facc15': 'yellow',
  '#1d4ed8': 'blue',
  '#2563eb': 'blue',
  '#b91c1c': 'red',
  '#dc2626': 'red',
  '#1e293b': 'black',
  '#334155': 'black',
};

type Pose = { x: number; y: number; heading: number };
type RunState = 'idle' | 'running' | 'success' | 'crashed' | 'stopped' | 'timeout';

type PendingOp =
  | { kind: 'wait'; until: number; resolve: () => void; reject: (e: Error) => void }
  | { kind: 'drive'; remaining: number; sign: 1 | -1; resolve: () => void; reject: (e: Error) => void };

export function RobotLab({
  mat,
  storageKey,
  onSuccess,
  blockLimit,
}: {
  mat: Mat;
  storageKey: string;
  onSuccess?: () => void;
  blockLimit?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<any>(null);
  const blocklyRef = useRef<any>(null);

  const [mode, setMode] = useState<'mblock' | 'blocks'>('mblock');
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<RunState>('idle');
  const [blockCount, setBlockCount] = useState(0);
  const [program, setProgram] = useState<MblockProgram | null>(null);
  const [hatId, setHatId] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string>('');

  /* -------------------------------------------------------- sim world -- */

  const sim = useRef({
    pose: { ...mat.start } as Pose,
    vLin: 0, // cm/s, along heading
    vAng: 0, // deg/s, clockwise positive
    clock: 0, // simulated seconds
    gyroZero: 0,
    timerZero: 0,
    servos: [90, 90, 90, 90],
    clampClosed: false,
    pending: null as PendingOp | null,
    successLatch: false,
    cancelled: false,
    raf: 0,
    lastReal: 0,
  });

  const solidZones = useCallback(() => (mat.zones ?? []).filter((z) => z.solid), [mat]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = sim.current;

    ctx.clearRect(0, 0, CANVAS, CANVAS);
    ctx.fillStyle = '#0b0f14'; // the real mat is black
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    for (const zone of [...(mat.zones ?? []), mat.target]) {
      if (zone.color !== 'transparent') {
        ctx.fillStyle = zone.color;
        ctx.fillRect(zone.x * SCALE, zone.y * SCALE, zone.w * SCALE, zone.h * SCALE);
      }
      if (zone.label) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '600 11px system-ui';
        ctx.fillText(zone.label, zone.x * SCALE + 5, zone.y * SCALE + 15);
      }
    }
    ctx.strokeStyle = '#2cc4ff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(mat.target.x * SCALE, mat.target.y * SCALE, mat.target.w * SCALE, mat.target.h * SCALE);
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let cm = 20; cm < MAT_CM; cm += 20) {
      ctx.beginPath();
      ctx.moveTo(cm * SCALE, 0);
      ctx.lineTo(cm * SCALE, CANVAS);
      ctx.moveTo(0, cm * SCALE);
      ctx.lineTo(CANVAS, cm * SCALE);
      ctx.stroke();
    }

    // Robot
    ctx.save();
    ctx.translate(s.pose.x * SCALE, s.pose.y * SCALE);
    ctx.rotate((s.pose.heading * Math.PI) / 180);
    const r = (ROBOT / 2) * SCALE;
    ctx.fillStyle = '#00a6e8';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r, -r, r * 2, r * 2, 5);
    ctx.fill();
    ctx.stroke();
    // heading arrow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -r + 4);
    ctx.lineTo(-5, 2);
    ctx.lineTo(5, 2);
    ctx.closePath();
    ctx.fill();
    // clamp indicator at the front
    ctx.strokeStyle = s.clampClosed ? '#e4002b' : '#ffffff';
    ctx.lineWidth = 2.5;
    const spread = s.clampClosed ? 3 : 8;
    ctx.beginPath();
    ctx.moveTo(-spread, -r);
    ctx.lineTo(-spread, -r - 6);
    ctx.moveTo(spread, -r);
    ctx.lineTo(spread, -r - 6);
    ctx.stroke();
    ctx.restore();
  }, [mat]);

  const hitsObstacle = useCallback(
    (pose: Pose) => {
      const half = ROBOT / 2;
      for (const zone of solidZones()) {
        if (
          pose.x + half > zone.x &&
          pose.x - half < zone.x + zone.w &&
          pose.y + half > zone.y &&
          pose.y - half < zone.y + zone.h
        )
          return true;
      }
      return pose.x < half || pose.x > MAT_CM - half || pose.y < half || pose.y > MAT_CM - half;
    },
    [solidZones],
  );

  const inTarget = useCallback(
    (pose: Pose) =>
      pose.x >= mat.target.x &&
      pose.x <= mat.target.x + mat.target.w &&
      pose.y >= mat.target.y &&
      pose.y <= mat.target.y + mat.target.h,
    [mat],
  );

  /* ----------------------------------------------------- physics loop -- */

  const stopClock = useCallback(() => {
    cancelAnimationFrame(sim.current.raf);
    sim.current.raf = 0;
  }, []);

  const startClock = useCallback(() => {
    const s = sim.current;
    if (s.raf) return;
    s.lastReal = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - s.lastReal) / 1000, 0.05) * TIME_SCALE;
      s.lastReal = now;
      s.clock += dt;

      // Blocking drive overrides continuous motion.
      let v = s.vLin;
      if (s.pending?.kind === 'drive') v = DRIVE_CM_SPEED * s.pending.sign;

      const rad = (s.pose.heading * Math.PI) / 180;
      s.pose.x += Math.sin(rad) * v * dt;
      s.pose.y -= Math.cos(rad) * v * dt;
      s.pose.heading += s.vAng * dt;

      if (s.pending?.kind === 'drive') {
        s.pending.remaining -= Math.abs(v) * dt;
        if (s.pending.remaining <= 0) {
          const done = s.pending;
          s.pending = null;
          done.resolve();
        }
      } else if (s.pending?.kind === 'wait' && s.clock >= s.pending.until) {
        const done = s.pending;
        s.pending = null;
        done.resolve();
      }

      // A real mission is judged where the robot STOPS — latch success the
      // moment it is stationary inside the target, even mid-program.
      if (
        !s.successLatch &&
        s.vLin === 0 &&
        s.vAng === 0 &&
        (!s.pending || s.pending.kind === 'wait') &&
        inTarget(s.pose)
      ) {
        s.successLatch = true;
      }

      draw();

      if (hitsObstacle(s.pose)) {
        const p = s.pending;
        s.pending = null;
        s.vLin = 0;
        s.vAng = 0;
        stopClock();
        p?.reject(new Error('crash'));
        setState('crashed');
        return;
      }
      if (s.clock - s.timerZero > MAX_SIM_SECONDS) {
        const p = s.pending;
        s.pending = null;
        stopClock();
        p?.reject(new Error('timeout'));
        return;
      }
      s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);
  }, [draw, hitsObstacle, stopClock, inTarget]);

  const makeDevice = useCallback((): SimDevice => {
    const s = sim.current;
    const pend = (
      op: { kind: 'drive'; remaining: number; sign: 1 | -1 } | { kind: 'wait'; until: number },
    ) =>
      new Promise<void>((resolve, reject) => {
        if (s.cancelled) return reject(new Error('cancelled'));
        s.pending = { ...op, resolve, reject } as PendingOp;
        startClock();
      });

    return {
      driveCm: (cm) => pend({ kind: 'drive', remaining: Math.abs(cm), sign: cm >= 0 ? 1 : -1 }),
      setMotion: (dir, rpm) => {
        const v = (Math.abs(rpm) / 60) * WHEEL_CIRC;
        s.vLin = dir === 'forward' ? v : dir === 'backward' ? -v : 0;
        s.vAng = dir === 'turn_right' ? ((2 * v) / TRACK) * (180 / Math.PI) : dir === 'turn_left' ? -((2 * v) / TRACK) * (180 / Math.PI) : 0;
        startClock();
      },
      stopMotion: () => {
        s.vLin = 0;
        s.vAng = 0;
      },
      wait: (seconds) => pend({ kind: 'wait', until: s.clock + Math.max(seconds, 0) }),
      setServo: (port, angle) => {
        if (Number.isFinite(angle)) s.servos[port - 1] = angle;
        // Heuristic clamp state: any servo far from 90° reads as "closed".
        s.clampClosed = s.servos.some((a) => Math.abs(a - 90) > 20);
        draw();
      },
      resetGyro: () => {
        s.gyroZero = s.pose.heading;
      },
      // mBlock convention: turning left is positive Z.
      readGyroZ: () => -(s.pose.heading - s.gyroZero),
      readUltrasonicCm: () => {
        const rad = (s.pose.heading * Math.PI) / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        for (let d = ROBOT / 2; d < MAT_CM * 1.5; d += 1) {
          const px = s.pose.x + dx * d;
          const py = s.pose.y + dy * d;
          if (px < 0 || px > MAT_CM || py < 0 || py > MAT_CM) return d - ROBOT / 2;
          for (const zone of solidZones()) {
            if (px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h) {
              return d - ROBOT / 2;
            }
          }
        }
        return 300;
      },
      readProbeColor: (probe) => {
        // Four probes across the robot's front edge.
        const rad = (s.pose.heading * Math.PI) / 180;
        const fx = Math.sin(rad);
        const fy = -Math.cos(rad);
        const lateral = [-6, -2, 2, 6][Math.min(Math.max(probe - 1, 0), 3)];
        const px = s.pose.x + fx * (ROBOT / 2 + 1) + fy * -lateral;
        const py = s.pose.y + fy * (ROBOT / 2 + 1) + fx * lateral;
        // Later zones draw on top, so scan back-to-front.
        for (const zone of [...(mat.zones ?? [])].reverse()) {
          if (px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h) {
            return COLOR_NAMES[zone.color] ?? 'black';
          }
        }
        return 'black';
      },
      resetTimer: () => {
        s.timerZero = s.clock;
      },
      readTimer: () => s.clock - s.timerZero,
      warn: (message) =>
        setWarnings((w) => (w.includes(message) || w.length > 8 ? w : [...w, message])),
    };
  }, [startClock, draw, solidZones, mat]);

  const resetWorld = useCallback(() => {
    const s = sim.current;
    s.cancelled = true;
    s.pending?.reject(new Error('cancelled'));
    s.pending = null;
    stopClock();
    s.pose = { ...mat.start };
    s.vLin = 0;
    s.vAng = 0;
    s.clock = 0;
    s.timerZero = 0;
    s.gyroZero = 0;
    s.servos = [90, 90, 90, 90];
    s.clampClosed = false;
    s.successLatch = false;
    setState('idle');
    draw();
  }, [mat, draw, stopClock]);

  useEffect(() => {
    resetWorld();
    setWarnings([]);
  }, [mat, resetWorld]);

  /* -------------------------------------------------------- run modes -- */

  const finishRun = useCallback(
    (error?: unknown) => {
      const s = sim.current;
      s.vLin = 0;
      s.vAng = 0;
      stopClock();
      if (s.cancelled) return setState('stopped');
      const message = error instanceof Error ? error.message : '';
      if (message === 'crash') return setState('crashed');
      const success = s.successLatch || inTarget(s.pose);
      if (success) onSuccess?.();
      if (message === 'timeout' || /time limit/i.test(message)) {
        return setState(success ? 'success' : 'timeout');
      }
      if (message && message !== 'cancelled') {
        setWarnings((w) => (w.includes(message) ? w : [...w, message]));
      }
      setState(success ? 'success' : 'idle');
      draw();
    },
    [inTarget, onSuccess, stopClock, draw],
  );

  const runMblock = useCallback(async () => {
    if (!program || !hatId || state === 'running') return;
    resetWorld();
    const s = sim.current;
    s.cancelled = false;
    setWarnings([]);
    setState('running');
    try {
      const { MblockRunner } = await import('@/lib/mblock');
      const runner = new MblockRunner(program, makeDevice(), () => s.cancelled);
      await runner.runHat(hatId);
      finishRun();
    } catch (error) {
      finishRun(error);
    }
  }, [program, hatId, state, resetWorld, makeDevice, finishRun]);

  const onFile = useCallback(async (file: File) => {
    setParseError('');
    setProgram(null);
    try {
      const { parseMblock } = await import('@/lib/mblock');
      const parsed = await parseMblock(await file.arrayBuffer(), file.name);
      if (parsed.hats.length === 0) {
        setParseError('No start block found — add "when button pressed" or "when CyberPi starts up" in mBlock.');
        return;
      }
      setProgram(parsed);
      setHatId(parsed.hats[0].id);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Could not read this file');
    }
  }, []);

  /* --------------------------------------------- starter blocks (Blockly) -- */

  useEffect(() => {
    if (mode !== 'blocks') return;
    let disposed = false;
    (async () => {
      const Blockly = await import('blockly');
      const { javascriptGenerator, Order } = await import('blockly/javascript');
      if (disposed || !hostRef.current) return;
      blocklyRef.current = { Blockly, javascriptGenerator };

      if (!(Blockly.Blocks as any).mbot_forward) {
        Blockly.defineBlocksWithJsonArray([
          { type: 'mbot_forward', message0: 'move forward %1 cm', args0: [{ type: 'input_value', name: 'CM', check: 'Number' }], previousStatement: null, nextStatement: null, colour: '#00a6e8' },
          { type: 'mbot_backward', message0: 'move backward %1 cm', args0: [{ type: 'input_value', name: 'CM', check: 'Number' }], previousStatement: null, nextStatement: null, colour: '#00a6e8' },
          { type: 'mbot_turn_left', message0: 'turn left %1 °', args0: [{ type: 'input_value', name: 'DEG', check: 'Number' }], previousStatement: null, nextStatement: null, colour: '#0084c2' },
          { type: 'mbot_turn_right', message0: 'turn right %1 °', args0: [{ type: 'input_value', name: 'DEG', check: 'Number' }], previousStatement: null, nextStatement: null, colour: '#0084c2' },
        ]);
        const stmt = (fn: string, arg: string) =>
          function (block: any, generator: any) {
            const v = generator.valueToCode(block, arg, Order.NONE) || '0';
            return `await api.${fn}(${v});\n`;
          };
        javascriptGenerator.forBlock['mbot_forward'] = stmt('moveForward', 'CM');
        javascriptGenerator.forBlock['mbot_backward'] = stmt('moveBackward', 'CM');
        javascriptGenerator.forBlock['mbot_turn_left'] = stmt('turnLeft', 'DEG');
        javascriptGenerator.forBlock['mbot_turn_right'] = stmt('turnRight', 'DEG');
      }

      const shadow = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });
      const workspace = Blockly.inject(hostRef.current, {
        media: '/blockly-media/',
        sounds: false,
        trashcan: true,
        zoom: { controls: true, startScale: 0.95 },
        toolbox: {
          kind: 'flyoutToolbox',
          contents: [
            { kind: 'block', type: 'mbot_forward', inputs: { CM: shadow(20) } },
            { kind: 'block', type: 'mbot_backward', inputs: { CM: shadow(20) } },
            { kind: 'block', type: 'mbot_turn_right', inputs: { DEG: shadow(90) } },
            { kind: 'block', type: 'mbot_turn_left', inputs: { DEG: shadow(90) } },
            { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadow(4) } },
          ],
        },
      });
      workspaceRef.current = workspace;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) Blockly.serialization.workspaces.load(JSON.parse(saved), workspace);
      } catch {}
      const persist = () => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
        } catch {}
        setBlockCount(workspace.getAllBlocks(false).filter((b: any) => !b.isShadow()).length);
      };
      workspace.addChangeListener((e: any) => {
        if (!e.isUiEvent) persist();
      });
      persist();
      setReady(true);
    })();
    return () => {
      disposed = true;
      workspaceRef.current?.dispose();
      workspaceRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, mode]);

  const runBlocks = useCallback(async () => {
    const refs = blocklyRef.current;
    const workspace = workspaceRef.current;
    if (!refs || !workspace || state === 'running') return;
    resetWorld();
    const s = sim.current;
    s.cancelled = false;
    setState('running');
    const device = makeDevice();
    const api = {
      moveForward: (cm: number) => device.driveCm(Math.abs(cm)),
      moveBackward: (cm: number) => device.driveCm(-Math.abs(cm)),
      turnLeft: async (deg: number) => {
        const from = s.pose.heading;
        device.setMotion('turn_left', 60);
        while (from - s.pose.heading < Math.abs(deg)) {
          if (s.cancelled) throw new Error('cancelled');
          await device.wait(0.02);
        }
        device.stopMotion();
      },
      turnRight: async (deg: number) => {
        const from = s.pose.heading;
        device.setMotion('turn_right', 60);
        while (s.pose.heading - from < Math.abs(deg)) {
          if (s.cancelled) throw new Error('cancelled');
          await device.wait(0.02);
        }
        device.stopMotion();
      },
    };
    try {
      refs.javascriptGenerator.INFINITE_LOOP_TRAP = null;
      const code = refs.javascriptGenerator.workspaceToCode(workspace);
      const programFn = new Function('api', `return (async () => {\n${code}\n})();`);
      await programFn(api);
      finishRun();
    } catch (error) {
      finishRun(error);
    }
  }, [state, resetWorld, makeDevice, finishRun]);

  /* -------------------------------------------------------------- UI -- */

  const banner: Record<RunState, { text: string; cls: string } | null> = {
    idle: null,
    running: { text: 'Running your program…', cls: 'bg-brand-50 text-brand-700' },
    success: { text: 'Mission complete! The robot reached the target.', cls: 'bg-emerald-50 text-emerald-700' },
    crashed: { text: 'Crash — the robot hit an obstacle or left the mat. Reset and adjust your program.', cls: 'bg-red-50 text-red-700' },
    stopped: { text: 'Stopped.', cls: 'bg-slate-100 text-slate-600' },
    timeout: { text: 'Simulation time limit reached (2 minutes). Loops that wait for a button or Bluetooth never end in the simulator.', cls: 'bg-amber-50 text-amber-700' },
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(
          [
            ['mblock', 'Your mBlock program'],
            ['blocks', 'Starter blocks'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === m ? 'bg-ink-900 text-white' : 'text-ink-600 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {mode === 'mblock' ? (
            <div className="rounded-card p-5 ring-1 ring-slate-200">
              <p className="text-sm leading-relaxed text-ink-600">
                Build your program in mBlock (the <span className="font-semibold">mBlock IDE</span>{' '}
                tab above, or the desktop app), save the <code>.mblock</code> file, then load it
                here — the simulator executes your actual program.
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-slate-300 hover:bg-slate-50">
                Load .mblock file
                <input
                  type="file"
                  accept=".mblock"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </label>

              {parseError ? (
                <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{parseError}</p>
              ) : null}

              {program ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-ink-800">
                    {program.fileName}
                    <span className="ml-2 font-normal text-ink-500">
                      {Object.keys(program.blocks).length} blocks
                    </span>
                  </p>
                  <label className="block text-sm text-ink-600">
                    Start from:
                    <select
                      value={hatId}
                      onChange={(e) => setHatId(e.target.value)}
                      className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      {program.hats.map((hat) => (
                        <option key={hat.id} value={hat.id}>
                          {hat.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : (
            <div ref={hostRef} className="h-96 w-full overflow-hidden rounded-card ring-1 ring-slate-200" />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={mode === 'mblock' ? runMblock : runBlocks}
              disabled={state === 'running' || (mode === 'mblock' ? !program : !ready)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              ▶ Run program
            </button>
            <button
              type="button"
              onClick={resetWorld}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Reset
            </button>
            {mode === 'blocks' ? (
              <span className="text-sm text-ink-500">
                {blockCount} block{blockCount === 1 ? '' : 's'}
                {blockLimit ? ` · challenge limit ${blockLimit}` : ''}
              </span>
            ) : null}
          </div>

          {banner[state] ? (
            <p role="status" className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${banner[state]!.cls}`}>
              {banner[state]!.text}
            </p>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {warnings.map((w) => (
                <li key={w} className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={CANVAS}
            height={CANVAS}
            className="h-auto w-full max-w-120 rounded-card ring-1 ring-slate-200 xl:w-120"
            aria-label="Robot simulator mat"
          />
          <p className="mt-2 text-xs text-ink-500">
            Each grid square is 20 cm. Dashed outline = target. Front pins show the clamp
            (white open, red closed). Simulation runs at {TIME_SCALE}× speed.
          </p>
        </div>
      </div>
    </div>
  );
}
