export function f1(): number {
  return 123
}




// see: https://en.wikipedia.org/wiki/Mandelbrot_set

/** Number of discrete color values on the JS side. */
const NUM_COLORS = 2048;

/** Computes a single line in the rectangle `width` x `height`. */
export function computeLine(y: f64, width: f64, height: f64, limit: f64, magnificationFactor: f64, translateXFactor: f64, translateYFactor: f64): void {
  var translateX = width * translateXFactor;
  // var translateX = width  * (1.0 / 1.6);
  var translateY = height * translateYFactor;
  // var translateY = height * (1.0 / 2.0);
  var scale = magnificationFactor / min(3.0 * width, 4.0 * height);
  var imaginary = (y - translateY) * scale;
  var realOffset = translateX * scale;
  var stride = i32(y * width) << 1;
  var invLimit = 1.0 / limit;

  var minIterations = min(8, limit);

  for (let x: f64 = 0; x < width; ++x) {
    let real = x * scale - realOffset;

    // Iterate until either the escape radius or iteration limit is exceeded
    let ix = 0.0, iy = 0.0, ixSq: f64, iySq: f64;
    let iteration: f64 = 0;
    while ((ixSq = ix * ix) + (iySq = iy * iy) <= 4.0) {
      iy = 2.0 * ix * iy + imaginary;
      ix = ixSq - iySq + real;
      if (iteration >= limit) break;
      ++iteration;
    }

    // Do a few extra iterations for quick escapes to reduce error margin
    while (iteration < minIterations) {
      let ixNew = ix * ix - iy * iy + real;
      iy = 2.0 * ix * iy + imaginary;
      ix = ixNew;
      ++iteration;
    }

    // Iteration count is a discrete value in the range [0, limit] here, but we'd like it to be
    // normalized in the range [0, 2047] so it maps to the gradient computed in JS.
    // see also: http://linas.org/art-gallery/escape/escape.html
    let col = NUM_COLORS - 1;
    let sqd = ix * ix + iy * iy;
    if (sqd > 1.0) {
      let frac = Math.log2(0.5 * Math.log(sqd));
      col = <u32>((NUM_COLORS - 1) * clamp<f64>((iteration + 1 - frac) * invLimit, 0.0, 1.0));
    }
    store<u16>(stride + (u16(x) << 1), col);
  }
}

@inline function clamp<T>(value: T, minValue: T, maxValue: T): T {
  return min(max(value, minValue), maxValue);
}
@inline function randomIntBetween<T extends number>(a: T, b: T): T {
  return trunc(Math.random() * b) + a as T;
}
@inline function randomU8(a: u8, b: u8): u8 {
  return u8(trunc(Math.random() * b) + a)
}

export function sharedMemTest(width: u32, height: u32): number {
  const size = width * height * 4;
  for (let i:u32 = 0; i < size; i++) {  
    store<u8>(i, randomU8(0, 255));
  }
  // for (let y: u32 = 0; y < height; y++) {
  //   for (let x: u32 = 0; x < width; x++) {
  //     store<u8>(y * width + x, randomU8(0, 255));
  //   }
  // }
  return randomIntBetween(1, 12)
}

// int data[WIDTH * HEIGHT];
// int red = (255 << 24) | 255;

// int* EMSCRIPTEN_KEEPALIVE render() {
//    for (int y = 0; y < HEIGHT; y++) {
//      int yw = y * WIDTH;
//      for (int x = 0; x < WIDTH; x++) {
//        data[yw + x] = red;
//      }
//    }
//    return &data[0];
// }