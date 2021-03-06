import * as React from 'react'
import { render } from 'react-dom'
import 'semantic-ui-css/semantic.css'
import { search } from './dispatch'
import { setStateFromUrl } from './history'
import MainComponent from './mainComponent'
import { AppOptions, getInitialState } from './store/state'
import { _setStore } from './store/store'

export async function main(appOptions: AppOptions) {
  if (!document.querySelector('#main')) {
    var d = document.createElement('div')
    d.setAttribute('id', 'main')
    document.body.append(d)
  }
  var s = await getInitialState(appOptions)
  _setStore(s)

  await setStateFromUrl()
  render(<MainComponent />, document.getElementById('main'))

  await search(s.search)
}
