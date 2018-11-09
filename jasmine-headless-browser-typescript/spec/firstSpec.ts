import {imageInfo} from '../src/first'
describe('first', ()=>{
  it('1', done=>{
    expect(imageInfo('foo.png')).toBe(1)
    done()
  })
})

// export default undefined