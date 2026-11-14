/**
 * Shared contracts of the mBot2 simulator.
 *
 *   blocks (Blockly)  --ProgramJson-->  vm (interpreter)  --RobotIO-->  engine (physics + sensors)
 *                                                                          |
 *   ui (React + canvas)  <-------------- Simulation / World ---------------+----> Game (field, referee)
 *
 * The engine, the VM and the referee are plain TypeScript with NO dependency on the DOM, React or
 * Blockly, so they also run headless under Node (tests, "test many combinations").
 *
 * Geometry conventions are documented in ./geometry.ts (mm, +y down, heading 0 = up, clockwise +).
 */
import type { Rect, Vec2 } from './geometry';

// =============================================================================================
// Basics
// =============================================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Pose {
  x: number;
  y: number;
  /** radians, 0 = facing up the mat (-y), clockwise positive */
  heading: number;
}

/** The four game colours. */
export type ColorName = 'red' | 'green' | 'blue' | 'yellow';

/** Colours the Quad RGB sensor (and the optional front colour sensor) can name. */
export type SensorColor = 'black' | 'white' | 'red' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple';

export type MotorPort = 'EM1' | 'EM2';
export type Wheel = 'left' | 'right';
/** The two DC motor ports of the mBot2 shield (a fan, a pump ... - not the drive wheels). */
export type DcMotorPort = 'M1' | 'M2';
export const DC_MOTOR_PORTS: DcMotorPort[] = ['M1', 'M2'];
export type ServoPort = 'S1' | 'S2' | 'S3' | 'S4';
export const SERVO_PORTS: ServoPort[] = ['S1', 'S2', 'S3', 'S4'];

/** Quad RGB probes from the robot's left to its right. */
export type ProbeName = 'L2' | 'L1' | 'R1' | 'R2';
export const PROBE_NAMES: ProbeName[] = ['L2', 'L1', 'R1', 'R2'];

/** CyberPi inputs: buttons A / B and the 5-way joystick. */
export type ButtonName = 'a' | 'b' | 'up' | 'down' | 'left' | 'right' | 'middle';
export const BUTTON_NAMES: ButtonName[] = ['a', 'b', 'up', 'down', 'left', 'right', 'middle'];

// =============================================================================================
// Mat (what the downward-looking sensors see)
// =============================================================================================

export interface MatSampler {
  /** Printed colour of the mat at (x, y) mm, averaged over a small spot. Off the mat -> table colour. */
  sample(x: number, y: number): RGB;
}

export type MatLayer =
  | { kind: 'rect'; rect: Rect; color: RGB }
  | {
      kind: 'stroke';
      points: Vec2[];
      closed?: boolean;
      /** full stroke width in mm */
      width: number;
      color: RGB;
      /** optional dash pattern measured along the polyline from its first point */
      dash?: { on: number; off: number };
    };

/** Geometric description of a mat; layers are painted in order. */
export interface MatVector {
  width: number;
  height: number;
  background: RGB;
  /** colour reported when a sensor is off the mat */
  outside: RGB;
  layers: MatLayer[];
}

// =============================================================================================
// Bodies (towers, buckets, people, a fire target ...) and fixed walls
// =============================================================================================

export interface BodyHome {
  x: number;
  y: number;
  angle: number;
  z: number;
  restingOn: string | null;
}

/**
 * A box-shaped game element. Its footprint is a w x l rectangle centred on (x, y) and rotated by
 * `angle`; vertically it occupies [z, z + h] above the mat ("2.5-D": two things collide only when
 * their footprints overlap AND their height ranges overlap).
 */
