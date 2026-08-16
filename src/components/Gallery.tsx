'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryImage } from '@/lib/gallery';

/** Thumbnails rendered before the "Show more" button appears. */
const PAGE_SIZE = 48;

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // The lightbox still steps through every image, not just the visible page.
  const shown = images.slice(0, visible);

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );

  // Focus management: remember the thumbnail that opened the lightbox, move
  // focus into the dialog while it is open, and restore it on close.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (index === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Tab' && dialogRef.current) {
        // Simple trap: keep Tab cycling through the dialog's own controls.
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      openerRef.current?.focus();
    };
  }, [index !== null, close, prev, next]); // eslint-disable-line react-hooks/exhaustive-deps

  if (images.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((image, i) => (
          <li key={image.src}>
            <button
              type="button"
              onClick={(e) => {
                openerRef.current = e.currentTarget;
                setIndex(i);
              }}
              className="group relative block aspect-4/3 w-full overflow-hidden rounded-lg bg-ink-100 ring-1 ring-slate-200"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="sr-only">Open photo: {image.alt}</span>
            </button>
          </li>
        ))}
      </ul>

      {visible < images.length ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-sm text-ink-500">
            Showing {shown.length} of {images.length} photos
          </p>
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, images.length))}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-900 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
          >
            Show more
          </button>
        </div>
      ) : null}

      {index !== null ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={images[index].alt}
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/95 p-4 outline-none"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <span className="sr-only">Close</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>

          {images.length > 1 ? (
            <>
              <NavButton side="left" onClick={prev} label="Previous photo" />
              <NavButton side="right" onClick={next} label="Next photo" />
            </>
          ) : null}

          <figure
            className="relative max-h-full w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mx-auto aspect-3/2 w-full">
              <Image
                src={images[index].src}
                alt={images[index].alt}
                fill
                sizes="(min-width: 1280px) 1024px, 100vw"
                priority
                className="object-contain"
              />
            </div>
            <figcaption className="mt-3 text-center text-sm text-white/60">
              {index + 1} / {images.length}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function NavButton({
  side,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 ${
        side === 'left' ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
      }`}
    >
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
        <path
          d={side === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Shown when a category folder has no photos yet. */
export function GalleryEmpty({ hint }: { hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-700">Photos coming soon</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}
