import { Movie } from '../../types'

export interface State {
  page: 'search' | 'test' | '404'
  search: Search
  test: {
    counter: number
  }
}

export interface Search {
  error?: Error
  skip: number
  limit: number
  results: Movie[]
  loading: boolean
}

export function getInitialState(appOptions: AppOptions): State {
  return {
    page: 'search',
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

export interface AppOptions { }
