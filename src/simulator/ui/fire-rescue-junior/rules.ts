/**
 * The Fire Rescue Junior rules in a few short bullets, for the "Rules" button of its simulator.
 *
 * Fire Rescue Junior (ages 10-12) is played on the Fire Rescue field by the Fire Rescue rules.
 * The organiser decided one difference: "the water buckets will be randomised position,
 * everything else at its place". So only the first section, "The field", is its own: it says
 * what is drawn (the buckets on W1 to W4, 24 draws) and that everything else stands where the
 * rule book shows it. The other sections are those of Fire Rescue Senior, word for word
 * (../fire-rescue/rules.ts: FIRE_RESCUE_SCORING_RULES).
 *
 * (The referee itself lives in ../../fire-rescue/game.ts; this is only the summary students read.)
 */
import { FIRE_RESCUE_SCORING_RULES } from '../fire-rescue/rules';
import type { RulesSection } from '../SimulatorApp';

export const FIRE_RESCUE_JUNIOR_RULES: RulesSection[] = [
  {
    title: 'The field',
    items: [
      'The mat is 1250 x 1250 mm. The robot starts completely inside the Fire Station with nothing loaded, and runs on its own for 3 minutes.',
      'Four water towers (W1 to W4) each hold one coloured bucket. Four rescue towers (RG, RY, RB, RR) stand on their coloured squares in the two safe zones and start empty.',
      'One person waits at each building, always in the left white dashed square (square 1): red at A, blue at B, yellow at C, green at D. The right square (2) of each building is its water square.',
      'Before the match the referee draws only which bucket stands on which water tower: there are 24 possible draws. Everything else always stands where the rule book shows it, as the organiser decided for Fire Rescue Junior.',
    ],
  },
  ...FIRE_RESCUE_SCORING_RULES,
];
