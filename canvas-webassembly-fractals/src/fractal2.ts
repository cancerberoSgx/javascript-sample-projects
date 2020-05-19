import { serial, wait, array, randomCssColor, IPoint, IRect, pointInside, randomItems, shuffle, sleep, randomIntBetween } from 'misc-utils-of-mine-generic';
import { createCanvas } from './util';

const { canvas } = createCanvas()

let points: IPoint[] = [{
  x: canvas.width / 2,
  y: canvas.height / 2,
}]
let iteration = 1
// c.strokeStyle = randomCssColor()
const viewport: IRect = {
  x: 0, y: 0, width: canvas.width, height: canvas.height
}

async function f(draw = true, removedPoints=4) {
const ctx = canvas.getContext('2d')
const size = canvas.width / (iteration*3)
  const newPoints = []
  await serial(points.map(p => async () => {
    if (draw) {
      ctx.rect(p.x - size / 2, p.y - size / 2, size, size)
    }
    const partialPoints = [
      { x: p.x - size / 2, y: p.y - size / 2 },
      { x: p.x + size / 2, y: p.y - size / 2 },
      { x: p.x - size / 2, y: p.y + size / 2 },
      { x: p.x + size / 2, y: p.y + size / 2 },
    ]
    .filter(p => pointInside(p, viewport))

    newPoints.push(...randomItems(partialPoints, removedPoints))
  }))
  if (draw) {
    ctx.clearRect(0,0,canvas.width, canvas.height)
    ctx.stroke()
    await sleep(500)
    ctx.clearRect(0,0,canvas.width, canvas.height)
  }
  points = newPoints
  iteration++;
}

async function iterate(iterations = 5, removedPoints=4, draw=false) {
  await serial(array(iterations).map(iteration => async () => {
    console.time(`iteration ${iteration}`)
    await f(draw, removedPoints);
    console.timeEnd(`iteration ${iteration}`)
  }))
}

async function fractal() {
  console.time('fractal2')
  const iterations = [[1,1], [1,1], [1, 1], [1, 1]]
  await serial(iterations.map((iteration, i)=>async ()=>{
    const count = randomIntBetween(iteration[0], iteration[1])
    await iterate(count, 4, true)
  }))
  await serial(iterations.map((iteration, i)=>async ()=>{
    const count = randomIntBetween(iteration[0], iteration[1])
    await iterate(count, 4, true)
  }))
  // await iterate(2, 4, true)
  // await iterate(2, 3, true)
  // await iterate(3, 2, true)
  // await iterate(4, 1, true)
  // f(true)
  console.timeEnd('fractal2')
}

fractal()

export {}
