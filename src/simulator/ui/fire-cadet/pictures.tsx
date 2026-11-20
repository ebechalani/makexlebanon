/**
 * The small pictures of Fire Cadet: the four rescue items, the robot's home, the three obstacles
 * and the Fire (design 8.3). They are our own simple drawings, in the colours seen at the
 * organiser's events - no artwork of the maker and no photo is copied.
 *
 * The same drawing is used everywhere, so a thing looks the same on the stage (./paint.ts draws
 * these very paths on the canvas), on the score strip, in the own-map editor and in the Rules
 * window. Items are ROUND tokens with a white ring and obstacles are SQUARE tokens, so the two
 * differ without colour.
 *
 * Every picture is drawn in a box of 24 x 24 units: a token (or nothing, for the Fire), then
 * layers of paths. Decoration only: whatever shows one also has words (an aria-label or a text).
 */
import type { ReactNode } from 'react';

export type PictureName = 'water' | 'cat' | 'person' | 'equipment' | 'home' | 'road-closed' | 'fallen-tree' | 'broken-vehicle' | 'fire';

/** One path of a picture, in the 24 x 24 box. */
export interface PictureLayer {
  d: string;
  fill: string;
}

export interface PictureArt {
  /** the token under the drawing: a round one (items), a square one (obstacles), or none (the Fire) */
  token: 'round' | 'square' | 'none';
  /** the colour of the token */
  fill: string;
  /** its edge */
  edge: string;
  layers: readonly PictureLayer[];
}

const WHITE = '#ffffff';

/**
 * The colours of the tokens (design 8.3): the same as the game gives its elements
 * (../../fire-cadet/game.ts), so the stand-in drawing of the stage and the pictures agree.
 */
export const TOKEN_FILL = {
  water: '#2563eb',
  cat: '#f97316',
  person: '#db2777',
  equipment: '#0f766e',
  home: '#0084c2',
  'road-closed': '#f8fafc',
  'fallen-tree': '#bbf7d0',
  'broken-vehicle': '#d1d5db',
} as const;

export const PICTURES: Readonly<Record<PictureName, PictureArt>> = {
  water: {
    token: 'round',
    fill: TOKEN_FILL.water,
    edge: '#1e3a8a',
    layers: [{ d: 'M12 4.2c0 0-5.4 6.1-5.4 9.9a5.4 5.4 0 0 0 10.8 0c0-3.8-5.4-9.9-5.4-9.9z', fill: WHITE }],
  },
  cat: {
    token: 'round',
    fill: TOKEN_FILL.cat,
    edge: '#9a3412',
    layers: [
      { d: 'M6.2 8.6 6.6 4.6l3.6 2.7a8 8 0 0 1 3.6 0l3.6-2.7.4 4a6.6 6.6 0 0 1 1.6 4.4c0 3.9-2.9 6.4-7.4 6.4s-7.4-2.5-7.4-6.4a6.6 6.6 0 0 1 1.6-4.4z', fill: WHITE },
      { d: 'M8.6 12.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0zM13.2 12.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0zM11.2 14.6h1.6l-.8.9z', fill: TOKEN_FILL.cat },
    ],
  },
  person: {
    token: 'round',
    fill: TOKEN_FILL.person,
    edge: '#831843',
    layers: [
      { d: 'M12 4.4a2.9 2.9 0 1 1 0 5.8a2.9 2.9 0 1 1 0-5.8zM6.6 19.4c0-4.3 2.4-7.3 5.4-7.3s5.4 3 5.4 7.3z', fill: WHITE },
      { d: 'M11.3 13.6h1.4v1.5h1.5v1.4h-1.5V18h-1.4v-1.5H9.8v-1.4h1.5z', fill: TOKEN_FILL.person },
    ],
  },
  equipment: {
    token: 'round',
    fill: TOKEN_FILL.equipment,
    edge: '#134e4a',
    layers: [
      { d: 'M5 10.2h14v8.4H5zM9 10.2V7.4h6v2.8h-1.6V9h-2.8v1.2z', fill: WHITE },
      { d: 'M5 13.4h14v1.2H5z', fill: TOKEN_FILL.equipment },
    ],
  },
  home: {
    token: 'round',
    fill: TOKEN_FILL.home,
    edge: '#0b496b',
    layers: [
      { d: 'M12 4.6 19.6 11h-2.1v8H6.5v-8H4.4z', fill: WHITE },
      { d: 'M10.6 14.6h2.8V19h-2.8z', fill: TOKEN_FILL.home },
    ],
  },
  'road-closed': {
    token: 'square',
    fill: TOKEN_FILL['road-closed'],
    edge: '#64748b',
    layers: [
      { d: 'M6.2 13.6h1.6v5.2H6.2zM16.2 13.6h1.6v5.2h-1.6zM4.8 18.4h4.4v1.4H4.8zM14.8 18.4h4.4v1.4h-4.4z', fill: '#334155' },
      { d: 'M3.8 8.4h16.4v5.4H3.8z', fill: '#dc2626' },
      { d: 'M7.6 8.4h2.4l-2.7 5.4H4.9zM12.4 8.4h2.4l-2.7 5.4H9.7zM17.2 8.4h2.4l-2.7 5.4h-2.4z', fill: WHITE },
    ],
  },
  'fallen-tree': {
    token: 'square',
    fill: TOKEN_FILL['fallen-tree'],
    edge: '#166534',
    layers: [
      { d: 'M3.8 13.2h11.4a1.9 1.9 0 0 1 0 3.8H3.8a1.9 1.9 0 0 1 0-3.8z', fill: '#92400e' },
      { d: 'M16.6 7.6a3.6 3.6 0 1 1 0 7.2a3.6 3.6 0 1 1 0-7.2zM18.6 11.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2zM14.2 10.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z', fill: '#15803d' },
    ],
  },
  'broken-vehicle': {
    token: 'square',
    fill: TOKEN_FILL['broken-vehicle'],
    edge: '#4b5563',
    layers: [
      { d: 'M16.4 4.6a2 2 0 0 1 3.4 1.4a1.8 1.8 0 0 1-.6 3.4H15a1.7 1.7 0 0 1-.2-3.4a2 2 0 0 1 1.6-1.4z', fill: '#6b7280' },
      { d: 'M3.4 14l1.8-3.8h9.4l2.8 3.8h2.8v3.8H3.4z', fill: '#dc2626' },
      { d: 'M6.4 11.4h3.4v2.4H5.4zM11 11.4h3.2l1.7 2.4H11z', fill: '#e0f2fe' },
      { d: 'M7 16.2a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0-3.8zM16.4 16.2a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0-3.8z', fill: '#1f2937' },
    ],
  },
  fire: {
    token: 'none',
    fill: '#f97316',
    edge: '#9a3412',
    layers: [
      { d: 'M12 2.6c1.1 3.4 6 5.6 6 11a6 6 0 0 1-12 0c0-2.8 1.5-4.5 2.8-5.8.2 1.9 1.1 3 2.1 3.4-.6-3.2.2-6.2 1.1-8.6z', fill: '#f97316' },
      { d: 'M12 11.2c.8 1.9 3 3 3 5.3a3 3 0 0 1-6 0c0-1.5.9-2.6 1.7-3.2.2.8.6 1.3 1.1 1.5.1-1.7.1-2.8.2-3.6z', fill: '#fde047' },
    ],
  },
};

