/**
 * Ready-made block programs for the Logistique intelligente simulator (Robot en fête 2027: the
 * regular mission of MakeX Inspire 2024, "Smart Logistics"), in French.
 *
 *   logi-ligne-croix     starter       up the white line from the start area; stop when the ultrasonic sensor sees the first stack
 *   logi-cube-dessus     starter       arm up: the claw takes the top cube of the nearest stack alone; the colour sensor reads it
 *   logi-un-cube-e8      starter       that top cube carried to the warehouse E8 and put down: 50 points
 *   logi-pile-e7         intermediate  arm down: the claw takes the bottom cube and the top cube comes with it; the pair into E7: 100 points
 *   logi-empiler-e6      intermediate  two top cubes, one after the other, the second put on the first in E6: 100 points
 *   logi-toute-mission   advanced      the five stacks, each taken by its bottom cube, into five warehouses: 500 points
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of every other game: a visitor's browser gets a program and
 *  the text that explains it only from the server, which decides for every request what that
 *  visitor may have. So nothing that runs in the browser (src/simulator/ui, anything with
 *  'use client', a page of the website) may import this file - nor ./sample-catalog.ts, the list
 *  of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  blocks are here. The server hands them out from ../members/all-examples.ts, the only file
 *  that imports this one.
 * =====================================================================================
 *
 * WHERE THINGS ARE (./field.ts, ./robot.ts; mm, from the top-left corner of the arena, y down).
 * The robot starts at (600, 1123.5), facing up, the arm down and the claw open. Its claw's middle
 * is 142 mm ahead of the middle of its axle, its finger tips 167 mm ahead. The five stacks of the
 * cross stand on the squares « haut » (600, 552), « gauche » (550, 602), « centre » (600, 602),
 * « droite » (650, 602) and « bas » (600, 652); bottom cubes 1 - 5, top cubes 6 - 10 (cube n + 5
 * on cube n). The warehouses the examples use: E3 (813.41, 51.1), E5 (220.5, 391), E6 (979.5,
 * 391), E7 (57.5, 985.25), E8 (1142.5, 985.25).
 *
 * HOW THE CLAW TAKES A CUBE. The claw closes where it is, its middle about 5 mm short of the
 * middle of the cube (4.5 mm where a program drives a round 32.5 cm to the stack of the bottom
 * square): the cube then rides that much further ahead of the axle than the claw's middle (142
 * mm), turns with the robot, and lands on the middle of a warehouse when the axle stops 146.5 -
 * 147.5 mm short of it. Arm up (100 %: the claw's underside 75 mm above the mat) it takes the top
 * cube of a stack alone; arm down (0 %: 5 mm) it takes the bottom cube, and the top cube resting on
 * it comes with it (./game.ts: the cubes keep their riders). The limit is 63,57 % / 63,58 %. The
 * open fingers are 7 mm wider than a cube on each side; their tips must stay behind the stacks
 * beside the one taken: "5 mm short" leaves them 5 mm.
 *
 * Every program drives by measured distances ("avancer de ... cm", 50 RPM) and turns by quarter or
 * half turns ("tourner à droite de 90°", 50 RPM); the first one follows the white line with the
 * quad RGB sensor and stops with the ultrasonic sensor. The robot of the simulator is perfect; a
 * real one drifts, which the first note of each program that drives by distance says. Each one is
 * played on the vector drawing of the mat and on the picture the browser reads, and from starts
 * moved and turned inside the start area (./samples.test.ts holds the numbers; the examples count
 * on the default start pose, ./robot.ts).
 *
 * French: « tu »; « dessous / dessus » for the two layers of a stack, never « en haut / en bas »;
 * « le carré du haut / de gauche / du centre / de droite / du bas » for the squares of the cross;
 * the colour the sensor gives stays as the program holds it ("yellow"), written « yellow
 * (jaune) » in a sentence (design D7). Numbers in a sentence have a decimal comma (32,5 cm); the
 * same number in a block stays 32.5. Typography: a no-break space (NB) before ":" "!" "?" "%" and
 * inside « »; ’ in a word.
 *
 * Two things the builder writes the English way are written again the French way (inFrench
 * below, as in ../robot-en-fete/samples.ts): where the stacks stand (by the width of their French
 * rows) and the default text under a reporter ("banane").
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import { FR_DEFAULT_TEXTS } from '../blocks/fr';
import { COLUMN_GAP, estimateStackWidth } from '../blocks/stack-size';
import type { BlockJson, ProgramJson } from '../core/types';
import {
  and,
  arm,
  armHeight,
  call,
  changeVar,
  clawColor,
  define,
  gripper,
  ifElse,
    join,
  ledColor,
  lt,
  move,
  moveCm,
  note,
  print,
  probeDetects,
  program,
  repeatUntil,
  script,
  setVar,
  stopMotors,
  turn,
  ultrasonic,
  v,
  whenStart,
  type DefinitionNode,
} from '../vm/builder';
import { exampleCard, type ExampleLevel } from './sample-catalog';

export type SampleLevel = ExampleLevel;

export interface SampleProgram {
  /** stable name, used in links and tests */
  id: string;
  title: string;
  level: SampleLevel;
  /** what the program does, what it scores and what to try next, in a few short sentences */
  description: string;
  program: ProgramJson;
}

