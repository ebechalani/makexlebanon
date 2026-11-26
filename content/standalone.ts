/**
 * The categories of their own: a category that belongs to no season of ./seasons.ts.
 *
 * Robot en fête 2027 is one (the organiser: "une catégorie seule robot en fête 2027", "à part, sa
 * propre fiche", "fiche en français"): the French version of the Warehouse Sort simulator - the
 * same beginner mission, all in French, the blocks included. It has its own page (/robot-en-fete),
 * its own simulator (/simulator/robot-en-fete), a part of its own on the Simulator page after the
 * seasons, and a line in the Simulator dropdown of the menu.
 *
 * Nothing here is counted by a season: ./seasons.ts does not import this file, so no season page,
 * no count of categories and no list built from the seasons changes because of it. There is no
 * age group either (the organiser: "pas d'âge affiché").
 *
 * Every text a card or a page shows is here, in the category's language (`lang`), and every one
 * is required: nothing on its page or its card falls back to English. Only the menu line is
 * English, as the whole menu of the website is. (The French texts are those of the design's table,
 * fr-src/4-site.txt. Typography: a no-break space (U+00A0) before : ; ! ?)
 *
 * Plain data that imports nothing: content/site.ts builds the menu from it, and the menu is drawn
 * by a client component, so what this file holds goes to every visitor's browser.
 */

/** A category of its own, outside every season. */
export type StandaloneCategory = {
  /** its own page on this site: /<slug> */
  slug: string;
  /** its name, shown as it is (a proper name: also in the English menu and breadcrumbs) */
  name: string;
  /** the language of every text below but `simulator.menuLabel`: lang="fr" wherever they are shown */
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
    /** the small line above the part about the simulator */
    simulatorEyebrow: string;
    /** the heading of the part about the simulator */
    simulatorTitle: string;
    /** the button that opens the simulator */
    open: string;
  };
  simulator: {
    /** the simulator's page on this site: /simulator/<slug> */
    href: string;
    /** the sentences of its card on the Simulator page, and of the part about the simulator on its own page */
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
      /** the link to its own page, under the card */
      about: string;
      /** the two small labels, where a category's card shows its age group and its season */
      labels: [string, string];
    };
    /** its line in the Simulator dropdown of the menu, which is English: "<name> — in French" (one dash, as every line there) */
    menuLabel: string;
  };
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
      simulatorTitle: 'Essaie le simulateur Robot en fête 2027',
      open: 'Ouvrir le simulateur',
    },
    simulator: {
      href: '/simulator/robot-en-fete',
      summary:
        `Construis un programme avec des blocs comme dans mBlock et regarde le mBot2 trier des cubes rouges et verts sur le tapis Inspire${NB}: ` +
        'des entrepôts vers la baie de leur couleur, en laissant le cube bleu à sa place, puis se garer sur une aire d’arrivée — ' +
        'avec toutes les dispositions des cubes, notées selon les règles de la mission pour débutants. Tout est en français, les blocs aussi. ' +
        `Il marche dans le navigateur${NB}: pas besoin de robot ni d’installation.`,
      // (the same mission on the same mat: the picture of Warehouse Sort, public/simulator/warehouse-sort/)
      mat: '/simulator/warehouse-sort/mat.webp',
      card: {
        heading: 'Simulateur Robot en fête 2027',
        open: 'Ouvrir le simulateur Robot en fête 2027',
        matAlt: 'Le tapis du simulateur Robot en fête 2027, vu de dessus',
        about: 'À propos de Robot en fête 2027',
        // (no age group: the organiser asked for none; where a category shows its season, the robot)
        labels: ['En français', 'mBot2'],
      },
      menuLabel: 'Robot en fête 2027 — in French',
    },
  },
];
