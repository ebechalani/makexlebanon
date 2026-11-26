'use client';

/**
 * The panel « Le terrain » of the Logistique intelligente screen: where everything stands at the
 * start, as a plain list. Nothing here can be changed, and there are no buttons: the regular
 * mission has ONE setup and nothing is drawn (rules p. 12/8: "10 Transport cubes are located in
 * the storage center with 2 layers, each layer have 5 cubes, placing as a “cross”" -
 * ../../logistique-intelligente/scenario.ts). The general screen shows this list alone in the
 * panel, without a code, Random or Default (SimulatorAppProps.fixedSetup), as Fire Fighter's.
 *
 * Every line is made from the field and the game (../../logistique-intelligente/field.ts
 * STORAGE_SQUARE_IDS, WAREHOUSE_IDS, WAREHOUSE_SIZE, WAREHOUSES; ../../logistique-intelligente/game.ts
 * cubeStart, CUBE_FILL): should one of them change, the list follows. The layers are « dessous /
 * dessus », never « en haut / en bas ». French typography: a no-break space before « : » and the
 * dash « – », and inside « ».
 */
import { STORAGE_SQUARE_IDS, WAREHOUSE_IDS, WAREHOUSE_SIZE, WAREHOUSES, type StorageSquare } from '../../logistique-intelligente/field';
import { CUBE_FILL, CUBE_NUMBERS, cubeStart } from '../../logistique-intelligente/game';
import { NB } from '../../logistique-intelligente/scenario';
import { inLetters, LOGISTIQUE_START_ZONE, WAREHOUSE_COUNT } from './words';

/** Where a square of the cross is, as the list says it after a cube's number: « 1 sur le carré du haut », « 2 à gauche ». */
export const SQUARE_PLACES: Readonly<Record<StorageSquare, string>> = {
  haut: 'sur le carré du haut',
  gauche: 'à gauche',
  centre: 'au centre',
  droite: 'à droite',
  bas: 'sur le carré du bas',
};

/** The cubes of one layer, in the order of the squares of the cross (haut, gauche, centre, droite, bas). */
const layerOf = (layer: 'dessous' | 'dessus'): number[] =>
  STORAGE_SQUARE_IDS.flatMap((square) => CUBE_NUMBERS.filter((n) => cubeStart(n).layer === layer && cubeStart(n).square === square));
const BOTTOM = layerOf('dessous');
const TOP = layerOf('dessus');
/** The bottom cube of the square a top cube starts on: the cube it stands on. */
const under = (n: number): number => BOTTOM.find((m) => cubeStart(m).square === cubeStart(n).square) ?? n;
/** « 1 à 5 » */
const span = (cubes: readonly number[]): string => `${cubes[0]} à ${cubes[cubes.length - 1]}`;
/** « E1, E2 et E3 » */
const listed = (items: readonly string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);
/** The warehouses printed as diamonds (E1 and E4). */
const DIAMONDS = WAREHOUSE_IDS.filter((w) => WAREHOUSES[w].turnedDeg !== 0);
/** mm in cm with a decimal comma: 40 -> "4". */
const cm = (mm: number): string => String(Math.round(mm) / 10).replace('.', ',');

/** The sentences of the list, as plain text (./words.test.ts reads them; the list below draws them). */
export const SETUP_LINES = {
  bottomLabel: `Cubes ${span(BOTTOM)} (dessous)${NB}:`,
  bottom: `${BOTTOM.map((n) => `${n} ${SQUARE_PLACES[cubeStart(n).square]}`).join(', ')}.`,
  topLabel: `Cubes ${span(TOP)} (dessus)${NB}:`,
  // (a no-break space before the dash, as FR_TEXT writes it: the dash never begins a line)
  top: `chacun sur un cube du dessous${NB}– ${TOP.map((n) => `${n} sur ${under(n)}`).join(', ')}.`,
  warehousesLabel: `Entrepôts${NB}:`,
  warehouses:
    `${WAREHOUSE_IDS[0]} à ${WAREHOUSE_IDS[WAREHOUSE_IDS.length - 1]}, ${inLetters(WAREHOUSE_COUNT)} carrés orange de ${cm(WAREHOUSE_SIZE)}${NB}cm. ` +
    `${listed(DIAMONDS)}, dans les coins du haut, sont tournés en losange.`,
  robot: `Le robot part de la ${LOGISTIQUE_START_ZONE}.`,
  // (« Replacer » is the screen's button, FR_TEXT.resetLabel: ./words.test.ts checks that they agree)
  note: `C’est la même chose à chaque match. «${NB}Replacer${NB}» remet tout en place.`,
} as const;

/** A small square in the colour of the cubes, in front of their lines (only a picture: the lines say what they are). */
function Chip() {
  return <span aria-hidden="true" style={{ background: CUBE_FILL }} className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/20" />;
}

export function SetupList() {
  return (
    <div className="flex flex-col gap-2" data-setup-list>
      <ul className="flex flex-col gap-1.5 text-sm leading-snug text-ink-700">
        <li className="flex gap-2" data-setup-layer="dessous">
          <Chip />
          <span>
            <span className="font-semibold text-ink-800">{SETUP_LINES.bottomLabel}</span> {SETUP_LINES.bottom}
          </span>
        </li>
        <li className="flex gap-2" data-setup-layer="dessus">
          <Chip />
          <span>
            <span className="font-semibold text-ink-800">{SETUP_LINES.topLabel}</span> {SETUP_LINES.top}
          </span>
        </li>
        {/* (in line with the words of the two lines above: past the width of a chip and its gap) */}
        <li className="pl-[1.375rem]" data-setup-warehouses>
          <span className="font-semibold text-ink-800">{SETUP_LINES.warehousesLabel}</span> {SETUP_LINES.warehouses}
        </li>
        <li className="pl-[1.375rem]">{SETUP_LINES.robot}</li>
      </ul>
      <p className="text-xs text-ink-500">{SETUP_LINES.note}</p>
    </div>
  );
}
