'use client';

/**
 * The examples on the simulator screen: which ones this visitor may see and load, which code is
 * saved on this device, and whether the server accepted it.
 *
 * The screen itself knows nothing about the examples - no list, no title. Everything comes from
 * the website's server, which answers with the cards this visitor may see and the examples they
 * may open:
 *
 *  - without a code: the cards for a visitor, of which the ones the owner has opened to everyone
 *    can be loaded (often none). The screen asks for them once, when it starts;
 *  - with a code that the server accepts: the cards for that code, all of them ready to load.
 *
 * The window draws what the latest answer holds, and nothing else. Until the server has
 * answered there are no cards at all.
 *
 * A code that the server accepted is remembered in the browser, so a member types it once per
 * device. But a remembered code opens nothing by itself: at the start of every visit it is
 * checked with the server again, and the examples stay locked until the server has said yes -
 * also when the server cannot be reached. That is how a code that was cancelled stops working.
 *
 * The code is remembered in one place for all games of the simulator (SAVED_CODE_KEY in
 * ./member-unlock.ts): a code typed in one game is there on the next visit of any other, and
 * "forget" forgets it for all of them. What it opens is asked game by game, on each game's page.
 * (A page that is already open does not notice a code typed on another one until it is loaded
 * again.)
 *
 * Somebody whose examples are open can type a different code in the place of the one in use.
 * Nothing changes until the server has accepted the different code: when it is refused, or the
 * server cannot be reached, the saved code and the open examples stay exactly as they were.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSavedCode,
  requestUnlock,
  requestUnlockPatiently,
  SAVED_CODE_KEY,
  tidyCode,
  type ExampleCard,
  type ExampleLevel,
  type ExampleProgram,
  type ExampleShelf,
  type ExamplesSource,
} from './member-unlock';
import { loadJson, removeKey, saveJson } from './storage';

/**
 * What a category hands to the simulator screen about its examples: the address that hands them
 * out and the game they belong to (`unlockUrl` and `game`, see ExamplesSource), and whose
 * members they are for.
 */
export interface ExamplesConfig extends ExamplesSource {
  /** whose members the examples are for, e.g. "MakeX Lebanon" */
  organisation: string;
}

/**
 * Where things stand with the code that was asked about last:
 *
 *   none          no code was typed (and none is saved, unless a different code is about to be typed)
 *   checking      the server is being asked
 *   unlocked      the server said yes: every card can be loaded
 *   rejected      the server said no
 *   busy          the server asks to wait (too many wrong codes from this network)
 *   unreachable   the server could not be asked: nothing is known about the code
 */
export type CodePhase = 'none' | 'checking' | 'unlocked' | 'rejected' | 'busy' | 'unreachable';

export interface CodeStatus {
  phase: CodePhase;
  /** which code this is about: one just typed, or the one saved on this device */
  about: 'typed' | 'saved';
  /** with 'busy': for how many seconds the server asks to wait, when it said so */
  waitSeconds?: number;
  /** with 'unlocked': true when this code took the place of another one that was in use */
  replaced?: boolean;
}

/**
 * Where things stand with what a visitor without a code gets:
 *
 *   loading       the server is being asked
 *   ready         the server has answered (the answer may well be "nothing")
 *   unreachable   the server could not be asked
 */
export type OpenListState = 'loading' | 'ready' | 'unreachable';

