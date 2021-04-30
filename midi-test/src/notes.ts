import { Mode } from './types';

export function buildCadence(dominant: number, mode: Mode) {
	const d = dominant % 12;
	return [d, d + 2, d + 4, d + 5, d + 7, d + 9, d + 11].map(n => n % 12);
}

export function getNoteName(n: number) {
	const x = n % 12;
	return noteModules[x];
}

const noteModules = {
	0: 'b',
	1: 'c',
	2: 'd',
	3: 'd#',
	4: 'e',
	5: 'f',
	6: 'f#',
	7: 'g',
	8: 'g#',
	9: 'a',
	10: 'a#',
};
