import { Action, Reducer } from 'redux'
import { all, call, put, select, takeEvery } from 'redux-saga/effects'
import { examples } from '../examples/examples'
import { getMonacoInstance } from '../monaco/monaco'
import { COMPILED_ACTION, FetchCompiledAction } from './compiled'
import { OPTIONS_ACTIONS } from './options'
import { Editor, State, EditorCursorPosition } from './types'

const initialState = {
  code: examples[0].code,
  version: -1
}

export enum EDITOR_ACTION {
  REQUEST_CODE_CHANGE = 'REQUEST_CODE_CHANGE',
  EDITOR_MODEL_CHANGED = 'EDITOR_MODEL_CHANGED',
  EDITOR_CHANGED_CURSOR_POSITION = 'EDITOR_CHANGED_CURSOR_POSITION'
}

export const changeCode: Reducer<Editor, RequestCodeChangeAction | EditorModelChangedAction|EditorChangedCursorPositionAction> = (state = initialState, action) => {
  switch (action.type) {
    case EDITOR_ACTION.REQUEST_CODE_CHANGE:
      return { ...state, ...action.payload }
    case EDITOR_ACTION.EDITOR_MODEL_CHANGED:
      return { ...state, ...action.payload }
      case EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION:
        return { ...state, cursorPosition: action.payload}
    default:
      return state
  }
}

export interface RequestCodeChangeAction extends Action<EDITOR_ACTION.REQUEST_CODE_CHANGE> {
  type: EDITOR_ACTION.REQUEST_CODE_CHANGE
  payload: {
    code: string
  }
}

export interface EditorModelChangedAction extends Action<EDITOR_ACTION.EDITOR_MODEL_CHANGED> {
  type: EDITOR_ACTION.EDITOR_MODEL_CHANGED
  payload: {
    code: string
    version: number
  }
}
export interface EditorChangedCursorPositionAction extends Action<EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION> {
  type: EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION
  payload: EditorCursorPosition
}

export type editorActions = RequestCodeChangeAction|EditorModelChangedAction|EditorChangedCursorPositionAction

function* watchEditorModelChanged() {
  yield takeEvery(EDITOR_ACTION.EDITOR_MODEL_CHANGED,
    function* editorModelChanged(action: RequestCodeChangeAction) {
      const state: State = yield select()
      if (state.options.autoApply) {
        const a: FetchCompiledAction = {
          type: COMPILED_ACTION.FETCH_COMPILED,
          payload: {
            request:
            {
              ...action.payload
            }
          }
        }
        yield put(a)
      }
    })
}

function* watchRequestEditorChange() {
  yield takeEvery(EDITOR_ACTION.REQUEST_CODE_CHANGE,
    function* requestEditorChange(action: RequestCodeChangeAction) {
      yield put({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: true } })
      yield call(() => getMonacoInstance()!.getModel()!.setValue(action.payload.code))
    }
  )
}

export function* editorSagas() {
  yield all([
    watchRequestEditorChange(), watchEditorModelChanged()
  ])
}
