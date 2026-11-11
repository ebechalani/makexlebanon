/**
 * What the Examples window says about member codes: every sentence a student can read there,
 * in one place, so that they can be read - and tested - together.
 *
 * The reader is 12 years old and was handed a code on paper. So:
 *  - plain words. The website is "the website", the browser's memory is "this device"; no
 *    "server", "request" or "storage" (a test, ./examples-words.test.ts, checks the list);
 *  - a wrong code is never the student's fault in so many words, and what was typed is kept;
 *  - "the website could not be reached" is never mixed up with "your code is wrong";
 *  - nothing is promised that is not true for the visitor who reads it: a visitor without a
 *    code is told that the examples are for members, not sent to them.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import { CODE_LOOKS_LIKE } from './member-unlock';
import type { CodeStatus } from './useMemberExamples';

// =============================================================================================
// The line at the top of the window
// =============================================================================================

/**
 * What the visitor sees in the window:
 *
 *   unlocked         a member code was accepted: every example can be loaded
 *   some-open        no code, but the owner has opened some examples to everyone
 *   checking-saved   the code saved on this device is being checked: nothing to type
 *   locked           no code: every card is locked
 */
export type ExamplesView = 'unlocked' | 'some-open' | 'checking-saved' | 'locked';

const WHAT_THEY_ARE = 'Ready-made programs to run, read and change.';
const HOW_LOADING_WORKS = 'Loading one replaces the blocks in your workspace (Undo brings them back).';

/** The one or two sentences at the top of the window. `organisation` is e.g. "MakeX Lebanon". */
export function examplesIntro(view: ExamplesView, organisation: string): string {
  const members = `registered ${organisation} members`;
  switch (view) {
    case 'unlocked':
      return `${WHAT_THEY_ARE} ${HOW_LOADING_WORKS}`;
    case 'some-open':
      return `${WHAT_THEY_ARE} ${HOW_LOADING_WORKS} The ones marked “${EXAMPLES_WORDS.membersOnly}” are for ${members}.`;
    case 'checking-saved':
      return `These ready-made programs are for ${members}.`;
    case 'locked':
      return `These ready-made programs are for ${members}: type your member code below and they open right away. Everything else in the simulator works without a code.`;
  }
}

// =============================================================================================
// The message under the code field
// =============================================================================================

export interface CodeMessage {
  /**
   *   hint   nothing was typed yet: how to begin
   *   info   something is going on
   *   good   the examples are open
   *   bad    they are not, and why
   */
  tone: 'hint' | 'info' | 'good' | 'bad';
  /** the short answer, shown in the colour of the tone */
  lead?: string;
  /** what to do about it, sentence by sentence, in the plain text colour */
  rest: string[];
}

/** What to tell the visitor about the member code. `organisation` is e.g. "MakeX Lebanon". */
export function codeMessage(status: CodeStatus, organisation: string): CodeMessage {
  const saved = status.about === 'saved';
  switch (status.phase) {
    case 'none':
      // what a code looks like, and where members get one
      return { tone: 'hint', rest: [`A code looks like ${CODE_LOOKS_LIKE}.`, `Members get theirs from ${organisation}.`] };
    case 'checking':
      return { tone: 'info', lead: saved ? 'Checking the member code saved on this device…' : 'Checking your code…', rest: [] };
    case 'unlocked':
      return { tone: 'good', lead: 'Unlocked: every example below is ready to load.', rest: [] };
    case 'rejected':
      return saved
        ? {
            // the code was cancelled: it worked before, so there is no typing mistake to look for
            tone: 'bad',
            lead: 'The member code saved on this device no longer works, so the examples are locked again.',
            rest: [`Please ask ${organisation} for a new code, then type it here.`],
          }
        : {
            tone: 'bad',
            lead: 'That code did not open the examples.',
            rest: [`Please check it for a typing mistake - a code looks like ${CODE_LOOKS_LIKE}.`, `If it still does not work, ask ${organisation} for help.`],
          };
    case 'busy':
      // (nothing is known about this code: the website did not look at it)
      return {
        tone: 'bad',
        lead: 'Too many wrong codes were typed on this network in a short time.',
        rest: [`Please wait ${waitInWords(status.waitSeconds)}, then try again.`],
      };
    case 'unreachable':
      return saved
        ? {
            tone: 'bad',
            lead: 'The website could not be reached, so the member code saved on this device could not be checked.',
            rest: ['The examples stay locked until it has been checked.', `Check your internet connection, then press “${EXAMPLES_WORDS.tryAgain}”.`],
          }
        : {
            tone: 'bad',
            lead: 'The website could not be reached, so your code could not be checked.',
            rest: ['Please check your internet connection and try again.'],
          };
  }
}

/** How long to wait, the way one would say it: "a moment", "a minute", "4 minutes". */
function waitInWords(seconds: number | undefined): string {
  if (seconds === undefined || !(seconds > 0)) return 'a little';
  if (seconds <= 15) return 'a moment';
  if (seconds <= 90) return 'a minute';
  return `${Math.ceil(seconds / 60)} minutes`;
}

// =============================================================================================
// Everything else
// =============================================================================================

export const EXAMPLES_WORDS = {
  /** the label of the code field: the one place to type a code */
  codeLabel: 'I have a member code',
  unlock: 'Unlock',
  /** on a card this visitor may not open */
  membersOnly: 'Members only',
  /** the same, while it is not known yet which cards are open to everyone (the website was not reached) */
  locked: 'Locked',
  loadExample: 'Load this example',
  tryAgain: 'Try again',
  /** without a code: the website could not say which examples are open to everyone */
  websiteNotReached: 'The website could not be reached just now. Check your internet connection, then try again.',
  /** in front of the saved code, of which only the first half is shown */
  savedOnThisDevice: 'Saved on this device:',
  /** the browser refused to remember the accepted code */
  notSaved: 'This browser cannot save your code, so you will have to type it again next time.',
  forget: 'Forget this code on this device',
  forgetQuestion: 'Forget this code? You will have to type it again to open the examples.',
  forgetNo: 'Keep it',
  forgetYes: 'Yes, forget it',
  /** what the pointer shows on the Examples button of the toolbar */
  buttonHint: 'Ready-made programs',
  buttonHintLocked: 'Ready-made programs for registered members',
} as const;
