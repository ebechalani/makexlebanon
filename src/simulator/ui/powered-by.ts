/**
 * Who the simulator is powered by: a name, the same on every page and in every language. Shown on
 * every simulator page of the seasons (../TitleBar.tsx), also while it loads, and on the Simulator
 * page. (A category of its own names its own: Robot en fête 2027, content/standalone.ts `poweredBy`.)
 *
 * A plain file that imports nothing: the Simulator page (a Server Component) can name the academy
 * without bringing the title row's client code (./text/title-context.tsx) onto its page.
 */
export const POWERED_BY = 'RoboHolic Robotics Academy';
