import React, { Component } from 'react'
import { urlToState } from './history'
import { setState } from './store/store'

interface P {
  href: string
}

// TODO: make href optional and add props.state also optional so users can give state instead of href. Decode state to href here
export default class Link extends Component<P> {
  render() {
    return (
      <a href={this.props.href} onClick={e=>this.onClick(e)}>{this.props.children}</a>
    )
  }
  onClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void {
    e.preventDefault()
    window.history.pushState({}, document.title, this.props.href)
    const state = urlToState(this.props.href)
    setState(state)
  }
}
