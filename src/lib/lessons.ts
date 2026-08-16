/**
 * Interactive, step-by-step training courses.
 *
 * The Smart Logistics course below is the original MakeX Lebanon progressive
 * task series (migrated from the old site's hidden /hints-smart-logistics
 * page), upgraded with the block simulator where the task is drivable.
 * Distances are centimetres on a 200×200 cm simulator mat.
 */

export type Zone = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label?: string;
  /** Solid structures crash the robot and reflect the ultrasonic. */
  solid?: boolean;
};

export type Mat = {
  /** Robot start position (cm) and heading (degrees, 0 = up/north). */
  start: { x: number; y: number; heading: number };
  /** Reaching this zone completes the step. */
  target: Zone;
  /** Non-goal zones drawn on the mat. Labels containing "rack" are solid. */
  zones?: Zone[];
};

export type LessonStep = {
  slug: string;
  title: string;
  task: string;
  explain: string;
  hints: string[];
  /** Reference photo of the real field / setup, shown with the briefing. */
  photo?: string;
  /**
   * The official solution: mBlock code screenshots and a walkthrough video.
   * Revealed only when the student asks.
   */
  solution?: { videoId: string; images: string[] };
  /** Present when the task is drivable in the simulator. */
  mat?: Mat;
  blockLimit?: number;
};

export type Lesson = {
  slug: string;
  title: string;
  intro: string;
  ageRange: string;
  steps: LessonStep[];
};

const IMG = '/training/smart-logistics';

/**
 * The real MakeX Inspire Smart Logistics arena: a 2 m x 2 m black mat with
 * white guide lines. Geometry below is measured from the official field
 * diagram: base at bottom-centre, raised cube platform mid-field, warehouses
 * 1 and 2 in the bottom corners with white entrance lines.
 */
const FIELD: Zone[] = [
  { x: 0, y: 0, w: 5, h: 200, color: '#2563eb' },
  { x: 195, y: 0, w: 5, h: 200, color: '#dc2626' },
  { x: 76, y: 76, w: 48, h: 48, color: '#334155', label: 'Platform', solid: true },
  { x: 94, y: 116, w: 12, h: 16, color: '#facc15', label: 'Cubes', solid: true },
  { x: 97, y: 132, w: 6, h: 24, color: '#ffffff' },
  { x: 20, y: 138, w: 160, h: 4, color: '#ffffff' },
  { x: 80, y: 156, w: 20, h: 40, color: '#1d4ed8', label: 'Base' },
  { x: 100, y: 156, w: 20, h: 40, color: '#b91c1c' },
];
const WAREHOUSE_1: Zone = { x: 22, y: 156, w: 40, h: 30, color: '#1e293b', label: 'Warehouse 1' };
const WAREHOUSE_2: Zone = { x: 138, y: 156, w: 40, h: 30, color: '#1e293b', label: 'Warehouse 2' };
const W1_LINE: Zone = { x: 62, y: 150, w: 5, h: 36, color: '#ffffff' };
const W2_LINE: Zone = { x: 133, y: 150, w: 5, h: 36, color: '#ffffff' };

