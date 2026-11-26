/**
 * The two forms of a French word that counts something: the first for 0 and 1 ("0 bloc",
 * "1 relance"), the second for everything above 1 ("2 blocs") - also for a number that is not
 * whole, such as 1,5 ("1,5 points").
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
export function frPlural(n: number, one: string, other: string): string {
  return Math.abs(n) <= 1 ? one : other;
}
