/**
 * The French of the match: the controls, the status line, the score sheet and the test window
 * (./types.ts MatchText, BatchText). Part of the French word table (./fr.tsx).
 *
 * A sentence the English builds from several pieces of text is ONE French sentence here (design
 * 4.5): "Match en cours. 3 objectifs atteints sur 9." - French puts its words in another order.
 */
import type { BatchResult } from '../../core/batch';
import type { RestartFacts, TimeText } from '../format';
import type { RestartButtonWords } from '../match-words';
import type { ScreenWords } from '../screen-words';
import { EN_TEXT } from './en';
import { frFinishSentence, frFinishText, frNumber, frRestartNote, frRestartsLeftText, NB } from './fr-common';
import { frPlural } from './plural';
import type { BatchText, MatchText } from './types';

/** restartButton (../match-words.ts) in French: what the "Relance" button shows and says. */
function restartButton(facts: RestartFacts, left: number, match: string): RestartButtonWords {
  const max = facts.rules?.maxRestarts;
  const limited = max !== undefined;
  const remaining = limited ? (Number.isFinite(left) ? Math.max(0, Math.floor(left)) : Math.max(0, Math.floor(max))) : Infinity;

  if (limited && remaining === 0) {
    const allowance =
      max <= 0
        ? 'Ce jeu ne permet aucune relance.'
        : frPlural(
            max,
            `Plus de relance${NB}: ce jeu permet ${max} relance par ${match}, et elle a été utilisée.`,
            `Plus de relance${NB}: ce jeu permet ${max} relances par ${match}, et elles ont été utilisées.`,
          );
    return { badge: '0 restante', tone: 'none', allowed: false, hint: allowance };
  }

  let hint = `Relance (comme dans les règles)${NB}: le robot retourne dans la zone de départ, `;
  hint += facts.rules?.resetsBodies ? 'chaque élément du jeu est remis à sa place de départ, ' : 'ce qu’il porte retourne d’où il vient, ';
  hint += 'le chrono continue de tourner.';
  if (facts.rules?.clearsPoints) hint += ' Les points gagnés jusque-là sont effacés.';
  if (facts.penalty > 0) hint += ` Coûte ${facts.penalty} ${frPlural(facts.penalty, 'point', 'points')}.`;
  if (limited) {
    hint += frPlural(max, ` Ce jeu permet ${max} relance par ${match}${NB}: il en reste ${remaining}.`, ` Ce jeu permet ${max} relances par ${match}${NB}: il en reste ${remaining}.`);
  }

  if (limited) return { badge: frPlural(remaining, `${remaining} restante`, `${remaining} restantes`), tone: 'left', allowed: true, hint };
  return { badge: facts.penalty > 0 ? `-${facts.penalty}` : '', tone: 'cost', allowed: true, hint };
}

/** restartSummary (../match-words.ts) in French: what the restarts of this match have done so far. */
function restartSummary(restarts: number, facts: RestartFacts, left?: number): string {
  const count = Number.isFinite(restarts) ? Math.max(0, Math.floor(restarts)) : 0;
  if (count === 0) return '';
  const parts: string[] = [];
  if (facts.penalty > 0) {
    parts.push(frRestartNote(count, facts.penalty));
  } else {
    parts.push(`${frPlural(count, `${count} relance`, `${count} relances`)}${facts.rules?.clearsPoints ? `${NB}: points effacés` : ''}`);
  }
  if (facts.penalty > 0 && facts.rules?.clearsPoints) parts.push('points effacés');
  const remaining = frRestartsLeftText(facts, left);
  if (remaining) parts.push(remaining.charAt(0).toLowerCase() + remaining.slice(1));
  return parts.join(', ');
}

/**
 * finishHeadline (../match-words.ts) in French: the first statement of the referee's sentence. It
 * ends at the first end of a sentence or at the first colon followed by a blank - and a French
 * colon has a no-break space before it, which is left out with the colon.
 */
