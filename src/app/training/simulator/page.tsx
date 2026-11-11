import { redirect } from 'next/navigation';

/**
 * /training/simulator has no page of its own yet: there is one simulator, so the address leads
 * straight to it. When a second category gets a simulator, replace this file with a small page
 * that lists them.
 */
export default function SimulatorIndexPage() {
  redirect('/training/simulator/fire-rescue');
}
