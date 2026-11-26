'use client';

/**
 * The context of the screen's word table (./types.ts), and the title row's way to read it.
 *
 * There is one context for the whole screen: `ScreenTextContext`. A page that sets no table
 * (every English page) leaves it empty, and the screen reads English: `useScreenText()`
 * (./context.tsx) gives the English table, `useTitleText()` the English words of the title row.
 * The French page sets the French table once, above the whole screen.
 *
 * The context is made here, in a file that imports no table, because the title row
 * (../TitleBar.tsx) is on the loading screen of every simulator page and the Simulator page
 * imports from it too: what it reads must stay small. The whole English table imports every text
 * function of the screen (the block catalog with them, for the notes about program files) - about
 * 100 kB that a loading screen would download before it is drawn. So the title row reads the same
 * context, with only its own English words (./en-title.tsx) to fall back on.
 *
 * ('use client' first: the title row is on pages whose page file is a Server Component, and a
 * context exists only on the client.)
 */
import { createContext, useContext } from 'react';
import { EN_TITLE_TEXT } from './en-title';
import type { ScreenText, TitleText } from './types';

/** The word table of the screen: empty (null) where a page sets none - the English table is read then. */
export const ScreenTextContext = createContext<ScreenText | null>(null);

/** The words of the title row, in the language of the screen. */
export const useTitleText = (): TitleText => useContext(ScreenTextContext) ?? EN_TITLE_TEXT;
