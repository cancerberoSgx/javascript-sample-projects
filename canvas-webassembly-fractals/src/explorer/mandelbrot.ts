import { Fractal } from "./types"

export class Mandelbrot implements Fractal {
  iterations = 100
  magnificationFactor = 200;
  panX = 2;
  panY = 1.5;
  belongsTo(x: number, y: number): number {
    var realComponentOfResult = x
    var imaginaryComponentOfResult = y
    for (var i = 0; i < this.iterations; i++) {
      var tempRealComponent = realComponentOfResult * realComponentOfResult
        - imaginaryComponentOfResult * imaginaryComponentOfResult
        + x
      var tempImaginaryComponent = 2 * realComponentOfResult * imaginaryComponentOfResult
        + y
      realComponentOfResult = tempRealComponent
      imaginaryComponentOfResult = tempImaginaryComponent
      // Return a number as a percentage
      if (realComponentOfResult * imaginaryComponentOfResult > 5) {
        return i / this.iterations * 100
      }
    }
    return 0;   // Return zero if in set  
  }

  render(canvas: HTMLCanvasElement) {
   
    const ctx = canvas.getContext('2d')
    for (var x = 0; x < canvas.width; x++) {
      for (var y = 0; y < canvas.height; y++) {
        var belongsToSet = this.belongsTo(x / this.magnificationFactor - this.panX, y / this.magnificationFactor - this.panY)
        if (belongsToSet == 0) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, 1, 1); // Draw a black pixel
        } else {
          ctx.fillStyle = 'hsl(0, 100%, ' + belongsToSet + '%)';
          ctx.fillRect(x, y, 1, 1); // Draw a colorful pixel
        }
      }
    }
  }
}