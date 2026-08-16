import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Button, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Smart Logistics training',
  description:
    'Field setup, sensor calibration and scoring strategy for the MakeX Inspire Smart Logistics category.',
};

/**
 * Training detail page.
 * Replace the placeholder hints below with the real guidance, or copy this
 * file to add a page for another track (remember to set `href` in
 * content/seasons.ts -> trainingTracks).
 */
const hints: { heading: string; points: string[] }[] = [
  {
    heading: 'Before the match',
    points: [
      'Charge the mBot2 fully and keep a spare battery on the bench.',
      'Re-calibrate the colour sensor on the actual competition mat, under venue lighting — not on the practice mat at school.',
      'Measure and note the starting position precisely so it can be reproduced every round.',
    ],
  },
  {
    heading: 'Driving and navigation',
    points: [
      'Prefer line following over dead reckoning for long runs; wheel slip accumulates quickly.',
      'Use short, verified movements between stations rather than one long uninterrupted route.',
      'Add a brief pause before each pick-up so the robot settles before the gripper closes.',
    ],
  },
  {
    heading: 'Scoring strategy',
    points: [
      'Secure the guaranteed points first, then attempt the higher-risk missions with the time left.',
      'Practise the full run against a timer, not just individual missions.',
      'Agree in advance which mission the team drops if the robot falls behind schedule.',
    ],
  },
];

export default function SmartLogisticsTrainingPage() {
  return (
    <>
      <PageHero
        eyebrow="Training · Ages 7–12"
        title="Inspire — Smart Logistics"
        lead="Field setup, sensor calibration and scoring strategy for the logistics category."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Training', href: '/training' },
          { label: 'Smart Logistics' },
        ]}
      />

      <Section>
        <SectionHeading eyebrow="Hints" title="Mentor and team guidance" />

        <div className="mt-12 space-y-12">
          {hints.map((group) => (
            <div key={group.heading}>
              <h3 className="text-xl text-ink-900">{group.heading}</h3>
              <ul className="mt-4 space-y-3">
                {group.points.map((point) => (
                  <li key={point} className="flex gap-3 text-ink-600">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed text-pretty">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button href="/season/2026/smart-logistics" variant="secondary">
            Category rules &amp; downloads
          </Button>
          <Button href="/training" variant="secondary">
            All training tracks
          </Button>
        </div>
      </Section>
    </>
  );
}
