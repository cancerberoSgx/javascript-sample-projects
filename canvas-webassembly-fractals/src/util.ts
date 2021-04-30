export function createCanvas() {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  canvas.width = 700;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}
