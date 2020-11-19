var convert = require('../src/baseConverter')
describe('baseConverter', ()=>{
	it('baseConverter', ()=>{
		var input = 97
		var output = convert.dec2bin(input)
		expect(output.join('')).toBe([ 1, 1, 0, 0, 0, 0, 1 ].join(''))

		expect(convert.bin2dec(output)).toBe(input)
	})

	it('arrayLength', ()=>{
		var input = 97
		var output = convert.dec2bin(input, 20)
		expect(output.length).toBe(20)
		expect(output.join('')).toBe([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1 ].join(''))
		// expect(convert.bin2dec(input, 20)).toBe(input)
	})
})