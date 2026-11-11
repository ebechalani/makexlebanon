/**
 * Member codes for the Fire Rescue simulator.
 *
 * The Intermediate and Advanced examples of the simulator open only with a member code
 * (FIRE-XXXX-XXXX). This file is the list of the codes that work. Read "Member codes for the
 * simulator examples" in README.md first.
 *
 * The codes themselves are NOT in this file, and must never be: this repository is public.
 * Each line holds the number of a code and its fingerprint - a row of letters and digits that
 * is worked out from the code, and from which the code cannot be read back. The codes are in
 * the CSV file that was written when they were made (No, Code, Given to). Keep that file
 * somewhere private, outside this folder.
 *
 * TO CANCEL ONE CODE: look up its number in your CSV file, find the line with that number
 * below (for code 37: "no: 37") and put two slashes in front of it:
 *
 *     // { no: 37, fingerprint: '...' },
 *
 * Deleting the line works too. Save, commit and push. Once Vercel has redeployed the site,
 * that code opens nothing any more, and a browser that had it saved locks the examples again
 * on its next visit. Take the two slashes away and the code works again.
 *
 * TO MAKE MORE CODES: never write lines by hand. Run
 *
 *     node scripts/generate-simulator-codes.mjs --count 50 --out ~/Documents/more-codes.csv
 *
 * It adds the new lines at the end, numbered on from the last one.
 */

export const simulatorCodes: { no: number; fingerprint: string }[] = [
  { no: 1, fingerprint: 'e7a10eb0857aabf1591717558712f6de8d13904abc294ed018fe098477a721cf' },
  { no: 2, fingerprint: '1d43ec56d6040197c1ef110bdc199174f4bcd3b9f32c05568dbbb09125652276' },
  { no: 3, fingerprint: '185b38a69e595ac7cde6df1333c83a94b16e03403b176f4ea73172b9c2eee415' },
  { no: 4, fingerprint: 'cc9c2ab54b1b84b514dfa76bb5cdb27f6b86191e9d962d9449b7c46181ca1984' },
  { no: 5, fingerprint: 'b0cc48338f48f4f641268569b5ed0d47b991fc0ef88bc0d29c1d84959c203af2' },
];

/**
 * The number the next new code gets. The script keeps it up to date so that a number is never
 * given out twice, even after lines were deleted. Leave it alone.
 */
export const nextSimulatorCodeNumber = 6;