/** The token of a picture, in the 24 x 24 box (a round token leaves a white ring inside its edge). */
export const TOKEN_ROUND = { cx: 12, cy: 12, r: 11.4, ring: 10, ringWidth: 1.4 } as const;
export const TOKEN_SQUARE = { x: 0.8, y: 0.8, size: 22.4, radius: 4.5 } as const;

export interface PictureProps {
  name: PictureName;
  className?: string;
  /** grey and pale: an item not delivered yet, an obstacle not touched (the score strip) */
  muted?: boolean;
  children?: ReactNode;
}

/** One picture as inline SVG. */
export function Picture({ name, className = 'h-6 w-6', muted = false, children }: PictureProps) {
  const art = PICTURES[name];
  const fill = muted && art.token === 'round' ? '#cbd5e1' : art.fill;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" opacity={muted && art.token !== 'round' ? 0.45 : undefined}>
      {art.token === 'round' && (
        <>
          <circle cx={TOKEN_ROUND.cx} cy={TOKEN_ROUND.cy} r={TOKEN_ROUND.r} fill={fill} stroke={muted ? '#94a3b8' : art.edge} strokeWidth={0.8} />
          <circle cx={TOKEN_ROUND.cx} cy={TOKEN_ROUND.cy} r={TOKEN_ROUND.ring} fill="none" stroke={WHITE} strokeWidth={TOKEN_ROUND.ringWidth} />
        </>
      )}
      {art.token === 'square' && (
        <rect x={TOKEN_SQUARE.x} y={TOKEN_SQUARE.y} width={TOKEN_SQUARE.size} height={TOKEN_SQUARE.size} rx={TOKEN_SQUARE.radius} fill={art.fill} stroke={art.edge} strokeWidth={0.8} />
      )}
      {art.layers.map((layer, i) => (
        <path key={i} d={layer.d} fill={muted && art.token === 'round' && layer.fill !== WHITE ? fill : layer.fill} />
      ))}
      {children}
    </svg>
  );
}

/** A white tick on a green badge (an earned score picture) - drawn in the same 24 x 24 box, at the lower right. */
export function TickBadge() {
  return (
    <g>
      <circle cx={18.5} cy={18.5} r={5} fill="#16a34a" stroke={WHITE} strokeWidth={1.2} />
      <path d="M16.2 18.6l1.6 1.6 3-3.2" fill="none" stroke={WHITE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
