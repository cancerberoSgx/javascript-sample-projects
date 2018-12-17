import { f } from "../src";

export default describe('f', () => {
  it('should sum', async done => {
    expect(f(1,2)).toBe(3)
    done()
  })
})
