/**
 * Ready-made block programs for the Robot en fête 2027 simulator: the six examples of Warehouse
 * Sort, in French.
 *
 *   fete-leave-start    starter       drive by distance: out of the start zone
 *   fete-white-line     starter       follow a WHITE line on the black mat to the T at its end
 *   fete-cube-colour    starter       drive to a cube, read its colour with the colour sensor at the claw
 *   fete-one-cube       intermediate  look at the nearest cube: blue - leave it and take the next one; put the cube in the bay of its colour
 *   fete-two-cubes      intermediate  one cube of the bottom row and one of the top row, never the blue one, each to its bay, then park
 *   fete-all-cubes      advanced      look at all four cubes, leave the blue one, sort the other three and park, on any of the 24 arrangements
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
 * THE SAME PROGRAMS AS IN WAREHOUSE SORT. Each program is made of the same builder calls with the
 * same numbers, in the same order, as its twin in ../warehouse-sort/samples.ts; only its texts
 * are French (design 6.2; the French is fr-src/3-examples.txt of the design): the notes on the
 * blocks, the texts printed on the CyberPi screen, the names of the my-blocks, of their inputs and
 * of the variables, and the two words a my-block gets as its "way" - "droite" / "gauche" (the
 * program's own words, compared with "="). So every example makes exactly the moves it makes in
 * Warehouse Sort and scores the same: ./samples.test.ts plays both on all 24 arrangements, on the
 * vector drawing of the mat and on the picture the browser reads, and checks every number, block
 * and field against the English program.
 *
 * The numbers are written out here again, with the names they have there: Warehouse Sort's
 * samples.ts may be imported by ../members/all-examples.ts alone (its own test says so), and
 * this file is no exception. ./samples.test.ts holds the two lists together, number for number.
 *
 * What stays English (design D7): the colour names the colour sensor gives - "red", "green",
 * "blue" in an "=" block and on the CyberPi screen ("Cube : red") - are the program's data, the
 * same on both pages. A sentence that names one gives its French in brackets: "red (rouge)".
 *
 * Numbers in a sentence have a decimal comma (110,5 cm); the same number in a block stays 110.5.
 * French typography: a no-break space (NB) before ":" "!" "?" and inside « »; ’ in a word.
 *
 * Two things the builder writes the English way are written again the French way (inFrench
 * below), as the French editor itself writes them: where the stacks stand - the builder places
 * them side by side by the width of their English rows; on this page the rows are French, and
 * often longer - and the default text under a reporter ("banana" under the second slot of
 * "regrouper", hidden by the colour block; "banane" in French). Neither changes what a program
 * does.
 *
 * The descriptions are for beginners of 8 to 12 and their teachers: short sentences, "tu", plain
 * words, and nothing more certain than what the simulator really knows.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import { FR_DEFAULT_TEXTS } from '../blocks/fr';
import { COLUMN_GAP, estimateStackWidth } from '../blocks/stack-size';
import type { BlockJson, ProgramJson } from '../core/types';
import {
  and,
  arm,
  call,
  changeVar,
  clawColor,
  clawColorIs,
  clawObjectDetected,
  define,
  eq,
  gripper,
  ifElse,
  ifThen,
  join,
  ledColor,
  lineStatusIs,
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
  sub,
  turn,
  v,
  waitUntil,
  whenStart,
  type BlockNode,
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

/** The no-break space of French typography: before ":" "!" "?" and inside « ». */
const NB = ' ';

// =============================================================================================
// Numbers the programs share: those of Warehouse Sort (the tests hold the two lists together)
// =============================================================================================

