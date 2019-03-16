import { printMs } from 'jsx-alone-core';
import { AnyAction, Store } from 'redux';
import { compiledActions, COMPILED_ACTION } from './compiled';
import { editorActions, EDITOR_ACTION } from './editor';
import { JSXColorsActions, JSX_COLORS_ACTIONS } from './jsxColors';
import { optionsActions, OPTIONS_ACTIONS } from './options';
import { ChangeThemeAction } from './theme';
import { State } from './types';

export type ActionForType<T extends AllActions['type']> = AllActions extends infer R ? R extends AllActions ? T extends R['type'] ? R : never : never : never

let _store: Store<State, AnyAction>
const storePromise = new Promise<Store>(resolve => {
  getStorePromiseResolve = resolve
})

let getStorePromiseResolve: (s: Store) => void

export function setStore(s: Store) {
  _store = s
  lastState = s.getState()
  getStorePromiseResolve(s)
}

export async function getState(): Promise<State> {
  const store = await storePromise
  return lastState || store.getState()
}

let lastState: State

export function dispatch(action: AllActions) {
  if(!shouldBeDispatched(action, lastState)) {
    console.log('** dispatch skipping  '+action.type+' because shouldBeDispatched is false');
    return
  }
  const t0 = Date.now()
  setTimeout(() => {
    _store.dispatch(action)
    setTimeout(() => {
      console.log(`** dispatch action ${action.type} took ${printMs(Date.now() - t0)}`);
      lastState = _store.getState()
    }, 0);
  }, 0);
}

/** For performance reasons, depending on current state some actions shouldnt be dispatched */
function shouldBeDispatched(action: AllActions, state: State) {
  if(action.type === EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION){
    return EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION && state.options.selectedExplorer === 'jsAst' && state.compiled.explorer && !state.compiled.explorer!.disableEditorBind
  }
  // else if(action.type === OPTIONS_ACTIONS.SET_WORKING){
  //   return action.payload.working !== state.options.working
  // }
  // else if (action.type ===EDITOR_ACTION.EDITOR_MODEL_CHANGED) {
  //   return state.options.autoApply
  // }
  // else if (action.type ===COMPILED_ACTION.FETCH_COMPILED) {
  //   // never compile
  //   return state.options.autoApply
  // }
  else if (action.type=== JSX_COLORS_ACTIONS.APPLY_SKIN_STYLES) {
    return state.options.autoApply
  }
  // else if(action.type===COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS) {
  //   return action.payload.showDetailsOf ? 
  // }
  else {
    return true
  }
}

export type AllActions = editorActions | optionsActions | ChangeThemeAction | compiledActions | JSXColorsActions



// store.subscribe(() => {
//   const state = store.getState()
//   if (stateChanged(state)) {
//     setTimeout(() => {
//       main.onStateUpdate(state)
//     }, 0)
//   }
//   else {
//     console.log('THE SAME')
//   }
// })

// let lastState: State

// function stateChanged(state: State) {
//   if (lastState && lastState === state) {
//     return false
//   }
//   else {
//     lastState = state
//     return true
//   }
// }

// }

// export function onStoreStarted(l: (s: State) => void) {
//   onStoreStartedListeners.push(l)
// }

// const onStoreStartedListeners: ((s: State) => void)[] = []

// const onAfterActionDispatchListeners: { listener: OnActionDispatchListener, type: any }[] = []

// export function onAfterActionDispatch<T extends AllActions['type']>(type: T, listener: OnActionDispatchListener<T>) {
//   onAfterActionDispatchListeners.push({ type, listener })
// }
// type OnActionDispatchListener<T extends AllActions['type']= AllActions['type']> = (action: ActionForType<T>, state: State) => void

// const onBeforeActionDispatchListeners: { listener: OnActionDispatchListener, type: any }[] = []

// export function onBeforeActionDispatch<T extends AllActions['type']>(type: T, listener: OnActionDispatchListener<T>) {
//   onBeforeActionDispatchListeners.push({ type, listener })
// }
