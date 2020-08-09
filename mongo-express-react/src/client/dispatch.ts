import { Search } from "./store/state";
import Axios from "axios";

import axios from 'axios'
import { SearchResult } from "../types";
import { getState, setState } from "./store/store";

export async function search(search: Partial<Search>) {
  const s = getState()
  Object.assign(s.search, search)
  s.search.loading = true
  try {
    const response = await axios.get<SearchResult>(`v1/search?skip=${search.skip}&limit=${search.limit}`)
    // console.log(response.status);
    s.search = {...s.search, ...search, ...response.data}
  } catch (error) {
    s.search.error = error
  }
  s.search.loading = false
  console.log(s.search);
  
  setState(s)
}
