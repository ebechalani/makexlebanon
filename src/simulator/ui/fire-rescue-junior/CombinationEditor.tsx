'use client';

/**
 * Set up a Fire Rescue Junior combination by hand: which coloured bucket stands on each water
 * tower W1..W4. That is all a Junior combination is (../../fire-rescue-junior/scenario.ts).
 *
 * The people are shown too, so that the student sees where they stand - but as a plain list,
 * not as buttons: in Fire Rescue Junior they always stand where the rule book shows them, and
 * nothing here can move them.
 *
 * Each bucket colour exists exactly once, so picking a colour swaps it with the tower that had it
 * before (the same as in Fire Rescue Senior: ../fire-rescue/CombinationEditor.tsx).
 */
import { BUILDINGS, BUILDING_IDS, WATER_TOWER_IDS } from '../../fire-rescue/field';
import { withBucket, type FireRescueScenario } from '../../fire-rescue/scenario';
import { rulebookPeople } from '../../fire-rescue-junior/scenario';
import { COLOR_CSS, ColorChips } from '../fire-rescue/CombinationEditor';

export interface JuniorCombinationEditorProps {
  scenario: FireRescueScenario;
  onChange: (next: FireRescueScenario) => void;
}

export function JuniorCombinationEditor({ scenario, onChange }: JuniorCombinationEditorProps) {
  // (the people of the rule book, not of `scenario`: they are what a Junior match always has)
  const people = rulebookPeople();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Buckets on the water towers</legend>
        <ul className="flex flex-col gap-2">
          {WATER_TOWER_IDS.map((tower) => (
            <li key={tower} className="flex items-center justify-between gap-2">
              <span className="w-8 font-mono text-sm font-bold text-ink-800">{tower}</span>
              <ColorChips label={`Bucket on water tower ${tower}`} value={scenario.buckets[tower]} onChange={(color) => onChange(withBucket(scenario, tower, color))} />
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5" data-fixed-people>
        <p id="junior-fixed-people" className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          People at the buildings
        </p>
        <ul className="mt-1.5 flex flex-col gap-2" aria-labelledby="junior-fixed-people">
          {BUILDING_IDS.map((building) => {
            const person = people[building];
            const css = COLOR_CSS[person.color];
            return (
              <li key={building} className="flex items-center gap-2 text-sm text-ink-700">
                <span className="w-5 font-mono font-bold text-ink-800" title={`${BUILDINGS[building].name} - wants the ${BUILDINGS[building].color} bucket`}>
                  {building}
                </span>
                <span
                  aria-hidden="true"
                  style={{ background: css.fill, color: css.ink }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                >
                  {css.letter}
                </span>
                <span>
                  {person.color} person in square {person.slot}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-ink-500 sm:col-span-2">
        In Fire Rescue Junior only the buckets are drawn. The people always stand where the rule book shows them: in square 1,
        the left one. The water goes into square 2. Every bucket colour exists once, so choosing a colour swaps it with the
        tower that had it.
      </p>
    </div>
  );
}
