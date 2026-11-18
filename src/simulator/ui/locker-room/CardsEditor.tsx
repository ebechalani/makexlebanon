'use client';

/**
 * Set the two cards of Locker Room by hand: the Team Colour card (RED or GREEN) and the Zone
 * Assignment card - by its number, 1 to 6, or by the colour of the token in each zone. The zones
 * are listed as they lie on the mat: C at the top, B, then A at the bottom.
 *
 * Every colour is in one zone only: a colour picked for a zone moves that token there, and the
 * token that was there takes its place (one plain sentence says so). What is not one of the six
 * zone cards is refused with one plain sentence (./cards-panel.ts).
 */
import { useState } from 'react';
import { TEAM_COLORS, type TeamColor, type ZoneId } from '../../locker-room/field';
import { CUBE_FILL, CUBE_LETTER } from '../../locker-room/game';
import { TOKEN_COLORS, ZONE_OPTIONS, ZONE_OPTION_NUMBERS, describeScenario, encodeScenario, tokensOf, type LockerRoomScenario, type TokenColor, type ZoneOption } from '../../locker-room/scenario';
import { changeOption, changeTeam, changeZone, COLOR_WORD, optionInWords, ZONE_PLACE, ZONES_TOP_DOWN, type CardChange } from './cards-panel';

/** The look of a choice: the chosen one has a dark ring, the others are pale until the pointer is on them. */
const choiceLook = (selected: boolean): string =>
  // (the focus ring sits outside the dark ring of the chosen one)
  'transition focus-visible:opacity-100 focus-visible:outline-offset-4 ' + (selected ? 'ring-2 ring-ink-900 ring-offset-2' : 'opacity-40 hover:opacity-80');

interface ColorChipsProps {
  zone: ZoneId;
  value: TokenColor;
  onPick: (color: TokenColor) => void;
}

/** Three square buttons, red, green and blue, in the colours of the tokens on the stage. The letters make the colours readable without colour vision. */
function ColorChips({ zone, value, onPick }: ColorChipsProps) {
  return (
    <div role="radiogroup" aria-label={`Token in zone ${zone}`} className="flex gap-1.5">
      {TOKEN_COLORS.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={COLOR_WORD[color]}
            title={COLOR_WORD[color]}
            onClick={() => onPick(color)}
            style={{ background: CUBE_FILL[color] }}
            data-zone-token={`${zone}-${color}`}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white ${choiceLook(selected)}`}
          >
            {CUBE_LETTER[color]}
          </button>
        );
      })}
    </div>
  );
}

export interface CardsEditorProps {
  scenario: LockerRoomScenario;
  onChange: (next: LockerRoomScenario) => void;
}

export function CardsEditor({ scenario, onChange }: CardsEditorProps) {
  // the sentence of a refused change, or of a change that moved a second token; it belongs to the
  // draw it was said about - a random or a default draw, or a code, makes it go away
  const [said, setSaid] = useState<{ text: string; refused: boolean; code: string } | null>(null);
  const code = encodeScenario(scenario);
  const shown = said !== null && said.code === code ? said : null;
  const tokens = tokensOf(scenario);

  const use = (change: CardChange) => {
    if (!change.ok) {
      setSaid({ text: change.problem, refused: true, code });
      return;
    }
    setSaid(change.note ? { text: change.note, refused: false, code: encodeScenario(change.scenario) } : null);
    if (encodeScenario(change.scenario) !== code) onChange(change.scenario);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Team Colour card</legend>
        <div role="radiogroup" aria-label="Team colour" className="flex gap-2">
          {TEAM_COLORS.map((team: TeamColor) => {
            const selected = team === scenario.team;
            return (
              <button
                key={team}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => use(changeTeam(scenario, team))}
                style={{ background: CUBE_FILL[team] }}
                data-team={team}
                className={`h-9 min-w-[5.5rem] rounded-md px-3 text-sm font-bold text-white ${choiceLook(selected)}`}
              >
                {COLOR_WORD[team]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-2.5">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">Zone Assignment card</legend>
        {/* the six cards of the rules, each with its three colours in zone order A, B, C */}
        <div role="radiogroup" aria-label="Zone card" className="grid grid-cols-3 gap-1.5 min-[26rem]:grid-cols-6" data-zone-options>
          {ZONE_OPTION_NUMBERS.map((option: ZoneOption) => {
            const selected = option === scenario.option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Option ${option}: ${optionInWords(option)}`}
                title={`Option ${option}: ${optionInWords(option)}`}
                onClick={() => use(changeOption(scenario, option))}
                data-option={option}
                className={`flex flex-col items-center gap-1 rounded-md border border-slate-300 bg-white px-1 py-1 ${choiceLook(selected)}`}
              >
                <span className="text-sm font-bold text-ink-800">{option}</span>
                <span className="flex gap-0.5" aria-hidden="true">
                  {(['A', 'B', 'C'] as const).map((zone) => (
                    <span key={zone} className="h-2.5 w-2.5 rounded-sm" style={{ background: CUBE_FILL[ZONE_OPTIONS[option][zone]] }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        {/* the three zones as they lie on the mat, from the top down */}
        <div className="mt-2 flex flex-col gap-1.5" data-zones>
          {ZONES_TOP_DOWN.map((zone) => (
            <div key={zone} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-slate-50 px-2 py-1.5">
              <span className="text-sm leading-tight text-ink-800">
                <span className="font-bold">Zone {zone}</span>
                <span className="text-xs text-ink-500"> {ZONE_PLACE[zone]}</span>
              </span>
              <ColorChips zone={zone} value={tokens[zone]} onPick={(color) => use(changeZone(scenario, zone, color))} />
            </div>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-ink-600" data-draw-words>
        {describeScenario(scenario)}
      </p>
      {shown?.refused && (
        <p role="alert" className="text-xs font-medium text-rose-700" data-draw-problem>
          {shown.text}
        </p>
      )}
      {/* (a token moved: the token that was in that zone moved too - said politely, it is no mistake) */}
      <p aria-live="polite" className="text-xs font-medium text-sky-800 empty:hidden" data-draw-note>
        {shown && !shown.refused ? shown.text : ''}
      </p>
    </div>
  );
}
