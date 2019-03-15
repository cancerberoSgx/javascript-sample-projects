import * as React from 'react'
import { OPTIONS_ACTIONS } from '../store/options'
import { dispatch } from '../store/store'
import { ExplorerName, State } from '../store/types'
import { isMobile } from '../util/media'
import { Component } from './util/component'

export class EditorExplorerMenu extends Component<{state: State}> {

  render() {
    return <div className="tabs is-small is-boxed is-toggle editorExplorerOptions">
      <ul>
        {isMobile() && <li className={`editor ${this.props.state.options.selectedExplorer === 'editor' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('editor')}>Editor</a>
        </li>}
        <li className={`elements ${this.props.state.options.selectedExplorer === 'elements' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('elements')}>Elements</a>
        </li>
        <li className={`jsAst ${this.props.state.options.selectedExplorer === 'jsAst' ? 'is-active' : ''}`} >
          <a onClick={e => this.selectTab('jsAst')}>JS AST</a>
        </li>
        <li className={`jsxColors ${this.props.state.options.selectedExplorer === 'jsxColors' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('jsxColors')}>jsxColors</a>
        </li>
        {/* <li className={`implementations ${this.props.state.options.selectedExplorer === 'implementations' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('implementations')}>implementations</a>
        </li> */}
      </ul>
    </div>
  }

  private selectTab(selectedExplorer: ExplorerName) {
    dispatch({ type: OPTIONS_ACTIONS.SELECT_EXPLORER, payload: { selectedExplorer  } })
  }
}
