import * as React from 'react'
// import { registerStyle } from '../../../style/styles'
import { Component } from '../../util/component'
// import { shorter as shorterImpl } from '../../../util/util'
// import { JsonImplOutputEl, jsonImplOutputElAsHtml, isJsonImplOutputEl, JsonImplOutput, isJsonImplOutputText, styleObjectToCss } from 'jsx-alone-core';
// import { isMobile } from '../../../util/media';

interface P {
  // node: JsonImplOutput
  onShowHtml: (s: string) => void
  collapseAllMode?: 'collapse' | 'expand'
  showDetailsOfEverything?: boolean
}
interface S {
  collapsed?: 'collapse' | 'expand'
  showDetails?: boolean
}
export class Node extends Component<P, S> {

  protected removeChildrenOnUpdate = true

  render() {
    // const { node } = this.props
    // const showDetails = this.state.showDetails || this.props.showDetailsOfEverything
    // const collapsed = typeof this.state.collapsed === 'undefined' ?
    //   this.props.collapseAllMode === 'collapse' : this.state.collapsed === 'collapse'

    // if (isJsonImplOutputText(node)) {
    //   return <article className="media text-output">
    //     <div className="media-content">
    //       <span className="nodeTag">Text: </span>
    //       <span className="textNodeContent">
    //         {shorter(node.content + '')}
    //         <span>({typeof node.content})</span>

    //       </span>
    //     </div>
    //   </article>
    // }

    // else if (isJsonImplOutputEl(node)) {
    //   return <article className={`media element-output ${collapsed ? 'collapsed' : ''}`}>
    //     <div className="media-content">

    //       <button className="button overlay is-small expand-collapse"
    //         onClick={e =>
    //           this.setState({ collapsed: collapsed ? 'expand' : 'collapse' })
    //         }>{collapsed ? '+' : '-'}</button>

    //       <h4 className="nodeTag">{`<${node.tag}>`}</h4>

    //       <button className="button overlay is-small" title="HTML code"
    //         onClick={e => this.props.onShowHtml(jsonImplOutputElAsHtml(node))}>{`<>`}</button>

    //       <button className="button overlay is-small" title="Outline in Editor"
    //         onClick={e => this.showDetails(node)}>{`!`}</button>

    //       {!collapsed && <div className="nodeContent">

    //         {showDetails && !!Object.keys(node.attrs).length && <div>
    //           {!isMobile() && <strong>Attributes</strong>}
    //           <Attrs node={node}></Attrs>
    //         </div>}

    //         {!!node.children.length && <div>
    //           {(showDetails ? node.children : node.children.filter(c => !isJsonImplOutputText(c)))
    //             .map(c => <Node node={c} onShowHtml={this.props.onShowHtml} showDetailsOfEverything={this.props.showDetailsOfEverything} collapseAllMode={this.props.collapseAllMode} />)}
    //         </div>}
    //       </div>
    //       }
    //     </div>
    //   </article>
    // }
    // else {
    //   return <article className="media">UNKNOWN: {JSON.stringify(node)}</article>
    // }
    return <div>Not impl</div>
  }

  // private showDetails(node: JsonImplOutputEl) {
  //   this.setState({ showDetails: true, collapsed: 'expand' });
  //   const els = Array.from(document.querySelectorAll('.view-line'))
  //     .filter(lineEl => lineEl.textContent && (lineEl.textContent.includes(`<${node.tag}`) || lineEl.textContent.includes(`</${node.tag}`)));
  //   els.forEach((lineEl: HTMLElement) => {
  //     lineEl.style.backgroundColor = 'pink';
  //   });
  //   setTimeout(() => {
  //     els.forEach((lineEl: HTMLElement) => {
  //       lineEl.style.backgroundColor = '';
  //     });
  //   }, 3000);
  // }
}

// interface AP {
//   node: JsonImplOutputEl
// }
// class Attrs extends Component<AP> {
//   protected removeChildrenOnUpdate = true
//   render() {
//     return <table>
//       {Object.keys(this.props.node.attrs).map(a => <tr className="tr">
//         <td><em className="test-attribute-name">{a} ({typeof this.props.node.attrs[a]})</em><code>=</code></td>
//         <td className="test-attribute-name">{this.printValue(a, this.props.node.attrs[a])}</td>
//       </tr>)}
//       {typeof this.props.node.innerHtml === 'string' && <tr className="tr">
//         <td><em>innerHtml</em></td>
//         <td>{shorter(this.props.node.innerHtml + '')}</td>
//       </tr>}
//     </table>
//   }
//   printValue(a: string, v: any): React.ReactNode {
//     if (a === 'style' && typeof v === 'object' && Object.keys(v).length) {
//       return shorter(styleObjectToCss(v))
//     }
//     else {
//       return shorter(v)
//     }
//   }
// }

// function shorter(s: string) {
//   return shorterImpl(s, 60)
// }

// registerStyle(`
// .media.element-output .nodeTag {
//   font-weight: bold;
//   margin: 0 .5em;
//   display: inline;
// }
// .media .media-content .nodeContent{
//   padding-left: 1.3em;
// }
// `)