/** The no-break space of French typography: before ":" "!" "?" "%" and inside « ». */
const NB = '\u00a0';

// =============================================================================================
// Numbers the programs share (cm, RPM, %)
// =============================================================================================

/** The line follower: first this far (cm), to put the line sensor on the white line that runs out of the start area. */
export const ONTO_THE_LINE_CM = 5;
/** The line follower stops when the ultrasonic sensor sees something closer than this (cm). */
export const STOP_AT_CM = 10;
/** The line follower: speed straight on, and speed of a turn on the spot (RPM). */
export const FOLLOW_RPM = 40;
export const STEER_RPM = 20;
/** Arm up (the claw takes the top cube of a stack alone) and arm down (it takes the bottom cube, and the top one comes with it), in %. */
export const ARM_UP = 100;
export const ARM_DOWN = 0;
/** From the start, this far up (cm): the claw's middle 4.5 mm short of the middle of the stack of the bottom square. */
export const TO_THE_BOTTOM_STACK_CM = 32.5;
/** Back from that stack to the height of E7 and E8 (cm). */
export const BACK_TO_E7_E8_CM = 18.7;
/** Then, turned towards E7 or E8, this far (cm): the cube in the claw is over the middle of the warehouse. */
export const TO_E7_E8_CM = 39.6;
/** Back from a cube the claw has let go (cm): the open fingers leave it. */
export const AWAY_CM = 10;

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE = `Ce programme fait rouler le robot sur des distances mesurées. Le robot du simulateur roule sans aucune erreur. Un vrai robot dévie un peu${NB}: sur un vrai tapis, sers-toi des lignes blanches pour corriger sa route.`;

/** On "arm to 100 %". */
const ARM_UP_NOTE = `Bras en haut${NB}: le dessous de la pince est à 7,5 cm du tapis. Elle prendra le cube du dessus d’une pile, tout seul.`;

/** On "arm to 0 %". */
const ARM_DOWN_NOTE = `Bras en bas${NB}: la pince prendra le cube du dessous d’une pile. Le cube posé dessus viendra avec lui.`;

/** On "moves forward" towards a stack with the open claw. */
const AROUND_THE_STACK_NOTE = `La pince est ouverte${NB}: ses doigts arrivent des deux côtés de la pile, sans la toucher.`;

/** On "arm lowers" with a cube in the claw. */
const DOWN_TO_THE_MAT_NOTE = 'Le bras s’arrête quand le cube touche le tapis.';

