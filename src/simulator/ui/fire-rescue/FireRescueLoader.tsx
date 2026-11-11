'use client';

/**
 * Loads the Fire Rescue simulator in the browser only.
 *
 * The simulator remembers things in the browser (blocks, combination, where the robot starts)
 * and draws on a canvas, so there is nothing useful the server could render for it. Loading it
 * with `ssr: false` also keeps Blockly, which needs a real browser, out of the server.
 *
 * What the server does send is the loading screen below: the title row with the page's heading
 * and its path on the site, in a frame as tall as the simulator will be (../page-frame.ts), so
 * nothing jumps when it appears.
 */
import dynamic from 'next/dynamic';
import { PAGE_FRAME } from '../page-frame';
import { TitleBar } from '../TitleBar';

function LoadingScreen() {
  return (
    <div className={PAGE_FRAME}>
      <TitleBar title="Fire Rescue" />
      <div className="flex flex-1 items-center justify-center p-6" role="status">
        <div className="flex items-center gap-3 text-ink-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold">Getting the mat and the robot ready…</span>
        </div>
      </div>
    </div>
  );
}

const FireRescueSimulator = dynamic(() => import('./FireRescueSimulator'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export function FireRescueLoader() {
  return <FireRescueSimulator />;
}
