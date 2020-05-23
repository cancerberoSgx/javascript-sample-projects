export type Mode = 'major' | 'minor'

export interface Tempo {
	/** amount of units this compass has. Example: 3 == waltz, 2==polka */
	compass: number
	/** unit duration in seconds */
	unit: number
}

export interface Cadence {
	dominant: number
	mode: Mode
}

export interface CompassPlayer {
	// preset: Preset
	// play
}

export interface Song {
	tempo: Tempo
	compass: number
	players: CompassPlayer[]
	cadences: Cadence[]
}

export type TODO = any;