/** On "moves backward" after the claw has let go. */
const AWAY_NOTE = 'Les doigts ouverts laissent le cube où il est. Un cube qui touche le robot à la fin ne compte pas.';

// =============================================================================================
// 1. logi-ligne-croix
// =============================================================================================
// MEASURED (samples.test.ts), on the drawing and on the picture of the mat: 0 points, nothing
// touched; the robot stops at y 878.31 (its finger tips 34.3 mm before the cube 5) and the program
// ends after 1.85 s. It finds the line and stops before the stack from anywhere in the start area
// up to 45.5 mm to the side, and turned up to 5 degrees. The try (5 cm instead of 10): it stops at
// y 828.71, the open fingers 15.3 mm along the cube 5 on both sides, and touches nothing.

const lineToTheCross: SampleProgram = {
  ...exampleCard('logi-ligne-croix'),
  description:
    `Le robot avance de ${ONTO_THE_LINE_CM} cm${NB}: son capteur quad RGB arrive sur la ligne blanche qui sort de la zone de départ. ` +
    'Il suit cette ligne vers le haut. ' +
    `Les deux sondes du milieu (L1 et R1) voient la ligne${NB}: tout droit. Seulement L1${NB}: un peu à gauche. Seulement R1${NB}: un peu à droite. Aucune des deux${NB}: tout droit. ` +
    `Le capteur à ultrasons regarde devant. Quand il voit la première pile de cubes à moins de ${STOP_AT_CM} cm, le robot s’arrête et l’écran affiche «${NB}Arrivé${NB}!${NB}». ` +
    'Il ne touche aucun cube et ne marque pas de points. Il a fini au bout de 2 secondes. ' +
    `Essaie 5 cm au lieu de 10${NB}: les doigts ouverts arrivent des deux côtés du cube du dessous, sans le toucher.`,
  program: program([
    script(note(whenStart(), `Sur ce tapis, la ligne est blanche. Le robot du simulateur le sait${NB}: «${NB}détecte la ligne${NB}» veut dire blanc ici.`), [
      note(moveCm('forward', ONTO_THE_LINE_CM), 'Le capteur quad RGB est maintenant sur la ligne blanche qui monte vers la croix.'),
      note(
        repeatUntil(lt(ultrasonic(), STOP_AT_CM), [
          ifElse(
            and(probeDetects('L1', 'line'), probeDetects('R1', 'line')),
            [note(move('forward', FOLLOW_RPM), `L1 et R1 sont les deux sondes du milieu. Les deux sur la ligne${NB}: tout droit.`)],
            [
              ifElse(
                probeDetects('L1', 'line'),
                [note(move('left', STEER_RPM), `La ligne est sous la sonde de gauche${NB}: on tourne un peu à gauche.`)],
                [
                  ifElse(
                    probeDetects('R1', 'line'),
                    [note(move('right', STEER_RPM), `La ligne est sous la sonde de droite${NB}: on tourne un peu à droite.`)],
                    [note(move('forward', FOLLOW_RPM), `Aucune des deux ne voit la ligne${NB}: tout droit, vers la croix.`)],
                  ),
                ],
              ),
            ],
          ),
        ]),
        `Jusqu’à ce que le capteur à ultrasons voie la pile à moins de 10 cm. La ligne blanche du bas, en travers, ne gêne pas${NB}: L1 et R1 la voient, tout droit.`,
      ),
      stopMotors('all'),
      ledColor('all', '#00ff00'),
      print(`Arrivé${NB}!`),
    ]),
  ]),
};

// =============================================================================================
// 2. logi-cube-dessus
// =============================================================================================
// MEASURED (samples.test.ts): 0 points (the cube 10 is in the claw, from 2.60 s on); only the
// cube 10 moves; the screen shows "Cube : yellow"; the program ends after 3.27 s. The try (the arm
// at 50 %): the claw takes the cube 5, and the cube 10 comes with it; 63,57 % takes the pair too,
// 63,58 % the cube 10 alone.

