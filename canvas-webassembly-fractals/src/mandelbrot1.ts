// from https://progur.com/2017/02/create-mandelbrot-fractal-javascript.html

import { createCanvas } from "./util"

const { canvas, ctx } = createCanvas()

function checkIfBelongsToMandelbrotSet(x, y, maxIterations = 100) {
  var realComponentOfResult = x;
  var imaginaryComponentOfResult = y;
  for (var i = 0; i < maxIterations; i++) {
    var tempRealComponent = realComponentOfResult * realComponentOfResult
      - imaginaryComponentOfResult * imaginaryComponentOfResult
      + x;
    var tempImaginaryComponent = 2 * realComponentOfResult * imaginaryComponentOfResult
      + y;
    realComponentOfResult = tempRealComponent;
    imaginaryComponentOfResult = tempImaginaryComponent;
    // Return a number as a percentage
    if (realComponentOfResult * imaginaryComponentOfResult > 5) {
      return (i / maxIterations * 100);
    }
  }
  return 0;   // Return zero if in set  
}


async function mandelbrot1() {
  console.time('mandelbrot1')
  const magnificationFactor = 200;
  const panX = 2;
  const panY = 1.5;
  const maxIterations = 100;
  for (var x = 0; x < canvas.width; x++) {
    for (var y = 0; y < canvas.height; y++) {
      var belongsToSet = checkIfBelongsToMandelbrotSet(x / magnificationFactor - panX, y / magnificationFactor - panY, maxIterations)
      // if (belongsToSet) {
      //   ctx.fillRect(x, y, 1, 1); // Draw a black pixel
      // }
      if (belongsToSet == 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, 1, 1); // Draw a black pixel
      } else {
        ctx.fillStyle = 'hsl(0, 100%, ' + belongsToSet + '%)';
        ctx.fillRect(x, y, 1, 1); // Draw a colorful pixel
      }
    }
  }
  console.timeEnd('mandelbrot1')
}

mandelbrot1()
export { }