export interface Body {
  /** unique, e.g. 'tower:W1', 'tower:RG', 'bucket:red', 'person:green' */
  id: string;
  kind: string;
  /** short text drawn on the element, e.g. 'W1' */
  label: string;
  /** CSS colour used to draw it */
  fill: string;
  /** what a colour sensor pointed at it reports (undefined = not a recognisable colour) */
  colorName?: ColorName;
  x: number;
  y: number;
  angle: number;
  /** footprint size across (mm) */
  w: number;
  /** footprint size along its own heading (mm) */
  l: number;
  /** height (mm) */
  h: number;
  /** height of its base above the mat (0 = standing on the mat) */
  z: number;
  /** id of the platform body it is standing on, or null when on the mat / held */
  restingOn: string | null;
  /** true while it is gripped by the robot */
  held: boolean;
  /** the gripper can pick it up */
  grippable: boolean;
  /** other bodies can stand on top of it (towers) */
  platform: boolean;
  /** relative resistance to being pushed: 1 = light object, larger = heavier (robot can push all) */
  mass: number;
  /** where the referee puts it back (restart rule) */
  home: BodyHome;
}

/**
 * A wall that never moves: a box like a Body (footprint w x l centred on (x, y), turned by
 * `angle`) that stands on the mat and is `h` mm high. The robot and everything it pushes are
 * stopped by it and can slide along it, the ultrasonic sensor sees it, and a colour sensor that
 * looks forward sees nothing behind it. A game returns its walls from Game.createWalls(); the
 * engine never changes them.
 */
export interface FixedWall {
  /** unique, e.g. 'wall:A1-B1'; reported in 'bump' events */
  id: string;
  /** short name for texts, e.g. 'A1-B1' */
  label: string;
  x: number;
  y: number;
  angle: number;
  /** footprint size across (mm) */
  w: number;
  /** footprint size along its own heading (mm) */
  l: number;
  /** height (mm): it occupies 0 .. h above the mat */
  h: number;
  /** CSS colour used to draw it */
  fill: string;
  /**
   * what a colour sensor pointed at it reports (left out = not a recognisable colour: the
   * sensor reads 'none', and still cannot see what is behind the wall)
   */
  colorName?: SensorColor;
}

// =============================================================================================
// Robot
// =============================================================================================

export interface GripperConfig {
  enabled: boolean;
  /** servo that raises / lowers the arm */
  liftServo: ServoPort;
  /** servo that opens / closes the claw */
  clawServo: ServoPort;
  /** servo angle (deg) at which the arm is fully down / fully up; in between is linear */
  liftDownAngle: number;
  liftUpAngle: number;
  /** height of the underside of the claw above the mat (mm) when down / up */
  liftDownHeight: number;
  liftUpHeight: number;
  /** servo angle (deg) at which the claw is fully open / fully closed; in between is linear */
  clawOpenAngle: number;
  clawClosedAngle: number;
  /** free gap between the two fingers (mm) when open / closed */
  clawOpenGap: number;
  clawClosedGap: number;
  /** distance from the drive axle to the centre of the gripping area, along the robot (mm) */
  gripForward: number;
  /** finger size: length along the robot, thickness across, and vertical height (mm) */
  fingerLength: number;
  fingerThickness: number;
  fingerHeight: number;
}

export interface RobotConfig {
  /** Chassis box in the robot frame (origin = midpoint of the drive axle). All mm. */
  chassisFront: number;
  chassisRear: number;
  chassisWidth: number;
  chassisHeight: number;
  wheelDiameter: number;
  /** distance between the two drive wheels' contact points */
  trackWidth: number;
  /** speed limit of the encoder motors */
  maxRpm: number;
  /** wheel acceleration limit, RPM per second */
  rpmPerSecond: number;
  /** servo slew rate, degrees per second */
  servoSpeed: number;
  quadRgb: {
    /** distance of the probe row ahead of the drive axle */
    forward: number;
    /** lateral offset of L2, L1, R1, R2 from the centre line (negative = left) */
    probeOffsets: [number, number, number, number];
    /** radius of the spot each probe averages over */
    spotRadius: number;
    /** a probe reports "line" when its brightness (0-100) is below this */
    lineThreshold: number;
  };
  ultrasonic: {
    /** distance of the sensor face ahead of the drive axle */
    forward: number;
    /** height of the beam above the mat; only things that tall are seen */
    height: number;
    minRangeCm: number;
    maxRangeCm: number;
    /** half opening angle of the beam, degrees */
    halfAngleDeg: number;
  };
  /**
   * optional add-on: a colour sensor looking forward. There are two kinds:
   *  - without `mount` (Fire Rescue): it sits on the arm and looks at whatever is in the claw,
   *    or just ahead of it. It sees only things the gripper can pick up.
   *  - with `mount` (Fire Chief): it is fixed to the robot and looks straight ahead at
   *    everything - game elements and walls. See FrontColorMount.
   */
  frontColorSensor: {
    enabled: boolean;
    /**
     * how far it sees (mm). Sensor at the claw: how far ahead of the gripping centre it can
     * still recognise an object. Fixed sensor (`mount`): the largest distance from the face of
     * the sensor to the thing it looks at.
     */
    rangeMm: number;
    /** where a sensor that is fixed to the robot sits. Left out = the sensor at the claw. */
    mount?: FrontColorMount;
  };
  /** optional add-on: a fan blowing forward, driven by a DC motor port. Left out = not fitted. */
  fan?: FanConfig;
  gripper: GripperConfig;
  /** real-world imperfections; 0 = perfect robot */
  noise: {
    /** relative wheel speed error, e.g. 0.02 = up to 2 % */
    wheelSlip: number;
    /** sensor noise amplitude on the 0-255 colour channels */
    sensor: number;
    /** ultrasonic noise amplitude in cm */
    ultrasonicCm: number;
  };
}

