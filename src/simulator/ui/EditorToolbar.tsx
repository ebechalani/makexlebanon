'use client';

/**
 * The strip of buttons above the block workspace: New, Examples, Open file, Save to file,
 * Undo and Redo.
 */
import { useRef, useState } from 'react';
import { ExamplesDialog } from './ExamplesDialog';
import { ExamplesIcon, NewFileIcon, OpenIcon, RedoIcon, SaveIcon, UndoIcon } from './icons';
import type { ExampleProgram } from './member-unlock';
import { useScreenText } from './text/context';
import type { MemberExamples } from './useMemberExamples';
import { button } from './widgets';

export interface EditorToolbarProps {
  ready: boolean;
  canUndo: boolean;
  canRedo: boolean;
  blocks: number;
  /** the examples of the category and what this visitor may load of them (see ./useMemberExamples.ts) */
  examples: MemberExamples;
  onNew: () => void;
  onExample: (example: ExampleProgram) => void;
  /** the text of the file the student picked */
  onOpenFile: (text: string, fileName: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/** Toolbar button; a little tighter on a phone, so that all six fit on one row there. */
const TOOL = `${button.ghost} max-sm:gap-1 max-sm:px-1.5`;

export function EditorToolbar(props: EditorToolbarProps) {
  const { ready, examples } = props;
  const text = useScreenText();
  const [examplesOpen, setExamplesOpen] = useState(false);
  // (what the button says when the pointer rests on it must be true for this visitor)
  const canLoadExamples = Object.keys(examples.available).length > 0;
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      props.onOpenFile(await file.text(), file.name);
    } catch {
      props.onOpenFile('', file.name);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-2 py-1.5 sm:gap-1" role="toolbar" aria-label={text.toolbarLabel}>
      <button type="button" className={TOOL} onClick={props.onNew} disabled={!ready} title={text.newHint}>
        <NewFileIcon className="h-4 w-4" />
        {text.newButton}
      </button>

      <button
        type="button"
        className={TOOL}
        aria-haspopup="dialog"
        onClick={() => {
          // (the website could not be reached earlier: it is asked again now, before the window says so once more)
          examples.askAgainIfNotReached();
          setExamplesOpen(true);
        }}
        disabled={!ready}
        title={canLoadExamples ? text.examplesWords.buttonHint : text.examplesWords.buttonHintLocked}
      >
        <ExamplesIcon className="h-4 w-4" />
        {text.examplesButton}
      </button>
      {examplesOpen && (
        <ExamplesDialog
          examples={examples}
          onLoad={(example) => {
            setExamplesOpen(false);
            props.onExample(example);
          }}
          onClose={() => setExamplesOpen(false)}
        />
      )}

      <button type="button" className={TOOL} onClick={() => fileRef.current?.click()} disabled={!ready} title={text.openHint}>
        <OpenIcon className="h-4 w-4" />
        {text.openButton}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          // allow picking the same file again later
          event.target.value = '';
        }}
      />
      <button type="button" className={TOOL} onClick={props.onSave} disabled={!ready} title={text.saveHint}>
        <SaveIcon className="h-4 w-4" />
        {text.saveButton}
      </button>

      <span className="mx-1 h-6 w-px bg-slate-200 max-sm:hidden" aria-hidden="true" />

      <button type="button" className={TOOL} onClick={props.onUndo} disabled={!ready || !props.canUndo} aria-label={text.undo} title={text.undoHint}>
        <UndoIcon className="h-4 w-4" />
        <span className="hidden xl:inline">{text.undo}</span>
      </button>
      <button type="button" className={TOOL} onClick={props.onRedo} disabled={!ready || !props.canRedo} aria-label={text.redo} title={text.redoHint}>
        <RedoIcon className="h-4 w-4" />
        <span className="hidden xl:inline">{text.redo}</span>
      </button>

      <span className="ml-auto hidden pr-1 text-xs text-ink-500 xl:inline" title={text.autosaveHint}>
        {ready ? text.blockCount(props.blocks) : text.toolbarLoading}
      </span>
    </div>
  );
}
