import * as React from 'react';
import * as monaco from 'monaco-editor';
import { getMonacoInstance, installEditor } from '../monaco/monaco';
import { EDITOR_ACTION } from '../store/editor';
import { dispatch } from '../store/store';
import { State } from '../store/types';
import { registerStyle } from '../style/styles';
import { throttle } from '../util/throttle';
import { query } from '../util/util';
import { Component } from './util/component';

interface P {
  state: State
}

registerStyle(`
.editorContainer {
  width: 100%;
}
`)

export class Editor extends Component<P> {

  lastTheme: string = 'vs'

  constructor(p: P, s:any) {
    super(p, s)
    this.dispatchModelChanged = this.dispatchModelChanged.bind(this)
  }

  componentDidMount() {
    installEditor(this.props.state.editor.code, this.getMonacoTheme(), query('#editorContainer'))
    const editor = getMonacoInstance()
    editor!.getModel()!.onDidChangeContent(throttle(this.dispatchModelChanged, 3000, { trailing: true }))
    this.dispatchModelChanged(false)
    if (this.props.state.layout.theme.name !== this.lastTheme) {
      monaco.editor.setTheme(this.getMonacoTheme())
    }
  }

  render() {

    return <div id="editorContainer" className="editorContainer" />
  }

  private dispatchModelChanged(respectAutoApplyOption = true) {
    if (this.props.state.options.autoApply || !respectAutoApplyOption) {
      const editor = getMonacoInstance()
      dispatch({
        type: EDITOR_ACTION.EDITOR_MODEL_CHANGED,
        payload: {
          code: editor!.getModel()!.getValue(),
          version: editor!.getModel()!.getVersionId()
        }
      })
    }
  }

  private getMonacoTheme(name = this.props.state.layout.theme.name): string {
    this.lastTheme = name === 'dark' ? 'vs-dark' : 'vs'
    return this.lastTheme
  }

}