function finishHeadline(detail: string): string {
  const own = detail.trim();
  const end = /[.!?](?=\s|$)|:(?=\s)/.exec(own);
  if (!end) return own === '' ? '' : `${own}.`;
  const head = own.slice(0, end.index);
  return end[0] === ':' ? `${head.trimEnd()}.` : `${head}${end[0]}`;
}

export const FR_MATCH_TEXT: MatchText = {
  // (a speed is a number of the screen: "0,5×")
  speedLabel: (speed) => (speed === 'max' ? 'Max' : `${frNumber(speed, Number.isInteger(speed) ? 0 : 1)}×`),
  speedWord: 'Vitesse',
  speedGroup: 'Vitesse de la simulation',
  speedHint: (match) => `Vitesse de la simulation (le chrono du ${match} va à la même vitesse)`,
  startHint: (over) =>
    over
      ? `Recommencer${NB}: le terrain est remis en place, le chrono repart du début et ton programme reprend à son premier bloc`
      : `Le signal de départ de l’arbitre${NB}: le terrain est remis en place et ton programme commence au début`,
  start: 'Démarrer',
  stopHint: (match) => `Arrêter le programme et le robot là où ils sont. Le ${match} ne compte pas${NB}; Remettre en place remet tout comme au début.`,
  stop: 'Arrêter',
  resume: 'Reprendre',
  pause: 'Pause',
  pauseHint: (match) => `Pause (le chrono du ${match} s’arrête aussi)`,
  clockLabel: (match, left) => `Chrono du ${match}${NB}: il reste ${left}`,
  timeWord: 'Temps',
  scoreLabel: (total, max) => `Score${NB}: ${total} points sur ${max}`,
  scoreWord: 'Score',
  restartWord: 'Relance',
  finishedWord: 'Terminé',
  resetLabel: 'Remettre en place',
  resetHint: (resetHint, match) => `${resetHint} Marche à tout moment, aussi pendant un ${match}.`,
  resetWord: 'Remettre',
  resetFieldWord: 'en place',
  restartButton,
  restartSummary,
  finishSentence: frFinishSentence,
  finishHeadline,
  finishText: frFinishText,

  markNames: { done: 'fait', 'not-done': 'pas fait', penalty: 'pénalité', note: 'remarque' },
  lineEarnedHint: 'Le temps au chrono quand cette ligne a été gagnée',
  earnedAt: 'gagné à ',
  howEnded: (match) => `Fin du ${match}${NB}: `,
  total: 'Total',
  scoreTimeNote: 'Temps de ce score - à points égaux, les règles classent devant le temps le plus court',
  statusRunning: (Match, done, total, _goals, penalty) => (
    <>
      <span className="font-bold">{`${Match} en cours.`}</span> {frPlural(done, `${done} objectif atteint sur ${total}.`, `${done} objectifs atteints sur ${total}.`)}
      {penalty}
    </>
  ),
  statusRunningNow: (Match, now, penalty) => (
    <>
      <span className="font-bold">{`${Match} en cours.`}</span> {now}
      {penalty}
    </>
  ),
  statusPaused: (time, match) => (
    <>
      <span className="font-bold">En pause</span> {`à ${time}. Le chrono du ${match} est aussi en pause.`}
    </>
  ),
  statusStopped: (time, points) => (
    <>
      <span className="font-bold">Tu as arrêté le match</span> {`à ${time} - pas de score final (pour l’instant `}
      {points}
      {'). Démarrer recommence, Remettre en place remet le terrain.'}
    </>
  ),
  statusOver: (o, points) => (
    <>
      <span className="font-bold">{`${o.Match} terminé.`}</span>{' '}
      {o.ending !== null ? `${o.ending} Score final${NB}: ` : `${o.reason} à ${o.time}. Score final${NB}: `}
      {points}
      {o.perfect ? ` - un parcours parfait${NB}!` : o.complete ? ` - tous les ${o.goals} atteints.` : ''}
      {o.penaltyNote && ` (${o.penaltyNote})`}
    </>
  ),
  statusOverText: (o) =>
    `${o.Match} terminé. ` +
    (o.ending !== null ? `${o.ending} Score final${NB}: ` : `${o.reason} à ${o.time}. Score final${NB}: `) +
    `${o.total} / ${o.max}` +
    (o.perfect ? ` - un parcours parfait${NB}!` : o.complete ? ` - tous les ${o.goals} atteints.` : '') +
    (o.penaltyNote ? ` (${o.penaltyNote})` : ''),
  scoreSheetSummary: (score: { total: number; max: number }, done: number, of: number, words: ScreenWords) =>
    `${score.total} / ${score.max} points · ${words.goalsShort ?? words.goals}${NB}: ${done} sur ${of}`,
};