/**
 * A colour sensor that is fixed to the robot (RobotConfig.frontColorSensor.mount).
 *
 * It looks along ONE straight line: from its face, straight ahead of the robot. It names the
 * colour of the NEAREST thing on that line that reaches the height of the sensor and is at most
 * frontColorSensor.rangeMm away from its face:
 *   - a game element reads its Body.colorName,
 *   - a fixed wall reads its FixedWall.colorName,
 *   - a thing without a colour name reads 'none' - and hides what is behind it, like any other,
 *   - nothing in range reads 'none'.
 * So nothing is seen through a wall or behind another thing, and a thing that is lower than
 * the sensor (or stands on something, above it) is not seen at all.
 */
export interface FrontColorMount {
  /** distance of the face of the sensor ahead of the drive axle (mm), in the middle of the robot */
  forward: number;
  /** height of the sensor above the mat (mm) */
  height: number;
}

/** A fan at the front of the robot. It blows while its DC motor runs strongly enough. */
export interface FanConfig {
  enabled: boolean;
  /** the DC motor port that drives it */
  port: DcMotorPort;
  /** distance of the fan ahead of the drive axle (mm) */
  forward: number;
  /** it blows while the motor power is at least this (percent), forwards or backwards */
  minPower: number;
  /** the air leaves in a cone around straight ahead: this far to each side (degrees) ... */
  coneHalfAngleDeg: number;
  /** ... and reaches this far (mm) */
  reachMm: number;
}

export type WheelMode = 'stop' | 'speed' | 'power' | 'motion';

export interface WheelState {
  mode: WheelMode;
  /** commanded speed (RPM, + = robot forward) */
  targetRpm: number;
  /** actual speed (RPM, + = robot forward) */
  rpm: number;
  /** commanded power (-100..100) when in power mode, otherwise the equivalent of targetRpm */
  power: number;
  /** encoder: accumulated rotation in degrees since the last reset (+ = robot forward) */
  angleDeg: number;
}

export interface ServoState {
  /** current angle, degrees */
  angle: number;
  /** commanded angle, degrees */
  target: number;
}

/** One DC motor port (M1 / M2). */
export interface DcMotorState {
  /** commanded power, -100..100 percent (0 = stopped) */
  power: number;
}

export interface ScreenLabel {
  text: string;
  x: number;
  y: number;
  size: number;
}

