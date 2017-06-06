declare var describe: any
declare var it: any
declare var expect: any

import {Point} from "../src/basic/Point"

describe('1', ()=>
{
	it('2',()=>
	{
		let p = new Point(1, 2)
		console.log('point', p)
		expect(1).toBe(1)
	})
})