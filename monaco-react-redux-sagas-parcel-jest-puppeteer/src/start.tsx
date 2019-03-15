
import { applyMiddleware, combineReducers, createStore, ReducersMapObject } from 'redux'
import createSagaMiddleware from 'redux-saga'
import { all } from 'redux-saga/effects'
import { installCodeWWorker as installCodeWorker } from './codeWorker/codeWorkerManager'
// import { Main } from './components/main'
import { initMonacoWorkers } from './monaco/monaco'
import { compiled, compiledSagas } from './store/compiled'
import { changeCode, editorSagas } from './store/editor'
import { optionsReducer } from './store/options'
import { AllActions, setStore } from './store/store'
import { changeTheme, themeSagas } from './store/theme'
import { State } from './store/types'
import { jsxColorsReducer, jsxColorsSagas } from './store/jsxColors';
import * as ReactDom from 'react-dom'
import * as React from 'react'
import { App } from './components/app';
import { Provider } from 'react-redux';

export function start() {

  const reducerStateMap: ReducersMapObject<State, AllActions> = {
    layout: changeTheme,
    editor: changeCode,
    options: optionsReducer,
    compiled, 
    jsxColors: jsxColorsReducer
  }

  const reducers = combineReducers<State>(reducerStateMap)

  const sagaMiddleware = createSagaMiddleware()

  const store = createStore(reducers, applyMiddleware(sagaMiddleware))

  setStore(store)

  function* rootSaga() {
    yield all([
      editorSagas(), compiledSagas(), jsxColorsSagas(), themeSagas()
    ])
  }
  sagaMiddleware.run(rootSaga)

  installCodeWorker()

  initMonacoWorkers()

    const div = document.createElement('div')
  document.body.appendChild(div)
  ReactDom.render(<Provider store={store}><App state={store.getState()} /></Provider>, div)

}
