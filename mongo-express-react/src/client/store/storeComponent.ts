import React, { Component } from 'react'
import { AbstractComponent } from './abstractComponent'
import { State } from './state'
import { getStore } from './store'

export class StoreComponent<P extends Partial<State> = Partial<State>> extends AbstractComponent<State, P> {
  getStore() {
    return getStore()
  }
}