/** "prendre le cube 10": from the start, arm up, the top cube of the stack of the bottom square. Shared by the second and the third example. */
function takeCubeTen(): DefinitionNode {
  return note(
    define('prendre le cube 10', [], [
      note(armHeight(ARM_UP), ARM_UP_NOTE),
      note(moveCm('forward', TO_THE_BOTTOM_STACK_CM), `Jusqu’à la pile du carré du bas, la plus proche. ${AROUND_THE_STACK_NOTE}`),
      note(gripper('close'), `La pince se ferme sur le cube du dessus, le cube 10. Le cube 5, dessous, ne bouge pas.`),
    ]),
    `Depuis la zone de départ${NB}: bras en haut, jusqu’à la pile la plus proche, et la pince se ferme sur le cube du dessus.`,
  );
}

const topCube: SampleProgram = {
  ...exampleCard('logi-cube-dessus'),
  description:
    `Le robot lève le bras tout en haut (${ARM_UP}${NB}%) et avance de 32,5 cm, jusqu’à la pile du carré du bas, la plus proche. ` +
    'Sa pince ouverte arrive des deux côtés du cube du dessus, le cube 10. Elle se ferme sur lui. ' +
    `Le robot recule de 10 cm${NB}: le cube 5, dessous, ne bouge pas. ` +
    'Le capteur de couleur de la pince regarde le cube 10. ' +
    `L’écran affiche sa couleur, avec le nom que donne le capteur${NB}: yellow (jaune). ` +
    `Le cube est dans la pince, pas dans un entrepôt${NB}: pas encore de points. Il a fini au bout de 3 secondes. ` +
    `Essaie le bras à 50${NB}%${NB}: la pince prend alors le cube du dessous, et le cube 10 vient avec lui.`,
  program: program([
    takeCubeTen(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      call('prendre le cube 10'),
      note(moveCm('backward', AWAY_CM), 'Le cube 10 est dans la pince. Le cube 5 reste sur son carré.'),
      note(print(join(`Cube${NB}: `, clawColor())), `Le capteur de couleur de la pince voit le cube qu’elle tient${NB}: yellow (jaune).`),
      ledColor('all', '#ffff00'),
    ]),
  ]),
};

// =============================================================================================
// 3. logi-un-cube-e8
// =============================================================================================
// MEASURED (samples.test.ts): 50 points - the cube 10 covers E8, 0.25 mm off its middle; the claw
// lets it go at 7.14 s and the program ends after 7.91 s. The try (turn left): 50 points in E7.

const oneCubeE8: SampleProgram = {
  ...exampleCard('logi-un-cube-e8'),
  description:
    'Le robot prend le cube 10 comme dans l’exemple d’avant. ' +
    'Puis il recule jusqu’à la hauteur de l’entrepôt E8, tourne à droite et avance. Le cube est alors au-dessus de l’entrepôt. ' +
    'Le bras descend et s’arrête quand le cube touche le tapis. La pince s’ouvre et le robot recule. ' +
    `Le cube couvre tout l’entrepôt E8 et ne touche pas le robot${NB}: 50 points, en 8 secondes. ` +
    `Essaie l’entrepôt E7, à gauche${NB}: tourne à gauche au lieu de tourner à droite.`,
  program: program([
    takeCubeTen(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      call('prendre le cube 10'),
      note(moveCm('backward', BACK_TO_E7_E8_CM), 'Le robot est maintenant à la hauteur des entrepôts E7 et E8.'),
      note(turn('right', 90), 'Maintenant, le robot regarde à droite, vers l’entrepôt E8.'),
      note(moveCm('forward', TO_E7_E8_CM), 'Le cube est au-dessus du milieu de l’entrepôt E8.'),
      note(arm('lower'), DOWN_TO_THE_MAT_NOTE),
      gripper('open'),
      note(moveCm('backward', AWAY_CM), AWAY_NOTE),
    ]),
  ]),
};

