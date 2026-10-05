import type { Space } from "./types";

/**
 * Every legal landing space for a roll of `steps` from `from` (MOV-1..3, FRK-1).
 * Moves exactly `steps` spaces along `next` edges. Reaching a space with no next
 * (the linear 'finish') ends the move early (MOV-2).
 *
 * Returns destination index -> one path that reaches it (excluding `from`).
 * If several paths reach the same space, the first one found is kept. Only the
 * landing space has an effect (MOV-4), so which path was taken doesn't matter.
 */
export function legalDestinations(spaces: Space[], from: number, steps: number): Record<number, number[]> {
  const byIndex = new Map(spaces.map((s) => [s.index, s]));
  const result: Record<number, number[]> = {};

  let frontier: { at: number; path: number[] }[] = [{ at: from, path: [] }];
  for (let step = 0; step < steps && frontier.length; step++) {
    const nextFrontier: typeof frontier = [];
    const seenThisStep = new Set<number>();
    for (const { at, path } of frontier) {
      const space = byIndex.get(at)!;
      if (space.next.length === 0) {
        // Stopped early on the finish space
        result[at] ??= path;
        continue;
      }
      for (const n of space.next) {
        if (seenThisStep.has(n)) continue;
        seenThisStep.add(n);
        nextFrontier.push({ at: n, path: [...path, n] });
      }
    }
    frontier = nextFrontier;
  }
  for (const { at, path } of frontier) result[at] ??= path;
  return result;
}
