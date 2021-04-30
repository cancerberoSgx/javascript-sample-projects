import {TODO} from './types'

export type Preset = {
	zones: Zone[];
};


export type Zone = {
  midi: number;
  originalPitch: number;
  keyRangeLow: number;
  keyRangeHigh: number;
  loopStart: number;
  loopEnd: number;
  coarseTune: number;
  fineTune: number;
  sampleRate: number;
  ahdsr: boolean;
  sample: string;
}

export interface IWebAudioFontPlayer {
  loader: WebAudioFontLoader;
	/**
	 *
	 * @param audioContext
	 * @param destination  node to connect to, for example audioContext.destination
	 * @param preset variable with the instrument preset
	 * @param when when to play, audioContext.currentTime or 0 to play now, audioContext.currentTime + 3 to play after 3 seconds
	 * @param pitch note pitch from 0 to 127, for example 2+12*4 to play D of fourth octave (use MIDI key for drums)
	 * @param duration note duration in seconds, for example 4 to play 4 seconds
	 * @param volume 0.0 <=1.0 volume (0 is ‘no value’, ‘no value’ is 1)
	 * @param slides array of pitch bends
	 */
  queueWaveTable(audioContext: AudioContext, destination: AudioDestinationNode, preset: Preset, when: number, pitch: number, duration: number, volume?: number, slides?: TODO)

  queueSnap(audioContext: AudioContext, target: AudioDestinationNode, preset: Preset, when: number, pitches: number[], duration: number, volume?: number, slides?: TODO)
  queueStrum(audioContext: AudioContext, target: AudioDestinationNode, preset: Preset, when: number, pitches: number[], duration: number, volume?: number, slides?: TODO)
  queueStrumDown(audioContext: AudioContext, target: AudioDestinationNode, preset: Preset, when: number, pitches: number[], duration: number, volume?: number, slides?: TODO)
  queueStrumUp(audioContext: AudioContext, target: AudioDestinationNode, preset: Preset, when: number, pitches: number[], duration: number, volume?: number, slides?: TODO)
  queueChord(audioContext: AudioContext, target: AudioDestinationNode, preset: Preset, when: number, pitches: number[], duration: number, volume?: number, slides?: TODO)

  limitVolume(volume)

  createReverberator(audioContext): WebAudioFontReverberator
  createChannel(audioContext):  WebAudioFontChannel

  adjustPreset (audioContext, preset)
  adjustZone(audioContext, zone)
  findZone (audioContext, preset, pitch): Zone
  cancelQueue(audioContext)
  findEnvelope(audioContext, target, when, duration)
  setupEnvelope(audioContext, envelope, zone, volume, when, sampleDuration, noteDuration)

}

export interface WebAudioFontLoader {
}

export interface WebAudioFontReverberator {

}
export interface WebAudioFontChannel {

}

// console.log(1, WebAudioFontPlayer);
// const __WebAudioFontPlayer = WebAudioFontPlayer

declare var WebAudioFontPlayer: {
  prototype: IWebAudioFontPlayer;
  new(): IWebAudioFontPlayer;
};

// console.log(2, WebAudioFontPlayer);
export const Player = WebAudioFontPlayer
// export {WebAudioFontPlayer}