// =============================================================================================
// 4. logi-pile-e7
// =============================================================================================
// MEASURED (samples.test.ts): 100 points - the cube 5 covers E7, 0.25 mm off its middle, and the
// cube 10 rests on it; only these two cubes move; the claw takes the cube 5 at 2.10 s and lets it
// go at 6.28 s, the program ends after 7.05 s. The try (turn right): 100 points in E8.

const stackE7: SampleProgram = {
  ...exampleCard('logi-pile-e7'),
  description:
    'Bras en bas, le robot avance jusqu’à la pile du carré du bas. ' +
    `La pince se ferme sur le cube 5, le cube du dessous. Le cube 10 est posé dessus${NB}: il vient avec lui. ` +
    'Le robot recule, tourne à gauche et porte la pile jusqu’à l’entrepôt E7. La pince s’ouvre et le robot recule. ' +
    `Le cube 5 couvre tout l’entrepôt E7 et le cube 10 ne touche que lui${NB}: 100 points, en 7 secondes. ` +
    `Essaie l’entrepôt E8${NB}: tourne à droite au lieu de tourner à gauche.`,
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(armHeight(ARM_DOWN), ARM_DOWN_NOTE),
      note(moveCm('forward', TO_THE_BOTTOM_STACK_CM), `Jusqu’à la pile du carré du bas. ${AROUND_THE_STACK_NOTE}`),
      note(gripper('close'), 'La pince se ferme sur le cube 5. Le cube 10 est posé dessus.'),
      note(moveCm('backward', BACK_TO_E7_E8_CM), `Le cube 10 vient avec le cube 5${NB}: la pince porte toute la pile.`),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche, vers l’entrepôt E7.'),
      note(moveCm('forward', TO_E7_E8_CM), 'La pile est au-dessus du milieu de l’entrepôt E7.'),
      gripper('open'),
      note(moveCm('backward', AWAY_CM), AWAY_NOTE),
    ]),
  ]),
};

// =============================================================================================
// 5. logi-empiler-e6
// =============================================================================================
// MEASURED (samples.test.ts): 100 points - the cube 9 covers E6, on its middle, and the cube 6
// rests on it, 0 mm off; only these two cubes move; the claw takes the cube 9 at 8.05 s and the
// cube 6 at 19.34 s, lets the cube 6 go at 21.52 s; the program ends after 22.29 s. The try (a
// smaller number than 23,25 cm at the end): with 20,75 cm the cube 6 is 25 mm off the middle of
// the cube 9 and still on it (100 points); with 20,65 cm it comes down on the mat beside it and
// pushes the cube 9 off the middle of E6 (0 points). (A bigger number: from 25,05 cm on, the
// chassis bumps the cube 9.)

