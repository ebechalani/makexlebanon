/**
 * The categories of their own: a category that belongs to no season of ./seasons.ts.
 *
 * Robot en fête 2027 is one (the organiser: "une catégorie seule robot en fête 2027", "à part, sa
 * propre fiche", "fiche en français"). Its simulators are French and named by their mission (the
 * organiser's choice): today « Tri d’entrepôt », the French version of the Warehouse Sort
 * simulator - the same beginner mission, all in French, the blocks included. (A second one,
 * « Logistique intelligente », is to come: it is one more item of `simulators`, and no page needs a
 * change for it.) The category has its own page (/robot-en-fete), a part of its own on the
 * Simulator page after the seasons, with a card for each of its simulators, and each simulator its
 * own page (/simulator/tri-entrepot) and a line in the Simulator dropdown of the menu.
 *
 * Nothing here is counted by a season: ./seasons.ts does not import this file, so no season page,
 * no count of categories and no list built from the seasons changes because of it. There is no
 * age group either (the organiser: "pas d'âge affiché").
 *
 * Every text a card or a page shows is here, in the category's language (`lang`), and every one
 * is required: nothing on its page or its cards falls back to English. Only the menu lines are
 * English, as the whole menu of the website is (the names in them are French proper names). (The
 * French texts are those of the design's table, fr-src/4-site.txt, with the review's corrections.
 * Typography: a no-break space (U+00A0) before : ; ! ?)
 *
 * Plain data that imports nothing: content/site.ts builds the menu from it, and the menu is drawn
 * by a client component, so what this file holds goes to every visitor's browser.
 */

/** A simulator of a category of its own: its card on the Simulator page, its part of the category's page, its line in the menu. */
export type StandaloneSimulator = {
  /** its name, the name of its mission, as its title row shows it: « Tri d’entrepôt » */
  name: string;
  /** the simulator's page on this site: /simulator/<slug> */
  href: string;
  /** the sentences of its card on the Simulator page, and of its part of the category's page */
  summary: string;
  /** picture of the simulator's mat for the Simulator page: a file under public/ */
  mat: string;
  /** the words of its card on the Simulator page */
  card: {
    /** the name of the card */
    heading: string;
    /** what the whole card does (it is one link): its name for a screen reader, and the button-like hint */
    open: string;
    /** what the picture shows */
    matAlt: string;
    /** the link to its category's page, under the card */
    about: string;
    /** the two small labels, where a category's card shows its age group and its season */
    labels: [string, string];
  };
  /** the heading of its part on the category's page */
  pageTitle: string;
  /**
   * its line in the Simulator dropdown of the menu, which is English: "<name> — <category>" (one
   * dash, as every line there). Both names are French proper names, written as they are.
   */
  menuLabel: string;
};

/** A category of its own, outside every season. */
export type StandaloneCategory = {
  /** its own page on this site: /<slug> */
  slug: string;
  /** its name, shown as it is (a proper name: also in the English menu and breadcrumbs) */
  name: string;
  /** the language of every text below but the simulators' `menuLabel`: lang="fr" wherever they are shown */
  lang: 'fr';
  /** the robot it is played with, e.g. mBot2 */
  platform: string;
  /** one or two sentences: the lead of its own page (and of nothing else) */
  summary: string;
  /** the words of its own page */
  page: {
    /** the title of the page in the browser's tab and in a search result */
    title: string;
    /** the description of the page for search engines and shares */
    description: string;
    /** the small line above the page's title */
    eyebrow: string;
    /** the small line above the part about each simulator */
    simulatorEyebrow: string;
    /** the button that opens a simulator */
    open: string;
  };
  /** its simulators, in the order the pages and the menu show them (one card, one part of its page and one menu line each) */
  simulators: StandaloneSimulator[];
};

/** A no-break space: French puts one before : ; ! ? (written out, so that it can be seen here) */
const NB = ' ';

export const standaloneCategories: StandaloneCategory[] = [
  {
    slug: 'robot-en-fete',
    name: 'Robot en fête 2027',
    lang: 'fr',
    platform: 'mBot2',
    summary:
      `La version française de Warehouse Sort${NB}: la même mission pour débutants, entièrement en français, blocs compris. ` +
      'Le robot trie des cubes rouges et verts, laisse le cube bleu à sa place, puis se gare.',
    page: {
      title: 'Robot en fête 2027',
      // (the first sentence of `summary`: the design's table gives this page no description of its own)
      description: `La version française de Warehouse Sort${NB}: la même mission pour débutants, entièrement en français, blocs compris.`,
      eyebrow: '2027',
      simulatorEyebrow: 'S’entraîner en ligne',
      open: 'Ouvrir le simulateur',
    },
    simulators: [
      {
        // (the French Warehouse Sort; its game keeps the id 'robot-en-fete': src/simulator/robot-en-fete/game.ts)
        name: 'Tri d’entrepôt',
        href: '/simulator/tri-entrepot',
        summary:
          `Construis un programme avec des blocs comme dans mBlock et regarde le mBot2 trier des cubes rouges et verts sur le tapis Inspire${NB}: ` +
          'des entrepôts vers la baie de leur couleur, en laissant le cube bleu à sa place, puis se garer sur une aire d’arrivée — ' +
          'avec toutes les dispositions des cubes, et le score que donnent les règles de la mission pour débutants. Tout est en français, les blocs aussi. ' +
          `Le simulateur fonctionne dans le navigateur${NB}: pas besoin de robot ni d’installation.`,
        // (the same mission on the same mat: the picture of Warehouse Sort, public/simulator/warehouse-sort/)
        mat: '/simulator/warehouse-sort/mat.webp',
        card: {
          heading: 'Simulateur Tri d’entrepôt',
          open: 'Ouvrir le simulateur Tri d’entrepôt',
          matAlt: 'Le tapis du simulateur Tri d’entrepôt, vu de dessus',
          about: 'À propos de Robot en fête 2027',
          // (no age group: the organiser asked for none; where a category shows its season, the robot)
          labels: ['En français', 'mBot2'],
        },
        pageTitle: 'Essaie le simulateur Tri d’entrepôt',
        // (a French proper name in the English menu, written as it is, then the category's: one dash, as every line there)
        menuLabel: 'Tri d’entrepôt — Robot en fête 2027',
      },
    ],
  },
];
