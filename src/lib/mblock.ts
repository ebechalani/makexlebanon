/**
 * .mblock project parser and interpreter.
 *
 * An .mblock file is a zip whose project.json holds Scratch-3-format block
 * graphs per target. The CyberPi/mBot2 target carries the robot program. This
 * module parses that graph and executes it against a SimDevice — the browser
 * simulator implements SimDevice by animating the robot on the mat and
 * answering sensor reads from the mat geometry.
 *
 * Supported: movement (straight cm/inch, continuous RPM drive, stop), servo,
 * gyro Z reset/read, ultrasonic distance, Quad RGB colour probes, timer,
 * control flow (wait, repeat, repeat-until, forever, if, if/else), operators,
 * variables, and custom procedures with arguments. Anything else becomes a
 * recorded warning and a no-op, so a program never fails to run outright.
 */

import JSZip from 'jszip';

/* ------------------------------------------------------------------ types -- */

type ScratchBlock = {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, unknown[]>;
  fields: Record<string, [string, unknown]>;
  shadow?: boolean;
  topLevel?: boolean;
  mutation?: { proccode?: string; argumentids?: string; argumentnames?: string };
};

export type MblockHat = { id: string; opcode: string; label: string };

export type MblockProgram = {
  fileName: string;
  blocks: Record<string, ScratchBlock>;
  hats: MblockHat[];
  variables: Record<string, number | string>;
  opcodesUsed: string[];
};

/** What the simulator must provide for the program to act on. */
export interface SimDevice {
  /** Blocking straight drive, distance in cm (negative = backward). */
  driveCm(cm: number): Promise<void>;
  /** Set continuous motion. dir: forward|backward|turn_left|turn_right. */
  setMotion(dir: string, rpm: number): void;
  stopMotion(): void;
  /** Advance simulated time while motion continues. */
  wait(seconds: number): Promise<void>;
  setServo(port: number, angle: number): void;
  resetGyro(): void;
  readGyroZ(): number;
  /** Distance to the nearest obstacle straight ahead, cm. */
  readUltrasonicCm(): number;
  /** Colour name under probe 1..4 ('white' when on the bare mat). */
  readProbeColor(probe: number): string;
  resetTimer(): void;
  readTimer(): number;
  warn(message: string): void;
}

/* ---------------------------------------------------------------- parsing -- */

const HAT_LABELS: Record<string, string> = {
  'cyberpi.cyberpi_when_launch': 'when CyberPi starts up',
  'cyberpi.cyberpi_when_button_press': 'when button pressed',
  'cyberpi.cyberpi_when_joystick_pulled_1': 'when joystick moved',
  event_whenflagclicked: 'when green flag clicked',
};

export async function parseMblock(data: ArrayBuffer, fileName: string): Promise<MblockProgram> {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file('project.json');
  if (!entry) throw new Error('Not an mBlock project: project.json missing');
  const project = JSON.parse(await entry.async('string'));

  // The robot program lives on the device target (has mbot2/cyberpi blocks);
  // fall back to the target with the most blocks.
  const targets: any[] = project.targets ?? [];
  const scored = targets
    .map((t) => ({
      t,
      score: Object.values(t.blocks ?? {}).filter(
        (b: any) => b?.opcode && /^(mbot2|cyberpi|mbuild)/.test(b.opcode),
      ).length,
      size: Object.keys(t.blocks ?? {}).length,
    }))
    .sort((a, b) => b.score - a.score || b.size - a.size);
  const target = scored[0]?.t;
  if (!target) throw new Error('No programmable target found in this project');

  const blocks: Record<string, ScratchBlock> = target.blocks ?? {};

  const hats: MblockHat[] = Object.entries(blocks)
    .filter(([, b]) => b.topLevel && !b.shadow && (b.opcode in HAT_LABELS))
    .map(([id, b]) => {
      let label = HAT_LABELS[b.opcode];
      const buttonField = b.fields?.fieldMenu_2?.[0];
      if (b.opcode === 'cyberpi.cyberpi_when_button_press' && buttonField) {
        label = `when button ${String(buttonField).toUpperCase()} pressed`;
      }
      return { id, opcode: b.opcode, label };
    });

  const variables: Record<string, number | string> = {};
  for (const [, def] of Object.entries<any>(target.variables ?? {})) {
    variables[def[0]] = def[1];
  }

  const opcodesUsed = [
    ...new Set(Object.values(blocks).map((b) => b.opcode).filter(Boolean)),
  ].sort();

  return { fileName, blocks, hats, variables, opcodesUsed };
}

