import * as React from 'react'
import { Theme } from '../store/types'
import { Component } from '../components/util/component'
import { globalStyles } from './globals'
import { onStoreStarted } from '../store/store'
import { cyborg_css } from '../util/filesPacked/cyborg_css';
import { default_css } from '../util/filesPacked/default_css';

let stringStyle = ``

export function registerStyle(s:  string | ((theme: Theme) => string)) {
  if (typeof s === 'string') {
    stringStyle += `\n${s
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
      }`
  }
  else if (typeof s === 'function') {
    onStoreStarted(state => stringStyle += `\n${s(state.layout.theme)
      .split('\n').filter((l:any) => !l.trim().startsWith('//')).join('\n')
      }`)
  } 
}

export class Styles extends Component<{ theme: Theme }> {
  render() {
    registerStyle(globalStyles(this.props.theme))
    return <div>
      {this.props.theme.name === 'dark' && <style dangerouslySetInnerHTML={{ __html: cyborg_css }}></style>}
      {this.props.theme.name === 'light' && <style dangerouslySetInnerHTML={{ __html: default_css }}></style>}
      <style dangerouslySetInnerHTML={{ __html: stringStyle }}></style>
    </div>
  }
}
