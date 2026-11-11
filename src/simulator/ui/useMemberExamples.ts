'use client';

/**
 * The members' examples on the simulator screen: which code is saved on this device, whether
 * the server accepted it, and the programs it handed out.
 *
 * A code that the server accepted is remembered in the browser, so a member types it once per
 * device. But a remembered code opens nothing by itself: at the start of every visit it is
 * checked with the server again, and the members' examples stay locked until the server has
 * said yes - also when the server cannot be reached. That is how a code that was cancelled
 * stops working.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgramJson } from '../core/types';
import { isSavedCode, requestUnlock, tidyCode } from './member-unlock';
import { loadJson, removeKey, saveJson } from './storage';

/** The card of a members' example: everything but its program. */
export interface MemberExampleInfo {
  id: string;
  title: string;
  level: 'starter' | 'intermediate' | 'advanced';
  description: string;
}

/** What a category hands to the simulator screen when some of its examples are for members. */
export interface MemberExamplesConfig {
  /** address on this website that checks a code (see src/app/api/simulator/unlock/route.ts) */
  unlockUrl: string;
  /** the cards of the members' examples */
  locked: MemberExampleInfo[];
  /** one sentence on where a code comes from, shown next to the field for the code */
  whereCodesComeFrom?: string;
}

/**
 * Where things stand:
 *
 *   none          no code was typed, none is saved
 *   checking      the server is being asked
 *   unlocked      the server said yes: `programs` holds the members' programs
 *   rejected      the server said no
 *   busy          the server asks to wait (too many wrong codes from this network)
 *   unreachable   the server could not be asked: nothing is known about the code
 */
export type MemberPhase = 'none' | 'checking' | 'unlocked' | 'rejected' | 'busy' | 'unreachable';

export interface MemberStatus {
  phase: MemberPhase;
  /** which code this is about: one just typed, or the one saved on this device */
  about: 'typed' | 'saved';
}

export interface MemberExamples {
  config: MemberExamplesConfig;
  status: MemberStatus;
  /** the members' programs by example id; empty unless unlocked */
  programs: Record<string, ProgramJson>;
  /** the code saved on this device (FIRE-7K2M-9QXD), or null */
  savedCode: string | null;
  /** false when the browser refused to remember the accepted code (it will be asked for again) */
  remembered: boolean;
  /** check a code that was just typed */
  submit: (typed: string) => void;
  /** check the saved code once more */
  retry: () => void;
  /** forget the saved code on this device and lock the members' examples */
  forget: () => void;
}

const NO_PROGRAMS: Record<string, ProgramJson> = {};

/**
 * @param key  where the code is remembered in the browser (see storageKey in ./storage.ts)
 * @param config  the members' examples of this category; undefined when it has none
 */
export function useMemberExamples(key: string, config: MemberExamplesConfig | undefined): MemberExamples | null {
  const [savedCode, setSavedCode] = useState<string | null>(() => (config ? (loadJson(key, isSavedCode)?.code ?? null) : null));
  const [status, setStatus] = useState<MemberStatus>(() => ({ phase: savedCode ? 'checking' : 'none', about: 'saved' }));
  const [programs, setPrograms] = useState(NO_PROGRAMS);
  const [remembered, setRemembered] = useState(true);

  /** Only the answer to the latest question counts (and none after the screen is gone). */
  const question = useRef(0);
  const unlockUrl = config?.unlockUrl;

  const ask = useCallback(
    (code: string, about: MemberStatus['about']) => {
      if (!unlockUrl) return;
      const mine = ++question.current;
      setPrograms(NO_PROGRAMS);
      setStatus({ phase: 'checking', about });
      void requestUnlock(unlockUrl, code).then((outcome) => {
        if (question.current !== mine) return;
        if (outcome.kind === 'unlocked') {
          setPrograms(outcome.programs);
          setSavedCode(code);
          setRemembered(saveJson(key, { code }));
        }
        setStatus({ phase: outcome.kind, about });
      });
    },
    [key, unlockUrl],
  );

  // at the start of a visit: check the saved code with the server again
  const firstCode = useRef(savedCode);
  useEffect(() => {
    if (firstCode.current) ask(firstCode.current, 'saved');
    return () => {
      question.current++;
    };
  }, [ask]);

  const submit = useCallback(
    (typed: string) => {
      const code = tidyCode(typed);
      if (code === null) {
        // not even the shape of a code: no need to ask the server
        question.current++;
        setPrograms(NO_PROGRAMS);
        setStatus({ phase: 'rejected', about: 'typed' });
        return;
      }
      ask(code, 'typed');
    },
    [ask],
  );

  const retry = useCallback(() => {
    if (savedCode) ask(savedCode, 'saved');
  }, [ask, savedCode]);

  const forget = useCallback(() => {
    question.current++;
    removeKey(key);
    setSavedCode(null);
    setRemembered(true);
    setPrograms(NO_PROGRAMS);
    setStatus({ phase: 'none', about: 'saved' });
  }, [key]);

  if (!config) return null;
  return { config, status, programs, savedCode, remembered, submit, retry, forget };
}