/** The first starter drives this far (cm). */
export const LEAVE_CM = 30;
/** From the start, this far forward (cm) puts the robot's middle on the white line at the bottom. */
export const TO_BOTTOM_LINE_CM = 4.6;
/** The line follower drives this far (cm) before it looks at the line: its sensor is then past the yellow frame of the start zone. */
export const PAST_THE_FRAME_CM = 7;
/** The line follower: speed straight on, and speed of a turn on the spot (RPM). */
export const FOLLOW_RPM = 40;
export const STEER_RPM = 20;
/** The colour starter drives at a cube at this speed (RPM) until the colour sensor at the claw sees it. */
export const TO_CUBE_RPM = 40;
/** From the long line to the cube of each warehouse (cm): W1 - W4 are the warehouses E1 - E4 of this page. */
export const PICK_CM = { W1: 35.1, W2: 35.4, W3: 36.2, W4: 35.5 } as const;
/** Where the robot's middle is at the start, and where the two white lines across the mat are: cm from the top edge of the mat. */
export const START_Y_CM = 115.1;
export const BOTTOM_LINE_Y_CM = 110.5;
export const TOP_LINE_Y_CM = 13.4;
/** From the white line at the bottom up the long line to the white line at the top (cm). */
export const UP_TO_TOP_LINE_CM = 97.1;
/** The places for cubes in a bay (cm from the top edge of the mat): the first one, and the step to the next. */
export const FIRST_PLACE_Y_CM = 68.2;
export const PLACE_STEP_CM = 6.2;
/** From the long line this far (cm) towards a bay: the cube in the claw is over the middle of the bay. */
export const INTO_BAY_CM = 1.5;
/** Parking: on the long line at this y (cm) the robot is below the green bay; this far to the left (cm) it is level with the middle of the left pad. */
export const PARK_Y_CM = 79;
export const PARK_LEFT_CM = 45.9;

const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE =
  `Ce programme fait rouler le robot sur des distances mesurées. Le robot du simulateur roule sans aucune erreur. Un vrai robot dévie un peu${NB}: sur un vrai tapis, sers-toi des lignes blanches pour corriger sa route.`;

/** On "moves forward" towards a cube with the open claw. */
const AROUND_THE_CUBE_NOTE = `La pince est ouverte${NB}: ses doigts arrivent des deux côtés du cube, sans le toucher.`;

/** On the block that asks whether the cube in the claw is blue. */
const LOOK_FIRST_NOTE = `D’abord regarder${NB}! Le capteur de couleur de la pince voit le cube entre les doigts. Un cube bleu ne doit pas bouger.`;

/** On "moves backward" away from a blue cube. */
const LEAVE_BLUE_NOTE = `Retour à la longue ligne. La pince ne s’est jamais fermée${NB}: le cube bleu reste exactement où il était.`;

/** On "arm raises" with a cube in the claw. */
const PICKED_NOTE = `Le cube est soulevé de plus de 1 cm${NB}: +5 points (un cube n’est pris qu’une fois).`;

/** On "arm lowers" around a cube, before the colour sensor reads it. */
const FINGERS_DOWN_NOTE = 'Les doigts ouverts descendent autour du cube. Maintenant, le capteur de couleur de la pince peut le voir.';

/** On the first move of the starters and the one-cube example. */
const ONTO_THE_BOTTOM_LINE_NOTE = 'Sur la ligne blanche en bas du terrain.';

/** The CyberPi screen says it, when the robot leaves a blue cube. (One row of the 18 of the screen: "Bleu : on le laisse" would be cut inside "laisse".) */
const LEAVE_IT = 'Bleu, on le laisse';

// =============================================================================================
// My-blocks shared by several programs
// =============================================================================================

/** "poser le cube": the robot faces a bay, the cube in its claw, the arm up. In, down, open, out - and the arm goes up again. */
function putTheCubeDown(): DefinitionNode {
  return note(
    define('poser le cube', [], [
      note(moveCm('forward', INTO_BAY_CM), 'Maintenant, le cube est au-dessus du milieu de la baie.'),
      note(arm('lower'), 'Le bras s’arrête quand le cube touche le tapis.'),
      gripper('open'),
      note(moveCm('backward', INTO_BAY_CM), 'On revient sur la longue ligne. Les doigts ouverts ne touchent pas le cube.'),
      note(
        arm('raise'),
        `Le bras monte avant que le robot tourne${NB}: les doigts passent au-dessus des cubes des baies. En bas, ils les cogneraient.`,
      ),
    ]),
    'Le robot est face à une baie, le cube dans sa pince. Il pose le cube dans la baie et l’y laisse.',
  );
}

