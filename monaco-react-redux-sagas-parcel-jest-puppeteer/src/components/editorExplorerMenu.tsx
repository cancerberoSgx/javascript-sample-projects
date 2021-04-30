import * as React from 'react'
import { OPTIONS_ACTIONS } from '../store/options'
import { dispatch } from '../store/store'
import { ExplorerName, State } from '../store/types'
import { isMobile } from '../util/media'
import { Component } from './util/component'
import { connect } from 'react-redux';

interface P{ selectedExplorer: ExplorerName }
 class EditorExplorerMenu_ extends Component<P> {

  render() {
    return <div className="tabs is-small is-boxed is-toggle editorExplorerOptions">
      <ul>
        {isMobile() && <li className={`editor ${this.props.selectedExplorer === 'editor' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('editor')}>Editor</a>
        </li>}
        <li className={`elements ${this.props.selectedExplorer === 'elements' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('elements')}>Elements</a>
        </li>
        <li className={`jsAst ${this.props.selectedExplorer === 'jsAst' ? 'is-active' : ''}`} >
          <a onClick={e => this.selectTab('jsAst')}>JS AST</a>
        </li>
        <li className={`jsxColors ${this.props.selectedExplorer === 'jsxColors' ? 'is-active' : ''}`}>
          <a onClick={e => this.selectTab('jsxColors')}>jsxColors</a>
        </li>
      </ul>
    </div>
  }

  private selectTab(selectedExplorer: ExplorerName) {
    dispatch({ type: OPTIONS_ACTIONS.SELECT_EXPLORER, payload: { selectedExplorer  } })
  }
}

export const EditorExplorerMenu = connect (
  (state: State) => ({
    selectedExplorer: state.options.selectedExplorer
  })
)(EditorExplorerMenu_) 

