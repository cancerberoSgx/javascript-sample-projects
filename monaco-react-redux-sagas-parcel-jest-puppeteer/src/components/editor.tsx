import * as React from 'react';
import * as monaco from 'monaco-editor';
import { getMonacoInstance, installEditor } from '../monaco/monaco';
import { EDITOR_ACTION } from '../store/editor';
import { dispatch, getState } from '../store/store';
import { State } from '../store/types';
import { registerStyle } from '../style/styles';
import { throttle } from '../util/throttle';
import { query } from '../util/util';
import { Component } from './util/component';
import { css, height } from '../util/media';

interface P {
  state: State
}

registerStyle(`
${css(`.editorContainer, #editorContainer`, 
`height: ${height()-100}px;`, 
`height: ${height()-160}px;`)}
`)

export class Editor extends Component<P> {

  private lastTheme: string = 'vs'

  constructor(p: P, s:any) {
    super(p, s)
    this.modelChanged = this.modelChanged.bind(this)
    this.cursorChangedPosition = this.cursorChangedPosition.bind(this)
  }

  componentDidUpdate() {
    if (this.props.state.layout.theme.name !== this.lastTheme) {
      monaco.editor.setTheme(this.getMonacoTheme())
    }
  }

  async componentDidMount() {
    const editor = await installEditor(this.props.state.editor.code, this.getMonacoTheme(), query('#editorContainer'))
    // const editor = getMonacoInstance()
    editor!.getModel()!.onDidChangeContent(throttle(this.modelChanged, 3000, { trailing: true }))
    editor!.onDidChangeCursorPosition(throttle(this.cursorChangedPosition, 3000, { trailing: true }))
    this.modelChanged()
  }

  render() {
    return <div id="editorContainer" className="editorContainer" />
  }

  private modelChanged() {
    // if (this.props.state.options.autoApply || !respectAutoApplyOption) {
      const editor = getMonacoInstance()
      dispatch({
        type: EDITOR_ACTION.EDITOR_MODEL_CHANGED,
        payload: {
          code: editor!.getModel()!.getValue(),
          version: editor!.getModel()!.getVersionId()
        }
      })
    // }
  }

  private cursorChangedPosition(e: monaco.editor.ICursorPositionChangedEvent) {
    // if(this.props.state.compiled.explorer && !this.props.state.compiled.explorer!.disableEditorBind) {
      dispatch({type: EDITOR_ACTION.EDITOR_CHANGED_CURSOR_POSITION, payload: {
        column: e.position.column, 
        lineNumber: e.position.lineNumber
      }})
    // }
  }

  private getMonacoTheme(name = this.props.state.layout.theme.name): string {
    this.lastTheme = name === 'dark' ? 'vs-dark' : 'vs'
    return this.lastTheme
  }

}
