import { Search } from "./store/state";
import Axios from "axios";

import axios from 'axios'
import { SearchResult } from "../types";
import { getState, setState } from "./store/store";

export async function search(search: Partial<Search>) {
  const s = getState()
  Object.assign(s.search, search)
  s.search.loading = true
  setState(s)
  try {
    search = {...getState().search, ...search}
    const response = await axios.get<SearchResult>(`v1/search?skip=${search.skip}&limit=${search.limit}`)
  } catch (error) {
    s.search.error = error
  }
}
