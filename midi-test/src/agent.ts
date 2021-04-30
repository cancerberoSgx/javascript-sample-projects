import { array } from "misc-utils-of-mine-generic"
import { Song } from "./types"
import { IWebAudioFontPlayer, Preset } from "./WebAudioFontPlayer"
import { Note, note, NOTES } from "./note"

abstract class Agent {
  volume = 1.0
  compassCount = 1
  /** pitch offset from this.song.cadence.dominant */
  pitchOffset = 0
  public constructor(public song: Song) { }
  abstract buildCompass(t0: number): Note[]
  buildCompassNotes(compassCount: number, compassStart = 0) {
    return array(Math.trunc(compassCount / this.compassCount))
      .map(i => this.buildCompass(i * this.compassCount * this.song.tempo.unit * this.song.tempo.compass + compassStart))
      .flat()
  }
  protected fixNote(n: Note, t0: number): any {
    return {
      ...n,
      t: n.t * this.song.tempo.unit + t0,
      volume: n.volume * this.volume,
      notes: n.notes.map(x => this.song.cadence.base + x + this.pitchOffset)
    }
  }
}

export class AgentPlayer {
  agents: Agent[] = []
  currentCompass=0
  constructor(public player: IWebAudioFontPlayer, public audioContext: AudioContext, public preset: Preset, public song: Song) { }
  playCompasses(compassCount: number, agents = this.agents) {
    agents
      .map(agent => agent.buildCompassNotes(compassCount))
      .flat()
      .forEach(n => {
        this.player.queueChord(this.audioContext, this.audioContext.destination, this.preset, n.t + this.currentCompass*this.song.tempo.compass*this.song.tempo.unit, n.notes, n.duration, n.volume)
      })
      this.currentCompass += compassCount
  }
}


export class Waltz2RightAgent extends Agent {
  compassCount = 2
  pitchOffset = 12
  volume: 0.6
  buildCompass(t0: number): Note[] {
    const { unit, compass } = this.song.tempo
    return [
      { t: 0, notes: [note(1)], volume: 1.0, duration: unit },
      { t: 1, notes: [note(2), note(5)], volume: 0.5, duration: unit * 0.5 },
      { t: 1.5, notes: [note(4)], volume: 0.8, duration: unit * 0.5 },
      { t: 2, notes: [note(4, -1)], volume: 0.8, duration: unit },
      { t: 3, notes: [note(5, -1)], volume: 1.0, duration: unit },
      { t: 4, notes: [note(2), note(5)], volume: 0.5, duration: unit },
      { t: 5, notes: [note(1, 1), note(3)], volume: 0.9, duration: unit },
    ].map(n => this.fixNote(n, t0))
  }
}

export class Waltz2LeftAgent extends Agent {
  compassCount = 2
  pitchOffset = -12;
  buildCompass(t0: number): Note[] {
    const { unit, compass } = this.song.tempo
    return [
      { t: 0, notes: [note(1)], volume: 1.0, duration: unit * compass },
      { t: 1, notes: [note(3), note(5)], volume: 0.5, duration: unit },
      { t: 2, notes: [note(3)], volume: 0.5, duration: unit },
      { t: 3, notes: [note(5, -1)], volume: 1.0, duration: unit * compass },
      { t: 4, notes: [note(3), note(5)], volume: 0.5, duration: unit },
      { t: 5, notes: [note(3), note(5)], volume: 0.9, duration: unit },
    ].map(n => this.fixNote(n, t0))
  }
}


export class Waltz1Agent extends Agent {
  buildCompass(t0: number): Note[] {
    const { unit, compass } = this.song.tempo
    return [
      { t: 0, notes: [NOTES[1]], volume: 1.0, duration: unit * compass },
      { t: 1, notes: [NOTES[5]], volume: 0.5, duration: unit },
      { t: 2, notes: [NOTES[3]], volume: 0.2, duration: unit },
    ].map(n => ({ ...n, t: n.t * unit + t0 }))
  }
}