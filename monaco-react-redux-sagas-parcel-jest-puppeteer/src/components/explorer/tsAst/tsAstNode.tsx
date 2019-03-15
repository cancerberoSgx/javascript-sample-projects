import * as React from 'react'
import { registerStyle } from '../../../style/styles'
import { shorter } from '../../../util/util'
import { Component } from '../../util/component'
import { CodeWorkerResponseJsxAsNode } from '../../../store/types'

interface P {
  node: CodeWorkerResponseJsxAsNode
  path?: string
  mode: 'getChildren' | 'forEachChild'
  onShowDetailsOf: (p: string, n: CodeWorkerResponseJsxAsNode) => void
}
interface S {
  showDetailsOf?: string
  collapsed?: boolean
}
export class NodeComponent extends Component<P, S> {
  protected removeChildrenOnUpdate = true
  render() {
    const { node, mode, path = '/', onShowDetailsOf } = this.props
    return <div data-key={path} className="tsAstExplorerNode"  >

      <span className="nodeName"
      >{node.kind}</span>

      <button className="button is-small" onClick={e => {
        this.setState({ showDetailsOf: path })
        onShowDetailsOf(path, node)
      }}>!</button>

      <button className="button is-small" onClick={e => {
        this.setState({ collapsed: !this.state.collapsed })
        // throw ' not impl'

      }}>{this.state.collapsed ? '+' : '-'}</button>

      {!this.state.collapsed && this.state.showDetailsOf === path && <div className="nodeInfo content">
        <strong>Text</strong>: <code>{shorter(node.text)}</code><br />
        <strong>Type</strong>: <code>{node.type}</code>
      </div>}

      {!this.state.collapsed && <ul>
        {node.children.map((c, i) => <li>
          <NodeComponent node={c} path={path + i}
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
`)
