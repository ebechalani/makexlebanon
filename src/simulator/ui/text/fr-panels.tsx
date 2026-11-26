/**
 * The French of the Sensors panel, the CyberPi panel and the console (./types.ts SensorText,
 * CyberPiText, ConsoleText). Part of the French word table (./fr.tsx).
 *
 * The values the program gets stay as the program gets them (design 6.3, D7): a colour a sensor
 * reads is shown in English, then its French in brackets - "red (rouge)"; a variable's value and
 * a printed text are shown exactly as the program holds them ("true", "red").
 */
import type { ReactNode } from 'react';
import type { SensorColor, SensorSnapshot, SimEvent } from '../../core/types';
import type { LogLine, RestartFacts } from '../format';
import { colourNeedsCloser, type FrontColourPart, type RobotParts } from '../robot-parts';
import { capital } from '../screen-words';
import { EN_TEXT } from './en';
import { frConsoleLine } from './fr-console';
import { frBodyName, frFinishText, frNumber, frRestartLine, frSensorValue, NB } from './fr-common';
import type { ConsoleText, CyberPiText, SensorText } from './types';

/**
 * A colour as the Sensors panel shows it: "red (rouge)". The panel writes the English value with
 * a capital ("Red"); the French one is shown exactly as design 6.3 writes it, all of it in small
 * letters (an inline style, so that the stylesheet of the site gets no new rule).
 */
function sensorColour(colour: SensorColor | 'none'): ReactNode {
  return <span style={{ textTransform: 'none' }}>{frSensorValue(colour)}</span>;
}

/** colourRangeText (../robot-parts.ts) in French: "1,5 cm". */
const colourRangeText = (part: FrontColourPart): string => `${frNumber(part.rangeMm / 10, 1)} cm`;

/** sensorSummary (../robot-parts.ts) in French: "ligne 6 · 7 cm · pince red (rouge)". (The front colour sensor and the fan are Fire Chief's: their words stay English.) */
function sensorSummary(parts: RobotParts, sensors: Pick<SensorSnapshot, 'lineStatus' | 'ultrasonicCm' | 'frontColor' | 'fanOn'>): string {
  const closer = parts.frontColour !== null && colourNeedsCloser(parts, sensors);
  const words = closer ? [] : [`ligne ${sensors.lineStatus}`];
  words.push(`${frNumber(sensors.ultrasonicCm)} cm`);
  if (parts.clawColour) words.push(sensors.frontColor === 'none' ? 'pince vide' : `pince ${frSensorValue(sensors.frontColor)}`);
  if (parts.frontColour) words.push(closer ? 'colour none (too far)' : `colour ${sensors.frontColor}`);
  if (parts.fan) words.push(`fan ${sensors.fanOn ? 'on' : 'off'}`);
  return words.join(' · ');
}

export const FR_SENSOR_TEXT: SensorText = {
  probeHint: {
    L2: 'tout à gauche',
    L1: 'gauche',
    R1: 'droite',
    R2: 'tout à droite',
  },
  probeTitle: (name, hint) => `Sonde ${name} (${hint})`,
  sensorColour,
  probeOnLine: 'ligne',
  probeBackground: 'fond',
  lightHint: 'lumière réfléchie, de 0 (noir) à 100 (blanc)',
  probeLight: (value) => <>lumière {value}</>,
  quadRgb: 'Capteur de ligne quad RGB',
  lineStatus: 'État de ligne',
  lineStatusHint: `Un chiffre par sonde, L2 L1 R1 R2${NB}: 1 = sur la ligne. Exemple${NB}: 0110 = 6 veut dire que les deux sondes du milieu voient la ligne.`,
  deviation: 'Écart',
  deviationHint: '-100 = le robot est loin à gauche de la ligne, 0 = au milieu, 100 = loin à droite de la ligne (comme sur le vrai mBot2)',
  // (not on this page: Fire Chief's colour sensor at the front)
  frontColourHint: EN_TEXT.frontColourHint,
  colourSensor: EN_TEXT.colourSensor,
  ultrasonic: 'Ultrasons',
  ultrasonicNothing: 'cm (rien en vue)',
  clawColour: 'Couleur à la pince',
  // (claw empty: "rien", as the English shows "nothing")
  clawReading: (colour) => (colour === 'none' ? 'rien' : sensorColour(colour)),
  yaw: 'Lacet (rotation)',
  yawHint: `De combien le robot a tourné depuis la remise à zéro du gyroscope${NB}; le sens des aiguilles d’une montre est positif`,
  timer: 'Chronomètre',
  // (short: the card is 105 px wide on a 360 px phone; the hint says which wheel in full)
  em1Angle: 'Angle EM1 (g.)',
  em1AngleHint: 'Encodeur du moteur EM1, la roue gauche',
  em2Angle: 'Angle EM2 (d.)',
  em2AngleHint: `Encodeur du moteur EM2, la roue droite. Il est monté en miroir${NB}: il compte à l’envers quand le robot avance\u00a0– comme sur le vrai mBot2.`,
  em1Speed: 'Vitesse EM1',
  em2Speed: 'Vitesse EM2',
  em2SpeedHint: 'Négative quand le robot avance (moteur en miroir)',
  rpm: 'tr/min',
  armLabel: (servo) => `Bras (${servo})`,
  armHint: (height) => `La pince est à ${height} mm au-dessus du tapis`,
  clawLabel: (servo) => `Pince (${servo})`,
  clawHint: (gap) => `Ouverture${NB}: ${gap} mm`,
  // (not on this page: Fire Chief's DC motor port and its fan)
  dcMotorLabel: EN_TEXT.dcMotorLabel,
  dcMotorHint: EN_TEXT.dcMotorHint,
  fanHint: EN_TEXT.fanHint,
  fan: EN_TEXT.fan,
  fanState: EN_TEXT.fanState,
  variablesTitle: 'Variables',
  noVariables: 'Ton programme n’a pas encore de variables.',
  // (the interpreter names a list that has the name of a variable "x (list)": vm/index.ts)
  variableName: (name) => (name.endsWith(' (list)') ? `${name.slice(0, -' (list)'.length)} (liste)` : name),
  dcMotorUse: EN_TEXT.dcMotorUse,
  colourRangeText,
  colourRangeNote: EN_TEXT.colourRangeNote,
  sensorSummary,
  sensorsViewHint: (parts) => (parts.frontColour ? EN_TEXT.sensorsViewHint(parts) : 'Montrer ce que voient le capteur de ligne et le capteur à ultrasons'),
};

