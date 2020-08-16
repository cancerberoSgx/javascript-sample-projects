import React, { Component } from 'react'
import { urlToState } from './history'
import { setState } from './store/store'

interface P {
  href?: string
  action?: (...any)=>Promise<any>
}

// TODO: make href optional and add props.state also optional so users can give state instead of href. Decode state to href here
export default class Link extends Component<P> {
  render() {
    return (
      <a href={this.props.href||'#'} onClick={e=>this.onClick(e)}>{this.props.children}</a>
    )
  }
  async onClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
    e.preventDefault()
    if(this.props.href){
      window.history.pushState({}, document.title, this.props.href)
      const state = urlToState(this.props.href)
      setState(state)
    }
    if (this.props.action){
      await this.props.action()
    }
  }
}
