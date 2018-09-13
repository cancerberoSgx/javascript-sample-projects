
const shell = require('shelljs')
const config = require('./config')

shell.config.silent=true

let token

// https://beta.developer.spotify.com/documentation/general/guides/authorization-guide/#client-credentials-flow
const getToken = () => {
  if (token) {
    return token
  }
  const p = shell.exec(`curl --silent -X "POST" -H "Authorization: Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}" -d grant_type=client_credentials https://accounts.spotify.com/api/token`)
  return JSON.parse(p.stdout).access_token

}



// https://beta.developer.spotify.com/documentation/web-api/reference/search/search/
/**
 * 
 * @param {string} query examples: 'carlos gardel'  , album:gold artist:abba' 
 * @param {*} type array which values can be any of 
 */
const search = (query, type) => {
  const cmd = `curl --silent -X GET "https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type.map(type => type).join(',')}" -H "Authorization: Bearer ${getToken()}"`  
  const p = shell.exec(cmd)
  return JSON.parse(p.stdout)
}

module.exports = {getToken, search}


// // more understandable: 
// // module.exports.getToken = getToken
// // module.exports.search = search