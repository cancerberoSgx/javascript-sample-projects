import { State } from './state'
import { AbstractStore } from './abstractStore'

class Store extends AbstractStore<State> {}

let store: Store

export function getStore() {
  return store
}

export function _setStore(s: State) {
  store = new Store(s)
}
