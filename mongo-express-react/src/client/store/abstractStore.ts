import { Emitter } from 'misc-utils-of-mine-generic';

export class AbstractStore<S> extends Emitter<{ oldState: S; partial: Partial<S>; newState: S; }> {
  constructor(protected state: S) {
    super();
  }

  setState(state: Partial<S>) {
    const oldState = this.state;
    this.state = { ...this.state, ...state };
    console.time('emit', this.)
    this.emit({ oldState, partial: state, newState: this.state });
    console.timeEnd('emit')

  }

  getState() {
    return this.state;
  }
}
