import { array, unique, randomCssColor } from "misc-utils-of-mine-generic";

function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}
class Base {
  id: string
  constructor() {
    this.id = unique()
  }
}

class Unit {

}
class Entry extends Base {
  units: Unit[]
  width: number
  height: number
  constructor(public x: number, public y: number) { super() }
}
class Board {
  zoom = 3.5
  entryWidth = 40
  entryHeight = 40
  items: Entry[][] = [[]]
  container: HTMLDivElement;
  styleEl: HTMLStyleElement;
  constructor(public width = 300, public height = 200) {
    this.items = array(height).map(y => array(width).map(x => new Entry(x, y)))
  }
  drawStyle(){
    this.styleEl.innerHTML= `    
      table {
        width: ${Math.trunc(this.entryWidth * this.zoom*this.width)}px;
      }
      td {
        width: ${Math.trunc(this.entryWidth * this.zoom)}px;
        height: ${Math.trunc(this.entryHeight * this.zoom)}px;        
      }`
  }
  draw(parent: HTMLElement) {
    if(!this.container){
      const s = `
      <style id="board-style">
      </style>
      <style>
      * {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
      }
      </style>
        <table>
          ${this.items.map(col => `
          <tr>
            ${col.map(entry => `
            <td id="entry-${entry.id}" style="background-color: ${randomCssColor()};">
            </td>`).join('')}
          </tr>`).join('')}
        </table>`
      this.container = append(s, parent)
      this.styleEl = this.container.querySelector('#board-style')
      this.installKeys()
    }
    this.drawStyle()
  }
  installKeys() {
    window.addEventListener('keypress', e=>{
      if(e.key==='+'){
        this.zoom /= 0.7
        this.drawStyle()
      }
      else if(e.key==='-'){
        this.zoom *= 0.7
        this.drawStyle()
      }
    })
  }
}

function main() {
  const board = new Board(20,20)
  board.draw(document.body)
}

main()