/** endSentence (../batch-words.ts) in French: how a run ended, and the restarts it used. */
function endSentence(result: Pick<BatchResult, 'finishReason' | 'finishDetail' | 'time' | 'restarts'>, timeText: TimeText): string {
  const sentence = frFinishSentence(result.finishReason, result.finishDetail, result.time, timeText);
  if (!(result.restarts > 0)) return sentence;
  return frPlural(result.restarts, `${sentence} ${result.restarts} relance utilisée.`, `${sentence} ${result.restarts} relances utilisées.`);
}

export const FR_BATCH_TEXT: BatchText = {
  batchNothingToTest: (scenario) => `Il n’y a aucune ${scenario} à tester.`,
  batchStopped: (message) => `Le test s’est arrêté${NB}: ${message}`,
  batchAt: (time, tileWords) => `${tileWords ?? 'à'} ${time}`,
  whichScenarios: (scenarios) => `Quelles ${scenarios}${NB}?`,
  // (not on this page: Robot en fête plays every arrangement, it offers no random lists - batchRandomLists={false})
  randomListName: EN_TEXT.randomListName,
  randomCountHint: EN_TEXT.randomCountHint,
  kindOfRandom: EN_TEXT.kindOfRandom,
  seedHint: EN_TEXT.seedHint,
  seed: EN_TEXT.seed,
  anotherSeed: EN_TEXT.anotherSeed,
  anotherSeedHint: EN_TEXT.anotherSeedHint,
  cancel: 'Annuler',
  runTest: 'Lancer le test',
  runAgain: 'Refaire le test',
  testProgress: 'Avancement du test',
  testStoppedNote: ' (arrêté)',
  averageScoreLabel: 'Score moyen',
  ofPoints: (max) => `sur ${max} points`,
  bestRun: 'Meilleur essai',
  worstRun: 'Moins bon essai',
  everyGoal: (_goal, goals) => `Tous les ${goals} atteints`,
  runsCount: (complete, runs) => frPlural(complete, `${complete} essai sur ${runs}`, `${complete} essais sur ${runs}`),
  programProblem: `Le programme a un problème${NB}:`,
  moreProblems: (more) => frPlural(more, ` (et ${more} autre)`, ` (et ${more} autres)`),
  lineSuccessTitle: 'Combien de fois chaque ligne de la feuille de score réussit',
  lineSuccessHint: (name, percent) => `${name}${NB}: ${percent} des essais`,
  cleanLineName: (cleanLine, name) => `${cleanLine}${NB}: ${name.toLowerCase()}`,
  everyRun: 'Tous les essais',
  worstFirst: 'Les moins bons d’abord',
  scoreColumn: 'Score',
  // (not on this page: Robot en fête shows its own column, "Dernière livraison" - batchTieBreak)
  pointsTimeHint: EN_TEXT.pointsTimeHint,
  pointsTime: EN_TEXT.pointsTime,
  howItEnded: 'Comment ça s’est fini',
  timeColumn: 'Temps',
  endedColumn: 'Fin',
  watch: 'Regarder',
  noPoints: 'aucun point',
  runRestarts: (restarts) => frPlural(restarts, `, ${restarts} relance`, `, ${restarts} relances`),
  watchLabel: (scenario, code) => `Regarder la ${scenario} ${code} sur la scène`,
  endSentence,
  // (no words in it: the time as the game writes it, or a dash)
  scoreTimeText: EN_TEXT.scoreTimeText,
};
