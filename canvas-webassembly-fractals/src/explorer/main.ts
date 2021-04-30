import { Emitter, enumKeys } from 'misc-utils-of-mine-generic'
import { Mandelbrot } from './mandelbrot'
import { Fractal } from './types'

const layoutHtml = `
<div class="layout">
  <canvas class="canvas"></canvas>
  <div class="overlay"></div>
</div>
`
const stylesHtml = `
<style>
* {
  padding: 0; 
  margin: 0;
}
.layout {
  width: 100%; 
  height: 100%;
  border: 1px solid pink;
}
.canvas {
  position: absolute;
}
.overlay {
  width: 100%; 
  height: 100%;
  opacity: 0.03; 
  background: green;
  position: absolute;
}
</style>
`

let fractal: Fractal, canvas: HTMLCanvasElement

function main() {
  append(stylesHtml + layoutHtml)
  canvas = document.querySelector<HTMLCanvasElement>('.canvas')
  const layout = document.querySelector('.layout')
  canvas.width = layout.clientWidth
  canvas.height = layout.clientHeight
  fractal = new Mandelbrot()
  fractal.render(canvas)
  installKeyListeners()
}
enum ACTIONS {
  ZOOM_IN = 'ZOOM_IN',
  ZOOM_OUT = "ZOOM_OUT",
  PAN_LEFT = "PAN_LEFT",
  PAN_RIGHT = "PAN_RIGHT",
  PAN_BOTTOM = "PAN_BOTTOM",
  PAN_TOP = "PAN_TOP"
}
function dispatchAction(action: string) {
  const MAGNIFICATION_FACTOR_STEP = 100
  const PAN_STEP = 0.2
  const actions = enumKeys(ACTIONS)
  // console.log(actions);
  if (!actions.includes(action)) {
    return
  }
  if (action === ACTIONS.ZOOM_IN) {
    fractal.magnificationFactor += MAGNIFICATION_FACTOR_STEP
  }
  else if (action === ACTIONS.ZOOM_OUT) {
    fractal.magnificationFactor -= MAGNIFICATION_FACTOR_STEP
  }
  else if (action === ACTIONS.PAN_LEFT) {
    fractal.panX -= PAN_STEP
  }
  else if (action === ACTIONS.PAN_RIGHT) {
    fractal.panX += PAN_STEP
  }
  else if (action === ACTIONS.PAN_TOP) {
    fractal.panY -= PAN_STEP
  }
  else if (action === ACTIONS.PAN_BOTTOM) {
    fractal.panY += PAN_STEP
  }
  fractal.render(canvas)
}

const actionEmitter = new Emitter<string>()
actionEmitter.add(dispatchAction)

const keys = [
  { action: 'ZOOM_IN', key: 'z' },
  { action: 'ZOOM_OUT', key: 'z', shift: true },
  { action: 'PAN_LEFT', key: 'd' },
  { action: 'PAN_RIGHT', key: 'a' },
  { action: 'PAN_TOP', key: 's' },
  { action: 'PAN_BOTTOM', key: 'w' },
]

function installKeyListeners() {
  document.onkeypress = e => {
    // console.log(e, keys
    // .filter(k => k.key.toLowerCase() === e.key.toLowerCase() && ((k.shift ? e.shiftKey : !e.shiftKey))));
    keys
      .filter(k => k.key.toLowerCase() === e.key.toLowerCase() && (k.shift ? e.shiftKey : !e.shiftKey))
      .forEach(k => {
        actionEmitter.emit(k.action)
      })
  }
}

function append(s, parent = document.body) {
  const e = document.createElement('div')
  e.innerHTML = s
  parent.append(e)
  return e
}

main()