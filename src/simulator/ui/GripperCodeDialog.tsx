'use client';

/**
 * The window "Inside the Gripper blocks".
 *
 * Real mBlock has no Gripper category: the three Gripper blocks are shortcuts made for this
 * simulator. This window shows, for each of the five things they can do, the Gripper block on
 * the left and on the right the code it stands for - a My Block made of the servo block and a
 * wait, which a student can rebuild in real mBlock. What that code is, and where its numbers
 * come from, is in ../blocks/gripper-original.ts.
 *
 * Both sides are real Blockly blocks, drawn by Blockly in small read-only workspaces: they look
 * exactly like the blocks of the palette and of the workspace, at the same size. Nothing in them
 * can be clicked or reached with the Tab key; a screen reader gets each of them as one picture
 * with the blocks in words.
 *
 * Two buttons at the bottom change the student's program, each as one step of Undo:
 *   "Add these My Blocks to my program"   the five definitions, as normal My Blocks
 *   "Show my program the mBlock way"      every Gripper block becomes a call of its My Block
 *
 * It opens from the button at the top of the Gripper palette, and from the entry "See the real
 * mBlock code" in the right-click menu of a Gripper block - then at that block.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addGripperMyBlocks,
  convertGripperBlocks,
  gripperBlockProgram,
  gripperDefinitionProgram,
  gripperOriginals,
  MBOT2_THEME,
  registerBlocks,
  RENDERER,
  type BlocklyApi,
  type GripperVariantId,
} from '../blocks';
import type { ProgramJson, RobotConfig } from '../core/types';
import type { BlocklyEditorHandle } from './BlocklyEditor';
import { addedMessage, convertedMessage, GRIPPER_CODE_WORDS as WORDS, gripperCodeIntro } from './gripper-code-words';
import { button, Modal } from './widgets';

export interface GripperCodeDialogProps {
  robotConfig: RobotConfig;
  /** the Gripper block the window was opened at: it is brought into view and marked; null = opened from the palette */
  at: GripperVariantId | null;
  /** the student's block workspace (null while it is still loading) */
  getEditor: () => BlocklyEditorHandle | null;
  /** folder with Blockly's own pictures, ending with a slash */
  mediaPath: string;
  /** called after "Show my program the mBlock way" has changed the blocks on the workspace */
  onConverted?: () => void;
  onClose: () => void;
}

/** The pictures are drawn at the zoom the editor starts with, so a block looks as it does in the palette. */
const PICTURE_SCALE = 0.75;
/** A picture is made smaller when its place is narrower than the blocks (a phone), down to this zoom. */
const PICTURE_MIN_SCALE = 0.4;
/** Free space around the blocks of a picture (pixels): room for the outline of the blocks. */
const PICTURE_MARGIN = 3;

interface BlockPictureProps {
  Blockly: BlocklyApi;
  program: ProgramJson;
  /** the blocks in words, for screen readers */
  description: string;
  mediaPath: string;
}

