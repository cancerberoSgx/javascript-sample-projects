import * as React from 'react'
import { registerStyle } from '../style/styles'
import { isMobile, css, height } from '../util/media'
import { TsSimpleAstExplorer } from './explorer/tsAst/tsAstExplorer'
import { Component } from './util/component'
import { JsxColorsMain } from './explorer/jsxColors/jsxColorsMain';
import { Theme, State, ExplorerName } from '../store/types';
import { ElementExplorer } from './explorer/elements/elementExplorer';
import { connect } from 'react-redux';
import { Editor } from './editor';

registerStyle((theme: Theme) => `
.editorExplorerBodyOverlay{
  visibility: hidden;
  display: block;
  background-color: ${theme.colors.brand};
  margin-top: 2em;
  width: 70%;
  height: 2em;
  color: ${theme.colors.fg};
  font-weight: bolder;
  // margin: 2.5em auto .5em auto;
  z-index: 3;
  // padding-top: .3em;
  opacity: 0.0;
  text-align: center;
  border-radius: 1em;
  transition: opacity 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: absolute;
}
body.working .editorExplorerBodyOverlay {
  visibility: visible;
  opacity: .8;
  transition: opacity 600ms easy-out;
}

${css(`.tile.editorExplorerBody.is-ancestor:last-child, .tile.editorExplorerBody.is-ancestor`, ``, `padding-top: 4em;`)}

.editorExplorerBodyMember {
  display:none;
  width: 100%;
  margin-top: 50px;
}

${css(`.editorExplorerBodyMember`, ``, `overflow: scroll;`)}

.editorExplorerBodyMember>* {
  width: 100%;
}

${css(`.editorExplorerBody `,
  `height: ${height() - 100}px;`,
  `height: ${height() - 160}px;`)}

.editorExplorerBodyMember.is-active {
  display: flex;
}

`)
interface P{ 
  selectedExplorer: ExplorerName 
}

class EditorExplorerBody_ extends Component<P> {

  render() {

    return isMobile() ?

      <div className={`editorExplorerBody`}>
        <div className={`editorExplorerBodyOverlay`}>Working...</div>
        <div className={`editor editorExplorerBodyMember ${this.props.selectedExplorer === 'editor' ? 'is-active' : ''}`}>
          {this.props.selectedExplorer === 'editor' && <Editor />}
        </div>
        <div className={`editorExplorerBodyMember elements ${this.props.selectedExplorer === 'elements' ? 'is-active' : ''}`}>
          {this.props.selectedExplorer === 'elements' && <ElementExplorer />}
        </div>
        <div className={`editorExplorerBodyMember jsAst ${this.props.selectedExplorer === 'jsAst' ? 'is-active' : ''}`}>
          {this.props.selectedExplorer === 'jsAst' && <TsSimpleAstExplorer />}
        </div>
        <div className={`editorExplorerBodyMember jsxColors ${this.props.selectedExplorer === 'jsxColors' ? 'is-active' : ''}`}>
          {this.props.selectedExplorer === 'jsxColors' && <JsxColorsMain />}
        </div>
      </div>

      :

      <div className="tile is-ancestor editorExplorerBody">

        <div className={`editorExplorerBodyOverlay`}>Working...</div>
        <div className="tile is-vertical is-4">
          <article className={`editorExplorerBodyMember elements ${this.props.selectedExplorer === 'elements' ? 'is-active' : ''}`}>
            {this.props.selectedExplorer === 'elements' && <ElementExplorer />}
          </article>
          <article className={`editorExplorerBodyMember jsAst ${this.props.selectedExplorer === 'jsAst' ? 'is-active' : ''}`}>
            {this.props.selectedExplorer === 'jsAst' && <TsSimpleAstExplorer />}
          </article>
          <article className={`editorExplorerBodyMember jsxColors ${this.props.selectedExplorer === 'jsxColors' ? 'is-active' : ''}`}>
            {this.props.selectedExplorer === 'jsxColors' && <JsxColorsMain />}
          </article>
        </div>

        <div className="tile is-vertical is-8">
          <article className="tile is-child">
            <Editor {...this.props} />
          </article>
        </div>
      </div>
  }

}

export const EditorExplorerBody = connect (
  (state: State) => ({
    selectedExplorer: state.options.selectedExplorer
  })
)(EditorExplorerBody_) 


