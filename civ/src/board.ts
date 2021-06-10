import { array, randomCssColor } from "misc-utils-of-mine-generic"
import { append, findParent } from "./util"
import { Base, Unit } from "./model"

export class Board {
  zoom = 3.5
  entryWidth = 40
  entryHeight = 40
  items: Entry[][] = [[]]
  container: HTMLDivElement
  styleEl: HTMLStyleElement

  constructor(public width = 300, public height = 200) {
    this.items = array(height).map(y => array(width).map(x => new Entry(x, y)))
  }

  drawStyle() {
    this.styleEl.innerHTML = `    
      table {
        width: ${Math.trunc(this.entryWidth * this.zoom * this.width)}px;
      }
      td {
        width: ${Math.trunc(this.entryWidth * this.zoom)}px;
        height: ${Math.trunc(this.entryHeight * this.zoom)}px;
      }`
  }

  draw(parent: HTMLElement) {
    if (!this.container) {
      const s = `
      <style id="board-style">
      </style>
      <style>
      * {
        margin: 0 !important
        padding: 0 !important
        border: 0 !important
      }
      </style>
        <table>
          ${this.items.map(col => `
          <tr>
            ${col.map(entry => `
            <td id="board-entry-${entry.id}" class="board-entry" style="background-color: ${randomCssColor()}">
            <span>alksjd${entry.id}asd</span>
            </td>`).join('')}
          </tr>`).join('')}
        </table>`
      this.container = append(s, parent)
      this.styleEl = this.container.querySelector('#board-style')
      this.installKeys()
      this.installMouse()
    }
    this.drawStyle()
  }
  
  installMouse() {
    this.container.addEventListener('click', e => {
      console.log(e, findParent(e.target as HTMLElement, e => e.className.includes('board-entry')))
    })
  }

  installKeys() {
    window.addEventListener('keypress', e => {
      if (e.key === '+') {
        this.zoom /= 0.7
        this.drawStyle()
      }
      else if (e.key === '-') {
        this.zoom *= 0.7
        this.drawStyle()
      }
    })
  }
}

export class Entry extends Base {
  units: Unit[]
  width: number
  height: number
  constructor(public x: number, public y: number) { super() }
}
