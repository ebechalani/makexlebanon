'use client';

/**
 * Where a shared part of the simulator screen gets its word table (./types.ts):
 * `const text = useScreenText();`
 *
 * The default value is the English table, so every English page - which sets no provider - reads
 * English, as do the tests that draw a part of the screen on its own. The French page sets the
 * French table once, above the whole screen (../SimulatorApp.tsx `locale="fr"`, and the loader of
 * its page). The language of the table is `useScreenText().locale`.
 *
 * ('use client' first: the parts that read this context are on pages whose page file is a Server
 * Component, and a context exists only on the client.)
 */
import { createContext, useContext } from 'react';
import { EN_TEXT } from './en';
import type { ScreenText } from './types';

export const ScreenTextContext = createContext<ScreenText>(EN_TEXT);

export const useScreenText = (): ScreenText => useContext(ScreenTextContext);
