/**
 * The blocks in French (Robot en fête 2027, the French version of Warehouse Sort): the French texts
 * of the simulator's own blocks, of their palette and of Blockly's own words that the page shows.
 *
 * Who reads this table:
 *   register.ts   a catalog block made in a French workspace takes its French rows, menu texts and
 *                 hover text from FR_BLOCKS (and the hover texts of the game from FR_PALETTE_TOOLTIPS);
 *   toolbox.ts    paletteToolbox(gameId, 'fr'): FR_CATEGORY_NAMES, FR_TOOLBOX, FR_DEFAULT_TEXTS;
 *   locale.ts     applyBlocklyMessages(Blockly, 'fr', ...): FR_BLOCKLY_MSG on top of Blockly's French file;
 *   stack-size.ts the width of a French row.
 * Which workspace is French: ./locale.ts. The English blocks never read this file.
 *
 * The rules of this table:
 *  - one entry per block type of ./catalog.ts (every block, also those of other palettes: a program
 *    file of another game can be opened on the French page);
 *  - `message` and `rows` keep EVERY placeholder of the English row (%1, %2 ...) exactly once; their
 *    ORDER may change (Blockly reads %n by number). Field and input names never change;
 *  - `options`: the texts shown in a menu, in the order of the English options. The stored values
 *    stay the English ones ('forward', 'red', 'all' ...): a program is the same program on both pages;
 *  - menus whose texts are names (EM1, L2, S1, M1, A, B, abs, sin ...) are not listed: they are shown as they are;
 *  - French typography: a no-break space (U+00A0) goes before ":" "?" "!" "%" and "°" where it stands
 *    after a word; in a row this file writes it as `NB`, so that it cannot be lost.
 *
 * Wording: Scratch 3 in French for the Scratch blocks; for the CyberPi and mBot2 blocks the most
 * likely mBlock 5 wording, in the same style (infinitive for an action, a noun for a value). Status of
 * every text: see `VERIFIED` at the end - almost everything is our own translation, not compared with
 * mBlock 5 in French (the open question 2 of the design).
 *
 * Plain data: no import, no Blockly, no DOM. A test (./fr.test.ts) checks it against the catalog.
 */

export interface FrenchBlock {
  message: string;
  rows?: string[];
  tooltip: string;
  options?: Record<string, string[]>;
}

const NB = ' ';
const COLOURS = ['rouge', 'jaune', 'vert', 'cyan', 'bleu', 'violet', 'blanc', 'noir'];
const MOVE_4 = ['avancer', 'reculer', 'tourner à gauche', 'tourner à droite'];
const MOVE_2 = ['avancer', 'reculer'];
const TURN_2 = ['tourner à gauche', 'tourner à droite'];
const LEDS = ['toutes', '1', '2', '3', '4', '5'];
const JOYSTICK = ['poussé ↑', 'poussé ↓', 'poussé ←', 'poussé →', 'enfoncé'];
const UNTIL_DONE = 'jusqu’à la fin';

/**
 * The start block, also quoted by three screen messages (fr-strings.json: SimulatorApp.tsx x2, useSimulation.ts):
 * change it here and there in one go. "lorsque", not Scratch's "quand", for the hats of the CyberPi: two
 * search-engine summaries of French mBlock sheets quote mBlock's own hats with "lorsque" ("lorsque mBot démarre",
 * "Lorsque le bouton embarqué ...") and Scratch's with "quand" ("Quand la touche ... est pressée"). NOT verified
 * against mBlock 5 itself (design 4.4, open question 2).
 */
export const FR_START_BLOCK = 'lorsque CyberPi démarre';

/** The sentence every Gripper block's tooltip ends with (catalog.ts GRIPPER_SHORTCUT). */
export const FR_GRIPPER_SHORTCUT =
  'Ce bloc est un raccourci que mBlock n’a pas : fais un clic droit dessus (sur un écran tactile, appuie longtemps) pour voir le vrai code mBlock.';