export interface RobotState {
  pose: Pose;
  left: WheelState;
  right: WheelState;
  servos: Record<ServoPort, ServoState>;
  gripper: {
    /** height of the underside of the claw above the mat (mm) */
    height: number;
    /** current gap between the fingers (mm) */
    gap: number;
    /** id of the body currently gripped */
    holding: string | null;
  };
  /** unwrapped heading change since the last gyro reset, degrees, clockwise positive */
  yawDeg: number;
  /** the five CyberPi RGB LEDs, left to right */
  leds: RGB[];
  /** CyberPi screen: console lines (print) and positioned labels */
  screen: { lines: string[]; labels: ScreenLabel[] };
  /** true while the chassis, fingers or carried object are pressing against something */
  touching: boolean;
  /** last ultrasonic reading in cm (for the UI) */
  lastUltrasonicCm: number;
  /**
   * The DC motor ports M1 / M2. The engine always fills in this and the field below; they
   * are optional only so that a robot state written by hand (older tests) stays valid.
   */
  dcMotors?: Record<DcMotorPort, DcMotorState>;
  /** true while the fan is blowing (always false on a robot without a fan) */
  fanOn?: boolean;
}

/** One reading of a Quad RGB probe. */
export interface ProbeReading {
  rgb: RGB;
  /** reflected light intensity 0 (black) .. 100 (white) */
  light: number;
  /** grey level 0 (white) .. 100 (black) */
  gray: number;
  /** dark enough to count as "line" */
  onLine: boolean;
  color: SensorColor;
}

// =============================================================================================
// World + simulation
// =============================================================================================

export type SimEvent =
  | { type: 'grab'; bodyId: string; time: number }
  | { type: 'release'; bodyId: string; onto: string | null; time: number }
  | { type: 'bump'; bodyId: string; time: number }
  | { type: 'tone'; frequency: number; seconds: number; time: number }
  | { type: 'restart'; time: number }
  | { type: 'finish'; reason: FinishReason; time: number; detail?: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string; blockId?: string; time: number };

export interface World {
  /** simulated seconds since the match started */
  time: number;
  tick: number;
  robot: RobotState;
  bodies: Body[];
  /** the fixed walls of this match (the engine always sets it; empty when the game has none) */
  walls?: readonly FixedWall[];
}

export type SimStatus = 'ready' | 'running' | 'finished';
/**
 * Why a match ended. The first three can happen in every game; the last two are called by a
 * game's referee (Game.createReferee): the mission is complete, or the robot moved a game
 * element that must stay where it is. The referee's own sentence is in Simulation.finishDetail.
 * ('mission-complete' says why the match ended, not how many points it brought: whether every
 * point was earned is ScoreReport.complete.)
 */
export type FinishReason = 'time' | 'declared' | 'program-ended' | 'mission-complete' | 'target-displaced';

export interface ScoreLine {
  id: string;
  label: string;
  /** points currently earned by this line (negative for penalties) */
  points: number;
  /** points available on this line (0 for penalties) */
  max: number;
  ok: boolean;
  /** why it does / does not score, in student-friendly words */
  detail: string;
  /** match time (seconds) at which this line was earned, when the game records it */
  time?: number;
}

export interface ScoreReport {
  total: number;
  max: number;
  lines: ScoreLine[];
  /**
   * every mission is complete (the run could be declared finished). What that means is the
   * game's decision; it is not the same as "the match ended with the reason 'mission-complete'".
   */
  complete: boolean;
  /** match time (seconds) at which this total was reached, when the game ranks by time */
  time?: number;
}

/** A coloured area or label the renderer can draw over the mat. */
export interface ZoneOverlay {
  id: string;
  label: string;
  rect: Rect;
  /** CSS colour */
  color: string;
  kind: 'start' | 'pickup' | 'delivery' | 'tower-area' | 'info';
}

export interface ScoreContext<S> {
  scenario: S;
  world: World;
  robotConfig: RobotConfig;
  restarts: number;
  /** footprints (as oriented boxes) currently occupied by the robot: chassis, fingers */
  robotShapes: import('./geometry').OBB[];
}

/** What a referee with memory says after it has looked at one tick. */
export interface RefereeCall {
  /** sentences for the team, in student words; the simulation puts them into its log */
  say?: string[];
  /** set to end the match right now: why (for the program) and the referee's sentence (for people) */
  end?: { reason: FinishReason; detail: string };
}

/**
 * A referee with memory, for games whose points depend on what happened and when (not only on
 * how the field looks at the end). The simulation creates one per match (Game.createReferee)
 * and from then on asks it, not Game.score(), for the score.
 */
