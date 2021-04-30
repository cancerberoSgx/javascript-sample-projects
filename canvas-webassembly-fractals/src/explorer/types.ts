export interface Fractal {
  iterations: number;
  magnificationFactor: number;
  panX: number;
  panY: number;
  belongsTo(x: number, y: number): number;
  render(canvas: HTMLCanvasElement);
}
