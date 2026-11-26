'use client';

/**
 * The block workspace (Blockly with the mBlock-style blocks of ../blocks).
 *
 * Blockly needs a real browser, so it is loaded here, on the client, after the component has
 * appeared on the page (dynamic import inside useEffect). The rest of the page talks to the
 * workspace through a small "handle" object: get the program, load a program, undo, redo,
 * highlight the running blocks, select a block.
 *
 * The blocks are saved to the browser's storage a moment after every change, so a refresh or a
 * closed tab does not lose the student's work.
 *
 * The editor speaks the language of the screen (./text: `useScreenText().locale`): on the French
 * page of Robot en fête 2027 its palette, its blocks and Blockly's own words are French, and its
 * number bubbles read a decimal comma (../blocks/locale.ts). Blockly's French file is fetched only
 * there, as a chunk of its own: an English page never loads it.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type * as BlocklyModule from 'blockly';
import { createEditor, disposeEditor, type BlocklyApi, type GripperCodeHandler } from '../blocks';
import { blocklyMessagesOf } from '../blocks/locale';
import type { ProgramJson } from '../core/types';
import { isProgramJson, withoutRetiredBlocks } from './program-file';
import { programFitScale } from './program-view';
import { loadJson, saveJson } from './storage';
import { useScreenText } from './text/context';

export interface BlocklyEditorHandle {
  /** the blocks as they are right now */
  getProgram: () => ProgramJson;
  /** replace the blocks (can be undone); false when the program could not be shown, the old blocks are kept */
  loadProgram: (program: ProgramJson) => boolean;
  undo: () => void;
  redo: () => void;
  /** show these blocks as "running" (and no others) */
  highlight: (ids: readonly string[]) => void;
  /** scroll to a block and select it; false when it no longer exists */
  selectBlock: (id: string) => boolean;
  /** number of blocks in the workspace (white bubbles not counted) */
  blockCount: () => number;
  /** give the keyboard to the workspace, so that its shortcuts (Ctrl+Z ...) work without a click on it first */
  focus: () => void;
}

export interface EditorStatus {
  canUndo: boolean;
  canRedo: boolean;
  blocks: number;
}

export interface BlocklyEditorProps {
  /** localStorage key the workspace is saved under */
  storageKey: string;
  /**
   * The game whose block palette the editor shows: Game.id (see ../blocks/palettes.ts).
   * Left out: the palette of Fire Rescue. It is read once, when the editor is made.
   */
  palette?: string;
  /** what to show when nothing has been saved yet */
  initialProgram: () => ProgramJson;
  /** folder with Blockly's own pictures (sprites, cursors), ending with a slash */
  mediaPath: string;
  /** called with the handle once the editor is ready, and with null when it goes away */
  onReady: (handle: BlocklyEditorHandle | null) => void;
  /** called after every change of the blocks */
  onStatus?: (status: EditorStatus) => void;
  /** called when the student asks to see the real mBlock code of the Gripper blocks (see ./GripperCodeDialog.tsx) */
  onGripperCode?: GripperCodeHandler;
  /**
   * called once, when the editor is ready, with one sentence for the student - only when the
   * saved blocks could not be shown as they were saved (blocks the simulator no longer has
   * were taken out: see withoutRetiredBlocks in ./program-file.ts)
   */
  onSavedNote?: (text: string) => void;
}

/** Space kept free above and to the left of the program after loading (pixels). */
const PROGRAM_MARGIN = 28;

/** Space kept free to the right of and below the program when it is fitted: the scroll bars live there (pixels). */
const SCROLLBAR_ROOM = 20;

/** The smallest zoom a program is shown at after loading: the text on the blocks is still easy to read. */
const MIN_READABLE_SCALE = 0.6;

/**
 * Show a program that was just loaded (an example, a file, the saved blocks): its top-left
 * corner near the top-left corner of the view, and - when it is too large for the editor at the
 * normal zoom - zoomed out so that all of it can be seen, as far as it stays readable
 * (the exact rule is in ./program-view.ts). It never zooms in beyond the normal zoom.
 */
