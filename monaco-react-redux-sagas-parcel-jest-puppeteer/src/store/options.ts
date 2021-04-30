import { Action, Reducer } from 'redux'
import { isMobile } from '../util/media'
import { ExplorerName, Options } from './types'
import { dispatch, getState } from './store';
import { takeEvery, all } from 'redux-saga/effects';
import { COMPILED_ACTION, FetchCompiledAction } from './compiled';
import { EDITOR_ACTION, RequestCodeChangeAction } from './editor';

const initialState: Options = {
  logs: [],
  autoApply: true,
  selectedExplorer: isMobile() ? 'editor' : 'elements',
  working: false
}

export enum OPTIONS_ACTIONS {
  PUSH_LOG = 'OPTIONS_ACTIONS_PUSH_LOG',
  CHANGE_AUTO_APPLY = 'OPTIONS_ACTIONS_CHANGE_AUTO_APPLY',
  SELECT_EXPLORER = 'OPTIONS_ACTIONS_SELECT_EXPLORER',
  SET_WORKING = 'OPTIONS_ACTIONS_SET_WORKING',
  CHANGE_OTHER_OPTIONS = 'OPTIONS_ACTIONS_CHANGE_OTHER_OPTIONS',
}

export const optionsReducer: Reducer<Options, optionsActions> = (state = initialState, action) => {

  switch (action.type) {
    case OPTIONS_ACTIONS.PUSH_LOG:
      return { ...state, logs: [...state.logs, action.payload.log] }
    case OPTIONS_ACTIONS.CHANGE_AUTO_APPLY:
      return { ...state, autoApply: action.payload.autoApply }
    case OPTIONS_ACTIONS.CHANGE_OTHER_OPTIONS:
      return { ...state, ...action.payload }
    case OPTIONS_ACTIONS.SELECT_EXPLORER:
      return { ...state, selectedExplorer: action.payload.selectedExplorer }
    case OPTIONS_ACTIONS.SET_WORKING:
      // TODO: to be faster we do this hack:
      if (action.payload.working) {
        document.body.classList.add('working')
      }
      else {
        document.body.classList.remove('working')
      }
      return state
    // return { ...state, working: action.payload.working }
    default:
      return state
  }
}

interface PushLogAction extends Action<OPTIONS_ACTIONS.PUSH_LOG> {
  type: OPTIONS_ACTIONS.PUSH_LOG,
  payload: { log: string }
}

export interface ChangeAutoApply extends Action<OPTIONS_ACTIONS.CHANGE_AUTO_APPLY> {
  type: OPTIONS_ACTIONS.CHANGE_AUTO_APPLY,
  payload: { autoApply: boolean }
}

export interface ChangeOtherOptionsAction extends Action<OPTIONS_ACTIONS.CHANGE_OTHER_OPTIONS> {
  type: OPTIONS_ACTIONS.CHANGE_OTHER_OPTIONS,
  payload: { updateTimeout?: number }
}
export interface SelectExplorer extends Action<OPTIONS_ACTIONS.SELECT_EXPLORER> {
  type: OPTIONS_ACTIONS.SELECT_EXPLORER,
  payload: { selectedExplorer: ExplorerName }
}

export interface SetWorking extends Action<OPTIONS_ACTIONS.SET_WORKING> {
  type: OPTIONS_ACTIONS.SET_WORKING,
  payload: { working: boolean }
}

export type optionsActions = PushLogAction | ChangeAutoApply | ChangeOtherOptionsAction | SelectExplorer | SetWorking


function* watchSelectExplorerChange() {
  // when explorer change we force a re-compilation because some explorers  might never received their data
  yield takeEvery(OPTIONS_ACTIONS.SELECT_EXPLORER,
    function* (action: SelectExplorer) {
      yield getState().then(state=>{
        dispatch({ type: COMPILED_ACTION.FETCH_COMPILED, payload: {request: state.compiled.request}})
      })
    }
  )
}

function* watchEditorModelChangedForAutoAApply() {
  // if autoApply we compile each time the model changes. we have this logic only here (not in store shouldBeDispatched for ex)
  yield takeEvery(EDITOR_ACTION.EDITOR_MODEL_CHANGED,
    function* (action: RequestCodeChangeAction) {
      yield getState().then(state => {
        if (state.options.autoApply) {
        dispatch( {
          type: COMPILED_ACTION.FETCH_COMPILED,
          payload: {            request:            {              ...action.payload            }          }        })
        }
      })
    })
}
export function* optionsSagas() {
  yield all([
    watchSelectExplorerChange(), watchEditorModelChangedForAutoAApply()
  ])
}

