import * as React from 'react'
import { render } from 'react-dom'
import 'semantic-ui-css/semantic.css'
import { Container } from 'semantic-ui-react'
import MovieTable from './test/dataTable'
import { AppOptions, getInitialState } from './store/state'
import { _setStore, getStore } from './store/store'
import TestComponent from './testComponent'

export async function main(appOptions: AppOptions) {
  if (!document.querySelector('#main')) {
    var d = document.createElement('div')
    d.setAttribute('id', 'main')
    document.body.append(d)
  }
  var s = await getInitialState(appOptions)
  _setStore(s)
  const renderApp = ()=>render(
    <Container>
      <div>
        hello world
      </div>
      <TestComponent></TestComponent>
      <MovieTable></MovieTable>
    </Container>
    ,
    document.getElementById('main')
  )
  getStore().add(renderApp)
  renderApp()
}
