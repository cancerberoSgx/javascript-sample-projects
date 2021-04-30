
import * as React from 'react'

export abstract class Component<P extends any = any, S extends any = any> extends React.Component<P, S>{

  constructor(p:P, s: S){
    super(p, s)
    this.state = {} as S
  }
  
  protected query<T extends Element= Element>(s: string): T {
    throw 'not impl'
    // return document.querySelector<T>(s) as any
  }

  protected queryAll<T extends Element= Element>(s: string): T[] {
    throw 'not impl'
    // return Array.from(document.querySelectorAll(s))
  }
}