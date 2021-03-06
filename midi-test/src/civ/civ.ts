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
/** everything is a unit, tiles, cities, resources */
class Unit {
  type:'tile'|'city'|'unit'|'accident'='tile'
  movable=false
  killable=false
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
            <td id="board-entry-${entry.id}" class="board-entry" style="background-color: ${randomCssColor()};">
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
    this.container.addEventListener('click', e=>{
      console.log(e, findParent(e.target as HTMLElement, (e:HTMLElement)=>e.classList.contains('board-entry')));
      
    })
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

function findParent(e: HTMLElement, predicate: (e: HTMLElement) => boolean):HTMLElement|null {
  if(e.parentElement){
    if(predicate(e.parentElement)){
      return e.parentElement
    }else {
      return findParent(e.parentElement, predicate)
    }
  }
  return null
}

function main() {
  const board = new Board(20,20)
  board.draw(document.body)
}

main()
