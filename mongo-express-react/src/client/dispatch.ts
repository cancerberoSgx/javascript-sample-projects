import axios from 'axios'
import { SearchResult } from "../types"
import { Search } from "./store/state"
import { getState, setState } from "./store/store"
import { urlToState, stateToUrl } from './history'
import { printMs } from 'misc-utils-of-mine-generic';

export async function search(search: Partial<Search>) {
  const s = {...getState(), ...urlToState()}
  Object.assign(s.search, search)
  s.search.loading = true
  setState(s)
  try {
    const response = await axios.get<SearchResult>(`v1/search?skip=${s.search.skip}&limit=${s.search.limit}&genres=${s.search.genres.join(',')}`)
    s.search = { ...s.search, ...response.data }
  } catch (error) {
    s.search.error = error
  }

  s.search.loading = false
  const url = stateToUrl(s)

  // console.log(url, s);
  history.pushState({}, document.title, url)

  setState(s)
  
}
