'use client';

/**
 * The Examples window: ready-made programs as cards, grouped by level, each with a button that
 * loads it into the workspace.
 *
 * Some examples can be for registered members only. Their cards are shown to everyone - with a
 * lock and "Members only" where the button would be - but their programs are not in the
 * browser: they come from the website's server once a member code was accepted (see
 * ./useMemberExamples.ts). The one place to type a code is the panel at the top of the window.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ProgramJson } from '../core/types';
import { LockIcon, UnlockIcon } from './icons';
import { CODE_LOOKS_LIKE, CODE_PLACEHOLDER, hiddenCode } from './member-unlock';
import type { MemberExamples } from './useMemberExamples';
import { button, Modal } from './widgets';

/** A ready-made program offered in the Examples window. */
export interface ExampleProgram {
  id: string;
  title: string;
  level: 'starter' | 'intermediate' | 'advanced';
  description: string;
  program: ProgramJson;
}

/** One card: an example that may or may not have its program (a members' example has none until a code was accepted). */
interface Card {
  id: string;
  title: string;
  level: ExampleProgram['level'];
  description: string;
  /** true for a members' example, locked or not */
  members: boolean;
  program: ProgramJson | undefined;
}

const LEVELS: Array<{ id: ExampleProgram['level']; title: string; blurb: string; badge: string }> = [
  { id: 'starter', title: 'Starter', blurb: 'first steps', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'intermediate', title: 'Intermediate', blurb: 'one mission from start to finish', badge: 'bg-amber-100 text-amber-800' },
  { id: 'advanced', title: 'Advanced', blurb: 'adapting to the combination, and the whole match', badge: 'bg-rose-100 text-rose-800' },
];

export interface ExamplesDialogProps {
  /** the examples everyone may load */
  examples: ExampleProgram[];
  /** the members' examples and the state of the member code; null when the category has none */
  member: MemberExamples | null;
  onLoad: (example: ExampleProgram) => void;
  onClose: () => void;
}

export function ExamplesDialog({ examples, member, onLoad, onClose }: ExamplesDialogProps) {
  const cards: Card[] = [
    ...examples.map((example) => ({ ...example, members: false })),
    ...(member?.config.locked ?? []).map((info) => ({ ...info, members: true, program: member?.programs[info.id] })),
  ];

  return (
    <Modal title="Examples" onClose={onClose} widthClass="max-w-3xl">
      <p className="mb-3 text-sm text-ink-600">
        Ready-made programs to run, read and change. Loading one replaces the blocks in your workspace (Undo brings them back).
      </p>
      {member && member.config.locked.length > 0 && <MemberCodePanel member={member} />}
      {cards.length === 0 && <p className="text-sm text-ink-500">No examples are available yet.</p>}
      {LEVELS.map((level) => {
        const list = cards.filter((card) => card.level === level.id);
        if (list.length === 0) return null;
        return (
          <section key={level.id} className="mb-4 last:mb-0" aria-label={`${level.title} examples`}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500">
              <span className={`rounded px-1.5 py-0.5 ${level.badge}`}>{level.title}</span>
              {level.blurb}
            </h3>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {list.map((card) => (
                <ExampleCard key={card.id} card={card} onLoad={onLoad} />
              ))}
            </ul>
          </section>
        );
      })}
    </Modal>
  );
}

// =============================================================================================
// One card
// =============================================================================================

