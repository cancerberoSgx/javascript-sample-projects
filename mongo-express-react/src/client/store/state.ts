import { Movie } from "../../types";

export interface State {
  search: Search
  test: {
    counter: number
  }
}

export interface Search {
  error?: Error;
  skip: number
  limit: number
  results: Movie[]
  loading: boolean
}

export function getInitialState(appOptions: AppOptions): State {
  return {
    search: {
      skip: 0,
      limit: 10,
      results: [],
      loading: true,
      error: undefined
    },
    test: {
      counter: 0
    }
  }
}

export interface AppOptions{}