export interface Referee<S = unknown> {
  /**
   * Optional. Called once at the referee's start signal, before the first tick: the robot stands
   * where the team put it. A referee that has to check the starting position does it here.
   */
  begin?(ctx: ScoreContext<S>): void;
  /**
   * Called once after every tick of a running match, with the world as it is now.
   * Returns null when there is nothing to say (almost always).
   * (The context shows the field at the moment of the call. Take from it what must be
   * remembered; do not keep the object itself - the simulation hands over the same one again.)
   */
  observe(ctx: ScoreContext<S>): RefereeCall | null;
  /**
   * The team used a restart. The robot is back in the start zone and the game elements are
   * where the restart rule puts them. The referee forgets what the rules say a restart costs.
   */
  restart(ctx: ScoreContext<S>): void;
  /**
   * Optional. Called once when the match ends, whatever ended it (time, "Finished", the end of
   * the program, or this referee itself), BEFORE the simulation stops the robot's motors: the
   * context still shows the field as it was at the last moment of the match. From now on
   * score() is the final sheet, and its texts can say "was" instead of "is".
   */
  finished?(ctx: ScoreContext<S>, reason: FinishReason): void;
  /** the score sheet "if the match ended now" (after the end: the final sheet) */
  score(ctx: ScoreContext<S>): ScoreReport;
}

/** What a restart does in a game, beyond "the robot goes back to the start zone". */
export interface RestartRules {
  /** how many restarts one match allows (left out = as many as the team wants) */
  maxRestarts?: number;
  /** a restart clears the points earned so far (the screen says so; the game's referee does it) */
  clearsPoints?: boolean;
  /** every game element is put back where it started (left out = only what the robot carried) */
  resetsBodies?: boolean;
}

/**
 * Everything that is specific to one competition category. `S` is the "combination"
 * (random starting arrangement) type of that category.
 */
export interface Game<S = unknown> {
  id: string;
  title: string;
  mat: { width: number; height: number; imageUrl: string; sensorImageUrl: string; vector: MatVector };
  /** seconds */
  matchDuration: number;
  /** the robot must start completely inside this rectangle */
  startZone: Rect;
  defaultStartPose: Pose;
  /** points removed per restart */
  restartPenalty: number;
  defaultScenario(): S;
  randomScenario(rng: () => number): S;
  /** total number of distinct scenarios */
  scenarioCount(): number;
  /** short human-readable code, stable across versions */
  encodeScenario(s: S): string;
  decodeScenario(code: string): S | null;
  describeScenario(s: S): string;
  /** create every body in its starting position for this scenario */
  createBodies(s: S): Body[];
  overlays(s: S): ZoneOverlay[];
  /**
   * The score of the field as it is now. A game with a referee that has memory (createReferee)
   * is scored by that referee during a match; its score() then describes a match in which
   * nothing has been earned yet.
   */
  score(ctx: ScoreContext<S>): ScoreReport;

  // ---- optional parts: a game that does not need one simply leaves it out

  /** the robot this game is played with (left out = the simulator's standard robot) */
  robotConfig?: RobotConfig;
  /** the fixed walls of this combination (left out = no walls) */
  createWalls?(s: S): FixedWall[];
  /** a referee with memory for one match (left out = Game.score() judges the field as it is) */
  createReferee?(s: S): Referee<S>;
  /** what a restart does in this game (left out = no limit, restartPenalty points each) */
  restartRules?: RestartRules;
  /**
   * What is wrong with a combination, one student-friendly sentence per problem; empty when it
   * can be played. For editors: a combination being built may be invalid for a while.
   */
  scenarioProblems?(s: S): string[];
}

// =============================================================================================
// Program (Blockly JSON serialisation) and VM
// =============================================================================================

/** A block as written by Blockly.serialization.workspaces.save(). */
export interface BlockJson {
  type: string;
  id: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>;
  next?: { block?: BlockJson; shadow?: BlockJson };
  extraState?: unknown;
  enabled?: boolean;
  disabledReasons?: string[];
  [key: string]: unknown;
}

export interface VariableJson {
  name: string;
  id: string;
  type?: string;
}

