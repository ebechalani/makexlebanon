/**
 * Robot en fête 2027 - « Logistique intelligente »: what the « Règles » button shows. Two parts,
 * kept clearly apart:
 *
 *   1. LOGISTIQUE_RULES - the regular mission of MakeX Inspire 2024 ("Smart Logistics") in short,
 *      plain words: only what the rules say (the design's 7.4, from the rules digest, section 10).
 *   2. LOGISTIQUE_ASSUMPTIONS - « Ce que ce simulateur suppose »: where the rules are silent,
 *      contradict themselves or differ from the printed mat, and what the simulator chose (the
 *      design's questions Q1 - Q18, listed with their constants at the top of
 *      ../../logistique-intelligente/game.ts). Never mixed into part 1.
 *
 * Children read this, and their teachers: « tu », short sentences, nothing more certain than the
 * rules or the simulator. Every number is written from the constant that holds it - the game's,
 * or, for what only the rules say, a constant of this file with its page - with a decimal comma
 * (23,7 cm), and ./rules.test.ts checks every number of every sentence against its constant.
 * The layers of a stack are « dessous / dessus », never « en haut / en bas ».
 *
 * Typography: a no-break space (U+00A0) before : ; ! ? % and the closing guillemet, after the
 * opening one; × for "times"; "-20" with a hyphen-minus, as Tri d'entrepôt writes a deduction.
 *
 * (The referee itself, and its French sentences, are in ../../logistique-intelligente/game.ts;
 * this is only what students read.)
 */
import {
  ARENA_SIZE,
  CUBE_SIZE,
  FRAME_HEIGHT,
  GREY_BAND,
  START_AREA,
  STORAGE_SQUARE_IDS,
  STORAGE_SQUARE_SIZE,
  WAREHOUSE_IDS,
  WAREHOUSE_SIZE,
  WAREHOUSES,
  YELLOW_LINE_PATCHES,
} from '../../logistique-intelligente/field';
import { CUBE_COUNT, MATCH_DURATION, MAX_PER_WAREHOUSE, MAX_SCORE, POINTS_PER_CUBE, TOUCH_MM, VIOLATION_POINTS } from '../../logistique-intelligente/game';
import { LOGISTIQUE_ROBOT } from '../../logistique-intelligente/robot';
import { NB } from '../../logistique-intelligente/scenario';
import { robotReach } from '../../warehouse-sort/robot';
import type { RulesPart, RulesSection } from '../SimulatorApp';
import { frSensorValue } from '../text/fr-common';
import { inLetters, LOGISTIQUE_START_ZONE, WAREHOUSE_COUNT } from './words';

// =============================================================================================
// What only the rules say (MakeX Inspire, Rules Guide V2.0, 2024.01, "Smart Logistics";
// "p. 16/12" = PDF page 16, printed page 12)
// =============================================================================================

/** The season and the version of the rules guide. */
export const RULES_SEASON = 2024;
export const RULES_VERSION = 'V2.0';
/** p. 11/7: "The arena has one starting area with a size of 250mm*250mm." */
export const RULES_START_AREA_MM = 250;
/** p. 11/7: "The warehouse area is 50mm*50mm square" (its figure, Fig 4.2-4, and the mat: 40 mm - the design's Q1). */
export const RULES_WAREHOUSE_MM = 50;
/** p. 12/8: the transport cube, "Square with length of 50mm (±2mm)". */
export const RULES_CUBE_TOLERANCE_MM = 2;
/** p. 16/12, T02: "length of 250mm, width of 200mm, and height of 200mm", at "the maximum extension state". */
export const RULES_ROBOT_MAX_MM = { length: 250, width: 200, height: 200 } as const;
/** p. 16/12, T02: "The diameter of the wheel (including the rubber tires) shall not exceed 70mm." */
export const RULES_WHEEL_MAX_MM = 70;
/** p. 17/13, T03: "robot weight should not exceed 2kg, including weight of battery." */
export const RULES_ROBOT_MAX_KG = 2;
/** p. 15/11: "The competition begins after the referee’s five-second counting down." */
export const RULES_COUNTDOWN_S = 5;

