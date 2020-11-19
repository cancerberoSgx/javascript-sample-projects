import {buildNumber} from '../src/inputUtil'
import {dec2bin, bin2dec} from '../src/baseConverter'

describe('util', ()=>{
	it('buildNumber', ()=>{
		expect([dec2bin(13), buildNumber(13, 8), bin2dec( buildNumber(13, 8))]).toEqual([[ 1, 1, 0, 1 ], [
			0, 0, 0, 0,
			1, 1, 0, 1
		], 13])

	})
})