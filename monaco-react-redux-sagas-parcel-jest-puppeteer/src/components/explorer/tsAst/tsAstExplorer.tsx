import * as React from 'react'
import { registerStyle } from '../../../style/styles'
import { css, height } from '../../../util/media'
import { Component } from '../../util/component'
import { ExplorerProps } from '../explorers'
import { NodeComponent } from './tsAstNode'
import { DiagnosticComponent } from './tsAstDiagnostic'
import { dispatch } from '../../../store/store'
import { COMPILED_ACTION } from '../../../store/compiled'

interface P extends ExplorerProps {
}
interface S {
  showDetailsOfEverything?: boolean
  collapseAllMode?: 'collapse' | 'expand' | undefined
}

registerStyle(`
${css('.tsAstExplorerContent li ul', `padding-left: .7em`, `padding-left 1.2em`)}
.tsAstExplorerContent ul {
  list-style: none;
}
`)

export class TsSimpleAstExplorer extends Component<P, S> {
  render() {
    if (this.props.options && this.props.options.disableJsAstExplorer) {
      return <div className="content">
        <h3>Disabled </h3>
        <p>By configuration disableJsAstExplorer options are turned on so I'm disabled. </p>
      </div>
    }
    const compiled = this.props.compiled.response
    const explorer = this.props.compiled.explorer
    const disableEditorBind = explorer && explorer.disableEditorBind
    if (compiled) {
      const { diagnostics, ast } = compiled.jsxAst
      const { mode, showDiagnostics } = this.props.compiled.request.jsxAst
      return <div className="tsAstExplorerContent">

        <p>This is the source code Abstract Syntax Tree (AST) which contain the parsed nodes like declarations, expressions, statements, etc. You have two AST modes, and the tree is bound to the editor - when you change the cursor in it, the explorer will focus that AST Node in the Tree, and viceversa, when you click a node the editor will focus the code that implements it.</p>

        <button className="button" onClick={e => {
          dispatch({ type: COMPILED_ACTION.FETCH_COMPILED, payload: { request: { jsxAst: { mode: mode === 'forEachChild' ? 'getChildren' : 'forEachChild' } } } })
        }}>
          {mode === 'forEachChild' ? 'getChildren' : 'forEachChild'} mode</button>

        <button className="button" onClick={e => {
          dispatch({ type: COMPILED_ACTION.FETCH_COMPILED, payload: { request: { jsxAst: { showDiagnostics: !showDiagnostics } as any } } })
        }}>
          {showDiagnostics ? 'Hide' : 'Show'} Diagnostics</button>

        <label><input type="checkbox"
          checked={!disableEditorBind}
          onChange={e => dispatch({
            type: COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS,
            payload: { disableEditorBind: !e.currentTarget.checked }
          })
          } />Follow cursor?</label>

        <button className="button" title="Details of everything"
          onClick={e => this.setState({
            showDetailsOfEverything: !this.state.showDetailsOfEverything,
            collapseAllMode: !this.state.showDetailsOfEverything === true ? 'expand' : this.state.collapseAllMode
          })}>
          {this.state.showDetailsOfEverything ? 'Hide' : 'Show'} details of everything</button>

        <button className="button" title="Collapse all"
          onClick={e => this.setState({ collapseAllMode: this.state.collapseAllMode !== 'collapse' ? 'collapse' : 'expand' })}>
          {this.state.collapseAllMode !== 'collapse' ? 'Collapse' : 'Expand'} everything</button>


        {showDiagnostics && <div className="content">
          <h3>Diagnostics:</h3>
          <p>
            <em>WARNING</em>: Diagnostics makes the experience very slow
          </p>
          {diagnostics && <ul>
            {diagnostics.map(d => <li>
              <DiagnosticComponent d={d} onSelectCode={this.props.onSelectCode} />
            </li>)}
          </ul>}
          {diagnostics && diagnostics.length === 0 && <span>No problems diagnosed, congrats!</span>}
        </div>}

        <NodeComponent mode={mode || 'forEachChild'} {...this.state}
          showDetailsOf={explorer && explorer.showDetailsOf}
          node={ast}
          disableEditorBind={disableEditorBind}
          onShowDetailsOf={n => {
            dispatch({ type: COMPILED_ACTION.CHANGE_EXPLORER_OPTIONS, payload: { showDetailsOf: n } })
            this.props.onSelectCode && this.props.onSelectCode(n)
          }} />
      </div>
    }
    else {
      return <div className="content">
      </div>
    }
  }
}
