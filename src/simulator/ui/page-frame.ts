/**
 * The frame of a simulator page on the website.
 *
 * The simulator fills the window below the site's sticky header, so every height in it starts
 * from "the height of the window minus the header". The header (src/components/Header.tsx) is
 * 4rem tall on phones and 5rem from 640px up, plus its 1px bottom line. If the header ever
 * changes height, change the two numbers below and nothing else: the size of the mat, the width
 * of the stage column and the height of the "Rules" panel (all in simulator.css) follow
 * --mbot2-window.
 *
 * These are Tailwind classes and not rules in simulator.css because the loading screen needs
 * them too, and it is on the page before the simulator and its stylesheet have arrived.
 */
export const PAGE_FRAME =
  'mbot2-app flex flex-col bg-slate-100 ' +
  // the height of the site header: on phones, then from 640px up
  '[--mbot2-site-header:calc(4rem_+_1px)] sm:[--mbot2-site-header:calc(5rem_+_1px)] ' +
  // what is left of the window under it
  '[--mbot2-window:calc(100dvh_-_var(--mbot2-site-header))] ' +
  // at least that tall; exactly that tall once blocks and stage stand side by side
  'min-h-[var(--mbot2-window)] lg:h-[var(--mbot2-window)]';
