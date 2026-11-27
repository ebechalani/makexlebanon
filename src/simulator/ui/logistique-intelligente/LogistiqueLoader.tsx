'use client';

/**
 * Loads the simulator Logistique intelligente (Robot en fête 2027) - the regular mission of MakeX
 * Inspire 2024, "Smart Logistics", in French - in the browser only. (The same as
 * ../robot-en-fete/RobotEnFeteLoader.tsx, the loader of Tri d’entrepôt, with this simulator's
 * name.)
 *
 * The simulator remembers things in the browser (blocks, where the robot starts) and draws on a
 * canvas, so there is nothing useful the server could render for it. Loading it with
 * `ssr: false` also keeps Blockly, which needs a real browser, out of the server.
 *
 * What the server does send is the loading screen below: the title row with the page's heading
 * and its path on the site, in a frame as tall as the simulator will be (../page-frame.ts), so
 * nothing jumps when it appears. It is French already: the French words of the title row are set
 * above it (../text/title-context.tsx TitleTextContext, ../text/fr-title.tsx), and its frame says
 * lang="fr". The path on the site (Home / Simulator) is the title row's own French words:
 * "Accueil / Simulateur". Only those few words: the whole French table (../text/fr.tsx) is the
 * screen's, which LogistiqueSimulator.tsx loads - and a page of the site that links here may
 * fetch this file ahead.
 */
import dynamic from 'next/dynamic';
import { PAGE_FRAME } from '../page-frame';
import { FR_TITLE_TEXT } from '../text/fr-title';
import { PoweredByContext, TitleTextContext } from '../text/title-context';
import { TitleBar } from '../TitleBar';
import { LOGISTIQUE_TITLE } from './title';

function LoadingScreen() {
  return (
    <TitleTextContext.Provider value={FR_TITLE_TEXT}>
      <div className={PAGE_FRAME} lang="fr">
        <TitleBar title={LOGISTIQUE_TITLE} wrapOnPhone />
        <div className="flex flex-1 items-center justify-center p-6" role="status">
          <div className="flex items-center gap-3 text-ink-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
            <span className="text-sm font-semibold">Préparation du tapis et du robot…</span>
          </div>
        </div>
      </div>
    </TitleTextContext.Provider>
  );
}

const LogistiqueSimulator = dynamic(() => import('./LogistiqueSimulator'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

/**
 * `poweredBy`: who the title row names (content/standalone.ts `poweredBy` of Robot en fête 2027,
 * which the page hands over): set above the loading screen and the screen alike.
 */
export function LogistiqueLoader({ poweredBy }: { poweredBy: string }) {
  return (
    <PoweredByContext.Provider value={poweredBy}>
      <LogistiqueSimulator />
    </PoweredByContext.Provider>
  );
}