/** "prendre le cube": the arm is down and the open claw is around a cube that is not blue. Grip it, lift it and remember its colour. */
function takeTheCube(): DefinitionNode {
  return note(
    define('prendre le cube', [], [
      gripper('close'),
      note(arm('raise'), PICKED_NOTE),
      note(
        setVar('couleur', clawColor()),
        `Le capteur de couleur de la pince voit le cube que le robot tient. «${NB}couleur${NB}» vaut maintenant red (rouge) ou green (vert).`,
      ),
    ]),
    `Le bras est en bas et la pince ouverte entoure un cube qui n’est pas bleu. On l’attrape, on le soulève, et on garde sa couleur dans «${NB}couleur${NB}».`,
  );
}

/** "vers sa baie": on the long line between the bays, facing up, the cube up in the claw. Red bay to the right, green bay to the left. */
function toItsBay(): DefinitionNode {
  return note(
    define('vers sa baie', [], [
      ifElse(
        eq(v('couleur'), 'red'),
        [note(turn('right', 90), `Rouge${NB}: la baie rouge est à droite de la longue ligne.`), call('poser le cube'), turn('left', 90)],
        [note(turn('left', 90), `Vert${NB}: la baie verte est à gauche de la longue ligne.`), call('poser le cube'), turn('right', 90)],
      ),
    ]),
    `Le robot est sur la longue ligne entre les baies, tourné vers le haut. «${NB}couleur${NB}» choisit la baie. Ensuite, il regarde de nouveau vers le haut.`,
  );
}

// =============================================================================================
// 1. fete-leave-start
// =============================================================================================
// As in Warehouse Sort (measured, samples.test.ts): 10 points on all 24 arrangements (5 for
// leaving the start zone, 5 for the clean run), the program ends after 1.85 s; no cube moves, the
// blue one is "left alone". From 1.4 cm on the drive earns the 5 points, with 1.3 cm it does not.

const leaveStart: SampleProgram = {
  ...exampleCard('fete-leave-start'),
  description:
    `Le robot avance de ${LEAVE_CM} cm, vers le haut, hors de la zone de départ, et s’arrête. ` +
    'Puis ses LED deviennent vertes et son écran le dit. ' +
    `Il marque 10 points quelle que soit la disposition des cubes${NB}: 5 pour la sortie de la zone de départ, et 5 pour un parcours propre (sans relance). ` +
    'Il a fini au bout de 2 secondes. ' +
    `Essaie un nombre plus petit que 30. Jusqu’où peux-tu raccourcir le trajet en gagnant toujours les 5 points${NB}?`,
  program: program([
    script(note(whenStart(), 'Un premier programme. Change les nombres, puis appuie de nouveau sur Démarrer.'), [
      print(`C’est parti${NB}!`),
      note(moveCm('forward', LEAVE_CM), `Le robot regarde vers le haut, vers le terrain. Une partie du robot hors de la zone de départ${NB}: +5 points.`),
      ledColor('all', GREEN),
      print('Sorti de la zone'),
    ]),
  ]),
};

// =============================================================================================
// 2. fete-white-line
// =============================================================================================
// As in Warehouse Sort (measured, samples.test.ts), on the vector drawing of the mat and on the
// picture the browser reads: 10 points on all 24 arrangements; the program ends at the T after
// 3.17 s (3.18 s on the picture). The claw stops short of the cube of E4: it is never touched.
// The try (turn left instead of right) follows the white line left of the start zone to its T.