export const FR_BLOCKS: Record<string, FrenchBlock> = {
  // ------------------------------------------------------------------------------- CyberPi
  cyberpi_led_color: { message: 'LED %1 affiche %2', tooltip: 'Allume une des cinq LED du CyberPi (ou toutes) dans la couleur choisie.', options: { INDEX: LEDS } },
  cyberpi_led_rgb: {
    message: 'LED %1 affiche R %2 V %3 B %4',
    tooltip: 'Allume les LED d’une couleur mélangée de rouge (R), de vert (V) et de bleu (B), chacun de 0 à 255.',
    options: { INDEX: LEDS },
  },
  cyberpi_led_off: { message: 'éteindre la LED %1', tooltip: 'Éteint les LED.', options: { INDEX: LEDS } },
  cyberpi_print: { message: 'afficher %1 puis aller à la ligne', tooltip: 'Écrit une ligne de texte sur l’écran du CyberPi.' },
  cyberpi_show_label: {
    message: `afficher l’étiquette %1 à x${NB}: %2 y${NB}: %3 taille %4`,
    tooltip: 'Affiche un texte à un endroit choisi de l’écran du CyberPi (x depuis la gauche, y depuis le haut, en pixels).',
  },
  cyberpi_clear_screen: { message: 'effacer l’écran', tooltip: 'Efface tout l’écran du CyberPi.' },
  cyberpi_play_tone: { message: 'jouer un son de %1 Hz pendant %2 secondes', tooltip: 'Joue un bip et attend qu’il soit fini.' },

  // ------------------------------------------------------------------------------- Sensing (CyberPi)
  cyberpi_button_pressed: { message: `bouton %1 pressé${NB}?`, tooltip: 'Vrai tant que le bouton A (ou B) du CyberPi est enfoncé.' },
  cyberpi_joystick_pulled: {
    message: `joystick %1${NB}?`,
    tooltip: 'Vrai tant que le joystick du CyberPi est poussé dans cette direction (ou enfoncé au milieu).',
    options: { DIRECTION: JOYSTICK },
  },
  cyberpi_timer: { message: 'chronomètre (s)', tooltip: 'Les secondes depuis le début du programme ou depuis le dernier « réinitialiser le chronomètre ».' },
  cyberpi_reset_timer: { message: 'réinitialiser le chronomètre', tooltip: 'Remet le chronomètre à 0.' },
  cyberpi_rotation_z: {
    message: 'angle de rotation autour de l’axe z (°)',
    tooltip:
      'Gyroscope : de combien le robot a tourné depuis la dernière remise à zéro, en degrés. Tourner à droite compte vers le haut, tourner à gauche vers le bas, et le compte continue après 360.',
  },
  cyberpi_yaw: {
    message: 'angle de lacet (°)',
    tooltip: 'Gyroscope : la direction du robot par rapport à la dernière remise à zéro, de -180 à 180 degrés (la droite est positive).',
  },
  cyberpi_reset_yaw: { message: 'réinitialiser l’angle de lacet', tooltip: 'La direction du robot en ce moment devient le nouveau 0 du gyroscope.' },

  // ------------------------------------------------------------------------------- Events
  event_cyberpi_start: { message: FR_START_BLOCK, tooltip: 'Les blocs en dessous démarrent quand le match commence.' },
  event_button_pressed: { message: 'lorsque le bouton %1 est pressé', tooltip: 'Les blocs en dessous démarrent chaque fois que le bouton A (ou B) est pressé.' },
  event_joystick: {
    message: 'lorsque le joystick est %1',
    tooltip: 'Les blocs en dessous démarrent chaque fois que le joystick est poussé dans ce sens (ou enfoncé au milieu).',
    options: { DIRECTION: JOYSTICK },
  },
  event_whenbroadcastreceived: { message: 'quand je reçois %1', tooltip: 'Les blocs en dessous démarrent chaque fois qu’un autre script envoie ce message.' },
  event_broadcast: { message: 'envoyer à tous %1', tooltip: 'Démarre tous les scripts « quand je reçois » de ce message, et continue tout de suite.' },
  event_broadcastandwait: {
    message: 'envoyer à tous %1 et attendre',
    tooltip: 'Démarre tous les scripts « quand je reçois » de ce message, et attend qu’ils soient tous finis.',
  },

  // ------------------------------------------------------------------------------- Control
  control_wait: { message: 'attendre %1 secondes', tooltip: 'Met ce script en pause. Les moteurs qui tournent continuent de tourner.' },
  control_repeat: { message: 'répéter %1 fois', rows: ['%1'], tooltip: 'Exécute les blocs à l’intérieur ce nombre de fois.' },
  control_forever: { message: 'répéter indéfiniment', rows: ['%1'], tooltip: 'Exécute les blocs à l’intérieur encore et encore, jusqu’à la fin du match.' },
  control_if: { message: 'si %1 alors', rows: ['%1'], tooltip: 'Exécute les blocs à l’intérieur seulement si la condition est vraie.' },
  control_if_else: {
    message: 'si %1 alors',
    rows: ['%1', 'sinon', '%1'],
    tooltip: 'Exécute le premier groupe de blocs si la condition est vraie, sinon le second.',
  },
  control_wait_until: { message: 'attendre jusqu’à ce que %1', tooltip: 'Met ce script en pause jusqu’à ce que la condition devienne vraie.' },
  control_repeat_until: {
    message: 'répéter jusqu’à ce que %1',
    rows: ['%1'],
    tooltip: 'Exécute les blocs à l’intérieur encore et encore, jusqu’à ce que la condition devienne vraie.',
  },
  control_stop: {
    message: 'stop %1',
    tooltip: '« tout » arrête tout le programme et les moteurs. « ce script » arrête seulement cette pile de blocs.',
    options: { STOP_OPTION: ['tout', 'ce script', 'les autres scripts'] },
  },

  // ------------------------------------------------------------------------------- Operators
  operator_add: { message: '%1 + %2', tooltip: 'Additionne deux nombres.' },
  operator_subtract: { message: '%1 - %2', tooltip: 'Soustrait le second nombre du premier.' },
  operator_multiply: { message: '%1 * %2', tooltip: 'Multiplie deux nombres.' },
  operator_divide: { message: '%1 / %2', tooltip: 'Divise le premier nombre par le second.' },
  operator_random: {
    message: 'nombre aléatoire entre %1 et %2',
    tooltip: 'Un nombre au hasard entre les deux valeurs. Avec des nombres entiers, le résultat est un nombre entier.',
  },
  operator_gt: { message: '%1 > %2', tooltip: 'Vrai si la première valeur est plus grande que la seconde.' },
  operator_lt: { message: '%1 < %2', tooltip: 'Vrai si la première valeur est plus petite que la seconde.' },
  operator_equals: {
    message: '%1 = %2',
    tooltip: 'Vrai si les deux valeurs sont les mêmes. Marche avec des nombres et avec des mots (majuscules et minuscules comptent pareil).',
  },
  operator_and: { message: '%1 et %2', tooltip: 'Vrai si les deux conditions sont vraies.' },
  operator_or: { message: '%1 ou %2', tooltip: 'Vrai si au moins une des conditions est vraie.' },
  operator_not: { message: 'non %1', tooltip: 'Vrai si la condition est fausse.' },
  operator_join: { message: 'regrouper %1 et %2', tooltip: 'Colle deux textes ensemble.' },
  operator_letter_of: { message: 'lettre %1 de %2', tooltip: 'Une lettre d’un texte ; 1 est la première lettre.' },
  operator_length: { message: 'longueur de %1', tooltip: 'Le nombre de lettres du texte.' },
  operator_contains: { message: `%1 contient %2${NB}?`, tooltip: 'Vrai si le premier texte contient le second quelque part.' },
  operator_mod: { message: '%1 modulo %2', tooltip: 'Le reste de la division du premier nombre par le second.' },
  operator_round: { message: 'arrondi de %1', tooltip: 'Le nombre entier le plus proche.' },
  operator_mathop: {
    message: '%1 de %2',
    tooltip: 'Fonctions mathématiques. sin, cos et tan travaillent en degrés.',
    options: { OPERATOR: ['abs', 'plancher', 'plafond', 'racine', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'e ^', '10 ^'] },
  },

  // ------------------------------------------------------------------------------- Variables (listed by the dynamic category)
  data_variable: { message: '%1', tooltip: 'La valeur rangée dans cette variable.' },
  data_setvariableto: { message: 'mettre %1 à %2', tooltip: 'Range une valeur dans la variable : un nombre ou un mot.' },
  data_changevariableby: { message: 'ajouter %2 à %1', tooltip: 'Ajoute un nombre à la variable (un nombre négatif fait descendre le compte).' },
  data_listcontents: { message: '%1', tooltip: 'Tous les éléments de cette liste, en un seul texte.' },
  data_addtolist: { message: 'ajouter %1 à %2', tooltip: 'Met un nouvel élément à la fin de la liste.' },
  data_deleteoflist: { message: 'supprimer l’élément %1 de %2', tooltip: 'Enlève un élément de la liste ; 1 est le premier élément.' },
  data_deletealloflist: { message: 'supprimer tous les éléments de la liste %1', tooltip: 'Vide la liste.' },
  data_insertatlist: { message: 'insérer %1 en position %2 de %3', tooltip: 'Met un nouvel élément à une place choisie de la liste ; 1 est la première place.' },
  data_replaceitemoflist: { message: 'remplacer l’élément %1 de la liste %2 par %3', tooltip: 'Change un élément de la liste.' },
  data_itemoflist: { message: 'élément %1 de %2', tooltip: 'Un élément de la liste ; 1 est le premier élément.' },
  data_itemnumoflist: { message: 'position de %1 dans %2', tooltip: 'La place de cet élément dans la liste (0 s’il n’est pas dans la liste).' },
  data_lengthoflist: { message: 'longueur de %1', tooltip: 'Le nombre d’éléments de la liste.' },
  data_listcontainsitem: { message: `%1 contient %2${NB}?`, tooltip: 'Vrai si l’élément est dans la liste.' },

  // ------------------------------------------------------------------------------- mBot2 chassis
  mbot2_move_direction_with_time: {
    message: '%1 à %2 tr/min pendant %3 secondes',
    tooltip: 'Roule (ou tourne sur place) à cette vitesse de roue pendant un temps, puis s’arrête.',
    options: { DIRECTION: MOVE_4 },
  },
  mbot2_straight_cm: {
    message: `%1 de %2 cm ${UNTIL_DONE}`,
    tooltip: 'Roule tout droit sur cette distance, mesurée par les encodeurs des roues, puis s’arrête.',
    options: { DIRECTION: MOVE_2 },
  },
  mbot2_turn_deg: {
    message: `%1 de %2${NB}° ${UNTIL_DONE}`,
    tooltip: 'Tourne sur place de cet angle, mesuré par les encodeurs des roues, puis s’arrête.',
    options: { DIRECTION: TURN_2 },
  },
  mbot2_move_direction: {
    message: '%1 à %2 tr/min',
    tooltip: 'Commence à rouler (ou à tourner) et passe tout de suite au bloc suivant. Le robot continue jusqu’à ce que tu l’arrêtes.',
    options: { DIRECTION: MOVE_4 },
  },
  mbot2_drive_speed: {
    message: 'moteur encodeur EM1 ↻ tourne à %1 tr/min , moteur encodeur EM2 ↻ tourne à %2 tr/min',
    tooltip:
      'Règle la vitesse des deux moteurs. EM1 est la roue gauche, EM2 la roue droite. Les moteurs sont montés en miroir : EM1 = 50 et EM2 = -50 font rouler tout droit en avant.',
  },
  mbot2_drive_power: {
    message: `moteur encodeur EM1 ↻ tourne à la puissance %1${NB}% , moteur encodeur EM2 ↻ tourne à la puissance %2${NB}%`,
    tooltip:
      'Règle la puissance des deux moteurs (-100 à 100). EM1 est la roue gauche, EM2 la roue droite. Les moteurs sont montés en miroir : EM1 = 50 et EM2 = -50 font rouler tout droit en avant.',
  },
  mbot2_motor_speed: {
    message: 'moteur encodeur %1 ↻ tourne à %2 tr/min',
    tooltip: 'Règle la vitesse d’un moteur. Une vitesse positive sur EM1 (gauche) fait avancer ; sur EM2 (droite), elle fait reculer.',
  },
  mbot2_motor_power: { message: `moteur encodeur %1 ↻ tourne à la puissance %2${NB}%`, tooltip: 'Règle la puissance d’un moteur (-100 à 100).' },
  mbot2_motor_rotate_deg: {
    message: `moteur encodeur %1 ↻ tourne de %2${NB}° à %3 tr/min ${UNTIL_DONE}`,
    tooltip: 'Fait tourner l’axe du moteur de ce nombre de degrés, puis s’arrête. 360, c’est un tour complet de la roue.',
    options: { PORT: ['EM1', 'EM2', 'tous'] },
  },
  mbot2_stop: { message: 'arrêter le moteur encodeur %1', tooltip: 'Arrête les moteurs.', options: { PORT: ['tous', 'EM1', 'EM2'] } },
  mbot2_motor_angle: {
    message: 'angle tourné du moteur encodeur %1 ↻ (°)',
    tooltip: 'De combien le moteur a tourné depuis la dernière remise à zéro, en degrés. Pour EM2, rouler en avant fait descendre le compte (moteur en miroir).',
  },
  mbot2_motor_rpm: { message: 'vitesse du moteur encodeur %1 ↻ (tr/min)', tooltip: 'La vitesse du moteur en ce moment.' },
  mbot2_motor_power_value: { message: 'puissance du moteur encodeur %1 ↻ (%)', tooltip: 'La puissance du moteur en ce moment (-100 à 100).' },
  mbot2_motor_reset_angle: {
    message: 'remettre à zéro l’angle tourné du moteur encodeur %1 ↻',
    tooltip: 'Remet à 0 l’angle tourné du moteur.',
    options: { PORT: ['tous', 'EM1', 'EM2'] },
  },

  // ------------------------------------------------------------------------------- mBot2 extension port (not in this palette; a Fire Chief program can be opened here)
  mbot2_dc_motor_power: {
    message: `moteur CC %1 tourne à la puissance %2${NB}%`,
    tooltip:
      'Fait tourner le moteur CC du port M1 ou M2 de la carte du mBot2 à cette puissance (-100 à 100 ; une puissance négative le fait tourner dans l’autre sens). Il continue jusqu’à ce que tu changes la puissance ou que tu l’arrêtes. Un ventilateur sur ce port souffle à partir d’une puissance de 20 %.',
  },
  mbot2_dc_motor_drive: {
    message: `moteur CC M1 tourne à la puissance %1${NB}% , moteur CC M2 tourne à la puissance %2${NB}%`,
    tooltip: 'Règle la puissance des deux ports de moteur CC en même temps (chacun de -100 à 100). 0 arrête un moteur.',
  },
  mbot2_dc_motor_stop: {
    message: 'le moteur CC %1 arrête de tourner',
    tooltip: 'Arrête le moteur CC de ce port (ou des deux ports). Un ventilateur branché dessus arrête de souffler.',
    options: { PORT: ['M1', 'M2', 'tous'] },
  },

  // ------------------------------------------------------------------------------- Servos
  mbot2_servo_set: {
    message: `régler le servo %1 à l’angle %2${NB}°`,
    tooltip: 'Demande à un servo d’aller à un angle (0 à 180). Le servo a besoin d’un moment pour y arriver : ajoute un « attendre » si le bloc suivant en a besoin.',
    options: { PORT: ['S1', 'S2', 'S3', 'S4', 'tous'] },
  },
  mbot2_servo_angle: { message: 'angle du servo %1 (°)', tooltip: 'L’angle du servo en ce moment.' },

  // ------------------------------------------------------------------------------- Gripper (shortcuts of the simulator)
  gripper_claw: {
    message: `la pince %1 ${UNTIL_DONE}`,
    tooltip: `Ouvre ou ferme la pince et attend la fin du mouvement. En se fermant sur un seau ou une personne, elle l’attrape. ${FR_GRIPPER_SHORTCUT}`,
    options: { ACTION: ['s’ouvre', 'se ferme'] },
  },
  gripper_arm: {
    message: `le bras %1 ${UNTIL_DONE}`,
    tooltip: `Monte le bras tout en haut ou le descend tout en bas, et attend la fin du mouvement. ${FR_GRIPPER_SHORTCUT}`,
    options: { ACTION: ['monte', 'descend'] },
  },
  gripper_arm_height: {
    message: `le bras va à la hauteur %1${NB}% ${UNTIL_DONE}`,
    tooltip: `Amène le bras à une hauteur entre 0 % (tout en bas) et 100 % (tout en haut). ${FR_GRIPPER_SHORTCUT}`,
  },

  // ------------------------------------------------------------------------------- Quad RGB sensor
  sensing_quadrgb_line_status: {
    message: 'état de ligne du capteur quad RGB %1',
    tooltip:
      'Quelles sondes voient la ligne, en un seul nombre. Avec quatre sondes : L2 = 8, L1 = 4, R1 = 2, R2 = 1, additionnés (6 = les deux sondes du milieu sont sur la ligne). Avec deux sondes : L1 = 2, R1 = 1.',
  },
  sensing_quadrgb_status_is: {
    message: `l’état de ligne du capteur quad RGB est %1${NB}?`,
    tooltip: 'Vrai si les quatre sondes (L2 L1 R1 R2, de gauche à droite) voient exactement ce motif. Un carré plein veut dire « sur la ligne ».',
  },
  sensing_quadrgb_deviation: {
    message: 'écart du capteur quad RGB (-100~100)',
    tooltip:
      'De combien le robot s’est écarté de la ligne, comme sur le vrai mBot2 : -100 = le robot est loin à gauche de la ligne (la ligne est sous les sondes de droite), 0 = la ligne est au milieu, 100 = le robot est loin à droite de la ligne (la ligne est sous les sondes de gauche). Pour suivre une ligne : puissance EM1 = base - kp x écart, puissance EM2 = -1 x (base + kp x écart).',
  },
  sensing_quadrgb_probe_detects: {
    message: `la sonde %1 du capteur quad RGB détecte %2${NB}?`,
    tooltip: 'Vrai si cette sonde est au-dessus de la ligne foncée (ou au-dessus du fond clair).',
    options: { TARGET: ['la ligne', 'le fond'] },
  },
  sensing_quadrgb_probe_color_is: {
    message: `la sonde %1 du capteur quad RGB détecte la couleur %2${NB}?`,
    tooltip: 'Vrai si cette sonde est au-dessus de cette couleur du tapis.',
    options: { COLOR: COLOURS },
  },
  sensing_quadrgb_probe_color: {
    message: 'couleur de la sonde %1 du capteur quad RGB',
    tooltip: 'Le nom de la couleur sous cette sonde, en anglais comme sur le robot : red (rouge), yellow (jaune), green (vert), cyan, blue (bleu), purple (violet), white (blanc) ou black (noir).',
  },
  sensing_quadrgb_probe_rgb: {
    message: 'valeur %2 de la sonde %1 du capteur quad RGB (0~255)',
    tooltip: 'La quantité de rouge (R), de vert (V) ou de bleu (B) que voit cette sonde (0 à 255).',
    options: { CHANNEL: ['R', 'V', 'B'] },
  },
  sensing_quadrgb_probe_gray: { message: 'niveau de gris de la sonde %1 du capteur quad RGB (0~100)', tooltip: 'À quel point le tapis est foncé sous cette sonde : 0 = blanc, 100 = noir.' },
  sensing_quadrgb_probe_light: {
    message: 'lumière réfléchie de la sonde %1 du capteur quad RGB (0~100)',
    tooltip: 'La quantité de lumière que le tapis renvoie sous cette sonde : 0 = noir, 100 = blanc.',
  },

  // ------------------------------------------------------------------------------- Ultrasonic sensor 2
  sensing_ultrasonic_distance: {
    message: 'distance à un objet du capteur à ultrasons 2 (cm)',
    tooltip: 'La distance jusqu’à la chose la plus proche devant le robot, en centimètres. Donne la portée maximale si rien n’est en vue.',
  },

  // ------------------------------------------------------------------------------- Colour sensor at the claw
  sensing_claw_color_is: {
    message: `le capteur de couleur de la pince détecte %1${NB}?`,
    tooltip: 'Vrai si l’objet dans la pince (ou juste devant) a cette couleur.',
    options: { COLOR: COLOURS },
  },
  sensing_claw_color: {
    message: 'couleur du capteur de couleur de la pince',
    tooltip: 'Le nom de la couleur de l’objet à la pince, en anglais comme sur le robot (red, green, blue…), ou « none » s’il n’y a rien.',
  },
  sensing_claw_object_detected: { message: `objet détecté à la pince${NB}?`, tooltip: 'Vrai s’il y a un seau ou une personne dans la pince (ou juste devant).' },

  // ------------------------------------------------------------------------------- Colour sensor at the front (Fire Chief; not in this palette)
  sensing_colorsensor_color_is: {
    message: `le capteur de couleur %1 détecte %2${NB}?`,
    tooltip:
      'Vrai si la chose juste devant le capteur de couleur a cette couleur. Le capteur est à l’avant du robot et ne voit qu’une chose très proche : dans ce simulateur, 1,5 cm ou moins. Le nombre dit de quel capteur de couleur il s’agit : 1 est le premier (ce robot en a un).',
    options: { COLOR: COLOURS },
  },
  sensing_colorsensor_color: {
    message: 'couleur du capteur de couleur %1',
    tooltip:
      'Le nom de la couleur juste devant le capteur de couleur, en anglais comme sur le robot : red, yellow, green, cyan, blue, purple, white ou black. C’est « none » si rien n’est assez proche (dans ce simulateur : 1,5 cm ou moins).',
  },
};

