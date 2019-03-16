import * as React from 'react'
import { Theme, State } from '../store/types'
import { Component } from '../components/util/component'
import { globalStyles } from './globals'
import { cyborg_css } from '../util/filesPacked/cyborg_css';
import { default_css } from '../util/filesPacked/default_css';
import { getState } from '../store/store';
import { connect } from 'react-redux';

let stringStyle = ``

export async function registerStyle(s:  string | ((theme: Theme) => string)) {
  if (typeof s === 'string') {
    stringStyle += `\n${s
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    }`
  }
  else if (typeof s === 'function') {
    const state = await getState()
    stringStyle += `\n${s(state.layout.theme)
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
      }`
  } 
}

 class Styles_ extends Component<{ theme: Theme }> {
  render() {
    registerStyle(globalStyles(this.props.theme))
    return <div>
      {this.props.theme.name === 'dark' && <style dangerouslySetInnerHTML={{ __html: cyborg_css }}></style>}
      {this.props.theme.name === 'light' && <style dangerouslySetInnerHTML={{ __html: default_css }}></style>}
      <style dangerouslySetInnerHTML={{ __html: stringStyle }}></style>
    </div>
  }
}
export const Styles = connect (
  (state: State) => ({
    theme: state.layout.theme
  })
)(Styles_) 