const stackUpE6: SampleProgram = {
  ...exampleCard('logi-empiler-e6'),
  description:
    'Deux cubes, l’un après l’autre, bras en haut. Le robot passe à droite de la zone de stockage. ' +
    'Il prend le cube 9, le cube du dessus du carré de droite, et le pose dans l’entrepôt E6. ' +
    'Puis il prend le cube 6, le cube du dessus du carré du haut, et le pose sur le cube 9. ' +
    'Le bras descend et s’arrête quand le cube touche le cube du dessous. ' +
    `Le cube 9 couvre tout l’entrepôt E6 et le cube 6 ne touche que lui${NB}: 100 points, en 22 secondes. ` +
    `Essaie un nombre plus petit que 23,25 cm à la fin${NB}: jusqu’où le cube 6 peut-il dépasser du cube 9 et compter encore${NB}?`,
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(armHeight(ARM_UP), ARM_UP_NOTE),
      note(moveCm('forward', 25), `Les doigts levés s’arrêtent à 3 cm de la pile du carré du bas${NB}: le robot peut tourner sans la toucher.`),
      turn('right', 90),
      note(moveCm('forward', 29.7), 'À droite de la zone de stockage.'),
      turn('left', 90),
      note(moveCm('forward', 27.15), 'À la hauteur du carré de droite.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche, vers la pile du carré de droite.'),
      note(moveCm('forward', AWAY_CM), AROUND_THE_STACK_NOTE),
      note(gripper('close'), 'La pince se ferme sur le cube 9, tout seul. Le cube 4, dessous, ne bouge pas.'),
      note(moveCm('backward', 18.25), 'Le robot recule jusque sous l’entrepôt E6.'),
      note(turn('right', 90), 'Maintenant, le robot regarde vers le haut, vers l’entrepôt E6.'),
      note(moveCm('forward', 6.4), 'Le cube 9 est au-dessus du milieu de l’entrepôt E6.'),
      note(arm('lower'), DOWN_TO_THE_MAT_NOTE),
      gripper('open'),
      note(moveCm('backward', AWAY_CM), AWAY_NOTE),
      note(armHeight(ARM_UP), `Le bras remonte${NB}: maintenant, le cube 6, sur le carré du haut.`),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche.'),
      note(moveCm('forward', 15.95), 'Les doigts levés passent au-dessus du cube 4, resté seul sur son carré.'),
      turn('right', 90),
      note(moveCm('forward', 33.3), 'Plus haut que la zone de stockage.'),
      turn('left', 90),
      note(moveCm('forward', 22), 'En face du carré du haut, plus haut que lui.'),
      note(turn('left', 90), 'Maintenant, le robot regarde vers le bas, vers la pile du carré du haut.'),
      note(moveCm('forward', AWAY_CM), AROUND_THE_STACK_NOTE),
      note(gripper('close'), 'La pince se ferme sur le cube 6, tout seul. Le cube 1, dessous, ne bouge pas.'),
      note(moveCm('backward', 1.4), 'À la hauteur de l’entrepôt E6.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à droite, vers l’entrepôt E6.'),
      note(moveCm('forward', 23.25), 'Le cube 6 est au-dessus du cube 9.'),
      note(arm('lower'), 'Le bras s’arrête quand le cube 6 touche le cube 9.'),
      gripper('open'),
      note(moveCm('backward', AWAY_CM), AWAY_NOTE),
    ]),
  ]),
};

// =============================================================================================
// 6. logi-toute-mission
// =============================================================================================
// The design's probe a1 (5 stacks into 5 warehouses, 60.65 s) as a block program: every stack is
// taken by its bottom cube with the claw's middle 5 mm short of it, 10 cm after the robot has
// turned towards it ("prendre la pile"), and the pair stops 147 mm ahead of the axle over the
// middle of its warehouse. Quarter turns and half turns only; straight moves at 50 RPM.
// MEASURED (samples.test.ts): 500 points, complete; each lower cube within 0.05 mm of the middle of
// its warehouse, each upper cube 0 mm off the lower one; nothing bumped; the program ends after
// 56.64 s. No example covers E1 or E4 (a cube turned 45 degrees): the note on the last turn says how.

/** "prendre la pile": the open claw is around the bottom cube of a stack, the arm down. */
function takeTheStack(): DefinitionNode {
  return note(
    define('prendre la pile', [], [
      note(moveCm('forward', AWAY_CM), AROUND_THE_STACK_NOTE),
      note(gripper('close'), 'La pince se ferme sur le cube du dessous. Le cube du dessus vient avec lui.'),
    ]),
    `Le robot est à 10 cm d’une pile, tourné vers elle, le bras en bas. Il avance, et la pince se ferme sur le cube du dessous${NB}: toute la pile vient.`,
  );
}

/** "poser la pile": the pair is over the middle of a warehouse. */
function putTheStackDown(): DefinitionNode {
  return note(
    define('poser la pile', [], [
      gripper('open'),
      note(moveCm('backward', AWAY_CM), AWAY_NOTE),
      changeVar('piles posées', 1),
      print(join(`Piles posées${NB}: `, v('piles posées'))),
    ]),
    'La pile est au-dessus du milieu d’un entrepôt. La pince s’ouvre, le robot recule et compte les piles posées.',
  );
}