/* ------------------------------------------------------------ interpreter -- */

const MAX_SIM_SECONDS = 120;
const MAX_STEPS = 20000;

export class MblockRunner {
  private steps = 0;
  private vars: Record<string, number | string>;
  private args: Record<string, unknown> = {};

  constructor(
    private program: MblockProgram,
    private device: SimDevice,
    private cancelled: () => boolean,
  ) {
    this.vars = { ...program.variables };
  }

  async runHat(hatId: string): Promise<void> {
    const hat = this.program.blocks[hatId];
    if (!hat) throw new Error('Program start block not found');
    try {
      await this.runChain(hat.next);
    } catch (error) {
      // "stop this script" ends the program cleanly, like on the robot.
      if (!(error instanceof Error && error.message === '__script_stop__')) throw error;
    }
    this.device.stopMotion();
  }

  private guard() {
    if (this.cancelled()) throw new Error('cancelled');
    if (++this.steps > MAX_STEPS) throw new Error('Program stopped: too many steps (runaway loop?)');
  }

  private async runChain(id: string | null | undefined): Promise<void> {
    let current = id ?? null;
    while (current) {
      this.guard();
      const block = this.program.blocks[current];
      if (!block) return;
      await this.exec(block);
      current = block.next;
    }
  }

  /** Resolve an input slot to a value (literal, variable, or reporter). */
  private async input(block: ScratchBlock, name: string): Promise<unknown> {
    const slot = block.inputs?.[name];
    if (!slot) return 0;
    const ref = slot[1];
    if (Array.isArray(ref)) {
      // Literal: [type, value] — 12 = variable reference
      if (ref[0] === 12) return this.vars[String(ref[1])] ?? 0;
      return ref[1];
    }
    if (typeof ref === 'string') return this.report(this.program.blocks[ref]);
    return 0;
  }

