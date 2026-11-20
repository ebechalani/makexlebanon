/**
 * The banner (design 7.6): one sentence, two lines at most, read out politely by a screen reader.
 * Which sentence is ./banner.ts's choice; this only draws it.
 */
export function Banner({ sentence, tone }: { sentence: string; tone: 'calm' | 'match' | 'refused' | 'end' }) {
  const look =
    tone === 'refused'
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : tone === 'match'
        ? 'border-brand-200 bg-brand-50 text-ink-900'
        : tone === 'end'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
          : 'border-slate-200 bg-white text-ink-800';
  return (
    <p role="status" aria-live="polite" data-banner className={`cadet-banner rounded-xl border px-3 text-sm font-semibold leading-snug ${look}`}>
      <span className="line-clamp-2">{sentence}</span>
    </p>
  );
}