function showProgram(ws: BlocklyModule.WorkspaceSvg): void {
  const metrics = ws.getMetricsManager();
  const whole = metrics.getContentMetrics(true); // the program at zoom 1
  const view = metrics.getViewMetrics(false); // the visible part of the workspace, in pixels
  const scale = programFitScale({
    contentWidth: whole.width,
    contentHeight: whole.height,
    viewWidth: view.width,
    viewHeight: view.height,
    marginX: PROGRAM_MARGIN + SCROLLBAR_ROOM,
    marginY: PROGRAM_MARGIN + SCROLLBAR_ROOM,
    defaultScale: ws.options.zoomOptions.startScale,
    minScale: MIN_READABLE_SCALE,
  });
  if (Math.abs(scale - ws.scale) > 1e-3) ws.setScale(scale);

  const content = metrics.getContentMetrics(false);
  if (content.width === 0 && content.height === 0) return;
  ws.scroll(PROGRAM_MARGIN - content.left, PROGRAM_MARGIN - content.top);
}

/** Wait this long after the last change before saving (ms). */
const SAVE_DELAY = 400;

/** CSS class (see simulator.css) that makes a block flash, and how long it stays on the block (ms). */
const ATTENTION_CLASS = 'mbot2-attention';
const ATTENTION_MS = 2000;

