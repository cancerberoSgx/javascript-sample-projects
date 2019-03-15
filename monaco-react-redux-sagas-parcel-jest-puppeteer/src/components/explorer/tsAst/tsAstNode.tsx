import * as React from 'react'
import { registerStyle } from '../../../style/styles'
import { shorter } from '../../../util/util'
import { Component } from '../../util/component'
import { CodeWorkerResponseJsxAsNode } from '../../../store/types'

interface P {
  node: CodeWorkerResponseJsxAsNode
  mode: 'getChildren' | 'forEachChild'
  onShowDetailsOf: ( n: CodeWorkerResponseJsxAsNode) => void
  showDetailsOf?: CodeWorkerResponseJsxAsNode
}

interface S {  
  showDetailsOf?: CodeWorkerResponseJsxAsNode
  collapsed?: boolean
}

export class NodeComponent extends Component<P, S> {

  private el:React.RefObject<HTMLDivElement>

  constructor(p:P,s:S){
    super(p,s)
    this.el=React.createRef()
  }

  componentDidUpdate(){
    if(this.state.showDetailsOf||this.props.showDetailsOf===this.props.node){
      if(this.el.current){
        this.el.current.scrollIntoView()
      }
    }
  }

  render() {
    const { node, mode, onShowDetailsOf } = this.props
    const showDetailsOf = this.state.showDetailsOf||this.props.showDetailsOf
    return <div className="tsAstExplorerNode" >

      <span className="nodeName"
      >{node.kind}</span>

      <button className="button is-small" onClick={e => {
        this.setState({ showDetailsOf: node })
        
        onShowDetailsOf(node)
      }}>!</button>

      <button className="button is-small" onClick={e => {
        this.setState({ collapsed: !this.state.collapsed })
      }}>{this.state.collapsed ? '+' : '-'}</button>

      {!this.state.collapsed && showDetailsOf === node && <div className="nodeInfo content" ref={this.el}>
        <strong>Text</strong>: <code>{shorter(node.text)}</code><br />
        <strong>Type</strong>: <code>{node.type}</code><br />
        <strong>Range</strong> (start-end): {node.start}-{node.end}<br />
        <strong>Range</strong> (line-column): {node.startLineNumber}x{node.startColumn}-{node.endLineNumber}x{node.endColumn}<br />
      </div>}

      {!this.state.collapsed && <ul>
        {node.children.map((c, i) => <li>
          <NodeComponent node={c}  
          showDetailsOf={showDetailsOf}
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
.tsAstExplorerNode .nodeInfo{
  border: 3px solid pink;
}
`)
