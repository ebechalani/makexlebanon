/**
 * Robot en fête 2027: what the "Règles" button shows - the French twin of
 * ../warehouse-sort/rules.ts, part for part and line for line. Two parts, kept clearly apart:
 *
 *   1. ROBOT_EN_FETE_RULES - the rules of the mission (the beginner mission "Warehouse Sort" of
 *      MakeX Lebanon) in short, plain words, with the points as the simulator counts them.
 *   2. ROBOT_EN_FETE_ASSUMPTIONS - "Ce que ce simulateur suppose": where the rules are open,
 *      contradict themselves or differ from the printed mat. Never mixed into part 1.
 *
 * Children of 8 to 12 read this, and their teachers: "tu", short sentences, nothing more
 * certain than the rules or the simulator. Every number is written from the constant that holds
 * it, with a decimal comma (23,7 cm), and ./rules.test.ts checks every number of every sentence
 * against the game and against the English window, sentence by sentence.
 *
 * The texts are those of the design's French table (fr-strings.json, file
 * "src/simulator/ui/warehouse-sort/rules.ts"). Typography: a no-break space (U+00A0) before
 * : ; ! ? and inside « »; × for "times".
 *
 * (The referee itself is in ../../warehouse-sort/game.ts, its French words in
 * ../../robot-en-fete/referee-words.ts; this is only what students read.)
 */
