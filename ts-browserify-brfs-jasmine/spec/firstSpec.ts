/// <reference path="jasmine-globals.ts" />

import {Point} from "../src/basic/Point"

describe('1', ()=>
{
	it('2',()=>
	{
		let p = new Point(1, 2)
		expect(p.dist()<3).toBe(true)
	})
})