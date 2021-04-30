import * as React from 'react'
import { registerStyle } from '../../../style/styles'
import { shorter } from '../../../util/util'
import { Component } from '../../util/component'
import { CodeWorkerResponseJsxAsNode } from '../../../store/types'

interface P {
  node: CodeWorkerResponseJsxAsNode
  mode: 'getChildren' | 'forEachChild'
  onShowDetailsOf: (n: CodeWorkerResponseJsxAsNode) => void
  showDetailsOf?: CodeWorkerResponseJsxAsNode
  disableEditorBind?: boolean
  collapseAllMode?: 'collapse' | 'expand'
  showDetailsOfEverything?: boolean
}

interface S {
  showDetailsOf?: CodeWorkerResponseJsxAsNode
  // collapsed?: boolean
  collapsed?: 'collapse' | 'expand'

}

export class NodeComponent extends Component<P, S> {

  private el: React.RefObject<HTMLDivElement>

  constructor(p: P, s: S) {
    super(p, s)
    this.el = React.createRef()
  }

  componentDidUpdate() {
    if (!this.props.disableEditorBind && (this.state.showDetailsOf || this.props.showDetailsOf === this.props.node)) {
      if (this.el.current) {
        this.el.current.scrollIntoView()
      }
    }
  }

  render() {
    const { node, mode, onShowDetailsOf } = this.props
    const showDetailsOf = this.state.showDetailsOf || this.props.showDetailsOf
    const collapsed = typeof this.state.collapsed === 'undefined' ?
      this.props.collapseAllMode === 'collapse' : this.state.collapsed === 'collapse'

    return <div className={`tsAstExplorerNode ${showDetailsOf === node ? 'selected' : ''}`} >

      <button className="button overlay is-small expand-collapse"
        onClick={e =>
          this.setState({ collapsed: collapsed ? 'expand' : 'collapse' })
        }>{collapsed ? '+' : '-'}</button>

      <span className="nodeName">{node.kind}</span>

      <button className="button is-small overlay" onClick={e => {
        this.setState({ showDetailsOf: node })
        onShowDetailsOf(node)
      }}>!</button>

      {!collapsed && (showDetailsOf === node || this.props.showDetailsOfEverything) && <div className="nodeInfo content" ref={this.el}>
        <strong>Text</strong>: <code>{shorter(node.text)}</code><br />
        <strong>Type</strong>: <code>{node.type}</code><br />
        <strong>Range</strong> (start-end): {node.start}-{node.end}<br />
        <strong>Range</strong> (line-column): {node.startLineNumber}x{node.startColumn}-{node.endLineNumber}x{node.endColumn}<br />
      </div>}

      {!collapsed && <ul>
        {node.children.map((c, i) => <li>
          <NodeComponent {...this.props} node={c}
            showDetailsOf={showDetailsOf}
            showDetailsOfEverything={this.props.showDetailsOfEverything}
            onShowDetailsOf={onShowDetailsOf} mode={mode} />
        </li>)}
      </ul>}
    </div>
  }
}

registerStyle(`
.tsAstExplorerNode .nodeName {
  font-weight: bolder;
}
.tsAstExplorerNode.selected{
  border: 3px solid pink;
}
`)