import { TABLE_MARGIN } from '../../core/engine';
import { NB, withComma } from '../../robot-en-fete/scenario-words';
import { CUBE_SIZE, FINISH_PADS, MAT_SIZE } from '../../warehouse-sort/field';
import {
  BLUE_MOVED_MM,
  BLUE_PENALTY,
  CARRY_MM,
  CUBES_TO_SORT,
  CUBE_COUNT,
  LIFT_MM,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_CLEAN,
  POINTS_DELIVER,
  POINTS_LEAVE_START,
  POINTS_PARK,
  POINTS_PICK,
  RESTART_PENALTY,
  TOUCH_MM,
  WRONG_BAY_PENALTY,
} from '../../warehouse-sort/game';
import { WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import type { RulesPart, RulesSection } from '../SimulatorApp';
import { RULES_EXAMPLE_MAX, RULES_FOUR_CUBES_MAX, robotLength, robotWidth } from '../warehouse-sort/rules';

/** mm in cm, as a French sentence writes it: 40 -> "4", 1235 -> "123,5". */
const cm = (mm: number): string => withComma(String(Math.round(mm) / 10));
/** A number with a decimal comma: 0.5 -> "0,5". */
const num = (value: number): string => withComma(String(value));
/** « … » with its no-break spaces. */
const quote = (text: string): string => `«${NB}${text}${NB}»`;

/** The sentence under the heading of the rules window. */
export const ROBOT_EN_FETE_RULES_NOTE = `Mission pour débutants de la catégorie Inspire, événement local de MakeX Lebanon. En français${NB}: la même mission que Warehouse Sort.`;

export const ROBOT_EN_FETE_RULES: RulesSection[] = [
  {
    title: 'La mission',
    items: [
      // (a French sentence does not begin with a digit: the numbers come after a few words)
      `Près des coins, ${CUBE_COUNT} entrepôts ont chacun un cube${NB}: ${CUBES_TO_SORT} cubes sont rouges ou verts, un est bleu.`,
      `Apporte chaque cube rouge ou vert dans la baie de sa couleur${NB}: un cube rouge dans la baie rouge, un cube vert dans la baie verte.`,
      'Laisse le cube bleu à sa place. Vérifie la couleur d’un cube avant de le prendre.',
      'À la fin, gare le robot sur une des deux aires d’arrivée rondes, à gauche ou à droite.',
      'Après le départ, le robot roule tout seul. Personne ne le touche.',
    ],
  },
  {
    title: 'Le terrain',
    items: [
      `Le tapis mesure ${cm(MAT_SIZE)} × ${cm(MAT_SIZE)} cm. Il est noir, avec des lignes blanches.`,
      'Les lignes blanches sont seulement une aide. Le robot peut rouler partout sur le tapis.',
      'La zone de départ est au milieu du bord du bas. Au départ, le robot regarde vers le haut.',
      'La baie rouge est à droite du milieu du tapis, la baie verte à gauche.',
      `Avant le match, les cubes sont mis dans les entrepôts${NB}: un bleu, et au moins un rouge et un vert.`,
    ],
  },
  {
    title: 'Le match',
    items: [
      `Un match dure ${MATCH_DURATION} secondes.`,
      'Au départ, tout le robot est dans la zone de départ.',
      `Le match finit quand le temps est écoulé, ou plus tôt quand l’équipe dit ${quote('STOP')}.`,
      'Ensuite, l’arbitre regarde le terrain tel qu’il est.',
    ],
  },
  {
    title: `Points (${MAX_SCORE} au plus)`,
    items: [
      `+${POINTS_LEAVE_START}${NB}: le robot sort de la zone de départ. Cela compte une fois.`,
      `+${POINTS_PICK} pour chaque cube rouge ou vert pris${NB}: la pince le soulève d’au moins ${cm(LIFT_MM)} cm, ou le porte. Chaque cube compte une fois.`,
      `+${POINTS_DELIVER} pour chaque cube rouge ou vert dans la baie de sa couleur à la fin${NB}: tout le cube dans la baie, sur le tapis, sans toucher le robot.`,
      // (the rules' own words; how the simulator reads them is in the second part)
      `-${WRONG_BAY_PENALTY} pour chaque cube dans la baie de l’autre couleur à la fin, et aucun point pour ce cube.`,
      // (what moving it costs is not decided: the second part says what the simulator does)
      'Le cube bleu ne rapporte aucun point.',
      `+${POINTS_PARK}${NB}: à la fin, le robot est garé sur une aire d’arrivée.`,
      `+${POINTS_CLEAN}${NB}: parcours propre, personne n’a touché le robot.`,
      `En tout${NB}: ${POINTS_LEAVE_START} + ${CUBES_TO_SORT} × ${POINTS_PICK} + ${CUBES_TO_SORT} × ${POINTS_DELIVER} + ${POINTS_PARK} + ${POINTS_CLEAN} = ${MAX_SCORE}.`,
    ],
  },
  {
    title: 'Relance',
    items: [
      `Quand une personne touche le robot ou un cube, cela coûte ${RESTART_PENALTY} points et le robot retourne dans la zone de départ. Ici, c’est le bouton Relance qui fait cela.`,
      'Le chrono continue de tourner.',
      `Après une relance, il n’y a pas de bonus de parcours propre (${POINTS_CLEAN} points).`,
      'Les règles ne limitent pas le nombre de relances.',
    ],
  },
  {
    title: 'À points égaux',
    items: ['L’équipe qui a le plus de cubes dans la bonne baie passe devant. Ensuite, celle dont la dernière livraison correcte a été la plus tôt.'],
  },
];

/** The second part of the window: what the simulator had to choose because the rules do not say it, or say two things. */
export const ROBOT_EN_FETE_ASSUMPTIONS: RulesPart = {
  title: 'Ce que ce simulateur suppose',
  note: 'Ce ne sont pas des règles. Les règles ne disent pas ces choses, ou disent deux choses différentes, alors le simulateur a dû choisir.',
  sections: [
    {
      title: 'Là où les règles et le tapis ne disent pas la même chose',
      items: [
        `Les règles décrivent le tapis comme il est imprimé${NB}: la zone de départ à droite, la baie rouge au-dessus du milieu. Ici, tout le tapis est tourné vers la droite, pour que le robot parte en regardant vers le haut.`,
        'Les règles disent que la zone de départ est une surface verte. Sur le tapis, c’est la surface avec le cadre jaune en bas. Le simulateur utilise cette surface.',
        'Les règles disent que les aires d’arrivée sont des cercles jaunes avec un damier. Sur le tapis, ce sont les deux images rondes à gauche et à droite. Le simulateur utilise celles-là.',
        `Les règles disent ${quote('se garer en touchant le cercle')}, puis ${quote('entièrement dans un cercle')}. Une aire mesure environ ${cm(2 * Math.max(FINISH_PADS.left.rx, FINISH_PADS.left.ry))} cm de large. Le robot mesure ${cm(robotLength(WAREHOUSE_SORT_ROBOT))} cm de long${NB}: il ne peut jamais y être entièrement. Ici, toucher une aire suffit.`,
        `Dans leur exemple, les règles donnent ${RULES_EXAMPLE_MAX} points au plus. Leurs propres points font ${MAX_SCORE} pour ${CUBES_TO_SORT} cubes (${RULES_FOUR_CUBES_MAX} pour ${CUBE_COUNT}). Le simulateur compte les points un par un.`,
      ],
    },
    {
      title: 'Le cube bleu',
      items: [
        `Les règles écrites n’ont que des cubes rouges et verts. Ce simulateur ajoute un cube bleu${NB}: le robot vérifie un cube, et le laisse s’il est bleu.`,
        `Les règles ne disent pas ce que coûte le déplacement du cube bleu. Ici, il coûte ${BLUE_PENALTY} points, une fois.`,
        `${quote('Déplacé')} veut dire${NB}: le robot l’a pris ou soulevé, même s’il a été remis. Ou le robot le tient à la fin, ou il est à plus de ${BLUE_MOVED_MM} mm de sa place.`,
        'Le toucher sans le déplacer ne coûte rien. Dans une baie, le cube bleu ne rapporte aucun point, et ce n’est pas non plus une mauvaise baie.',
      ],
    },
    {
      title: 'Les cubes',
      items: [
        `Un cube mesure ${cm(CUBE_SIZE)} cm de chaque côté et il est léger${NB}: le robot peut le pousser. Les règles ne donnent pas de taille.`,
        `${quote('Porté')} veut dire${NB}: la pince tient le cube et l’a déplacé d’au moins ${cm(CARRY_MM)} cm.`,
        `${quote('Toucher')} veut dire${NB}: à moins de ${num(TOUCH_MM)} mm. Une pince levée bien au-dessus d’un cube ne le touche pas.`,
        `Un cube dans la baie de l’autre couleur${NB}: -${WRONG_BAY_PENALTY}, et il perd aussi ses ${POINTS_PICK} points pour avoir été pris. Les règles disent ${quote('aucun point pour ce cube')}.`,
        `Les -${WRONG_BAY_PENALTY} sont seulement pour un cube tout entier dans l’autre baie. Un cube seulement en partie dedans ne coûte rien.`,
        `Un cube tout entier hors du tapis ne rapporte aucun point, pas même les points pour avoir été pris. Les règles laissent l’arbitre le remettre pour -5 points. Le simulateur ne le fait pas${NB}: le cube reste où il est.`,
        'Un cube que le robot tient encore n’est pas hors du tapis.',
        `Les cubes ne s’empilent pas${NB}: un cube posé sur un autre cube glisse et tombe à côté.`,
      ],
    },
    {
      title: 'Les temps',
      items: [
        'Le temps d’une livraison correcte, c’est le moment où le cube s’est posé dans sa baie, sur le tapis. La feuille de score montre le temps de la dernière.',
      ],
    },
    {
      title: 'La zone de départ et la table',
      items: [
        'Le cadre jaune fait partie de la zone de départ. Le robot est sorti de la zone quand une partie de lui a dépassé le cadre.',
        'La zone va jusqu’au bord du bas du tapis. Donc un robot qui sort du tapis en reculant par là est aussi sorti de la zone.',
        `Le tapis est posé sur une table. Le robot et les cubes peuvent sortir du tapis, et ils s’arrêtent à ${cm(TABLE_MARGIN)} cm du tapis.`,
      ],
    },
    {
      title: 'Les relances',
      items: [
        'Un cube dans la pince au moment d’une relance retourne dans son entrepôt, le cube bleu aussi. Tous les autres cubes restent où ils sont.',
        `Si un autre cube est sur son carré, il est posé le plus près possible. Un cube bleu posé à plus de ${BLUE_MOVED_MM} mm de sa place compte comme déplacé.`,
        'Les points gagnés avant une relance restent.',
        'Le bonus de parcours propre est donné quand aucune relance n’a été utilisée. Les règles n’en disent pas plus, donc un robot qui ne bouge jamais le reçoit aussi.',
        'Le total n’est jamais en dessous de 0.',
      ],
    },
    {
      title: 'Le robot',
      items: [
        // (the two Fire Rescue categories play with the same robot)
        `C’est le mBot2 de Fire Rescue Junior et Senior, avec la pince à l’avant${NB}: ${cm(robotLength(WAREHOUSE_SORT_ROBOT))} cm de long et ${cm(robotWidth(WAREHOUSE_SORT_ROBOT))} cm de large. Il tient dans la zone de départ.`,
        `Son capteur de ligne est réglé pour des lignes blanches sur un tapis noir${NB}: ${quote('ligne')} veut dire une ligne blanche.`,
        'Sur un vrai mBot2, le capteur de ligne doit peut-être d’abord apprendre ce tapis. Regarde l’aide de Makeblock sur le capteur quad RGB.',
        `Le capteur de couleur de la pince voit un cube qui est au plus à ${cm(WAREHOUSE_SORT_ROBOT.frontColorSensor.rangeMm)} cm devant le milieu de la pince.`,
        `Le robot est parfait${NB}: ses roues ne glissent pas et ses capteurs ne se trompent pas. Un vrai robot dévie.`,
        'Les boutons du CyberPi marchent pendant un match. En compétition, personne n’a le droit de piloter le robot.',
        `Le bouton ${quote('Terminé')}, c’est le ${quote('STOP')} de l’équipe. Le match finit aussi quand le programme est fini et que le robot ne bouge plus.`,
      ],
    },
    {
      title: 'Pas dans le simulateur',
      items: ['Les dégâts au terrain, les règles pour l’équipe à la table, et l’arbitre qui remet un cube.'],
    },
  ],
};
