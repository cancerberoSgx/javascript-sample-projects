import { getParametersFromUrl, parseUrl } from 'misc-utils-of-mine-generic'
import { State } from './store/state'
import { getState, setState } from './store/store'

/** when the app starts, given url must be parsed and the state updated. Example /search/?skip=100 - state.search.skip=100 */
export async function setStateFromUrl(url?: string) {
  url = url || window.location.href
  const params = getParametersFromUrl(window.location.href, { parseNumber: true })
  const s = getState()
  if (['/search', '/'].includes(window.location.pathname)) {
    s.page = 'search'
    Object.assign(s.search, params)
  }
  else if (['/test'].includes(window.location.pathname)) {
    s.page = 'test'
  }
  else {
    s.page = '404'
  }
  setState(s)
  // console.log(s);
}

/**
 * some state changes (links) should be reflected in window.location
 */
export function stateToUrl(state: State): string | undefined {
  if (state.page === 'search') {
    return `/search?limit=${state.search.limit}&skip=${state.search.skip}`
  } else if (state.page === 'test') {
    return `/test`
  }
}
/** when user lands on an url or navigates we need to decode the state from the url */
export function urlToState(url: string): State {
  const s = getState()
  const location = parseUrl(url)
  const params = getParametersFromUrl(url, { parseNumber: true })
  if (location?.pathname === '/search') {
    s.page = 'search'
    s.search = { ...s.search, ...params }
  }
  else if (location?.pathname === '/test') {
    s.page = 'test'
  }
  else {
    s.page = '404'
  }
  return s
}