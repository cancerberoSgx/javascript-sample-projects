import { randomIntBetween } from "misc-utils-of-mine-generic"

async function main() {
const width = 200, height = 200
const canvas = document.createElement('canvas')
canvas.width = width
canvas.height = height
canvas.style.border='2px solid pink'
const ctx = canvas.getContext('2d')
document.body.append(canvas)

// Compute the size of and instantiate the module's memory
const memSize = 256;
const memory = new WebAssembly.Memory({ initial: memSize, maximum: memSize });

const response = await fetch("build/optimized.wasm")
const buffer = await response.arrayBuffer()
const module = await WebAssembly.instantiate(buffer, {
  env: { memory },
  Math: Math as any
})
const sharedMemTest = module.instance.exports.sharedMemTest as any

console.log(sharedMemTest(width, height));

const data = new Uint8ClampedArray(memory.buffer, 0, width * height * 4);
const imageData = new ImageData(data, width, height)
// for (let i = 0; i < data.length; i++) {
//   data[i] = randomIntBetween(0,255)
// }

ctx.fillStyle='blue'
ctx.strokeStyle='black'
ctx.fillRect(10,12,50,60)
ctx.putImageData(imageData, 0, 0)
// ctx.fill()
}

main()

// function test(){
// const memory = new WebAssembly.Memory({ initial:256 });
// const width = 2, height = 2
// const data = new Uint8ClampedArray(memory.buffer, 0, width * height * 4);

// }

// test()