'use client';

/**
 * Where a shared part of the simulator screen gets its word table (./types.ts):
 * `const text = useScreenText();`
 *
 * Where no page sets a table, the screen reads the English one: every English page - which sets
 * no provider - reads English, as do the tests that draw a part of the screen on its own. The
 * French page hands the French table to the screen, which sets it once, above the whole screen
 * (../SimulatorApp.tsx `text={FR_TEXT}`; the loading screen of that page sets only the French words
 * of the title row: ./title-context.tsx). The language of the table is `useScreenText().locale`.
 *
 * (The context itself is made in ./title-context.tsx, which the title row reads without the whole
 * English table: see there. It is the same context object, so one provider sets both.)
 *
 * ('use client' first: the parts that read this context are on pages whose page file is a Server
 * Component, and a context exists only on the client.)
 */
import { useContext } from 'react';
import { EN_TEXT } from './en';
import { ScreenTextContext } from './title-context';
import type { ScreenText } from './types';

export { ScreenTextContext };

export const useScreenText = (): ScreenText => useContext(ScreenTextContext) ?? EN_TEXT;
