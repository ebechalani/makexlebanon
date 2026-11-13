'use client';

/**
 * The maze of a Fire Chief round, as far as it can be chosen without an editor:
 *   - one of the ready-made mazes of the game (the default maze, the open field and three more),
 *   - the room of the fire and its place in that room,
 *   - and one line that says what is on the stage now.
 *
 * "Random maze", the code of the maze and the box to type a code in are in the general
 * Combination panel around this one (../CombinationPanel.tsx).
 *
 * This is a stand-in: the maze editor (walls set by hand) will take its place.
 */
import { FIRE_SPOTS, ROOM_IDS, type FireSpot, type RoomId } from '../../fire-chief/field';
import { describeScenario, withFire, type FireChiefScenario } from '../../fire-chief/scenario';
import { MAZE_CHOICES, mazeChoiceOf, ROOM_LABEL, SPOT_LABEL, withMaze } from './maze-choices';

/**
 * One choice of a group of which exactly one is chosen (the same look as the squares of the Fire
 * Rescue editor). The colours change at once, without fading: while two choices fade into each
 * other it cannot be read which one is chosen.
 */
function choiceClass(selected: boolean): string {
  return (
    'rounded-md border px-2 py-1 text-xs font-semibold focus-visible:relative focus-visible:z-10 ' +
    (selected ? 'border-ink-800 bg-ink-800 text-white' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50')
  );
}

export interface MazePickerProps {
  scenario: FireChiefScenario;
  onChange: (next: FireChiefScenario) => void;
}

export function MazePicker({ scenario, onChange }: MazePickerProps) {
  const chosen = mazeChoiceOf(scenario);
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Maze</legend>
        <div role="radiogroup" aria-label="Ready-made mazes" className="flex flex-wrap gap-1.5">
          {MAZE_CHOICES.map((choice) => {
            const selected = chosen?.id === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                title={choice.about}
                onClick={() => onChange(withMaze(scenario, choice))}
                className={choiceClass(selected)}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-snug text-ink-600" data-maze-about>
          {chosen ? chosen.about : 'Another maze: a random one, or one from a code.'}
        </p>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Fire</legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-600">Room</span>
            <div role="radiogroup" aria-label="Room of the fire" className="flex gap-1.5">
              {ROOM_IDS.map((room: RoomId) => (
                <button
                  key={room}
                  type="button"
                  role="radio"
                  aria-checked={scenario.fireRoom === room}
                  onClick={() => onChange(withFire(scenario, room))}
                  className={choiceClass(scenario.fireRoom === room)}
                >
                  {ROOM_LABEL[room]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-600">Place</span>
            <div role="radiogroup" aria-label="Place of the fire in its room" className="flex gap-1.5">
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

      {/* what is on the stage now, in the game's own words */}
      <p className="text-xs leading-snug text-ink-600" data-maze-description>
        {describeScenario(scenario)}
      </p>
    </div>
  );
}
