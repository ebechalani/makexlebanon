/**
 * The mBlock-style block language of the simulator.
 *
 *   catalog.ts   every block as plain data (no Blockly, no DOM)
 *   palettes.ts  which categories each game shows (plain data)
 *   toolbox.ts   the palette on the left (plain JSON)
 *   theme.ts     Scratch / mBlock look (plain JSON)
 *   register.ts  registerBlocks(Blockly) + the Scratch-like Variables palette (needs the Blockly module)
 *   gripper-original.ts  what the Gripper blocks stand for in real mBlock: My Blocks made of the
 *                        servo block and a wait (plain data, no Blockly)
 *   mblock-wording.ts    the block texts that still have to be checked against mBlock 5
 *
 * Typical use in a client component:
 *
 *   import * as Blockly from 'blockly';
 *   import { createEditor } from '@/simulator/blocks';
 *
 *   const workspace = createEditor(Blockly, div);                       // blocks + toolbox + look
 *   const workspace = createEditor(Blockly, div, { palette: game.id }); // ... with the palette of a game
 *   const program = Blockly.serialization.workspaces.save(workspace);   // -> createVM(program, io)
 *   Blockly.serialization.workspaces.load(program, workspace);          // show a saved program
 */
export * from './catalog';
export * from './mblock-wording';
export * from './palettes';
export * from './toolbox';
export * from './theme';
export * from './register';
export * from './gripper-original';