/** Hover texts of this game where they differ from the catalog's (blocks/palettes.ts PALETTE_TOOLTIPS['warehouse-sort']). */
export const FR_PALETTE_TOOLTIPS: Record<string, string> = {
  sensing_quadrgb_probe_detects: 'Vrai si cette sonde est au-dessus de la ligne blanche (ou au-dessus du tapis noir).',
  gripper_claw: `Ouvre ou ferme la pince et attend la fin du mouvement. En se fermant sur un cube, elle l’attrape. ${FR_GRIPPER_SHORTCUT}`,
  sensing_claw_object_detected: 'Vrai s’il y a un cube dans la pince (ou juste devant).',
};

/** The names of the categories (catalog.ts CATEGORIES), by id. */
export const FR_CATEGORY_NAMES: Record<string, string> = {
  cyberpi: 'CyberPi',
  sensing: 'Capteurs',
  events: 'Événements',
  control: 'Contrôle',
  operators: 'Opérateurs',
  variables: 'Variables',
  myblocks: 'Mes blocs',
  chassis: 'Châssis mBot2',
  extensionport: 'Port d’extension mBot2',
  servo: 'Servomoteurs',
  gripper: 'Pince',
  quadrgb: 'Capteur quad RGB',
  ultrasonic: 'Capteur à ultrasons 2',
  colorsensor: 'Capteur de couleur',
  frontcolorsensor: 'Capteur de couleur',
};

