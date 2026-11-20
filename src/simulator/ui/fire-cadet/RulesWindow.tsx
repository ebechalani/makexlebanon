'use client';

/**
 * The Rules window of Fire Cadet (design 7.11): the shared window (../widgets.tsx Modal) with two
 * parts - the organiser's rules in short, then "What this simulator assumes", clearly apart. The
 * texts are in ./rules.ts; a sentence about an item, the Fire or an obstacle has its small picture
 * in front. Both parts have real headings, so a screen reader can find each section.
 *
 * The text is much taller than the window, and the window has one button (Close): so the text
 * itself can take the keyboard (tabIndex 0, and it has it when the window opens). Then the arrow
 * keys, Page Down, Space and End scroll it, not the page behind - a teacher with only a keyboard
 * can read both parts. The window's Tab key goes between Close and the text (../widgets.tsx).
 */
import { useEffect, useRef } from 'react';
import { Modal } from '../widgets';
import { Picture } from './pictures';
import { CADET_ASSUMPTIONS, CADET_RULES, CADET_RULES_TEXT_LABEL, type CadetRulesPart } from './rules';

function Part({ part, first }: { part: CadetRulesPart; first: boolean }) {
  return (
    <section className={first ? '' : 'mt-5 border-t-2 border-slate-200 pt-4'} data-rules-part={first ? 'rules' : 'assumptions'}>
      {/* (the first part's heading is the window's own title, "Rules": it is not said twice) */}
      {!first && <h2 className="text-base font-bold tracking-normal text-ink-900">{part.title}</h2>}
      {part.note && (
        <p className={`${first ? '' : 'mt-1 '}rounded-md px-2 py-1 text-xs font-semibold leading-snug ${first ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{part.note}</p>
      )}
      {part.sections.map((section) => (
        <div key={section.title} className="mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand-700">{section.title}</h3>
          <ul className="mt-1 space-y-1 text-sm leading-snug text-ink-800">
            {section.items.map((item, i) => {
              const picture = section.pictures?.[i] ?? null;
              return (
                <li key={item} className="flex items-start gap-2">
                  {picture !== null ? (
                    <Picture name={picture} className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
                  )}
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function RulesWindow({ onClose }: { onClose: () => void }) {
  const textRef = useRef<HTMLDivElement>(null);
  // (after the window's own effect, which puts the keyboard on the window: this one runs after it)
  useEffect(() => {
    textRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <Modal title={CADET_RULES.title} onClose={onClose} widthClass="max-w-2xl" align="top">
      <div
        ref={textRef}
        data-rules-window
        tabIndex={0}
        role="document"
        aria-label={CADET_RULES_TEXT_LABEL}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-4"
      >
        <Part part={CADET_RULES} first />
        <Part part={CADET_ASSUMPTIONS} first={false} />
      </div>
    </Modal>
  );
}
