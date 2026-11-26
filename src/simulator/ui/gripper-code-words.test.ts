/**
 * What the window "Inside the Gripper blocks" says (./gripper-code-words.ts): the sentences at
 * its top and the answers of its two buttons - in English, and in French (./text/gripper.tsx,
 * the page of Robot en fête 2027).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addGripperMyBlocks, convertGripperBlocks } from '../blocks/gripper-original';
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { ProgramJson } from '../core/types';
import { addedMessage, convertedMessage, GRIPPER_CODE_WORDS, gripperCodeIntro } from './gripper-code-words';
import { blankProgram } from './program-file';
import { EN_GRIPPER_TEXT, FR_GRIPPER_TEXT } from './text/gripper';

/** The blank program with some Gripper blocks under the yellow block. */
function withGripperBlocks(actions: Array<'open' | 'close'>): ProgramJson {
  const program = blankProgram();
  let above = program.blocks!.blocks![0];
  actions.forEach((action, i) => {
    const block = { type: 'gripper_claw', id: `claw-${i}`, fields: { ACTION: action } };
    above.next = { block };
    above = block;
  });
  return program;
}

describe('the words of the window "Inside the Gripper blocks"', () => {
  test('the sentences at the top say what the Gripper blocks are, and name the servos of the robot', () => {
    const intro = gripperCodeIntro(DEFAULT_ROBOT_CONFIG);
    assert.equal(intro.length, 3, 'three sentences, no more');
    assert.match(intro[0], /mBlock has no Gripper category/);
    assert.match(intro[1], /My Blocks/);
    assert.equal(intro[2], 'On this robot servo S1 moves the arm and servo S2 moves the claw.');
    const other = { ...DEFAULT_ROBOT_CONFIG, gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, liftServo: 'S3' as const, clawServo: 'S4' as const } };
    assert.equal(gripperCodeIntro(other)[2], 'On this robot servo S3 moves the arm and servo S4 moves the claw.');
    for (const sentence of intro) assert.ok(sentence.length < 130, 'short sentences');
    assert.equal(GRIPPER_CODE_WORDS.title, 'Inside the Gripper blocks');
    assert.equal(GRIPPER_CODE_WORDS.addButton, 'Add these My Blocks to my program');
    assert.equal(GRIPPER_CODE_WORDS.convertButton, 'Show my program the mBlock way');
  });

  test('"Add these My Blocks": how many were added, and that a second press adds nothing', () => {
    const first = addGripperMyBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG);
    assert.match(addedMessage(first), /^5 My Blocks were added to your program\./);
    assert.match(addedMessage(first), /Undo takes them out again\.$/);
    const second = addGripperMyBlocks(first.program, DEFAULT_ROBOT_CONFIG);
    assert.equal(addedMessage(second), 'Nothing was added: all 5 My Blocks are already in your program. Look under My Blocks.');

    // some were there already (the program was shown the mBlock way before)
    const some = addGripperMyBlocks(convertGripperBlocks(withGripperBlocks(['close', 'open']), DEFAULT_ROBOT_CONFIG).program, DEFAULT_ROBOT_CONFIG);
    assert.match(addedMessage(some), /^3 My Blocks were added to your program: arm raises, arm lowers and arm moves to height\. The other 2 were already there\./);
    assert.match(addedMessage({ added: ['arm lowers'], myBlocks: first.myBlocks }), /^1 My Block was added to your program: arm lowers\. The other 4 were already there\./);
    assert.match(addedMessage({ added: first.added.slice(0, 4), myBlocks: first.myBlocks }), /The other one was already there\./);
  });

  test('"Show my program the mBlock way": how many blocks were replaced, or that there are none', () => {
    assert.equal(convertedMessage(convertGripperBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG)), 'Your program has no Gripper blocks, so there is nothing to change.');
    assert.match(convertedMessage(convertGripperBlocks(withGripperBlocks(['close']), DEFAULT_ROBOT_CONFIG)), /^1 Gripper block was replaced by its My Block\./);
    const three = convertedMessage(convertGripperBlocks(withGripperBlocks(['close', 'open', 'close']), DEFAULT_ROBOT_CONFIG));
    assert.match(three, /^3 Gripper blocks were replaced by their My Blocks\./);
    assert.match(three, /Undo brings the Gripper blocks back\.$/);
  });
});