export const smartLogisticsLesson: Lesson = {
  slug: 'smart-logistics',
  title: 'Smart Logistics — progressive tasks',
  ageRange: '8–12 years',
  intro:
    'The official MakeX Lebanon task series for the Inspire Smart Logistics field: five ' +
    'missions that build the full competition run — approach the cubes, grab them with the ' +
    'clamp, return, turn with the gyro, and stop precisely at the warehouse. Try each task ' +
    'first (the driving ones run in the simulator), then check the official mBlock solution ' +
    'and video.',
  steps: [
    {
      slug: 'stop-at-cubes',
      title: 'Stop in front of the cubes',
      task: 'Program your mBot2 to reach the cubes and stop exactly 7 cm in front of them.',
      explain:
        'Consider the differences between Live Mode and Upload Mode when programming your ' +
        'mBot2 — each mode can significantly impact your robot’s performance. Complete the ' +
        'task, optimise your program for accuracy and efficiency, and pay close attention to ' +
        'sensor integration.',
      hints: [
        'The ultrasonic sensor reports the distance ahead — drive forward while it reads more than 7 cm.',
        'Test in both Live and Upload Mode: timing behaves differently in each.',
        'In the simulator the cube face is 44 cm from the robot’s front — drive until the ultrasonic reads 7 cm.',
      ],
      photo: `${IMG}/task1-field.jpg`,
      solution: {
        videoId: 'gPSS8NId3i8',
        images: [`${IMG}/task1-solution-code.jpg`],
      },
      mat: {
        start: { x: 100, y: 176, heading: 0 },
        target: { x: 86, y: 134, w: 28, h: 18, color: 'transparent', label: 'Stop zone' },
        zones: [...FIELD, WAREHOUSE_1, WAREHOUSE_2, W1_LINE, W2_LINE],
      },
    },
    {
      slug: 'servo-clamp',
      title: 'Servo motor — operate the clamp',
      task: 'Program the servo motor to open and close the clamp that catches the cubes, starting from a reset open position.',
      explain:
        'Connect the servo to port S1–S4. Set it to 90° for the open position, attach the ' +
        'clamp while open, then close by rotating towards 180° (clockwise builds) or towards ' +
        '0° (counter-clockwise builds). Fine-tune the angles to your build. Careful: a locked ' +
        'servo — one blocked from rotating — overheats and can burn out, so never hold the ' +
        'clamp closed against resistance for long.',
      hints: [
        'Reset first: set the servo to 90° before attaching the clamp arms.',
        'Close at around 120° — adjust in small steps until the grip is firm but not straining.',
        'If the servo buzzes or vibrates at rest, the angle is straining it — back off a few degrees.',
      ],
      photo: `${IMG}/task2-clamp-open.jpg`,
      solution: {
        videoId: 'PuaweqLq9LA',
        images: [`${IMG}/task2-clamp-closed.jpg`, `${IMG}/task2-solution-code.jpg`],
      },
    },
    {
      slug: 'return-to-start',
      title: 'Return to the initial position',
      task: 'After collecting the cubes, drive the robot back to its exact starting position, ready to turn towards warehouse 1 or 2.',
      explain:
        'Precise positioning makes every later step repeatable. Three methods work: measure ' +
        'the distance and reverse by the same amount; reset the wheel encoders at the start ' +
        'and reverse the exact degrees turned; or drive backwards until the colour sensor ' +
        'detects the red or blue marker at the start point.',
      hints: [
        'Simplest first: if you drove 145 cm forward, “move backward 145” brings you home.',
        'The encoder method survives wheel slip better than time-based driving.',
        'In the simulator, reverse about 30 cm from the cubes back into the Base.',
      ],
      photo: `${IMG}/task3-field.jpg`,
      solution: {
        videoId: 'J7LoJ44TDCc',
        images: [`${IMG}/task3-solution-1.jpg`, `${IMG}/task3-solution-2.jpg`, `${IMG}/task3-solution-3.jpg`],
      },
      mat: {
        start: { x: 100, y: 146, heading: 0 },
        target: { x: 82, y: 158, w: 36, h: 36, color: 'transparent', label: 'Base' },
        zones: [...FIELD, WAREHOUSE_1, WAREHOUSE_2, W1_LINE, W2_LINE],
      },
    },
    {
      slug: 'gyro-turns',
      title: 'Accurate 90° turns with the gyro',
      task: 'Turn the robot exactly 90° left or right using the gyro sensor’s Z-axis, then drive to a warehouse.',
      explain:
        'Reset the gyro Z-axis to zero at the start so the measurement is accurate. Turning ' +
        'left, keep rotating until the reading passes +89°; turning right, until it passes ' +
        '−89°. Watching the sensor instead of guessing by time is what makes the turn exact.',
      hints: [
        'Always reset the Z-axis before the turn — drift accumulates.',
        'Stop at 89° rather than 90°: the robot coasts the final degree.',
        'In the simulator: turn left 90°, then drive about 58 cm into Warehouse 1.',
      ],
      photo: `${IMG}/task4-field.jpg`,
      solution: {
        videoId: 'xzmkmenRDKc',
        images: [`${IMG}/task4-solution-code.jpg`],
      },
      mat: {
        start: { x: 100, y: 170, heading: 0 },
        target: { x: 22, y: 156, w: 40, h: 30, color: '#1e293b', label: 'Warehouse 1' },
        zones: [...FIELD, WAREHOUSE_2, W1_LINE, W2_LINE],
      },
      blockLimit: 4,
    },
    {
      slug: 'rgb-stop',
      title: 'Precise stop with the Quad RGB sensor',
      task: 'Stop the robot exactly at the warehouse entrance: drive until all four probes of the Quad RGB sensor detect the white line at once.',
      explain:
        'One probe seeing white means the robot is arriving at an angle; all four at once ' +
        'means it is square to the entrance. Calibrate the sensor first so every probe ' +
        'responds uniformly — that uniformity is what makes the stop repeatable.',
      hints: [
        'Calibrate the Quad RGB sensor on the actual mat, under venue lighting.',
        'Use a “repeat until” loop: keep driving while NOT all four probes see white.',
        'Approach slowly — at high speed the robot overshoots the line before the loop reacts.',
      ],
      photo: `${IMG}/task5-field.jpg`,
      solution: {
        videoId: 'hp9purHgRXQ',
        images: [`${IMG}/task5-solution-code.jpg`],
      },
      // Facing warehouse 1: drive left until the probes reach the white
      // entrance line, exactly as on the real mat.
      mat: {
        start: { x: 100, y: 170, heading: 270 },
        target: { x: 56, y: 152, w: 28, h: 36, color: 'transparent', label: 'Stop zone' },
        zones: [...FIELD, WAREHOUSE_1, WAREHOUSE_2, W1_LINE, W2_LINE],
      },
    },
  ],
};

export const lessons: Lesson[] = [smartLogisticsLesson];

export function getLesson(slug: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.slug === slug);
}
