'use client';

/**
 * The Examples window: the ready-made programs as cards, under the headings of their levels.
 *
 * The window holds no list of examples of its own. It draws what the website's server has
 * answered (see ./useMemberExamples.ts): the cards this visitor may see, under the headings
 * the server sent with them. A card whose example the server handed out shows its description
 * and a button that loads the program into the workspace; a card without one shows a lock, the
 * title and "Members only". Until the server has answered there are no cards - and when it
 * could not be reached, the window says so and offers "Try again". (The window is opened after
 * the server could not be reached: it is asked again right then, see ./EditorToolbar.tsx.)
 *
 * The one place to type a code is the panel at the top of the window. Somebody whose examples
 * are open can type a different code there ("Use a different code"); the examples stay as they
 * are until that code is accepted. What the window says about codes is written in
 * ./examples-words.ts.
 *
 * The window stands at the top of the screen and not in the middle (align="top"): its height
 * changes while a code is checked and when the cards open, and it must not jump under the
 * student's finger when it does.
 */
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { codeMessage, examplesIntro, EXAMPLES_WORDS as WORDS, type CodeMessage, type ExamplesView } from './examples-words';
import { LockIcon, UnlockIcon } from './icons';
import { CODE_LOOKS_LIKE, CODE_PLACEHOLDER, hiddenCode, type ExampleCard, type ExampleProgram } from './member-unlock';
import type { MemberExamples } from './useMemberExamples';
import { button, Modal } from './widgets';

/** The colours of the labels on the headings: the first heading gets the first one, and so on (round again after the last). */
const HEADING_COLOURS = ['bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-sky-100 text-sky-800'];

export interface ExamplesDialogProps {
  examples: MemberExamples;
  onLoad: (example: ExampleProgram) => void;
  onClose: () => void;
}

