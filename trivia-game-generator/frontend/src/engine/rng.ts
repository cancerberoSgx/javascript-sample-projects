// Seedable PRNG (mulberry32). Its state is a plain number kept inside GameState,
// so the engine stays pure and replays are deterministic (DIE-2, INV-5).

export function nextRandom(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function randomInt(state: number, min: number, max: number): [value: number, next: number] {
  const [r, next] = nextRandom(state);
  return [min + Math.floor(r * (max - min + 1)), next];
}

export function shuffle<T>(items: T[], state: number): [result: T[], next: number] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = randomInt(s, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}