// =============================================================================================
// What follows from the game's constants
// =============================================================================================

const G = LOGISTIQUE_ROBOT.gripper;
const REACH = robotReach(LOGISTIQUE_ROBOT);

/** The robot as the window gives its size (mm): with the claw open, from the finger tips to the back of the chassis ... */
export const ROBOT_LENGTH = REACH.front + REACH.rear;
/** ... across ... */
export const ROBOT_WIDTH = 2 * REACH.halfWidth;
/** ... and its highest part, the finger tops with the arm up (the chassis is lower). */
export const ROBOT_HEIGHT = Math.max(LOGISTIQUE_ROBOT.chassisHeight, G.liftUpHeight + G.fingerHeight);

/** The layers of the start: ten cubes on the five squares of the cross, two layers. */
export const LAYERS = CUBE_COUNT / STORAGE_SQUARE_IDS.length;

/**
 * How many warehouses need a stack of two for the highest score: with one cube in every
 * warehouse, CUBE_COUNT - WAREHOUSE_COUNT cubes are left, and a warehouse takes at most
 * MAX_PER_WAREHOUSE - 1 more (10 cubes, 8 warehouses: 2).
 */
export const STACKS_NEEDED = Math.max(0, Math.ceil((CUBE_COUNT - WAREHOUSE_COUNT) / (MAX_PER_WAREHOUSE - 1)));

/** A cube centred on a warehouse covers it with this much to spare on each side (mm): 5. */
export const COVER_MARGIN_MM = (CUBE_SIZE - WAREHOUSE_SIZE) / 2;

/**
 * How far a centred cube may be turned against a warehouse and still cover all of it (degrees),
 * to a tenth, ROUNDED DOWN (the window never promises more than the referee gives): the corners of
 * the square reach (W/2)(cos a + sin a) along the cube's sides, which must stay within C/2, so
 * a = asin(C / (W √2)) - 45° = 17.11° for a 50 mm cube on a 40 mm square.
 */
export const COVER_TURN_DEG = Math.floor((((Math.asin(CUBE_SIZE / (WAREHOUSE_SIZE * Math.SQRT2)) * 180) / Math.PI - 45) * 10) + 1e-9) / 10;

/** The warehouses printed as diamonds (turned 45°): E1 and E4. */
export const DIAMONDS = WAREHOUSE_IDS.filter((w) => WAREHOUSES[w].turnedDeg !== 0);

/**
 * The fingers pass over a cube when their underside is at most this far (mm) below the cube's
 * top (the engine's Z_EPS, core/engine.ts, which the engine does not export): a claw whose
 * underside is at 49.5 mm or more does not reach the bottom cube of a stack (0 - 50 mm).
 */
const PASS_OVER_MM = 0.5;

/** The block « le bras va à la hauteur (p) % » puts the claw's underside at 5 + 0.7 p mm: the p at which it is h. */
const armPercentFor = (h: number): number => ((h - G.liftDownHeight) / (G.liftUpHeight - G.liftDownHeight)) * 100;

/** The arm height (%) where the claw stops reaching the bottom cube: (50 - 0.5 - 5) / 0.7 = 63.5714... */
export const ARM_LIMIT_PERCENT = armPercentFor(CUBE_SIZE - PASS_OVER_MM);
/** At this height (%, two decimals, rounded up) and above, the claw takes the top cube of a stack alone: 63.58. */
export const ARM_TOP_CUBE_PERCENT = Math.ceil(ARM_LIMIT_PERCENT * 100 - 1e-9) / 100;
/** At this height (%, two decimals, rounded down) and below, the claw takes the bottom cube, and the top cube comes with it: 63.57. */
export const ARM_PAIR_PERCENT = Math.floor(ARM_LIMIT_PERCENT * 100 + 1e-9) / 100;