/** Real Blockly blocks as a picture: read-only, exactly as large as the blocks, never wider than its place. */
function BlockPicture({ Blockly, program, description, mediaPath }: BlockPictureProps) {
  /** as wide as the place the picture has */
  const frameRef = useRef<HTMLDivElement>(null);
  /** what Blockly draws into: as large as the blocks */
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const host = hostRef.current;
    if (!frame || !host) return;

    // Blockly keeps track of "the workspace in use" (it puts its menus and text boxes there, and
    // sends keyboard shortcuts to it). A new workspace takes that role when it is made; a picture
    // must not, so the role goes straight back to the student's editor.
    const inUse = Blockly.common.getMainWorkspace();
    const workspace = Blockly.inject(host, {
      readOnly: true,
      renderer: RENDERER,
      theme: MBOT2_THEME,
      media: mediaPath,
      sounds: false,
      scrollbars: false,
      trashcan: false,
      move: { scrollbars: false, drag: false, wheel: false },
      zoom: { controls: false, wheel: false, pinch: false, startScale: PICTURE_SCALE, minScale: PICTURE_MIN_SCALE, maxScale: 1 },
    });
    if (inUse && inUse !== workspace) Blockly.common.setMainWorkspace(inUse);
    let width = 0;
    let height = 0;
    let left = 0;
    let top = 0;
    try {
      Blockly.serialization.workspaces.load(program, workspace, { recordUndo: false });
      const box = workspace.getBlocksBoundingBox();
      width = box.right - box.left;
      height = box.bottom - box.top;
      left = box.left;
      top = box.top;
    } catch {
      // nothing to show: the picture stays empty, its description is still read out
    }

    /** Give the picture the size of its blocks; when its place is narrower than that, draw the blocks smaller. */
    const fit = () => {
      const room = frame.clientWidth - 2 * PICTURE_MARGIN;
      if (!(width > 0) || !(room > 0)) return;
      const scale = Math.max(PICTURE_MIN_SCALE, Math.min(PICTURE_SCALE, room / width));
      host.style.width = `${Math.ceil(width * scale) + 2 * PICTURE_MARGIN}px`;
      host.style.height = `${Math.ceil(height * scale) + 2 * PICTURE_MARGIN}px`;
      if (Math.abs(workspace.scale - scale) > 1e-3) workspace.setScale(scale);
      Blockly.svgResize(workspace);
      workspace.translate(PICTURE_MARGIN - left * scale, PICTURE_MARGIN - top * scale);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);

    return () => {
      observer.disconnect();
      workspace.dispose();
    };
  }, [Blockly, program, mediaPath]);

  return (
    <div ref={frameRef} role="img" aria-label={description} className="mbot2-block-picture min-w-0 overflow-hidden">
      {/* (inert: the blocks of a picture cannot be clicked, dragged or reached with the Tab key) */}
      <div ref={hostRef} inert className="h-10 w-10" />
    </div>
  );
}

