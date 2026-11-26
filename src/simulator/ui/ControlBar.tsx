'use client';

/**
 * The match controls above the stage: the referee's start signal (green flag), Stop, Pause,
 * the rules "Restart", the team's "Finished" call, Reset field, the match clock, the live score
 * and the speed of the simulation.
 *
 * What a restart costs, and how many a match allows, is the game's rule: the button shows it
 * ("-5" in Fire Rescue, "1 left" in Fire Chief) and is off once none is left - see
 * restartButton() in ./match-words.ts.
 */
import type { RestartRules, ScoreReport } from '../core/types';
import { FinishIcon, FlagIcon, PauseIcon, PlayIcon, ResetIcon, RestartIcon, StopIcon } from './icons';
import { DEFAULT_WORDS, type ScreenWords } from './screen-words';
import { useScreenText } from './text/context';
import { SPEEDS, type RunState, type Speed } from './useSimulation';
import { button } from './widgets';

export interface ControlBarProps {
  runState: RunState;
  /** false while the block editor is still loading: there is no program to start yet */
  canStart: boolean;
  timeLeft: number;
  score: ScoreReport;
  /** points one restart costs (Game.restartPenalty) */
  restartPenalty: number;
  /** the game's own restart rules (Game.restartRules); left out = no limit, restartPenalty points each */
  restartRules?: RestartRules;
  /** restarts the team may still use in this match (Simulation.restartsLeft); left out = no limit */
  restartsLeft?: number;
  /**
   * false: there is no "Restart" button at all - for a game whose rules have no restarts (Locker
   * Room: anyone touching the robot after GO voids the run). Left out: the button is there, as in
   * every other game.
   */
  restartButton?: boolean;
  /**
   * How many digits wide the score's number always is (Logistique intelligente: 3, for 0 … 500),
   * so that the box does not grow during a match. Left out: as wide as the number it shows (on a
   * French page the stylesheet keeps room for two: ./simulator.css).
   */
  scoreDigits?: number;
  /** the game's words (left out: the words of Fire Rescue) */
  words?: ScreenWords;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onFinished: () => void;
  onReset: () => void;
}

/*
 * The bar adapts to the width of its own column, not to the width of the screen: on a tablet the
 * stage column is narrow although the screen is not. That is what the "@[34rem]:" classes do
 * (container queries): they apply once the bar itself is at least 34rem (544 px) wide.
 * (They are written out in full everywhere because Tailwind only finds complete class names.)
 */

const BIG =
  'inline-flex h-11 select-none items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-bold text-white shadow-sm transition ' +
  `@[34rem]:h-12 @[34rem]:px-5 @[34rem]:text-base ` +
  'disabled:cursor-not-allowed disabled:opacity-40';

/** Smaller buttons of the second row; their icons are dropped when the column is narrow. */
const SMALL = `${button.plain} px-2`;
/**
 * The same button when it is off but must keep the keyboard focus (see `usedUp` below): the look
 * of a button that is switched off, and no change of colour under the pointer or a finger.
 */
const SMALL_USED_UP = `${SMALL.replace(/ (?:hover|active):\S+/g, '')} cursor-not-allowed opacity-40`;
/** The same button when it is the natural next step (Reset field once the match is over). */
const SMALL_NEXT = `${button.accent} px-2`;
const SMALL_ICON = `hidden h-4 w-4 @[34rem]:block`;
/**
 * The same icons in a game whose "Restart" button counts the restarts that are left ("1 left"):
 * that label is wider than a "-5", and at exactly 34rem the row would need a second line. So
 * there the icons come a little later.
 */
const SMALL_ICON_LATER = `hidden h-4 w-4 @[36rem]:block`;