/** What the head of the closed CyberPi panel says when it lists what the panel holds. */
const CYBERPI_PANEL_HOLDS = 'écran, LED, boutons A / B, joystick';

export const FR_CYBERPI_TEXT: CyberPiText = {
  joystick: 'Joystick',
  joystickUp: 'Joystick vers le haut',
  joystickLeft: 'Joystick vers la gauche',
  joystickMiddle: 'Joystick enfoncé au milieu',
  joystickRight: 'Joystick vers la droite',
  joystickDown: 'Joystick vers le bas',
  cyberPiScreen: 'Écran du CyberPi',
  printHere: `Utilise un bloc «${NB}afficher${NB}» pour écrire ici`,
  leds: 'Les cinq LED du CyberPi',
  buttons: 'Boutons',
  holdHint: 'Maintiens un bouton enfoncé pour appuyer sur celui du robot.',
  // (one table function: "Son activé" is no "Son" + "activé" - design 4.5)
  soundButton: (on) => (on ? 'Son activé' : 'Son coupé'),
  cyberPiSummary: (lines, showLastPrint) => {
    if (!showLastPrint) return CYBERPI_PANEL_HOLDS;
    const last = [...lines].reverse().find((line) => line.trim() !== '');
    return last === undefined ? CYBERPI_PANEL_HOLDS : `écran${NB}: «${NB}${last.trim()}${NB}»`;
  },
};

/** The restart of the simulator's first game, Fire Rescue (describeEvent's default in ../format.ts). */
const FIRST_GAME_RESTART: RestartFacts = { penalty: 5 };

/** describeEvent (../format.ts) in French: an event of the engine as a line of the console. */
function describeEvent(
  event: SimEvent,
  game: RestartFacts & { left?: number; match?: string; grabbed?: string; tableEdge?: string } = FIRST_GAME_RESTART,
): Omit<LogLine, 'n' | 'count'> | null {
  switch (event.type) {
    case 'log':
      // (a sentence of the engine or the interpreter: in French where it has a pattern; the referee's own lines are French already)
      return { time: event.time, level: event.level, text: frConsoleLine(event.text), blockId: event.blockId };
    case 'grab':
      return { time: event.time, level: 'event', text: `${game.grabbed ?? 'Picked up'} ${frBodyName(event.bodyId)}.` };
    case 'release':
      return {
        time: event.time,
        level: 'event',
        text: `Posé${NB}: ${frBodyName(event.bodyId)} ${event.onto ? `sur ${frBodyName(event.onto)}` : 'sur le tapis'}.`,
      };
    case 'bump':
      return { time: event.time, level: 'event', text: `Choc contre ${frBodyName(event.bodyId, game.tableEdge)}.` };
    case 'restart':
      return { time: event.time, level: 'warn', text: frRestartLine(game, game.left) };
    case 'finish':
      return { time: event.time, level: 'info', text: event.detail ? event.detail : `${frFinishText(event.reason)}\u00a0– le ${game.match ?? 'match'} est terminé.` };
    case 'tone':
      return null;
  }
}

export const FR_CONSOLE_TEXT: ConsoleText = {
  logLevels: { info: 'Info', event: 'Événement', warn: 'Attention', error: 'Erreur' },
  levelSeparator: `${NB}: `,
  consoleLabel: 'Console',
  consoleEmpty: 'Rien pour l’instant. Les messages et les problèmes de ton programme s’affichent ici pendant qu’il tourne.',
  showBlockHint: 'Montrer le bloc dont parle ce message',
  underlinedHint: `Lignes soulignées${NB}: clique pour voir le bloc.`,
  clearConsole: 'Effacer',
  startLine: (scenarioWord, code) => `C’est parti${NB}! ${capital(scenarioWord ?? 'disposition')} ${code}.`,
  noStartHat: `Rien ne va se passer${NB}: le programme n’a pas de bloc jaune «${NB}lorsque CyberPi démarre${NB}» pour commencer.`,
  nothingSnapped: `Rien ne va se passer${NB}: aucun bloc n’est encore accroché sous un bloc jaune «${NB}lorsque …${NB}» ou «${NB}quand …${NB}».`,
  // (a text bubble keeps a comma as it is: the robot reads « 30,5 » as no number - ../comma-texts.ts)
  commaTextWarning: (typed) =>
    `«${NB}${typed}${NB}» est un texte dans cette bulle, pas un nombre (seules les bulles de nombre lisent la virgule)${NB}: écris ${typed.replace(',', '.')}, avec un point.`,
  stoppedByYou: 'Tu as arrêté le programme. Appuie sur Démarrer pour recommencer.',
  matPictureFailed: `L’image du tapis n’a pas pu être chargée${NB}: les capteurs du sol lisent le dessin simplifié du tapis.`,
  describeEvent,
  bodyName: frBodyName,
  consoleLine: frConsoleLine,
};