export function GripperCodeDialog({ robotConfig, at, getEditor, mediaPath, onConverted, onClose }: GripperCodeDialogProps) {
  // ---- Blockly draws the pictures. The editor has loaded it already, so this is there at once.
  const [Blockly, setBlockly] = useState<BlocklyApi | null>(null);
  const [drawingFailed, setDrawingFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    import('blockly')
      .then((module) => {
        if (gone) return;
        registerBlocks(module);
        setBlockly(module);
      })
      .catch(() => {
        if (!gone) setDrawingFailed(true);
      });
    return () => {
      gone = true;
    };
  }, []);

  const pairs = useMemo(
    () =>
      gripperOriginals(robotConfig).map((original) => ({
        original,
        block: gripperBlockProgram(original.variant.id),
        code: gripperDefinitionProgram(robotConfig, original.variant.id),
      })),
    [robotConfig],
  );

  // ---- opened at one Gripper block: bring its pair into view (once the pictures have their size)
  const atRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (Blockly && at) atRef.current?.scrollIntoView({ block: 'center' });
  }, [Blockly, at]);

  // ---- when the window closes, the keyboard goes back to where it was (the Modal sees to that).
  // Where it was may be gone by then - the palette has closed, the Gripper block was replaced - and
  // the keyboard would be left with nothing. It then goes to the workspace, so that Ctrl+Z undoes
  // what a button of this window did without a click on the workspace first.
  const getEditorRef = useRef(getEditor);
  useEffect(() => {
    getEditorRef.current = getEditor;
  });
  useEffect(
    () => () => {
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) getEditorRef.current()?.focus();
      }, 0);
    },
    [],
  );

  // ---- the two buttons
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  /** Change the student's program with one of the two functions of gripper-original.ts; one step of Undo. */
  const apply = (changeProgram: typeof addGripperMyBlocks, describe: (change: ReturnType<typeof addGripperMyBlocks>) => string, after?: () => void) => {
    const editor = getEditor();
    if (!editor) {
      setMessage({ text: WORDS.notReady, tone: 'error' });
      return;
    }
    const current = editor.getProgram();
    const change = changeProgram(current, robotConfig);
    // (nothing to change: the workspace is left alone, so that Undo has nothing new to undo)
    if (change.program !== current) {
      if (!editor.loadProgram(change.program)) {
        setMessage({ text: WORDS.failed, tone: 'error' });
        return;
      }
      after?.();
    }
    setMessage({ text: describe(change), tone: 'info' });
  };

  return (
    <Modal title={WORDS.title} onClose={onClose} widthClass="max-w-3xl">
      <div className="space-y-1.5 text-sm leading-relaxed text-ink-700" data-gripper-code-intro>
        {gripperCodeIntro(robotConfig).map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>

      {drawingFailed && (
        <p role="alert" className="mt-4 text-sm font-semibold text-rose-700">
          {WORDS.drawingFailed}
        </p>
      )}
      {!Blockly && !drawingFailed && (
        <p role="status" className="mt-4 text-sm text-ink-500">
          {WORDS.drawing}
        </p>
      )}

      {Blockly && (
        <>
          {/* (side by side the two headings stand once, above the columns; stacked, every picture has its own short one) */}
          <div className="mt-4 hidden grid-cols-[17.5rem_minmax(0,1fr)] gap-x-4 border-b border-slate-200 pb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 sm:grid" aria-hidden="true">
            <span>{WORDS.blockHeading}</span>
            <span>{WORDS.codeHeading}</span>
          </div>
          <ul className="mt-2 sm:mt-0" data-gripper-code-pairs>
            {pairs.map(({ original, block, code }) => {
              const here = original.variant.id === at;
              return (
                <li
                  key={original.variant.id}
                  ref={here ? atRef : undefined}
                  data-gripper-pair={original.variant.id}
                  aria-current={here ? 'true' : undefined}
                  className={`grid grid-cols-1 gap-x-4 gap-y-2 border-b border-slate-200 px-1 py-3 last:border-b-0 sm:grid-cols-[17.5rem_minmax(0,1fr)] sm:items-start ${
                    here ? 'rounded-lg bg-brand-50 ring-2 ring-inset ring-brand-400' : ''
                  }`}
                >
                  <div className="min-w-0" data-gripper-side="block">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500 sm:hidden">{WORDS.blockCaption}</p>
                    <BlockPicture Blockly={Blockly} program={block} description={`Gripper block: ${original.variant.label}`} mediaPath={mediaPath} />
                  </div>
                  <div className="min-w-0" data-gripper-side="code">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500 sm:hidden">{WORDS.codeCaption}</p>
                    <BlockPicture Blockly={Blockly} program={code} description={`My Block: ${original.lines.join(', ')}`} mediaPath={mediaPath} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* The two buttons stay in view while the pairs scroll - unless the screen is very low (a
          small phone, a phone held sideways): there they would leave too little room for the
          pairs, so they come at the end.
          (-bottom-4 / -mb-4 / -mx-4: out to the edges of the window, through the padding around its content) */}
      <div className="-bottom-4 -mx-4 -mb-4 mt-3 border-t border-slate-200 bg-white px-4 py-3 [@media(min-height:40rem)]:sticky" data-gripper-code-actions>
        <p
          role={message?.tone === 'error' ? 'alert' : 'status'}
          data-gripper-code-message
          className={`text-sm font-semibold ${message ? 'mb-2.5' : ''} ${message?.tone === 'error' ? 'text-rose-700' : 'text-ink-800'}`}
        >
          {message?.text}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={button.accent} title={WORDS.addHint} onClick={() => apply(addGripperMyBlocks, addedMessage)}>
            {WORDS.addButton}
          </button>
          <button type="button" className={button.accent} title={WORDS.convertHint} onClick={() => apply(convertGripperBlocks, convertedMessage, onConverted)}>
            {WORDS.convertButton}
          </button>
        </div>
      </div>
    </Modal>
  );
}
