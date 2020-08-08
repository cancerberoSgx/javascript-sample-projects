import axios from 'axios'
import { baseUrl } from './config'
import { SearchResult } from '../types'

describe('search', () => {
  it('should respect skip and limit', async () => {
    const response = await axios.get<SearchResult>(`${baseUrl}/v1/search?skip=0&limit=5`)
    expect(response.data.limit).toBe(5)
    expect(response.data.skip).toBe(0)
    expect(response.data.results.length).toBe(5)
    expectPositiveNumber(response.data.total)
  })
})

export function expectPositiveNumber(value: any) {
  expect(typeof value).toBe('number')
  expect(value).toBeGreaterThan(0)
}