export function ControlBar(props: ControlBarProps) {
  const { runState, timeLeft, score, speed } = props;
  const text = useScreenText();
  const active = runState === 'running' || runState === 'paused';
  /** the match was stopped or is over: the field shows the end of that run until it is reset */
  const over = runState === 'stopped' || runState === 'finished';
  const lowTime = active && timeLeft <= 30;
  const words = props.words ?? DEFAULT_WORDS;
  const { match } = words;
  const restart = text.restartButton({ penalty: props.restartPenalty, rules: props.restartRules }, props.restartsLeft ?? Infinity, match);
  const smallIcon = restart.tone === 'cost' ? SMALL_ICON : SMALL_ICON_LATER;

  // In a game that allows only so many restarts, the last one switches the "Restart" button off
  // in the middle of a match. A button that is really switched off (`disabled`) while it has
  // the keyboard focus drops the focus to the page, and somebody who works with the keyboard
  // has to find their way back. So during a match a used-up button is "off" in every way but
  // that one: it looks off, it says that it is off (aria-disabled) and why (its hint), a press
  // does nothing - and the focus stays on it. (The focus is not moved on to "Finished" instead:
  // somebody who holds the Enter key a moment too long would end the attempt with it.)
  // A game without a limit never switches the button off during a match: nothing changes there.
  const usedUp = active && !restart.allowed;

  const speedPicker = (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-semibold uppercase tracking-wide text-ink-500 @[42rem]:inline" aria-hidden="true">
        {text.speedWord}
      </span>
      <div
        role="radiogroup"
        aria-label={text.speedGroup}
        title={text.speedHint(match)}
        className="flex rounded-lg border border-slate-300"
      >
        {SPEEDS.map((option) => {
          const selected = option === speed;
          return (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => props.onSpeed(option)}
              className={
                // (the group is not clipped, so that the focus ring of a choice can show around it; the corners are rounded here instead)
                'min-w-7 border-l border-slate-300 px-1 py-2 text-xs font-bold @[34rem]:px-1.5 first:rounded-l-[7px] first:border-l-0 last:rounded-r-[7px] focus-visible:relative focus-visible:z-10 ' +
                (selected ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 hover:bg-slate-50')
              }
            >
              {text.speedLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="@container flex flex-col gap-2">
      {/* the referee's signal, the clock and the score */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={props.onStart}
          disabled={active || !props.canStart}
          className={`${BIG} bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800`}
          title={text.startHint(over)}
        >
          <FlagIcon className="h-6 w-6" />
          {text.start}
        </button>
        <button
          type="button"
          onClick={props.onStop}
          disabled={!active}
          className={`${BIG} bg-rose-600 hover:bg-rose-700 active:bg-rose-800 @[34rem]:px-4`}
          title={text.stopHint(match)}
        >
          <StopIcon className="h-5 w-5" />
          {text.stop}
        </button>
        <button
          type="button"
          onClick={runState === 'paused' ? props.onResume : props.onPause}
          disabled={!active}
          aria-label={runState === 'paused' ? text.resume : text.pause}
          title={runState === 'paused' ? text.resume : text.pauseHint(match)}
          className={`${button.icon} h-11 w-11 rounded-xl @[34rem]:h-12 @[34rem]:w-12`}
        >
          {runState === 'paused' ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
        </button>

        <div className={`ml-auto flex items-center gap-2.5 rounded-card border border-slate-200 bg-white px-2 py-1 shadow-sm @[34rem]:gap-4 @[34rem]:px-3 @[34rem]:py-1.5`}>
          <div
            className={`flex flex-col leading-none @[34rem]:flex-row @[34rem]:items-baseline @[34rem]:gap-1.5`}
            role="timer"
            aria-label={text.clockLabel(match, text.clock(timeLeft))}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{text.timeWord}</span>
            <span className={`font-mono text-xl font-bold tabular-nums @[34rem]:text-2xl ${lowTime ? 'text-rose-600' : 'text-ink-900'}`}>
              {text.clock(timeLeft)}
            </span>
          </div>
          <div
            className={`flex flex-col leading-none @[34rem]:flex-row @[34rem]:items-baseline @[34rem]:gap-1.5`}
            aria-label={text.scoreLabel(score.total, score.max)}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{text.scoreWord}</span>
            <span className="flex items-baseline gap-1">
              <span
                className={`font-mono text-xl font-bold tabular-nums text-ink-900 @[34rem]:text-2xl`}
                // (an inline width wins over the stylesheet's two digits; its text-align: right stays)
                style={props.scoreDigits ? { minWidth: `${props.scoreDigits}ch` } : undefined}
              >
                {score.total}
              </span>
              <span className="text-xs font-medium text-ink-500">/ {score.max}</span>
            </span>
          </div>
        </div>
      </div>

      {/* what the team may do during a match, and how fast the simulation runs */}
      <div className="flex flex-wrap items-center gap-2">
        {/* (a game whose rules have no restarts has no Restart button: `restartButton`) */}
        {props.restartButton !== false && (
          <button
            type="button"
            onClick={usedUp ? undefined : props.onRestart}
            disabled={!active}
            aria-disabled={usedUp ? true : undefined}
            className={usedUp ? SMALL_USED_UP : SMALL}
            title={restart.hint}
          >
            <RestartIcon className={`${smallIcon} text-amber-600`} />
            {text.restartWord}
            {restart.badge !== '' && (
              <span
                className={
                  // (none left: grey, like everything about a button that is off)
                  restart.tone === 'none'
                    ? 'whitespace-nowrap rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-ink-700'
                    : 'rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800' + (restart.tone === 'left' ? ' whitespace-nowrap' : '')
                }
              >
                {/* (a cost is written as "-" and the number, two pieces of text, as it always was: see the note in ScoreSheet.tsx) */}
                {restart.tone === 'cost' ? <>-{props.restartPenalty}</> : restart.badge}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={props.onFinished}
          disabled={!active}
          className={SMALL}
          title={words.finishedHint}
        >
          <FinishIcon className={`${smallIcon} text-ink-500`} />
          {text.finishedWord}
        </button>
        <button
          type="button"
          onClick={props.onReset}
          disabled={runState === 'ready'}
          className={over ? SMALL_NEXT : SMALL}
          aria-label={text.resetLabel}
          title={text.resetHint(words.resetHint, match)}
        >
          <ResetIcon className={`${smallIcon} ${over ? 'text-brand-700' : 'text-ink-500'}`} />
          {/* (a language whose button word is the whole command has no second word: no empty span) */}
          {text.resetWord}{text.resetFieldWord ? <span className={`hidden @[34rem]:inline`}>{text.resetFieldWord}</span> : null}
        </button>
        <div className="ml-auto">{speedPicker}</div>
      </div>
    </div>
  );
}
