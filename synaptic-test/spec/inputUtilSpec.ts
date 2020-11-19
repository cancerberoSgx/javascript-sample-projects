import {number2input_straight} from '../src/inputUtil'
import {dec2bin, bin2dec} from '../src/baseConverter'

describe('util', ()=>{
	it('buildNumber', ()=>{
		expect([dec2bin(13), number2input_straight(13, 8), bin2dec( number2input_straight(13, 8))]).toEqual([[ 1, 1, 0, 1 ], [
			0, 0, 0, 0,
			1, 1, 0, 1
		], 13])

	})
})