const wholeMission: SampleProgram = {
  ...exampleCard('logi-toute-mission'),
  description:
    'Les dix cubes dans cinq entrepôts. Bras en bas, le robot prend chaque pile par son cube du dessous, et le cube du dessus vient avec lui. ' +
    'Il porte la pile du carré du bas dans E7, celle de droite dans E8, celle de gauche dans E5, celle du haut dans E6 et celle du centre dans E3. ' +
    'Il roule sur des distances mesurées et tourne d’un quart de tour ou d’un demi-tour. ' +
    `Chaque cube du dessous couvre tout son entrepôt, chaque cube du dessus ne touche que lui${NB}: 500 points, en 57 secondes sur 150. ` +
    `Essaie un autre ordre des piles, ou d’autres entrepôts${NB}: quel trajet est le plus rapide${NB}?`,
  program: program([
    takeTheStack(),
    putTheStackDown(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(setVar('piles posées', 0), 'Le robot compte les piles posées. Le CyberPi l’affiche.'),
      note(armHeight(ARM_DOWN), ARM_DOWN_NOTE),
      // 1. the stack of the bottom square (cubes 5 and 10) into E7
      note(moveCm('forward', 22.45), `Première pile${NB}: celle du carré du bas (cubes 5 et 10). Le robot s’arrête à 10 cm d’elle.`),
      call('prendre la pile'),
      note(moveCm('backward', 18.63), 'À la hauteur de l’entrepôt E7.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche, vers l’entrepôt E7.'),
      note(moveCm('forward', 39.55), 'La pile est au-dessus du milieu de l’entrepôt E7.'),
      call('poser la pile'),
      // 2. the stack of the right square (cubes 4 and 9) into E8
      note(turn('right', 180), `Deuxième pile${NB}: celle du carré de droite (cubes 4 et 9). Le robot passe sous la zone de stockage.`),
      moveCm('forward', 59.25),
      turn('left', 90),
      note(moveCm('forward', 38.33), 'À la hauteur du carré du centre, à droite de la zone de stockage.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche, vers la pile du carré de droite.'),
      call('prendre la pile'),
      moveCm('backward', AWAY_CM),
      turn('left', 90),
      note(moveCm('forward', 38.33), 'À la hauteur de l’entrepôt E8.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à droite, vers l’entrepôt E8.'),
      note(moveCm('forward', 9.85), 'La pile est au-dessus du milieu de l’entrepôt E8.'),
      call('poser la pile'),
      // 3. the stack of the left square (cubes 2 and 7) into E5
      note(turn('left', 180), `Troisième pile${NB}: celle du carré de gauche (cubes 2 et 7).`),
      moveCm('forward', 59.25),
      turn('right', 90),
      note(moveCm('forward', 38.33), 'À la hauteur du carré du centre, à gauche de la zone de stockage.'),
      note(turn('right', 90), 'Maintenant, le robot regarde à droite, vers la pile du carré de gauche.'),
      call('prendre la pile'),
      note(moveCm('backward', 18.25), 'Le robot recule jusque sous l’entrepôt E5.'),
      note(turn('left', 90), 'Maintenant, le robot regarde vers le haut, vers l’entrepôt E5.'),
      note(moveCm('forward', 6.4), 'La pile est au-dessus du milieu de l’entrepôt E5.'),
      call('poser la pile'),
      // 4. the stack of the top square (cubes 1 and 6) into E6
      note(turn('right', 90), `Quatrième pile${NB}: celle du carré du haut (cubes 1 et 6). Le robot passe entre E5 et la zone de stockage.`),
      moveCm('forward', 16),
      turn('left', 90),
      note(moveCm('forward', 33.3), 'Plus haut que la zone de stockage.'),
      turn('right', 90),
      note(moveCm('forward', 21.95), 'En face du carré du haut, plus haut que lui.'),
      note(turn('right', 90), 'Maintenant, le robot regarde vers le bas, vers la pile du carré du haut.'),
      call('prendre la pile'),
      note(moveCm('backward', 1.4), 'À la hauteur de l’entrepôt E6.'),
      note(turn('left', 90), 'Maintenant, le robot regarde à droite, vers l’entrepôt E6. La pile tourne avec lui, sans toucher la pile du centre.'),
      note(moveCm('forward', 23.25), 'La pile est au-dessus du milieu de l’entrepôt E6.'),
      call('poser la pile'),
      // 5. the stack of the centre square (cubes 3 and 8) into E3
      note(turn('right', 90), `Cinquième pile${NB}: celle du carré du centre (cubes 3 et 8). Le robot passe à droite de la zone de stockage.`),
      moveCm('forward', 45.8),
      turn('right', 90),
      note(moveCm('forward', 13.25), 'Sous la zone de stockage, au milieu.'),
      note(turn('right', 90), 'Maintenant, le robot regarde vers le haut, vers la pile du carré du centre.'),
      call('prendre la pile'),
      note(moveCm('forward', 44.4), 'La pile passe sur le carré du haut, vide maintenant.'),
      turn('right', 90),
      note(moveCm('forward', 21.34), 'Sous l’entrepôt E3.'),
      note(
        turn('left', 90),
        `Maintenant, le robot regarde vers le haut, vers l’entrepôt E3. Pour E1 ou E4, les losanges, il faudrait y arriver tourné de 45°${NB}: la pile tourne avec le robot.`,
      ),
      note(moveCm('forward', 10.69), 'La pile est au-dessus du milieu de l’entrepôt E3.'),
      call('poser la pile'),
      ledColor('all', '#00ff00'),
    ]),
  ]),
};

