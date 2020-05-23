export function note(n: number, octave = 0) {
  return NOTES[n] + (octave * 12);
}
export interface Note {
  t: number;
  notes: number[];
  volume: number;
  duration: number;
}
export const NOTES = [0, 0, 2, 4, 5, 7, 9, 11];