export interface ProgramJson {
  blocks?: { languageVersion?: number; blocks?: BlockJson[] };
  variables?: VariableJson[];
  [key: string]: unknown;
}

export type Scalar = number | string | boolean;

export interface VMError {
  message: string;
  blockId?: string;
}

export interface VM {
  /** start every "when CyberPi starts up" script */
  start(): void;
  /** advance every running script by one simulation tick */
  step(): void;
  stopAll(): void;
  /** true while at least one script is still running */
  readonly running: boolean;
  /** true when no script is running AND no hat block (button, message ...) could start one later */
  readonly idle: boolean;
  /** ids of the blocks being executed right now (for highlighting) */
  activeBlockIds(): string[];
  /** current values of the student's variables, by name */
  variables(): Record<string, Scalar | Scalar[]>;
  /** runtime problems found so far (unknown block, missing input ...) */
  errors(): VMError[];
}

// =============================================================================================
// Simulation facade (implemented by core/engine, used by the UI and the batch runner)
// =============================================================================================

export interface SimulationOptions<S = unknown> {
  game: Game<S>;
  scenario: S;
  /** left out = the robot of the game (game.robotConfig), or the simulator's standard robot */
  robotConfig?: RobotConfig;
  /** what the floor sensors see; defaults to a vector sampler built from game.mat.vector */
  sampler?: MatSampler;
  program: ProgramJson;
  /**
   * where the robot stands at the start (left out = game.defaultStartPose). It is NOT held to the
   * start zone - tests use it to begin anywhere; a screen places the robot with setStartPose(),
   * which is. Outside the start zone the log says so; in a game with fixed walls a robot that
   * was put into a wall or on top of a game element is moved out of it at the start signal.
   */
  startPose?: Pose;
  /** seed for the noise generator (noise is off unless robotConfig.noise has non-zero values) */
  seed?: number;
}

export interface Simulation<S = unknown> {
  readonly game: Game<S>;
  readonly scenario: S;
  readonly robotConfig: RobotConfig;
  readonly world: World;
  readonly status: SimStatus;
  readonly finishReason: FinishReason | null;
  /** the referee's sentence about the end of the match, when it ended the match; otherwise null */
  readonly finishDetail: string | null;
  readonly restarts: number;
  /** restarts the team may still use in this match (Infinity when the game sets no limit) */
  readonly restartsLeft: number;
  /** seconds left on the match clock */
  readonly timeLeft: number;
  readonly vm: VM;
  /** fixed simulation time step in seconds */
  readonly dt: number;

  /** referee's signal: start the clock and the program ("when CyberPi starts up") */
  start(): void;
  /** advance by n ticks (no-op unless running) */
  step(ticks?: number): void;
  /**
   * rules: robot goes back to the start zone, carried object is returned, penalty, clock keeps
   * running, program restarts. Does nothing (but logs a warning) when no restart is left.
   */
  restart(): void;
  /** team declares "Finished": stop the robot and freeze the score */
  declareFinished(): void;
  /** press / release a CyberPi button or joystick direction */
  setButton(name: ButtonName, down: boolean): void;
  /** place the robot before the match (only while 'ready'); returns false if it is not fully inside the start zone */
  setStartPose(pose: Pose): boolean;
  /** live score: "if the match ended now" */
  score(): ScoreReport;
  /** oriented boxes of the chassis and fingers, for drawing and for the referee */
  robotShapes(): import('./geometry').OBB[];
  /** current sensor values for the dashboard (does not disturb the program) */
  readSensors(): SensorSnapshot;
  /** remove and return the events produced since the last call */
  drainEvents(): SimEvent[];
}

export interface SensorSnapshot {
  probes: Record<ProbeName, ProbeReading>;
  /** 4-bit line status, see RobotIO.lineStatus */
  lineStatus: number;
  lineOffset: number;
  ultrasonicCm: number;
  frontColor: SensorColor | 'none';
  /** power of the DC motor ports M1 / M2, -100..100 */
  dcMotorPower: Record<DcMotorPort, number>;
  /** the fan is blowing */
  fanOn: boolean;
  yawDeg: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
  leftRpm: number;
  rightRpm: number;
  timer: number;
}
