'use client';

/**
 * The examples on the simulator screen: which ones this visitor may load, which member code is
 * saved on this device, and whether the server accepted it.
 *
 * The screen itself knows the examples only by id, title and level. Everything else - the
 * descriptions and the programs - comes from the website's server:
 *
 *  - without a code, the server hands out the examples the owner has opened to everyone
 *    (often none). The screen asks for them once, when it starts;
 *  - with a member code that is on the list, it hands out all of them.
 *
 * A code that the server accepted is remembered in the browser, so a member types it once per
 * device. But a remembered code opens nothing by itself: at the start of every visit it is
 * checked with the server again, and the examples stay locked until the server has said yes -
 * also when the server cannot be reached. That is how a code that was cancelled stops working.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSavedCode, requestUnlock, requestUnlockPatiently, tidyCode, type ExampleCard, type ExampleProgram } from './member-unlock';
import { loadJson, removeKey, saveJson } from './storage';

/** What a category hands to the simulator screen about its examples. */
export interface ExamplesConfig {
  /** every example by id, title and level, in the order of the Examples window */
  cards: readonly ExampleCard[];
  /** address on this website that hands out the examples (see src/app/api/simulator/unlock/route.ts) */
  unlockUrl: string;
  /** whose members the examples are for, e.g. "MakeX Lebanon" */
  organisation: string;
}

/**
 * Where things stand with the member code:
 *
 *   none          no code was typed, none is saved
 *   checking      the server is being asked
 *   unlocked      the server said yes: every example can be loaded
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
}

/**
 * Where things stand with the examples that need no code:
 *
 *   loading       the server is being asked which ones there are
 *   ready         the server has answered (the answer may well be "none")
 *   unreachable   the server could not be asked
 */
export type OpenListState = 'loading' | 'ready' | 'unreachable';

export interface MemberExamples {
  config: ExamplesConfig;
  /** the examples that can be loaded right now, by id */
  available: Record<string, ExampleProgram>;
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
  /** ask once more which examples need no code (after the server could not be reached) */
  refreshOpenList: () => void;
}

const NO_EXAMPLES: Record<string, ExampleProgram> = {};

function byId(examples: ExampleProgram[]): Record<string, ExampleProgram> {
  const map: Record<string, ExampleProgram> = {};
  for (const example of examples) map[example.id] = example;
  return map;
}

/**
 * @param key  where the code is remembered in the browser (see storageKey in ./storage.ts)
 * @param config  the examples of this category
 */
export function useMemberExamples(key: string, config: ExamplesConfig): MemberExamples {
  const { unlockUrl } = config;
  const [savedCode, setSavedCode] = useState<string | null>(() => loadJson(key, isSavedCode)?.code ?? null);
  const [status, setStatus] = useState<CodeStatus>(() => ({ phase: savedCode ? 'checking' : 'none', about: 'saved' }));
  const [forMembers, setForMembers] = useState(NO_EXAMPLES);
  const [forEveryone, setForEveryone] = useState(NO_EXAMPLES);
  const [openList, setOpenList] = useState<OpenListState>('loading');
  const [remembered, setRemembered] = useState(true);
  const [draft, setDraft] = useState('');

  /** Only the answer to the latest question of each kind counts (and none after the screen is gone). */
  const codeQuestion = useRef(0);
  const openQuestion = useRef(0);
  /** true once the server has said which examples need no code */
  const openListKnown = useRef(false);

  const askOpenList = useCallback(() => {
    const mine = ++openQuestion.current;
    setOpenList('loading');
    void requestUnlock(unlockUrl, null).then((outcome) => {
      if (openQuestion.current !== mine) return;
      if (outcome.kind === 'examples') {
        openListKnown.current = true;
        setForEveryone(byId(outcome.examples));
        setOpenList('ready');
      } else {
        setOpenList('unreachable');
      }
    });
  }, [unlockUrl]);

  const askCode = useCallback(
    (code: string, about: CodeStatus['about']) => {
      const mine = ++codeQuestion.current;
      setForMembers(NO_EXAMPLES);
      setStatus({ phase: 'checking', about });
      // the server could not be reached earlier: this is a new try, so ask for the open examples again as well
      if (!openListKnown.current) askOpenList();
      // (a short "wait" of the server is waited out: see requestUnlockPatiently)
      void requestUnlockPatiently(unlockUrl, code).then((outcome) => {
        if (codeQuestion.current !== mine) return;
        if (outcome.kind === 'examples') {
          setForMembers(byId(outcome.examples));
          setSavedCode(code);
          setRemembered(saveJson(key, { code }));
          setDraft('');
          setStatus({ phase: 'unlocked', about });
        } else if (outcome.kind === 'busy') {
          setStatus({ phase: 'busy', about, waitSeconds: outcome.waitSeconds });
        } else {
          setStatus({ phase: outcome.kind, about });
        }
      });
    },
    [askOpenList, key, unlockUrl],
  );

  // at the start of a visit: ask which examples need no code, and check the saved code again
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
        setForMembers(NO_EXAMPLES);
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
    removeKey(key);
    setSavedCode(null);
    setRemembered(true);
    setDraft('');
    setForMembers(NO_EXAMPLES);
    setStatus({ phase: 'none', about: 'saved' });
  }, [key]);

  const refreshOpenList = useCallback(() => {
    if (openList !== 'loading') askOpenList();
  }, [askOpenList, openList]);

  const available = status.phase === 'unlocked' ? forMembers : forEveryone;

  return useMemo(
    () => ({ config, available, status, openList, savedCode, remembered, draft, setDraft, submit, retry, forget, refreshOpenList }),
    [config, available, status, openList, savedCode, remembered, draft, submit, retry, forget, refreshOpenList],
  );
}
