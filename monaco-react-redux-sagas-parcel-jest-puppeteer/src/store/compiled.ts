import { all as merge } from 'deepmerge';
import { Action, Reducer, Store } from 'redux';
import { all, takeEvery } from 'redux-saga/effects';
import { dispatchSyntaxHighlight } from '../monaco/jsxSyntaxHighlight';
import { EditorChangedCursorPositionAction, EDITOR_ACTION } from './editor';
import { ChangeOtherOptionsAction, OPTIONS_ACTIONS } from './options';
import { dispatch, getState } from './store';
import { CodeWorkerError, CodeWorkerRequest, CodeWorkerResponse, CodeWorkerResponseJsxAsNode, Compiled, CompiledExplorerOptions, EditorCursorPosition, State } from './types';
import { compileCode } from '../util/codeWorkerManager';

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
      dispatch({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: true } })
      getState().then(state=>{
        const m: CodeWorkerRequest = {
          ...state.compiled.request,
          code: state.editor.code,
          version: state.editor.version,
          disableEvaluate: state.compiled.explorer && state.compiled.explorer.disableElementsExplorer || state.options.selectedExplorer !== 'elements',
          disableJsxAst: state.compiled.explorer && state.compiled.explorer.disableJsAstExplorer || state.options.selectedExplorer !== 'jsAst',
          disableJsxSyntaxHighLight: state.compiled.explorer && state.compiled.explorer.disableJSXSyntaxHighlight,
        };
        compileCode(m);
      })
      yield 1
    })
}

let updateTimeoutTimer: any
function* watchUpdateTimeout() {
  yield takeEvery(OPTIONS_ACTIONS.CHANGE_OTHER_OPTIONS,
    function* (action: ChangeOtherOptionsAction) {
      if (updateTimeoutTimer) {
        clearInterval(updateTimeoutTimer)
      }
      if (action.payload.updateTimeout) {
        dispatch({ type: OPTIONS_ACTIONS.CHANGE_AUTO_APPLY, payload: { autoApply: false } })
        updateTimeoutTimer = setInterval(() => {
          dispatch({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: true } })
          getState().then(state=>{
            const m: CodeWorkerRequest = {
              ...state.compiled.request,
              code: state.editor.code,
              version: state.editor.version,
              disableEvaluate: state.compiled.explorer && state.compiled.explorer.disableElementsExplorer || state.options.selectedExplorer !== 'elements',
              disableJsxAst: state.compiled.explorer && state.compiled.explorer.disableJsAstExplorer || state.options.selectedExplorer !== 'jsAst',
              disableJsxSyntaxHighLight: state.compiled.explorer && state.compiled.explorer.disableJSXSyntaxHighlight,
            };
            compileCode(m)
          })
        }, action.payload.updateTimeout*1000)
        yield 1
      }
    })
}

function* watchRenderCompile() {
  yield takeEvery(COMPILED_ACTION.RENDER_COMPILED,
    function* (action: RenderCompiledAction) {
      dispatchSyntaxHighlight(action.payload.response)
      yield dispatch({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: false } })
    })
}

function* watchEditorCursorPosition() {
  yield takeEvery(EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION,
    function* (action: EditorChangedCursorPositionAction) {
      yield getState().then(state=>{
        const ast = state.compiled.response && state.compiled.response.jsxAst
        if (ast) {
          const showDetailsOf = findDescendantIncludingPosition(ast.ast, action.payload)
          if (showDetailsOf) {
            dispatch({ type: COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS, payload: { showDetailsOf } })
          }
        }
      })
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
      yield dispatch({ type: OPTIONS_ACTIONS.SET_WORKING, payload: { working: false } })
    }
  )
}

export type compiledActions = FetchCompiledAction | RenderCompiledAction | ErrorCompiledAction | ChangeExplorerOptionsAction

export function* compiledSagas() {
  yield all([
    watchFetchCompiled(), watchRenderCompile(), watchErrorCompiled(), watchEditorCursorPosition(), watchUpdateTimeout()
  ])
}