export interface MemberExamples {
  config: ExamplesConfig;
  /** the headings of the Examples window, in its order; none until the server has answered */
  levels: readonly ExampleLevel[];
  /** the cards this visitor may see, in the order of the window; none until the server has answered */
  cards: readonly ExampleCard[];
  /** the examples that can be loaded right now, by id */
  available: Record<string, ExampleProgram>;
  /** true while the cards on the screen are the ones a code opened */
  unlocked: boolean;
  /** true while somebody whose examples are open is typing a different code (`status` is then about that one) */
  changing: boolean;
  status: CodeStatus;
  openList: OpenListState;
  /** the code saved on this device (FIRE-7K2M-9QXD), or null */
  savedCode: string | null;
  /** false when the browser refused to remember the accepted code (it will be asked for again) */
  remembered: boolean;
  /**
   * What is written in the code field right now. It is kept here and not in the Examples
   * window, so that closing the window by accident does not throw away a half-typed code, and
   * a message about a code ("That code did not open the examples") is never shown without it.
   */
  draft: string;
  setDraft: (text: string) => void;
  /** check a code that was just typed */
  submit: (typed: string) => void;
  /** check the saved code once more */
  retry: () => void;
  /** forget the saved code on this device and lock the examples again */
  forget: () => void;
  /** the examples are open: show the field for a different code */
  startChange: () => void;
  /** ... and put it away again, leaving everything as it is */
  cancelChange: () => void;
  /** ask once more what a visitor without a code gets (after the server could not be reached) */
  refreshOpenList: () => void;
  /**
   * The Examples window is being opened: whatever the server could not be asked earlier is
   * asked again now - the saved code, or what a visitor without a code gets - so that a
   * connection that was down for a moment does not leave the window empty.
   */
  askAgainIfNotReached: () => void;
}

const NO_LEVELS: readonly ExampleLevel[] = [];
const NO_CARDS: readonly ExampleCard[] = [];
const NO_EXAMPLES: Record<string, ExampleProgram> = {};

/** One answer of the server, ready for the window. */
export interface Shelf {
  levels: readonly ExampleLevel[];
  cards: readonly ExampleCard[];
  available: Record<string, ExampleProgram>;
}

/** What the window draws from one answer of the server: its headings, its cards, and the examples that can be loaded, by id. */
export function shelfOf(answer: ExampleShelf): Shelf {
  const available: Record<string, ExampleProgram> = {};
  for (const example of answer.examples) available[example.id] = example;
  return { levels: answer.levels, cards: answer.cards, available };
}

/**
 * @param config  the examples of this category: one object that stays the same between renders
 */