/** What the Gripper category shows above its blocks, and the entry of the right-click menu (toolbox.ts). */
export const FR_TOOLBOX = {
  seeMblockCode: 'Voir le vrai code mBlock',
  gripperIntro1: 'Des raccourcis faits pour ce simulateur.',
  gripperIntro2: 'mBlock n’a pas ces blocs.',
  makeVariable: 'Créer une variable',
  makeList: 'Créer une liste',
  newListName: 'Nom de la nouvelle liste :',
};

/** The hover text of a white bubble of words (register.ts: Blockly's "text" block, drawn without its quote marks). */
export const FR_TEXT_BUBBLE_TOOLTIP = 'Un texte. Clique pour écrire.';

/** The default texts of the white bubbles and of the variable menus where they are words (catalog.ts). */
export const FR_DEFAULT_TEXTS: Record<string, string> = {
  'apple ': 'pomme ',
  banana: 'banane',
  apple: 'pomme',
  thing: 'chose',
  'my variable': 'ma variable',
  'my list': 'ma liste',
  // ('makeblock', 'message1', 'a', '50', '0' stay as they are)
};

/**
 * Blockly's own words (Blockly.Msg). The page uses Blockly's French file (blockly/msg/fr) and then
 * these: the Scratch words of register.ts applyScratchWording in French, and Blockly's words that
 * its French file leaves in English (178 keys in Blockly 13.4.0; those the page shows or a screen
 * reader says are here) or gets wrong (two keys are not French at all).
 */
