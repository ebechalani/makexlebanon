'use client';

/**
 * Set the cube colours of Warehouse Sort by hand: the four warehouses laid out as they lie on
 * the mat (W1 and W2 at the top, W3 and W4 at the bottom), each with a red and a green button.
 *
 * A change that would leave only one colour on the field is refused with one plain sentence
 * (./arrangement-panel.ts): the rules want at least one red and one green cube.
 */
import { useState } from 'react';
import { WAREHOUSES, type WarehouseId } from '../../warehouse-sort/field';
import { CUBE_COLORS, encodeScenario, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { arrangementInWords, changeCube, WAREHOUSE_ROWS, warehouseName } from './arrangement-panel';

/** The colours of the cubes on the stage (game.ts draws them in the colours of the Fire Rescue buckets). */
const COLOR_CSS: Record<CubeColor, { fill: string; letter: string }> = {
  red: { fill: '#ef4044', letter: 'R' },
  green: { fill: '#40ad49', letter: 'G' },
};

interface CubeChipsProps {
  warehouse: WarehouseId;
  value: CubeColor;
  onPick: (color: CubeColor) => void;
}

/** Two square buttons, red and green; the chosen one has a dark ring. The letters make the colours readable without colour vision. */
function CubeChips({ warehouse, value, onPick }: CubeChipsProps) {
  return (
    <div role="radiogroup" aria-label={`Cube in ${warehouseName(warehouse)}`} className="flex gap-1.5">
      {CUBE_COLORS.map((color) => {
        const css = COLOR_CSS[color];
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            title={color}
            onClick={() => onPick(color)}
            style={{ background: css.fill }}
            data-cube={`${warehouse}-${color}`}
            className={
              // (the focus ring sits outside the dark ring of the chosen colour)
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white transition focus-visible:opacity-100 focus-visible:outline-offset-4 ' +
              (selected ? 'ring-2 ring-ink-900 ring-offset-2' : 'opacity-40 hover:opacity-80')
            }
          >
            {css.letter}
          </button>
        );
      })}
    </div>
  );
}

export interface ArrangementEditorProps {
  scenario: WarehouseSortScenario;
  onChange: (next: WarehouseSortScenario) => void;
}

export function ArrangementEditor({ scenario, onChange }: ArrangementEditorProps) {
  // the sentence of a refused change; it belongs to the arrangement it was said about
  // (a random or a default arrangement, or a code, makes it go away)
  const [refused, setRefused] = useState<{ problem: string; code: string } | null>(null);
  const code = encodeScenario(scenario);
  const problem = refused !== null && refused.code === code ? refused.problem : null;

  const pick = (warehouse: WarehouseId, color: CubeColor) => {
    if (scenario.cubes[warehouse] === color) return;
    const change = changeCube(scenario, warehouse, color);
    if (!change.ok) {
      setRefused({ problem: change.problem, code });
      return;
    }
    setRefused(null);
    onChange(change.scenario);
  };

  return (
    <fieldset className="rounded-lg border border-slate-200 p-2.5">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">The cubes in the warehouses</legend>
      {/* the four warehouses as they lie on the mat: two at the top, two at the bottom */}
      <div className="grid grid-cols-2 gap-2" data-warehouse-grid>
        {WAREHOUSE_ROWS.flat().map((warehouse) => (
          <div key={warehouse} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-slate-50 px-2 py-1.5">
            <span className="text-sm leading-tight text-ink-800">
              <span className="font-mono font-bold">{warehouse}</span>
              <span className="block text-xs text-ink-500">{WAREHOUSES[warehouse].place}</span>
            </span>
            <CubeChips warehouse={warehouse} value={scenario.cubes[warehouse]} onPick={(color) => pick(warehouse, color)} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600" data-arrangement-words>
        {arrangementInWords(scenario)}.
      </p>
      {problem && (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-700" data-arrangement-problem>
          {problem}
        </p>
      )}
    </fieldset>
  );
}