describe('the window in the word table of the screen (./text/gripper.tsx): English is these words, French their twin', () => {
  const NB = ' ';

  test('English: the strings and the three functions of this file, and the two picture descriptions as the window wrote them', () => {
    for (const [key, value] of Object.entries(GRIPPER_CODE_WORDS)) assert.equal(EN_GRIPPER_TEXT[key as keyof typeof GRIPPER_CODE_WORDS], value, key);
    assert.equal(EN_GRIPPER_TEXT.intro, gripperCodeIntro);
    assert.equal(EN_GRIPPER_TEXT.addedMessage, addedMessage);
    assert.equal(EN_GRIPPER_TEXT.convertedMessage, convertedMessage);
    assert.equal(EN_GRIPPER_TEXT.blockPicture('gripper opens until done'), 'Gripper block: gripper opens until done');
    assert.equal(EN_GRIPPER_TEXT.codePicture(['define gripper opens', 'wait 0.4 seconds']), 'My Block: define gripper opens, wait 0.4 seconds');
    // the same keys in both languages
    assert.deepEqual(Object.keys(FR_GRIPPER_TEXT).sort(), Object.keys(EN_GRIPPER_TEXT).sort());
  });

  test('French: the title, the sentences at the top (with the servos of the robot), the buttons', () => {
    assert.equal(FR_GRIPPER_TEXT.title, 'À l’intérieur des blocs de la pince');
    assert.equal(FR_GRIPPER_TEXT.addButton, 'Ajouter ces blocs à mon programme');
    assert.equal(FR_GRIPPER_TEXT.convertButton, 'Montrer mon programme à la manière de mBlock');
    assert.equal(FR_GRIPPER_TEXT.codeHeading, `La même chose dans mBlock${NB}: un bloc de «${NB}Mes blocs${NB}» que tu fais toi-même`);
    const intro = FR_GRIPPER_TEXT.intro(DEFAULT_ROBOT_CONFIG);
    assert.equal(intro.length, 3);
    assert.equal(intro[0], `mBlock n’a pas de catégorie Pince${NB}: les blocs de la pince sont des raccourcis que seul ce simulateur a.`);
    assert.equal(intro[2], 'Sur ce robot, le servo S1 bouge le bras et le servo S2 bouge la pince.');
    assert.equal(FR_GRIPPER_TEXT.blockPicture('la pince s’ouvre jusqu’à la fin'), `Bloc de la pince${NB}: la pince s’ouvre jusqu’à la fin`);
    assert.equal(FR_GRIPPER_TEXT.codePicture(['définir la pince s’ouvre', 'attendre 0,4 secondes']), `Mon bloc${NB}: définir la pince s’ouvre, attendre 0,4 secondes`);
    for (const text of [...Object.values(FR_GRIPPER_TEXT).filter((v): v is string => typeof v === 'string'), ...intro]) {
      assert.ok(!/ [:;!?»]|« |'|\.\.\./.test(text), text);
      assert.ok(!/\b(vous|votre|vos)\b/i.test(text), text);
    }
  });

  test('French: what the two buttons say, with the French My Blocks (one form for 0 and 1, the other from 2 on)', () => {
    const first = addGripperMyBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG, 'fr');
    const undo = `Ferme cette fenêtre pour les voir${NB}; tu les trouves aussi dans «${NB}Mes blocs${NB}». Annuler les enlève de nouveau.`;
    assert.equal(FR_GRIPPER_TEXT.addedMessage(first), `5 blocs ont été ajoutés à ton programme. ${undo}`);
    assert.equal(
      FR_GRIPPER_TEXT.addedMessage(addGripperMyBlocks(first.program, DEFAULT_ROBOT_CONFIG, 'fr')),
      `Rien n’a été ajouté${NB}: les 5 blocs sont déjà dans ton programme. Regarde dans «${NB}Mes blocs${NB}».`,
    );
    const some = addGripperMyBlocks(convertGripperBlocks(withGripperBlocks(['close', 'open']), DEFAULT_ROBOT_CONFIG, 'fr').program, DEFAULT_ROBOT_CONFIG, 'fr');
    assert.equal(
      FR_GRIPPER_TEXT.addedMessage(some),
      `3 blocs ont été ajoutés à ton programme${NB}: le bras monte, le bras descend et le bras va à la hauteur. Les 2 autres étaient déjà là. ${undo}`,
    );
    assert.equal(FR_GRIPPER_TEXT.addedMessage({ added: ['le bras descend'], myBlocks: first.myBlocks }), `1 bloc a été ajouté à ton programme${NB}: le bras descend. Les 4 autres étaient déjà là. ${undo}`);
    assert.match(FR_GRIPPER_TEXT.addedMessage({ added: first.added.slice(0, 4), myBlocks: first.myBlocks }), /^4 blocs ont été ajoutés .* L’autre était déjà là\. /);

    assert.equal(FR_GRIPPER_TEXT.convertedMessage(convertGripperBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG, 'fr')), `Ton programme n’a pas de blocs de la pince${NB}: il n’y a rien à changer.`);
    assert.equal(
      FR_GRIPPER_TEXT.convertedMessage(convertGripperBlocks(withGripperBlocks(['close']), DEFAULT_ROBOT_CONFIG, 'fr')),
      `1 bloc de la pince a été remplacé par son bloc de «${NB}Mes blocs${NB}». Ferme cette fenêtre pour voir ton programme. Annuler fait revenir les blocs de la pince.`,
    );
    assert.match(FR_GRIPPER_TEXT.convertedMessage(convertGripperBlocks(withGripperBlocks(['close', 'open', 'close']), DEFAULT_ROBOT_CONFIG, 'fr')), /^3 blocs de la pince ont été remplacés par leurs blocs de « Mes blocs »\. /);
  });
});
