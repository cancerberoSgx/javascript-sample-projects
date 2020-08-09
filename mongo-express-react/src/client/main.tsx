import * as React from 'react'
import { render } from 'react-dom'
import 'semantic-ui-css/semantic.css'
import { Container } from 'semantic-ui-react'
import DataTableTest from './test/dataTable'
import { AppOptions, getInitialState } from './store/state'
import { _setStore, getStore } from './store/store'
import TestComponent from './test/testComponent'
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { search } from './dispatch'

export async function main(appOptions: AppOptions) {
  if (!document.querySelector('#main')) {
    var d = document.createElement('div')
    d.setAttribute('id', 'main')
    document.body.append(d)
  }
  var s = await getInitialState(appOptions)
  _setStore(s)
  const renderApp = () => render(
    <Router>
      <Container>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/test">test</Link>
            </li>
          </ul>
        </nav>
        <Switch>
          <Route path="/test">
            <h2>test</h2>
            <TestComponent></TestComponent>
          </Route>
          <Route path="/">
            <h2>Home</h2>
            <DataTableTest></DataTableTest>
          </Route>
        </Switch>
      </Container>
    </Router>
    ,
    document.getElementById('main')
  )
  getStore().add(renderApp)
  renderApp()
  await search(s.search)
  
  // if (urlHasState()) {
  //   await loadUrl()
  // }
  // else {
  //   await setExample(s.example)
  // }
  // getStore().add(() => {
  //   createUrl()
  // })
  
}