const whiteLine: SampleProgram = {
  ...exampleCard('fete-white-line'),
  description:
    'Un suiveur de ligne pour ce tapis. Ici, les lignes sont BLANCHES sur un tapis noir. ' +
    'Le robot va sur la ligne blanche du bas et la suit vers la droite avec le capteur quad RGB. ' +
    `Les deux sondes du milieu (L1 et R1) voient la ligne${NB}: tout droit. Seulement L1${NB}: un peu à gauche. Seulement R1${NB}: un peu à droite. ` +
    'Au T du bout de la ligne, les quatre sondes voient du blanc, et le robot s’arrête. ' +
    'Il marque 10 points quelle que soit la disposition (sortie de la zone de départ, parcours propre), en 3 secondes. ' +
    'Il ne touche pas le cube devant lui. ' +
    `Essaie la ligne à gauche de la zone de départ${NB}: tourne à gauche au lieu de tourner à droite.`,
  program: program([
    script(note(whenStart(), `Sur ce tapis, la ligne est blanche. Le robot du simulateur le sait${NB}: «${NB}détecte la ligne${NB}» veut dire blanc ici.`), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), ONTO_THE_BOTTOM_LINE_NOTE),
      turn('right', 90),
      note(
        moveCm('forward', PAST_THE_FRAME_CM),
        `D’abord sortir de la zone de départ. Son cadre jaune est clair lui aussi${NB}: le capteur le prendrait pour un T.`,
      ),
      note(
        repeatUntil(lineStatusIs(15), [
          ifElse(
            and(probeDetects('L1', 'line'), probeDetects('R1', 'line')),
            [note(move('forward', FOLLOW_RPM), `L1 et R1 sont les deux sondes du milieu. Les deux sur la ligne${NB}: tout droit.`)],
            [
              ifElse(
                probeDetects('L1', 'line'),
                [note(move('left', STEER_RPM), `La ligne est sous la sonde de gauche${NB}: on tourne un peu à gauche.`)],
                [ifThen(probeDetects('R1', 'line'), [note(move('right', STEER_RPM), `La ligne est sous la sonde de droite${NB}: on tourne un peu à droite.`)])],
              ),
            ],
          ),
        ]),
        `Jusqu’à ce que les quatre sondes voient du blanc (état 15)${NB}: le T au bout de la ligne.`,
      ),
      stopMotors('all'),
      ledColor('all', GREEN),
      print(`T trouvé${NB}!`),
    ]),
  ]),
};

// =============================================================================================
// 3. fete-cube-colour
// =============================================================================================
// As in Warehouse Sort (measured, samples.test.ts): on all 24 arrangements the screen shows the
// colour of the cube of E3 as the sensor names it - "red", "green" or "blue" - and the LEDs light
// in that colour; 10 points; the program ends after 3.27 s. The robot stops with the tips of its
// open fingers 7.0 mm before the cube: it never touches it. The try (turn right instead of left)
// reads the cube of E4 in the same way.

const cubeColour: SampleProgram = {
  ...exampleCard('fete-cube-colour'),
  description:
    'Le robot roule jusqu’à la ligne blanche du bas et tourne à gauche, vers l’entrepôt en bas à gauche. ' +
    'Il roule doucement vers le cube qui s’y trouve, jusqu’à ce que le capteur de couleur de la pince le voie. Alors il s’arrête. ' +
    `L’écran montre la couleur du cube, avec le nom que donne le capteur${NB}: red, green ou blue. Les LED s’allument de cette couleur. ` +
    'Il montre toujours la bonne couleur, quelle que soit la disposition. Il ne touche pas le cube. ' +
    'Il marque 10 points (sortie de la zone de départ, parcours propre), en 3 secondes. ' +
    `Essaie le cube en bas à droite${NB}: tourne à droite au lieu de tourner à gauche.`,
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), ONTO_THE_BOTTOM_LINE_NOTE),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche, vers l’entrepôt en bas à gauche.'),
      note(move('forward', TO_CUBE_RPM), `Doucement${NB}: le robot doit s’arrêter avant de toucher le cube.`),
      note(
        waitUntil(clawObjectDetected()),
        'On attend que le capteur de couleur de la pince voie quelque chose. Dans ce simulateur, il voit un cube jusqu’à 3,5 cm devant le milieu de la pince.',
      ),
      stopMotors('all'),
      print(join(`Cube${NB}: `, clawColor())),
      note(
        ifElse(
          clawColorIs('red'),
          [ledColor('all', RED)],
          [ifElse(clawColorIs('green'), [ledColor('all', GREEN)], [ledColor('all', BLUE)])],
        ),
        `Un cube est rouge, vert ou bleu${NB}: ni rouge ni vert, c’est donc bleu.`,
      ),
    ]),
  ]),
};

