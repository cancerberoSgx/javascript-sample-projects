export function f(a: number, b: number): number{
  return a+b
}

import {AppDrawer} from './AppDrawer'

window.customElements.define('app-drawer', AppDrawer);