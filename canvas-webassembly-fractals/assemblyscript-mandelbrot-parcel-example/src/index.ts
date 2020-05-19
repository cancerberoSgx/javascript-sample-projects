import { layout } from "./layout"

// let this.state.magnificationFactor = 10.0
// let limit = 40
// let this.state.translateXFactor = 1.0 / 1.6
// let translateYFactor = 1.0 / 2.0

interface State {
  magnificationFactor: number
  limit: number
  translateXFactor: number
  translateYFactor: number
}
const state: State = {
  magnificationFactor: 10.0,
  limit: 50,
  translateXFactor: 1.0 / 1.6,
  translateYFactor: 1.0 / 2.0
}

class Application {

  canvas: HTMLCanvasElement
  module: WebAssembly.WebAssemblyInstantiatedSource & WebAssembly.Instance
  width: number
  height: number
  mem: Uint16Array
  argb: Uint32Array
  imageData: ImageData
  ctx: CanvasRenderingContext2D
  colors: Uint32Array

  constructor(public state: State){}

  async start() {

    this.colors = computeColors()

    // Set up the canvas with a 2D rendering context
    this.canvas = document.querySelector('canvas')
    this.ctx = this.canvas.getContext("2d");
    var bcr = this.canvas.getBoundingClientRect();

    // Compute the size of the viewport
    this.width = bcr.width | 0;
    this.height = bcr.height | 0;
    var ratio = window.devicePixelRatio || 1;
    this.width *= ratio;
    this.height *= ratio;
    var size = this.width * this.height;
    var byteSize = size << 1; // discrete color indices in range [0, 2047] (here: 2b per pixel)

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.ctx.scale(ratio, ratio);

    // Compute the size of and instantiate the module's memory
    var memory = new WebAssembly.Memory({ initial: ((byteSize + 0xffff) & ~0xffff) >>> 16 });
    this.mem = new Uint16Array(memory.buffer);
    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.argb = new Uint32Array(this.imageData.data.buffer);

    // Fetch and instantiate the module
    const response = await fetch("build/optimized.wasm")
    const buffer = await response.arrayBuffer()
    this.module = await WebAssembly.instantiate(buffer, {
      env: { memory },
      //@ts-ignore
      Math
    })
    this.installKeys()
    return this
  }

  updateLine(y: number) {
    var yx = y * this.width;
    for (let x = 0; x < this.width; ++x) {
      this.argb[yx + x] = this.colors[this.mem[yx + x]];
    }
  };
  computeLine(y, limit, magnificationFactor, translateXFactor, translateYFactor) {
    // var f = this.module.instance.exports.computeLine;
    //@ts-ignore
    this.module.instance.exports.computeLine(y, this.width, this.height, limit, this.state.magnificationFactor, this.state.translateXFactor, translateYFactor);
  }
  render() {
    this.ctx.putImageData(this.imageData, 0, 0)
    if (animate) {
      requestAnimationFrame(()=>this.render());
    }
  }
  paint(){
    // Compute an initial balanced version of the set.
    for (let y = 0; y < this.height; ++y) {
      this.computeLine(y, this.state.limit, this.state.magnificationFactor, this.state.translateXFactor, this.state.translateYFactor);
      this.updateLine(y);
    }
    if (animate) {
      // Let it glow a bit by occasionally shifting the limit...
      var currentLimit = this.state.limit;
      var shiftRange = 10;
      let updateShiftTimer, updateFlickerTimer
      (function updateShift() {
        currentLimit = this.state.limit + (2 * Math.random() * shiftRange - shiftRange) | 0
        if (animate) {
          updateShiftTimer = setTimeout(updateShift, 1000 + (1500 * Math.random()) | 0);
        }else {
          clearTimeout(updateShiftTimer)
        }
      })();
      // ...while continuously recomputing a subset of it.
      var flickerRange = 3;
      (function updateFlicker() {
        for (let i = 0, k = (0.05 * this.height) | 0; i < k; ++i) {
          let ry = (Math.random() * this.height) | 0;
          let rl = (2 * Math.random() * flickerRange - flickerRange) | 0;
          this.computeLine(ry, currentLimit + rl, this.state.magnificationFactor, this.state.translateXFactor, this.state.translateYFactor);
          this.updateLine(ry);
        }
        if (animate) {
          updateFlickerTimer = setTimeout(updateFlicker, 1000 / 30);
        }else {
          clearTimeout(updateFlickerTimer)
        }
      })();
    }
    this.render()
  }