// =============================================================================================
// 4. fete-one-cube
// =============================================================================================
// As in Warehouse Sort (measured, samples.test.ts): 30 points on all 24 arrangements, and the blue
// cube is never moved. E4 not blue (18 arrangements): it takes the cube of E4, in its bay from
// 10.35 s on, the program ends after 11.19 s. E4 blue (6 arrangements): the sensor reads "blue",
// the robot backs away and takes the cube of E3 instead, in its bay from 15.87 s on, the program
// ends after 16.71 s. The try (park on a pad at the end) scores 40 on all 24 arrangements.

const oneCube: SampleProgram = {
  ...exampleCard('fete-one-cube'),
  description:
    'Le robot roule jusqu’au cube en bas à droite, la pince ouverte autour de lui. ' +
    `D’abord il regarde${NB}: le capteur de couleur de la pince lit le cube. ` +
    `Bleu${NB}: le robot le laisse où il est et prend à la place le cube en bas à gauche. ` +
    'Il attrape le cube et le soulève. Puis il monte le long de la longue ligne blanche, entre les deux baies. ' +
    `Rouge${NB}: il tourne vers la baie rouge. Vert${NB}: il tourne vers la baie verte. Là, il pose le cube. ` +
    'Il marque 30 points quelle que soit la disposition, en 11 à 17 secondes. Il ne déplace jamais le cube bleu. ' +
    'Essaie de te garer sur une aire d’arrivée à la fin, pour 10 points de plus.',
  program: program([
    takeTheCube(),
    putTheCubeDown(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), ONTO_THE_BOTTOM_LINE_NOTE),
      note(turn('right', 90), 'Maintenant, le robot regarde à droite, vers l’entrepôt en bas à droite.'),
      note(moveCm('forward', PICK_CM.W4), AROUND_THE_CUBE_NOTE),
      note(
        ifElse(
          clawColorIs('blue'),
          [
            print(LEAVE_IT),
            note(moveCm('backward', PICK_CM.W4), LEAVE_BLUE_NOTE),
            note(turn('left', 180), `Maintenant, le robot regarde à gauche, vers l’entrepôt en bas à gauche. Son cube n’est pas bleu${NB}: un seul cube l’est.`),
            note(moveCm('forward', PICK_CM.W3), AROUND_THE_CUBE_NOTE),
            call('prendre le cube'),
            moveCm('backward', PICK_CM.W3),
            note(turn('right', 90), 'Tourné vers le haut, sur la longue ligne blanche.'),
          ],
          [call('prendre le cube'), moveCm('backward', PICK_CM.W4), note(turn('left', 90), 'Tourné vers le haut, sur la longue ligne blanche.')],
        ),
        LOOK_FIRST_NOTE,
      ),
      print(join(`Cube${NB}: `, v('couleur'))),
      note(moveCm('forward', 42.3), `Maintenant, le robot est entre les deux baies${NB}: la rouge à droite, la verte à gauche.`),
      note(ifElse(eq(v('couleur'), 'red'), [turn('right', 90)], [turn('left', 90)]), `La couleur choisit la baie${NB}: red (rouge) à droite, green (vert) à gauche.`),
      call('poser le cube'),
    ]),
  ]),
};

// =============================================================================================
// 5. fete-two-cubes
// =============================================================================================
// As in Warehouse Sort (measured, samples.test.ts): 60 points on all 24 arrangements (two cubes
// picked and in the bay of their colour, parked on the left pad, clean run), and the blue cube is
// never moved. One cube comes from the bottom row (E4, or E3 where E4 is blue), one from the top
// row (E2, or E1 where E2 is blue). The program ends after 32.43 s (blue in E1 or E3), 37.83 s
// (blue in E2) or 37.95 s (blue in E4). The try (park on the right pad) also scores 60 everywhere.

