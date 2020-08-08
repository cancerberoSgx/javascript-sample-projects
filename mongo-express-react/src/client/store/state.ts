export interface State {
  search: {
    skip: number
    limit: number
  }
  test: {
    counter: number
  }
}

export function getInitialState(appOptions: AppOptions): State {
  return {
    search: {
      skip: 0,
      limit: 10
    },
    test: {
      counter: 0
    }
  }
}

export interface AppOptions{}