// =============================================================================================
// Written the French way: where the stacks stand, and the default texts under a reporter
// =============================================================================================

/** Every block of a program, the shadows (the bubbles) and the blocks inside the others included. */
function everyBlock(blocks: readonly BlockJson[]): BlockJson[] {
  const out: BlockJson[] = [];
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    out.push(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      visit(slot.shadow);
      visit(slot.block);
    }
    visit(block.next?.block);
  };
  blocks.forEach(visit);
  return out;
}

/**
 * The program of an example as the French editor would write it (as ../robot-en-fete/samples.ts
 * does): its stacks placed again side by side, in the order the builder gave them, by the width
 * of their French rows (../blocks/stack-size.ts with the locale 'fr'), and a default text of
 * Blockly's under a reporter in French (../blocks/fr.ts FR_DEFAULT_TEXTS: "banane").
 */
function inFrench(sample: SampleProgram): SampleProgram {
  const tops = sample.program.blocks?.blocks ?? [];
  const variables = sample.program.variables ?? [];
  let x = Math.min(...tops.map((top) => top.x ?? 0));
  for (const top of [...tops].sort((a, b) => (a.x ?? 0) - (b.x ?? 0))) {
    top.x = x;
    x += Math.ceil(estimateStackWidth(top, variables, 'fr')) + COLUMN_GAP;
  }
  for (const block of everyBlock(tops)) {
    for (const slot of Object.values(block.inputs ?? {})) {
      const text = slot.shadow?.type === 'text' && slot.block ? slot.shadow.fields?.TEXT : undefined;
      if (typeof text === 'string' && Object.prototype.hasOwnProperty.call(FR_DEFAULT_TEXTS, text)) slot.shadow!.fields!.TEXT = FR_DEFAULT_TEXTS[text];
    }
  }
  return sample;
}

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Logistique intelligente, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [lineToTheCross, topCube, oneCubeE8, stackE7, stackUpE6, wholeMission].map(inFrench);

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