/** "prendre un cube de cette rangée": on the white line across a row, facing up. The cube on the right - or, if it is blue, the one on the left. */
function takeACubeFromThisRow(): DefinitionNode {
  return note(
    define('prendre un cube de cette rangée', ['cm à droite', 'cm à gauche'], [
      note(turn('right', 90), 'Vers l’entrepôt de droite de cette rangée.'),
      note(moveCm('forward', v('cm à droite')), AROUND_THE_CUBE_NOTE),
      note(arm('lower'), FINGERS_DOWN_NOTE),
      note(
        ifElse(
          clawColorIs('blue'),
          [
            note(moveCm('backward', v('cm à droite')), LEAVE_BLUE_NOTE),
            note(turn('left', 180), `Vers l’entrepôt de gauche de cette rangée. Son cube n’est pas bleu${NB}: un seul cube l’est.`),
            moveCm('forward', v('cm à gauche')),
            call('prendre le cube'),
            moveCm('backward', v('cm à gauche')),
            turn('right', 90),
          ],
          [call('prendre le cube'), moveCm('backward', v('cm à droite')), turn('left', 90)],
        ),
        LOOK_FIRST_NOTE,
      ),
    ]),
    'Sur la ligne blanche qui traverse une rangée, tourné vers le haut. Prendre le cube de droite - ou, s’il est bleu, le cube de gauche. Puis se tourner de nouveau vers le haut.',
  );
}

const twoCubes: SampleProgram = {
  ...exampleCard('fete-two-cubes'),
  description:
    'Deux cubes, puis le stationnement. Le robot prend un cube dans la rangée du bas et un dans la rangée du haut. ' +
    `Dans chaque rangée, il regarde d’abord le cube de droite. Bleu${NB}: il le laisse et prend le cube de gauche. ` +
    'Chaque cube va dans la baie de sa couleur. Deux cubes d’une même couleur se mettent côte à côte. ' +
    'À la fin, le robot se gare sur l’aire d’arrivée de gauche. ' +
    'Il marque 60 points quelle que soit la disposition, en 32 à 38 secondes. Il ne déplace jamais le cube bleu. ' +
    'Essaie plutôt de te garer sur l’aire de droite.',
  program: program([
    takeTheCube(),
    putTheCubeDown(),
    toItsBay(),
    takeACubeFromThisRow(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), ONTO_THE_BOTTOM_LINE_NOTE),
      note(call('prendre un cube de cette rangée', PICK_CM.W4, PICK_CM.W3), `La rangée du bas${NB}: E4 à droite, E3 à gauche.`),
      note(moveCm('forward', 42.3), 'On monte la longue ligne, jusqu’à la première place d’une baie.'),
      call('vers sa baie'),
      note(moveCm('forward', 54.8), 'On monte jusqu’à la ligne blanche du haut.'),
      note(call('prendre un cube de cette rangée', PICK_CM.W2, PICK_CM.W1), `La rangée du haut${NB}: E2 à droite, E1 à gauche.`),
      note(
        moveCm('backward', 48.6),
        `On redescend la longue ligne, jusqu’à une deuxième place${NB}: si les deux cubes ont la même couleur, ils se mettent côte à côte.`,
      ),
      call('vers sa baie'),
      note(
        moveCm('backward', Number((PARK_Y_CM - FIRST_PLACE_Y_CM + PLACE_STEP_CM).toFixed(1))),
        `On descend la longue ligne, sous les baies${NB}: les cubes de la baie verte ne gênent pas le chemin vers la gauche.`,
      ),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche.'),
      note(moveCm('forward', PARK_LEFT_CM), 'À la hauteur du milieu de l’aire de gauche.'),
      note(turn('right', 90), `La pince et l’avant du robot sont au-dessus de l’aire${NB}: +10 points à la fin.`),
    ]),
  ]),
};

// =============================================================================================
// 6. fete-all-cubes
// =============================================================================================
// How it works: as in Warehouse Sort. On the long white line the robot always faces up and knows
// where it is ("y du robot", cm from the top edge of the mat); from the white line of a row it goes
// to a cube, right or left ("sens": "droite" or "gauche"), with the claw open, and reads the
// colour before the claw closes. Blue: it backs away. Red or green: it takes the cube to the bay of
// that colour; "place rouge" and "place verte" are where the next cube goes in each bay.
// Measured (samples.test.ts): 80 points on all 24 arrangements, the blue cube never moved; the
// program ends after 53.51 to 60.84 s (58.06 s on the usual arrangement, VR-BR).

