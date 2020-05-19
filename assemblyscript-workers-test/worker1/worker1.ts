onmessage = function(e) {
  console.log('WRKER: Message received from main script', e);
  var workerResult = 'Result: ' + e
  console.log('WORKER: Posting message back to main script');
  const canvas = e.data.canvas as OffscreenCanvas
  const ctx = canvas.getContext('2d')
  function draw(){
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = randomCssColor()
      ctx.fillRect(int(0,10), int(0,10), int(10,canvas.width), int(10,canvas.width))
      ctx.fill()
    }
    requestAnimationFrame(draw)
  }
  draw()

  postMessage(workerResult, undefined as any);
}


function int(a: number, b: number) {
  return Math.floor(Math.random() * b) + a
}

function randomCssColor() {
  return `rgb(${int(0, 255)}, ${int(0, 255)}, ${int(0, 255)}, ${Math.random()})`;
}

// export function float(a: number, b: number) {
//   return Math.random() * b + a
// }
export {}
