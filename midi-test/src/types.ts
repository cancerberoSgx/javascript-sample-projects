export type Mode = 'major' | 'minor'

export interface Tempo {
	/** amount of units this compass has. Example: 3 == waltz, 2==polka */
	compass: number
	/** unit duration in seconds */
	unit: number
}

export interface Cadence {
	base: number
	mode: Mode
}

export interface CompassPlayer {
	// preset: Preset
	// play
}

export interface Song {
	tempo: Tempo
	cadence: Cadence
	compass: number

	// players: CompassPlayer[]
	// cadences: Cadence[]
}

export type TODO = any;