/** "rouler sur la longue ligne jusqu’à" y: forward when the place is higher up the mat, backward when it is lower. */
function driveOnTheLongLine(): DefinitionNode {
  return note(
    define('rouler sur la longue ligne jusqu’à', ['y'], [
      ifElse(
        lt(v('y'), v('y du robot')),
        [moveCm('forward', sub(v('y du robot'), v('y')))],
        [moveCm('backward', sub(v('y'), v('y du robot')))],
      ),
      setVar('y du robot', v('y')),
    ]),
    `Sur la longue ligne blanche, le robot regarde toujours vers le haut. «${NB}y du robot${NB}» dit où il est${NB}: en cm depuis le bord du haut du tapis. Pour aller à y, il avance (vers le haut) ou recule (vers le bas).`,
  );
}

/** "regarder le cube": from the long line to a warehouse, right or left, with the claw open around the cube; read its colour; take it unless it is blue; and back. */
function lookAtTheCube(): DefinitionNode {
  return note(
    define('regarder le cube', ['y de la ligne', 'sens', 'cm'], [
      call('rouler sur la longue ligne jusqu’à', v('y de la ligne')),
      ifElse(eq(v('sens'), 'droite'), [turn('right', 90)], [turn('left', 90)]),
      note(moveCm('forward', v('cm')), AROUND_THE_CUBE_NOTE),
      note(arm('lower'), FINGERS_DOWN_NOTE),
      note(setVar('couleur', clawColor()), `D’abord regarder${NB}! «${NB}couleur${NB}» vaut maintenant red, green ou blue (rouge, vert ou bleu).`),
      note(
        ifElse(eq(v('couleur'), 'blue'), [print(LEAVE_IT)], [gripper('close')]),
        `Bleu${NB}: la pince reste ouverte, le cube bleu reste où il est. Rouge ou vert${NB}: on l’attrape.`,
      ),
      note(arm('raise'), `Avec un cube rouge ou vert dans la pince${NB}: il est soulevé, +5 points. Avec un cube bleu${NB}: les doigts ouverts montent, le cube reste.`),
      moveCm('backward', v('cm')),
      note(ifElse(eq(v('sens'), 'droite'), [turn('left', 90)], [turn('right', 90)]), 'De nouveau tourné vers le haut sur la longue ligne.'),
    ]),
    `Regarder un cube${NB}: rouler sur la longue ligne jusqu’à la ligne blanche de sa rangée («${NB}y de la ligne${NB}»), tourner à droite ou à gauche («${NB}sens${NB}»), rouler de «${NB}cm${NB}» jusqu’au cube, le lire, le prendre s’il n’est pas bleu, et revenir.`,
  );
}

/** "l’amener à sa baie": to the next free place of the bay of "couleur", and put the cube there. A blue cube was not taken. */
function bringItToItsBay(): DefinitionNode {
  return note(
    define('l’amener à sa baie', [], [
      ifThen(eq(v('couleur'), 'red'), [
        call('rouler sur la longue ligne jusqu’à', v('place rouge')),
        note(turn('right', 90), 'La baie rouge est à droite de la longue ligne.'),
        call('poser le cube'),
        turn('left', 90),
        note(changeVar('place rouge', -PLACE_STEP_CM), 'Le cube rouge suivant se met 6,2 cm plus haut.'),
      ]),
      ifThen(eq(v('couleur'), 'green'), [
        call('rouler sur la longue ligne jusqu’à', v('place verte')),
        note(turn('left', 90), 'La baie verte est à gauche de la longue ligne.'),
        call('poser le cube'),
        turn('right', 90),
        note(changeVar('place verte', -PLACE_STEP_CM), 'Le cube vert suivant se met 6,2 cm plus haut.'),
      ]),
    ]),
    `La couleur lue par le capteur choisit la baie. Dans chaque baie, les cubes se mettent côte à côte. Le bleu ne va dans aucune baie${NB}: le robot ne l’a pas pris.`,
  );
}

