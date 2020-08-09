import React, { Component } from 'react'

export abstract class AbstractComponent<S, P extends Partial<S>> extends Component<P, S> {
  constructor(p: P, s: S) {
    super(p, s)
    this.state = { ...this.getStore().getState(), ...p }
    this.storeChange = this.storeChange.bind(this)
  }
  componentDidMount() { 
    this.getStore().add(this.storeChange)
  }
  componentWillUnmount() {
    this.getStore().remove(this.storeChange)
  }
  storeChange() {
    this.setState(this.getStore().getState())
  }
  abstract getStore(): ComponentStore<S>
}

interface ComponentStore<S> {
  getState(): S
  add(listener: any): void
  remove(listener: any): void
}