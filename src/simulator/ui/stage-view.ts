/**
 * The small decisions of the stage that are plain logic: what the Escape key does while the
 * ruler is on or the stage is enlarged, what the Enlarge / Shrink button says about that key,
 * where the Tab key goes inside the enlarged stage, and what the hint line says before a match.
 *
 * No DOM and no React, so it can be tested under Node. The screen that uses it is
 * SimulatorApp.tsx.
 */

/** What one press of the Escape key does on the stage. */
export type EscapeAction = 'remove-point' | 'shrink' | 'ruler-off';

/**
 * Escape always undoes the smallest thing first:
 *   1. a ruler that has points loses its last point (also while the stage is enlarged - the
 *      student is in the middle of measuring, and one key press must not throw that away);
 *   2. otherwise an enlarged stage goes back to its normal size (the ruler stays on);
 *   3. otherwise a ruler without points is switched off.
 * Null when there is nothing to undo.
 */
export function escapeAction(state: { rulerOn: boolean; rulerPoints: number; enlarged: boolean }): EscapeAction | null {
  if (state.rulerOn && state.rulerPoints > 0) return 'remove-point';
  if (state.enlarged) return 'shrink';
  if (state.rulerOn) return 'ruler-off';
  return null;
}

/**
 * What the button that enlarges or shrinks the stage says when the pointer rests on it. It names
 * the Escape key only while Escape really does the same as the button: a ruler that has points
 * gets the key first (see escapeAction), and the hint must not promise something else.
 */
export function sizeButtonHint(state: { rulerOn: boolean; rulerPoints: number; enlarged: boolean }): string {
  if (!state.enlarged) return 'Show the stage as large as the window allows';
  return escapeAction(state) === 'shrink'
    ? 'Back to the normal size (the Esc key does the same)'
    : 'Back to the normal size (the Esc key first removes the last point of the ruler)';
}

/**
 * The enlarged stage covers the page, so the Tab key must stay inside it: from its last control
 * Tab goes to the first, and Shift+Tab from the first to the last.
 *
 * `count` is the number of controls in the enlarged stage, `active` the position of the one
 * that has the focus (-1 when the focus is somewhere else, for example on the frame of the
 * enlarged stage itself). Returns the position of the control to focus, or null when the
 * browser's own Tab does the right thing.
 */
export function tabStop(count: number, active: number, backwards: boolean): number | null {
  if (count <= 0) return null;
  if (backwards) return active <= 0 ? count - 1 : null;
  return active < 0 || active >= count - 1 ? 0 : null;
}

/**
 * The hint line of the stage before a match: how to place the robot - or, while the ruler is
 * on, that a click now sets a point of the ruler and does not drag the robot.
 *
 * In the enlarged stage the buttons that turn the robot stand below the mat on a tall window
 * and beside it on a wide one: "next to" is right for both.
 */
export function readyHint(startZoneName: string, rulerOn: boolean, enlarged: boolean): string {
  if (rulerOn) return 'Ready. The ruler is on: click the mat to set points. To drag the robot, switch the ruler off.';
  return `Ready. Drag the robot inside the ${startZoneName}; turn it with the buttons ${enlarged ? 'next to' : 'below'} the mat.`;
}
