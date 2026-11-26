'use client';

/**
 * Loads the Robot en fête 2027 simulator - Warehouse Sort in French - in the browser only. (The
 * same as ../warehouse-sort/WarehouseSortLoader.tsx, in French.)
 *
 * The simulator remembers things in the browser (blocks, cube colours, where the robot starts)
 * and draws on a canvas, so there is nothing useful the server could render for it. Loading it
 * with `ssr: false` also keeps Blockly, which needs a real browser, out of the server.
 *
 * What the server does send is the loading screen below: the title row with the page's heading
 * and its path on the site, in a frame as tall as the simulator will be (../page-frame.ts), so
 * nothing jumps when it appears. It is French already: the French word table is set above it
 * (the same context the screen sets, ../text/context.tsx), and its frame says lang="fr". The path
 * on the site (Home / Simulator) is the title row's own French words: "Accueil / Simulateur".
 */
import dynamic from 'next/dynamic';
import { PAGE_FRAME } from '../page-frame';
import { ScreenTextContext } from '../text/context';
import { FR_TEXT } from '../text/fr';
import { TitleBar } from '../TitleBar';

function LoadingScreen() {
  return (
    <ScreenTextContext.Provider value={FR_TEXT}>
      <div className={PAGE_FRAME} lang="fr">
        <TitleBar title="Robot en fête 2027" wrapOnPhone />
        <div className="flex flex-1 items-center justify-center p-6" role="status">
          <div className="flex items-center gap-3 text-ink-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
            <span className="text-sm font-semibold">Préparation du tapis et du robot…</span>
          </div>
        </div>
      </div>
    </ScreenTextContext.Provider>
  );
}

const RobotEnFeteSimulator = dynamic(() => import('./RobotEnFeteSimulator'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export function RobotEnFeteLoader() {
  return <RobotEnFeteSimulator />;
}
