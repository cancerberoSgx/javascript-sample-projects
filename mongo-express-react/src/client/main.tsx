import * as React from 'react'
import { render } from 'react-dom'
import { Container } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.css'
import { AppOptions, getInitialState } from './state'
import { getStore, _setStore } from './store'
import PaginationExampleControlled from './PaginationExampleControlled'

export async function main(appOptions: AppOptions) {
  if (!document.querySelector('#main')) {
    var d = document.createElement('div')
    d.setAttribute('id', 'main')
    document.body.append(d)
  }
  var s = await getInitialState(appOptions)
  _setStore(s)
  render(
    <Container fluid textAlign="left">
      <div>
        hello world
      </div>
      <PaginationExampleControlled></PaginationExampleControlled>
    </Container>
    ,
    document.getElementById('main')
  )
}
