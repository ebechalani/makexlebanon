/**
 * The score in pictures, for the child (design 7.9): eight small round pictures in one line. They
 * are not buttons.
 *
 *   - the Water, the Cat, the Injured Person, the Equipment and a little house for "robot home":
 *     grey until earned, then in colour with a white tick on a green badge;
 *   - the three obstacles: pale until the robot touched one, then in colour with a red "-1"; one
 *     that only an item touched (no point here: lead decision D1) in colour with an amber "!", for
 *     on the real map the road stays closed.
 *
 * Everything comes from the referee's own score sheet: the item lines and the return line by their
 * ids (../../fire-cadet/game.ts), the obstacles from the sheet's list of the obstacles the robot
 * touched (obstaclesTouched) and of those only an item touched (obstaclesPushed). Nothing is said by colour alone: an earned picture gets a tick, a
 * touched obstacle a "-1", and each picture has its words for a screen reader.
 */
import type { ScoreReport } from '../../core/types';
import { obstaclesPushed, obstaclesTouched } from '../../fire-cadet/game';
import { ITEM_NAMES, OBSTACLE_KINDS, type ItemName } from '../../fire-cadet/scenario';
import { Picture, TickBadge, type PictureName } from './pictures';
import { CADET_WORDS, STRIP_WORDS, THING_WORDS } from './words';

/** The pictures of the strip that stand for a line of the score sheet, by the line's id. */
export const STRIP_LINES: readonly (ItemName | 'return')[] = [...ITEM_NAMES, 'return'];

/** What each picture of the strip says: [line id or obstacle, earned or touched, only touched by an item, its words]. */
export function stripState(score: ScoreReport): { id: string; picture: PictureName; on: boolean; pushed: boolean; label: string }[] {
  const words = CADET_WORDS.score;
  const touched = obstaclesTouched(score);
  const pushed = obstaclesPushed(score);
  return [
    ...STRIP_LINES.map((id) => {
      const on = score.lines.some((line) => line.id === id && line.ok);
      const name = STRIP_WORDS[id];
      return { id, picture: (id === 'return' ? 'home' : id) as PictureName, on, pushed: false, label: on ? words.done(name) : words.notYet(name) };
    }),
    ...OBSTACLE_KINDS.map((kind) => {
      const on = touched.includes(kind);
      const byItem = !on && pushed.includes(kind);
      const name = THING_WORDS[kind];
      return { id: kind, picture: kind as PictureName, on, pushed: byItem, label: on ? words.touched(name) : byItem ? words.pushed(name) : words.notTouched(name) };
    }),
  ];
}

export function ScoreStrip({ score, className = '' }: { score: ScoreReport; className?: string }) {
  const pictures = stripState(score);
  return (
    <div role="group" aria-label={CADET_WORDS.score.stripLabel} className={`flex items-center gap-1.5 ${className}`}>
      {pictures.map((p, i) => {
        const obstacle = i >= STRIP_LINES.length;
        return (
          <span
            key={p.id}
            aria-label={p.label}
            role="img"
            data-strip={p.id}
            data-on={p.on ? 'true' : 'false'}
            data-pushed={p.pushed ? 'true' : undefined}
            className={`relative shrink-0 ${obstacle && i === STRIP_LINES.length ? 'ml-2' : ''}`}
          >
            <Picture name={p.picture} muted={!p.on && !p.pushed} className="h-8 w-8">
              {!obstacle && p.on && <TickBadge />}
            </Picture>
            {obstacle && p.on && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">
                {CADET_WORDS.score.minus}
              </span>
            )}
            {obstacle && p.pushed && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-4 text-ink-950">
                {CADET_WORDS.score.pushedMark}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
