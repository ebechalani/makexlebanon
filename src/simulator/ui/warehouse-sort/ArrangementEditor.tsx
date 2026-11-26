'use client';

/**
 * Set the cube colours of Warehouse Sort by hand: the four warehouses laid out as they lie on
 * the mat (W1 and W2 at the top, W3 and W4 at the bottom), each with a red, a green and a blue
 * button.
 *
 * There is always exactly one blue cube: blue for another warehouse moves it there (the two
 * cubes swap colours, and a short sentence says so); a change that would leave no blue, no red
 * or no green cube is refused with one plain sentence (./arrangement-panel.ts).
 *
 * Its words are a game word list (`words`): left out, the English of Warehouse Sort; the page of
 * Robot en fête 2027 gives the French ones (../robot-en-fete/arrangement-words.ts).
 */
import { useMemo, useState } from 'react';
import { type WarehouseId } from '../../warehouse-sort/field';
import { CUBE_FILL } from '../../warehouse-sort/game';
import { CUBE_COLORS, encodeScenario, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { arrangementPanel, EN_ARRANGEMENT_PANEL, EN_ARRANGEMENT_WORDS, WAREHOUSE_ROWS, type ArrangementPanel, type ArrangementWords } from './arrangement-panel';


interface CubeChipsProps {
  warehouse: WarehouseId;
  value: CubeColor;
  onPick: (color: CubeColor) => void;
  words: ArrangementWords;
  panel: ArrangementPanel;
}

/** Three square buttons, red, green and blue, in the colours of the cubes on the stage; the chosen one has a dark ring. The letters make the colours readable without colour vision. */
function CubeChips({ warehouse, value, onPick, words, panel }: CubeChipsProps) {
  return (
    <div role="radiogroup" aria-label={words.chipsLabel(panel.warehouseName(warehouse))} className="flex gap-1.5">
      {CUBE_COLORS.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={words.color(color)}
            title={words.color(color)}
            onClick={() => onPick(color)}
            style={{ background: CUBE_FILL[color] }}
            data-cube={`${warehouse}-${color}`}
            className={
              // (the focus ring sits outside the dark ring of the chosen colour)
              'flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white transition focus-visible:opacity-100 focus-visible:outline-offset-4 ' +
              (selected ? 'ring-2 ring-ink-900 ring-offset-2' : 'opacity-40 hover:opacity-80')
            }
          >
            {words.letter(color)}
          </button>
        );
      })}
    </div>
  );
}

export interface ArrangementEditorProps {
  scenario: WarehouseSortScenario;
  onChange: (next: WarehouseSortScenario) => void;
  /** the words of the panel; left out: the English of Warehouse Sort */
  words?: ArrangementWords;
}

export function ArrangementEditor({ scenario, onChange, words = EN_ARRANGEMENT_WORDS }: ArrangementEditorProps) {
  const panel = useMemo(() => (words === EN_ARRANGEMENT_WORDS ? EN_ARRANGEMENT_PANEL : arrangementPanel(words)), [words]);
  // the sentence of a refused change, or of a change that changed a second cube (the blue cube
  // moved); it belongs to the arrangement it was said about - a random or a default arrangement,
  // or a code, makes it go away
  const [said, setSaid] = useState<{ text: string; refused: boolean; code: string } | null>(null);
  const code = encodeScenario(scenario);
  const shown = said !== null && said.code === code ? said : null;

  const pick = (warehouse: WarehouseId, color: CubeColor) => {
    if (scenario.cubes[warehouse] === color) return;
    const change = panel.changeCube(scenario, warehouse, color);
    if (!change.ok) {
      setSaid({ text: change.problem, refused: true, code });
      return;
    }
    setSaid(change.note ? { text: change.note, refused: false, code: encodeScenario(change.scenario) } : null);
    onChange(change.scenario);
  };

  return (
    <fieldset className="rounded-lg border border-slate-200 p-2.5">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">{words.legend}</legend>
      {/* the four warehouses as they lie on the mat: two at the top, two at the bottom */}
      <div className="grid grid-cols-2 gap-2" data-warehouse-grid>
        {WAREHOUSE_ROWS.flat().map((warehouse) => (
          <div key={warehouse} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-slate-50 px-2 py-1.5">
            <span className="text-sm leading-tight text-ink-800">
              <span className="font-mono font-bold">{words.warehouse(warehouse)}</span>
              <span className="block text-xs text-ink-500">{words.place(warehouse)}</span>
            </span>
            <CubeChips warehouse={warehouse} value={scenario.cubes[warehouse]} onPick={(color) => pick(warehouse, color)} words={words} panel={panel} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600" data-arrangement-words>
        {panel.arrangementInWords(scenario)}.
      </p>
      {shown?.refused && (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-700" data-arrangement-problem>
          {shown.text}
        </p>
      )}
      {/* (the blue cube moved: the cube that was blue changed too - said politely, it is no mistake) */}
      <p aria-live="polite" className="mt-1 text-xs font-medium text-sky-800 empty:hidden" data-arrangement-note>
        {shown && !shown.refused ? shown.text : ''}
      </p>
    </fieldset>
  );
}
