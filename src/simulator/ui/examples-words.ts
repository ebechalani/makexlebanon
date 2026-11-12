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
 *    code is told that the examples are for members, not sent to them;
 *  - a sentence is true whichever cards are on the screen. Some examples may be open without
 *    a code, so what a code does is said of "the examples it opened", never of "the examples";
 *  - the words speak only of what this visitor can see. Which examples there are is the
 *    website's answer, and it differs from code to code: no sentence here may say or hint
 *    that there are other examples than the ones on the screen, or other kinds of code than
 *    "a code" (the same test checks this too).
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
 *   unlocked             a code was accepted: every card can be loaded
 *   all-open             no code, and every card can be loaded all the same
 *   some-open            no code: some cards can be loaded, the others are marked "Members only"
 *   checking-some-open   the same cards, while the code saved on this device is being checked
 *   checking-saved       the code saved on this device is being checked, and no card can be loaded meanwhile
 *   locked               no code: every card is locked
 *   not-known            there are no cards (yet): the website has not answered, or could not be reached
 */
export type ExamplesView = 'unlocked' | 'all-open' | 'some-open' | 'checking-some-open' | 'checking-saved' | 'locked' | 'not-known';

const WHAT_THEY_ARE = 'Ready-made programs to run, read and change.';
const HOW_LOADING_WORKS = 'Loading one replaces the blocks in your workspace (Undo brings them back).';

/** The one or two sentences at the top of the window. `organisation` is e.g. "MakeX Lebanon". */
export function examplesIntro(view: ExamplesView, organisation: string): string {
  const members = `registered ${organisation} members`;
  switch (view) {
    case 'unlocked':
    case 'all-open':
    // A member is back and can load a card already, while the saved code is being checked: the
    // very words that stand there once the code is accepted, so that no card moves under a
    // finger at that moment. (The panel below says that the member code is being checked.)
    case 'checking-some-open':
      return `${WHAT_THEY_ARE} ${HOW_LOADING_WORKS}`;
    case 'some-open':
      return `${WHAT_THEY_ARE} ${HOW_LOADING_WORKS} The ones marked “${EXAMPLES_WORDS.membersOnly}” are for ${members}.`;
    case 'checking-saved':
      return `These ready-made programs are for ${members}.`;
    case 'locked':
      return `These ready-made programs are for ${members}: type your member code below and they open right away. Everything else in the simulator works without a code.`;
    case 'not-known':
      return WHAT_THEY_ARE;
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

/**
 * What to tell the visitor about the code. `organisation` is e.g. "MakeX Lebanon".
 *
 * @param unlocked  true when a code is in use already and the examples are open: the message
 *   is then about a different code this visitor is trying in its place. Whatever comes of
 *   that, the code in use stays in use until another one is accepted.
 */
export function codeMessage(status: CodeStatus, organisation: string, unlocked = false): CodeMessage {
  const saved = status.about === 'saved';
  switch (status.phase) {
    case 'none':
      return unlocked
        ? { tone: 'hint', rest: [`A code looks like ${CODE_LOOKS_LIKE}.`, EXAMPLES_WORDS.currentCodeStays] }
        : // what a code looks like, and where members get one
          { tone: 'hint', rest: [`A code looks like ${CODE_LOOKS_LIKE}.`, `Members get theirs from ${organisation}.`] };
    case 'checking':
      return { tone: 'info', lead: saved ? 'Checking the member code saved on this device…' : 'Checking your code…', rest: [] };
    case 'unlocked':
      // (after a different code was typed: say that it was accepted, in the words the field used - the examples may look the same as before)
      return { tone: 'good', lead: status.replaced ? 'Your new code was accepted: every example below is ready to load.' : 'Unlocked: every example below is ready to load.', rest: [] };
    case 'rejected':
      if (unlocked) {
        return {
          tone: 'bad',
          lead: 'That code was not accepted, so nothing has changed.',
          rest: [`Please check it for a typing mistake - a code looks like ${CODE_LOOKS_LIKE}.`, EXAMPLES_WORDS.currentCodeStillInUse],
        };
      }
      return saved
        ? {
            // the code was cancelled: it worked before, so there is no typing mistake to look for
            tone: 'bad',
            lead: 'The member code saved on this device no longer works, so the examples it opened are locked again.',
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
        rest: [`Please wait ${waitInWords(status.waitSeconds)}, then try again.`, ...(unlocked ? [EXAMPLES_WORDS.currentCodeStillInUse] : [])],
      };
    case 'unreachable':
      if (unlocked) {
        return {
          tone: 'bad',
          lead: 'The website could not be reached, so your code could not be checked.',
          rest: ['Please check your internet connection and try again.', EXAMPLES_WORDS.currentCodeStillInUse],
        };
      }
      return saved
        ? {
            tone: 'bad',
            lead: 'The website could not be reached, so the member code saved on this device could not be checked.',
            rest: ['The examples it opens stay locked until it has been checked.', `Check your internet connection, then press “${EXAMPLES_WORDS.tryAgain}”.`],
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
  loadExample: 'Load this example',
  tryAgain: 'Try again',
  /** where the cards will be, until the website has answered */
  loadingExamples: 'Loading the examples…',
  /** where the cards would be: the website could not say which examples there are */
  websiteNotReached: 'The examples cannot be shown: the website could not be reached just now. Check your internet connection, then try again.',
  /** the website answered, and there is not one card to show */
  noExamples: 'No examples are available yet.',
  /** in front of the saved code, of which only the first half is shown */
  savedOnThisDevice: 'Saved on this device:',
  /** the browser refused to remember the accepted code */
  notSaved: 'This browser cannot save your code, so you will have to type it again next time.',
  /** for somebody whose examples are open: type another code in the place of the one in use */
  useDifferentCode: 'Use a different code',
  /** the label of the code field while a different code is typed */
  differentCodeLabel: 'A different code',
  /** the button that sends the different code */
  useThisCode: 'Use this code',
  /** ... and the one that leaves everything as it is */
  keepCurrentCode: 'Cancel',
  /** under the field for a different code, after "A code looks like ...": the code in use stays in use meanwhile (kept short: one line on a phone) ... */
  currentCodeStays: 'Nothing changes until it is accepted.',
  /** ... and nothing has changed when it was not */
  currentCodeStillInUse: 'Your current code is still in use.',
  forget: 'Forget this code on this device',
  /** (the examples that are open without a code stay open: only what the code opened is locked) */
  forgetQuestion: 'Forget this code? The examples it opened will be locked until you type it again.',
  forgetNo: 'Keep it',
  forgetYes: 'Yes, forget it',
  /** what the pointer shows on the Examples button of the toolbar */
  buttonHint: 'Ready-made programs',
  buttonHintLocked: 'Ready-made programs for registered members',
} as const;