/** The four "regarder le cube" + "l’amener à sa baie" of the start script, in the order bottom right, top right, top left, bottom left. */
function visitEveryWarehouse(): BlockNode[] {
  return [
    note(call('regarder le cube', BOTTOM_LINE_Y_CM, 'droite', PICK_CM.W4), 'En bas à droite (E4). La ligne blanche du bas est à 110,5 cm.'),
    call('l’amener à sa baie'),
    note(call('regarder le cube', TOP_LINE_Y_CM, 'droite', PICK_CM.W2), 'En haut à droite (E2). La ligne blanche du haut est à 13,4 cm.'),
    call('l’amener à sa baie'),
    note(call('regarder le cube', TOP_LINE_Y_CM, 'gauche', PICK_CM.W1), 'En haut à gauche (E1).'),
    call('l’amener à sa baie'),
    note(call('regarder le cube', BOTTOM_LINE_Y_CM, 'gauche', PICK_CM.W3), 'En bas à gauche (E3).'),
    call('l’amener à sa baie'),
  ];
}

const allCubes: SampleProgram = {
  ...exampleCard('fete-all-cubes'),
  description:
    `Toute la mission, pour chaque disposition. Le robot va aux quatre entrepôts l’un après l’autre${NB}: en bas à droite, en haut à droite, en haut à gauche, en bas à gauche. ` +
    'À chacun, il met sa pince ouverte autour du cube et lit la couleur. ' +
    `Bleu${NB}: il laisse le cube où il est. Rouge ou vert${NB}: il amène le cube à la baie de cette couleur. ` +
    'Il ne devine jamais une couleur. ' +
    `«${NB}place rouge${NB}» et «${NB}place verte${NB}» disent où va le cube suivant dans chaque baie. À la fin, il se gare sur l’aire de gauche. ` +
    'Il marque 80 points sur chacune des 24 dispositions, en 53 à 61 secondes sur 90. Il ne déplace jamais le cube bleu. ' +
    `Essaie un autre ordre des quatre entrepôts. Quel ordre est le plus rapide${NB}?`,
  program: program([
    driveOnTheLongLine(),
    lookAtTheCube(),
    putTheCubeDown(),
    bringItToItsBay(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(setVar('y du robot', START_Y_CM), `Au départ, le robot est ici sur la longue ligne${NB}: à 115,1 cm du bord du haut.`),
      note(setVar('place rouge', FIRST_PLACE_Y_CM), 'La première place de chaque baie est à 68,2 cm.'),
      setVar('place verte', FIRST_PLACE_Y_CM),
      ...visitEveryWarehouse(),
      note(call('rouler sur la longue ligne jusqu’à', PARK_Y_CM), `Sous les baies${NB}: les cubes de la baie verte ne gênent pas le chemin vers la gauche.`),
      note(turn('left', 90), 'Maintenant, le robot regarde à gauche.'),
      note(moveCm('forward', PARK_LEFT_CM), 'À la hauteur du milieu de l’aire de gauche.'),
      note(turn('right', 90), `La pince et l’avant du robot sont au-dessus de l’aire${NB}: +10 points à la fin.`),
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
 * The program of an example as the French editor would write it:
 *
 *   - its stacks placed again, side by side in the order the builder gave them (the scripts
 *     first, then the my-block definitions) and with its gap, by the width of their French rows
 *     (../blocks/stack-size.ts with the locale 'fr'): a French row is often longer than its
 *     English one, and a stack must not lie on another in the French editor. Only x changes;
 *   - a default text of Blockly's under a reporter ("banana", hidden by the block in its slot)
 *     in French (../blocks/fr.ts FR_DEFAULT_TEXTS: "banane"), as the French palette gives it: a
 *     student who takes the reporter out sees a French word.
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

/** Every example of Robot en fête 2027, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [leaveStart, whiteLine, cubeColour, oneCube, twoCubes, allCubes].map(inFrench);

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
