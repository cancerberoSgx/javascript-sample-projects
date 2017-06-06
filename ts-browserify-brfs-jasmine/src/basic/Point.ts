
export class Point {
	x: number

	constructor(x: number, public y: number = 0) {
		this.x = x
	}

	dist() { 
		return Math.sqrt(this.x * this.x + this.y * this.y) 
	}

	static origin = new Point(0, 0)
}
