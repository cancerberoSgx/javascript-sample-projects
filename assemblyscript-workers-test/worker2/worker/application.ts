import { state } from "./state";

export class Application {

  // canvas: HTMLCanvasElement
  module: WebAssembly.WebAssemblyInstantiatedSource
  width: number
  height: number
  mem: Uint16Array
  argb: Uint32Array
  imageData: ImageData
  ctx: CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D
  colors: Uint32Array
  constructor(public canvas: HTMLCanvasElement|OffscreenCanvas){}
  async start() {
    this.colors = computeColors()
    // Set up the canvas with a 2D rendering context
    // this.canvas = document.querySelector('canvas')
    this.ctx = this.canvas.getContext("2d")
    // // var bcr = this.canvas.getBoundingClientRect()
    // // Compute the size of the viewport
    // this.width = bcr.width | 0
    // this.height = bcr.height | 0
    this.width = this.canvas.width | 0
    this.height = this.canvas.height | 0
    // var ratio = window.devicePixelRatio || 1
    var ratio = 1
    this.width *= ratio
    this.height *= ratio
    var size = this.width * this.height
    var byteSize = size << 1 // discrete color indices in range [0, 2047] (here: 2b per pixel)
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.ctx.scale(ratio, ratio)
    // Compute the size of and instantiate the module's memory
    var memory = new WebAssembly.Memory({ initial: ((byteSize + 0xffff) & ~0xffff) >>> 16 })
    this.mem = new Uint16Array(memory.buffer)
    this.imageData = this.ctx.createImageData(this.width, this.height)
    this.argb = new Uint32Array(this.imageData.data.buffer)
    // Fetch and instantiate the module
    const response = await fetch("build/optimized.wasm")
    const buffer = await response.arrayBuffer()
    this.module = await WebAssembly.instantiate(buffer, {
      env: { memory },
      Math: Math as any
    })
    // this.installKeys()
    return this
  }
  updateLine(y: number) {
    var yx = y * this.width
    for (let x = 0; x < this.width; ++x) {
      this.argb[yx + x] = this.colors[this.mem[yx + x]]
    }
  }
  computeLine(y, limit, magnificationFactor, translateXFactor, translateYFactor) {
    (this.module.instance.exports.computeLine as any)(y, this.width, this.height, limit, state.magnificationFactor, state.translateXFactor, translateYFactor)
  }
  render() {
    this.ctx.putImageData(this.imageData, 0, 0)
    if (state.animate) {
      requestAnimationFrame(() => this.render())
    }
  }
  paint() {
    // Compute an initial balanced version of the set.
    for (let y = 0; y < this.height; ++y) {
      this.computeLine(y, state.limit, state.magnificationFactor, state.translateXFactor, state.translateYFactor)
      this.updateLine(y)
    }
    if (state.animate) {
      // Let it glow a bit by occasionally shifting the limit...
      var currentLimit = state.limit
      var shiftRange = 10
      let updateShiftTimer, updateFlickerTimer
      const updateShift = () => {
        currentLimit = state.limit + (2 * Math.random() * shiftRange - shiftRange) | 0
        if (state.animate) {
          updateShiftTimer = setTimeout(updateShift, 1000 + (1500 * Math.random()) | 0)
        }
        else {
          clearTimeout(updateShiftTimer)
        }
      }
      updateShift()
      // ...while continuously recomputing a subset of it.
      var flickerRange = 3
      const updateFlicker = () => {
        for (let i = 0, k = (0.05 * this.height) | 0; i < k; ++i) {
          let ry = (Math.random() * this.height) | 0
          let rl = (2 * Math.random() * flickerRange - flickerRange) | 0
          this.computeLine(ry, currentLimit + rl, state.magnificationFactor, state.translateXFactor, state.translateYFactor)
          this.updateLine(ry)
        }
        if (state.animate) {
          updateFlickerTimer = setTimeout(updateFlicker, 1000 / 30)
        }
        else {
          clearTimeout(updateFlickerTimer)
        }
      }
      updateFlicker()
    }
    this.render()
  }
  onKeyPress(e){
    if (e.key === '+') {
      state.magnificationFactor /= state.magnificationFactorStep
    }
    else if (e.key === '-') {
      state.magnificationFactor *= state.magnificationFactorStep
    }
    else if (e.key === 'l' && !e.shiftKey) {
      state.limit += 5
    }
    else if (e.key === 'l' && e.shiftKey) {
      state.limit -= 5
    }
    else if (e.key === 'p') {
      state.animate = !state.animate
    }
    else if (e.key === 'a') {
      state.translateXFactor += 0.1
    }
    else if (e.key === 'd') {
      state.translateXFactor -= 0.1
    }
    else if (e.key === 'w') {
      state.translateYFactor += 0.1
    }
    else if (e.key === 's') {
      state.translateYFactor -= 0.1
    }
    else {
      return
    }
    this.paint()
  }
  onClick(e) {
    throw new Error("Method not implemented.");
  }
  setState(newState: any) {
    Object.assign(state, newState)
  }
}

// Compute a nice set of colors using a gradient
function computeColors() {
  // var canvas = document.createElement("canvas");
  // canvas.width = 2048;
  // canvas.height = 1;
  const canvas = new OffscreenCanvas(2048, 1)
  var ctx = canvas.getContext("2d");
  var grd = ctx.createLinearGradient(0, 0, 2048, 0);
  grd.addColorStop(0.00, "#000764");
  grd.addColorStop(0.16, "#2068CB");
  grd.addColorStop(0.42, "#EDFFFF");
  grd.addColorStop(0.6425, "#FFAA00");
  grd.addColorStop(0.8575, "#000200");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 2048, 1);
  // canvas.className = "gradient";
  // setTimeout(() => document.body.appendChild(canvas));
  return new Uint32Array(ctx.getImageData(0, 0, 2048, 1).data.buffer);
}
