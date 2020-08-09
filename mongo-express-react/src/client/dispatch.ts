import axios from 'axios'
import { SearchResult } from "../types"
import { Search } from "./store/state"
import { getState, setState } from "./store/store"

export async function search(search: Partial<Search>) {
  const s = getState()
  Object.assign(s.search, search)
  s.search.loading = true
  try {
    const response = await axios.get<SearchResult>(`v1/search?skip=${s.search.skip}&limit=${s.search.limit}`)
    s.search = { ...s.search, ...response.data }
  } catch (error) {
    s.search.error = error
  }
  s.search.loading = false
  setState(s)
}
