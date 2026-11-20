/**
 * The dialog window (widgets.tsx, Modal) and where it stands on the screen. The four older screens
 * use 'center' (the default) and 'top'; Fire Cadet's own-map editor also uses 'full' (on a phone the
 * window fills the screen: the board needs every pixel of its width). The window is drawn to plain
 * HTML here - no browser needed - and its class lists are read.
 *
 * What these tests protect: 'center' and 'top' draw exactly the classes they drew before 'full' was
 * added (copied here from commit 0cd0ecc), and 'full' changes nothing but the two class lists.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Modal, type ModalProps } from './widgets';

/** The class lists of the frame (the dark layer over the page) and of the window, as at 0cd0ecc. */
const BEFORE = {
  center: {
    frame: 'fixed inset-0 z-50 flex justify-center bg-ink-950/55 items-center p-3',
    panel: 'flex max-h-[calc(100dvh_-_1.5rem)] w-full max-w-lg flex-col rounded-card bg-white shadow-2xl outline-none',
  },
  top: {
    frame:
      'fixed inset-0 z-50 flex justify-center bg-ink-950/55 items-start px-3 pb-3 pt-[var(--mbot2-modal-top)] [--mbot2-modal-top:0.75rem] sm:[--mbot2-modal-top:max(0.75rem,6dvh)]',
    panel: 'flex max-h-[calc(100dvh_-_var(--mbot2-modal-top)_-_0.75rem)] w-full max-w-lg flex-col rounded-card bg-white shadow-2xl outline-none',
  },
};

const draw = (align?: ModalProps['align'], widthClass?: string): string => {
  const props: ModalProps = { title: 'Examples', onClose: () => {}, children: createElement('p', null, 'Hello') };
  if (align) props.align = align;
  if (widthClass) props.widthClass = widthClass;
  return renderToStaticMarkup(createElement(Modal, props));
};

/** The class list of the frame (the outer element) and of the window (role="dialog"). */
function classesOf(html: string): { frame: string; panel: string } {
  const frame = html.match(/^<div class="([^"]*)"/)?.[1];
  const panel = html.match(/<div[^>]*role="dialog"[^>]*class="([^"]*)"/)?.[1];
  assert.ok(frame !== undefined && panel !== undefined, html);
  return { frame, panel };
}

test("Modal: 'center' (also when left out) and 'top' draw the very classes of before", () => {
  assert.deepEqual(classesOf(draw()), BEFORE.center);
  assert.deepEqual(classesOf(draw('center')), BEFORE.center);
  assert.deepEqual(classesOf(draw('top')), BEFORE.top);
  assert.equal(draw(), draw('center'));
  // the width class goes where it went
  assert.equal(classesOf(draw('top', 'max-w-3xl')).panel, BEFORE.top.panel.replace('max-w-lg', 'max-w-3xl'));
});

test("Modal: 'full' fills a phone's screen (no frame, no rounded corners) and is the 'top' window from 640 px up", () => {
  const { frame, panel } = classesOf(draw('full'));
  const frameClasses = frame.split(' ');
  const panelClasses = panel.split(' ');
  for (const c of ['items-start', 'p-0']) assert.ok(frameClasses.includes(c), `frame: ${c}`);
  for (const c of ['h-dvh', 'max-h-dvh', 'max-sm:rounded-none', 'sm:h-auto']) assert.ok(panelClasses.includes(c), `window: ${c}`);
  // from 640 px: the room around the window of 'top' (12 px, and at the top 12 px or 6 % of the height)
  for (const c of ['sm:px-3', 'sm:pb-3', 'sm:pt-[max(0.75rem,6dvh)]']) assert.ok(frameClasses.includes(c), `frame: ${c}`);
  assert.ok(panelClasses.includes('sm:max-h-[calc(100dvh_-_max(0.75rem,6dvh)_-_0.75rem)]'));
  // and nothing else of the window changes: title, close button, focus, the content
  const asTop = draw('full').replace(frame, BEFORE.top.frame).replace(panel, BEFORE.top.panel);
  assert.equal(asTop, draw('top'));
});