export function ExamplesDialog({ examples, onLoad, onClose }: ExamplesDialogProps) {
  const { config, levels, cards, available, unlocked, status, openList, refreshOpenList } = examples;
  const canOpen = (card: ExampleCard): boolean => available[card.id] !== undefined;
  // a member is back: the code saved on this device is being checked, there is nothing to type
  const checkingSaved = !unlocked && status.phase === 'checking' && status.about === 'saved';
  const view: ExamplesView = unlocked
    ? 'unlocked'
    : cards.length === 0
      ? 'not-known'
      : cards.every(canOpen)
        ? 'all-open'
        : cards.some(canOpen)
          ? checkingSaved
            ? 'checking-some-open'
            : 'some-open'
          : checkingSaved
            ? 'checking-saved'
            : 'locked';

  // has the website said which cards to show? (with an accepted code: yes, the ones of that code)
  const cardsKnown = unlocked || openList === 'ready';
  // While the code saved on this device is in question - being checked, or it could not be
  // checked - the panel above speaks for the cards as well: it has its own "Try again", which
  // asks for both.
  const panelSpeaks = !unlocked && examples.savedCode !== null && status.about === 'saved' && (status.phase === 'checking' || status.phase === 'unreachable' || status.phase === 'busy');

  // "The website could not be reached" stays on the screen while it is asked again - "Try
  // again" shows a turning ring meanwhile - so that nothing flickers, and the button that was
  // pressed is still there (with the keyboard on it) when the answer is "not reached" once more.
  const [notReachedBefore, setNotReachedBefore] = useState(false);
  if (openList === 'unreachable' && !notReachedBefore) setNotReachedBefore(true);
  if (openList === 'ready' && notReachedBefore) setNotReachedBefore(false);
  const askingAgain = openList === 'loading' && notReachedBefore;
  const showNotReached = !cardsKnown && !panelSpeaks && (openList === 'unreachable' || askingAgain);
  const showLoading = !cardsKnown && !showNotReached && (openList === 'loading' || checkingSaved);

  // The control that had the keyboard is gone - "Try again", once the cards have taken its
  // place: put the keyboard on the first heading, so that it stays in the window and the next
  // Tab reaches the first card.
  const shelfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const shelf = shelfRef.current;
    (shelf?.querySelector<HTMLElement>('h3') ?? shelf)?.focus();
  }, [openList, cardsKnown]);

  // The window is closed with the field for a different code open and nothing typed into it:
  // put the field away, so that the window opens as usual next time. (A code that was typed,
  // and a message about it, stay - see `draft` in ./useMemberExamples.ts.)
  const tidyUp = () => {
    if (examples.changing && status.phase === 'none' && examples.draft.trim() === '') examples.cancelChange();
  };
  const close = () => {
    tidyUp();
    onClose();
  };
  const load = (example: ExampleProgram) => {
    tidyUp();
    onLoad(example);
  };

  return (
    <Modal title="Examples" onClose={close} widthClass="max-w-3xl" align="top">
      <p className="mb-3 text-sm leading-relaxed text-ink-600" data-examples-intro>
        {examplesIntro(view, config.organisation)}
      </p>

      <MemberCodePanel examples={examples} />

      <div ref={shelfRef} tabIndex={-1} className="outline-none" data-examples-shelf>
        {/* no cards yet: the website is being asked ... */}
        {showLoading && (
          <p className="flex items-center gap-2 text-sm text-ink-500" role="status" data-examples-state="loading">
            <Spinner className="h-4 w-4 border-slate-200 border-t-slate-500" />
            {WORDS.loadingExamples}
          </p>
        )}
        {/* ... or it could not be reached: say so, and offer to ask again */}
        {showNotReached && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-dashed border-slate-300 p-3 text-sm text-ink-600" data-examples-state={askingAgain ? 'asking-again' : 'unreachable'}>
            <p className="min-w-0 flex-1 basis-60" role="status">
              {WORDS.websiteNotReached}
            </p>
            {/* (the button keeps its place and its width while the website is asked again: the turning ring takes the place of the words) */}
            <button type="button" onClick={refreshOpenList} aria-disabled={askingAgain} className={`${button.plain} relative py-1.5 ${askingAgain ? 'cursor-progress' : ''}`}>
              <span className={askingAgain ? 'opacity-0' : undefined}>{WORDS.tryAgain}</span>
              {askingAgain && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="h-4 w-4 border-slate-200 border-t-slate-500" />
                </span>
              )}
            </button>
          </div>
        )}
        {cardsKnown && cards.length === 0 && (
          <p className="text-sm text-ink-500" data-examples-state="none">
            {WORDS.noExamples}
          </p>
        )}

        {levels.map((level, i) => {
          const list = cards.filter((card) => card.level === level.id);
          // (a heading is drawn only over at least one card)
          if (list.length === 0) return null;
          return (
            <section key={level.id} className="mb-4 last:mb-0" aria-label={`${level.title} examples`} data-example-level={level.id}>
              <h3 tabIndex={-1} className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-500 outline-none">
                <span className={`rounded px-1.5 py-0.5 ${HEADING_COLOURS[i % HEADING_COLOURS.length]}`}>{level.title}</span>
                {level.about}
              </h3>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {list.map((card) => {
                  const example = available[card.id];
                  return example ? <OpenCard key={card.id} example={example} onLoad={load} /> : <LockedCard key={card.id} card={card} note={WORDS.membersOnly} />;
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

// =============================================================================================
// The cards
// =============================================================================================

/** An example this visitor may not have: a lock, its title and "Members only". Nothing to read, nothing to press. */
function LockedCard({ card, note }: { card: ExampleCard; note: string }) {
  return (
    <li data-example={card.id} data-locked="true" className="flex items-center gap-2.5 self-start rounded-card border border-dashed border-slate-300 bg-white p-3">
      <LockIcon className="h-5 w-5 shrink-0 text-ink-400" />
      <span className="min-w-0 flex-1 text-sm font-bold text-ink-700">{card.title}</span>
      <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600">{note}</span>
    </li>
  );
}

/** An example the server has handed out: its description and the button that loads it. */
function OpenCard({ example, onLoad }: { example: ExampleProgram; onLoad: (example: ExampleProgram) => void }) {
  return (
    <li data-example={example.id} data-locked="false" className="flex flex-col gap-2 rounded-card border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-bold text-ink-900">{example.title}</p>
      <p className="flex-1 text-xs leading-relaxed text-ink-600">{example.description}</p>
      <button type="button" onClick={() => onLoad(example)} className={`${button.plain} self-start py-1.5`} aria-label={`Load the example ${example.title}`}>
        {WORDS.loadExample}
      </button>
    </li>
  );
}

// =============================================================================================
// The member code
// =============================================================================================

const MESSAGE_TONE: Record<CodeMessage['tone'], string> = {
  hint: '',
  info: 'text-ink-600',
  good: 'font-semibold text-emerald-800',
  bad: 'font-semibold text-rose-700',
};

const SMALL_BUTTON = `${button.plain} px-2.5 py-1 text-xs`;

/** A control that does not ask to be pressed: small underlined words. */
const QUIET_LINK = 'rounded-sm text-xs font-medium text-ink-500 underline decoration-ink-300 underline-offset-2 hover:text-ink-800';

/** A sentence in which the made-up code (FIRE-7K2M-9QXD) stands out as a code. */
function withCode(sentence: string): ReactNode {
  const parts = sentence.split(CODE_LOOKS_LIKE);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="whitespace-nowrap font-mono font-semibold">{CODE_LOOKS_LIKE}</span>}
      {part}
    </Fragment>
  ));
}

/** A small turning ring: "working on it". */
function Spinner({ className }: { className: string }) {
  return <span className={`inline-block shrink-0 animate-spin rounded-full border-2 ${className}`} aria-hidden="true" />;
}

function MemberCodePanel({ examples }: { examples: MemberExamples }) {
  const { status, savedCode, draft, setDraft, unlocked, changing } = examples;
  const checking = status.phase === 'checking';
  // the field is there to type a code into: not once the examples are open (unless a different
  // code is to be typed), and not while the code that is saved on this device is being checked
  // (a member who comes back types nothing)
  const showForm = changing || (!unlocked && !(checking && status.about === 'saved'));
  const message = codeMessage(status, examples.config.organisation, unlocked);

  const [confirmingForget, setConfirmingForget] = useState(false);
  const inputId = useId();
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const forgetRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  // Keep the keyboard somewhere sensible when the panel changes under it: back in the field
  // after a wrong code (what was typed stays, ready to be corrected), and - when the control
  // that had the focus is gone (the field after unlocking, the "Forget" buttons after
  // forgetting) - on the field or on the message.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (status.phase === 'rejected' && status.about === 'typed') {
      inputRef.current?.focus();
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body) return;
    (inputRef.current ?? messageRef.current)?.focus();
  }, [status.phase, status.about]);

  // The question "really forget?" starts on its harmless answer; after "Keep it" the keyboard
  // is back on the control that asked.
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirmingForget) keepRef.current?.focus();
    else if (wasConfirming.current) forgetRef.current?.focus();
    wasConfirming.current = confirmingForget;
  }, [confirmingForget]);

  // "Use a different code" puts the keyboard into the field it opens; "Cancel" puts it back on
  // the control that opened it. (When the different code was accepted, the field is gone and
  // the keyboard is on the message - see above - which then says "Unlocked".)
  const wasChanging = useRef(false);
  const cancelledChange = useRef(false);
  useEffect(() => {
    if (changing && !wasChanging.current) inputRef.current?.focus();
    else if (!changing && wasChanging.current && cancelledChange.current) changeRef.current?.focus();
    wasChanging.current = changing;
    cancelledChange.current = false;
  }, [changing]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    if (draft.trim() === '') {
      // nothing typed yet: show where to type
      inputRef.current?.focus();
      return;
    }
    examples.submit(draft);
  };

  const forget = () => {
    setConfirmingForget(false);
    examples.forget();
  };

  const startChange = () => {
    setConfirmingForget(false);
    examples.startChange();
  };

  const cancelChange = () => {
    cancelledChange.current = true;
    examples.cancelChange();
  };

  return (
    <section
      aria-label="Member code"
      data-member-panel={status.phase}
      data-unlocked={unlocked ? 'true' : 'false'}
      className={`mb-4 rounded-card border p-3 ${unlocked ? 'border-emerald-200 bg-emerald-50' : 'border-brand-200 bg-brand-50'}`}
    >
      {showForm && (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <LockIcon className={`h-4 w-4 shrink-0 ${unlocked ? 'text-emerald-700' : 'text-brand-700'}`} />
              {changing ? WORDS.differentCodeLabel : WORDS.codeLabel}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              name="member-code"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              readOnly={checking}
              placeholder={CODE_PLACEHOLDER}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-describedby={messageId}
              aria-invalid={status.phase === 'rejected' && status.about === 'typed' ? true : undefined}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-base uppercase tracking-wider text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400 sm:text-sm"
            />
          </div>
          {/* (the button keeps its width while a code is checked: the turning ring takes the place of the word) */}
          <button
            type="submit"
            aria-disabled={checking || draft.trim() === ''}
            className={`${button.primary} relative h-10 ${checking ? 'cursor-progress' : 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40'}`}
          >
            <span className={checking ? 'opacity-0' : undefined}>{changing ? WORDS.useThisCode : WORDS.unlock}</span>
            {checking && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner className="h-4 w-4 border-white/40 border-t-white" />
              </span>
            )}
          </button>
          {/* a different code is only an offer: one press leaves everything as it is */}
          {changing && (
            <button type="button" onClick={cancelChange} className={`${button.plain} h-10`} data-change-cancel>
              {WORDS.keepCurrentCode}
            </button>
          )}
        </form>
      )}

      {/* One message, always in the page, so that a screen reader announces every change of it.
          Under the field it keeps room for two lines, so that the cards below do not move when
          "Checking your code…" takes the place of the hint. (A little more than two plain lines:
          the made-up code in the hint is set in another typeface, which makes its line a touch taller.) */}
      <p
        ref={messageRef}
        id={messageId}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        data-member-feedback
        className={`flex items-start gap-2 text-sm leading-snug text-ink-700 outline-none ${showForm ? 'mt-2 min-h-[2.625rem]' : ''}`}
      >
        {unlocked && !showForm && <UnlockIcon className="mt-px h-4 w-4 shrink-0 text-emerald-700" />}
        {!showForm && checking && <Spinner className="mt-0.5 h-4 w-4 border-brand-200 border-t-brand-600" />}
        <span>
          {message.lead && <span className={MESSAGE_TONE[message.tone]}>{message.lead}</span>}
          {message.rest.map((sentence, i) =>
            // the hint is two short lines; everything else is running text
            message.tone === 'hint' ? (
              <span key={i} className="block">
                {withCode(sentence)}
              </span>
            ) : (
              <Fragment key={i}> {withCode(sentence)}</Fragment>
            ),
          )}
        </span>
      </p>

      {savedCode !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-600">
          <span>
            {examples.remembered ? (
              <>
                {WORDS.savedOnThisDevice} <span className="font-mono font-semibold text-ink-800">{hiddenCode(savedCode)}</span>
              </>
            ) : (
              WORDS.notSaved
            )}
          </span>
          {!unlocked && !checking && status.about === 'saved' && (status.phase === 'unreachable' || status.phase === 'busy') && (
            <button type="button" onClick={examples.retry} className={SMALL_BUTTON}>
              {WORDS.tryAgain}
            </button>
          )}
          {/* forgetting takes two steps, and the second one starts on "Keep it": it cannot happen with one slip.
              (Nothing to forget when the browser did not save the code.) */}
          {examples.remembered && confirmingForget ? (
            <span role="group" aria-label="Forget this code on this device?" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-inset ring-slate-300">
              <span className="font-semibold text-ink-800">{WORDS.forgetQuestion}</span>
              <button ref={keepRef} type="button" onClick={() => setConfirmingForget(false)} className={SMALL_BUTTON}>
                {WORDS.forgetNo}
              </button>
              <button type="button" onClick={forget} className={`${SMALL_BUTTON} border-rose-300 text-rose-700 hover:bg-rose-50`}>
                {WORDS.forgetYes}
              </button>
            </span>
          ) : (
            <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {/* the examples are open: another code can be typed in the place of this one, without forgetting it first */}
              {unlocked && !changing && (
                <button ref={changeRef} type="button" onClick={startChange} className={QUIET_LINK} data-change-code>
                  {WORDS.useDifferentCode}
                </button>
              )}
              {examples.remembered && (
                <button ref={forgetRef} type="button" onClick={() => setConfirmingForget(true)} className={QUIET_LINK}>
                  {WORDS.forget}
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