// =============================================================================================
// How the sentences write things
// =============================================================================================

/** A number with a decimal comma: 0.5 -> "0,5". */
const num = (value: number): string => String(value).replace('.', ',');
/** mm in cm: 1200 -> "120", 248 -> "24,8". */
const cm = (mm: number): string => num(Math.round(mm) / 10);
/** « … » with its no-break spaces. */
const quote = (text: string): string => `«${NB}${text}${NB}»`;

const FIRST = WAREHOUSE_IDS[0];
const LAST = WAREHOUSE_IDS[WAREHOUSE_IDS.length - 1];
const HALF = CUBE_COUNT / LAYERS;

// =============================================================================================
// The window
// =============================================================================================

/** The sentence under the heading of the rules window. */
export const LOGISTIQUE_RULES_NOTE = `La mission normale du thème ${quote('Smart Logistics')} de MakeX Inspire ${RULES_SEASON} (guide des règles ${RULES_VERSION}), résumée en français.`;

export const LOGISTIQUE_RULES: RulesSection[] = [
  {
    title: 'La mission',
    items: [
      `Au centre du terrain, ${inLetters(CUBE_COUNT)} cubes jaunes attendent dans la zone de stockage.`,
      `Ton robot doit les transporter dans les entrepôts${NB}: les ${inLetters(WAREHOUSE_COUNT)} petits carrés orange du tapis.`,
      `Chaque cube valide à la fin du match rapporte ${POINTS_PER_CUBE} points.`,
      `Tu choisis comment faire${NB}: le robot peut pousser les cubes, les prendre ou les porter.`,
      'Après le départ, le robot roule tout seul, avec ton programme. Personne ne le touche.',
    ],
  },
  {
    title: 'Le terrain',
    items: [
      `Le terrain est un carré de ${cm(ARENA_SIZE)} cm sur ${cm(ARENA_SIZE)} cm, entouré d’un cadre. Le tapis est noir, avec des lignes blanches.`,
      `La ${LOGISTIQUE_START_ZONE} est au milieu du bord du bas. Elle mesure ${cm(RULES_START_AREA_MM)} cm sur ${cm(RULES_START_AREA_MM)} cm${NB}: une moitié bleue, une moitié rouge.`,
      `La zone de stockage est au centre${NB}: une croix de ${inLetters(STORAGE_SQUARE_IDS.length)} carrés de ${cm(STORAGE_SQUARE_SIZE)} cm.`,
      `Il y a ${inLetters(WAREHOUSE_COUNT)} entrepôts sur le tapis. Les ${inLetters(DIAMONDS.length)} entrepôts des coins du haut sont tournés comme des losanges.`,
      'Le robot peut rouler partout dans le cadre. Les lignes blanches peuvent l’aider à se repérer.',
    ],
  },
  {
    title: 'Au départ',
    items: [
      `Un cube mesure ${cm(CUBE_SIZE)} cm de chaque côté. Il est jaune, en mousse EVA.`,
      `Les ${inLetters(CUBE_COUNT)} cubes sont dans la zone de stockage, en ${inLetters(LAYERS)} étages de ${inLetters(HALF)} cubes. Chaque étage forme une croix.`,
      `Sur chaque carré de la croix, il y a donc une pile de ${inLetters(LAYERS)} cubes${NB}: un dessous, un dessus.`,
      `Le robot est allumé et posé tout entier dans la ${LOGISTIQUE_START_ZONE}. Il ne tient aucun cube.`,
    ],
  },
  {
    title: 'Le robot',
    items: [
      `Même avec sa pince ou ses bras ouverts au maximum, le robot ne dépasse pas ${cm(RULES_ROBOT_MAX_MM.length)} cm de long, ${cm(RULES_ROBOT_MAX_MM.width)} cm de large et ${cm(RULES_ROBOT_MAX_MM.height)} cm de haut.`,
      `Ses roues, pneus compris, mesurent au plus ${cm(RULES_WHEEL_MAX_MM)} cm de diamètre.`,
      `Il pèse au plus ${num(RULES_ROBOT_MAX_KG)} kg, batterie comprise.`,
    ],
  },
  {
    title: 'Le match',
    items: [
      `Un match dure ${MATCH_DURATION} secondes, c’est-à-dire ${Math.floor(MATCH_DURATION / 60)} minutes et ${MATCH_DURATION % 60} secondes.`,
      `L’arbitre compte ${inLetters(RULES_COUNTDOWN_S)} secondes à rebours, puis le match commence.`,
      'Pendant le match, personne ne peut relancer le robot ni le modifier.',
      `Le match finit quand les ${MATCH_DURATION} secondes sont passées, ou plus tôt si l’équipe demande à l’arbitre d’arrêter. L’arbitre arrête alors le chrono.`,
      'Ensuite, l’arbitre regarde où sont les cubes et compte les points.',
    ],
  },
  {
    title: `Les points (${MAX_SCORE} au plus)`,
    items: [
      `+${POINTS_PER_CUBE} pour chaque cube valide à la fin du match.`,
      'Un cube posé sur le tapis est valide s’il couvre tout l’entrepôt et s’il ne touche pas le robot.',
      'Un cube posé sur un autre cube est valide aussi s’il ne touche que ce cube-là, si ce cube couvre tout l’entrepôt, et s’il ne touche pas le robot.',
      `Un entrepôt compte au plus ${inLetters(MAX_PER_WAREHOUSE)} cubes valides.`,
      `Deux cubes ne peuvent pas couvrir le même entrepôt côte à côte${NB}: le deuxième cube doit être posé sur le premier.`,
      'Un cube qui couvre seulement une partie de l’entrepôt ne rapporte rien.',
      `En tout${NB}: ${CUBE_COUNT} × ${POINTS_PER_CUBE} = ${MAX_SCORE} points au plus.`,
      `Il y a ${inLetters(CUBE_COUNT)} cubes et ${inLetters(WAREHOUSE_COUNT)} entrepôts${NB}: pour faire ${MAX_SCORE} points, il faut au moins ${inLetters(STACKS_NEEDED)} piles de ${inLetters(MAX_PER_WAREHOUSE)} cubes.`,
    ],
  },
  {
    title: 'Les cubes enlevés',
    items: [
      'Vu de dessus, un cube ne doit jamais sortir du terrain. Sinon, l’arbitre l’enlève et il ne rapporte plus rien.',
      'Un cube touché par une personne pendant le match est enlevé aussi.',
    ],
  },
  {
    title: `Les fautes (-${VIOLATION_POINTS} points chacune)`,
    items: [
      `Le robot sort du terrain${NB}: vu de dessus, une partie du robot passe au-dessus du cadre ou plus loin.`,
      'Le robot part avant le signal de l’arbitre.',
      'Une personne touche le robot ou un cube pendant le match.',
      'Une personne appuie sur le terrain pour gagner des points, ou une personne ou le robot abîme le terrain exprès.',
      'Les points gagnés grâce à une faute ne comptent pas.',
      'Pendant une faute, le chrono continue.',
    ],
  },
  {
    title: 'Le classement',
    items: [
      'Pour chaque équipe, on garde son meilleur score.',
      'À points égaux, l’équipe qui a fini son match le plus vite passe devant.',
      'Si c’est encore égal, ces équipes jouent un match de plus.',
    ],
  },
];

