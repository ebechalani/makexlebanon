'use client';

import { useEffect, useState } from 'react';
import type { Lesson } from '@/lib/lessons';
import { RobotLab } from './RobotLab';

/**
 * Sequential lesson player: one mission at a time — task, explanation,
 * progressive hints, simulator — with progress saved in the browser.
 */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const progressKey = `makex-lesson-${lesson.slug}`;
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hintsShown, setHintsShown] = useState(0);
  const [labTab, setLabTab] = useState<'sim' | 'mblock'>('sim');

  // Restore progress.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey) ?? '{}');
      if (saved.done) setDone(saved.done);
      if (typeof saved.step === 'number') {
        setStepIndex(Math.min(saved.step, lesson.steps.length - 1));
      }
    } catch {
      /* fresh start */
    }
  }, [progressKey, lesson.steps.length]);

  const persist = (nextDone: Record<string, boolean>, nextStep: number) => {
    try {
      localStorage.setItem(progressKey, JSON.stringify({ done: nextDone, step: nextStep }));
    } catch {
      /* non-fatal */
    }
  };

  const step = lesson.steps[stepIndex];
  const completed = Object.values(done).filter(Boolean).length;
  const [solutionShown, setSolutionShown] = useState(false);

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, lesson.steps.length - 1));
    setStepIndex(clamped);
    setHintsShown(0);
    setSolutionShown(false);
    setLabTab(lesson.steps[clamped].mat ? 'sim' : 'mblock');
    persist(done, clamped);
  };

  const markDone = () => {
    const next = { ...done, [step.slug]: true };
    setDone(next);
    persist(next, stepIndex);
  };

  return (
    <div>
      {/* Progress rail */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Missions">
        {lesson.steps.map((s, i) => (
          <li key={s.slug}>
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === stepIndex ? 'step' : undefined}
              className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ring-inset transition-colors ${
                i === stepIndex
                  ? 'bg-brand-500 text-white ring-brand-500'
                  : done[s.slug]
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-300'
                    : 'bg-white text-ink-600 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {done[s.slug] && i !== stepIndex ? '✓' : i + 1}
            </button>
          </li>
        ))}
        <li className="ml-2 text-sm text-ink-500">
          {completed}/{lesson.steps.length} missions complete
        </li>
      </ol>

      {/* Mission briefing */}
      <div className="mt-8 rounded-card bg-white p-7 ring-1 ring-slate-200/80">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Mission {stepIndex + 1} of {lesson.steps.length}
          {done[step.slug] ? ' · complete' : ''}
        </p>
        <h2 className="mt-2 text-2xl text-ink-900">{step.title}</h2>
        <div className="mt-3 gap-6 md:flex">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-medium leading-relaxed text-ink-800 text-pretty">
              {step.task}
            </p>
            <p className="mt-2 leading-relaxed text-ink-600 text-pretty">{step.explain}</p>
          </div>
          {step.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={step.photo}
              alt={`${step.title} — field setup`}
              className="mt-4 h-44 w-auto shrink-0 rounded-lg object-contain ring-1 ring-slate-200 md:mt-0"
            />
          ) : null}
        </div>

        {/* Progressive hints */}
        <div className="mt-5 space-y-2">
          {step.hints.slice(0, hintsShown).map((hint, i) => (
            <p
              key={hint.slice(0, 24)}
              className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800"
            >
              <span className="font-semibold">Hint {i + 1}:</span> {hint}
            </p>
          ))}
          {hintsShown < step.hints.length ? (
            <button
              type="button"
              onClick={() => setHintsShown((n) => n + 1)}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {hintsShown === 0 ? 'Need a hint?' : 'Another hint'} ({hintsShown}/
              {step.hints.length} used)
            </button>
          ) : null}
        </div>

        {/* Official solution — revealed on request only */}
        {step.solution ? (
          <div className="mt-6 border-t border-slate-200 pt-5">
            {!solutionShown ? (
              <button
                type="button"
                onClick={() => setSolutionShown(true)}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-700 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                Show the official solution
              </button>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                  Official solution
                </p>
                <div className="mt-4 flex flex-wrap gap-4">
                  {step.solution.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt="mBlock solution code"
                      className="max-h-72 w-auto max-w-full rounded-lg ring-1 ring-slate-200"
                    />
                  ))}
                </div>
                <div className="mt-4 overflow-hidden rounded-card bg-ink-950 ring-1 ring-slate-200">
                  <div className="relative aspect-video max-w-2xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${step.solution.videoId}?rel=0`}
                      title={`${step.title} — solution walkthrough`}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                </div>
                {!done[step.slug] ? (
                  <button
                    type="button"
                    onClick={markDone}
                    className="mt-4 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    I completed this task — mark it done
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Lab: simulator or the real mBlock IDE */}
      <div className="mt-8">
        <div className="flex gap-2" role="tablist" aria-label="Coding environment">
          {(
            [
              ...(step.mat ? [['sim', 'Simulator'] as ['sim' | 'mblock', string]] : []),
              ['mblock', 'mBlock IDE (real robot)'] as ['sim' | 'mblock', string],
            ] satisfies ['sim' | 'mblock', string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={labTab === tab}
              onClick={() => setLabTab(tab)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                labTab === tab
                  ? 'bg-white text-brand-700 ring-1 ring-slate-200'
                  : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-b-card rounded-tr-card bg-white p-5 ring-1 ring-slate-200">
          {labTab === 'sim' && step.mat ? (
            <RobotLab
              mat={step.mat}
              storageKey={`${progressKey}-ws-${step.slug}`}
              blockLimit={step.blockLimit}
              onSuccess={markDone}
            />
          ) : (
            <div>
              <p className="mb-3 text-sm text-ink-600">
                The full mBlock editor, for programming a real mBot2 over USB or Bluetooth.
                Recreate your simulator program here to run it on the physical robot.
              </p>
              <iframe
                src="https://ide.mblock.cc/"
                title="mBlock block-programming editor"
                className="h-160 w-full rounded-lg border-0 ring-1 ring-slate-200"
                allow="usb; bluetooth; serial"
              />
            </div>
          )}
        </div>
      </div>

      {/* Step navigation */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          className="rounded-lg px-5 py-3 text-sm font-semibold text-ink-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous mission
        </button>
        {stepIndex < lesson.steps.length - 1 ? (
          <button
            type="button"
            onClick={() => goTo(stepIndex + 1)}
            className={`rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
              done[step.slug]
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'text-ink-700 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            Next mission →
          </button>
        ) : completed === lesson.steps.length ? (
          <p className="rounded-lg bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">
            Course complete — you are ready for the real field! 🏆
          </p>
        ) : null}
      </div>
    </div>
  );
}