  private async num(block: ScratchBlock, name: string): Promise<number> {
    const v = await this.input(block, name);
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private substack(block: ScratchBlock, name: string): string | null {
    const slot = block.inputs?.[name];
    return slot && typeof slot[1] === 'string' ? (slot[1] as string) : null;
  }

  private field(block: ScratchBlock, name: string): string {
    return String(block.fields?.[name]?.[0] ?? '');
  }

  /** Evaluate a reporter (boolean/number/string) block. */
  private async report(block: ScratchBlock | undefined): Promise<unknown> {
    if (!block) return 0;
    this.guard();
    const op = block.opcode;
    const d = this.device;

    switch (op) {
      case 'operator_add': return (await this.num(block, 'NUM1')) + (await this.num(block, 'NUM2'));
      case 'operator_subtract': return (await this.num(block, 'NUM1')) - (await this.num(block, 'NUM2'));
      case 'operator_multiply': return (await this.num(block, 'NUM1')) * (await this.num(block, 'NUM2'));
      case 'operator_divide': {
        const b = await this.num(block, 'NUM2');
        return b === 0 ? 0 : (await this.num(block, 'NUM1')) / b;
      }
      case 'operator_gt': return (await this.num(block, 'OPERAND1')) > (await this.num(block, 'OPERAND2'));
      case 'operator_lt': return (await this.num(block, 'OPERAND1')) < (await this.num(block, 'OPERAND2'));
      case 'operator_equals': {
        const a = await this.input(block, 'OPERAND1');
        const b = await this.input(block, 'OPERAND2');
        return String(a) === String(b);
      }
      case 'operator_and': {
        const a = block.inputs?.OPERAND1?.[1];
        const b = block.inputs?.OPERAND2?.[1];
        return (
          Boolean(typeof a === 'string' && (await this.report(this.program.blocks[a]))) &&
          Boolean(typeof b === 'string' && (await this.report(this.program.blocks[b])))
        );
      }
      case 'operator_or': {
        const a = block.inputs?.OPERAND1?.[1];
        const b = block.inputs?.OPERAND2?.[1];
        return (
          Boolean(typeof a === 'string' && (await this.report(this.program.blocks[a]))) ||
          Boolean(typeof b === 'string' && (await this.report(this.program.blocks[b])))
        );
      }
      case 'operator_not': {
        const a = block.inputs?.OPERAND?.[1];
        return !(typeof a === 'string' && (await this.report(this.program.blocks[a])));
      }
      case 'data_variable': return this.vars[this.field(block, 'VARIABLE')] ?? 0;
      case 'argument_reporter_string_number':
      case 'argument_reporter_boolean':
        return this.args[this.field(block, 'VALUE')] ?? 0;

      case 'cyberpi.cyberpi_axis_rotation_angle': return d.readGyroZ();
      case 'cyberpi.cyberpi_timer_get': return d.readTimer();
      case 'cyberpi_mbuild_ultrasonic2.mbuild_ultrasonic2_get_distance': return d.readUltrasonicCm();

      // "probe N sees colour C?" — field inputMenu_1 = colour, menu input = probe.
      case 'mbuild_quad_color_sensor.BLOCK_1618364921511': {
        const color = this.field(block, 'inputMenu_1') || 'white';
        const probe = Number(await this.menuValue(block, 'inputMenu_2')) || 1;
        return d.readProbeColor(probe) === color;
      }
      case 'mbuild_quad_color_sensor.mbuild_quad_color_sensor_is_line_and_background': {
        // Treated as: probe sees anything that is not the white background.
        const probe = Number(await this.menuValue(block, 'inputMenu_2')) || 1;
        return d.readProbeColor(probe) !== 'white';
      }

      default:
        if (/firefly_bluetoothcontroller/.test(op)) {
          this.device.warn('Bluetooth controller blocks cannot run in the simulator');
          return false;
        }
        this.device.warn(`Unsupported block ignored: ${op}`);
        return 0;
    }
  }

  /** Menu shadows report their sole field value. */
  private async menuValue(block: ScratchBlock, inputName: string): Promise<string> {
    const slot = block.inputs?.[inputName];
    const ref = slot?.[1];
    if (typeof ref !== 'string') return '';
    const menu = this.program.blocks[ref];
    const firstField = menu && Object.values(menu.fields ?? {})[0];
    return firstField ? String(firstField[0]) : '';
  }

  private async exec(block: ScratchBlock): Promise<void> {
    const op = block.opcode;
    const d = this.device;

    switch (op) {
      /* ------------------------------------------------------- movement -- */
      case 'mbot2.mbot2_move_straight_with_cm_and_inch': {
        const raw = await this.num(block, 'POWER');
        const unit = this.field(block, 'fieldMenu_3');
        const cm = unit === 'inch' ? raw * 2.54 : raw;
        const dir = this.field(block, 'DIRECTION');
        await d.driveCm(dir === 'backward' ? -cm : cm);
        return;
      }
      case 'mbot2.mbot2_move_direction_with_rpm':
        d.setMotion(this.field(block, 'DIRECTION'), await this.num(block, 'POWER'));
        return;
      case 'mbot2.mbot2_encoder_motor_stop':
        d.stopMotion();
        return;
      case 'mbot2.mbot2_servo_driver': {
        // Angles for servo ports S1..S4 in number_1..number_4.
        for (let i = 1; i <= 4; i++) d.setServo(i, await this.num(block, `number_${i}`));
        return;
      }
      case 'mbot2.mbot2_servo_add_angle': {
        const port = Number(await this.menuValue(block, 'fieldMenu_1')) || 1;
        d.setServo(port, Number.NaN); // relative moves shown as activity only
        d.warn('Servo "add angle" shown as clamp activity (relative angles not tracked)');
        return;
      }

      /* -------------------------------------------------------- sensors -- */
      case 'cyberpi.cyberpi_reset_axis_rotation_angle': d.resetGyro(); return;
      case 'cyberpi.cyberpi_timer_reset': d.resetTimer(); return;

      /* --------------------------------------------------------- control -- */
      case 'control_wait': await d.wait(await this.num(block, 'DURATION')); return;
      case 'control_wait_until': {
        const cond = block.inputs?.CONDITION?.[1];
        while (true) {
          this.guard();
          const met =
            typeof cond === 'string'
              ? Boolean(await this.report(this.program.blocks[cond]))
              : true;
          if (met) return;
          await d.wait(0.02); // keep sim time (and the robot) moving while polling
          if (d.readTimer() > MAX_SIM_SECONDS) throw new Error('Simulation time limit reached');
        }
      }
      case 'control_stop':
        throw new Error('__script_stop__');
      case 'control_repeat': {
        const times = Math.min(await this.num(block, 'TIMES'), 1000);
        for (let i = 0; i < times; i++) {
          this.guard();
          await this.runChain(this.substack(block, 'SUBSTACK'));
        }
        return;
      }
      case 'control_repeat_until': {
        const cond = block.inputs?.CONDITION?.[1];
        while (true) {
          this.guard();
          const met =
            typeof cond === 'string'
              ? Boolean(await this.report(this.program.blocks[cond]))
              : true;
          if (met) return;
          await this.runChain(this.substack(block, 'SUBSTACK'));
          await d.wait(0.02); // sensor loops poll; let sim time advance
          if (d.readTimer() > MAX_SIM_SECONDS) throw new Error('Simulation time limit reached');
        }
      }
      case 'control_forever': {
        while (true) {
          this.guard();
          await this.runChain(this.substack(block, 'SUBSTACK'));
          await d.wait(0.02);
          if (d.readTimer() > MAX_SIM_SECONDS) throw new Error('Simulation time limit reached');
        }
      }
      case 'control_if': {
        const cond = block.inputs?.CONDITION?.[1];
        if (typeof cond === 'string' && (await this.report(this.program.blocks[cond]))) {
          await this.runChain(this.substack(block, 'SUBSTACK'));
        }
        return;
      }
      case 'control_if_else': {
        const cond = block.inputs?.CONDITION?.[1];
        const hit = typeof cond === 'string' && (await this.report(this.program.blocks[cond]));
        await this.runChain(this.substack(block, hit ? 'SUBSTACK' : 'SUBSTACK2'));
        return;
      }

      /* ------------------------------------------------------ variables -- */
      case 'data_setvariableto':
        this.vars[this.field(block, 'VARIABLE')] = (await this.input(block, 'VALUE')) as any;
        return;
      case 'data_changevariableby': {
        const name = this.field(block, 'VARIABLE');
        this.vars[name] = Number(this.vars[name] ?? 0) + (await this.num(block, 'VALUE'));
        return;
      }

      /* ----------------------------------------------------- procedures -- */
      case 'procedures_call': {
        const proccode = block.mutation?.proccode;
        const def = Object.values(this.program.blocks).find(
          (b) =>
            b.opcode === 'procedures_definition' &&
            this.prototypeOf(b)?.mutation?.proccode === proccode,
        );
        if (!def) {
          d.warn(`Custom block not found: ${proccode}`);
          return;
        }
        const proto = this.prototypeOf(def)!;
        const names: string[] = JSON.parse(proto.mutation?.argumentnames ?? '[]');
        const ids: string[] = JSON.parse(block.mutation?.argumentids ?? '[]');
        const saved = this.args;
        const next: Record<string, unknown> = {};
        for (let i = 0; i < names.length; i++) {
          next[names[i]] = await this.input(block, ids[i]);
        }
        this.args = next;
        try {
          await this.runChain(def.next);
        } finally {
          this.args = saved;
        }
        return;
      }

      default:
        if (/cyberpi_play|cyberpi_display|cyberpi_show|audio|led/i.test(op)) return; // cosmetic
        if (/firefly_bluetoothcontroller/.test(op)) {
          d.warn('Bluetooth controller blocks cannot run in the simulator');
          return;
        }
        d.warn(`Unsupported block ignored: ${op}`);
    }
  }

  private prototypeOf(definition: ScratchBlock): ScratchBlock | undefined {
    const ref = definition.inputs?.custom_block?.[1];
    return typeof ref === 'string' ? this.program.blocks[ref] : undefined;
  }
}
