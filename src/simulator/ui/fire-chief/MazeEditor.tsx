'use client';

/**
 * Set up a Fire Chief maze by hand:
 *   - a plan of the 5 x 5 field with START and the two rooms, on which each of the 40 places of
 *     an inner wall is a button: a click, a finger or the space bar puts the wall up or takes it
 *     away. The stage shows the change at once.
 *   - the ready-made mazes of the game by name (the default maze, the open field and three more),
 *   - the room of the fire and its place in that room, drawn on the plan,
 *   - how hard the maze is, in words, and - for a maze in which a room cannot be reached - what
 *     is wrong, in the game's own words. Such a maze can still be started for practice
 *     (see ./maze-words.ts for why).
 *
 * "Random maze", "Default maze", the code of the maze, Copy and the field to type a code in are
 * in the general panel around this editor (../CombinationPanel.tsx).
 *
 * Everything that can be worked out without a screen is in plain files beside this one and is
 * tested there: where the walls lie and where the arrow keys go (./maze-plan.ts), the level
 * (./maze-level.ts), the words (./maze-words.ts, ./maze-choices.ts).
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FIRE_SPOTS, ROOM_IDS, type FireSpot, type RoomId } from '../../fire-chief/field';
import { TARGET_FILL } from '../../fire-chief/game';
import { toggleWall, withFire, type FireChiefScenario } from '../../fire-chief/scenario';
import { MAZE_CHOICES, mazeChoiceOf, ROOM_LABEL, SPOT_LABEL, withMaze } from './maze-choices';
import { HARDEST_LEVEL, LEVEL_NOTE, levelFacts, levelTitle, mazeFacts, mazeLevel } from './maze-level';
import {
  PLAN_BOX,
  PLAN_CELL,
  PLAN_CELLS,
  PLAN_COLUMN_NAMES,
  PLAN_ROW_NAMES,
  PLAN_SIZE,
  PLAN_WALLS,
  hitOutline,
  hitShape,
  isPlanKey,
  movePlanFocus,
  planFire,
  planFlame,
  reachableCells,
} from './maze-plan';
import { OWN_MAZE_ABOUT, PLAN_HINT, practiceNote, wallHint } from './maze-words';

/**
 * One choice of a group (the same look as the squares of the Fire Rescue editor). The colours
 * change at once, without fading: while two choices fade into each other it cannot be read
 * which one is chosen.
 */
