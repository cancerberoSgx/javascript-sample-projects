import { all as merge } from 'deepmerge'
import { Action, Reducer } from 'redux'
import { all, call, put, select, takeEvery } from 'redux-saga/effects'
import { requestCodeCompile } from '../codeWorker/codeWorkerManager'
import { dispatchSyntaxHighlight } from '../monaco/jsxSyntaxHighlight'
import { OPTIONS_ACTIONS } from './options'
import { CodeWorkerError, CodeWorkerRequest, CodeWorkerResponse, Compiled, EditorCursorPosition, State, CodeWorkerResponseJsxAsNode, CompiledExplorerOptions } from './types'
import { EDITOR_ACTION, EditorChangedCursorPositionAction } from './editor';

const initialState: Compiled = {
  request: {
    jsxAst: {
      mode: 'forEachChild'
    },
    code: '',
    title: 'main.tsx',
    version: -1
  }
}

export enum COMPILED_ACTION {
  RENDER_COMPILED = 'COMPILED_RENDER_COMPILED',
  FETCH_COMPILED = 'COMPILED_FETCH_COMPILED',
  ERROR_COMPILED = 'COMPILED_ERROR_COMPILED',
  CHANGE_EXPLORER_OPTIONS = 'COMPILED_CHANGE_EXPLORER_OPTIONS'
}

export const compiled: Reducer<Compiled, FetchCompiledAction | RenderCompiledAction | ErrorCompiledAction | ChangeExplorerOptionsAction> = (state = initialState, action) => {
  switch (action.type) {
    case COMPILED_ACTION.FETCH_COMPILED:
      return { ...state, request: merge([state.request || {}, action.payload.request]) as CodeWorkerRequest }
    case COMPILED_ACTION.RENDER_COMPILED:
      return { ...state, ...action.payload }
    case COMPILED_ACTION.ERROR_COMPILED:
      return { ...state, ...action.payload }
    case COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS:
      return { ...state, explorer: { ...state.explorer, ...action.payload } }
    default:
      return state
  }
}

export interface FetchCompiledAction extends Action<COMPILED_ACTION.FETCH_COMPILED> {
  type: COMPILED_ACTION.FETCH_COMPILED
  payload: { request: Partial<CodeWorkerRequest> }
}

export interface RenderCompiledAction extends Action<COMPILED_ACTION.RENDER_COMPILED> {
  type: COMPILED_ACTION.RENDER_COMPILED
  payload: { response: CodeWorkerResponse }
}

export interface ErrorCompiledAction extends Action<COMPILED_ACTION.ERROR_COMPILED> {
  type: COMPILED_ACTION.ERROR_COMPILED
  payload: { error: CodeWorkerError }
}

export interface ChangeExplorerOptionsAction extends Action<COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS> {
  type: COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS
  payload: CompiledExplorerOptions
}

function* watchFetchCompiled() {
  yield takeEvery(COMPILED_ACTION.FETCH_COMPILED,
    function* (action: FetchCompiledAction) {
      yield put({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: true } })
      const state: State = yield select()
      const m: CodeWorkerRequest = {
        ...state.compiled.request,
        code: state.editor.code,
        version: state.editor.version
      }
      requestCodeCompile(m)
    })
}

function* watchRenderCompile() {
  yield takeEvery(COMPILED_ACTION.RENDER_COMPILED,
    function* (action: RenderCompiledAction) {
      yield call(() => dispatchSyntaxHighlight(action.payload.response))
      yield put({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: false } })
    })
}

function* watchEditorCursorPosition() {
  yield takeEvery(EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION,
    function* (action: EditorChangedCursorPositionAction) {
      const state: State = yield select()
      if (state.compiled.explorer && state.compiled.explorer.disableEditorBind) {
        return
      }
      const ast = state.compiled.response && state.compiled.response.jsxAst
      if (ast) {
        const showDetailsOf = findDescendantIncludingPosition(ast.ast, action.payload)
        if (showDetailsOf) {
          yield put({ type: COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS, payload: { showDetailsOf } })
        }
      }
    })
}

function findDescendantIncludingPosition(n: CodeWorkerResponseJsxAsNode, p: EditorCursorPosition): CodeWorkerResponseJsxAsNode | undefined {
  const d = findDescendant(n, d => nodeIncludesPosition(d, p))
  if (d) {
    let c: CodeWorkerResponseJsxAsNode | undefined
    d.children.some(child => {
      const found = findDescendantIncludingPosition(child, p)
      if (found) {
        c = found
        return true
      }
      else {
        return false
      }
    })
    return c || d
  }
}

function nodeIncludesPosition(n: CodeWorkerResponseJsxAsNode, p: EditorCursorPosition) {
  return n.startColumn <= p.column && n.endColumn >= p.column && n.startLineNumber <= p.lineNumber && n.endLineNumber >= p.lineNumber
}
function findDescendant(n: CodeWorkerResponseJsxAsNode, fn: (node: CodeWorkerResponseJsxAsNode) => boolean, dontIncludeSelf = true): CodeWorkerResponseJsxAsNode | undefined {
  return (!dontIncludeSelf && fn(n)) ? n : n.children.find(c => !!findDescendant(c, fn, false))
}

function* watchErrorCompiled() {
  yield takeEvery(COMPILED_ACTION.ERROR_COMPILED,
    function* (action: ErrorCompiledAction) {
      yield put({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: false } })
    }
  )
}

export type compiledActions = FetchCompiledAction | RenderCompiledAction | ErrorCompiledAction | ChangeExplorerOptionsAction

export function* compiledSagas() {
  yield all([
    watchFetchCompiled(), watchRenderCompile(), watchErrorCompiled(), watchEditorCursorPosition()
  ])
}