/** The second part of the window: what the simulator had to choose because the rules do not say it, or say two things. */
export const LOGISTIQUE_ASSUMPTIONS: RulesPart = {
  title: 'Ce que ce simulateur suppose',
  note: `Ce ne sont pas des règles. Les règles ne disent pas ces choses, ou disent deux choses différentes${NB}: alors le simulateur a dû choisir.`,
  sections: [
    {
      title: 'Le tapis et le cadre',
      items: [
        `Les règles disent qu’un entrepôt mesure ${cm(RULES_WAREHOUSE_MM)} cm. Leur dessin et le tapis disent ${cm(WAREHOUSE_SIZE)} cm. Le simulateur utilise ${cm(WAREHOUSE_SIZE)} cm.`,
        `Les règles ne donnent pas de nom aux entrepôts. Ici, ils s’appellent ${FIRST} à ${LAST}, de gauche à droite et de haut en bas.`,
        `Sur le tapis, la ${LOGISTIQUE_START_ZONE} mesure ${cm(START_AREA.w)} cm de large (${cm(RULES_START_AREA_MM)} cm dans les règles). Le simulateur utilise le tapis, jusqu’au cadre.`,
        `Le cadre est posé au milieu du tapis imprimé${NB}: à l’intérieur, on voit une bande grise de ${num(GREY_BAND)} mm tout autour. Elle fait partie du terrain.`,
        'Ici, le terrain s’arrête au bord intérieur du cadre.',
        `Les règles ne donnent pas la hauteur du cadre. Ici, il mesure ${cm(FRAME_HEIGHT)} cm. Le robot et les cubes posés sur le tapis ne passent pas à travers.`,
        `Bras levé, la pince passe au-dessus du cadre${NB}: le robot sort alors du terrain, et c’est une faute.`,
        `Un cube qui passe au-dessus du cadre, même tenu par la pince, sort du terrain${NB}: l’arbitre l’enlève.`,
        `Les règles appellent cela une ${quote('violation')}, mais ne donnent pas de pénalité. Ici, le cube est seulement enlevé${NB}: 0 point, pas de -${VIOLATION_POINTS}.`,
      ],
    },
    {
      title: 'Les cubes',
      items: [
        `Un cube mesure exactement ${cm(CUBE_SIZE)} cm. Les règles permettent ${num(RULES_CUBE_TOLERANCE_MM)} mm de plus ou de moins.`,
        `Ici, les cubes portent un numéro, de 1 à ${CUBE_COUNT}, pour que tu les reconnaisses${NB}: dessous les cubes 1 à ${HALF}, dessus les cubes ${HALF + 1} à ${CUBE_COUNT} (le cube ${HALF + 1} est sur le cube 1, et ainsi de suite). Les vrais cubes n’ont pas de numéro.`,
        `${quote('Couvrir tout l’entrepôt')} veut dire${NB}: vu de dessus, le cube cache tout le carré, bord jaune compris.`,
        `Un cube bien centré a ${num(COVER_MARGIN_MM)} mm de marge de chaque côté. Il peut aussi être tourné, jusqu’à ${num(COVER_TURN_DEG)} degrés.`,
        `${DIAMONDS.join(' et ')} sont des losanges, plus larges qu’un cube droit. Pour les couvrir, le robot doit poser le cube tourné comme le losange, à ${num(WAREHOUSES[DIAMONDS[0]].turnedDeg)} degrés. Aucun exemple ne le fait${NB}: à toi d’essayer.`,
        `${quote('Toucher')} veut dire${NB}: à moins de ${num(TOUCH_MM)} mm, vu de dessus comme de côté. Une pince levée bien au-dessus d’un cube ne le touche pas.`,
        'Un cube du dessus qui repose aussi en partie sur un cube voisin touche ce cube-là. Deux cubes qui se rencontrent seulement par une arête ne se touchent pas.',
        'Un cube posé sur un autre cube compte seulement si le cube du dessous compte.',
        'Le cube du dessus peut dépasser un peu. Il tombe sur le tapis si son milieu n’est plus au-dessus du cube du dessous. La console le dit.',
        `Les cubes restent toujours à plat${NB}: ils ne roulent pas et ne basculent pas. Un cube tombé reste en jeu.`,
        `On peut poser une pile de deux cubes sur un troisième cube. Mais un entrepôt compte au plus ${inLetters(MAX_PER_WAREHOUSE)} cubes valides${NB}: le troisième ne rapporte rien.`,
      ],
    },
    {
      title: 'La pince',
      items: [
        `Bras à ${num(ARM_TOP_CUBE_PERCENT)}${NB}% ou plus${NB}: la pince prend le cube du dessus d’une pile, tout seul.`,
        `Bras à ${num(ARM_PAIR_PERCENT)}${NB}% ou moins${NB}: la pince prend le cube du dessous, et le cube posé dessus vient avec lui. Les règles laissent choisir la méthode.`,
      ],
    },
    {
      title: 'Le match',
      items: [
        `Il n’y a pas de compte à rebours${NB}: le chrono part quand le programme démarre.`,
        `Le bouton ${quote('Terminé')}, c’est l’équipe qui demande d’arrêter. Le match finit aussi quand le programme est fini et que le robot ne bouge plus.`,
        `Le temps de fin, c’est ce moment-là. Si le temps est écoulé, c’est ${MATCH_DURATION} secondes.`,
        'Ensuite, le terrain est jugé tel qu’il est.',
        `Le simulateur ne compte qu’une faute${NB}: le robot qui sort du terrain. Les autres ne peuvent pas arriver ici.`,
        `Chaque sortie du robot coûte ${VIOLATION_POINTS} points tout de suite, sans avertissement avant. S’il sort, revient, puis ressort, cela fait deux fautes.`,
        'Le total n’est jamais en dessous de 0.',
        `Il n’y a pas de relance. Pour recommencer, appuie sur Démarrer${NB}: le terrain est remis en place.`,
        'Pendant un match, personne ne peut déplacer le robot ou un cube à la main.',
        `Les boutons du CyberPi marchent pendant un match. En compétition, toucher le robot après le départ est une faute${NB}: le simulateur ne la compte pas.`,
      ],
    },
    {
      title: 'Le robot',
      items: [
        `C’est le mBot2 de Tri d’entrepôt, avec la pince à l’avant${NB}: ${cm(ROBOT_LENGTH)} cm de long, ${cm(ROBOT_WIDTH)} cm de large, des roues de ${cm(LOGISTIQUE_ROBOT.wheelDiameter)} cm, ${cm(ROBOT_HEIGHT)} cm de haut bras levé. Il respecte les tailles des règles.`,
        `Le servo ${G.liftServo} lève le bras, le servo ${G.clawServo} ouvre et ferme la pince.`,
        `Le capteur quad RGB voit les lignes blanches. Il prend aussi pour une ligne le jaune clair${NB}: les ${inLetters(Object.keys(YELLOW_LINE_PATCHES).length)} bandes jaunes de la ligne du haut, le carré du centre de la croix et le bord fin des entrepôts.`,
        // (worded so that it shares no run of six words or more with a sentence of an example's description: the
        // client guard looks for those in every file a browser gets - members/client-guard.test.ts)
        `Le capteur à ultrasons voit les cubes et le cadre. Quand la pince tient un cube, son capteur de couleur voit ${frSensorValue('yellow')}.`,
        `Au départ, il regarde vers le haut, au milieu de la ${LOGISTIQUE_START_ZONE}. Avant le match, tu peux le déplacer et le tourner dans la ${LOGISTIQUE_START_ZONE}.`,
        'Un cube que le robot tient ne compte pas dans sa taille.',
        `Le robot est parfait${NB}: ses roues ne glissent pas et ses capteurs ne se trompent pas. Un vrai robot dévie.`,
      ],
    },
    {
      title: 'Pas dans le simulateur',
      items: ['Les missions mystères, la manette Bluetooth, le contrôle du robot avant le match (poids, pièces, électronique) et les règles pour l’équipe.'],
    },
  ],
};