function choiceClass(selected: boolean): string {
  return (
    'rounded-md border px-2 py-1.5 text-xs font-semibold focus-visible:relative focus-visible:z-10 ' +
    (selected ? 'border-ink-800 bg-ink-800 text-white' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50')
  );
}

const LEGEND = 'px-1 text-xs font-bold uppercase tracking-wide text-ink-500';

// The colours of the plan. A wall is as dark as the frame around the field; a place without a
// wall is a thin dashed line, like the grid printed on the mat.
const INK = '#121a2e';
const GRID = '#94a3b8';
const CELL_FILL: Record<'start' | 'room' | 'fire' | 'plain' | 'closed', string> = {
  start: '#fee2e2',
  room: '#dbeafe',
  fire: '#ffedd5',
  plain: '#ffffff',
  closed: '#e2e8f0',
};

export interface MazeEditorProps {
  scenario: FireChiefScenario;
  onChange: (next: FireChiefScenario) => void;
}

export function MazeEditor({ scenario, onChange }: MazeEditorProps) {
  const chosen = mazeChoiceOf(scenario);
  const facts = useMemo(() => mazeFacts(scenario), [scenario]);
  const level = mazeLevel(facts);
  const practice = useMemo(() => practiceNote(scenario), [scenario]);
  const reach = useMemo(() => reachableCells(scenario.walls), [scenario]);

  // ---- the keyboard: the plan is one stop of the Tab key, the arrow keys go from wall to wall
  const [tabStop, setTabStop] = useState(PLAN_WALLS[0].index);
  /** the wall place whose outline is drawn: the one that has the focus, when the focus came from the keyboard */
  const [outlined, setOutlined] = useState<number | null>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  /** where the cursor "wants to be" while it goes up and down (see movePlanFocus) */
  const column = useRef<number | undefined>(undefined);
  /** true while the focus is being moved by an arrow key (then the wanted column is kept) */
  const moving = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!isPlanKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const next = movePlanFocus(index, event.key, column.current);
    column.current = next.column;
    if (next.index === index) return;
    moving.current = true;
    buttons.current.get(next.index)?.focus();
    moving.current = false;
  };

  const fire = planFire(scenario.fireRoom, scenario.fireSpot);
  const flame = planFlame(scenario.fireRoom, scenario.fireSpot);

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------------------------------------------------------- ready-made mazes */}
      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className={LEGEND}>Ready-made mazes</legend>
        <div className="flex flex-wrap gap-1.5">
          {MAZE_CHOICES.map((choice) => {
            const selected = chosen?.id === choice.id;
            return (
              <button key={choice.id} type="button" aria-pressed={selected} title={choice.about} onClick={() => onChange(withMaze(scenario, choice))} className={choiceClass(selected)}>
                {choice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-snug text-ink-600" data-maze-about>
          {chosen ? chosen.about : OWN_MAZE_ABOUT}
        </p>
      </fieldset>

      {/* (this row measures its own width: the plan and the fire stand side by side where there is room) */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @[31rem]:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
          {/* -------------------------------------------------------------- the plan */}
          <fieldset className="min-w-0 rounded-lg border border-slate-200 p-2.5">
            <legend className={LEGEND}>Walls</legend>
            <p className="mb-2 text-xs leading-snug text-ink-600">{PLAN_HINT}</p>
            <div
              role="group"
              aria-label="Plan of the maze: the 40 places where an inner wall can stand"
              // (a finger that taps a wall must not zoom the page; nothing on the plan can be selected as text)
              className="relative mx-auto aspect-square w-full max-w-[21rem] touch-manipulation select-none"
              data-maze-plan
            >
              <svg viewBox={`${PLAN_BOX.x} ${PLAN_BOX.y} ${PLAN_BOX.w} ${PLAN_BOX.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
                {/* the cells: START red, the rooms blue, the room of the fire orange - the colours of the "Zones" view; grey = cannot be reached from START */}
                {PLAN_CELLS.map((cell, n) => {
                  const fill = !reach[n] ? CELL_FILL.closed : cell.kind === 'start' ? CELL_FILL.start : cell.kind === 'plain' ? CELL_FILL.plain : cell.kind === scenario.fireRoom ? CELL_FILL.fire : CELL_FILL.room;
                  return <rect key={cell.name} x={cell.x} y={cell.y} width={PLAN_CELL} height={PLAN_CELL} fill={fill} data-cell={cell.name} data-closed={reach[n] ? undefined : ''} />;
                })}
                {/* the names of the columns and of the rows: a wall is named after the two cells it stands between */}
                {PLAN_COLUMN_NAMES.map((name, col) => (
                  <text key={name} x={(col + 0.5) * PLAN_CELL} y={-11} textAnchor="middle" fontSize="19" fontWeight="700" fill="#5a6a89">
                    {name}
                  </text>
                ))}
                {PLAN_ROW_NAMES.map((name, row) => (
                  <text key={name} x={-17} y={(row + 0.5) * PLAN_CELL + 7} textAnchor="middle" fontSize="19" fontWeight="700" fill="#5a6a89">
                    {name}
                  </text>
                ))}
                {/* what the three special cells are */}
                {PLAN_CELLS.map((cell) => {
                  const mid = cell.x + PLAN_CELL / 2;
                  if (cell.kind === 'start') {
                    return (
                      <text key={cell.name} x={mid} y={cell.y + 57} textAnchor="middle" fontSize="20" fontWeight="800" fill="#b91c1c">
                        START
                      </text>
                    );
                  }
                  if (cell.kind === 'living') {
                    return (
                      <text key={cell.name} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1c2743">
                        <tspan x={mid + 8} y={cell.y + 70}>
                          Living
                        </tspan>
                        <tspan x={mid + 8} y={cell.y + 89}>
                          room
                        </tspan>
                      </text>
                    );
                  }
                  if (cell.kind === 'bedroom') {
                    return (
                      <text key={cell.name} x={mid - 4} y={cell.y + 87} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1c2743">
                        Bedroom
                      </text>
                    );
                  }
                  return null;
                })}
                {/* every place without a wall: a thin dashed line */}
                {PLAN_WALLS.filter((wall) => !scenario.walls[wall.index]).map((wall) => (
                  <line key={wall.index} x1={wall.from.x} y1={wall.from.y} x2={wall.to.x} y2={wall.to.y} stroke={GRID} strokeWidth="2" strokeDasharray="7 6" />
                ))}
                {/* the walls that stand, and the wall around the field (it always stands) */}
                {PLAN_WALLS.filter((wall) => scenario.walls[wall.index]).map((wall) => (
                  <line key={wall.index} x1={wall.from.x} y1={wall.from.y} x2={wall.to.x} y2={wall.to.y} stroke={INK} strokeWidth="10" strokeLinecap="round" data-wall={wall.label} />
                ))}
                <rect x={0} y={0} width={PLAN_SIZE} height={PLAN_SIZE} fill="none" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
                {/* the fire target where the game puts it (true to size), and a flame in front of it so that it is seen on a small plan */}
                <g data-fire={`${scenario.fireRoom}-${scenario.fireSpot}`}>
                  {/* (red, the colour of the target on the stage and in the rules: the colour sensor reads "red" on it) */}
                  <rect
                    x={fire.x - fire.width / 2}
                    y={fire.y - fire.depth / 2}
                    width={fire.width}
                    height={fire.depth}
                    fill={TARGET_FILL}
                    stroke="#7f1d1d"
                    strokeWidth="1.5"
                    transform={`rotate(${fire.turn} ${fire.x} ${fire.y})`}
                  />
                  <g transform={`translate(${flame.x} ${flame.y})`}>
                    <path d="M0,-15 C7,-7 11,-1 11,5 A11,11 0 0 1 -11,5 C-11,0 -8,-3 -6,-7 C-4,-4 -2,-3 -1,-5 C0,-8 1,-11 0,-15 Z" fill="#f97316" stroke="#7c2d12" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M0,-3 C3,1 5,4 5,7 A5,5 0 0 1 -5,7 C-5,4 -3,1 0,-3 Z" fill="#fde047" />
                  </g>
                </g>
              </svg>

              {/* The 40 wall places, line by line. Each is a real button, cut to the part of the plan that
                  is nearest to its wall (maze-plan.ts: hitShape). The button itself shows nothing but the
                  place the pointer rests on and the place that has the keyboard focus - the walls are drawn
                  above. (A cut-out button cannot show the site's focus ring, so it draws its own shape.) */}
              {PLAN_WALLS.map((wall) => {
                const standing = scenario.walls[wall.index] === true;
                return (
                  <button
                    key={wall.index}
                    ref={(element) => {
                      if (element) buttons.current.set(wall.index, element);
                      else buttons.current.delete(wall.index);
                    }}
                    type="button"
                    aria-pressed={standing}
                    aria-label={wall.name}
                    title={wallHint(wall.name, standing)}
                    tabIndex={wall.index === tabStop ? 0 : -1}
                    data-wall-index={wall.index}
                    data-wall-place={wall.label}
                    onClick={() => onChange(toggleWall(scenario, wall.index))}
                    onFocus={(event) => {
                      setTabStop(wall.index);
                      // (a click gives the focus too, but then the pointer already shows which wall is meant)
                      setOutlined(event.currentTarget.matches(':focus-visible') ? wall.index : null);
                      if (!moving.current) column.current = undefined;
                    }}
                    onBlur={() => setOutlined(null)}
                    onKeyDown={(event) => onKeyDown(event, wall.index)}
                    className="group absolute cursor-pointer outline-none"
                    style={{
                      left: `${wall.box.left}%`,
                      top: `${wall.box.top}%`,
                      width: `${wall.box.width}%`,
                      height: `${wall.box.height}%`,
                      clipPath: hitShape(wall.direction),
                    }}
                  >
                    <span aria-hidden="true" className="absolute inset-0 bg-brand-500 opacity-0 group-hover:opacity-20 group-focus-visible:opacity-35 group-active:opacity-40" />
                  </button>
                );
              })}

              {/* the outline of the wall place that has the keyboard focus, drawn over everything */}
              <svg viewBox={`${PLAN_BOX.x} ${PLAN_BOX.y} ${PLAN_BOX.w} ${PLAN_BOX.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                {PLAN_WALLS.filter((wall) => wall.index === outlined).map((wall) => (
                  <polygon key={wall.index} points={hitOutline(wall)} fill="none" stroke="#0084c2" strokeWidth="5" strokeLinejoin="round" data-wall-outline={wall.label} />
                ))}
              </svg>
            </div>
          </fieldset>

          <div className="flex min-w-0 flex-col gap-3">
            {/* ------------------------------------------------------------ the fire */}
            <fieldset className="rounded-lg border border-slate-200 p-2.5">
              <legend className={LEGEND}>Fire</legend>
              <div className="flex flex-col gap-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink-600">Room</p>
                  <div role="radiogroup" aria-label="Room of the fire" className="flex flex-wrap gap-1.5">
                    {ROOM_IDS.map((room: RoomId) => (
                      <button key={room} type="button" role="radio" aria-checked={scenario.fireRoom === room} onClick={() => onChange(withFire(scenario, room))} className={choiceClass(scenario.fireRoom === room)}>
                        {ROOM_LABEL[room]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink-600">Place in the room</p>
                  <div role="radiogroup" aria-label="Place of the fire in its room" className="flex flex-wrap gap-1.5">
                    {FIRE_SPOTS.map((spot: FireSpot) => (
                      <button
                        key={spot}
                        type="button"
                        role="radio"
                        aria-checked={scenario.fireSpot === spot}
                        title={SPOT_LABEL[spot].hint}
                        onClick={() => onChange(withFire(scenario, scenario.fireRoom, spot))}
                        className={choiceClass(scenario.fireSpot === spot)}
                      >
                        {SPOT_LABEL[spot].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ------------------------------------------------------------ how hard */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5" data-maze-level={level ?? 'none'}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">How hard is this maze?</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-ink-900">
                <span data-maze-level-title>{levelTitle(facts)}</span>
                {level !== null && (
                  <span className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: HARDEST_LEVEL }, (_, i) => (
                      <span key={i} className={`h-2.5 w-2.5 rounded-full border ${i < level ? 'border-ink-800 bg-ink-800' : 'border-slate-400 bg-white'}`} />
                    ))}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-700" data-maze-facts>
                {levelFacts(facts)}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ink-500">{LEVEL_NOTE}</p>
            </div>
          </div>
        </div>
      </div>

      {/* A maze in which a room cannot be reached: what is wrong, in the game's words, and what that
          means. (The box is always in the page, so that a screen reader says the note when it appears.) */}
      <div role="status" aria-live="polite" data-maze-practice={practice ? '' : undefined}>
        {practice && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
            <p className="font-bold">{practice.title}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {practice.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            <p className="mt-1">{practice.meaning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