function ExampleCard({ card, onLoad }: { card: Card; onLoad: (example: ExampleProgram) => void }) {
  const { program } = card;
  const locked = program === undefined;
  return (
    <li
      data-example={card.id}
      data-locked={locked ? 'true' : 'false'}
      className={`flex flex-col gap-2 rounded-card border p-3 ${locked ? 'border-dashed border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}
    >
      <p className="flex items-start gap-1.5 text-sm font-bold text-ink-900">
        {card.members &&
          (locked ? <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" /> : <UnlockIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />)}
        <span>{card.title}</span>
      </p>
      <p className="flex-1 text-xs leading-relaxed text-ink-600">{card.description}</p>
      {program === undefined ? (
        <p className="inline-flex items-center gap-1.5 self-start rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-600">
          <LockIcon className="h-4 w-4" />
          Members only
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onLoad({ id: card.id, title: card.title, level: card.level, description: card.description, program })}
          className={`${button.plain} self-start py-1.5`}
          aria-label={`Load the example ${card.title}`}
        >
          Load this example
        </button>
      )}
    </li>
  );
}

// =============================================================================================
// The member code
// =============================================================================================

interface Feedback {
  text: string;
  tone: 'info' | 'good' | 'bad';
}

/** What to tell the visitor about the member code, in plain words. */
function feedbackFor(member: MemberExamples): Feedback | null {
  const { phase, about } = member.status;
  const saved = about === 'saved';
  switch (phase) {
    case 'none':
      return null;
    case 'checking':
      return { tone: 'info', text: saved ? 'Checking the member code saved on this device…' : 'Checking your code…' };
    case 'unlocked':
      return { tone: 'good', text: "Unlocked: the members' examples below are ready to load." };
    case 'rejected':
      return saved
        ? {
            tone: 'bad',
            text:
              "The member code saved on this device is no longer accepted, so the members' examples are locked again. " +
              'If you think this is a mistake, ask the person who gave you the code.',
          }
        : {
            tone: 'bad',
            text: `That code was not accepted. Check it for a typing mistake - a code looks like ${CODE_LOOKS_LIKE} - or ask the person who gave it to you.`,
          };
    case 'busy':
      return { tone: 'bad', text: 'Too many wrong codes were tried from this network. Wait ten minutes, then try again.' };
    case 'unreachable':
      return saved
        ? {
            tone: 'bad',
            text:
              'The member code saved on this device could not be checked, because the website could not be reached. ' +
              "The members' examples stay locked until it has been checked.",
          }
        : { tone: 'bad', text: 'The website could not be reached to check your code. Check your internet connection and try again.' };
  }
}

const FEEDBACK_TONE: Record<Feedback['tone'], string> = {
  info: 'text-ink-600',
  good: 'font-semibold text-emerald-800',
  bad: 'font-semibold text-rose-700',
};

function MemberCodePanel({ member }: { member: MemberExamples }) {
  const { status, savedCode } = member;
  const unlocked = status.phase === 'unlocked';
  const checking = status.phase === 'checking';
  const feedback = feedbackFor(member);

  const [typed, setTyped] = useState('');
  const headingId = useId();
  const inputId = useId();
  const feedbackId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  // Keep the keyboard somewhere sensible when the panel changes under it: back in the field
  // after a wrong code, and - when the control that had the focus is gone (the field after
  // unlocking, the "Forget" button after forgetting) - on the message or on the field.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (status.phase === 'rejected' && status.about === 'typed') {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (inputRef.current ?? feedbackRef.current)?.focus();
  }, [status.phase, status.about]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (checking || typed.trim() === '') return;
    member.submit(typed);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-member-panel={status.phase}
      className={`mb-4 rounded-card border p-3 ${unlocked ? 'border-emerald-200 bg-emerald-50' : 'border-brand-200 bg-brand-50'}`}
    >
      <div className="flex items-start gap-2.5">
        {unlocked ? <UnlockIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <LockIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />}
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-bold tracking-normal text-ink-900">
            {unlocked ? "Members' examples" : 'For registered members'}
          </h3>
          {!unlocked && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
              The examples marked &ldquo;Members only&rdquo; open with a member code. {member.config.whereCodesComeFrom}
            </p>
          )}
        </div>
      </div>

      {!unlocked && (
        <form onSubmit={onSubmit} className="mt-2.5 flex flex-wrap items-end gap-2" noValidate>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={inputId} className="block text-xs font-bold text-ink-800">
              I have a member code
            </label>
            <input
              ref={inputRef}
              id={inputId}
              name="member-code"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              readOnly={checking}
              placeholder={CODE_PLACEHOLDER}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby={feedbackId}
              aria-invalid={status.phase === 'rejected' && status.about === 'typed' ? true : undefined}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-base uppercase tracking-wider text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400 sm:text-sm"
            />
          </div>
          <button type="submit" aria-disabled={checking || typed.trim() === ''} className={`${button.primary} h-10 aria-disabled:cursor-not-allowed aria-disabled:opacity-40`}>
            {checking && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            Unlock
          </button>
        </form>
      )}

      {/* one message, always in the page, so that a screen reader announces every change of it */}
      <p
        ref={feedbackRef}
        id={feedbackId}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={`text-sm leading-snug outline-none ${feedback ? `mt-2 ${FEEDBACK_TONE[feedback.tone]}` : ''} ${unlocked ? 'pl-[1.875rem]' : ''}`}
      >
        {feedback?.text}
      </p>

      {savedCode !== null && (
        <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-600 ${unlocked ? 'pl-[1.875rem]' : ''}`}>
          <span>
            {member.remembered ? (
              <>
                Saved on this device: <span className="font-mono font-semibold text-ink-800">{hiddenCode(savedCode)}</span>
              </>
            ) : (
              'This browser does not let the website save your code: you will be asked for it again next time.'
            )}
          </span>
          {!unlocked && !checking && status.about === 'saved' && (status.phase === 'unreachable' || status.phase === 'busy') && (
            <button type="button" onClick={member.retry} className={`${button.plain} px-2.5 py-1 text-xs`}>
              Try again
            </button>
          )}
          <button type="button" onClick={member.forget} className={`${button.plain} px-2.5 py-1 text-xs`}>
            Forget this code on this device
          </button>
        </div>
      )}
    </section>
  );
}