  installKeys() {
    document.onkeypress = e => {
      if (e.key === '+') {
        this.state.magnificationFactor /= 1.5
      }
      else if (e.key === '-') {
        this.state.magnificationFactor *= 1.5
      }
      else if (e.key === 'l' && !e.shiftKey) {
        this.state.limit += 5
      }
      else if (e.key === 'l' && e.shiftKey) {
        this.state.limit -= 5
      }
      else if (e.key === 'p') {
        animate = !animate
      }
      else if (e.key === 'a') {
        this.state.translateXFactor += 0.1
      }
      else if (e.key === 'd') {
        this.state.translateXFactor -= 0.1
      }
      else if (e.key === 'w') {
        this.state.translateYFactor += 0.1
      }
      else if (e.key === 's') {
        this.state.translateYFactor -= 0.1
      } else {
        return
      }
      this.paint()
    }
  }

}


// Set this to false if you prefer a plain image instead.
export var animate = false;

// Compute a nice set of colors using a gradient
export function computeColors() {
  var canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1;
  var ctx = canvas.getContext("2d");
  var grd = ctx.createLinearGradient(0, 0, 2048, 0);
  grd.addColorStop(0.00, "#000764");
  grd.addColorStop(0.16, "#2068CB");
  grd.addColorStop(0.42, "#EDFFFF");
  grd.addColorStop(0.6425, "#FFAA00");
  grd.addColorStop(0.8575, "#000200");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 2048, 1);
  canvas.className = "gradient";
  setTimeout(() => document.body.appendChild(canvas));
  return new Uint32Array(ctx.getImageData(0, 0, 2048, 1).data.buffer);
}

async function main() {
  try {
    layout()
    const app = await new Application(state).start()
    // installKeys(app)
    app.paint()
  } catch (error) {
    alert("Failed to load WASM: " + error.message + " (ad blocker, maybe?)");
    console.log(error.stack);
  }
}

main()



// export async function start() {  

//   // const app = await new Application().start()
//   // app.paint()

//   // var computeLine = app.module.instance.exports.computeLine;

//   // function paint() {
//   //   // Compute an initial balanced version of the set.
//   //   for (let y = 0; y < app.height; ++y) {
//   //     app.computeLine(y, limit, this.state.magnificationFactor, this.state.translateXFactor, translateYFactor);
//   //     app.updateLine(y);
//   //   }

//   //   if (animate) {

//   //     // Let it glow a bit by occasionally shifting the limit...
//   //     var currentLimit = limit;
//   //     var shiftRange = 10;
//   //     (function updateShift() {
//   //       currentLimit = limit + (2 * Math.random() * shiftRange - shiftRange) | 0
//   //       if (animate) {
//   //         setTimeout(updateShift, 1000 + (1500 * Math.random()) | 0);
//   //       }
//   //     })();

//   //     // ...while continuously recomputing a subset of it.
//   //     var flickerRange = 3;
//   //     (function updateFlicker() {
//   //       for (let i = 0, k = (0.05 * app.height) | 0; i < k; ++i) {
//   //         let ry = (Math.random() * app.height) | 0;
//   //         let rl = (2 * Math.random() * flickerRange - flickerRange) | 0;
//   //         app.computeLine(ry, currentLimit + rl, this.state.magnificationFactor, this.state.translateXFactor, translateYFactor);
//   //         app.updateLine(ry);
//   //       }
//   //       if (animate) {
//   //         setTimeout(updateFlicker, 1000 / 30);
//   //       }
//   //     })();

//   //     // }
//   //   }
    
//   //   app.render()
//   //   // if (animate) {
//   //   //   requestAnimationFrame(render);
//   //   // }
//   //   // else {
//   //   //   render()
//   //   // }
//   // }
//   // paint();

//   // let renderCount = 0;
//   // setInterval(() => {
//   //   const fps = renderCount
//   //   renderCount = 0
//   //   document.querySelector('.fps').innerHTML = fps+''

//   // // }, 1000);
//   // // Keep rendering the image buffer.
//   // (function render() {
//   //   // if (animate) requestAnimationFrame(render);
//   //   if (animate) setTimeout(render, 1000)
//   //   ctx.putImageData(imageData, 0, 0);
//   //   // renderCount++
//   // })();

// }

