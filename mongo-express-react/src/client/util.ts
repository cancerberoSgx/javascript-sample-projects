// // TODO: all is implemented in misc-util-mine - publish and update

// // import {isAbso} from 'misc-utils-of-mine-generic'

// /**
//  * Parse url, emulates window.location format
//  */
// export function parseUrl(url: string, options: {parseParams?: boolean} = {}) {
//   const isAbsolute = isAbsoluteUrl(url)
//   if (!isAbsolute) {
//     url = 'http://foo.com' + (url.startsWith('/') ? '' : '/') + url
//   }
//   const results = /^([^:]+:)\/\/([^\/]+)(.*)/.exec(url)
//   if (!results) {
//     return null
//   }
//   let [all, protocol, domain, rest] = results
//   let pathname = rest
//   let i = pathname.indexOf('?')
//   if (i !== -1) {
//     pathname = pathname.substring(0, i)
//   }
//   // case no params: http://foo.com/bar#hash
//   i = pathname.indexOf('#')
//   if (i !== -1) {
//     pathname = pathname.substring(0, i)
//   }
//   let search = ''
//   i = rest.indexOf('?')
//   if (i !== -1) {
//     search = rest.substring(i)
//     i = search.indexOf('#')
//     if (i !== -1) {
//       search = search.substring(0, i)
//     }
//   }
//   let hash = ''
//   i = rest.indexOf('#') // yes we're doing it twice
//   if (i !== -1) {
//     hash = rest.substring(i)
//   }
//   if (!isAbsolute) {
//     domain = ''
//     protocol = ''
//   }
//   const result = {protocol, domain, pathname, search, hash}
//   if(options.parseParams) {
//     result.params = pars
//   }
//   return {
    
//   }
// }
