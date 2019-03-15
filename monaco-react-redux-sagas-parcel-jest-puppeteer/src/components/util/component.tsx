
import * as React from 'react'

export abstract class Component<P extends any = any, S extends any = any> extends React.Component<P, S>{

  updateProps(...a: any[]):any{

  }

  protected query<T extends Element= Element>(s: string): T {
    return document.querySelector<T>(s) as any
  }

  protected queryAll<T extends Element= Element>(s: string): T[] {
    return Array.from(document.querySelectorAll(s))
  }
}