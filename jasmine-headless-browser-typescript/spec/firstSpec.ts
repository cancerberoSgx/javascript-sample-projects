import {imageInfo} from '../src/first'

import * as MyImage from './assets/rotate.png'


describe('assets', ()=>{
  it('rotate.png image url should be available', done=>{
    expect(MyImage).toContain('.png')
    expect(imageInfo('foo.png')).toBe(1)
    done()
  })
})

// export default undefined