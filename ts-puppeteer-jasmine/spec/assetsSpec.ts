export default describe('assets', () => {
  it('fn.png should be available', async done => {
    let r =  await fetch('fn.png')
    expect(r.ok).toBe(true)
    done()
  })
})
