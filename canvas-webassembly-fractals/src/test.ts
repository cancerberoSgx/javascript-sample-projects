import { randomIntBetween, randomCssColor } from 'misc-utils-of-mine-generic'

const canvas = document.createElement('canvas')
document.body.append(canvas)
canvas.width=700
canvas.height=600
const c = canvas.getContext('2d')

function f() {
  c.fillStyle = randomCssColor()
  c.strokeStyle = randomCssColor()

  c.rect(0, 0, canvas.width, canvas.height)
  c.fill()

  c.moveTo(0, 0);
  c.lineTo(200, 100);
  c.stroke();
}

setInterval(f, 1000)
export {}
