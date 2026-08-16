'use client';

import { useEffect, useState } from 'react';
import { videos } from '@content/outreach';

const hero = videos.find((v) => v.provider === 'vimeo');

/**
 * Looping, muted background film for the homepage hero.
 *
 * Rendered client-side and only after mount, so the page paints (and is
 * readable) before the player loads, and so it can be skipped entirely for
 * visitors who ask for reduced motion — an autoplaying video is exactly what
 * that preference is about.
 *
 * The iframe is sized to cover the hero regardless of its aspect ratio: it is
 * forced to at least 100vw and 56.25vw tall (16:9), and at least 177.78vh wide
 * for tall/narrow viewports, then centred.
 */
export function HeroVideo() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!hero) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (query.matches) return;

    // Let the hero text paint first.
    const timer = window.setTimeout(() => setEnabled(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hero || !enabled) return null;

  const src =
    `https://player.vimeo.com/video/${hero.id}` +
    `?h=${hero.hash}&background=1&autoplay=1&loop=1&autopause=0&muted=1` +
    `&title=0&byline=0&portrait=0&controls=0`;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden motion-safe:animate-[fadeIn_1.2s_ease-out_forwards] opacity-0"
      aria-hidden="true"
    >
      {/* scale-125 crops in past the film's burned-in subtitles, which would
          otherwise show through along the bottom of the hero. */}
      <iframe
        src={src}
        title="Background film of MakeX Lebanon competition highlights"
        tabIndex={-1}
        allow="autoplay; fullscreen"
        className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 scale-125 border-0"
      />
    </div>
  );
}
