const api = require('../src/api')

describe('apiGetTokenSpec', () => {
  it('should Work', () => {
    expect(api.getToken()).toBeTruthy()
  })
})


describe('api search', () => {
  it('search artist', () => {
    const results = api.search('carlos gardel',['artist'])
    // debugger;
    // console.log(results)
    expect(results.artists.items.length).toBeGreaterThan(0)
  })
  it('search track', () => {
    const results = api.search('colombina artist:jaime roos',['track'])
    // console.log(results)
    expect(results.tracks.items.length).toBeGreaterThan(0)
    // find the preview_url - 
  })

})