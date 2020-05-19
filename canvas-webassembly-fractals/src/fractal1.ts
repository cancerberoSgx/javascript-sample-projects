import { randomCssColor, IPoint } from 'misc-utils-of-mine-generic'
import { createCanvas } from './util'

const { canvas, ctx } = createCanvas()

let points: IPoint[] = [{
  x: canvas.width / 2,
  y: canvas.height / 2,
}]
let iteration = 1

function f() {
  const size = 200 / iteration
  const newPoints = []
  points.forEach(p => {
    ctx.strokeStyle = randomCssColor()
    ctx.rect(p.x - size / 2, p.y - size / 2, size, size)
    ctx.stroke()
    newPoints.push(
      { x: p.x - size / 2, y: p.y - size / 2 },
      { x: p.x + size / 2, y: p.y - size / 2 },
      { x: p.x - size / 2, y: p.y + size / 2 },
      { x: p.x + size / 2, y: p.y + size / 2 },
      // TODO filter points outside viewport
    )
  })
  points = newPoints
  iteration++;
}

f()
f()
export {}