export function useMemberExamples(config: ExamplesConfig): MemberExamples {
  const { unlockUrl, game } = config;
  /** where to ask, and for which game's examples (the same object as long as the two stay the same) */
  const source = useMemo<ExamplesSource>(() => ({ unlockUrl, game }), [unlockUrl, game]);
  // (the code is remembered in one place for every game, so there is no place to choose here: see SAVED_CODE_KEY)
  const [savedCode, setSavedCode] = useState<string | null>(() => loadJson(SAVED_CODE_KEY, isSavedCode)?.code ?? null);
  const [status, setStatus] = useState<CodeStatus>(() => ({ phase: savedCode ? 'checking' : 'none', about: 'saved' }));
  /** what the accepted code opened; null while no code is accepted */
  const [forCode, setForCode] = useState<Shelf | null>(null);
  /** what a visitor without a code gets; null until the server has said */
  const [forVisitor, setForVisitor] = useState<Shelf | null>(null);
  const [openList, setOpenList] = useState<OpenListState>('loading');
  const [remembered, setRemembered] = useState(true);
  const [draft, setDraft] = useState('');

  /** Only the answer to the latest question of each kind counts (and none after the screen is gone). */
  const codeQuestion = useRef(0);
  const openQuestion = useRef(0);
  /** true once the server has said what a visitor without a code gets */
  const openListKnown = useRef(false);
  /** the code that is in use right now (the one whose examples are open), or null */
  const codeInUse = useRef<string | null>(null);

  const unlocked = forCode !== null;
  const changing = unlocked && status.phase !== 'unlocked';

  const askOpenList = useCallback(() => {
    const mine = ++openQuestion.current;
    setOpenList('loading');
    void requestUnlock(source, null).then((outcome) => {
      if (openQuestion.current !== mine) return;
      if (outcome.kind === 'examples') {
        openListKnown.current = true;
        setForVisitor(shelfOf(outcome));
        setOpenList('ready');
      } else {
        setOpenList('unreachable');
      }
    });
  }, [source]);

  const askCode = useCallback(
    (code: string, about: CodeStatus['about']) => {
      const mine = ++codeQuestion.current;
      // (what an earlier code opened stays open while this one is checked, and when it is refused)
      setStatus({ phase: 'checking', about });
      // the server could not be reached earlier: this is a new try, so ask for the visitor's cards again as well
      if (!openListKnown.current) askOpenList();
      // (a short "wait" of the server is waited out: see requestUnlockPatiently)
      void requestUnlockPatiently(source, code).then((outcome) => {
        if (codeQuestion.current !== mine) return;
        if (outcome.kind === 'examples') {
          // (said to somebody who typed a different code: it has taken the place of the one that was in use)
          const replaced = codeInUse.current !== null && codeInUse.current !== code;
          codeInUse.current = code;
          setForCode(shelfOf(outcome));
          setSavedCode(code);
          setRemembered(saveJson(SAVED_CODE_KEY, { code }));
          setDraft('');
          setStatus(replaced ? { phase: 'unlocked', about, replaced } : { phase: 'unlocked', about });
        } else if (outcome.kind === 'busy') {
          setStatus({ phase: 'busy', about, waitSeconds: outcome.waitSeconds });
        } else {
          setStatus({ phase: outcome.kind, about });
        }
      });
    },
    [askOpenList, source],
  );

  // at the start of a visit: ask what a visitor gets, and check the saved code again
  const firstCode = useRef(savedCode);
  useEffect(() => {
    if (firstCode.current) askCode(firstCode.current, 'saved');
    else askOpenList();
    return () => {
      codeQuestion.current++;
      openQuestion.current++;
    };
  }, [askCode, askOpenList]);

  const submit = useCallback(
    (typed: string) => {
      const code = tidyCode(typed);
      if (code === null) {
        // not even the shape of a code: no need to ask the server
        codeQuestion.current++;
        setStatus({ phase: 'rejected', about: 'typed' });
        return;
      }
      askCode(code, 'typed');
    },
    [askCode],
  );

  const retry = useCallback(() => {
    if (savedCode) askCode(savedCode, 'saved');
  }, [askCode, savedCode]);

  const forget = useCallback(() => {
    codeQuestion.current++;
    codeInUse.current = null;
    removeKey(SAVED_CODE_KEY);
    setSavedCode(null);
    setRemembered(true);
    setDraft('');
    setForCode(null);
    setStatus({ phase: 'none', about: 'saved' });
  }, []);

  const startChange = useCallback(() => {
    if (!unlocked) return;
    codeQuestion.current++;
    setDraft('');
    setStatus({ phase: 'none', about: 'typed' });
  }, [unlocked]);

  const cancelChange = useCallback(() => {
    if (!unlocked) return;
    // (an answer about the different code that is still on its way no longer counts)
    codeQuestion.current++;
    setDraft('');
    setStatus({ phase: 'unlocked', about: 'saved' });
  }, [unlocked]);

  const refreshOpenList = useCallback(() => {
    if (openList !== 'loading') askOpenList();
  }, [askOpenList, openList]);

  const askAgainIfNotReached = useCallback(() => {
    // (the saved code first: asking about it asks for the visitor's cards as well, when they are not known)
    if (!unlocked && savedCode && status.about === 'saved' && status.phase === 'unreachable') askCode(savedCode, 'saved');
    else if (openList === 'unreachable') askOpenList();
  }, [askCode, askOpenList, openList, savedCode, status.about, status.phase, unlocked]);

  // what the window shows: the answer to the accepted code, or else the answer for a visitor
  const shelf = forCode ?? forVisitor;
  const levels = shelf?.levels ?? NO_LEVELS;
  const cards = shelf?.cards ?? NO_CARDS;
  const available = shelf?.available ?? NO_EXAMPLES;

  return useMemo(
    () => ({ config, levels, cards, available, unlocked, changing, status, openList, savedCode, remembered, draft, setDraft, submit, retry, forget, startChange, cancelChange, refreshOpenList, askAgainIfNotReached }),
    [config, levels, cards, available, unlocked, changing, status, openList, savedCode, remembered, draft, submit, retry, forget, startChange, cancelChange, refreshOpenList, askAgainIfNotReached],
  );
}
