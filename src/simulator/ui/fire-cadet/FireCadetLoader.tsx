'use client';

/**
 * Loads the Fire Cadet simulator in the browser only (the pattern of ../locker-room/LockerRoomLoader.tsx).
 *
 * The simulator remembers things in the browser (the row of cards, the map) and draws on a canvas,
 * so there is nothing useful the server could render for it. What the server does send is the
 * loading screen below: the title row with the page's heading and its path on the site, in a
 * frame as tall as the simulator will be (../page-frame.ts), so nothing jumps when it appears.
 */
import dynamic from 'next/dynamic';
import { PAGE_FRAME } from '../page-frame';
import { TitleBar } from '../TitleBar';
import { CADET_WORDS } from './words';

function LoadingScreen() {
  return (
    <div className={PAGE_FRAME}>
      <TitleBar title="Fire Cadet" robot="mTiny" />
      <div className="flex flex-1 items-center justify-center p-6" role="status">
        <div className="flex items-center gap-3 text-ink-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold">{CADET_WORDS.loading}</span>
        </div>
      </div>
    </div>
  );
}

const FireCadetSimulator = dynamic(() => import('./FireCadetSimulator'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export function FireCadetLoader() {
  return <FireCadetSimulator />;
}