function BlocklyEditorImpl(props: BlocklyEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const { storageKey, mediaPath, palette } = props;
  // the words of the screen, and the language of the blocks (read once, when the editor is made)
  const text = useScreenText();
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  });
  const locale = text.locale;

  useEffect(() => {
    let disposed = false;
    let workspace: BlocklyModule.WorkspaceSvg | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: ResizeObserver | null = null;
    let dialogLang: MutationObserver | null = null;
    let saveNow: (() => void) | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    let blockly: BlocklyApi | null = null;

    const setUp = async () => {
      const Blockly: BlocklyApi = await import('blockly');
      blockly = Blockly;
      // Blockly's own words in French (only the French page fetches them)
      const frenchMessages = locale === 'fr' ? blocklyMessagesOf(await import('blockly/msg/fr')) : undefined;
      const host = hostRef.current;
      if (disposed || !host) return;

      // Blockly's standard palette is used: a category opens its blocks over the workspace and
      // closes again when a block has been dragged out. (The always-open palette of
      // '@blockly/continuous-toolbox' is as wide as its widest block, which would leave almost
      // no room for the program in this half-screen editor.)
      const ws = createEditor(Blockly, host, {
        media: mediaPath,
        // a classroom full of clicking robots is loud enough
        sounds: false,
        // the blocks this game's robot can use
        palette,
        // in the language of the screen
        locale,
        frenchMessages,
        // The button of the Gripper palette and the right-click entry of the Gripper blocks. An
        // editor that was given nobody to show that code gets neither: the entry would open nothing.
        onGripperCode: propsRef.current.onGripperCode ? (at) => propsRef.current.onGripperCode?.(at) : undefined,
      });
      workspace = ws;
      // Blockly puts its own windows - the questions of "Créer une variable", "Renommer", "Supprimer" - straight
      // into <body>, outside the screen's lang="fr": a screen reader would read their French with an English
      // voice. On a French screen each such window gets the screen's language as it appears. (An English
      // screen sets nothing: its windows are as they always were.)
      if (locale !== 'en') {
        dialogLang = new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) if (node instanceof HTMLDialogElement && node.classList.contains('blocklyDialog')) node.lang = locale;
          }
        });
        dialogLang.observe(document.body, { childList: true });
      }
      const serializer = Blockly.serialization.workspaces;

      // Development only: lets an automated browser test reach the editor (window.__sim).
      // It is never set in the published site.
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as { __sim?: unknown }).__sim = { Blockly, workspace: ws };
      }

      // ---- show the saved program (or the starting one)
      // (blocks the simulator no longer has are taken out first: Blockly would refuse the whole
      // program for one such block, and the saved work would be gone)
      const saved = loadJson(storageKey, isProgramJson);
      const kept = saved ? withoutRetiredBlocks(saved) : null;
      let savedNote = kept ? textRef.current.retiredBlocksNote(kept, 'your saved program') : null;
      const first = kept?.program ?? propsRef.current.initialProgram();
      try {
        serializer.load(first, ws, { recordUndo: false });
      } catch {
        // a damaged save must not lock the student out: start fresh
        savedNote = null;
        ws.clear();
        try {
          serializer.load(propsRef.current.initialProgram(), ws, { recordUndo: false });
        } catch {
          ws.clear();
        }
      }
      ws.clearUndo();
      showProgram(ws);

      // ---- save and report after every change
      const status = (): EditorStatus => ({
        canUndo: ws.getUndoStack().length > 0,
        canRedo: ws.getRedoStack().length > 0,
        blocks: ws.getAllBlocks(false).filter((b) => !b.isShadow()).length,
      });
      saveNow = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = null;
        saveJson(storageKey, serializer.save(ws));
      };
      ws.addChangeListener((event) => {
        // clicks, scrolling, zooming and opening the palette do not change the program
        if (event.isUiEvent) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveNow?.(), SAVE_DELAY);
        propsRef.current.onStatus?.(status());
      });

      // ---- keep Blockly's drawing area as large as its container
      observer = new ResizeObserver(() => Blockly.svgResize(ws));
      observer.observe(host);

      // ---- the handle the rest of the page uses
      let highlighted: string[] = [];
      const handle: BlocklyEditorHandle = {
        getProgram: () => serializer.save(ws) as ProgramJson,
        loadProgram: (program) => {
          const before = serializer.save(ws);
          Blockly.Events.setGroup(true);
          try {
            serializer.load(program, ws, { recordUndo: true });
          } catch {
            try {
              serializer.load(before, ws, { recordUndo: false });
            } catch {
              ws.clear();
            }
            return false;
          } finally {
            Blockly.Events.setGroup(false);
          }
          highlighted = [];
          showProgram(ws);
          return true;
        },
        undo: () => ws.undo(false),
        redo: () => ws.undo(true),
        highlight: (ids) => {
          for (const id of highlighted) if (!ids.includes(id)) ws.highlightBlock(id, false);
          for (const id of ids) if (!highlighted.includes(id)) ws.highlightBlock(id, true);
          highlighted = [...ids];
        },
        selectBlock: (id) => {
          const block = ws.getBlockById(id);
          if (!block) return false;
          ws.centerOnBlock(id);
          Blockly.common.setSelected(block);
          // Blockly's own mark for a selected block is a thin yellow line, easy to miss on a
          // yellow or orange block: let the block flash for a moment as well (see simulator.css)
          const svg = block.getSvgRoot();
          svg.classList.remove(ATTENTION_CLASS);
          // (reading a size makes the browser notice that the class was gone, so the flash restarts)
          void svg.getBoundingClientRect();
          svg.classList.add(ATTENTION_CLASS);
          if (flashTimer) clearTimeout(flashTimer);
          flashTimer = setTimeout(() => svg.classList.remove(ATTENTION_CLASS), ATTENTION_MS);
          return true;
        },
        blockCount: () => status().blocks,
        focus: () => Blockly.getFocusManager().focusTree(ws),
      };

      setPhase('ready');
      propsRef.current.onStatus?.(status());
      propsRef.current.onReady(handle);
      if (savedNote) propsRef.current.onSavedNote?.(savedNote);
    };

    setUp().catch(() => {
      if (!disposed) setPhase('failed');
    });

    const onLeave = () => saveNow?.();
    window.addEventListener('pagehide', onLeave);

    return () => {
      disposed = true;
      window.removeEventListener('pagehide', onLeave);
      if (saveTimer) saveNow?.();
      if (flashTimer) clearTimeout(flashTimer);
      observer?.disconnect();
      dialogLang?.disconnect();
      propsRef.current.onReady(null);
      // (a French editor leaves Blockly's own words English for the next page: ../blocks/register.ts disposeEditor)
      if (workspace && blockly) disposeEditor(blockly, workspace);
      workspace = null;
    };
  }, [mediaPath, palette, storageKey, locale]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="mbot2-blockly absolute inset-0" />
      {phase !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-ink-500" role="status">
          {phase === 'loading' ? text.editorLoading : text.editorFailed}
        </div>
      )}
    </div>
  );
}

export const BlocklyEditor = memo(BlocklyEditorImpl);