export const FR_BLOCKLY_MSG: Record<string, string> = {
  // register.ts applyScratchWording
  PROCEDURES_DEFNORETURN_TITLE: 'définir',
  PROCEDURES_DEFNORETURN_PROCEDURE: 'mon bloc',
  PROCEDURES_DEFNORETURN_TOOLTIP: 'Crée ton propre bloc : les blocs à l’intérieur s’exécutent chaque fois que le bloc est utilisé.',
  PROCEDURES_DEFRETURN_TITLE: 'définir',
  PROCEDURES_DEFRETURN_PROCEDURE: 'ma valeur',
  PROCEDURES_DEFRETURN_TOOLTIP: 'Crée ton propre bloc rond : il exécute les blocs à l’intérieur et donne une valeur.',
  PROCEDURES_CALLNORETURN_TOOLTIP: 'Exécute ton bloc « %1 ».',
  PROCEDURES_CALLRETURN_TOOLTIP: 'Exécute ton bloc « %1 » et utilise la valeur qu’il donne.',
  NEW_VARIABLE: 'Créer une variable',
  NEW_VARIABLE_TITLE: 'Nom de la nouvelle variable :',
  // left in English by Blockly's French file - shown or read on this page (measured: probes/ws-crawl.json)
  ZOOM_IN: 'Zoom avant',
  ZOOM_OUT: 'Zoom arrière',
  RESET_ZOOM: 'Taille normale',
  ZOOM_TO_FIT_ARIA_LABEL: 'Tout voir',
  OPEN_TRASH: 'Ouvrir la corbeille',
  ARIA_LABEL_TRASH_EMPTY: 'Corbeille, vide pour l’instant',
  ARIA_LABEL_BUTTON: 'bouton',
  ARIA_LABEL_COMMENT: 'Commentaire',
  ARIA_LABEL_COMMENT_COLLAPSE: 'Réduire le commentaire',
  ARIA_LABEL_COMMENT_EXPAND: 'Ouvrir le commentaire',
  ARIA_LABEL_FIELD_ANGLE: '%1 degrés',
  ARIA_LABEL_HEADING: 'titre',
  ARIA_TYPE_FIELD_ANGLE: 'angle',
  ARIA_TYPE_FIELD_CHECKBOX: 'case à cocher',
  ARIA_TYPE_FIELD_COLOUR: 'couleur',
  ARIA_TYPE_FIELD_DROPDOWN: 'menu',
  ARIA_TYPE_FIELD_IMAGE: 'image',
  ARIA_TYPE_FIELD_INPUT: 'champ',
  ARIA_TYPE_FIELD_NUMBER: 'nombre',
  ARIA_TYPE_FIELD_TEXT_INPUT: 'texte',
  ARIA_TYPE_FIELD_TEXT_INPUT_ARGUMENT: 'nom de l’entrée',
  ARIA_TYPE_FIELD_TEXT_INPUT_PROCEDURE: 'nom du bloc',
  BLOCK_LABEL_BEGIN_PREFIX: 'Début de %1',
  BLOCK_LABEL_BEGIN_STACK: 'Début de pile',
  BLOCK_LABEL_COLLAPSED: 'réduit',
  BLOCK_LABEL_CONTAINER: 'conteneur',
  BLOCK_LABEL_DISABLED: 'désactivé',
  BLOCK_LABEL_HAS_BRANCHES: 'a %1 branches',
  BLOCK_LABEL_HAS_INPUT: 'a une entrée',
  BLOCK_LABEL_HAS_INPUTS: 'a des entrées',
  BLOCK_LABEL_REPLACEABLE: 'remplaçable',
  BLOCK_LABEL_STACK_BLOCKS: '%1 blocs empilés',
  BLOCK_LABEL_STATEMENT: 'instruction',
  BLOCK_LABEL_TOOLBOX_CATEGORY: 'catégorie %1',
  BLOCK_LABEL_VALUE: 'valeur',
  BUBBLE_LABEL_COMMENT: 'Commentaire : %1',
  BUBBLE_LABEL_DEFAULT: 'Bulle',
  BUBBLE_LABEL_WARNING: 'Attention : %1',
  CURRENT_BLOCK_ANNOUNCEMENT: 'Bloc actuel : %1',
  FIELD_LABEL_EDIT_PREFIX: 'Modifier %1',
  FIELD_LABEL_EMPTY: 'vide',
  FIELD_LABEL_OPTION_INDEX: 'Choix %1',
  FIELD_LABEL_VARIABLE: 'Variable « %1 »',
  ICON_LABEL_COMMENT_CLOSED: 'Ouvrir le commentaire',
  ICON_LABEL_COMMENT_OPEN: 'Fermer le commentaire',
  ICON_LABEL_DEFAULT: 'Icône',
  ICON_LABEL_MUTATOR_CLOSED: 'Modifier ce bloc',
  ICON_LABEL_MUTATOR_OPEN: 'Fermer l’éditeur du bloc',
  ICON_LABEL_WARNING_CLOSED: 'Ouvrir l’avertissement',
  ICON_LABEL_WARNING_OPEN: 'Fermer l’avertissement',
  INPUT_LABEL_CONDITION: 'condition',
  INPUT_LABEL_EMPTY: 'Vide',
  INPUT_LABEL_END_STATEMENT: 'Fin de %1',
  INPUT_LABEL_INDEX: 'entrée %1',
  INPUT_LABEL_NUMBER: 'nombre',
  INPUT_LABEL_STATEMENT: 'place d’un bloc',
  INPUT_LABEL_VALUE: 'place d’une valeur',
  INPUT_LABEL_VARIABLES_SET: 'valeur à ranger',
  KEYBOARD_NAV_BLOCK_NAVIGATION_HINT: 'Utilise %1 pour te déplacer à l’intérieur des blocs.',
  KEYBOARD_NAV_FLYOUT_LABEL_HINT: 'Utilise les flèches pour aller à un bloc, ou appuie sur %1 pour aller au titre suivant.',
  KEYBOARD_NAV_WORKSPACE_NAVIGATION_HINT: 'Utilise les flèches pour te déplacer.',
  NO_PARENT_ANNOUNCEMENT: 'Ce bloc n’a pas de parent',
  PARENT_BLOCKS_ANNOUNCEMENT: 'Blocs parents : %1',
  SCREENREADER_HINT: 'Utilise les flèches pour te déplacer. Appuie sur %1 pour activer ou couper le mode lecteur d’écran.',
  SCREENREADER_MODE_DISABLED: 'Le mode lecteur d’écran est coupé, appuie sur %1 pour l’activer',
  SCREENREADER_MODE_ENABLED: 'Le mode lecteur d’écran est activé, appuie sur %1 pour le couper',
  WORKSPACE_CONTENTS_BLOCKS_MANY: '%1 piles de blocs%2 dans l’espace de travail.',
  WORKSPACE_CONTENTS_BLOCKS_ONE: 'Une pile de blocs%2 dans l’espace de travail.',
  WORKSPACE_CONTENTS_BLOCKS_ZERO: 'Aucun bloc%2 dans l’espace de travail.',
  WORKSPACE_CONTENTS_COMMENTS_MANY: ' et %1 commentaires',
  WORKSPACE_CONTENTS_COMMENTS_ONE: ' et un commentaire',
  // Blockly's French file has these, but not in French (or not plainly)
  WORKSPACE_LABEL_PLAIN: 'Espace de travail des blocs.',
  SHORTCUTS_JUMP_BOTTOM_STACK: 'Aller en bas de la pile',
  SHORTCUTS_JUMP_TOP_STACK: 'Aller en haut de la pile',
  SHORTCUTS_FOCUS_WORKSPACE: 'Aller à l’espace de travail',
  SHORTCUTS_FOCUS_TOOLBOX: 'Aller à la boîte à outils',
  SHORTCUTS_JUMP_FIRST_BLOCK: 'Aller au premier bloc',
  SHORTCUTS_JUMP_LAST_BLOCK: 'Aller au dernier bloc',
  // left in English by Blockly's French file - said by a screen reader on this page (moving a block with the keyboard,
  // the my-block editor) - measured on the English page by the French critic, and read in blockly/msg/fr.js
  ANNOUNCE_MOVE_WORKSPACE: 'Déplacement de %1 dans l’espace de travail.',
  ANNOUNCE_MOVE_TO: 'Déplacement de %1 vers %2.',
  ANNOUNCE_MOVE_BEFORE: 'Déplacement de %1 avant %2.',
  ANNOUNCE_MOVE_AFTER: 'Déplacement de %1 après %2.',
  ANNOUNCE_MOVE_INSIDE: 'Déplacement de %1 dans %2.',
  ANNOUNCE_MOVE_AROUND: 'Déplacement de %1 autour de %2.',
  ANNOUNCE_MOVE_CANCELED: 'Déplacement annulé.',
  ANNOUNCE_MOVE_OF: '%1 sur %2',
  FIELD_LABEL_CHECKBOX_CHECKED: 'coché',
  FIELD_LABEL_CHECKBOX_UNCHECKED: 'non coché',
  ARIA_LABEL_ADD_INPUT: 'Ajouter une entrée',
  ARIA_LABEL_REMOVE_INPUT: 'Enlever une entrée',
  INPUT_LABEL_MATH_CHANGE_BY: 'valeur à ajouter',
  // Blockly's French file has these, but with "vous", "fonction", "procédure" or "..." - against the glossary (design 4.1, 4.2)
  PROCEDURES_DEFNORETURN_COMMENT: 'Explique ce que fait ton bloc…',
  PROCEDURES_DEFRETURN_COMMENT: 'Explique ce que fait ton bloc…',
  PROCEDURES_ALLOW_STATEMENTS: 'accepter des blocs à l’intérieur',
  PROCEDURES_HIGHLIGHT_DEF: 'Montrer la définition du bloc',
  PROCEDURES_IFRETURN_WARNING: 'Attention : ce bloc ne marche que dans la définition d’un de tes blocs.',
  PROCEDURES_MUTATORARG_TOOLTIP: 'Ajouter une entrée au bloc.',
  PROCEDURES_MUTATORCONTAINER_TOOLTIP: 'Ajouter, enlever ou ranger les entrées de ce bloc.',
  PROCEDURES_CALL_DISABLED_DEF_WARNING: 'Impossible d’exécuter le bloc « %1 » : son bloc « définir » est désactivé.',
  PROCEDURES_DEF_DUPLICATE_WARNING: 'Attention : deux entrées de ce bloc ont le même nom.',
  CANNOT_DELETE_VARIABLE_PROCEDURE: 'Impossible de supprimer la variable « %1 » : elle fait partie de la définition du bloc « %2 ».',
  VARIABLE_ALREADY_EXISTS_FOR_A_PARAMETER: 'Une variable « %1 » existe déjà : c’est une entrée du bloc « %2 ».',
  WORKSPACE_COMMENT_DEFAULT_TEXT: 'Écris quelque chose…',
  KEYBOARD_NAV_COPIED_HINT: 'Copié. Appuie sur %1 pour coller.',
  KEYBOARD_NAV_CUT_HINT: 'Coupé. Appuie sur %1 pour coller.',
  KEYBOARD_NAV_CONSTRAINED_MOVE_HINT: 'Utilise les flèches pour déplacer, puis %1 pour valider la place.',
  KEYBOARD_NAV_UNCONSTRAINED_MOVE_HINT: 'Garde %1 enfoncé et utilise les flèches pour déplacer librement, puis %2 pour valider la place.',
  HELP_PROMPT: 'Appuie sur %1 pour voir les raccourcis clavier.',
  // the menus: the same word as the toolbar ("Rétablir"), and "the" comment of this block
  REDO: 'Rétablir',
  REMOVE_COMMENT: 'Supprimer le commentaire',
  // (every other menu word of a block and of the workspace: Blockly's French words are fine and are not repeated here)
};

