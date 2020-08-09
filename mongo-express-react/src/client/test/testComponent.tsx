import React, { MouseEvent } from 'react'
import { StoreComponent } from '../store/storeComponent'
import { getStore } from '../store/store'

export default class TestComponent extends StoreComponent {
  render() {
    return (
      <div>
        <div>Counter: {this.state.test.counter}</div>
        <div>
          <button onClick={e => this.onClick(e)}>increment</button>
        </div>
      </div>
    )
  }
  onClick(event: MouseEvent) {
    getStore().setState({ test: { counter: this.state.test.counter + 1 } })
  }
}