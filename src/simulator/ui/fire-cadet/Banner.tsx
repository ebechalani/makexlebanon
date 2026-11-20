/**
 * The banner (design 7.6): one sentence, read out politely by a screen reader - three lines at
 * most on a phone, two on the classroom screen (fire-cadet.css, cadet-banner-text). Which sentence
 * is ./banner.ts's choice; this only draws it.
 *
 * `announce` is a number the screen counts up each time it says something anew (a refusal, a
 * note): the sentence is then put in as a new piece of text, so that a screen reader reads it out
 * again even when it is the same as the one before ("One number card for each arrow." twice). A
 * live region speaks when its text is added, not when the same text stays.
 */
export function Banner({ sentence, tone, announce = 0 }: { sentence: string; tone: 'calm' | 'match' | 'refused' | 'end'; announce?: number }) {
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
      <span key={announce} className="cadet-banner-text">
        {sentence}
      </span>
    </p>
  );
}
