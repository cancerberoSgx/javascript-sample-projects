
export class Point {
	x: number

	constructor(x: number, public y: number = 0) {
		this.x = x
	}

	dist() { 
		return Math.sqrt(this.x * this.x + this.y * this.y) 
	}

	err1(): any{
		return undefined
	}

	err() {
		return this.err1().toString()
	}

	static origin = new Point(0, 0)
}
