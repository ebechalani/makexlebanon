'use client';

/**
 * The panel "The field" of the Fire Fighter screen: where everything stands at the start, as a
 * plain list. Nothing here can be changed, and there are no buttons: Fire Fighter has ONE setup
 * and nothing is drawn (the rules, §3; the organiser: "Always the same: no draw of the letters" -
 * ../../fire-fighter/scenario.ts). The general screen shows this list alone in the panel, without
 * a code, Random or Default (SimulatorAppProps.fixedSetup).
 *
 * The towers are named from the one table of the field (../../fire-fighter/field.ts TOWER_NAMES,
 * TOWER_PLACES), and the small squares in front of the cubes have the colours the stage draws them
 * in (../../fire-fighter/game.ts CUBE_FILL): should either ever change, the list follows.
 */
import { TOWER_IDS, TOWER_NAMES, TOWER_PLACES } from '../../fire-fighter/field';
import { CUBE_FILL, type CubeColor } from '../../fire-fighter/game';
import { FIRE_FIGHTER_START_ZONE } from './words';

/** A small square in the colour of a cube, in front of its line (only a picture: the line says the colour in words). */
function Chip({ color }: { color: CubeColor }) {
  return <span aria-hidden="true" style={{ background: CUBE_FILL[color] }} className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/20" />;
}

export function SetupList() {
  return (
    <div className="flex flex-col gap-2" data-setup-list>
      <ul className="flex flex-col gap-1.5 text-sm leading-snug text-ink-700">
        <li className="flex gap-2">
          <Chip color="red" />
          <span>
            <span className="font-semibold text-ink-800">Red cubes:</span> one on each of the two squares of the left bay and of the right bay.
          </span>
        </li>
        <li className="flex gap-2">
          <Chip color="yellow" />
          <span>
            <span className="font-semibold text-ink-800">Yellow cube:</span> on the red square above the {FIRE_FIGHTER_START_ZONE}.
          </span>
        </li>
        {/* (in line with the words of the two lines above: past the width of a colour square and its gap) */}
        <li className="pl-[1.375rem]">
          <span className="font-semibold text-ink-800">Towers:</span>{' '}
          {TOWER_IDS.map((tower, i) => (
            <span key={tower} data-tower={tower}>
              <span className="font-bold text-ink-900">{tower}</span> {TOWER_NAMES[tower]} ({TOWER_PLACES[tower]}){i < TOWER_IDS.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </li>
        <li className="pl-[1.375rem]">The robot starts in the {FIRE_FIGHTER_START_ZONE}.</li>
      </ul>
      <p className="text-xs text-ink-500">It is the same in every match. &quot;Reset field&quot; puts all of it back.</p>
    </div>
  );
}