/**
 * The keys of Blockly.Msg that may stay as Blockly's French file has them although that file marks them
 * "untranslated" (English): they never reach this page, or they are names. The test of design 8.2 T6 fails on
 * any other key whose value, after the French is applied, is still Blockly's English, or uses "vous", "fonction",
 * "procédure" or "...". Prefixes end with "_".
 */
export const FR_BLOCKLY_NOT_ON_THIS_PAGE: Record<string, string> = {
  ALT_KEY: 'a name of a key', PAUSE_KEY: 'a name of a key', CONTEXT_MENU_KEY: 'a name of a key ("≣ Menu")',
  CHROME_OS: 'a name', LINUX: 'a name', MAC_OS: 'a name', WINDOWS: 'a name',
  MATH_TRIG_: 'sin, cos, tan … : the same in French',
  'BACKPACK': 'the backpack plugin is not loaded (CLOSE_BACKPACK, COPY_TO_BACKPACK …)',
  MINIMAP_ARIA_LABEL: 'the minimap plugin is not loaded',
  TOOLBOX_SEARCH_: 'the toolbox search plugin is not loaded',
  WORKSPACE_SEARCH_: 'the workspace search plugin is not loaded',
  ARIA_TYPE_FIELD_BITMAP: 'no bitmap field', FIELD_BITMAP_: 'no bitmap field',
  ARIA_TYPE_FIELD_DATE: 'no date field', ARIA_TYPE_FIELD_GRID: 'no grid dropdown',
  FIELD_MULTILINEINPUT_: 'no multi-line text field',
  ARIA_LABEL_ADD_ELSE_IF: 'controls_if is not used (our "si … alors" is a catalog block)',
  ARIA_LABEL_REMOVE_ELSE_IF: 'controls_if is not used',
  ARIA_LABEL_ADD_LIST_ITEM: 'lists_create_with is not used', ARIA_LABEL_REMOVE_LIST_ITEM: 'lists_create_with is not used',
  ARIA_LABEL_ADD_TEXT: 'text_join is not used', ARIA_LABEL_REMOVE_TEXT: 'text_join is not used',
  INPUT_LABEL_LISTS_: 'Blockly\'s list blocks are not used', INPUT_LABEL_LOOP_: 'Blockly\'s loop blocks are not used',
  INPUT_LABEL_MATH_CONSTRAIN_VALUE: 'not used', INPUT_LABEL_MATH_DIVIDEND: 'not used', INPUT_LABEL_MATH_DIVISOR: 'not used',
  INPUT_LABEL_NUMBER_: 'Blockly\'s math blocks are not used', INPUT_LABEL_TEXT_: 'Blockly\'s text blocks are not used',
  INPUT_LABEL_CONDITION_A: 'logic_operation is not used', INPUT_LABEL_CONDITION_B: 'logic_operation is not used',
  INPUT_LABEL_VALUE_A: 'logic_compare is not used', INPUT_LABEL_VALUE_B: 'logic_compare is not used',
  LOGIC_TERNARY_CONDITION: 'logic_ternary is not used', MATH_ADDITION_SYMBOL_ARIA: 'math_arithmetic is not used',
  MATH_ONLIST_: 'math_on_list is not used', MATH_CONSTANT_TOOLTIP: 'math_constant is not used',
  NEW_COLOUR_VARIABLE: 'typed variables are not used', NEW_NUMBER_VARIABLE: 'typed variables are not used', NEW_STRING_VARIABLE: 'typed variables are not used',
  _HELPURL: 'addresses, not texts',
};

/**
 * What is verified. Web search could not open mBlock 5 itself, Makeblock's help pages or the
 * Scratch translation files from this session (the hosts were refused); what is marked here was
 * seen in French teaching documents found by web search (their summaries, not the documents).
 */
export const VERIFIED: Record<string, string> = {
  'tr/min': 'French teaching sheets for the mBot2 in mBlock 5 write speeds in tr/min ("avancer à 50 tr/min pendant 1 seconde"): unit seen, block text not read letter for letter.',
  'répéter indéfiniment': 'Scratch 3 in French, seen in French teaching documents.',
  'attendre jusqu’à ce que': 'Scratch 3 in French, seen in French teaching documents.',
  'nombre aléatoire entre': 'Scratch 3 in French, seen in French teaching documents.',
  'everything else': 'our own translation, in the style of Scratch 3 in French; NOT compared with mBlock 5 (open question 2).',
};
