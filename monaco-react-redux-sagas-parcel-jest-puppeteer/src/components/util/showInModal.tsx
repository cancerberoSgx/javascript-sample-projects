import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { Component } from './component';
import { Emitter } from '../../util/util';

let created = false

const emitter = new Emitter<S>()
export function showInModal(body: JSX.Element | string, title = 'modal') {
  if (!created) {
    const div = document.createElement('div')
    document.body.appendChild(div)
    ReactDOM.render(<Modal listenTo={emitter}></Modal>, div)
    created = true
  }
  emitter.emit({ body, title, active: true })
}


interface S {
  active?: boolean
  title?: string
  body?: string | JSX.Element
}

interface P {
  listenTo: typeof emitter
}
class Modal extends Component<P, S> {
  constructor(p: P, s: S) {
    super(p, s)
    p.listenTo.add(e => this.setState({ ...e }))
  }
  render() {
    let bodyEl: JSX.Element | undefined
    if (typeof this.state.body === 'string') {
      bodyEl = <div dangerouslySetInnerHTML={{ __html: this.state.body }}></div>
    }
    else if (this.state.body) {
      bodyEl = this.state.body
    }
    return <div className={"modal is-large " + (this.state.active ? 'is-active' : '')}  >
      <div className="modal-background" onClick={e => this.setState({ active: false })}
      ></div>
      <div className="modal-card">
        <header className="modal-card-head">
          <div className="modal-card-title">{this.state.title}</div>
          <button className="delete" aria-label="close" onClick={e => this.setState({ active: false })}
          ></button>
        </header>
        <section className="modal-card-body">
          {bodyEl}
        </section>
      </div>
    </div>
  }
}